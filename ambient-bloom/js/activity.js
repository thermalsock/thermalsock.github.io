import { powerCurve } from "./curve.js";

export class Envelope {
  constructor(timeConstantMs) {
    this.timeConstantMs = timeConstantMs;
    this.value = 0;
  }
  update(sample, dtMs) {
    const alpha = 1 - Math.exp(-dtMs / this.timeConstantMs);
    this.value += (sample - this.value) * alpha;
    return this.value;
  }
}

export function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

export class ActivityDetector {
  constructor({fastMs: fastMs = 18, slowMs: slowMs = 900, onsetFloor: onsetFloor = 9e-4, refractoryMs: refractoryMs = 55, onsetRateMs: onsetRateMs = 1400, onsetsPerSecForFull: onsetsPerSecForFull = 3} = {}) {
    this.fast = new Envelope(fastMs);
    this.slow = new Envelope(slowMs);
    this.onsetFloor = onsetFloor;
    this.refractoryMs = refractoryMs;
    this.msSinceOnset = Infinity;
    this.wasAboveThreshold = false;
    this.onsetRateMs = onsetRateMs;
    this.onsetsPerSecForFull = onsetsPerSecForFull;
    this.onsetAccum = 0;
    this.activityLevel = 0;
  }
  update(buffer, dtMs) {
    const level = rms(buffer);
    const fast = this.fast.update(level, dtMs);
    const slow = this.slow.update(level, dtMs);
    this.msSinceOnset += dtMs;
    let onset = false;
    let strength = 0;
    const threshold = Math.max(slow * 1.35, this.onsetFloor);
    const above = fast > threshold;
    if (above && !this.wasAboveThreshold && this.msSinceOnset >= this.refractoryMs) {
      onset = true;
      strength = Math.max(0, Math.min(1, (fast - threshold) / (threshold + .02)));
      this.msSinceOnset = 0;
    }
    this.wasAboveThreshold = above;
    const decay = Math.exp(-dtMs / this.onsetRateMs);
    this.onsetAccum *= decay;
    if (onset) this.onsetAccum += 1;
    const steadyStateForFull = this.onsetsPerSecForFull * (this.onsetRateMs / 1e3);
    const pacePortionRaw = Math.max(0, Math.min(1, this.onsetAccum / steadyStateForFull));
    const pacePortion = powerCurve(pacePortionRaw, .7);
    const loudnessPortion = powerCurve(Math.max(0, Math.min(1, Math.sqrt(slow) * 1.6)), .85);
    const target = pacePortion * .62 + loudnessPortion * .38;
    this.activityLevel += (target - this.activityLevel) * Math.min(1, dtMs / 500);
    return {
      onset: onset,
      strength: strength,
      activityLevel: this.activityLevel
    };
  }
}