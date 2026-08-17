// measurements.js
// Automatic measurements derived from a time-domain sample buffer.

export function measureVpp(buffer) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] < min) min = buffer[i];
    if (buffer[i] > max) max = buffer[i];
  }
  return max - min;
}

export function measureRms(buffer) {
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSquares / buffer.length);
}

/**
 * Estimate fundamental frequency via zero-crossing detection on the rising edge.
 * Good enough for a scope readout on reasonably clean periodic signals;
 * not a substitute for FFT-based analysis on noisy/complex signals (that's the
 * planned spectrum-view feature).
 */
export function measureFrequency(buffer, sampleRate) {
  const crossings = [];
  // Use mean as the crossing reference so signals with DC offset still work.
  let mean = 0;
  for (let i = 0; i < buffer.length; i++) mean += buffer[i];
  mean /= buffer.length;

  for (let i = 1; i < buffer.length; i++) {
    if (buffer[i - 1] < mean && buffer[i] >= mean) {
      // Linear interpolation for sub-sample crossing accuracy.
      const t = (mean - buffer[i - 1]) / (buffer[i] - buffer[i - 1]);
      crossings.push(i - 1 + t);
    }
  }

  if (crossings.length < 2) return null;

  const periods = [];
  for (let i = 1; i < crossings.length; i++) {
    periods.push(crossings[i] - crossings[i - 1]);
  }
  const avgPeriodSamples = periods.reduce((a, b) => a + b, 0) / periods.length;
  if (avgPeriodSamples <= 0) return null;

  const frequencyHz = sampleRate / avgPeriodSamples;
  const periodMs = (avgPeriodSamples / sampleRate) * 1000;
  return { frequencyHz, periodMs };
}

export function formatHz(hz) {
  if (hz == null || !isFinite(hz)) return '--';
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

export function formatMs(ms) {
  if (ms == null || !isFinite(ms)) return '--';
  if (ms < 1) return `${(ms * 1000).toFixed(1)} \u00b5s`;
  return `${ms.toFixed(2)} ms`;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Compute a 12-bin chromagram (pitch-class energy) from a dB-scale frequency
 * buffer. Each FFT bin's frequency is mapped to the nearest equal-tempered
 * pitch class (A440 reference) and its linear-amplitude energy accumulated
 * into that class, so e.g. every octave of C collapses into the same bin.
 * Restricts to a musically-relevant range (80Hz-5kHz) so sub-bass noise and
 * high-frequency hiss don't dominate. Returns a Float32Array(12), normalized
 * so the loudest pitch class is 1.0.
 */
export function computeChroma(freqData, sampleRate, fftSize, { minFreq = 80, maxFreq = 5000 } = {}) {
  const chroma = new Float32Array(12);
  const binHz = sampleRate / fftSize;

  for (let i = 1; i < freqData.length; i++) {
    const freq = i * binHz;
    if (freq < minFreq || freq > maxFreq) continue;

    const db = freqData[i];
    const amp = Math.pow(10, db / 20); // dB -> linear amplitude
    const midi = 69 + 12 * Math.log2(freq / 440);
    let pitchClass = Math.round(midi) % 12;
    if (pitchClass < 0) pitchClass += 12;
    chroma[pitchClass] += amp;
  }

  let max = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > max) max = chroma[i];
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }
  return chroma;
}

/**
 * Converts a frequency to the nearest equal-tempered note (A440 reference),
 * including cents deviation — how far off pitch it is from that note, useful
 * for dialing in an oscillator precisely rather than just seeing "close to A2".
 * Returns null for non-positive/invalid frequencies.
 */
export function freqToNote(freq) {
  if (!freq || freq <= 0 || !isFinite(freq)) return null;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midi);
  const cents = (midi - roundedMidi) * 100;
  const name = NOTE_NAMES[((roundedMidi % 12) + 12) % 12];
  const octave = Math.floor(roundedMidi / 12) - 1; // MIDI 69 = A4
  return { name, octave, midi: roundedMidi, cents };
}

/**
 * Simple peak-picking spectral peak detector: finds local maxima in a dB-scale
 * frequency buffer above `minDb`, keeping only the loudest `maxPeaks`, each at
 * least `minSeparationHz` apart (so a single wide peak isn't reported as several).
 * Returns peaks sorted ascending by frequency.
 */
export function findSpectralPeaks(freqData, sampleRate, fftSize, { minDb = -70, maxPeaks = 6, minSeparationHz = 15 } = {}) {
  const binHz = sampleRate / fftSize;
  const minSepBins = Math.max(1, Math.round(minSeparationHz / binHz));

  const candidates = [];
  for (let i = 1; i < freqData.length - 1; i++) {
    const db = freqData[i];
    if (db < minDb) continue;
    if (db >= freqData[i - 1] && db >= freqData[i + 1]) {
      // Parabolic (quadratic) interpolation using the peak bin and its two
      // neighbors gives sub-bin frequency accuracy — plain bin-index lookup
      // has ~10Hz resolution at typical settings, which is a huge cents
      // error at low (sub-oscillator) frequencies. This is the standard fix.
      const alpha = freqData[i - 1], beta = freqData[i], gamma = freqData[i + 1];
      const denom = alpha - 2 * beta + gamma;
      const p = denom !== 0 ? 0.5 * (alpha - gamma) / denom : 0;
      const interpBin = i + Math.max(-0.5, Math.min(0.5, p)); // clamp to within one bin
      candidates.push({ bin: i, freq: interpBin * binHz, db });
    }
  }

  candidates.sort((a, b) => b.db - a.db); // loudest first
  const picked = [];
  for (const c of candidates) {
    if (picked.length >= maxPeaks) break;
    if (picked.every((p) => Math.abs(p.bin - c.bin) >= minSepBins)) {
      picked.push(c);
    }
  }

  picked.sort((a, b) => a.freq - b.freq); // ascending for display
  return picked;
}

/**
 * Reads the interpolated dB magnitude at an exact frequency (not just the
 * nearest bin) by linearly interpolating between the two bins straddling it —
 * used by computeHarmonicBalance to sample precisely at each harmonic
 * multiple of a fundamental, rather than searching for peaks.
 */
function sampleDbAtFreq(freqData, freq, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  const exactBin = freq / binHz;
  const i0 = Math.floor(exactBin);
  const i1 = i0 + 1;
  if (i0 < 0 || i1 >= freqData.length) return null;
  const t = exactBin - i0;
  return freqData[i0] * (1 - t) + freqData[i1] * t;
}

/**
 * Measures the balance between odd (3rd, 5th, 7th...) and even (2nd, 4th,
 * 6th...) harmonic energy above a given fundamental, plus overall Total
 * Harmonic Distortion (THD) — a classic pair of measurements for reading a
 * waveform's timbral character: odd-dominant reads squarer/hollower,
 * even-dominant reads more sawtooth-like, and THD tells you how much
 * harmonic content exists at all versus a pure tone. Excludes the
 * fundamental itself (harmonic 1) from the odd/even split, as is standard.
 * Below MEANINGFUL_THD_PERCENT, oddRatio is forced to neutral (0.5) rather
 * than computed — near a pure tone there's essentially no real harmonic
 * energy, so odd vs even power is just comparing two noise-floor readings
 * against each other, which can swing wildly run to run for reasons that
 * have nothing to do with the actual waveform. THD itself stays real/honest
 * either way — it's the number that correctly reports "not much going on."
 * Returns { oddRatio, thdPercent, fundamentalAmp, reliable } — `reliable`
 * indicates whether oddRatio reflects a real measurement (true) or was
 * snapped to neutral due to insufficient harmonic energy (false).
 */
const MEANINGFUL_THD_PERCENT = 2;

export function computeHarmonicBalance(freqData, fundamentalHz, sampleRate, fftSize, { maxHarmonic = 16 } = {}) {
  const ampAtHarmonic = (h) => {
    const db = sampleDbAtFreq(freqData, fundamentalHz * h, sampleRate, fftSize);
    return db == null ? 0 : Math.pow(10, db / 20);
  };

  const fundamentalAmp = ampAtHarmonic(1);
  let oddPower = 0;
  let evenPower = 0;
  for (let h = 2; h <= maxHarmonic; h++) {
    const power = ampAtHarmonic(h) ** 2;
    if (h % 2 === 0) evenPower += power;
    else oddPower += power;
  }

  const totalHarmonicPower = oddPower + evenPower;
  const thdPercent = fundamentalAmp > 0 ? (Math.sqrt(totalHarmonicPower) / fundamentalAmp) * 100 : 0;
  const reliable = thdPercent >= MEANINGFUL_THD_PERCENT;
  const oddRatio = reliable && totalHarmonicPower > 0 ? oddPower / totalHarmonicPower : 0.5;

  return { oddRatio, thdPercent, fundamentalAmp, reliable };
}

/**
 * Describes the frequency ratio between two frequencies as a short label —
 * prioritizing simple integer ratios (/2, /3, ...) since that's exactly what
 * subharmonic dividers (e.g. Moog Subharmonicon) produce, falling back to
 * common musical interval names, then a raw ratio.
 */
export function describeRatio(freqLow, freqHigh) {
  if (!freqLow || !freqHigh || freqLow <= 0 || freqHigh <= 0) return '';
  const ratio = freqHigh / freqLow;
  const tolerance = 0.03;

  for (let n = 2; n <= 8; n++) {
    if (Math.abs(ratio - n) / n < tolerance) return `/${n}`;
  }

  const intervals = [
    [3 / 2, 'P5'], [4 / 3, 'P4'], [5 / 4, 'M3'], [6 / 5, 'm3'],
    [5 / 3, 'M6'], [8 / 5, 'm6'], [9 / 8, 'M2'],
  ];
  for (const [r, label] of intervals) {
    if (Math.abs(ratio - r) / r < tolerance) return label;
  }

  return `${ratio.toFixed(2)}:1`;
}

/**
 * Tags each peak (ascending array from findSpectralPeaks) as either an
 * independent "root" pitch, or a harmonic of some lower peak already in the
 * list — e.g. a peak at 787.7Hz gets tagged "harmonic 3 of 262.6Hz" if that
 * relationship holds within tolerance. This is what separates "this is a
 * genuinely different oscillator" from "this is just an overtone of a pitch
 * you're already seeing" — the distinction that's otherwise easy to miss by
 * eye on a busy ladder. Checks every earlier (lower) peak, not just the
 * adjacent one, and keeps the best-fitting root if more than one matches.
 * Returns a new array with `harmonicOf` (root frequency, or null) and
 * `harmonicNumber` (1 if it's a root itself) added to each peak.
 */
export function tagHarmonics(peaks, { tolerance = 0.02 } = {}) {
  return peaks.map((p, i) => {
    // Check lower peaks lowest-frequency-first and take the first that fits,
    // rather than whichever fits best — this surfaces the ultimate root of a
    // harmonic series (e.g. "harmonic 6 of 262.6Hz") instead of a technically
    // valid but less revealing intermediate one ("harmonic 2 of 787.7Hz").
    for (let j = 0; j < i; j++) {
      const ratio = p.freq / peaks[j].freq;
      const n = Math.round(ratio);
      if (n < 2) continue;
      const err = Math.abs(ratio - n) / n;
      if (err < tolerance) {
        return { ...p, harmonicOf: peaks[j].freq, harmonicNumber: n };
      }
    }
    return { ...p, harmonicOf: null, harmonicNumber: 1 };
  });
}
