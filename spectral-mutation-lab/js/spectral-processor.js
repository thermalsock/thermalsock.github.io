const FFT_SIZE = 2048;

const HOP_SIZE = 512;

const NUM_BINS = FFT_SIZE / 2;

const TWO_PI = Math.PI * 2;

function fftInPlace(re, im, invert) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (;j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
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
        re[i + j] = ur + tr;
        im[i + j] = ui + ti;
        re[i + j + half] = ur - tr;
        im[i + j + half] = ui - ti;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr;
        curWi = nextWi;
      }
    }
  }
  if (invert) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function buildHannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = .5 - .5 * Math.cos(TWO_PI * i / n);
  return w;
}

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
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class ChannelEngine {
  constructor(sr, seed) {
    this.sr = sr;
    this.inRing = new Float64Array(FFT_SIZE);
    this.outRing = new Float64Array(FFT_SIZE);
    this.inWritePos = 0;
    this.outPos = 0;
    this._readPos = 0;
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
  captureFreezeA() {
    this.frozenAMag.set(this.liveMag);
    this.hasFrozenA = true;
  }
  captureFreezeB() {
    this.frozenBMag.set(this.liveMag);
    this.hasFrozenB = true;
  }
  clearFreeze() {
    this.frozenAMag.fill(0);
    this.frozenBMag.fill(0);
    this.hasFrozenA = false;
    this.hasFrozenB = false;
  }
}

class SpectralProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [ {
      name: "inputGain",
      defaultValue: 1,
      minValue: 0,
      maxValue: 4,
      automationRate: "k-rate"
    }, {
      name: "outputGain",
      defaultValue: 1.6,
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
      name: "freezeMix",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "morphAB",
      defaultValue: .5,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "shiftSemi",
      defaultValue: 0,
      minValue: -24,
      maxValue: 24,
      automationRate: "k-rate"
    }, {
      name: "reverseAmt",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "smearAmt",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    }, {
      name: "scatterAmt",
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: "k-rate"
    } ];
  }
  constructor() {
    super();
    this.sr = sampleRate;
    this.window = buildHannWindow(FFT_SIZE);
    this.colaNorm = computeColaNorm(this.window, HOP_SIZE, FFT_SIZE);
    this.chL = new ChannelEngine(this.sr, 4660);
    this.chR = new ChannelEngine(this.sr, 39612);
    this.monoInput = true;
    this.limiterOn = true;
    this.freezeAActive = false;
    this.freezeBActive = false;
    this._monoScratch = new Float64Array(128);
    this._blockCounter = 0;
    this._cpuLoadEstimate = 0;
    this.port.onmessage = e => this._handleMessage(e.data);
  }
  _handleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
     case "freezeA":
      {
        this.freezeAActive = !!msg.value;
        if (this.freezeAActive) {
          this.chL.captureFreezeA();
          this.chR.captureFreezeA();
        }
        break;
      }

     case "freezeB":
      {
        this.freezeBActive = !!msg.value;
        if (this.freezeBActive) {
          this.chL.captureFreezeB();
          this.chR.captureFreezeB();
        }
        break;
      }

     case "clearFreeze":
      {
        this.chL.clearFreeze();
        this.chR.clearFreeze();
        this.freezeAActive = false;
        this.freezeBActive = false;
        break;
      }

     case "monoInput":
      this.monoInput = !!msg.value;
      break;

     case "limiter":
      this.limiterOn = !!msg.value;
      break;

     default:
      break;
    }
  }
  _mutate(ch, p) {
    const n = NUM_BINS;
    const haveA = ch.hasFrozenA, haveB = ch.hasFrozenB;
    if (p.freezeMix <= 1e-4 || !haveA && !haveB) {
      ch.sourceMag.set(ch.liveMag);
    } else {
      for (let k = 0; k <= n; k++) {
        let frozen;
        if (haveA && haveB) frozen = ch.frozenAMag[k] + (ch.frozenBMag[k] - ch.frozenAMag[k]) * p.morphAB; else if (haveA) frozen = ch.frozenAMag[k]; else frozen = ch.frozenBMag[k];
        ch.sourceMag[k] = ch.liveMag[k] + (frozen - ch.liveMag[k]) * p.freezeMix;
      }
    }
    const ratio = Math.pow(2, p.shiftSemi / 12);
    if (Math.abs(p.shiftSemi) < .001) {
      ch.shiftedMag.set(ch.sourceMag);
    } else {
      for (let k = 0; k <= n; k++) {
        const srcPos = k / ratio;
        if (srcPos < 0 || srcPos > n) {
          ch.shiftedMag[k] = 0;
          continue;
        }
        const i0 = Math.floor(srcPos);
        const frac = srcPos - i0;
        const i1 = Math.min(n, i0 + 1);
        ch.shiftedMag[k] = ch.sourceMag[i0] + (ch.sourceMag[i1] - ch.sourceMag[i0]) * frac;
      }
    }
    if (p.reverseAmt <= 1e-4) {
      ch.reversedMag.set(ch.shiftedMag);
    } else {
      for (let k = 0; k <= n; k++) {
        const mirrored = ch.shiftedMag[n - k];
        ch.reversedMag[k] = ch.shiftedMag[k] + (mirrored - ch.shiftedMag[k]) * p.reverseAmt;
      }
    }
    const leak = p.smearAmt * .93;
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
          if (idx >= 0 && idx <= n) {
            sum += ch.smearState[idx];
            count++;
          }
        }
        ch.smearedMag[k] = sum / count;
      }
    }
    if (p.scatterAmt <= 1e-4) {
      ch.finalMag.set(ch.smearedMag);
    } else {
      const radius = 1 + Math.round(p.scatterAmt * 40);
      const rerollProb = p.scatterAmt * .12;
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
  _resynthesize(ch) {
    const n = NUM_BINS;
    const re = ch.frameRe, im = ch.frameIm;
    ch.phaseAccum[0] = 0;
    re[0] = ch.finalMag[0];
    im[0] = 0;
    for (let k = 1; k < n; k++) {
      ch.phaseAccum[k] += TWO_PI * HOP_SIZE * k / FFT_SIZE;
      ch.phaseAccum[k] = (ch.phaseAccum[k] % TWO_PI + TWO_PI) % TWO_PI;
      const mag = ch.finalMag[k];
      const ph = ch.phaseAccum[k];
      re[k] = mag * Math.cos(ph);
      im[k] = mag * Math.sin(ph);
      re[FFT_SIZE - k] = re[k];
      im[FFT_SIZE - k] = -im[k];
    }
    re[n] = ch.finalMag[n];
    im[n] = 0;
    fftInPlace(re, im, true);
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
    const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const input = inputs[0];
    const output = outputs[0];
    const blockSize = output[0] ? output[0].length : 128;
    const p = {};
    for (const key of Object.keys(parameters)) p[key] = parameters[key][0];
    const hasInput = input && input.length > 0 && input[0].length > 0;
    const inL = hasInput ? input[0] : null;
    const inR = hasInput ? input[1] || input[0] : null;
    let inLEff = inL, inREff = inR;
    if (this.monoInput && hasInput) {
      const scratch = blockSize <= this._monoScratch.length ? this._monoScratch : new Float64Array(blockSize);
      for (let i = 0; i < blockSize; i++) scratch[i] = (inL[i] + (inR ? inR[i] : inL[i])) * .5;
      inLEff = scratch;
      inREff = scratch;
    }
    for (const [ch, src] of [ [ this.chL, inLEff ], [ this.chR, inREff ] ]) {
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
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];
    const WET_MAKEUP_GAIN = 2.2;
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
    this._blockCounter++;
    if (this._blockCounter >= 6) {
      this._blockCounter = 0;
      const n = NUM_BINS;
      const specLen = 256;
      const spectrum = new Float32Array(specLen);
      const step = (n + 1) / specLen;
      for (let i = 0; i < specLen; i++) {
        const bin = Math.min(n, Math.floor(i * step));
        spectrum[i] = (this.chL.finalMag[bin] + this.chR.finalMag[bin]) * .5;
      }
      this.port.postMessage({
        type: "meter",
        spectrum: spectrum,
        hasFrozenA: this.chL.hasFrozenA,
        hasFrozenB: this.chL.hasFrozenB,
        cpuLoad: this._cpuLoadEstimate
      }, [ spectrum.buffer ]);
    }
    const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const blockBudgetMs = blockSize / this.sr * 1e3;
    const usedRatio = Math.min(1, (t1 - t0) / Math.max(.001, blockBudgetMs));
    this._cpuLoadEstimate = this._cpuLoadEstimate * .9 + usedRatio * .1;
    return true;
  }
}

registerProcessor("spectral-processor", SpectralProcessor);