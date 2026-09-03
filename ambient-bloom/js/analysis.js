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

export function dbToAmp(db) {
  return Math.pow(10, db / 20);
}

export const BANDS = {
  sub: [ 20, 60 ],
  bass: [ 60, 160 ],
  lowMid: [ 160, 500 ],
  mid: [ 500, 2e3 ],
  high: [ 2e3, 7e3 ],
  air: [ 7e3, 16e3 ]
};

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
    if (vals.length === 0) {
      out[name] = 0;
      continue;
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const peak = Math.max(...vals);
    out[name] = mean * .5 + peak * .5;
  }
  return out;
}

export function spectralFlatness(freqDb, sampleRate, minDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  const loBin = Math.max(1, Math.floor(100 / binHz));
  const hiBin = Math.min(freqDb.length - 1, Math.floor(1e4 / binHz));
  if (hiBin - loBin < 8) return 0;
  let logSum = 0, linSum = 0, n = 0;
  const FLOOR = 1e-7;
  for (let i = loBin; i <= hiBin; i++) {
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

export function centroidHz(freqDb, sampleRate, minDb, maxDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  const norm = d => Math.max(0, Math.min(1, (d - minDb) / (maxDb - minDb)));
  let loudest = 0;
  for (let i = 1; i < freqDb.length; i++) loudest = Math.max(loudest, norm(freqDb[i]));
  if (loudest < .05) return null;
  const gate = Math.max(.05, loudest * .28);
  let ws = 0, tw = 0;
  for (let i = 1; i < freqDb.length; i++) {
    const mag = norm(freqDb[i]);
    if (mag < gate) continue;
    ws += i * binHz * mag;
    tw += mag;
  }
  return tw < .02 ? null : ws / tw;
}

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
  return n ? Math.min(1, sum / n * 12) : 0;
}

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
      if (dt > 240 && dt < 1500) {
        this.intervals.push(dt);
        if (this.intervals.length > 12) this.intervals.shift();
      }
    }
    this.lastHitMs = nowMs;
    this._recompute();
  }
  _recompute() {
    if (this.intervals.length < 3) {
      this.confidence = 0;
      return;
    }
    const sorted = this.intervals.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let within = 0;
    for (const i of this.intervals) if (Math.abs(i - median) < median * .18) within++;
    this.confidence = within / this.intervals.length;
    this.periodMs = median;
  }
  update(nowMs) {
    if (this.periodMs > 0 && this.lastHitMs) {
      this.phase = (nowMs - this.lastHitMs) % this.periodMs / this.periodMs;
    }
    if (this.lastHitMs && nowMs - this.lastHitMs > 2500) {
      this.confidence *= .97;
      if (this.confidence < .05) this.intervals.length = 0;
    }
    return this;
  }
  get bpm() {
    return this.periodMs > 0 ? 6e4 / this.periodMs : 0;
  }
}

export class Analysis {
  constructor() {
    this.prevDb = null;
    this.env = {};
    for (const name of Object.keys(BANDS)) {
      this.env[name] = {
        fast: new AsymEnvelope(12, 140),
        slow: new AsymEnvelope(420, 1400)
      };
    }
    this.flatnessEnv = new AsymEnvelope(120, 600, .3);
    this.centroidEnv = new AsymEnvelope(90, 500, 800);
    this.fluxEnv = new AsymEnvelope(30, 260);
    this.loudEnv = new AsymEnvelope(25, 420);
    this.calmEnv = new AsymEnvelope(1800, 3500);
    this.pulse = new PulseTracker;
    this.lastKickMs = 0;
    this.impact = 0;
  }
  update(freqDb, timeBuf, sampleRate, minDb, maxDb, dtMs, nowMs) {
    const levels = bandLevels(freqDb, sampleRate, minDb, maxDb);
    const punch = {};
    const smooth = {};
    for (const name of Object.keys(BANDS)) {
      const f = this.env[name].fast.update(levels[name], dtMs);
      const s = this.env[name].slow.update(levels[name], dtMs);
      smooth[name] = f;
      punch[name] = Math.max(0, Math.min(1, (f - s) * 3.2));
    }
    const flatnessRaw = spectralFlatness(freqDb, sampleRate, minDb);
    const flatness = this.flatnessEnv.update(flatnessRaw, dtMs);
    const cRaw = centroidHz(freqDb, sampleRate, minDb, maxDb);
    const centroid = this.centroidEnv.update(cRaw ?? 400, dtMs);
    const flux = this.fluxEnv.update(spectralFlux(freqDb, this.prevDb, minDb, maxDb), dtMs);
    this.prevDb = Float32Array.from(freqDb);
    let sum = 0;
    for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i];
    const rms = Math.sqrt(sum / timeBuf.length);
    const loud = this.loudEnv.update(Math.min(1, rms * 4), dtMs);
    const calm = this.calmEnv.update(Math.min(1, rms * 4), dtMs);
    const lowPunch = Math.max(punch.sub, punch.bass);
    const kick = lowPunch > .3 && nowMs - this.lastKickMs > 110;
    if (kick) {
      this.lastKickMs = nowMs;
      this.pulse.hit(nowMs);
      this.impact = Math.min(1, this.impact + lowPunch * 1.4);
    }
    this.impact *= Math.exp(-dtMs / 260);
    this.pulse.update(nowMs);
    return {
      levels: levels,
      smooth: smooth,
      punch: punch,
      rms: rms,
      loud: loud,
      calm: calm,
      flatness: flatness,
      tonal: 1 - flatness,
      centroid: centroid,
      brightness: Math.max(0, Math.min(1, Math.log2(Math.max(80, centroid) / 80) / 7)),
      flux: flux,
      kick: kick,
      impact: this.impact,
      pulseConfidence: this.pulse.confidence,
      pulsePhase: this.pulse.phase,
      bpm: this.pulse.bpm,
      nowMs: nowMs
    };
  }
}

export function sceneParams(s) {
  const bassWeight = Math.max(s.smooth.sub, s.smooth.bass);
  return {
    swell: Math.min(1, bassWeight * 1.25),
    impact: s.impact,
    turbulence: Math.min(1, s.flux * .75 + s.smooth.mid * .5),
    coherence: Math.max(0, Math.min(1, s.tonal * 1.15 - .1)),
    grain: Math.min(1, s.flatness * 1.3),
    brightness: s.brightness,
    warmth: Math.max(0, Math.min(1, bassWeight * 1.4 - s.brightness * .5 + .25)),
    drive: Math.min(1, s.pulseConfidence * (.35 + Math.min(1, bassWeight * 1.6))),
    phase: s.pulsePhase,
    shimmer: Math.min(1, s.smooth.high * .8 + s.smooth.air * 1.1 + s.punch.high * .5),
    energy: Math.min(1, s.loud * .8 + bassWeight * .4),
    stillness: 1 - Math.min(1, s.calm * 1.6)
  };
}