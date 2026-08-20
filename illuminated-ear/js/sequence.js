// sequence.js
// Scale definitions and round-sequence generation. Sequences are semitone
// offsets from whatever tonic the player tuned up to — relative pitch, not
// absolute — so the game works for any voice/instrument range without the
// player needing to match a specific fixed note.

export const SCALES = [
  { id: 'major', name: 'Major (diatonic)', offsets: [0, 2, 4, 5, 7, 9, 11], desc: 'The friendliest starting point — every note is consonant against the tonic.' },
  { id: 'minor', name: 'Natural minor (diatonic)', offsets: [0, 2, 3, 5, 7, 8, 10], desc: 'Same difficulty as major, different color — good once major feels easy.' },
  { id: 'pentatonic', name: 'Major pentatonic', offsets: [0, 2, 4, 7, 9], desc: 'Only 5 notes, no half-steps at all — the gentlest possible warm-up.' },
  { id: 'chromatic', name: 'Chromatic (all 12)', offsets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], desc: 'Any of the 12 semitones — half-step neighbors included. The real test.' },
];

/**
 * Generates a sequence of `length` semitone offsets (relative to the
 * tonic) drawn from the given scale, with no immediate repeats (the same
 * degree twice in a row is a trivially easy "note" to reproduce and just
 * pads the sequence without testing anything).
 */
export function generateSequence(scale, length) {
  const seq = [];
  let prev = null;
  for (let i = 0; i < length; i++) {
    let next;
    do {
      next = scale.offsets[Math.floor(Math.random() * scale.offsets.length)];
    } while (next === prev && scale.offsets.length > 1);
    seq.push(next);
    prev = next;
  }
  return seq;
}

/** Semitone offset (0-11) of a detected frequency relative to the tonic. */
export function freqToRelativeOffset(freq, tonicFreq) {
  const semitoneDiff = 12 * Math.log2(freq / tonicFreq);
  return ((Math.round(semitoneDiff) % 12) + 12) % 12;
}
