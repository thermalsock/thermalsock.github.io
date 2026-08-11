const SEMITONE = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
    "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};
export function noteToMidi(name, octave) {
    if (!(name in SEMITONE)) {
        throw new Error(`NoteUtils: unknown note name "${name}"`);
    }
    return (octave + 1) * 12 + SEMITONE[name];
}
export function notesToMidi(noteList) {
    return noteList.map(([name, octave]) => noteToMidi(name, octave));
}
