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
    diminishedWH: [0, 2, 3, 5, 6, 8, 9, 11],
    diminishedHW: [0, 1, 3, 4, 6, 7, 9, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
export function buildScaleNotes(rootMidi, intervals) {
    return intervals.map(iv => rootMidi + iv).concat([rootMidi + 12]);
}
export function buildArpeggioPattern(scaleNotesOneOctave) {
    const len = scaleNotesOneOctave.length - 1;
    const extended = [];
    for (let oct = 0; oct < 3; oct++) {
        for (let i = 0; i < len; i++)
            extended.push(scaleNotesOneOctave[i] + oct * 12);
    }
    const result = [];
    for (let i = 0; i < len; i++) {
        result.push(extended[i], extended[i + 2], extended[i + 4]);
    }
    return result;
}
