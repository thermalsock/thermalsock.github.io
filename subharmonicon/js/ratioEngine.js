import { freqToNote } from "./measurements.js";

const INTERVAL_NAMES = [ "Unison", "m2", "M2", "m3", "M3", "P4", "Tritone", "P5", "m6", "M6", "m7", "M7", "Octave" ];

export function intervalFromRatio(ratio) {
  if (!ratio || ratio <= 0) return null;
  const semitones = 12 * Math.log2(ratio);
  const rounded = Math.round(semitones);
  const cents = (semitones - rounded) * 100;
  const octaves = Math.floor(rounded / 12);
  const pc = (rounded % 12 + 12) % 12;
  let name = INTERVAL_NAMES[pc];
  if (octaves !== 0) {
    name += octaves > 0 ? ` +${octaves}oct` : ` ${octaves}oct`;
  }
  return {
    name: name,
    semitones: rounded,
    cents: cents
  };
}

export function buildDivideTable(rootFreq, {maxN: maxN = 8} = {}) {
  const rows = [];
  for (let n = 1; n <= maxN; n++) {
    const freq = rootFreq / n;
    const note = freqToNote(freq);
    const interval = intervalFromRatio(1 / n);
    rows.push({
      n: n,
      freq: freq,
      note: note,
      interval: interval
    });
  }
  return rows;
}

export const TARGET_INTERVALS = [ {
  label: "Octave below",
  semitonesBelow: 12
}, {
  label: "Fifth below (+ octave)",
  semitonesBelow: 19
}, {
  label: "Fourth below (+ octave)",
  semitonesBelow: 17
}, {
  label: "Major third below (+ octave)",
  semitonesBelow: 16
}, {
  label: "Flat-seventh flavor (7th harmonic)",
  semitonesBelow: 14
}, {
  label: "Two octaves below",
  semitonesBelow: 24
}, {
  label: "Root (unison)",
  semitonesBelow: 0
} ];

export function nearestDivisorForTarget(semitonesBelow, {maxN: maxN = 8} = {}) {
  let best = null;
  for (let n = 1; n <= maxN; n++) {
    const actualSemitones = 12 * Math.log2(n);
    const diff = Math.abs(actualSemitones - semitonesBelow);
    if (best === null || diff < best.diff) {
      best = {
        n: n,
        diff: diff,
        cents: (actualSemitones - semitonesBelow) * 100
      };
    }
  }
  return best;
}

const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

const FLAT_TO_SHARP = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#"
};

export function parseManualRoot(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[\d.]+\s*(hz)?$/i.test(trimmed)) {
    const hz = Number(trimmed.replace(/hz$/i, "").trim());
    if (!Number.isNaN(hz) && hz > 0) return hz;
  }
  const m = trimmed.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return null;
  let name = m[1].toUpperCase() + m[2];
  if (FLAT_TO_SHARP[name]) name = FLAT_TO_SHARP[name];
  const octave = parseInt(m[3], 10);
  const pc = NOTE_NAMES.indexOf(name);
  if (pc < 0) return null;
  const midi = (octave + 1) * 12 + pc;
  return 440 * Math.pow(2, (midi - 69) / 12);
}