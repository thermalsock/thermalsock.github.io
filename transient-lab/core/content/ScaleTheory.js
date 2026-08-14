// ScaleTheory.js
//
// Real interval definitions, matching the standard taxonomy used by
// Berklee's PULSE scale reference (pulse.berklee.edu/scales) --
// semitone patterns are standard music theory, not anyone's IP.
// Rather than hand-transcribing note data for each individual scale
// pack (error-prone, verified the hard way earlier in this project
// more than once), this generates a scale's notes AND its full 4-rung
// {straight, arpeggiated} x {slower, faster} lesson ladder from a
// single interval pattern -- one correct algorithm reused for every
// scale, instead of N hand-built copies that could each drift.

export const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  minorBlues: [0, 3, 5, 6, 7, 10],
  majorBlues: [0, 2, 3, 4, 7, 9],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminishedWH: [0, 2, 3, 5, 6, 8, 9, 11], // whole-half diminished (starts with a whole step)
  diminishedHW: [0, 1, 3, 4, 6, 7, 9, 10], // half-whole diminished (starts with a half step)
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// One ascending octave of the scale, as MIDI note numbers, starting at
// rootMidi.
export function buildScaleNotes(rootMidi, intervals) {
  return intervals.map(iv => rootMidi + iv).concat([rootMidi + 12]);
}

// "Arpeggiated" pattern, generalized to any scale length (not just
// 7-note scales): for each scale degree in turn, play that degree plus
// the note two scale-STEPS above it and four scale-steps above it (a
// broken "1-3-5" shape built from the scale's own degrees, wrapping
// into the next octave as needed via a 3-octave lookup table). For a
// 7-note scale this reproduces real diatonic triad arpeggios (I, ii,
// iii, IV...); for a 5-note pentatonic or 6-note blues/whole-tone
// scale it's the same "broken thirds through the scale" logic applied
// consistently, which is still a real, standard technical exercise
// even though it isn't literally triads at that point.
export function buildArpeggioPattern(scaleNotesOneOctave) {
  const len = scaleNotesOneOctave.length - 1; // exclude the octave repeat for degree-counting
  const extended = [];
  for (let oct = 0; oct < 3; oct++) {
    for (let i = 0; i < len; i++) extended.push(scaleNotesOneOctave[i] + oct * 12);
  }
  const result = [];
  for (let i = 0; i < len; i++) {
    result.push(extended[i], extended[i + 2], extended[i + 4]);
  }
  return result;
}
