const LEVEL = {
  min: 0,
  low: .25,
  mid: .5,
  high: .75,
  max: 1
};

function lvl(v, fallback = .5) {
  if (typeof v === "number") return v;
  return LEVEL[v] != null ? LEVEL[v] : fallback;
}

function envTime(level, min, max) {
  const t = lvl(level, .5);
  return min * Math.pow(max / min, t);
}

function shapeFor(level) {
  const t = lvl(level, .5);
  if (t < .34) return "triangle";
  if (t < .67) return "sawtooth";
  return "square";
}

function octaveMultiplier(level) {
  const t = lvl(level, .5);
  if (t < .2) return .25;
  if (t < .45) return .5;
  if (t < .7) return 1;
  return 2;
}

export class AuditionVoice {
  constructor() {
    this.ctx = null;
    this.nodes = [];
    this.playing = false;
  }
  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext);
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
  play(preset, midiNote = 48, holdSec = 1.1) {
    const ctx = this.ensureCtx();
    this.stop();
    const now = ctx.currentTime + .02;
    const baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const ampEnv = preset.ampEnv || {};
    const aA = envTime(ampEnv.attack, .002, 2.5);
    const aD = envTime(ampEnv.decay, .02, 2);
    const aS = lvl(ampEnv.sustain, .7);
    const aR = envTime(ampEnv.release, .03, 3);
    const fEnv = preset.filterEnv || {};
    const fA = envTime(fEnv.attack, .002, 2);
    const fD = envTime(fEnv.decay, .02, 2);
    const fS = lvl(fEnv.sustain, .5);
    const fR = envTime(fEnv.release, .03, 2.5);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const cutoffLevel = lvl((preset.filter || {}).cutoff, .5);
    const resonance = lvl((preset.filter || {}).resonance, .3);
    const baseCutoff = 80 * Math.pow(150, cutoffLevel);
    const peakCutoff = Math.min(14e3, baseCutoff * 6);
    filter.Q.value = .7 + resonance * 14;
    filter.frequency.setValueAtTime(baseCutoff, now);
    filter.frequency.linearRampToValueAtTime(peakCutoff, now + fA);
    filter.frequency.linearRampToValueAtTime(baseCutoff + (peakCutoff - baseCutoff) * fS, now + fA + fD);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(1, now + aA);
    amp.gain.linearRampToValueAtTime(Math.max(1e-4, aS), now + aA + aD);
    const releaseAt = now + Math.max(holdSec, aA + aD * .5);
    amp.gain.setValueAtTime(Math.max(1e-4, aS), releaseAt);
    amp.gain.linearRampToValueAtTime(1e-4, releaseAt + aR);
    filter.frequency.setValueAtTime(filter.frequency.value, releaseAt);
    filter.frequency.linearRampToValueAtTime(baseCutoff, releaseAt + fR);
    const master = ctx.createGain();
    const drive = lvl((preset.filter || {}).drive, .2);
    master.gain.value = .22 * (.8 + drive * .4);
    filter.connect(amp);
    amp.connect(master);
    master.connect(ctx.destination);
    const stopAt = releaseAt + Math.max(aR, fR) + .1;
    const mix = preset.mix || {};
    const addOsc = (freq, type, level, detuneCents = 0) => {
      const gainLevel = lvl(level, 0);
      if (gainLevel <= .001) return;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      if (detuneCents) osc.detune.value = detuneCents;
      const g = ctx.createGain();
      g.gain.value = gainLevel * .5;
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      osc.stop(stopAt);
      this.nodes.push(osc, g);
    };
    const osc1 = preset.osc1 || {};
    const osc2 = preset.osc2 || {};
    const f1 = baseFreq * octaveMultiplier(osc1.octave);
    const f2 = baseFreq * octaveMultiplier(osc2.octave) * (osc2.low ? .5 : 1);
    addOsc(f1, shapeFor(osc1.shape), mix.osc1);
    addOsc(f1 / 2, "square", mix.osc1Sub);
    addOsc(f2, shapeFor(osc2.shape), mix.osc2, 7);
    const noiseLevel = lvl(mix.noise, 0);
    if (noiseLevel > .001) {
      const len = Math.max(.5, stopAt - now);
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = noiseLevel * .25;
      src.connect(g);
      g.connect(filter);
      src.start(now);
      src.stop(stopAt);
      this.nodes.push(src, g);
    }
    this.nodes.push(filter, amp, master);
    this.playing = true;
    this._timer = setTimeout(() => {
      this.playing = false;
      if (this.onEnded) this.onEnded();
    }, (stopAt - ctx.currentTime) * 1e3);
    return stopAt - now;
  }
  stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    const ctx = this.ctx;
    if (ctx) {
      this.nodes.forEach(n => {
        try {
          if (n.stop) n.stop(ctx.currentTime + .03);
        } catch {}
        try {
          n.disconnect();
        } catch {}
      });
    }
    this.nodes = [];
    this.playing = false;
  }
}

export const _internals = {
  lvl: lvl,
  envTime: envTime,
  shapeFor: shapeFor,
  octaveMultiplier: octaveMultiplier
};