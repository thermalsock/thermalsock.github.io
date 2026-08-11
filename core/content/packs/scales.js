// scales.js
//
// Every Scale Trainer pack, built from the shared generator in
// ScaleTheory.js rather than hand-transcribed -- one verified
// algorithm produces the straight-scale and arpeggio note data for
// every scale here, instead of N separately hand-built copies that
// could each drift or contain a transcription error (a real class of
// bug this project has hit before with hand-written note arrays).
//
// Scale TYPES here match Berklee PULSE's real taxonomy
// (pulse.berklee.edu/scales) -- Major, Minor, Modes, Pentatonic,
// Blues, etc. are standard music-theory categories, not anyone's IP.
// That reference lists 258 individual scale pages (every type in
// every key); this pack builds out a representative, verified subset
// -- one or two keys per type -- rather than attempting all 258, with
// the generator here making it straightforward to add more later.
//
// Visual note: every pack here sets blockStyle: "square" (small
// marker blocks, not the genre packs' sustain bars) -- see
// ui/canvas/Blocks.js.

import { SCALE_INTERVALS, buildScaleNotes, buildArpeggioPattern } from "../ScaleTheory.js";
import { LANE_MIN_MIDI, LANE_MAX_MIDI } from "../../state/PitchLanes.js";
import {
  spellScale, LETTER_OFFSETS_HEPTATONIC, LETTER_OFFSETS_MAJOR_PENTATONIC,
  LETTER_OFFSETS_MINOR_PENTATONIC, LETTER_OFFSETS_MINOR_BLUES, LETTER_OFFSETS_MAJOR_BLUES,
  LETTER_OFFSETS_WHOLE_TONE, LETTER_OFFSETS_DIMINISHED_WH, LETTER_OFFSETS_DIMINISHED_HW,
  LETTER_OFFSETS_CHROMATIC
} from "../../music/ScaleSpelling.js";

const LETTER_OFFSETS_BY_INTERVAL_KEY = {
  major: LETTER_OFFSETS_HEPTATONIC,
  naturalMinor: LETTER_OFFSETS_HEPTATONIC,
  harmonicMinor: LETTER_OFFSETS_HEPTATONIC,
  dorian: LETTER_OFFSETS_HEPTATONIC,
  phrygian: LETTER_OFFSETS_HEPTATONIC,
  lydian: LETTER_OFFSETS_HEPTATONIC,
  mixolydian: LETTER_OFFSETS_HEPTATONIC,
  locrian: LETTER_OFFSETS_HEPTATONIC,
  majorPentatonic: LETTER_OFFSETS_MAJOR_PENTATONIC,
  minorPentatonic: LETTER_OFFSETS_MINOR_PENTATONIC,
  minorBlues: LETTER_OFFSETS_MINOR_BLUES,
  majorBlues: LETTER_OFFSETS_MAJOR_BLUES,
  wholeTone: LETTER_OFFSETS_WHOLE_TONE,
  diminishedWH: LETTER_OFFSETS_DIMINISHED_WH,
  diminishedHW: LETTER_OFFSETS_DIMINISHED_HW,
  chromatic: LETTER_OFFSETS_CHROMATIC
};

// Clean, uncoloured practice tone shared by every scale pack -- the
// point of a technical drill is hearing pitch/timing accuracy clearly,
// not a lush synth patch.
const PRACTICE_SYNTH_GUIDE = {
  title: "Clean Practice Tone",
  description:
    "A plain, uncoloured voice for technical practice -- the point is hearing pitch accuracy and timing clearly, not a lush pad. Fast, clean envelopes with no lingering release so one note doesn't smear into the next; minimal effects so nothing masks a wrong note.",
  osc1: { wave: "triangle", label: "Triangle — clean" },
  osc2: { wave: "triangle", label: "Triangle, +12 st — clarity" },
  mixer: { osc1: 0.85, osc2: 0.25, sub: 0.1, noise: 0 },
  filter: { drive: 0, cutoff: 0.65, resonance: 0.05 },
  ampEnv: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.1 },
  filterEnv: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.1 },
  reverb: { amount: 0.15, label: "Minimal — stay clear" },
  delay: { amount: 0, label: "Off" }
};

function noteLabel(midi) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  // KeyStep Pro convention (60 = C2, this unit's own labeling),
  // matching PitchLanes.js -- these labels sit right next to the
  // keyboard strip during gameplay, so they need the same octave
  // numbering or a block and its lane would visibly disagree about
  // what octave the note is in.
  const octave = Math.floor(midi / 12) - 3;
  return `${names[midi % 12]}${octave}`;
}

function toNoteEvents(midiNotes, beats) {
  return midiNotes.map(m => ({ label: noteLabel(m), notes: [m], beats }));
}

// Builds one complete scale pack: id/name/type plus the standard
// 4-lesson {straight, arpeggiated} x {slower, faster} ladder, from
// just a root note and an interval-pattern key. Also attaches
// `scaleSpelling` -- the correctly letter-named, octave-tagged notes
// for the notation display (see ui/canvas/ScaleNotation.js) -- derived
// from the SAME rootMidi/intervalKey so it can never drift out of sync
// with the actual playable note data above it.
function buildScalePack({ id, name, tabLabel, scaleType, rootMidi, rootLetter, rootAccidental, intervalKey, bpms }) {
  const scaleUp = buildScaleNotes(rootMidi, SCALE_INTERVALS[intervalKey]);
  const scaleDown = [...scaleUp].reverse().slice(1); // back down, skip repeating the top note
  const straightPattern = [...scaleUp, ...scaleDown];
  const arpeggioPattern = buildArpeggioPattern(scaleUp);

  // scaleUp has one extra note (the octave repeat) beyond what
  // spellScale needs -- spelling only covers one octave's worth of
  // distinct degrees, matching the reference notation image (a single
  // ascending octave per scale, not the octave note repeated).
  const intervals = SCALE_INTERVALS[intervalKey];
  const letterOffsets = LETTER_OFFSETS_BY_INTERVAL_KEY[intervalKey];
  const spelling = spellScale(rootLetter, rootAccidental, intervals, letterOffsets);
  const scaleSpelling = spelling.map((s, i) => ({
    letter: s.letter,
    accidental: s.accidental,
    octave: Math.floor(scaleUp[i] / 12) - 1,
    midi: scaleUp[i]
  }));

  return {
    id, name, tabLabel,
    category: "scales",
    scaleType,
    blockStyle: "square",
    scaleSpelling,
    description: `A 4-rung technical ladder on ${name}: straight scale up/down at an easy tempo, the same pattern faster, then broken-thirds arpeggios through the scale at a moderate tempo, then the same arpeggios faster again.`,
    synthGuide: PRACTICE_SYNTH_GUIDE,
    lessons: [
      {
        id: id + "-easy", title: "Easy — Scale", bpm: bpms.easy,
        concept: `${name}, straight up and back down, one note per beat. Slow tempo, stepwise motion only -- the starting point every other lesson in this ladder builds on.`,
        chords: toNoteEvents(straightPattern, 1)
      },
      {
        id: id + "-medium", title: "Medium — Scale", bpm: bpms.medium,
        concept: `The exact same up-and-down ${name} as the Easy lesson -- same notes, same pattern -- just faster.`,
        chords: toNoteEvents(straightPattern, 1)
      },
      {
        id: id + "-hard", title: "Hard — Arpeggios", bpm: bpms.hard,
        concept: `${name} broken into quick 3-note groups built from each scale degree in turn, rather than played stepwise -- a classic 'arpeggiate through the scale' technical exercise.`,
        chords: toNoteEvents(arpeggioPattern, 0.5)
      },
      {
        id: id + "-difficult", title: "Difficult — Arpeggios", bpm: bpms.difficult,
        concept: `The exact same broken arpeggios as the Hard lesson, at a genuinely fast tempo. If this feels controlled, the easier three lessons should feel easy.`,
        chords: toNoteEvents(arpeggioPattern, 0.5)
      }
    ]
  };
}

const STANDARD_BPMS = { easy: 70, medium: 100, hard: 110, difficult: 150 };

const NATURAL_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function letterToMidi(letter, accidental, octave) {
  return (octave + 1) * 12 + (((NATURAL_SEMITONE[letter] + accidental) % 12) + 12) % 12;
}

// All 12 chromatic pitch classes, one spelling each (the common
// convention -- flats for the "flat side" of the circle of fifths,
// sharps for the "sharp side" -- matching how Berklee's own reference
// spells its 12 base keys, before their few enharmonic-duplicate pages
// like C#/Gb/Cb which are the exact same pitches under a different
// name and are skipped here as genuinely redundant).
const TWELVE_ROOTS = [
  { letter: "C", accidental: 0, name: "C" },
  { letter: "D", accidental: -1, name: "Db" },
  { letter: "D", accidental: 0, name: "D" },
  { letter: "E", accidental: -1, name: "Eb" },
  { letter: "E", accidental: 0, name: "E" },
  { letter: "F", accidental: 0, name: "F" },
  { letter: "F", accidental: 1, name: "F#" },
  { letter: "G", accidental: 0, name: "G" },
  { letter: "A", accidental: -1, name: "Ab" },
  { letter: "A", accidental: 0, name: "A" },
  { letter: "B", accidental: -1, name: "Bb" },
  { letter: "B", accidental: 0, name: "B" }
];

// All 18 of Berklee PULSE's scale-type categories (pulse.berklee.edu/
// scales) -- `label` here is an abbreviated form used to build each
// pack's display name (kept short so e.g. "Db Major Blues" stays well
// under the ~20-char safety margin verified for the Pack Selector box
// elsewhere in this app); the FULL label lives in ContentState.js's
// SCALE_TYPES for the type-picker itself, which has more room.
const SCALE_TYPE_DEFS = [
  { key: "major", intervalKey: "major", label: "Major" },
  { key: "minor", intervalKey: "naturalMinor", label: "Minor" },
  { key: "harmonicMinor", intervalKey: "harmonicMinor", label: "Harm Minor" },
  { key: "ionian", intervalKey: "major", label: "Ionian" },
  { key: "dorian", intervalKey: "dorian", label: "Dorian" },
  { key: "phrygian", intervalKey: "phrygian", label: "Phrygian" },
  { key: "lydian", intervalKey: "lydian", label: "Lydian" },
  { key: "mixolydian", intervalKey: "mixolydian", label: "Mixolydian" },
  { key: "aeolian", intervalKey: "naturalMinor", label: "Aeolian" },
  { key: "locrian", intervalKey: "locrian", label: "Locrian" },
  { key: "majorPentatonic", intervalKey: "majorPentatonic", label: "Maj Pent" },
  { key: "minorPentatonic", intervalKey: "minorPentatonic", label: "Min Pent" },
  { key: "majorBlues", intervalKey: "majorBlues", label: "Major Blues" },
  { key: "minorBlues", intervalKey: "minorBlues", label: "Minor Blues" },
  { key: "wholeTone", intervalKey: "wholeTone", label: "Whole Tone" },
  { key: "diminishedWH", intervalKey: "diminishedWH", label: "Dim W-H" },
  { key: "diminishedHW", intervalKey: "diminishedHW", label: "Dim H-W" },
  { key: "chromatic", intervalKey: "chromatic", label: "Chromatic" }
];

// Root octave used to be fixed at 2 for every key. Moved up toward
// middle C (verified in Node, not assumed): for each root, this tries
// octave 3 first -- checking the STRAIGHT pattern AND the arpeggio
// pattern (which reaches further above the root than the straight
// scale does) across every one of the 16 interval sets, so a root
// only moves up if every scale/arpeggio built on it still lands
// entirely inside the real lane range (checked against
// LANE_MIN_MIDI/LANE_MAX_MIDI, not a hand-copied number, so this
// stays correct if PitchLanes.js's range ever changes again). Now
// that the keyboard extends to MIDI 84, all 12 keys clear octave 3;
// octave 2 is kept as a fallback only in case a future lane-range
// change tightens things back up.
function fitsInLaneRange(rootMidi) {
  return Object.values(SCALE_INTERVALS).every(intervals => {
    const scaleUp = buildScaleNotes(rootMidi, intervals);
    const arp = buildArpeggioPattern(scaleUp);
    return [...scaleUp, ...arp].every(n => n >= LANE_MIN_MIDI && n <= LANE_MAX_MIDI);
  });
}

function chooseRootOctave(letter, accidental) {
  const higherOctaveMidi = letterToMidi(letter, accidental, 3);
  return fitsInLaneRange(higherOctaveMidi) ? 3 : 2;
}

// The full matrix: 12 keys x 18 types = 216 packs, every one built
// through the same verified generator (buildScalePack) and the same
// verified spelling algorithm (ScaleSpelling.js) as the original 8 --
// no hand-transcription anywhere in this expansion, which is what
// makes 216 packs tractable to generate correctly at all.
export const allScalePacks = [];

SCALE_TYPE_DEFS.forEach(typeDef => {
  TWELVE_ROOTS.forEach(root => {
    const rootOctave = chooseRootOctave(root.letter, root.accidental);
    const rootMidi = letterToMidi(root.letter, root.accidental, rootOctave);
    const rootSlug = root.name.toLowerCase().replace("#", "sharp");
    const id = `scale-${rootSlug}-${typeDef.key.toLowerCase()}`;
    const name = `${root.name} ${typeDef.label}`;

    allScalePacks.push(buildScalePack({
      id,
      name,
      tabLabel: name,
      scaleType: typeDef.key,
      rootMidi,
      rootLetter: root.letter,
      rootAccidental: root.accidental,
      intervalKey: typeDef.intervalKey,
      bpms: STANDARD_BPMS
    }));
  });
});
