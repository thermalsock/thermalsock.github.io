import { notesToMidi } from "../NoteUtils.js";
function chord(label, noteList, beats = 4) {
    return { label, notes: notesToMidi(noteList), beats };
}
export const psybientPack = {
    id: "psybient",
    name: "Psybient",
    tabLabel: "Psybient",
    category: "genres",
    bpm: 80,
    description: "Modal harmony over slow harmonic rhythm: Dorian, Phrygian, and Mixolydian colour, sustained chordal beds held for bars at a time, and an oriental-tinged scale for melodic motifs -- the harmonic language of psybient/psychill.",
    synthGuide: {
        title: "Modal Drone Pad",
        description: "A warm, slowly-evolving pad built for long-held modal chords. OSC2 an octave up adds airy shimmer without fighting the fundamental. Keep the filter warm and fairly closed, with a slow filter envelope so the tone itself breathes over each held chord; huge reverb and long delay build the immersive, spacious feel the genre is built on.",
        osc1: { wave: "saw", label: "Saw — body" },
        osc2: { wave: "triangle", label: "Triangle, +12 st — shimmer" },
        mixer: { osc1: 0.85, osc2: 0.4, sub: 0.3, noise: 0.1 },
        filter: { drive: 0.1, cutoff: 0.35, resonance: 0.2 },
        ampEnv: { attack: 0.6, decay: 0.3, sustain: 0.8, release: 0.85 },
        filterEnv: { attack: 0.5, decay: 0.4, sustain: 0.5, release: 0.75 },
        reverb: { amount: 0.75, label: "Huge space, long tail" },
        delay: { amount: 0.5, label: "Long, feeds the atmosphere" }
    },
    lessons: [
        {
            id: "psy-dorian-foundations",
            title: "Dorian Foundations",
            concept: "D Dorian's defining feature is a raised 6th (B natural, not Bb) -- which makes the IV chord (G major) come out major even though the mode itself feels minor. That 'bright IV inside a minor mode' is the single most identifiable modal-psybient move: i (Dm) to IV (G) and back, both diatonic to the same mode, no borrowed notes needed. Each chord held a full 2 bars -- slow harmonic rhythm is the point, let it breathe.",
            chords: [
                chord("Dm (i)", [["D", 3], ["F", 3], ["A", 3]], 8),
                chord("G (IV)", [["G", 3], ["B", 3], ["D", 4]], 8),
                chord("Dm (i)", [["D", 3], ["F", 3], ["A", 3]], 8),
                chord("G (IV)", [["G", 3], ["B", 3], ["D", 4]], 8)
            ]
        },
        {
            id: "psy-phrygian-cadence",
            title: "Phrygian Cadence",
            concept: "E Phrygian's defining feature is a flattened 2nd (F natural sitting a half-step above the root) -- the bII chord (F major) built on that note is the classic 'exotic'/Spanish-tinged Phrygian cadence, a mainstay of psytrance-adjacent writing. i (Em) to bII (F) and back, half-step tension resolving down to the tonic.",
            chords: [
                chord("Em (i)", [["E", 3], ["G", 3], ["B", 3]], 8),
                chord("F (bII)", [["F", 3], ["A", 3], ["C", 4]], 8),
                chord("Em (i)", [["E", 3], ["G", 3], ["B", 3]], 8)
            ]
        },
        {
            id: "psy-mixolydian-drift",
            title: "Mixolydian Drift",
            concept: "G Mixolydian's defining feature is a flattened 7th (F natural instead of F#) -- the bVII chord (F major) built on that note gives the genre's characteristic 'drifting, never quite resolving' quality, since F never pulls back to G the way a leading-tone F# would. I (G) to bVII (F) and back, an open, unresolved loop rather than a cadence.",
            chords: [
                chord("G (I)", [["G", 3], ["B", 3], ["D", 4]], 8),
                chord("F (bVII)", [["F", 3], ["A", 3], ["C", 4]], 8),
                chord("G (I)", [["G", 3], ["B", 3], ["D", 4]], 8),
                chord("F (bVII)", [["F", 3], ["A", 3], ["C", 4]], 8)
            ]
        },
        {
            id: "psy-slow-harmonic-bed",
            title: "Slow Harmonic Bed",
            concept: "Extended 7th chords, one change every 2 bars -- 'let chords breathe for multiple bars' is a direct genre convention, not just a suggestion. Dm7 to Cmaj7 and back: the two chords share two common tones (F and A stay put, only the root and one other voice move), so the transition feels like a slow tilt rather than a jump.",
            chords: [
                chord("Dm7", [["D", 3], ["F", 3], ["A", 3], ["C", 4]], 8),
                chord("Cmaj7", [["C", 3], ["E", 3], ["G", 3], ["B", 3]], 8),
                chord("Dm7", [["D", 3], ["F", 3], ["A", 3], ["C", 4]], 8),
                chord("Cmaj7", [["C", 3], ["E", 3], ["G", 3], ["B", 3]], 8)
            ]
        },
        {
            id: "psy-phrygian-dominant-motif",
            title: "Phrygian Dominant",
            bpm: 100,
            concept: "The scale behind the genre's 'oriental'-tinged leads: E Phrygian dominant (E F G# A B C D) -- Phrygian's flat 2nd combined with a RAISED 3rd, creating a distinctive augmented-2nd gap between F and G#. That gap is what gives the scale its unmistakable Middle-Eastern/Indian-adjacent character. Played here as a simple ascending-then-descending motif, one note per step -- a melodic drill, not a chord drill.",
            chords: [
                chord("E", [["E", 3]], 2),
                chord("F", [["F", 3]], 2),
                chord("G#", [["G#", 3]], 2),
                chord("A", [["A", 3]], 2),
                chord("B", [["B", 3]], 2),
                chord("C", [["C", 4]], 2),
                chord("D", [["D", 4]], 2),
                chord("E", [["E", 4]], 2),
                chord("D", [["D", 4]], 2),
                chord("C", [["C", 4]], 2),
                chord("B", [["B", 3]], 2),
                chord("A", [["A", 3]], 2),
                chord("G#", [["G#", 3]], 2),
                chord("F", [["F", 3]], 2),
                chord("E", [["E", 3]], 4)
            ]
        },
        {
            id: "psy-full-modal-drone",
            title: "Full Modal Drone",
            concept: "The Dorian Foundations technique extended into a 3-chord loop: i (Dm) to IV (G) to bVII (C) and back to i -- all three chords diatonic to D Dorian, none of them borrowed. This is the genre's non-functional harmony in full: no dominant-to-tonic pull anywhere in the loop, just modal colour drifting between three related chords, built to run indefinitely.",
            chords: [
                chord("Dm (i)", [["D", 3], ["F", 3], ["A", 3]], 8),
                chord("G (IV)", [["G", 3], ["B", 3], ["D", 4]], 8),
                chord("C (bVII)", [["C", 3], ["E", 3], ["G", 3]], 8),
                chord("Dm (i)", [["D", 3], ["F", 3], ["A", 3]], 8)
            ]
        }
    ]
};
