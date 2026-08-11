// ScaleSpelling.js
//
// Real music notation needs each scale degree to use a DIFFERENT
// letter name (C D E F G A B, skipping/reusing per the scale's actual
// note count) with an accidental chosen to match the correct pitch --
// not just "nearest sharp", which is what ChordDetector.js uses for a
// quick real-time readout and is NOT correct notation practice (it
// would spell a scale like "C, D, E, F, F#, G#, A#" instead of the
// proper "C, D, E, F, G, A, B" for something like a mode built on
// white keys). This is a different, more rigorous algorithm
// specifically for rendering actual notation.

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// letterOffsets: which of the 7 letters (as an offset from the root's
// own letter, e.g. root C + offset 2 = E) each scale degree should
// use. This is scale-type-specific -- a 7-note scale uses each letter
// once ([0,1,2,3,4,5,6]), a 5-note pentatonic skips two letters, a
// 6-note blues scale reuses one letter twice (the "blue note" shares
// a letter with the perfect 5th, spelled as a flat on it) -- these
// aren't guessable from the interval pattern alone, so callers pass
// the correct one for their scale type.
export function spellScale(rootLetter, rootAccidental, intervals, letterOffsets) {
  const rootLetterIndex = LETTERS.indexOf(rootLetter);
  const rootSemitone = ((NATURAL_SEMITONE[rootLetter] + rootAccidental) % 12 + 12) % 12;

  return intervals.map((interval, i) => {
    const targetSemitone = (rootSemitone + interval) % 12;
    const letterOffset = letterOffsets[i];
    const letterIndex = (rootLetterIndex + letterOffset) % 7;
    const letter = LETTERS[letterIndex];
    const naturalSemitone = NATURAL_SEMITONE[letter];

    // Accidental = how far the target pitch sits from that letter's
    // own natural (unaltered) pitch, wrapped to the smallest sensible
    // range (-6..+5) so e.g. "11 semitones sharp" resolves to "1
    // semitone flat" instead of something absurd.
    let diff = targetSemitone - naturalSemitone;
    diff = (((diff + 6) % 12) + 12) % 12 - 6;

    return { letter, accidental: diff, pitchClass: targetSemitone };
  });
}

// Standard 7-letter spelling (Major, Natural Minor, Harmonic Minor,
// and all 7 modes) -- one letter per degree, in order.
export const LETTER_OFFSETS_HEPTATONIC = [0, 1, 2, 3, 4, 5, 6];

// Major pentatonic = major scale degrees 1,2,3,5,6 (omits 4 and 7).
export const LETTER_OFFSETS_MAJOR_PENTATONIC = [0, 1, 2, 4, 5];

// Minor pentatonic = natural minor degrees 1,3,4,5,7 (omits 2 and 6).
export const LETTER_OFFSETS_MINOR_PENTATONIC = [0, 2, 3, 4, 6];

// Minor blues = minor pentatonic + a chromatic passing tone between
// the 4th and 5th degrees (the "blue note"), conventionally spelled
// sharing the 5th's letter with a flat on it.
export const LETTER_OFFSETS_MINOR_BLUES = [0, 2, 3, 4, 4, 6];

// Major blues = major pentatonic + a chromatic passing tone between
// the 2nd and 3rd degrees, conventionally spelled sharing the 3rd's
// letter (flat first, then natural).
export const LETTER_OFFSETS_MAJOR_BLUES = [0, 1, 2, 2, 4, 5];

// Whole tone -- symmetric, no single "correct" key-signature spelling
// exists the way there is for diatonic scales; six consecutive letters
// (skipping the 7th) is the common convention.
export const LETTER_OFFSETS_WHOLE_TONE = [0, 1, 2, 3, 4, 5];

// Diminished (whole-half): 8 notes, one letter necessarily repeats --
// this is the standard convention (repeats the 6th-degree letter).
export const LETTER_OFFSETS_DIMINISHED_WH = [0, 1, 2, 3, 4, 5, 5, 6];

// Diminished (half-whole): 8 notes, repeats the root's own letter for
// the passing chromatic 2nd -- the standard convention for this one.
export const LETTER_OFFSETS_DIMINISHED_HW = [0, 0, 1, 2, 3, 4, 5, 6];

// Chromatic, ascending: repeats 5 of the 7 letters once each (the
// standard "ascending uses sharps" chromatic spelling).
export const LETTER_OFFSETS_CHROMATIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
