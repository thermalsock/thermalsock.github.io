const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function spellScale(rootLetter, rootAccidental, intervals, letterOffsets) {
    const rootLetterIndex = LETTERS.indexOf(rootLetter);
    const rootSemitone = ((NATURAL_SEMITONE[rootLetter] + rootAccidental) % 12 + 12) % 12;
    return intervals.map((interval, i) => {
        const targetSemitone = (rootSemitone + interval) % 12;
        const letterOffset = letterOffsets[i];
        const letterIndex = (rootLetterIndex + letterOffset) % 7;
        const letter = LETTERS[letterIndex];
        const naturalSemitone = NATURAL_SEMITONE[letter];
        let diff = targetSemitone - naturalSemitone;
        diff = (((diff + 6) % 12) + 12) % 12 - 6;
        return { letter, accidental: diff, pitchClass: targetSemitone };
    });
}
export const LETTER_OFFSETS_HEPTATONIC = [0, 1, 2, 3, 4, 5, 6];
export const LETTER_OFFSETS_MAJOR_PENTATONIC = [0, 1, 2, 4, 5];
export const LETTER_OFFSETS_MINOR_PENTATONIC = [0, 2, 3, 4, 6];
export const LETTER_OFFSETS_MINOR_BLUES = [0, 2, 3, 4, 4, 6];
export const LETTER_OFFSETS_MAJOR_BLUES = [0, 1, 2, 2, 4, 5];
export const LETTER_OFFSETS_WHOLE_TONE = [0, 1, 2, 3, 4, 5];
export const LETTER_OFFSETS_DIMINISHED_WH = [0, 1, 2, 3, 4, 5, 5, 6];
export const LETTER_OFFSETS_DIMINISHED_HW = [0, 0, 1, 2, 3, 4, 5, 6];
export const LETTER_OFFSETS_CHROMATIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
