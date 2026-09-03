const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

const START_NOTE = 36;

const LANE_COUNT = 49;

export const LANE_MIN_MIDI = START_NOTE;

export const LANE_MAX_MIDI = START_NOTE + LANE_COUNT - 1;

function buildLanes() {
  const lanes = [];
  for (let i = 0; i < LANE_COUNT; i++) {
    const noteNumber = START_NOTE + i;
    const name = NOTE_NAMES[noteNumber % 12];
    const octave = Math.floor(noteNumber / 12) - 3;
    lanes.push({
      noteNumber: noteNumber,
      label: `${name}${octave}`,
      isBlack: name.includes("#")
    });
  }
  return lanes;
}

export const placeholderLanes = buildLanes();

export function getActiveLanes() {
  return placeholderLanes;
}