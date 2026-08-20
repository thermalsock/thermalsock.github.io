// spectral.js
// Turns the analyser's frequency-domain (dB) and time-domain buffers into
// the three features the reactivity curve actually needs: per-band energy
// (low/mid/high), spectral centroid (brightness), and zero-crossing rate
// (noisiness/texture). None of this replaces the pitch detector or the
// onset detector in activity.js — it runs alongside them, driving *how* a
// mark looks rather than *whether* one gets written.
//
// The analyser buffer (getFloatFrequencyData) was already being allocated
// before this file existed — it just wasn't being read by anything.

/** Converts an analyser dB reading back to a 0..1 linear-ish magnitude,
 * clamped to the analyser's own configured floor/ceiling. */
function dbToLinear01(db, minDb, maxDb) {
  const t = (db - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(1, t));
}

const DEFAULT_BANDS = {
  low: [20, 250],
  mid: [250, 2000],
  high: [2000, 9000],
};

/**
 * Average (dB-derived, 0..1) energy across three frequency bands.
 * @param {Float32Array} freqDb analyser.getFloatFrequencyData() output
 */
export function bandEnergies(freqDb, sampleRate, minDb, maxDb, bands = DEFAULT_BANDS) {
  const binHz = sampleRate / (2 * freqDb.length);
  const out = {};
  for (const [name, [loHz, hiHz]] of Object.entries(bands)) {
    const loBin = Math.max(0, Math.floor(loHz / binHz));
    const hiBin = Math.min(freqDb.length - 1, Math.ceil(hiHz / binHz));
    let sum = 0, count = 0;
    for (let i = loBin; i <= hiBin; i++) {
      sum += dbToLinear01(freqDb[i], minDb, maxDb);
      count++;
    }
    out[name] = count > 0 ? sum / count : 0;
  }
  return out;
}

/**
 * Spectral centroid: the energy-weighted average frequency, in Hz — the
 * standard proxy for perceived "brightness." Returns null when there's
 * essentially no energy above the noise floor, rather than a meaningless
 * centroid computed from silence/hiss.
 */
export function spectralCentroid(freqDb, sampleRate, minDb, maxDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  let weightedSum = 0, totalWeight = 0;
  for (let i = 0; i < freqDb.length; i++) {
    const mag = dbToLinear01(freqDb[i], minDb, maxDb);
    if (mag <= 0.001) continue;
    weightedSum += i * binHz * mag;
    totalWeight += mag;
  }
  if (totalWeight < 0.02) return null;
  return weightedSum / totalWeight;
}

/**
 * Zero-crossing rate, normalized against a "typical noisy signal" ceiling
 * rather than the theoretical maximum (Nyquist/2 crossings per sample,
 * which no real musical signal approaches — normalizing against that
 * would make everything read as near-zero).
 */
export function zeroCrossingRate(buffer) {
  let crossings = 0;
  for (let i = 1; i < buffer.length; i++) {
    if ((buffer[i - 1] < 0) !== (buffer[i] < 0)) crossings++;
  }
  const rate = crossings / buffer.length;
  // Sustained tones typically sit well under 0.05; noisy/percussive/bright
  // material can run 0.15+. Scale so "noticeably noisy" reads close to 1
  // without needing literal white noise to saturate it.
  return Math.max(0, Math.min(1, rate / 0.18));
}
