// pitchDetect.js
// Autocorrelation-based fundamental frequency detector for a single sustained
// note (one VCO at a time, no subs engaged). Deliberately NOT spectral
// peak-picking: on a harmonically rich waveform (saw/pulse, especially after
// filtering) the loudest FFT bin is often a harmonic, not the fundamental —
// confirmed as a real failure mode in testing. Autocorrelation instead finds
// the signal's true period directly in the time domain.
//
// Also deliberately does NOT take the single global-max-correlation lag:
// on a purely periodic test tone, correlation can spike at a much longer,
// musically unrelated lag purely by coincidental phase alignment (verified
// in Node testing — a 440Hz sine falsely "detected" as 20Hz via a spurious
// lag-2205 alias). Scanning shortest-to-longest and taking the first strong
// local peak avoids this and also avoids the classic octave-down error.

/**
 * @param {Float32Array} buffer time-domain samples, range [-1, 1]
 * @param {number} sampleRate
 * @returns {{freq: number, confidence: number} | null} null if nothing
 *   confidently periodic was found in range (e.g. silence, noise).
 */
export function detectPitch(buffer, sampleRate, { minHz = 20, maxHz = 1200, threshold = 0.85 } = {}) {
  const N = buffer.length;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(N / 2));
  if (maxLag <= minLag + 2) return null;

  const corr = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, normA = 0, normB = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
      normA += buffer[i] * buffer[i];
      normB += buffer[i + lag] * buffer[i + lag];
    }
    const norm = Math.sqrt(normA * normB);
    corr[lag] = norm > 0 ? sum / norm : 0;
  }

  let bestLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] >= threshold && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) return null;

  // Parabolic interpolation around the peak lag for sub-sample accuracy.
  const y0 = corr[bestLag - 1], y1 = corr[bestLag], y2 = corr[bestLag + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? 0.5 * (y0 - y2) / denom : 0;
  const refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, shift));

  return { freq: sampleRate / refinedLag, confidence: corr[bestLag] };
}

/**
 * Simple RMS level in dBFS, for a visible "is the app even hearing me" meter —
 * the most common real-world cause of "it didn't detect anything" is signal
 * not reaching the analyser at all (wrong input device, fader down, etc.),
 * which is invisible without a level readout.
 */
export function levelDb(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  const rms = Math.sqrt(sum / buffer.length);
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/**
 * Tracks pitch-detection stability across consecutive calls: only reports a
 * "lock" once several readings in a row agree within a tight tolerance, so a
 * single noisy frame can't jump the displayed root around. Call update() each
 * detection tick; it returns the locked {freq} once stable, or null while
 * still settling/unstable.
 */
export class PitchLock {
  constructor({ requiredStableFrames = 5, toleranceCents = 8 } = {}) {
    this.requiredStableFrames = requiredStableFrames;
    this.toleranceCents = toleranceCents;
    this.history = [];
    this.locked = null;
  }
  update(freq) {
    if (freq == null) {
      this.history = [];
      return this.locked;
    }
    this.history.push(freq);
    if (this.history.length > this.requiredStableFrames) this.history.shift();
    if (this.history.length === this.requiredStableFrames) {
      const ref = this.history[0];
      const stable = this.history.every((f) => Math.abs(1200 * Math.log2(f / ref)) < this.toleranceCents);
      if (stable) {
        const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;
        this.locked = avg;
      }
    }
    return this.locked;
  }
  reset() {
    this.history = [];
    this.locked = null;
  }
}
