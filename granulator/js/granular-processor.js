// granular-processor.js
// AudioWorkletProcessor for the Thermalsock Granulator.
//
// Owns two independent circular buffers (A/B), a grain scheduler, and the
// per-sample grain rendering loop. Runs entirely on the audio rendering
// thread — nothing here touches the DOM or does allocation inside process()
// beyond the fixed-size grain pool, so it stays realtime-safe.
//
// Communication:
//   main thread -> processor : AudioParams (continuous) + port.postMessage (discrete)
//   processor -> main thread : port.postMessage, throttled meter + grain-cloud snapshots

const MAX_BUFFER_SECONDS = 10;
const MAX_GRAINS = 96; // hard cap on simultaneous grains, keeps process() bounded

// --- Envelope shapes ------------------------------------------------------
// Each takes t in [0,1] (position within the grain) and returns amplitude [0,1].
function envHann(t) {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
}
function envGaussian(t) {
  const x = (t - 0.5) / 0.18; // ~0.18 sigma keeps the tails near-zero at the edges
  return Math.exp(-0.5 * x * x);
}
function envTukey(t, alpha = 0.5) {
  if (t < alpha / 2) return 0.5 * (1 + Math.cos(Math.PI * (2 * t / alpha - 1)));
  if (t > 1 - alpha / 2) return 0.5 * (1 + Math.cos(Math.PI * (2 * t / alpha - 2 / alpha + 1)));
  return 1;
}
function envExponential(t) {
  // Fast attack, exponential decay — classic "pluck" grain shape.
  const attack = 0.08;
  if (t < attack) return t / attack;
  const d = (t - attack) / (1 - attack);
  return Math.exp(-5 * d);
}
const ENVELOPES = {
  hann: envHann,
  gaussian: envGaussian,
  tukey: (t) => envTukey(t, 0.5),
  exponential: envExponential,
};
const ENVELOPE_IDS = ['hann', 'gaussian', 'tukey', 'exponential'];

function semitoneToRatio(semi) {
  return Math.pow(2, semi / 12);
}

class Grain {
  constructor() {
    this.active = false;
    this.bufIndex = 0; // 0 = A, 1 = B
    this.readPos = 0; // fractional sample position in the source buffer
    this.step = 1; // playback increment per output sample (pitch ratio, signed for reverse)
    this.age = 0; // samples elapsed
    this.length = 1; // total length in samples
    this.envType = 'hann';
    this.pan = 0; // -1..1, equal-power
    this.panL = 1;
    this.panR = 1;
    this.gainComp = 1;
    this.formant = false;
    this.durationCompScale = 1;
  }
}

class GranulatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'inputGain', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'outputGain', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'dryWet', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'position', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'grainDuration', defaultValue: 60, minValue: 1, maxValue: 200, automationRate: 'k-rate' },
      { name: 'density', defaultValue: 20, minValue: 0.5, maxValue: 200, automationRate: 'k-rate' },
      { name: 'pitch', defaultValue: 0, minValue: -24, maxValue: 24, automationRate: 'k-rate' },
      { name: 'jitter', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'spread', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'crossfadeAB', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'orbitRate', defaultValue: 0.25, minValue: 0.01, maxValue: 8, automationRate: 'k-rate' },
      { name: 'orbitDepth', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'scanSpeed', defaultValue: 1, minValue: -4, maxValue: 4, automationRate: 'k-rate' },
      { name: 'scanStart', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'scanEnd', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();

    this.sr = sampleRate; // global in AudioWorkletGlobalScope
    const maxLen = Math.ceil(MAX_BUFFER_SECONDS * this.sr);

    // Two independent stereo circular buffers.
    this.bufA = [new Float32Array(maxLen), new Float32Array(maxLen)];
    this.bufB = [new Float32Array(maxLen), new Float32Array(maxLen)];
    this.maxLen = maxLen;
    this.activeLen = Math.floor(4 * this.sr); // current active window, default 4s

    this.writeHead = 0;
    this.frozen = false;
    this.autoAdvance = false;
    this.autoPosNorm = 0;
    this.scanRangeMode = 'pingpong'; // 'pingpong' (bounce, no jump) or 'loop' (wrap, jumps end->start)
    this._scanDirection = 1; // +1 or -1, only used by pingpong mode
    this.multiBuffer = false;
    this.activeRecordBuffer = 0; // 0 = A, 1 = B
    this.reverse = false;
    this.pitchLock = false;
    this.formantPreserve = false;
    this.sprayMode = false;
    this.orbitMode = false;
    this.orbitPhase = 0;
    this.limiterOn = true;
    this.stereoMode = 'stereo';
    this.monoInput = true; // sum L+R on the way in — see the note in process()
    this.envType = 'hann';

    this.schedulerPhase = 0; // samples until next grain
    this._posNormBase = 0; // resolved once per block in process(), see step 2
    this._monoScratch = new Float32Array(128); // standard render quantum; grown on demand

    // Fixed grain pool (no GC pressure inside process()).
    this.grains = [];
    for (let i = 0; i < MAX_GRAINS; i++) this.grains.push(new Grain());

    this._blockCounter = 0;
    this._rng = mulberry32(0x9e3779b9);

    this.port.onmessage = (e) => this._handleMessage(e.data);
  }

  _handleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'freeze': this.frozen = !!msg.value; break;
      case 'envelope': if (ENVELOPE_IDS.includes(msg.value)) this.envType = msg.value; break;
      case 'reverse': this.reverse = !!msg.value; break;
      case 'pitchLock': this.pitchLock = !!msg.value; break;
      case 'formantPreserve': this.formantPreserve = !!msg.value; break;
      case 'sprayMode': this.sprayMode = !!msg.value; break;
      case 'orbitMode': this.orbitMode = !!msg.value; break;
      case 'autoAdvance': this.autoAdvance = !!msg.value; break;
      case 'scanRangeMode': this.scanRangeMode = msg.value === 'loop' ? 'loop' : 'pingpong'; break;
      case 'multiBuffer': this.multiBuffer = !!msg.value; break;
      case 'activeRecordBuffer': this.activeRecordBuffer = msg.value === 'B' ? 1 : 0; break;
      case 'stereoMode': this.stereoMode = msg.value === 'mono' ? 'mono' : 'stereo'; break;
      case 'monoInput': this.monoInput = !!msg.value; break;
      case 'limiter': this.limiterOn = !!msg.value; break;
      case 'bufferLengthSeconds': {
        const len = Math.max(1, Math.min(MAX_BUFFER_SECONDS, msg.value));
        this.activeLen = Math.floor(len * this.sr);
        this.writeHead = this.writeHead % this.activeLen;
        break;
      }
      case 'resetBuffers': {
        this.bufA[0].fill(0); this.bufA[1].fill(0);
        this.bufB[0].fill(0); this.bufB[1].fill(0);
        this.writeHead = 0;
        for (const g of this.grains) g.active = false;
        break;
      }
      case 'manualScanPosition': {
        // Absolute normalized position [0,1] set by a UI drag on the waveform.
        this.autoPosNorm = Math.max(0, Math.min(1, msg.value));
        break;
      }
      case 'loadSample': {
        // Direct injection of decoded PCM into the active record buffer —
        // not "played" into it in real time, just written straight in, so
        // a 10-second file loads instantly rather than taking 10 seconds.
        // The main thread is expected to have already sent a matching
        // bufferLengthSeconds message so this.activeLen lines up with
        // msg.numSamples before this arrives.
        const buf = this.activeRecordBuffer === 1 ? this.bufB : this.bufA;
        const { dataL, dataR, numSamples } = msg;
        const len = Math.max(0, Math.min(numSamples, this.activeLen, dataL.length));
        buf[0].fill(0);
        buf[1].fill(0);
        for (let i = 0; i < len; i++) {
          buf[0][i] = dataL[i];
          buf[1][i] = dataR ? dataR[i] : dataL[i];
        }
        this.writeHead = 0;
        for (const g of this.grains) g.active = false; // avoid grains momentarily reading the old content mid-swap
        break;
      }
      default: break;
    }
  }

  // Advances this.autoPosNorm by deltaNorm, bounded to [start, end] per
  // this.scanRangeMode. Degenerate/inverted ranges (end <= start, or a very
  // thin sliver) fall back to a small minimum span around start so this
  // never divides by zero or gets stuck.
  _advanceScanPos(deltaNorm, start, end) {
    let lo = Math.max(0, Math.min(1, start));
    let hi = Math.max(0, Math.min(1, end));
    if (hi - lo < 0.002) hi = Math.min(1, lo + 0.002);

    if (this.scanRangeMode === 'loop') {
      this.autoPosNorm += deltaNorm;
      const range = hi - lo;
      let rel = (this.autoPosNorm - lo) / range;
      rel = ((rel % 1) + 1) % 1;
      this.autoPosNorm = lo + rel * range;
    } else {
      // Ping-pong: apply the persistent direction, then reflect off
      // whichever edge got crossed. Works regardless of deltaNorm's sign
      // (i.e. negative Scan Speed still just changes which edge it heads
      // toward first, not whether it bounces).
      this.autoPosNorm += deltaNorm * this._scanDirection;
      if (this.autoPosNorm >= hi) {
        this.autoPosNorm = hi - (this.autoPosNorm - hi);
        this._scanDirection = -1;
      } else if (this.autoPosNorm <= lo) {
        this.autoPosNorm = lo + (lo - this.autoPosNorm);
        this._scanDirection = 1;
      }
      this.autoPosNorm = Math.max(lo, Math.min(hi, this.autoPosNorm));
    }
  }

  _spawnGrain(params) {
    // Find a free slot; if the pool is full, steal the oldest grain.
    let slot = this.grains.find((g) => !g.active);
    if (!slot) {
      slot = this.grains.reduce((oldest, g) => (g.age / g.length > oldest.age / oldest.length ? g : oldest), this.grains[0]);
    }

    const rnd = this._rng;
    const activeLen = this.activeLen;

    // Base normalized read position for this grain. Resolved centrally in
    // process() into this._posNormBase every block — see the comment there
    // for how live-tracking vs. frozen-scan vs. static-position is chosen.
    let posNorm = this._posNormBase;

    if (this.orbitMode) {
      posNorm += Math.sin(this.orbitPhase) * params.orbitDepth * 0.5;
    }

    let startSample;
    if (this.sprayMode) {
      startSample = rnd() * activeLen;
    } else {
      const jitterSamples = (rnd() - 0.5) * params.jitter * activeLen * 0.5;
      startSample = ((posNorm * activeLen) + jitterSamples);
      startSample = ((startSample % activeLen) + activeLen) % activeLen;
    }

    // Source buffer selection for multi-buffer crossfade.
    let bufIndex = 0;
    if (this.multiBuffer) {
      bufIndex = rnd() < params.crossfadeAB ? 1 : 0;
    }

    let semis = params.pitch;
    if (this.pitchLock) semis = Math.round(semis);
    let ratio = semitoneToRatio(semis);
    const dir = this.reverse ? -1 : 1;

    const durMs = params.grainDuration;
    let lengthSamples = Math.max(8, Math.round((durMs / 1000) * this.sr));
    let durationCompScale = 1;
    if (this.formantPreserve) {
      // Lightweight approximation: keep grain *duration in real time* closer to
      // the nominal setting even as pitch ratio departs from 1, which reduces
      // the "chipmunk" spectral smear you get from naive time+pitch coupling.
      // This is a simple heuristic, not a true LPC/WASM formant corrector.
      durationCompScale = 1 / Math.sqrt(Math.max(0.25, Math.min(4, ratio)));
      lengthSamples = Math.max(8, Math.round(lengthSamples * durationCompScale));
    }

    const spread = params.spread;
    const pan = (rnd() * 2 - 1) * spread;
    const panAngle = (pan * 0.5 + 0.5) * (Math.PI / 2);

    // Density-loudness compensation: with incoherent (unsynchronized) grain
    // overlap, summed RMS energy scales roughly with sqrt(overlap count), so
    // without correction low density sounds much quieter than high density
    // and high density can push into the limiter unnecessarily. Estimating
    // overlap as density * duration and normalizing by its square root keeps
    // perceived loudness far more consistent as you sweep either knob.
    const overlapEstimate = Math.max(0.05, params.density * (lengthSamples / this.sr));
    const gainComp = Math.max(0.5, Math.min(3.2, 1 / Math.sqrt(overlapEstimate)));

    slot.active = true;
    slot.bufIndex = bufIndex;
    slot.readPos = startSample;
    slot.step = ratio * dir;
    slot.age = 0;
    slot.length = lengthSamples;
    slot.envType = this.envType;
    slot.panL = Math.cos(panAngle);
    slot.panR = Math.sin(panAngle);
    slot.gainComp = gainComp;
  }

  _readInterp(buf, ch, pos, len) {
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = buf[ch][((i0 % len) + len) % len];
    const b = buf[ch][(((i0 + 1) % len) + len) % len];
    return a + (b - a) * frac;
  }

  process(inputs, outputs, parameters) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const input = inputs[0];
    const output = outputs[0];
    const blockSize = output[0] ? output[0].length : 128;

    const p = {};
    for (const key of Object.keys(parameters)) p[key] = parameters[key][0];

    const activeLen = this.activeLen;
    const hasInput = input && input.length > 0 && input[0].length > 0;
    const inL = hasInput ? input[0] : null;
    const inR = hasInput ? (input[1] || input[0]) : null;

    // Mono-sum the input once, up front, if enabled — used consistently for
    // both the buffer write and the dry tap below. This is the fix for a
    // one-sided source: many interfaces feed a mono instrument into only one
    // physical input channel, leaving the other silent. Software panning
    // downstream can't correct that (it's spatializing already-imbalanced
    // source material) — summing to mono before anything else touches the
    // signal is what actually restores a balanced stereo image.
    let inLEff = inL;
    let inREff = inR;
    if (this.monoInput && hasInput) {
      const scratch = blockSize <= this._monoScratch.length ? this._monoScratch : new Float32Array(blockSize);
      for (let i = 0; i < blockSize; i++) scratch[i] = (inL[i] + (inR ? inR[i] : inL[i])) * 0.5;
      inLEff = scratch;
      inREff = scratch;
    }

    const recBuf = this.activeRecordBuffer === 1 ? this.bufB : this.bufA;

    // --- 1. Write into the record buffer (unless frozen) -------------------
    if (!this.frozen && hasInput) {
      for (let i = 0; i < blockSize; i++) {
        const l = inLEff[i] * p.inputGain;
        const r = inREff[i] * p.inputGain;
        recBuf[0][this.writeHead] = l;
        recBuf[1][this.writeHead] = r;
        this.writeHead++;
        if (this.writeHead >= activeLen) this.writeHead = 0;
      }
    }

    // --- 2. Resolve this block's grain-source read position -----------------
    // Three modes:
    //  - Frozen: the buffer is a static snapshot. Read position is whatever
    //    the (optionally auto-advancing) scan accumulator says — driven by
    //    manual drag-to-scan on the waveform, and/or scanSpeed if the user
    //    wants it slowly drifting through the frozen material on its own.
    //  - Live + "Live tracking" engaged with scanSpeed left at ~1: the read
    //    position is locked directly to the actual write head (this block's
    //    real recording position), offset backwards by the Position knob —
    //    which in this mode reads as "how far behind the live signal to
    //    granulate", not an absolute buffer location. This is what makes the
    //    default experience granulate what you're playing *right now*
    //    instead of a stale, unrelated point in the buffer's history.
    //  - Live + deliberate scanSpeed away from 1: a genuine time-stretch —
    //    scan through the buffer at a different rate than it's being
    //    recorded, using the free-running accumulator (can go slower,
    //    faster, or in reverse, independent of the live write head).
    //
    // Whenever the accumulator is actually free-running (frozen, or live but
    // not write-head-locked), it's bounded to the [scanStart, scanEnd] region
    // rather than the whole buffer — the "move between two custom areas of
    // the waveform" scan range. scanRangeMode picks how it behaves at the
    // edges: pingpong reflects (direction flips, no audible jump), loop
    // wraps straight from scanEnd back to scanStart.
    const LIVE_LOCK_EPSILON = 0.03;
    const liveLocked = this.autoAdvance && !this.frozen && Math.abs(p.scanSpeed - 1) < LIVE_LOCK_EPSILON;

    if (this.frozen) {
      if (this.autoAdvance) {
        const deltaNorm = (p.scanSpeed * blockSize) / activeLen;
        this._advanceScanPos(deltaNorm, p.scanStart, p.scanEnd);
      }
      this._posNormBase = this.autoPosNorm;
    } else if (liveLocked) {
      const lagNorm = Math.max(0, Math.min(1, p.position));
      this._posNormBase = (((this.writeHead / activeLen) - lagNorm) % 1 + 1) % 1;
      this.autoPosNorm = this._posNormBase; // keep the accumulator in sync for a seamless handoff if scanSpeed moves away from 1
    } else if (this.autoAdvance) {
      const deltaNorm = (p.scanSpeed * blockSize) / activeLen;
      this._advanceScanPos(deltaNorm, p.scanStart, p.scanEnd);
      this._posNormBase = this.autoPosNorm;
    } else {
      this._posNormBase = params.position;
    }

    if (this.orbitMode) {
      this.orbitPhase += 2 * Math.PI * p.orbitRate * (blockSize / this.sr);
      if (this.orbitPhase > Math.PI * 2) this.orbitPhase -= Math.PI * 2;
    }

    // --- 3. Grain scheduler --------------------------------------------------
    const density = Math.max(0.5, p.density);
    let interval = this.sr / density;
    this.schedulerPhase += blockSize;
    let safety = 0;
    while (this.schedulerPhase >= interval && safety < 32) {
      this._spawnGrain(p);
      const jitterScale = 1 + (this._rng() - 0.5) * p.jitter * 0.6;
      interval = Math.max(4, (this.sr / density) * jitterScale);
      this.schedulerPhase -= interval;
      safety++;
    }

    // --- 4. Render active grains ---------------------------------------------
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];
    outL.fill(0);
    if (outR !== outL) outR.fill(0);

    for (const g of this.grains) {
      if (!g.active) continue;
      const buf = g.bufIndex === 1 ? this.bufB : this.bufA;
      const envFn = ENVELOPES[g.envType] || envHann;
      for (let i = 0; i < blockSize; i++) {
        if (g.age >= g.length) { g.active = false; break; }
        const t = g.age / g.length;
        const amp = envFn(t);
        const s = this._readInterp(buf, 0, g.readPos, activeLen);
        const sR = this._readInterp(buf, 1, g.readPos, activeLen);
        outL[i] += s * amp * g.panL * g.gainComp;
        outR[i] += sR * amp * g.panR * g.gainComp;
        g.readPos += g.step;
        if (g.readPos < 0) g.readPos += activeLen;
        if (g.readPos >= activeLen) g.readPos -= activeLen;
        g.age++;
      }
    }

    // Granular synthesis is inherently quieter than the source it's built
    // from: independently-phased overlapping grains partially cancel rather
    // than summing coherently, equal-power panning costs each grain ~3dB at
    // center, and tapered envelopes (Hann/Gaussian/Tukey) spend most of a
    // grain's life below full amplitude. This fixed makeup stage compensates
    // for that so the default Output gain is actually usable in a full mix
    // rather than getting buried under other tracks. The limiter right below
    // remains the safety net against clipping — raising this trades a bit
    // more limiter activity on dense/loud settings for a default level that
    // reads as "present" instead of "quiet" out of the box.
    const WET_MAKEUP_GAIN = 6.0;
    for (let i = 0; i < blockSize; i++) {
      outL[i] *= WET_MAKEUP_GAIN;
      if (outR !== outL) outR[i] *= WET_MAKEUP_GAIN;
    }

    // --- 5. Dry/wet mix + output gain + limiter -------------------------------
    // (Stereo/mono downmix happens *after* this, on the combined signal — see
    // step 6 below. It used to run only on the wet grain output before the
    // dry/wet mix, which meant at low Dry/Wet values you'd still hear the
    // raw, un-downmixed dry input — including any hardware-side channel
    // imbalance from your interface — dominating the output.)
    const mix = p.dryWet;
    const outGain = p.outputGain;
    for (let i = 0; i < blockSize; i++) {
      const dryL = hasInput ? inLEff[i] : 0;
      const dryR = hasInput ? inREff[i] : 0;
      let l = dryL * (1 - mix) + outL[i] * mix;
      let r = dryR * (1 - mix) + outR[i] * mix;
      l *= outGain;
      r *= outGain;
      if (this.limiterOn) {
        l = Math.tanh(l);
        r = Math.tanh(r);
      }
      outL[i] = l;
      if (outR !== outL) outR[i] = r;
    }

    // --- 6. Final stereo/mono downmix -----------------------------------------
    if (this.stereoMode === 'mono') {
      for (let i = 0; i < blockSize; i++) {
        const m = (outL[i] + outR[i]) * 0.5;
        outL[i] = m;
        if (outR !== outL) outR[i] = m;
      }
    }

    // --- 7. Throttled telemetry back to the main thread -----------------------
    this._blockCounter++;
    if (this._blockCounter >= 8) {
      this._blockCounter = 0;
      const readNorm = this._posNormBase;
      const grainSnapshot = [];
      for (const g of this.grains) {
        if (!g.active) continue;
        grainSnapshot.push({
          x: g.readPos / activeLen,
          pitch: Math.log2(Math.max(0.03, Math.abs(g.step))) * 12,
          env: g.envType,
          dur: g.length / this.sr,
          age: g.age / g.length,
          pan: g.panR - g.panL,
        });
      }
      this.port.postMessage({
        type: 'meter',
        writeHeadNorm: this.writeHead / activeLen,
        readHeadNorm: ((readNorm % 1) + 1) % 1,
        activeGrainCount: this.grains.filter((g) => g.active).length,
        cpuLoad: this._cpuLoadEstimate || 0,
      });
      this.port.postMessage({ type: 'grains', list: grainSnapshot });
    }

    // Rough CPU-load proxy: fraction of this block's real-time budget spent
    // rendering it. performance.now() resolution can be coarsened by the
    // browser for privacy, so treat this as an indicative estimate rather
    // than a precise profiler reading — smoothed to avoid jitter.
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const blockBudgetMs = (blockSize / this.sr) * 1000;
    const usedRatio = Math.min(1, (t1 - t0) / Math.max(0.001, blockBudgetMs));
    this._cpuLoadEstimate = (this._cpuLoadEstimate || 0) * 0.9 + usedRatio * 0.1;

    return true;
  }
}

// Small deterministic PRNG (mulberry32) — avoids Math.random() GC/perf quirks
// inside the audio thread and keeps grain scatter reproducible per session.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

registerProcessor('granular-processor', GranulatorProcessor);
