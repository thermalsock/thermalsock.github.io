const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

const CHORD_SHAPES = [ {
  intervals: [ 7 ],
  suffix: "5"
}, {
  intervals: [ 3 ],
  suffix: "m"
}, {
  intervals: [ 4 ],
  suffix: ""
}, {
  intervals: [ 5 ],
  suffix: "(4th)"
}, {
  intervals: [ 2 ],
  suffix: "(2nd)"
}, {
  intervals: [ 3, 7 ],
  suffix: "m"
}, {
  intervals: [ 4, 7 ],
  suffix: ""
}, {
  intervals: [ 2, 7 ],
  suffix: "sus2"
}, {
  intervals: [ 5, 7 ],
  suffix: "sus4"
}, {
  intervals: [ 3, 7, 10 ],
  suffix: "m7"
}, {
  intervals: [ 4, 7, 10 ],
  suffix: "7"
}, {
  intervals: [ 4, 7, 11 ],
  suffix: "maj7"
}, {
  intervals: [ 3, 7, 11 ],
  suffix: "mMaj7"
}, {
  intervals: [ 4, 7, 9 ],
  suffix: "6"
}, {
  intervals: [ 3, 7, 9 ],
  suffix: "m6"
}, {
  intervals: [ 4, 9 ],
  suffix: "6"
}, {
  intervals: [ 3, 9 ],
  suffix: "m6"
}, {
  intervals: [ 2, 4, 7 ],
  suffix: "add9"
}, {
  intervals: [ 2, 3, 7 ],
  suffix: "m(add9)"
} ];

function intervalKey(intervals) {
  return intervals.slice().sort((a, b) => a - b).join(",");
}

const SHAPE_LOOKUP = new Map(CHORD_SHAPES.map(s => [ intervalKey(s.intervals), s.suffix ]));

export function detectChordName(midiNotes) {
  const unique = [ ...new Set(midiNotes) ].sort((a, b) => a - b);
  if (unique.length === 0) return null;
  if (unique.length === 1) return NOTE_NAMES[(unique[0] % 12 + 12) % 12];
  const root = unique[0];
  const rootName = NOTE_NAMES[(root % 12 + 12) % 12];
  const intervals = [ ...new Set(unique.slice(1).map(n => ((n - root) % 12 + 12) % 12)) ].filter(iv => iv !== 0);
  const suffix = SHAPE_LOOKUP.get(intervalKey(intervals));
  if (suffix !== undefined) return rootName + suffix;
  return unique.map(n => NOTE_NAMES[(n % 12 + 12) % 12]).join(" ");
}