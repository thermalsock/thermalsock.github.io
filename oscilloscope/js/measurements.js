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
export function measureFrequency(buffer, sampleRate) {
  const crossings = [];
  let mean = 0;
  for (let i = 0; i < buffer.length; i++) mean += buffer[i];
  mean /= buffer.length;
  for (let i = 1; i < buffer.length; i++) {
    if (buffer[i - 1] < mean && buffer[i] >= mean) {
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
  const periodMs = (avgPeriodSamples / sampleRate) * 1e3;
  return { frequencyHz, periodMs };
}
export function formatHz(hz) {
  if (hz == null || !isFinite(hz)) return "--";
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}
export function formatMs(ms) {
  if (ms == null || !isFinite(ms)) return "--";
  if (ms < 1) return `${(ms * 1e3).toFixed(1)} µs`;
  return `${ms.toFixed(2)} ms`;
}
export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export function computeChroma(
  freqData,
  sampleRate,
  fftSize,
  { minFreq = 80, maxFreq = 5e3 } = {},
) {
  const chroma = new Float32Array(12);
  const binHz = sampleRate / fftSize;
  for (let i = 1; i < freqData.length; i++) {
    const freq = i * binHz;
    if (freq < minFreq || freq > maxFreq) continue;
    const db = freqData[i];
    const amp = Math.pow(10, db / 20);
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
export function freqToNote(freq) {
  if (!freq || freq <= 0 || !isFinite(freq)) return null;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midi);
  const cents = (midi - roundedMidi) * 100;
  const name = NOTE_NAMES[((roundedMidi % 12) + 12) % 12];
  const octave = Math.floor(roundedMidi / 12) - 1;
  return { name, octave, midi: roundedMidi, cents };
}
export function findSpectralPeaks(
  freqData,
  sampleRate,
  fftSize,
  { minDb = -70, maxPeaks = 6, minSeparationHz = 15 } = {},
) {
  const binHz = sampleRate / fftSize;
  const minSepBins = Math.max(1, Math.round(minSeparationHz / binHz));
  const candidates = [];
  for (let i = 1; i < freqData.length - 1; i++) {
    const db = freqData[i];
    if (db < minDb) continue;
    if (db >= freqData[i - 1] && db >= freqData[i + 1]) {
      const alpha = freqData[i - 1],
        beta = freqData[i],
        gamma = freqData[i + 1];
      const denom = alpha - 2 * beta + gamma;
      const p = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0;
      const interpBin = i + Math.max(-0.5, Math.min(0.5, p));
      candidates.push({ bin: i, freq: interpBin * binHz, db });
    }
  }
  candidates.sort((a, b) => b.db - a.db);
  const picked = [];
  for (const c of candidates) {
    if (picked.length >= maxPeaks) break;
    if (picked.every((p) => Math.abs(p.bin - c.bin) >= minSepBins)) {
      picked.push(c);
    }
  }
  picked.sort((a, b) => a.freq - b.freq);
  return picked;
}
function sampleDbAtFreq(freqData, freq, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  const exactBin = freq / binHz;
  const i0 = Math.floor(exactBin);
  const i1 = i0 + 1;
  if (i0 < 0 || i1 >= freqData.length) return null;
  const t = exactBin - i0;
  return freqData[i0] * (1 - t) + freqData[i1] * t;
}
const MEANINGFUL_THD_PERCENT = 2;
export function computeHarmonicBalance(
  freqData,
  fundamentalHz,
  sampleRate,
  fftSize,
  { maxHarmonic = 16 } = {},
) {
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
  const thdPercent =
    fundamentalAmp > 0
      ? (Math.sqrt(totalHarmonicPower) / fundamentalAmp) * 100
      : 0;
  const reliable = thdPercent >= MEANINGFUL_THD_PERCENT;
  const oddRatio =
    reliable && totalHarmonicPower > 0 ? oddPower / totalHarmonicPower : 0.5;
  return { oddRatio, thdPercent, fundamentalAmp, reliable };
}
export function describeRatio(freqLow, freqHigh) {
  if (!freqLow || !freqHigh || freqLow <= 0 || freqHigh <= 0) return "";
  const ratio = freqHigh / freqLow;
  const tolerance = 0.03;
  for (let n = 2; n <= 8; n++) {
    if (Math.abs(ratio - n) / n < tolerance) return `/${n}`;
  }
  const intervals = [
    [3 / 2, "P5"],
    [4 / 3, "P4"],
    [5 / 4, "M3"],
    [6 / 5, "m3"],
    [5 / 3, "M6"],
    [8 / 5, "m6"],
    [9 / 8, "M2"],
  ];
  for (const [r, label] of intervals) {
    if (Math.abs(ratio - r) / r < tolerance) return label;
  }
  return `${ratio.toFixed(2)}:1`;
}
export function tagHarmonics(peaks, { tolerance = 0.02 } = {}) {
  return peaks.map((p, i) => {
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
