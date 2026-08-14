// PitchLanes.js
//
// SHELL PLACEHOLDER. Once real lesson content exists, the visible set
// of lanes (which pitches, how many, note names) will be derived per
// lesson — a scale lesson shows that scale's notes, a chord lesson
// shows a chord's stack, etc. For now this is a 49-note chromatic
// keyboard (MIDI 36-84) built to keep middle C (MIDI 60, this
// KeyStep Pro unit's own "C2") sitting at the visual CENTER of the
// grid -- not just inside it somewhere. A strict 36-lane window
// (matching the KeyStep Pro's 3-octave keybed 1:1) can't do that: the
// existing genre packs already use the full 36-71 range end to end,
// and middle C (60) sits only 11 semitones from the top of that but
// 24 from the bottom, so it lands well right-of-center no matter how
// the window is framed at exactly 36 lanes. Extending the ceiling to
// 84 (symmetric: 24 lanes below 60, 24 above) fixes that without
// cutting anything the genre packs already rely on down at 36-71 --
// verified in Node against every existing pack before this change
// shipped, not assumed.
//
// Each lane: MIDI note number + display label + isBlack (for the
// grid's white/black key shading -- at this lane count, undifferentiated
// columns become hard to read at a glance, same way a real keyboard
// needs the black keys visually distinct). Exact-octave matching (per
// the earlier decision) means noteNumber is the literal value a MIDI
// note-on will be checked against later - not just a pitch class.
//
// Octave LABELS use this specific KeyStep Pro unit's own convention
// (MIDI 60 = C2, confirmed against the hardware itself -- pressing its
// middle C lights up the lane this app now labels C2), not the more
// common Yamaha/Roland convention (MIDI 60 = C4), so the on-screen key
// strip reads the same octave number as the hardware this app is
// built around. This only changes the text shown -- the underlying
// MIDI note numbers below are untouched, still the real MIDI
// standard, still what note-on messages are checked against.

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const START_NOTE = 36; // was C2 (now labeled C0) -- kept as the floor since genre packs already reach it
const LANE_COUNT = 49; // 36-84: 24 semitones below middle C, 24 above -- middle C sits dead center

// Exported so content generators (e.g. scales.js) can verify their own
// note ranges against the real keyboard bounds instead of a
// hand-copied "36-71" comment that could silently drift out of sync
// with this file.
export const LANE_MIN_MIDI = START_NOTE;
export const LANE_MAX_MIDI = START_NOTE + LANE_COUNT - 1;

function buildLanes() {
  const lanes = [];
  for (let i = 0; i < LANE_COUNT; i++) {
    const noteNumber = START_NOTE + i;
    const name = NOTE_NAMES[noteNumber % 12];
    const octave = Math.floor(noteNumber / 12) - 3; // KeyStep Pro convention: 60 = C2 (middle C)
    lanes.push({
      noteNumber,
      label: `${name}${octave}`,
      isBlack: name.includes("#")
    });
  }
  return lanes;
}

export const placeholderLanes = buildLanes();

export function getActiveLanes() {
  // Later: swap this out based on the active lesson. Kept as a function
  // (not a bare export) so callers don't need to change when that
  // happens.
  return placeholderLanes;
}
