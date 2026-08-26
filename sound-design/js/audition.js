// audition.js
//
// The Sound Design page had no AudioContext at all: 39 documented patches
// you could read but never hear, on a panel of knobs drawn with tick rings
// and pointers that didn't turn. Reading a patch then dialling twenty knobs
// on real hardware just to find out whether it's the sound you wanted is a
// long way round.
//
// This builds a two-oscillator subtractive voice matching the Take 5 signal
// path the page documents — Osc1 (+ sub) and Osc2 into a mixer, through a
// resonant low-pass with its own envelope, then an amp envelope. It is
// deliberately an approximation: the source doc specifies everything
// qualitatively ("fast attack", "high resonance"), so the point is to convey
// the character of a patch, not to claim it is a hardware-accurate model.

// Qualitative levels -> normalised 0..1. Same five levels the presets and
// the knob angles already use, so what you hear tracks what's drawn.
const LEVEL = { min: 0, low: 0.25, mid: 0.5, high: 0.75, max: 1 };

function lvl(v, fallback = 0.5) {
  if (typeof v === 'number') return v;
  return LEVEL[v] != null ? LEVEL[v] : fallback;
}

// Envelope times in seconds. Mapped exponentially rather than linearly:
// the difference between 2ms and 20ms of attack matters far more musically
// than the difference between 1.0s and 1.2s.
function envTime(level, min, max) {
  const t = lvl(level, 0.5);
  return min * Math.pow(max / min, t);
}

// Osc shape knob position -> waveform. The panel's Shape knob sweeps
// triangle -> saw -> square, so the level maps across that order.
function shapeFor(level) {
  const t = lvl(level, 0.5);
  if (t < 0.34) return 'triangle';
  if (t < 0.67) return 'sawtooth';
  return 'square';
}

// Octave knob -> frequency multiplier (-2 to +1 octaves around the played note).
function octaveMultiplier(level) {
  const t = lvl(level, 0.5);
  if (t < 0.2) return 0.25;
  if (t < 0.45) return 0.5;
  if (t < 0.7) return 1;
  return 2;
}

export class AuditionVoice {
  constructor() {
    this.ctx = null;
    this.nodes = [];
    this.playing = false;
  }

  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /**
   * Play one note of the given preset.
   * @param {object} preset  an entry from PRESETS
   * @param {number} midiNote  note to play (default C3)
   * @param {number} holdSec   how long the key is "held" before release
   */
  play(preset, midiNote = 48, holdSec = 1.1) {
    const ctx = this.ensureCtx();
    this.stop();

    const now = ctx.currentTime + 0.02;
    const baseFreq = 440 * Math.pow(2, (midiNote - 69) / 12);

    // --- Amp envelope ---
    const ampEnv = preset.ampEnv || {};
    const aA = envTime(ampEnv.attack, 0.002, 2.5);
    const aD = envTime(ampEnv.decay, 0.02, 2.0);
    const aS = lvl(ampEnv.sustain, 0.7);
    const aR = envTime(ampEnv.release, 0.03, 3.0);

    // --- Filter envelope ---
    const fEnv = preset.filterEnv || {};
    const fA = envTime(fEnv.attack, 0.002, 2.0);
    const fD = envTime(fEnv.decay, 0.02, 2.0);
    const fS = lvl(fEnv.sustain, 0.5);
    const fR = envTime(fEnv.release, 0.03, 2.5);

    // --- Filter ---
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoffLevel = lvl((preset.filter || {}).cutoff, 0.5);
    const resonance = lvl((preset.filter || {}).resonance, 0.3);
    // 80Hz..12kHz, exponential — linear cutoff would put almost the whole
    // useful range in the top quarter of the knob.
    const baseCutoff = 80 * Math.pow(150, cutoffLevel);
    const peakCutoff = Math.min(14000, baseCutoff * 6);
    filter.Q.value = 0.7 + resonance * 14;

    filter.frequency.setValueAtTime(baseCutoff, now);
    filter.frequency.linearRampToValueAtTime(peakCutoff, now + fA);
    filter.frequency.linearRampToValueAtTime(
      baseCutoff + (peakCutoff - baseCutoff) * fS, now + fA + fD);

    // --- Amp ---
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(1, now + aA);
    amp.gain.linearRampToValueAtTime(Math.max(0.0001, aS), now + aA + aD);

    const releaseAt = now + Math.max(holdSec, aA + aD * 0.5);
    amp.gain.setValueAtTime(Math.max(0.0001, aS), releaseAt);
    amp.gain.linearRampToValueAtTime(0.0001, releaseAt + aR);
    filter.frequency.setValueAtTime(filter.frequency.value, releaseAt);
    filter.frequency.linearRampToValueAtTime(baseCutoff, releaseAt + fR);

    // Master trim. Several sources summing at full level clips instantly,
    // and drive is modelled as level rather than as real saturation.
    const master = ctx.createGain();
    const drive = lvl((preset.filter || {}).drive, 0.2);
    master.gain.value = 0.22 * (0.8 + drive * 0.4);

    filter.connect(amp);
    amp.connect(master);
    master.connect(ctx.destination);

    const stopAt = releaseAt + Math.max(aR, fR) + 0.1;
    const mix = preset.mix || {};

    const addOsc = (freq, type, level, detuneCents = 0) => {
      const gainLevel = lvl(level, 0);
      if (gainLevel <= 0.001) return;   // silent source: don't build the node
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      if (detuneCents) osc.detune.value = detuneCents;
      const g = ctx.createGain();
      g.gain.value = gainLevel * 0.5;
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      osc.stop(stopAt);
      this.nodes.push(osc, g);
    };

    const osc1 = preset.osc1 || {};
    const osc2 = preset.osc2 || {};
    const f1 = baseFreq * octaveMultiplier(osc1.octave);
    // Osc 2 detuned slightly by default — the beating is most of what makes
    // a two-oscillator patch sound like one.
    const f2 = baseFreq * octaveMultiplier(osc2.octave) * (osc2.low ? 0.5 : 1);

    addOsc(f1, shapeFor(osc1.shape), mix.osc1);
    addOsc(f1 / 2, 'square', mix.osc1Sub);          // sub is always a square an octave down
    addOsc(f2, shapeFor(osc2.shape), mix.osc2, 7);  // ~7 cents of detune

    // Noise, if the patch uses it.
    const noiseLevel = lvl(mix.noise, 0);
    if (noiseLevel > 0.001) {
      const len = Math.max(0.5, stopAt - now);
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = noiseLevel * 0.25;
      src.connect(g);
      g.connect(filter);
      src.start(now);
      src.stop(stopAt);
      this.nodes.push(src, g);
    }

    this.nodes.push(filter, amp, master);
    this.playing = true;

    // Clear the flag once the tail has finished, so the UI can flip back.
    this._timer = setTimeout(() => { this.playing = false; if (this.onEnded) this.onEnded(); },
                             (stopAt - ctx.currentTime) * 1000);
    return stopAt - now;
  }

  stop() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    const ctx = this.ctx;
    if (ctx) {
      this.nodes.forEach(n => {
        try { if (n.stop) n.stop(ctx.currentTime + 0.03); } catch { /* already stopped */ }
        try { n.disconnect(); } catch { /* already disconnected */ }
      });
    }
    this.nodes = [];
    this.playing = false;
  }
}

// Exported for tests — these are the mappings the whole voice depends on.
export const _internals = { lvl, envTime, shapeFor, octaveMultiplier };
