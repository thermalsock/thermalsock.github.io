export function detectPitch(buffer, sampleRate, {minHz: minHz = 20, maxHz: maxHz = 1200, threshold: threshold = .85} = {}) {
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
  const y0 = corr[bestLag - 1], y1 = corr[bestLag], y2 = corr[bestLag + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? .5 * (y0 - y2) / denom : 0;
  const refinedLag = bestLag + Math.max(-.5, Math.min(.5, shift));
  return {
    freq: sampleRate / refinedLag,
    confidence: corr[bestLag]
  };
}

export function levelDb(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  const rms = Math.sqrt(sum / buffer.length);
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

export class PitchLock {
  constructor({requiredStableFrames: requiredStableFrames = 5, toleranceCents: toleranceCents = 8} = {}) {
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
      const stable = this.history.every(f => Math.abs(1200 * Math.log2(f / ref)) < this.toleranceCents);
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