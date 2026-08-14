// hauntologyFifths.js
//
// DE-IDENTIFIED CONTENT PACK. Originally built directly from a real
// artist's discography (chord symbols only, sourced from a published
// theory analysis) -- reworked here into a genre-level "Hauntology"
// pack: real music theory and real harmonic techniques, no lesson
// titles or descriptions tied to a specific artist/track/album. The
// underlying chord SYMBOLS and progressions are unchanged (those are
// factual/analytical, not anyone's copyrighted expression) -- only
// the naming and prose around them changed.
//
// Hauntology is a real, broadly-used genre term (not attached to one
// artist) for the tape-decay, half-remembered-childhood-TV aesthetic
// this fifths-based harmonic language is strongly associated with.
//
// Chord voicings (octave placement) are this app's own choice, kept
// within the 36-lane C2-B4 keyboard range, exact-octave matching per
// the earlier engine decision.

import { notesToMidi } from "../NoteUtils.js";

function chord(label, noteList, beats = 4) {
  return { label, notes: notesToMidi(noteList), beats };
}

// A silent gap -- no notes to play, just a hold. bars is in 4/4 bars
// (4 beats each).
function rest(bars = 1) {
  return { label: "— rest —", notes: [], beats: bars * 4 };
}

export const hauntologyFifthsPack = {
  id: "hauntology-fifths",
  name: "Hauntology Fifths",
  tabLabel: "Haunt 1",
  category: "genres",
  bpm: 88,
  description:
    "The genre's signature sound: root + perfect fifth dyads (no third, so neither major nor minor), stacked and superimposed over moving bass notes -- the harmonic backbone of tape-warped, half-remembered hauntology writing.",

  // A static reference patch, not a functional preset -- see
  // ui/canvas/SynthGuide.js. Built from a single monophonic voice: tune
  // a second oscillator seven semitones above the first, and every
  // note you play sounds as a fifth automatically.
  synthGuide: {
    title: "Fifths Synth Patch",
    description:
      "Tune OSC2 seven semitones above OSC1 and every key you press sounds as a fifth dyad on its own -- no need to hand-play two-note chords. Keep the filter fairly closed for a soft, rounded tone; a slow amp attack and long release let chords bloom and fade instead of snapping in and out.",
    osc1: { wave: "saw", label: "Saw — root" },
    osc2: { wave: "saw", label: "Saw, +7 st — the fifth" },
    mixer: { osc1: 0.8, osc2: 0.8, sub: 0, noise: 0 },
    filter: { drive: 0.15, cutoff: 0.3, resonance: 0.15 },
    ampEnv: { attack: 0.35, decay: 0.25, sustain: 0.75, release: 0.65 },
    filterEnv: { attack: 0.3, decay: 0.4, sustain: 0.35, release: 0.5 },
    reverb: { amount: 0.5, label: "Medium hall, long tail" },
    delay: { amount: 0.2, label: "Subtle, low feedback" }
  },

  lessons: [
    {
      id: "haunt-fifths-drill",
      title: "Fifth Dyads",
      concept:
        "The core hauntology interval: root + perfect fifth (7 semitones), no third. Ambiguous — neither major nor minor. This drill moves the shape up a C major scale, root by root, so the SHAPE stays fixed while your hand relocates it — a movable synth-patch interval rather than a scale-bound chord.",
      chords: [
        chord("C5", [["C", 3], ["G", 3]]),
        chord("D5", [["D", 3], ["A", 3]]),
        chord("E5", [["E", 3], ["B", 3]]),
        chord("F5", [["F", 3], ["C", 4]]),
        chord("G5", [["G", 3], ["D", 4]]),
        chord("A5", [["A", 3], ["E", 4]]),
        chord("B5", [["B", 3], ["F#", 4]]),
        chord("C5", [["C", 4], ["G", 4]])
      ]
    },

    {
      id: "haunt-faded-fifths",
      title: "Faded Fifths",
      concept:
        "A real fifths progression, all dyads, no bass note tricks yet — just the pure ambiguous fifths sound moving freely between unrelated roots (Bb, G, D, F don't share one key). This isn't a simple loop: the real structure is a 4-chord phrase played three times with a shrinking gap after it each time, and the THIRD time drops the first chord entirely — a deliberately uneven 16-bar phrase (6 + 5 + 5 bars) rather than a predictable 4-bar loop.",
      chords: [
        // Repeat 1: full 4-chord phrase + 2-bar gap = 6 bars
        chord("Bb5", [["Bb", 3], ["F", 4]]),
        chord("G5", [["G", 3], ["D", 4]]),
        chord("D5", [["D", 3], ["A", 3]]),
        chord("F5", [["F", 3], ["C", 4]]),
        rest(2),
        // Repeat 2: full 4-chord phrase + 1-bar gap = 5 bars
        chord("Bb5", [["Bb", 3], ["F", 4]]),
        chord("G5", [["G", 3], ["D", 4]]),
        chord("D5", [["D", 3], ["A", 3]]),
        chord("F5", [["F", 3], ["C", 4]]),
        rest(1),
        // Repeat 3: Bb5 OMITTED this time + 2-bar gap = 5 bars
        chord("G5", [["G", 3], ["D", 4]]),
        chord("D5", [["D", 3], ["A", 3]]),
        chord("F5", [["F", 3], ["C", 4]]),
        rest(2)
        // Total: 6 + 5 + 5 = 16 bars.
      ]
    },

    {
      id: "haunt-anchored-fifths",
      title: "Anchored Fifths",
      concept:
        "Five fifths descending through unrelated roots, written to be played over a single held drone note in the bass (try holding a low A underneath). One of the five chords matches that drone and lands with resolution; the rest don't match it at all and sit uneasy against it — that tension against a fixed anchor is a core hauntology device.",
      chords: [
        chord("B5", [["B", 3], ["F#", 4]]),
        chord("G5", [["G", 3], ["D", 4]]),
        chord("E5", [["E", 3], ["B", 3]]),
        chord("C5", [["C", 3], ["G", 3]]),
        chord("A5", [["A", 2], ["E", 3]])
      ]
    },

    {
      id: "haunt-slow-bloom-pad",
      title: "Slow Bloom Pad",
      concept:
        "Same fifths concept as an ambient pad idea (long attack/release) rather than a plucked riff — a six-chord phrase with a bassline that just follows each chord's own root note, the simplest possible bass choice under a fifths progression.",
      // Long attack and release envelopes -- this lesson genuinely
      // needs a slower, more reverb-drenched vibe than the pack
      // default rather than reusing it.
      synthGuide: {
        ampEnv: { attack: 0.6, decay: 0.3, sustain: 0.85, release: 0.85 },
        filterEnv: { attack: 0.55, decay: 0.35, sustain: 0.5, release: 0.8 },
        reverb: { amount: 0.7, label: "Large hall, very long tail" },
        delay: { amount: 0.1, label: "Off — reverb carries this one" }
      },
      chords: [
        chord("F5", [["F", 3], ["C", 4]]),
        chord("A5", [["A", 3], ["E", 4]]),
        chord("E5", [["E", 3], ["B", 3]]),
        chord("B5", [["B", 3], ["F#", 4]]),
        chord("G5", [["G", 3], ["D", 4]]),
        chord("E5", [["E", 3], ["B", 3]])
      ]
    },

    {
      id: "haunt-wandering-bass",
      title: "Wandering Bass",
      concept:
        "The bass note doesn't have to match the chord's root. Here the top-line dyads are D5 | G5 | Bb5 | E5, but the bassline moves stepwise D→C→Bb instead of jumping D→G→Bb. Putting a C bass under the G5 dyad turns it into a G5/C — which, played as one hand shape, is really a Csus2 chord (C, G, D). Same notes, different function, purely from which note is in the bass. Slash chords like this are how the genre gets fresh colour without leaving the fifths language.",
      chords: [
        chord("D5", [["D", 3], ["A", 3]]),
        chord("G5/C  (= Csus2)", [["C", 3], ["G", 3], ["D", 4]]),
        chord("Bb5", [["Bb", 3], ["F", 4]]),
        chord("E5", [["E", 3], ["B", 3]])
      ]
    },

    {
      id: "haunt-stacked-fifths",
      title: "Stacked Fifths",
      concept:
        "Play two fifths dyads at once and you get a genuinely new chord type for free. A5 (A,E) stacked with C5 (C,G) below gives you C,E,G,A — a C6 chord, with the A as the 'colourful' sixth. Then a Bb bass note anchors the next two chords: first under the C5 dyad (its own related colour, not literally a named chord), then under the F5 dyad — THAT one (Bb,C,F) is a genuine Bbsus2, the same slash-chord trick as Wandering Bass, just with a fixed bass instead of a moving one.",
      chords: [
        chord("E5", [["E", 3], ["B", 3]]),
        chord("G5", [["G", 3], ["D", 4]]),
        chord("A5 + C5 below  (= C6)", [["C", 3], ["E", 3], ["G", 3], ["A", 3]]),
        chord("C5/Bb", [["Bb", 2], ["C", 3], ["G", 3]]),
        chord("F5/Bb  (= Bbsus2)", [["Bb", 2], ["F", 3], ["C", 4]])
      ]
    },

    {
      id: "haunt-bass-note-colours",
      title: "Bass Note Colours",
      concept:
        "The same C5 dyad (C, G) gets a completely different character depending purely on the bass note under it. Four options, same two-note shape on top: root (plain C5), the 4th below (Fsus2 sound), the flat 3rd below (Eb6 sound), and the 5th below (barely changes at all). This is the whole 'harmonic colour from bass choice' idea in one drill — internalize these four and you can recolour any fifths progression.",
      // This drill is explicitly about the BASS note, so it gets its
      // own bass-oriented patch (sub-heavy, dark, punchy) instead of
      // reusing the pack's pad-voiced fifths default.
      synthGuide: {
        mixer: { osc1: 0.9, osc2: 0.3, sub: 0.6, noise: 0 },
        filter: { drive: 0.35, cutoff: 0.18, resonance: 0.25 },
        ampEnv: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.15 },
        filterEnv: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.2 },
        reverb: { amount: 0.15, label: "Minimal — keeps the bass tight" },
        delay: { amount: 0.05, label: "Off" }
      },
      chords: [
        chord("C5 (root in bass)", [["C", 3], ["G", 3]]),
        chord("C5/F (Fsus2 sound)", [["F", 2], ["C", 3], ["G", 3]]),
        chord("C5/Eb (Eb6 sound)", [["Eb", 2], ["C", 3], ["G", 3]]),
        chord("C5/G (5th in bass, same sound)", [["G", 2], ["C", 3], ["G", 3]])
      ]
    },

    {
      id: "haunt-moving-sus2",
      title: "Moving Sus2 Shape",
      concept:
        "A sus2 chord (root, 2nd, 5th — two fifths stacked) played as one fixed hand shape and simply transposed around: Bbsus2, then down to Gbsus2, then Ebsus2. No voice leading, no reharmonizing — just relocate the same shape. This 'move the shape, don't reconsider the harmony' approach is a distinct genre technique from the moving-bass-note tricks in the earlier lessons. Each chord here holds for 2 bars, not 1.",
      // A moving, repeating shape reads better as a plucky lead than
      // the pack's slow ambient pad default -- brighter filter,
      // quicker envelopes, and delay carrying the repetition instead
      // of reverb.
      synthGuide: {
        filter: { drive: 0.15, cutoff: 0.5, resonance: 0.25 },
        ampEnv: { attack: 0.05, decay: 0.35, sustain: 0.4, release: 0.3 },
        filterEnv: { attack: 0.05, decay: 0.3, sustain: 0.3, release: 0.25 },
        reverb: { amount: 0.35, label: "Short room — tighter than the pad patch" },
        delay: { amount: 0.4, label: "1/8 note, syncopated feel" }
      },
      chords: [
        chord("Bbsus2", [["Bb", 2], ["C", 3], ["F", 3]], 8),
        chord("Gbsus2", [["Gb", 2], ["Ab", 2], ["Db", 3]], 8),
        chord("Ebsus2", [["Eb", 2], ["F", 2], ["Bb", 2]], 8)
      ]
    }
  ]
};
