// ambientHouse.js
//
// ORIGINAL content pack, built from genuine documented ambient-house
// conventions: warm extended chords (maj7/9/add9), sparse melodic
// motifs that prioritize atmosphere over dancefloor intensity, warm
// sub-bass, and dub-style short chord stabs that let delay/reverb do
// the work. No specific track is being transcribed; these are
// original exercises written to teach real, documented genre
// technique.

import { notesToMidi } from "../NoteUtils.js";

function chord(label, noteList, beats = 4) {
  return { label, notes: notesToMidi(noteList), beats };
}

function rest(beats) {
  return { label: "— rest —", notes: [], beats };
}

export const ambientHousePack = {
  id: "ambient-house",
  name: "Ambient House",
  tabLabel: "Amb House",
  category: "genres",
  bpm: 112,
  description:
    "Warm extended chords, sparse melodic motifs, dub-style short stabs that let delay and reverb carry the space, and warm sub-bass -- the harmonic language of ambient house's chill-out-room sound.",

  synthGuide: {
    title: "Airy Dub Pad",
    description:
      "A warm body with an airy top layer -- OSC2 an octave up, sine for a clean shimmer rather than a buzzy one. Sub oscillator adds the warm low end the genre leans on. A moderate attack keeps chords feeling soft without going full ambient-pad-glacial; dub-style delay is doing real production work here, not just decoration.",
    osc1: { wave: "saw", label: "Saw — warm body" },
    osc2: { wave: "sine", label: "Sine, +12 st — airy top" },
    mixer: { osc1: 0.8, osc2: 0.45, sub: 0.35, noise: 0.05 },
    filter: { drive: 0.1, cutoff: 0.5, resonance: 0.15 },
    ampEnv: { attack: 0.25, decay: 0.3, sustain: 0.7, release: 0.55 },
    filterEnv: { attack: 0.2, decay: 0.35, sustain: 0.5, release: 0.5 },
    reverb: { amount: 0.55, label: "Warm plate, moderate tail" },
    delay: { amount: 0.5, label: "Dub-style 1/4 note, feeds the space" }
  },

  lessons: [
    {
      id: "ambhouse-warm-maj7-pad",
      title: "Warm Maj7 Pad",
      concept:
        "A lush, warm four-chord bed built entirely from extended chords: Am7, Fmaj7, Cmaj7, Gadd9. The extra colour tones (7ths, 9ths) are what separate this warm 'airy pad' sound from a plain triad progression -- every chord has at least one note beyond the basic root-3rd-5th.",
      chords: [
        chord("Am7", [["A", 3], ["C", 4], ["E", 4], ["G", 4]], 4),
        chord("Fmaj7", [["F", 3], ["A", 3], ["C", 4], ["E", 4]], 4),
        chord("Cmaj7", [["C", 3], ["E", 3], ["G", 3], ["B", 3]], 4),
        chord("Gadd9", [["G", 3], ["B", 3], ["D", 4], ["A", 4]], 4)
      ]
    },

    {
      id: "ambhouse-dub-chord-stab",
      title: "Dub Chord Stab",
      concept:
        "The same four chords as the previous lesson, but played completely differently: a single short hit, then three full beats of silence before the next one. In real dub-influenced production, that silence is where a long delay and reverb tail does the actual work -- you play short and let the space repeat and decay the chord for you, rather than holding it yourself.",
      // The whole point of this lesson is a short, percussive hit
      // followed by delay/reverb doing the sustaining -- overrides the
      // pack's held-pad envelope for something that actually behaves
      // like a stab.
      synthGuide: {
        ampEnv: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2 },
        filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.25 },
        delay: { amount: 0.75, label: "Long dub delay — this IS the lesson" },
        reverb: { amount: 0.6, label: "Spring-style dub reverb" }
      },
      chords: [
        chord("Am7 (stab)", [["A", 3], ["C", 4], ["E", 4], ["G", 4]], 1),
        rest(3),
        chord("Fmaj7 (stab)", [["F", 3], ["A", 3], ["C", 4], ["E", 4]], 1),
        rest(3),
        chord("Cmaj7 (stab)", [["C", 3], ["E", 3], ["G", 3], ["B", 3]], 1),
        rest(3),
        chord("Gadd9 (stab)", [["G", 3], ["B", 3], ["D", 4], ["A", 4]], 1),
        rest(3)
      ]
    },

    {
      id: "ambhouse-sparse-motif",
      title: "Sparse Motif",
      concept:
        "A melodic motif built almost as much from silence as from notes -- 'sparse melodic motifs that prioritize atmosphere over dancefloor intensity' is a direct genre convention. Five notes, generous rests between the first three, and a long final note to let it settle.",
      chords: [
        chord("C", [["C", 4]], 2),
        rest(2),
        chord("E", [["E", 4]], 2),
        rest(2),
        chord("G", [["G", 4]], 2),
        chord("D", [["D", 4]], 2),
        chord("C", [["C", 4]], 4)
      ]
    },

    {
      id: "ambhouse-sub-bass-warmth",
      title: "Sub Bass Warmth",
      concept:
        "The same root motion as the Warm Maj7 Pad lesson (A, F, C, G), played here as a pure sub-bass line -- long, legato, warm notes rather than the choppy chromatic movement of a different genre's bassline. Warm sub-bass under airy pads is the genre's low-end signature.",
      chords: [
        chord("A (bass)", [["A", 2]], 4),
        chord("F (bass)", [["F", 2]], 4),
        chord("C (bass)", [["C", 2]], 4),
        chord("G (bass)", [["G", 2]], 4)
      ]
    },

    {
      id: "ambhouse-extended-9th-colour",
      title: "Extended 9th Colour",
      concept:
        "Three add9 chords in a row -- Cadd9, Fadd9, Gadd9 -- isolating the 9th-chord sound on its own so it's easy to hear exactly what that added colour tone contributes versus a plain triad. Compare this to the Warm Maj7 Pad lesson's Gadd9 to hear the same chord type in two different contexts.",
      chords: [
        chord("Cadd9", [["C", 3], ["E", 3], ["G", 3], ["D", 4]], 4),
        chord("Fadd9", [["F", 3], ["A", 3], ["C", 4], ["G", 4]], 4),
        chord("Gadd9", [["G", 3], ["B", 3], ["D", 4], ["A", 4]], 4)
      ]
    },

    {
      id: "ambhouse-full-progression",
      title: "Full Progression",
      concept:
        "Everything from this pack combined: the Warm Maj7 Pad's four chords, but now each voiced with its own bass note built into the same hand shape (Am7 with A in the bass, Fmaj7 with F in the bass, and so on) rather than a separate bass part. One continuous 8-chord cycle -- the pad and the sub-bass lesson, unified into a single real progression.",
      chords: [
        chord("Am7 (full)", [["A", 2], ["C", 4], ["E", 4], ["G", 4]], 4),
        chord("Fmaj7 (full)", [["F", 2], ["A", 3], ["C", 4], ["E", 4]], 4),
        chord("Cmaj7 (full)", [["C", 2], ["E", 3], ["G", 3], ["B", 3]], 4),
        chord("Gadd9 (full)", [["G", 2], ["B", 3], ["D", 4], ["A", 4]], 4),
        chord("Am7 (full)", [["A", 2], ["C", 4], ["E", 4], ["G", 4]], 4),
        chord("Fmaj7 (full)", [["F", 2], ["A", 3], ["C", 4], ["E", 4]], 4),
        chord("Cmaj7 (full)", [["C", 2], ["E", 3], ["G", 3], ["B", 3]], 4),
        chord("Gadd9 (full)", [["G", 2], ["B", 3], ["D", 4], ["A", 4]], 4)
      ]
    }
  ]
};
