// NoteUtils.js
//
// Content files are far more readable written as note names ("Bb3")
// than raw MIDI numbers, but the judgement engine (and PitchLanes.js)
// need exact MIDI note numbers, per the earlier exact-octave decision.
// This is the one place that conversion happens, so content authors
// never hand-compute a MIDI number and content data never drifts from
// what the engine will actually check against.

const SEMITONE = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

// e.g. noteToMidi("Bb", 3) -> 58. Octave uses the same convention as
// PitchLanes.js (MIDI 60 = C4).
export function noteToMidi(name, octave) {
  if (!(name in SEMITONE)) {
    throw new Error(`NoteUtils: unknown note name "${name}"`);
  }
  return (octave + 1) * 12 + SEMITONE[name];
}

// Convenience for chord/lesson data: takes [["Bb",3], ["F",4]] and
// returns [58, 65]. Keeps content files declarative — a chord is just
// a list of [name, octave] pairs, not manually-computed numbers.
export function notesToMidi(noteList) {
  return noteList.map(([name, octave]) => noteToMidi(name, octave));
}
