import { notesToMidi } from "../NoteUtils.js";
function chord(label, noteList, beats = 4) {
    return { label, notes: notesToMidi(noteList), beats };
}
export const dronePack = {
    id: "drone",
    name: "Drone",
    tabLabel: "Drone",
    category: "genres",
    bpm: 50,
    description: "Harmony built from a single sustained fundamental and the overtone series above it, introduced one partial at a time -- extremely slow, extremely long-held. The genre's core discipline: patience and sustain, not chord vocabulary.",
    synthGuide: {
        title: "Static Fundamental Drone",
        description: "A pure, minimally-moving voice built for very long holds. Sine waves keep the fundamental clean; OSC2 a fifth above echoes the overtone series itself. Keep drive near zero and resonance low -- nothing here should draw attention to itself. An extremely slow amp attack (near a swell) and a release that barely ever finishes give the sense of a tone that's always been sounding and always will be; vast reverb does the rest.",
        osc1: { wave: "sine", label: "Sine — fundamental" },
        osc2: { wave: "sine", label: "Sine, +7 st — 3rd harmonic" },
        mixer: { osc1: 0.9, osc2: 0.5, sub: 0.2, noise: 0.05 },
        filter: { drive: 0.05, cutoff: 0.45, resonance: 0.1 },
        ampEnv: { attack: 0.9, decay: 0.2, sustain: 0.95, release: 0.95 },
        filterEnv: { attack: 0.85, decay: 0.3, sustain: 0.6, release: 0.9 },
        reverb: { amount: 0.8, label: "Vast space, near-infinite tail" },
        delay: { amount: 0.1, label: "Minimal — sustain carries this, not repeats" }
    },
    lessons: [
        {
            id: "drone-single-fundamental",
            title: "Single Fundamental",
            concept: "The most basic drone discipline: hold ONE note, nothing else, for a genuinely long time. No melody, no chord change -- just sustaining a single pitch cleanly for its full written length. This is harder than it sounds on a real synth (steady hand, steady breath if you're also riding a mod wheel), and it's the foundation everything else in this pack builds on.",
            chords: [
                chord("C (fundamental)", [["C", 3]], 16)
            ]
        },
        {
            id: "drone-octave-overtone",
            title: "Octave Overtone",
            concept: "The first real overtone above any fundamental is its own octave (the 2nd harmonic). Here the fundamental holds alone first, then the octave above is added on top of the still-sounding root -- a slow, simple thickening rather than a new chord. Both notes need to stay down together once the octave enters.",
            chords: [
                chord("C (fundamental)", [["C", 3]], 8),
                chord("C + C (octave)", [["C", 3], ["C", 4]], 8)
            ]
        },
        {
            id: "drone-fifth-overtone",
            title: "Fifth Overtone",
            concept: "Building up the harmonic series in order: fundamental, then the octave (2nd harmonic), then the fifth above that (3rd harmonic) -- the fifth is the purest, most consonant interval a drone can add after the octave itself. Each addition holds everything already sounding underneath it.",
            chords: [
                chord("C (fundamental)", [["C", 3]], 8),
                chord("C + C (octave)", [["C", 3], ["C", 4]], 8),
                chord("C + C + G (fifth)", [["C", 3], ["C", 4], ["G", 4]], 8)
            ]
        },
        {
            id: "drone-third-overtone",
            title: "Third Overtone",
            concept: "Continuing the harmonic series: fundamental, octave, fifth, and now a major third above the octave. NOTE: real drone composers working in true just intonation tune this third noticeably flatter than a tempered keyboard can -- what you're playing here is the closest a standard 12-tone synth gets, not the 'pure' ratio. The concept (build a chord one overtone at a time) transfers regardless.",
            chords: [
                chord("C (fundamental)", [["C", 3]], 8),
                chord("C + C (octave)", [["C", 3], ["C", 4]], 8),
                chord("C + C + G (fifth)", [["C", 3], ["C", 4], ["G", 4]], 8),
                chord("C + C + G + E (third)", [["C", 3], ["C", 4], ["G", 4], ["E", 4]], 8)
            ]
        },
        {
            id: "drone-slow-fundamental-shift",
            title: "Fundamental Shift",
            concept: "The one thing a 'pure' drone eventually does: the fundamental itself moves -- just once, and very slowly. Sixteen full beats on C, then a shift down a whole step to Bb held for sixteen more, then back to C. 'Extremely gradual change' is the entire genre philosophy in one exercise.",
            chords: [
                chord("C", [["C", 3]], 16),
                chord("Bb", [["Bb", 2]], 16),
                chord("C", [["C", 3]], 16)
            ]
        },
        {
            id: "drone-layered-chord",
            title: "Layered Drone Chord",
            concept: "Everything from this pack combined into one sustained chord: fundamental, octave, fifth, third, and a gentle major 6th on top for colour -- held for a genuinely long stretch (24 beats) as a closing exercise in full-chord sustain. This is the hold-tracking engine's real test: every note needs to stay down, accurately, for the entire duration.",
            chords: [
                chord("C + C + G + E + A", [["C", 3], ["C", 4], ["G", 4], ["E", 4], ["A", 4]], 24)
            ]
        }
    ]
};
