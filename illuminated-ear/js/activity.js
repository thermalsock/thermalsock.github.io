// activity.js
// Turns a raw audio signal into two things the book cares about:
//  1. A continuous "activity level" (0..1, smoothed) — this is what makes a
//     slow pad fill the page slowly and a fast, busy passage fill it quickly,
//     even with no sharp attacks to detect.
//  2. Discrete "onset" events (a note/hit just started) — this is what makes
//     a single struck note visibly write a glyph the moment it's played,
//     with a strength value driving how bold the mark/ink-blot is.

import { powerCurve } from './curve.js';

/**
 * Exponential moving average with a configurable time constant, driven by
 * real elapsed time (dt) rather than a fixed per-frame alpha — so it behaves
 * consistently regardless of how often update() is actually called.
 */
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
  constructor({
    fastMs = 18,
    slowMs = 900,
    onsetFloor = 0.0009,   // ignore true silence/hiss only — real mic input runs much quieter than a hot line-level test tone, so this needs to be low
    refractoryMs = 55,    // minimum gap between onsets, avoids re-triggering on one note's ringing
    onsetRateMs = 1400,   // decay time constant for the onset-rate accumulator (the main pace driver)
    onsetsPerSecForFull = 3, // roughly this many onsets/sec saturates the onset-rate term at 1.0 — was 6, which is an unrealistic bar for anything but solo staccato playing: a relative-threshold onset comparator won't cleanly separate 6 discrete rising edges per second out of a dense, already-loud mix, so real energetic material was never reaching "brisk" (or even "flowing") no matter how hard it was playing
  } = {}) {
    this.fast = new Envelope(fastMs);
    this.slow = new Envelope(slowMs);
    this.onsetFloor = onsetFloor;
    this.refractoryMs = refractoryMs;
    this.msSinceOnset = Infinity;
    this.wasAboveThreshold = false;
    this.onsetRateMs = onsetRateMs;
    this.onsetsPerSecForFull = onsetsPerSecForFull;
    this.onsetAccum = 0; // leaky-bucket: +1 per onset, decays exponentially
    this.activityLevel = 0; // smoothed 0..1, public — the book's fill-pace signal
  }

  /**
   * @param {Float32Array} buffer time-domain samples
   * @param {number} dtMs real time elapsed since the previous call
   * @returns {{onset: boolean, strength: number, activityLevel: number}}
   */
  update(buffer, dtMs) {
    const level = rms(buffer);
    const fast = this.fast.update(level, dtMs);
    const slow = this.slow.update(level, dtMs);

    this.msSinceOnset += dtMs;

    let onset = false;
    let strength = 0;
    // Onset = fast envelope rising above a threshold relative to the recent
    // background level, on the transition from below to above (edge
    // triggered, not "currently above" — that would let one slow-decaying
    // note re-fire repeatedly while a wide baseline caught up). The "slow"
    // window is deliberately short (see slowMs default) — it tracks recent
    // background on roughly a single note's timescale, not an average
    // across several, so it can still dip and reset between closely-spaced
    // notes in a fast passage.
    const threshold = Math.max(slow * 1.35, this.onsetFloor);
    const above = fast > threshold;
    if (above && !this.wasAboveThreshold && this.msSinceOnset >= this.refractoryMs) {
      onset = true;
      strength = Math.max(0, Math.min(1, (fast - threshold) / (threshold + 0.02)));
      this.msSinceOnset = 0;
    }
    this.wasAboveThreshold = above;

    // Onset-rate estimate via leaky bucket: each onset adds a full unit,
    // and the bucket decays exponentially between onsets. Pace of playing
    // (how often new notes strike) is still the dominant term below — a
    // single sustained loud pad note pings this once and then decays; a
    // fast busy passage keeps re-pinging it and settles at a high steady
    // state, regardless of either one's absolute volume. (A plain low-pass
    // filter can't represent this — a single-frame pulse gets smoothed
    // away before it registers — hence the explicit accumulate-then-decay
    // bucket here.)
    const decay = Math.exp(-dtMs / this.onsetRateMs);
    this.onsetAccum *= decay;
    if (onset) this.onsetAccum += 1;
    // Steady-state accumulator value for a sustained rate R onsets/sec is
    // approximately R * (onsetRateMs/1000), so normalize against that.
    const steadyStateForFull = this.onsetsPerSecForFull * (this.onsetRateMs / 1000);
    const pacePortionRaw = Math.max(0, Math.min(1, this.onsetAccum / steadyStateForFull));
    // Reactivity curve, not a straight ratio: climbs faster through the
    // low-to-mid range instead of needing to nearly reach the ceiling
    // before it visibly registers.
    const pacePortion = powerCurve(pacePortionRaw, 0.7);

    // RMS -> density: a genuinely loud, dense passage (which may not
    // cleanly separate into discrete onsets at all — a wall-of-sound mix
    // is the normal case, not an edge case) should still visibly raise
    // pace on its own. This is no longer a minor trickle-only term; it's
    // a real second contributor alongside onset rate.
    const loudnessPortion = powerCurve(Math.max(0, Math.min(1, Math.sqrt(slow) * 1.6)), 0.85);

    const target = pacePortion * 0.62 + loudnessPortion * 0.38;
    this.activityLevel += (target - this.activityLevel) * Math.min(1, dtMs / 500);

    return { onset, strength, activityLevel: this.activityLevel };
  }
}
