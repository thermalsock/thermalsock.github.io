// ChordDetector.js
//
// Turns a set of currently-held MIDI note numbers into a readable
// chord name -- e.g. [60,67] -> "C5", [60,63,67] -> "Cm". Pure
// function, no state, so it's directly testable without any audio/MIDI
// plumbing.
//
// Approach: lowest held note is treated as the root (a reasonable
// default for how this app's own content is voiced -- basslines and
// dyads are consistently written bass-note-first). Every other note's
// interval above the root (mod 12, deduped) is looked up against a
// table of known chord shapes. This deliberately covers exactly the
// chord vocabulary this app's own lesson content uses (5ths, minor
// dyads, sus2/sus4, 6th, m6, maj7, dom7, add9) -- verified against real
// lesson data, not just invented in the abstract.
//
// KNOWN LIMITATION, stated plainly: proper slash-chord/inversion
// detection (e.g. correctly reading C,G#,B,D# as "G#m/C#" rather than
// trying to root a chord on C#) is a harder problem this doesn't
// attempt. An unrecognized interval set falls back to listing the
// actual note names rather than guessing at a wrong chord name.

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Each entry: sorted, deduped intervals above the root (root itself
// excluded) -> the chord symbol suffix to append after the root name.
const CHORD_SHAPES = [
  { intervals: [7], suffix: "5" },              // power chord / bare fifth
  { intervals: [3], suffix: "m" },               // bare minor third (dyad, no 5th)
  { intervals: [4], suffix: "" },                // bare major third (dyad, no 5th)
  { intervals: [5], suffix: "(4th)" },           // bare fourth
  { intervals: [2], suffix: "(2nd)" },           // bare second
  { intervals: [3, 7], suffix: "m" },
  { intervals: [4, 7], suffix: "" },             // plain major triad, no suffix
  { intervals: [2, 7], suffix: "sus2" },
  { intervals: [5, 7], suffix: "sus4" },
  { intervals: [3, 7, 10], suffix: "m7" },
  { intervals: [4, 7, 10], suffix: "7" },
  { intervals: [4, 7, 11], suffix: "maj7" },
  { intervals: [3, 7, 11], suffix: "mMaj7" },
  { intervals: [4, 7, 9], suffix: "6" },
  { intervals: [3, 7, 9], suffix: "m6" },
  { intervals: [4, 9], suffix: "6" },   // 6th chord voiced without the 5th (root+3rd+6th) -- the article itself calls this "Eb6" even though it's a 3-note voicing
  { intervals: [3, 9], suffix: "m6" },  // minor sibling of the above, not in this app's content yet but the same reasoning applies
  { intervals: [2, 4, 7], suffix: "add9" },
  { intervals: [2, 3, 7], suffix: "m(add9)" }
];

function intervalKey(intervals) {
  return intervals.slice().sort((a, b) => a - b).join(",");
}

const SHAPE_LOOKUP = new Map(CHORD_SHAPES.map(s => [intervalKey(s.intervals), s.suffix]));

export function detectChordName(midiNotes) {
  const unique = [...new Set(midiNotes)].sort((a, b) => a - b);
  if (unique.length === 0) return null;
  if (unique.length === 1) return NOTE_NAMES[((unique[0] % 12) + 12) % 12];

  const root = unique[0];
  const rootName = NOTE_NAMES[((root % 12) + 12) % 12];

  const intervals = [...new Set(
    unique.slice(1).map(n => (((n - root) % 12) + 12) % 12)
  )].filter(iv => iv !== 0);

  const suffix = SHAPE_LOOKUP.get(intervalKey(intervals));
  if (suffix !== undefined) return rootName + suffix;

  // Unrecognized shape -- list the real note names rather than guess.
  return unique.map(n => NOTE_NAMES[((n % 12) + 12) % 12]).join(" ");
}
