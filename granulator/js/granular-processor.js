const MAX_BUFFER_SECONDS = 10;

const MAX_GRAINS = 96;

function envHann(t) {
  return .5 - .5 * Math.cos(2 * Math.PI * t);
}

function envGaussian(t) {
  const x = (t - .5) / .18;
  return Math.exp(-.5 * x * x);
}

function envTukey(t, alpha = .5) {
  if (t < alpha / 2) return .5 * (1 + Math.cos(Math.PI * (2 * t / alpha - 1)));
  if (t > 1 - alpha / 2) return .5 * (1 + Math.cos(Math.PI * (2 * t / alpha - 2 / alpha + 1)));
  return 1;
}

function envExponential(t) {
  const attack = .08;
  if (t < attack) return t / attack;
  const d = (t - attack) / (1 - attack);
  return Math.exp(-5 * d);
}

const ENVELOPES = {
  hann: envHann,
  gaussian: envGaussian,
  tukey: t => envTukey(t, .5),
  exponential: envExponential
};

const ENVELOPE_IDS = [ "hann", "gaussian", "tukey", "exponential" ];

function semitoneToRatio(semi) {
  return Math.pow(2, semi / 12);
}

class Grain {
  constructor() {
    this.active = false;
    this.bufIndex = 0;
    this.readPos = 0;
    this.step = 1;
    this.age = 0;
    this.length = 1;
    this.envType = "hann";
    this.pan = 0;
    this.panL = 1;
    this.panR = 1;
    this.gainComp = 1;
    this.formant = false;
    this.durationCompScale = 1;
  }
}

class GranulatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [ {
      name: "inputGain",
      defaultValue: 1,
      minValue: 0,
      maxValue: 4,
      automationRate: "k-rate"
    }, {
      name: "outputGain",
      defaultValue: 1,
      minValue: 0,
      maxValue: 4,
      automationRate: "k-rate"
    }, {
      name: "dryWet",
      defaultValue: 1,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "position",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "grainDuration",
      defaultValue: 60,
      minValue: 1,
      maxValue: 200,
      automationRate: "k-rate"
    }, {
      name: "density",
      defaultValue: 20,
      minValue: .5,
      maxValue: 200,
      automationRate: "k-rate"
    }, {
      name: "pitch",
      defaultValue: 0,
      minValue: -24,
      maxValue: 24,
      automationRate: "k-rate"
    }, {
      name: "jitter",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "spread",
      defaultValue: .5,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "crossfadeAB",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "orbitRate",
      defaultValue: .25,
      minValue: .01,
      maxValue: 8,
      automationRate: "k-rate"
    }, {
      name: "orbitDepth",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "scanSpeed",
      defaultValue: 1,
      minValue: -4,
      maxValue: 4,
      automationRate: "k-rate"
    }, {
      name: "scanStart",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "scanEnd",
      defaultValue: 1,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    } ];
  }
  constructor() {
    super();
    this.sr = sampleRate;
    const maxLen = Math.ceil(MAX_BUFFER_SECONDS * this.sr);
    this.bufA = [ new Float32Array(maxLen), new Float32Array(maxLen) ];
    this.bufB = [ new Float32Array(maxLen), new Float32Array(maxLen) ];
    this.maxLen = maxLen;
    this.activeLen = Math.floor(4 * this.sr);
    this.writeHead = 0;
    this.frozen = false;
    this.autoAdvance = false;
    this.autoPosNorm = 0;
    this.scanRangeMode = "pingpong";
    this._scanDirection = 1;
    this.multiBuffer = false;
    this.activeRecordBuffer = 0;
    this.reverse = false;
    this.pitchLock = false;
    this.formantPreserve = false;
    this.sprayMode = false;
    this.orbitMode = false;
    this.orbitPhase = 0;
    this.limiterOn = true;
    this.stereoMode = "stereo";
    this.monoInput = true;
    this.envType = "hann";
    this.schedulerPhase = 0;
    this._posNormBase = 0;
    this._monoScratch = new Float32Array(128);
    this.grains = [];
    for (let i = 0; i < MAX_GRAINS; i++) this.grains.push(new Grain);
    this._blockCounter = 0;
    this._rng = mulberry32(2654435769);
    this.port.onmessage = e => this._handleMessage(e.data);
  }
  _handleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
     case "freeze":
      this.frozen = !!msg.value;
      break;

     case "envelope":
      if (ENVELOPE_IDS.includes(msg.value)) this.envType = msg.value;
      break;

     case "reverse":
      this.reverse = !!msg.value;
      break;

     case "pitchLock":
      this.pitchLock = !!msg.value;
      break;

     case "formantPreserve":
      this.formantPreserve = !!msg.value;
      break;

     case "sprayMode":
      this.sprayMode = !!msg.value;
      break;

     case "orbitMode":
      this.orbitMode = !!msg.value;
      break;

     case "autoAdvance":
      this.autoAdvance = !!msg.value;
      break;

     case "scanRangeMode":
      this.scanRangeMode = msg.value === "loop" ? "loop" : "pingpong";
      break;

     case "multiBuffer":
      this.multiBuffer = !!msg.value;
      break;

     case "activeRecordBuffer":
      this.activeRecordBuffer = msg.value === "B" ? 1 : 0;
      break;

     case "stereoMode":
      this.stereoMode = msg.value === "mono" ? "mono" : "stereo";
      break;

     case "monoInput":
      this.monoInput = !!msg.value;
      break;

     case "limiter":
      this.limiterOn = !!msg.value;
      break;

     case "bufferLengthSeconds":
      {
        const len = Math.max(1, Math.min(MAX_BUFFER_SECONDS, msg.value));
        this.activeLen = Math.floor(len * this.sr);
        this.writeHead = this.writeHead % this.activeLen;
        break;
      }

     case "resetBuffers":
      {
        this.bufA[0].fill(0);
        this.bufA[1].fill(0);
        this.bufB[0].fill(0);
        this.bufB[1].fill(0);
        this.writeHead = 0;
        for (const g of this.grains) g.active = false;
        break;
      }

     case "manualScanPosition":
      {
        this.autoPosNorm = Math.max(0, Math.min(1, msg.value));
        break;
      }

     case "loadSample":
      {
        const buf = this.activeRecordBuffer === 1 ? this.bufB : this.bufA;
        const {dataL: dataL, dataR: dataR, numSamples: numSamples} = msg;
        const len = Math.max(0, Math.min(numSamples, this.activeLen, dataL.length));
        buf[0].fill(0);
        buf[1].fill(0);
        for (let i = 0; i < len; i++) {
          buf[0][i] = dataL[i];
          buf[1][i] = dataR ? dataR[i] : dataL[i];
        }
        this.writeHead = 0;
        for (const g of this.grains) g.active = false;
        break;
      }

     default:
      break;
    }
  }
  _advanceScanPos(deltaNorm, start, end) {
    let lo = Math.max(0, Math.min(1, start));
    let hi = Math.max(0, Math.min(1, end));
    if (hi - lo < .002) hi = Math.min(1, lo + .002);
    if (this.scanRangeMode === "loop") {
      this.autoPosNorm += deltaNorm;
      const range = hi - lo;
      let rel = (this.autoPosNorm - lo) / range;
      rel = (rel % 1 + 1) % 1;
      this.autoPosNorm = lo + rel * range;
    } else {
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
    let slot = this.grains.find(g => !g.active);
    if (!slot) {
      slot = this.grains.reduce((oldest, g) => g.age / g.length > oldest.age / oldest.length ? g : oldest, this.grains[0]);
    }
    const rnd = this._rng;
    const activeLen = this.activeLen;
    let posNorm = this._posNormBase;
    if (this.orbitMode) {
      posNorm += Math.sin(this.orbitPhase) * params.orbitDepth * .5;
    }
    let startSample;
    if (this.sprayMode) {
      startSample = rnd() * activeLen;
    } else {
      const jitterSamples = (rnd() - .5) * params.jitter * activeLen * .5;
      startSample = posNorm * activeLen + jitterSamples;
      startSample = (startSample % activeLen + activeLen) % activeLen;
    }
    let bufIndex = 0;
    if (this.multiBuffer) {
      bufIndex = rnd() < params.crossfadeAB ? 1 : 0;
    }
    let semis = params.pitch;
    if (this.pitchLock) semis = Math.round(semis);
    let ratio = semitoneToRatio(semis);
    const dir = this.reverse ? -1 : 1;
    const durMs = params.grainDuration;
    let lengthSamples = Math.max(8, Math.round(durMs / 1e3 * this.sr));
    let durationCompScale = 1;
    if (this.formantPreserve) {
      durationCompScale = 1 / Math.sqrt(Math.max(.25, Math.min(4, ratio)));
      lengthSamples = Math.max(8, Math.round(lengthSamples * durationCompScale));
    }
    const spread = params.spread;
    const pan = (rnd() * 2 - 1) * spread;
    const panAngle = (pan * .5 + .5) * (Math.PI / 2);
    const overlapEstimate = Math.max(.05, params.density * (lengthSamples / this.sr));
    const gainComp = Math.max(.5, Math.min(3.2, 1 / Math.sqrt(overlapEstimate)));
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
    const a = buf[ch][(i0 % len + len) % len];
    const b = buf[ch][((i0 + 1) % len + len) % len];
    return a + (b - a) * frac;
  }
  process(inputs, outputs, parameters) {
    const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const input = inputs[0];
    const output = outputs[0];
    const blockSize = output[0] ? output[0].length : 128;
    const p = {};
    for (const key of Object.keys(parameters)) p[key] = parameters[key][0];
    const activeLen = this.activeLen;
    const hasInput = input && input.length > 0 && input[0].length > 0;
    const inL = hasInput ? input[0] : null;
    const inR = hasInput ? input[1] || input[0] : null;
    let inLEff = inL;
    let inREff = inR;
    if (this.monoInput && hasInput) {
      const scratch = blockSize <= this._monoScratch.length ? this._monoScratch : new Float32Array(blockSize);
      for (let i = 0; i < blockSize; i++) scratch[i] = (inL[i] + (inR ? inR[i] : inL[i])) * .5;
      inLEff = scratch;
      inREff = scratch;
    }
    const recBuf = this.activeRecordBuffer === 1 ? this.bufB : this.bufA;
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
    const LIVE_LOCK_EPSILON = .03;
    const liveLocked = this.autoAdvance && !this.frozen && Math.abs(p.scanSpeed - 1) < LIVE_LOCK_EPSILON;
    if (this.frozen) {
      if (this.autoAdvance) {
        const deltaNorm = p.scanSpeed * blockSize / activeLen;
        this._advanceScanPos(deltaNorm, p.scanStart, p.scanEnd);
      }
      this._posNormBase = this.autoPosNorm;
    } else if (liveLocked) {
      const lagNorm = Math.max(0, Math.min(1, p.position));
      this._posNormBase = ((this.writeHead / activeLen - lagNorm) % 1 + 1) % 1;
      this.autoPosNorm = this._posNormBase;
    } else if (this.autoAdvance) {
      const deltaNorm = p.scanSpeed * blockSize / activeLen;
      this._advanceScanPos(deltaNorm, p.scanStart, p.scanEnd);
      this._posNormBase = this.autoPosNorm;
    } else {
      this._posNormBase = params.position;
    }
    if (this.orbitMode) {
      this.orbitPhase += 2 * Math.PI * p.orbitRate * (blockSize / this.sr);
      if (this.orbitPhase > Math.PI * 2) this.orbitPhase -= Math.PI * 2;
    }
    const density = Math.max(.5, p.density);
    let interval = this.sr / density;
    this.schedulerPhase += blockSize;
    let safety = 0;
    while (this.schedulerPhase >= interval && safety < 32) {
      this._spawnGrain(p);
      const jitterScale = 1 + (this._rng() - .5) * p.jitter * .6;
      interval = Math.max(4, this.sr / density * jitterScale);
      this.schedulerPhase -= interval;
      safety++;
    }
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];
    outL.fill(0);
    if (outR !== outL) outR.fill(0);
    for (const g of this.grains) {
      if (!g.active) continue;
      const buf = g.bufIndex === 1 ? this.bufB : this.bufA;
      const envFn = ENVELOPES[g.envType] || envHann;
      for (let i = 0; i < blockSize; i++) {
        if (g.age >= g.length) {
          g.active = false;
          break;
        }
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
    const WET_MAKEUP_GAIN = 6;
    for (let i = 0; i < blockSize; i++) {
      outL[i] *= WET_MAKEUP_GAIN;
      if (outR !== outL) outR[i] *= WET_MAKEUP_GAIN;
    }
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
    if (this.stereoMode === "mono") {
      for (let i = 0; i < blockSize; i++) {
        const m = (outL[i] + outR[i]) * .5;
        outL[i] = m;
        if (outR !== outL) outR[i] = m;
      }
    }
    this._blockCounter++;
    if (this._blockCounter >= 8) {
      this._blockCounter = 0;
      const readNorm = this._posNormBase;
      const grainSnapshot = [];
      for (const g of this.grains) {
        if (!g.active) continue;
        grainSnapshot.push({
          x: g.readPos / activeLen,
          pitch: Math.log2(Math.max(.03, Math.abs(g.step))) * 12,
          env: g.envType,
          dur: g.length / this.sr,
          age: g.age / g.length,
          pan: g.panR - g.panL
        });
      }
      this.port.postMessage({
        type: "meter",
        writeHeadNorm: this.writeHead / activeLen,
        readHeadNorm: (readNorm % 1 + 1) % 1,
        activeGrainCount: this.grains.filter(g => g.active).length,
        cpuLoad: this._cpuLoadEstimate || 0
      });
      this.port.postMessage({
        type: "grains",
        list: grainSnapshot
      });
    }
    const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const blockBudgetMs = blockSize / this.sr * 1e3;
    const usedRatio = Math.min(1, (t1 - t0) / Math.max(.001, blockBudgetMs));
    this._cpuLoadEstimate = (this._cpuLoadEstimate || 0) * .9 + usedRatio * .1;
    return true;
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

registerProcessor("granular-processor", GranulatorProcessor);