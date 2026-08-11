// PianoFingering.js
//
// Real, sourced piano fingering (piano.org's fingering charts) for
// the scale types where an authoritative standard actually exists:
// Major, natural Minor, and their modal-identical siblings Ionian
// (= Major) and Aeolian (= Minor). Fingering numbers follow the
// standard 1 (thumb) -> 5 (pinky) convention on both hands.
//
// DELIBERATELY NOT extended to the other 14 scale types (Dorian,
// Phrygian, Lydian, Mixolydian, Locrian, both Pentatonics, both
// Blues, Whole Tone, both Diminished, Chromatic). Tested a
// straightforward "wrap fingers 1-5, cross the thumb only when
// forced" algorithm against real Major-scale fingering first -- it
// produced [1,2,3,4,5,1,2,3] for a scale where the actual standard is
// [1,2,3,1,2,3,4,5]. Real fingering crosses the thumb EARLY, chosen
// per-key based on exactly where the black keys fall, to set up the
// rest of the run -- a genuine per-key optimization, not a fixed
// rule, which even piano.org's own FAQ acknowledges varies by method
// book for less standard scales. Rather than present an unverified
// algorithmic guess as "the correct fingering" for those 14 types,
// ScaleNotation.js shows a plain "fingering varies" note for them
// instead of numbers that might be wrong.

// Keyed by root name (matching TWELVE_ROOTS in scales.js) -- each
// entry is 8 fingers (root through the octave), ascending.
const MAJOR_FINGERING = {
  C: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Db: { rh: [2, 3, 1, 2, 3, 4, 1, 2], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  D: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Eb: { rh: [3, 1, 2, 3, 4, 1, 2, 3], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  E: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  F: { rh: [1, 2, 3, 4, 1, 2, 3, 4], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  "F#": { rh: [2, 3, 4, 1, 2, 3, 1, 2], lh: [4, 3, 2, 1, 3, 2, 1, 4] },
  G: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Ab: { rh: [3, 4, 1, 2, 3, 1, 2, 3], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  A: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Bb: { rh: [4, 1, 2, 3, 1, 2, 3, 4], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  B: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [4, 3, 2, 1, 4, 3, 2, 1] }
};

const NATURAL_MINOR_FINGERING = {
  C: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Db: { rh: [2, 3, 1, 2, 3, 4, 1, 2], lh: [4, 3, 2, 1, 3, 2, 1, 4] },
  D: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Eb: { rh: [2, 1, 2, 3, 4, 1, 2, 3], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  E: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  F: { rh: [1, 2, 3, 4, 1, 2, 3, 4], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  "F#": { rh: [2, 3, 4, 1, 2, 3, 1, 2], lh: [4, 3, 2, 1, 3, 2, 1, 4] },
  G: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Ab: { rh: [3, 4, 1, 2, 3, 1, 2, 3], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  A: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] },
  Bb: { rh: [4, 1, 2, 3, 1, 2, 3, 4], lh: [3, 2, 1, 4, 3, 2, 1, 3] },
  B: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [4, 3, 2, 1, 4, 3, 2, 1] }
};

// pack.name is e.g. "F# Major" or "Bb Minor" -- the root is everything
// before the first space.
function rootFromPackName(name) {
  return name.split(" ")[0];
}

// Returns { rh: number[], lh: number[] } for Major/Minor/Ionian/
// Aeolian packs, or null for every other scale type (see header
// comment for why those are deliberately left without numbers).
export function getFingering(pack) {
  const table = pack.scaleType === "major" || pack.scaleType === "ionian"
    ? MAJOR_FINGERING
    : pack.scaleType === "minor" || pack.scaleType === "aeolian"
      ? NATURAL_MINOR_FINGERING
      : null;
  if (!table) return null;

  const root = rootFromPackName(pack.name);
  return table[root] || null;
}
