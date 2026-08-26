// analysis.js
//
// The analysis layer for a live visual.
//
// The old pipeline gave three numbers — low/mid/high energy, a centroid and
// a zero-crossing rate — and drove discrete "marks" from onsets. That is why
// techno, a bass drone, a soft pad and white noise all looked much the same:
// none of those features actually separates them.
//
// What separates them:
//   * SPECTRAL FLATNESS  tonal vs noisy. A pad and pink noise can have
//                        near-identical band energies; flatness tells them
//                        apart completely. This is the single most important
//                        feature that was missing.
//   * SUB vs BASS        a 50Hz kick and a 120Hz bassline feel different and
//                        must look different. One low band conflated them.
//   * PER-BAND PUNCH     fast envelope minus slow envelope, per band. This is
//                        what "a big bass hit" actually is — not loudness,
//                        but loudness *relative to what came just before*.
//   * SPECTRAL FLUX      how fast the spectrum is changing. Separates a
//                        static drone from an evolving sequence.
//   * PULSE              onset regularity. Techno has a strong periodic
//                        pulse; ambient does not. Drives whether the visual
//                        moves in time or drifts.
//
// Everything here is a pure-ish function of the analyser buffers, so the
// mapping can be tested in Node against synthetic spectra.

/* ---------------------------------------------------------------------
   Envelope follower with separate attack and release times. Asymmetric on
   purpose: visuals should snap up on a hit and fall away slowly, which is
   what produces "ebb and flow" rather than a value that just tracks the
   meter.
   --------------------------------------------------------------------- */
export class AsymEnvelope {
  constructor(attackMs, releaseMs, initial = 0) {
    this.attackMs = attackMs;
    this.releaseMs = releaseMs;
    this.value = initial;
  }
  update(target, dtMs) {
    const tau = target > this.value ? this.attackMs : this.releaseMs;
    const k = 1 - Math.exp(-dtMs / Math.max(1, tau));
    this.value += (target - this.value) * k;
    return this.value;
  }
}

/** dB -> linear amplitude. */
export function dbToAmp(db) {
  return Math.pow(10, db / 20);
}

export const BANDS = {
  sub:    [20, 60],      // the floor you feel rather than hear
  bass:   [60, 160],     // kick body, bass notes
  lowMid: [160, 500],    // warmth, low pads
  mid:    [500, 2000],   // melody, leads
  high:   [2000, 7000],  // hats, presence
  air:    [7000, 16000], // shimmer, noise tails
};

/**
 * Per-band energy, 0..1.
 *
 * Not a plain mean over bins. A solo sine or a clean harmonic lead puts all
 * its energy in a handful of bins with near-silence between them, so a mean
 * reports it as a *quiet* band — a bright lead ended up reading as having
 * less high-frequency content than a bass drone's noise floor. Blending the
 * mean with the mean of the loudest quarter of the band fixes that: sparse
 * tonal content registers properly, while broadband content (where mean and
 * peak agree) is unaffected.
 */
export function bandLevels(freqDb, sampleRate, minDb, maxDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  const out = {};
  for (const name of Object.keys(BANDS)) {
    const [lo, hi] = BANDS[name];
    const loBin = Math.max(1, Math.floor(lo / binHz));
    const hiBin = Math.min(freqDb.length - 1, Math.ceil(hi / binHz));
    const vals = [];
    for (let i = loBin; i <= hiBin; i++) {
      const t = (freqDb[i] - minDb) / (maxDb - minDb);
      vals.push(Math.max(0, Math.min(1, t)));
    }
    if (vals.length === 0) { out[name] = 0; continue; }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const peak = Math.max(...vals);
    // 50/50 mean and peak. Mean alone under-reports sparse harmonic content
    // (a clean lead is a few loud bins in a wide quiet band); peak alone is
    // twitchy. The analyser's own smoothingTimeConstant already spreads a
    // real partial across neighbouring bins, so the peak is stable enough.
    out[name] = mean * 0.5 + peak * 0.5;
  }
  return out;
}

/**
 * Spectral flatness (Wiener entropy): geometric mean / arithmetic mean of
 * the linear magnitude spectrum.
 *
 *   ~0.0  a pure tone or a tightly harmonic pad
 *   ~0.3  a rich, distorted or layered instrument
 *   ~1.0  white noise
 *
 * Computed over 100Hz-10kHz: below 100Hz there are too few bins for the
 * geometric mean to mean anything, and above 10kHz most sources are just
 * dither and hiss, which would drag every reading toward "noisy".
 */
export function spectralFlatness(freqDb, sampleRate, minDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  const loBin = Math.max(1, Math.floor(100 / binHz));
  const hiBin = Math.min(freqDb.length - 1, Math.floor(10000 / binHz));
  if (hiBin - loBin < 8) return 0;

  let logSum = 0, linSum = 0, n = 0;
  const FLOOR = 1e-7;
  for (let i = loBin; i <= hiBin; i++) {
    // Clamp at the analyser floor so empty bins don't dominate the log sum.
    const amp = Math.max(FLOOR, dbToAmp(Math.max(freqDb[i], minDb)));
    logSum += Math.log(amp);
    linSum += amp;
    n++;
  }
  if (n === 0 || linSum <= 0) return 0;
  const geo = Math.exp(logSum / n);
  const arith = linSum / n;
  return Math.max(0, Math.min(1, geo / arith));
}

/** Spectral centroid in Hz, or null when there's nothing to measure. */
/**
 * Spectral centroid in Hz, or null when there's nothing to measure.
 *
 * Gated relative to the loudest bin. Without a gate, an inaudible noise
 * floor spread across a thousand bins outweighs the handful of bins that
 * carry the actual sound: a deep bass drone with a -88dB hiss floor
 * measured as *brighter* than a bright lead, purely because the hiss
 * occupied more of the spectrum.
 */
export function centroidHz(freqDb, sampleRate, minDb, maxDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  const norm = (d) => Math.max(0, Math.min(1, (d - minDb) / (maxDb - minDb)));

  let loudest = 0;
  for (let i = 1; i < freqDb.length; i++) loudest = Math.max(loudest, norm(freqDb[i]));
  if (loudest < 0.05) return null;
  // Anything more than ~26dB below the peak is not contributing audibly.
  const gate = Math.max(0.05, loudest * 0.28);

  let ws = 0, tw = 0;
  for (let i = 1; i < freqDb.length; i++) {
    const mag = norm(freqDb[i]);
    if (mag < gate) continue;
    ws += i * binHz * mag;
    tw += mag;
  }
  return tw < 0.02 ? null : ws / tw;
}

/** Positive spectral flux: how much the spectrum grew since last frame. */
export function spectralFlux(freqDb, prevDb, minDb, maxDb) {
  if (!prevDb) return 0;
  let sum = 0, n = 0;
  for (let i = 1; i < freqDb.length; i++) {
    const a = Math.max(0, Math.min(1, (freqDb[i] - minDb) / (maxDb - minDb)));
    const b = Math.max(0, Math.min(1, (prevDb[i] - minDb) / (maxDb - minDb)));
    const d = a - b;
    if (d > 0) sum += d;
    n++;
  }
  return n ? Math.min(1, (sum / n) * 12) : 0;
}

/* ---------------------------------------------------------------------
   Pulse tracker: is there a steady beat, and where are we in it?

   Techno and a Tangerine Dream sequencer line have a strong periodic pulse;
   Solar Fields pads and Floyd drift do not. The visual should move in time
   for the former and breathe freely for the latter, so this reports both a
   confidence and a phase.
   --------------------------------------------------------------------- */
export class PulseTracker {
  constructor() {
    this.intervals = [];
    this.lastHitMs = 0;
    this.periodMs = 0;
    this.confidence = 0;
    this.phase = 0;
  }

  hit(nowMs) {
    if (this.lastHitMs) {
      const dt = nowMs - this.lastHitMs;
      // 240ms..1500ms covers roughly 40-250 bpm.
      if (dt > 240 && dt < 1500) {
        this.intervals.push(dt);
        if (this.intervals.length > 12) this.intervals.shift();
      }
    }
    this.lastHitMs = nowMs;
    this._recompute();
  }

  _recompute() {
    if (this.intervals.length < 3) { this.confidence = 0; return; }
    const sorted = this.intervals.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // Confidence = how tightly the intervals cluster around the median.
    // A regular 4/4 kick gives a tight cluster; scattered ambient hits don't.
    let within = 0;
    for (const i of this.intervals) if (Math.abs(i - median) < median * 0.18) within++;
    this.confidence = within / this.intervals.length;
    this.periodMs = median;
  }

  update(nowMs) {
    if (this.periodMs > 0 && this.lastHitMs) {
      this.phase = ((nowMs - this.lastHitMs) % this.periodMs) / this.periodMs;
    }
    // Decay confidence when the beat stops rather than holding it forever.
    if (this.lastHitMs && nowMs - this.lastHitMs > 2500) {
      this.confidence *= 0.97;
      if (this.confidence < 0.05) this.intervals.length = 0;
    }
    return this;
  }

  get bpm() { return this.periodMs > 0 ? 60000 / this.periodMs : 0; }
}

/* ---------------------------------------------------------------------
   The analyser.
   --------------------------------------------------------------------- */
export class Analysis {
  constructor() {
    this.prevDb = null;

    // Per-band fast/slow pairs. The difference between them is "punch":
    // how much louder this band is than it has been. That is what makes a
    // bass hit read as a hit rather than as sustained loudness.
    this.env = {};
    for (const name of Object.keys(BANDS)) {
      this.env[name] = {
        fast: new AsymEnvelope(12, 140),
        slow: new AsymEnvelope(420, 1400),
      };
    }

    this.flatnessEnv = new AsymEnvelope(120, 600, 0.3);
    this.centroidEnv = new AsymEnvelope(90, 500, 800);
    this.fluxEnv = new AsymEnvelope(30, 260);
    this.loudEnv = new AsymEnvelope(25, 420);
    this.calmEnv = new AsymEnvelope(1800, 3500); // very slow: overall intensity

    this.pulse = new PulseTracker();
    this.lastKickMs = 0;
    this.impact = 0;      // decays every frame; spikes on a bass hit
  }

  /**
   * @returns a VisualState — everything the renderer needs, already
   *          smoothed and normalised to 0..1 unless noted.
   */
  update(freqDb, timeBuf, sampleRate, minDb, maxDb, dtMs, nowMs) {
    const levels = bandLevels(freqDb, sampleRate, minDb, maxDb);

    const punch = {};
    const smooth = {};
    for (const name of Object.keys(BANDS)) {
      const f = this.env[name].fast.update(levels[name], dtMs);
      const s = this.env[name].slow.update(levels[name], dtMs);
      smooth[name] = f;
      // Normalised excess over the running average.
      punch[name] = Math.max(0, Math.min(1, (f - s) * 3.2));
    }

    const flatnessRaw = spectralFlatness(freqDb, sampleRate, minDb);
    const flatness = this.flatnessEnv.update(flatnessRaw, dtMs);

    const cRaw = centroidHz(freqDb, sampleRate, minDb, maxDb);
    const centroid = this.centroidEnv.update(cRaw ?? 400, dtMs);

    const flux = this.fluxEnv.update(spectralFlux(freqDb, this.prevDb, minDb, maxDb), dtMs);
    this.prevDb = Float32Array.from(freqDb);

    // Overall loudness from the time buffer.
    let sum = 0;
    for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i];
    const rms = Math.sqrt(sum / timeBuf.length);
    const loud = this.loudEnv.update(Math.min(1, rms * 4), dtMs);
    const calm = this.calmEnv.update(Math.min(1, rms * 4), dtMs);

    // --- Bass hit detection ---
    // A kick is a sub/bass punch, gated so a sustained bass note doesn't
    // retrigger continuously.
    const lowPunch = Math.max(punch.sub, punch.bass);
    const kick = lowPunch > 0.30 && (nowMs - this.lastKickMs) > 110;
    if (kick) {
      this.lastKickMs = nowMs;
      this.pulse.hit(nowMs);
      this.impact = Math.min(1, this.impact + lowPunch * 1.4);
    }
    // Impact decays fast — it's an impulse, not a level.
    this.impact *= Math.exp(-dtMs / 260);

    this.pulse.update(nowMs);

    return {
      levels, smooth, punch,
      rms, loud, calm,
      flatness,                     // 0 tonal .. 1 noise
      tonal: 1 - flatness,
      centroid,                     // Hz
      brightness: Math.max(0, Math.min(1, Math.log2(Math.max(80, centroid) / 80) / 7)),
      flux,                         // 0 static .. 1 fast-changing
      kick,
      impact: this.impact,          // 0..1 impulse, decays over ~0.5s
      pulseConfidence: this.pulse.confidence,
      pulsePhase: this.pulse.phase,
      bpm: this.pulse.bpm,
      nowMs,
    };
  }
}

/* ---------------------------------------------------------------------
   VisualState -> scene parameters.

   Kept separate and pure so the whole mapping can be asserted in a test:
   given a spectrum that looks like techno, does the scene actually get
   driving/rhythmic parameters, and does white noise actually get grainy
   dispersed ones?
   --------------------------------------------------------------------- */
export function sceneParams(s) {
  const bassWeight = Math.max(s.smooth.sub, s.smooth.bass);

  return {
    // How far the horizon swells. Slow, so it breathes rather than jitters.
    swell: Math.min(1, bassWeight * 1.25),

    // Radial shock from a bass hit.
    impact: s.impact,

    // How much the flow field curls. Melodic movement bends the strokes.
    turbulence: Math.min(1, s.flux * 0.75 + s.smooth.mid * 0.5),

    // Coherence: tonal material paints long laminar strokes; noise
    // disperses into grain. This is the axis that made a pad and pink
    // noise look identical before.
    coherence: Math.max(0, Math.min(1, s.tonal * 1.15 - 0.1)),
    grain: Math.min(1, s.flatness * 1.3),

    // Palette temperature and lift.
    brightness: s.brightness,
    warmth: Math.max(0, Math.min(1, bassWeight * 1.4 - s.brightness * 0.5 + 0.25)),

    // Rhythmic lock. Techno drives the whole scene in time; ambient drifts.
    drive: Math.min(1, s.pulseConfidence * (0.35 + Math.min(1, bassWeight * 1.6))),
    phase: s.pulsePhase,

    // Sparks/shimmer from the top end.
    shimmer: Math.min(1, s.smooth.high * 0.8 + s.smooth.air * 1.1 + s.punch.high * 0.5),

    // Overall energy: how much is on screen at all.
    energy: Math.min(1, s.loud * 0.8 + bassWeight * 0.4),
    stillness: 1 - Math.min(1, s.calm * 1.6),
  };
}
