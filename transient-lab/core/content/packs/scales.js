import { SCALE_INTERVALS, buildScaleNotes, buildArpeggioPattern } from "../ScaleTheory.js";

import { LANE_MIN_MIDI, LANE_MAX_MIDI } from "../../state/PitchLanes.js";

import { spellScale, LETTER_OFFSETS_HEPTATONIC, LETTER_OFFSETS_MAJOR_PENTATONIC, LETTER_OFFSETS_MINOR_PENTATONIC, LETTER_OFFSETS_MINOR_BLUES, LETTER_OFFSETS_MAJOR_BLUES, LETTER_OFFSETS_WHOLE_TONE, LETTER_OFFSETS_DIMINISHED_WH, LETTER_OFFSETS_DIMINISHED_HW, LETTER_OFFSETS_CHROMATIC } from "../../music/ScaleSpelling.js";

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

const PRACTICE_SYNTH_GUIDE = {
  title: "Clean Practice Tone",
  description: "A plain, uncoloured voice for technical practice -- the point is hearing pitch accuracy and timing clearly, not a lush pad. Fast, clean envelopes with no lingering release so one note doesn't smear into the next; minimal effects so nothing masks a wrong note.",
  osc1: {
    wave: "triangle",
    label: "Triangle — clean"
  },
  osc2: {
    wave: "triangle",
    label: "Triangle, +12 st — clarity"
  },
  mixer: {
    osc1: .85,
    osc2: .25,
    sub: .1,
    noise: 0
  },
  filter: {
    drive: 0,
    cutoff: .65,
    resonance: .05
  },
  ampEnv: {
    attack: .02,
    decay: .15,
    sustain: .6,
    release: .1
  },
  filterEnv: {
    attack: .02,
    decay: .15,
    sustain: .6,
    release: .1
  },
  reverb: {
    amount: .15,
    label: "Minimal — stay clear"
  },
  delay: {
    amount: 0,
    label: "Off"
  }
};

function noteLabel(midi) {
  const names = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
  const octave = Math.floor(midi / 12) - 3;
  return `${names[midi % 12]}${octave}`;
}

function toNoteEvents(midiNotes, beats) {
  return midiNotes.map(m => ({
    label: noteLabel(m),
    notes: [ m ],
    beats: beats
  }));
}

function buildScalePack({id: id, name: name, tabLabel: tabLabel, scaleType: scaleType, rootMidi: rootMidi, rootLetter: rootLetter, rootAccidental: rootAccidental, intervalKey: intervalKey, bpms: bpms}) {
  const scaleUp = buildScaleNotes(rootMidi, SCALE_INTERVALS[intervalKey]);
  const scaleDown = [ ...scaleUp ].reverse().slice(1);
  const straightPattern = [ ...scaleUp, ...scaleDown ];
  const arpeggioPattern = buildArpeggioPattern(scaleUp);
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
    id: id,
    name: name,
    tabLabel: tabLabel,
    category: "scales",
    scaleType: scaleType,
    blockStyle: "square",
    scaleSpelling: scaleSpelling,
    description: `A 4-rung technical ladder on ${name}: straight scale up/down at an easy tempo, the same pattern faster, then broken-thirds arpeggios through the scale at a moderate tempo, then the same arpeggios faster again.`,
    synthGuide: PRACTICE_SYNTH_GUIDE,
    lessons: [ {
      id: id + "-easy",
      title: "Easy — Scale",
      bpm: bpms.easy,
      concept: `${name}, straight up and back down, one note per beat. Slow tempo, stepwise motion only -- the starting point every other lesson in this ladder builds on.`,
      chords: toNoteEvents(straightPattern, 1)
    }, {
      id: id + "-medium",
      title: "Medium — Scale",
      bpm: bpms.medium,
      concept: `The exact same up-and-down ${name} as the Easy lesson -- same notes, same pattern -- just faster.`,
      chords: toNoteEvents(straightPattern, 1)
    }, {
      id: id + "-hard",
      title: "Hard — Arpeggios",
      bpm: bpms.hard,
      concept: `${name} broken into quick 3-note groups built from each scale degree in turn, rather than played stepwise -- a classic 'arpeggiate through the scale' technical exercise.`,
      chords: toNoteEvents(arpeggioPattern, .5)
    }, {
      id: id + "-difficult",
      title: "Difficult — Arpeggios",
      bpm: bpms.difficult,
      concept: `The exact same broken arpeggios as the Hard lesson, at a genuinely fast tempo. If this feels controlled, the easier three lessons should feel easy.`,
      chords: toNoteEvents(arpeggioPattern, .5)
    } ]
  };
}

const STANDARD_BPMS = {
  easy: 70,
  medium: 100,
  hard: 110,
  difficult: 150
};

const NATURAL_SEMITONE = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

function letterToMidi(letter, accidental, octave) {
  return (octave + 1) * 12 + ((NATURAL_SEMITONE[letter] + accidental) % 12 + 12) % 12;
}

const TWELVE_ROOTS = [ {
  letter: "C",
  accidental: 0,
  name: "C"
}, {
  letter: "D",
  accidental: -1,
  name: "Db"
}, {
  letter: "D",
  accidental: 0,
  name: "D"
}, {
  letter: "E",
  accidental: -1,
  name: "Eb"
}, {
  letter: "E",
  accidental: 0,
  name: "E"
}, {
  letter: "F",
  accidental: 0,
  name: "F"
}, {
  letter: "F",
  accidental: 1,
  name: "F#"
}, {
  letter: "G",
  accidental: 0,
  name: "G"
}, {
  letter: "A",
  accidental: -1,
  name: "Ab"
}, {
  letter: "A",
  accidental: 0,
  name: "A"
}, {
  letter: "B",
  accidental: -1,
  name: "Bb"
}, {
  letter: "B",
  accidental: 0,
  name: "B"
} ];

const SCALE_TYPE_DEFS = [ {
  key: "major",
  intervalKey: "major",
  label: "Major"
}, {
  key: "minor",
  intervalKey: "naturalMinor",
  label: "Minor"
}, {
  key: "harmonicMinor",
  intervalKey: "harmonicMinor",
  label: "Harm Minor"
}, {
  key: "ionian",
  intervalKey: "major",
  label: "Ionian"
}, {
  key: "dorian",
  intervalKey: "dorian",
  label: "Dorian"
}, {
  key: "phrygian",
  intervalKey: "phrygian",
  label: "Phrygian"
}, {
  key: "lydian",
  intervalKey: "lydian",
  label: "Lydian"
}, {
  key: "mixolydian",
  intervalKey: "mixolydian",
  label: "Mixolydian"
}, {
  key: "aeolian",
  intervalKey: "naturalMinor",
  label: "Aeolian"
}, {
  key: "locrian",
  intervalKey: "locrian",
  label: "Locrian"
}, {
  key: "majorPentatonic",
  intervalKey: "majorPentatonic",
  label: "Maj Pent"
}, {
  key: "minorPentatonic",
  intervalKey: "minorPentatonic",
  label: "Min Pent"
}, {
  key: "majorBlues",
  intervalKey: "majorBlues",
  label: "Major Blues"
}, {
  key: "minorBlues",
  intervalKey: "minorBlues",
  label: "Minor Blues"
}, {
  key: "wholeTone",
  intervalKey: "wholeTone",
  label: "Whole Tone"
}, {
  key: "diminishedWH",
  intervalKey: "diminishedWH",
  label: "Dim W-H"
}, {
  key: "diminishedHW",
  intervalKey: "diminishedHW",
  label: "Dim H-W"
}, {
  key: "chromatic",
  intervalKey: "chromatic",
  label: "Chromatic"
} ];

function fitsInLaneRange(rootMidi) {
  return Object.values(SCALE_INTERVALS).every(intervals => {
    const scaleUp = buildScaleNotes(rootMidi, intervals);
    const arp = buildArpeggioPattern(scaleUp);
    return [ ...scaleUp, ...arp ].every(n => n >= LANE_MIN_MIDI && n <= LANE_MAX_MIDI);
  });
}

function chooseRootOctave(letter, accidental) {
  const higherOctaveMidi = letterToMidi(letter, accidental, 3);
  return fitsInLaneRange(higherOctaveMidi) ? 3 : 2;
}

export const allScalePacks = [];

SCALE_TYPE_DEFS.forEach(typeDef => {
  TWELVE_ROOTS.forEach(root => {
    const rootOctave = chooseRootOctave(root.letter, root.accidental);
    const rootMidi = letterToMidi(root.letter, root.accidental, rootOctave);
    const rootSlug = root.name.toLowerCase().replace("#", "sharp");
    const id = `scale-${rootSlug}-${typeDef.key.toLowerCase()}`;
    const name = `${root.name} ${typeDef.label}`;
    allScalePacks.push(buildScalePack({
      id: id,
      name: name,
      tabLabel: name,
      scaleType: typeDef.key,
      rootMidi: rootMidi,
      rootLetter: root.letter,
      rootAccidental: root.accidental,
      intervalKey: typeDef.intervalKey,
      bpms: STANDARD_BPMS
    }));
  });
});