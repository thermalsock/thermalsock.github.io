// spectral-processor.js
// AudioWorkletProcessor for the Spectral Mutation Lab.
//
// This is a real short-time Fourier transform (STFT) engine, not a
// simplified stand-in: windowed analysis frames, an in-place radix-2 FFT,
// per-bin mutation, and constant-overlap-add (COLA) resynthesis. Two fully
// independent channels (L/R), each with its own FFT state, freeze snapshots,
// and random generators — so stereo width comes from the engine itself
// rather than a stereo-widener bolted on afterward.
//
// Resynthesis model: rather than carrying the FFT's own phase forward
// (which is fragile once bins have been shifted/reversed/scattered — phase
// relationships that made sense for the original signal don't apply to a
// rearranged spectrum), every bin is resynthesized from a per-bin phase
// accumulator that simply advances at that bin's natural frequency each
// frame. Magnitude is the only thing mutation ever touches. This is the
// same "bank of oscillators driven by time-varying amplitude" trick real
// phase vocoders use once they stop tracking input phase, and it's what
// gives spectral freezes their smooth, un-buzzy sustain instead of a
// robotic looped-frame sound.

const FFT_SIZE = 2048;
const HOP_SIZE = 512; // 75% overlap — satisfies COLA exactly for a periodic Hann window
const NUM_BINS = FFT_SIZE / 2; // bin 0 = DC, bin NUM_BINS = Nyquist
const TWO_PI = Math.PI * 2;

// --- In-place iterative radix-2 Cooley-Tukey complex FFT --------------------
// invert=false: forward transform. invert=true: inverse transform (includes
// the 1/N scaling). re/im are Float64Arrays of length N (power of 2).
function fftInPlace(re, im, invert) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (invert ? 1 : -1) * (TWO_PI / len);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curWr = 1, curWi = 0;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j], ui = im[i + j];
        const tr = re[i + j + half] * curWr - im[i + j + half] * curWi;
        const ti = re[i + j + half] * curWi + im[i + j + half] * curWr;
        re[i + j] = ur + tr; im[i + j] = ui + ti;
        re[i + j + half] = ur - tr; im[i + j + half] = ui - ti;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr; curWi = nextWi;
      }
    }
  }
  if (invert) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

// Periodic Hann window (denominator N, not N-1) — the version STFT/COLA
// math assumes.
function buildHannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / n);
  return w;
}

// Simulates overlap-add of the (unsquared, analysis-only) window at the
// given hop spacing and returns the steady-state sum — the constant every
// synthesis frame's contribution must be divided by for unity-gain
// reconstruction. Computed once at startup rather than hand-derived, so
// it's correct regardless of the exact window/hop chosen above.
function computeColaNorm(window, hop, n) {
  const simLen = n * 4;
  const acc = new Float64Array(simLen);
  for (let shift = 0; shift < simLen; shift += hop) {
    for (let i = 0; i < n; i++) {
      const idx = shift + i;
      if (idx < simLen) acc[idx] += window[i];
    }
  }
  return acc[Math.floor(simLen / 2)] || 1;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Per-channel spectral engine state --------------------------------------
class ChannelEngine {
  constructor(sr, seed) {
    this.sr = sr;
    this.inRing = new Float64Array(FFT_SIZE);
    this.outRing = new Float64Array(FFT_SIZE);
    this.inWritePos = 0;
    this.outPos = 0; // write cursor: where the next synthesis frame's overlap-add starts
    this._readPos = 0; // read cursor: where the next audio-out sample comes from
    this.hopCounter = 0;

    this.frameRe = new Float64Array(FFT_SIZE);
    this.frameIm = new Float64Array(FFT_SIZE);
    this.liveMag = new Float64Array(NUM_BINS + 1);
    this.frozenAMag = new Float64Array(NUM_BINS + 1);
    this.frozenBMag = new Float64Array(NUM_BINS + 1);
    this.sourceMag = new Float64Array(NUM_BINS + 1);
    this.shiftedMag = new Float64Array(NUM_BINS + 1);
    this.reversedMag = new Float64Array(NUM_BINS + 1);
    this.smearState = new Float64Array(NUM_BINS + 1);
    this.smearedMag = new Float64Array(NUM_BINS + 1);
    this.finalMag = new Float64Array(NUM_BINS + 1);
    this.phaseAccum = new Float64Array(NUM_BINS + 1);
    this.scatterOffset = new Int16Array(NUM_BINS + 1);

    this.hasFrozenA = false;
    this.hasFrozenB = false;

    this.rng = mulberry32(seed);
  }

  captureFreezeA() { this.frozenAMag.set(this.liveMag); this.hasFrozenA = true; }
  captureFreezeB() { this.frozenBMag.set(this.liveMag); this.hasFrozenB = true; }
  clearFreeze() {
    this.frozenAMag.fill(0); this.frozenBMag.fill(0);
    this.hasFrozenA = false; this.hasFrozenB = false;
  }
}

class SpectralProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'inputGain', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'outputGain', defaultValue: 1.6, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'dryWet', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'freezeMix', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'morphAB', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'shiftSemi', defaultValue: 0, minValue: -24, maxValue: 24, automationRate: 'k-rate' },
      { name: 'reverseAmt', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'smearAmt', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'scatterAmt', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.sr = sampleRate;
    this.window = buildHannWindow(FFT_SIZE);
    this.colaNorm = computeColaNorm(this.window, HOP_SIZE, FFT_SIZE);

    this.chL = new ChannelEngine(this.sr, 0x1234);
    this.chR = new ChannelEngine(this.sr, 0x9abc);

    this.monoInput = true;
    this.limiterOn = true;
    this.freezeAActive = false;
    this.freezeBActive = false;

    this._monoScratch = new Float64Array(128);
    this._blockCounter = 0;
    this._cpuLoadEstimate = 0;

    this.port.onmessage = (e) => this._handleMessage(e.data);
  }

  _handleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'freezeA': {
        this.freezeAActive = !!msg.value;
        if (this.freezeAActive) { this.chL.captureFreezeA(); this.chR.captureFreezeA(); }
        break;
      }
      case 'freezeB': {
        this.freezeBActive = !!msg.value;
        if (this.freezeBActive) { this.chL.captureFreezeB(); this.chR.captureFreezeB(); }
        break;
      }
      case 'clearFreeze': {
        this.chL.clearFreeze(); this.chR.clearFreeze();
        this.freezeAActive = false; this.freezeBActive = false;
        break;
      }
      case 'monoInput': this.monoInput = !!msg.value; break;
      case 'limiter': this.limiterOn = !!msg.value; break;
      default: break;
    }
  }

  // Runs the full mutation pipeline for one channel's just-computed liveMag,
  // producing ch.finalMag. Pure function of the channel's current state +
  // the shared knob values in p.
  _mutate(ch, p) {
    const n = NUM_BINS;

    // 1. Freeze blend: live <-> (A morphed with B) <-> fully frozen
    const haveA = ch.hasFrozenA, haveB = ch.hasFrozenB;
    if (p.freezeMix <= 0.0001 || (!haveA && !haveB)) {
      ch.sourceMag.set(ch.liveMag);
    } else {
      for (let k = 0; k <= n; k++) {
        let frozen;
        if (haveA && haveB) frozen = ch.frozenAMag[k] + (ch.frozenBMag[k] - ch.frozenAMag[k]) * p.morphAB;
        else if (haveA) frozen = ch.frozenAMag[k];
        else frozen = ch.frozenBMag[k];
        ch.sourceMag[k] = ch.liveMag[k] + (frozen - ch.liveMag[k]) * p.freezeMix;
      }
    }

    // 2. Spectral shift — resample the magnitude curve by a semitone ratio.
    const ratio = Math.pow(2, p.shiftSemi / 12);
    if (Math.abs(p.shiftSemi) < 0.001) {
      ch.shiftedMag.set(ch.sourceMag);
    } else {
      for (let k = 0; k <= n; k++) {
        const srcPos = k / ratio;
        if (srcPos < 0 || srcPos > n) { ch.shiftedMag[k] = 0; continue; }
        const i0 = Math.floor(srcPos);
        const frac = srcPos - i0;
        const i1 = Math.min(n, i0 + 1);
        ch.shiftedMag[k] = ch.sourceMag[i0] + (ch.sourceMag[i1] - ch.sourceMag[i0]) * frac;
      }
    }

    // 3. Reverse — crossfade toward a frequency-mirrored spectrum.
    if (p.reverseAmt <= 0.0001) {
      ch.reversedMag.set(ch.shiftedMag);
    } else {
      for (let k = 0; k <= n; k++) {
        const mirrored = ch.shiftedMag[n - k];
        ch.reversedMag[k] = ch.shiftedMag[k] + (mirrored - ch.shiftedMag[k]) * p.reverseAmt;
      }
    }

    // 4. Smear — temporal leak (per-bin) + a light frequency-domain blur,
    // both scaled by the same knob for one cohesive "smear" control.
    const leak = p.smearAmt * 0.93;
    for (let k = 0; k <= n; k++) {
      ch.smearState[k] = ch.smearState[k] * leak + ch.reversedMag[k] * (1 - leak);
    }
    const blurRadius = Math.round(p.smearAmt * 8);
    if (blurRadius <= 0) {
      ch.smearedMag.set(ch.smearState);
    } else {
      for (let k = 0; k <= n; k++) {
        let sum = 0, count = 0;
        for (let j = -blurRadius; j <= blurRadius; j++) {
          const idx = k + j;
          if (idx >= 0 && idx <= n) { sum += ch.smearState[idx]; count++; }
        }
        ch.smearedMag[k] = sum / count;
      }
    }

    // 5. Scatter — bins borrow energy from a nearby, occasionally-rerolled
    // offset, continuously evolving rather than a single static scramble.
    if (p.scatterAmt <= 0.0001) {
      ch.finalMag.set(ch.smearedMag);
    } else {
      const radius = 1 + Math.round(p.scatterAmt * 40);
      const rerollProb = p.scatterAmt * 0.12;
      for (let k = 0; k <= n; k++) {
        if (ch.rng() < rerollProb) {
          ch.scatterOffset[k] = Math.round((ch.rng() * 2 - 1) * radius);
        }
        let idx = k + ch.scatterOffset[k];
        if (idx < 0) idx = -idx;
        if (idx > n) idx = n - (idx - n);
        idx = Math.max(0, Math.min(n, idx));
        ch.finalMag[k] = ch.smearedMag[idx];
      }
    }
  }

  // Resynthesizes ch.finalMag into a time-domain frame via the per-bin
  // phase-accumulator oscillator bank, then overlap-adds into ch.outRing.
  _resynthesize(ch) {
    const n = NUM_BINS;
    const re = ch.frameRe, im = ch.frameIm;

    ch.phaseAccum[0] = 0; // DC has no meaningful phase; keep it real-only
    re[0] = ch.finalMag[0]; im[0] = 0;

    for (let k = 1; k < n; k++) {
      ch.phaseAccum[k] += (TWO_PI * HOP_SIZE * k) / FFT_SIZE;
      ch.phaseAccum[k] = ((ch.phaseAccum[k] % TWO_PI) + TWO_PI) % TWO_PI;
      const mag = ch.finalMag[k];
      const ph = ch.phaseAccum[k];
      re[k] = mag * Math.cos(ph);
      im[k] = mag * Math.sin(ph);
      re[FFT_SIZE - k] = re[k];
      im[FFT_SIZE - k] = -im[k];
    }

    re[n] = ch.finalMag[n]; im[n] = 0; // Nyquist — real-only

    fftInPlace(re, im, true); // inverse FFT -> re[] now holds the time-domain frame

    let writePos = ch.outPos;
    const norm = 1 / this.colaNorm;
    for (let i = 0; i < FFT_SIZE; i++) {
      ch.outRing[(writePos + i) % FFT_SIZE] += re[i] * norm;
    }
    ch.outPos = (ch.outPos + HOP_SIZE) % FFT_SIZE;
  }

  _processFrame(ch) {
    const n = NUM_BINS;
    const re = ch.frameRe, im = ch.frameIm;
    const w = this.window;
    const ring = ch.inRing;
    const base = ch.inWritePos;

    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = ring[(base + i) % FFT_SIZE] * w[i];
      im[i] = 0;
    }
    fftInPlace(re, im, false);

    for (let k = 0; k <= n; k++) {
      ch.liveMag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
  }

  process(inputs, outputs, parameters) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const input = inputs[0];
    const output = outputs[0];
    const blockSize = output[0] ? output[0].length : 128;

    const p = {};
    for (const key of Object.keys(parameters)) p[key] = parameters[key][0];

    const hasInput = input && input.length > 0 && input[0].length > 0;
    const inL = hasInput ? input[0] : null;
    const inR = hasInput ? (input[1] || input[0]) : null;

    let inLEff = inL, inREff = inR;
    if (this.monoInput && hasInput) {
      const scratch = blockSize <= this._monoScratch.length ? this._monoScratch : new Float64Array(blockSize);
      for (let i = 0; i < blockSize; i++) scratch[i] = (inL[i] + (inR ? inR[i] : inL[i])) * 0.5;
      inLEff = scratch; inREff = scratch;
    }

    // --- Write input into each channel's analysis ring, hop the STFT -------
    for (const [ch, src] of [[this.chL, inLEff], [this.chR, inREff]]) {
      if (hasInput) {
        for (let i = 0; i < blockSize; i++) {
          ch.inRing[ch.inWritePos] = src[i] * p.inputGain;
          ch.inWritePos = (ch.inWritePos + 1) % FFT_SIZE;
        }
      }
      ch.hopCounter += blockSize;
      while (ch.hopCounter >= HOP_SIZE) {
        ch.hopCounter -= HOP_SIZE;
        this._processFrame(ch);
        this._mutate(ch, p);
        this._resynthesize(ch);
      }
    }

    // --- Read reconstructed audio out of each channel's output ring --------
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];
    // Magnitude-only phase-vocoder resynthesis (see the header comment) can
    // produce some amplitude variation — "phasiness" — on strongly tonal
    // material, since adjacent bins (a sinusoid's main lobe + Hann sidelobes)
    // drift out of the exact phase relationship the window originally gave
    // them once each bin's phase evolves independently. That's most visible
    // on a pure sustained test tone; it's far less noticeable on the
    // harmonically rich, moving program material this is actually built for.
    // Kept deliberately conservative here (rather than matching Granulator's
    // higher fixed makeup gain) so that variation doesn't compound into
    // surprise clipping — the limiter below is the real safety net, and the
    // Output gain knob is there for you to push further once you've heard
    // how loud your own material actually gets.
    const WET_MAKEUP_GAIN = 2.2;

    // outRing's write cursor jumps by HOP_SIZE every synthesis frame; each
    // channel tracks its own separate read cursor advancing by blockSize
    // every call, clearing consumed slots behind it so the next overlap-add
    // into that slot starts from zero.

    for (let i = 0; i < blockSize; i++) {
      const l = this.chL.outRing[this.chL._readPos];
      this.chL.outRing[this.chL._readPos] = 0;
      this.chL._readPos = (this.chL._readPos + 1) % FFT_SIZE;

      const r = this.chR.outRing[this.chR._readPos];
      this.chR.outRing[this.chR._readPos] = 0;
      this.chR._readPos = (this.chR._readPos + 1) % FFT_SIZE;

      const wetL = l * WET_MAKEUP_GAIN;
      const wetR = r * WET_MAKEUP_GAIN;
      const dryL = hasInput ? inLEff[i] : 0;
      const dryR = hasInput ? inREff[i] : 0;

      const mix = p.dryWet;
      let outSampleL = dryL * (1 - mix) + wetL * mix;
      let outSampleR = dryR * (1 - mix) + wetR * mix;
      outSampleL *= p.outputGain;
      outSampleR *= p.outputGain;

      if (this.limiterOn) {
        outSampleL = Math.tanh(outSampleL);
        outSampleR = Math.tanh(outSampleR);
      }
      outL[i] = outSampleL;
      if (outR !== outL) outR[i] = outSampleR;
    }

    // --- Telemetry -----------------------------------------------------------
    this._blockCounter++;
    if (this._blockCounter >= 6) {
      this._blockCounter = 0;
      const n = NUM_BINS;
      const specLen = 256; // downsampled bin count sent to the UI for drawing
      const spectrum = new Float32Array(specLen);
      const step = (n + 1) / specLen;
      for (let i = 0; i < specLen; i++) {
        const bin = Math.min(n, Math.floor(i * step));
        spectrum[i] = (this.chL.finalMag[bin] + this.chR.finalMag[bin]) * 0.5;
      }
      this.port.postMessage({
        type: 'meter',
        spectrum,
        hasFrozenA: this.chL.hasFrozenA,
        hasFrozenB: this.chL.hasFrozenB,
        cpuLoad: this._cpuLoadEstimate,
      }, [spectrum.buffer]);
    }

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const blockBudgetMs = (blockSize / this.sr) * 1000;
    const usedRatio = Math.min(1, (t1 - t0) / Math.max(0.001, blockBudgetMs));
    this._cpuLoadEstimate = this._cpuLoadEstimate * 0.9 + usedRatio * 0.1;

    return true;
  }
}

registerProcessor('spectral-processor', SpectralProcessor);
