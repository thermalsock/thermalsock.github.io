import { notesToMidi } from "../NoteUtils.js";
function chord(label, noteList, beats = 4) {
    return { label, notes: notesToMidi(noteList), beats };
}
export const hauntologyColourPack = {
    id: "hauntology-colour",
    name: "Hauntology Colour",
    tabLabel: "Haunt 2",
    category: "genres",
    bpm: 92,
    description: "Beyond fifths: writing exclusively with major or minor triads, add9/sus4 colour tones, parallel major/minor mixing, stacking shapes into richer chords, and chromatic bass movement.",
    synthGuide: {
        title: "Bright Add9 Lead/Pad",
        description: "A brighter, more melodic voice for this pack's add9 leads and major/minor triads. OSC2 an octave up adds an airy shimmer on top of OSC1's body. Open the filter further than the fifths patch and add a touch of resonance for bite; a quicker amp attack suits the lead material while the longer filter release keeps pad chords feeling smooth.",
        osc1: { wave: "square", label: "Square — body" },
        osc2: { wave: "triangle", label: "Triangle, +12 st — shimmer" },
        mixer: { osc1: 0.85, osc2: 0.5, sub: 0.15, noise: 0.05 },
        filter: { drive: 0.3, cutoff: 0.55, resonance: 0.3 },
        ampEnv: { attack: 0.15, decay: 0.3, sustain: 0.6, release: 0.45 },
        filterEnv: { attack: 0.2, decay: 0.35, sustain: 0.4, release: 0.4 },
        reverb: { amount: 0.4, label: "Small room, moderate tail" },
        delay: { amount: 0.35, label: "1/8 note, moderate feedback" }
    },
    lessons: [
        {
            id: "haunt2-fixed-top-note",
            title: "Fixed Top Note",
            concept: "A progression built entirely from major triads that don't belong to one key (G, E, B) — non-diatonic, with no obvious 'home' chord. What glues it together: every chord is voiced with the same B on top, so the ear tracks that fixed note while everything underneath changes. That's voice leading without needing a shared scale.",
            chords: [
                chord("G major", [["G", 3], ["D", 4], ["B", 4]]),
                chord("E major", [["E", 3], ["G#", 3], ["B", 4]]),
                chord("B major", [["B", 3], ["D#", 4], ["F#", 4], ["B", 4]])
            ]
        },
        {
            id: "haunt2-borrowed-major",
            title: "Borrowed Major",
            concept: "Another major-only, non-diatonic progression: Eb | F | C. The key is F major, making the opening Eb a borrowed bVII chord. F and C additionally share a top note of C for voice leading. A melody can sidestep the note-clash problem entirely by sticking to the F major PENTATONIC scale (F G A C D) — it drops the two notes (B and E) that would clash against the non-diatonic Eb chord, so every melody note works over every chord regardless of the odd harmony underneath.",
            scaleNotes: notesToMidi([["F", 3], ["G", 3], ["A", 3], ["C", 4], ["D", 4]]),
            chords: [
                chord("Eb major", [["Eb", 3], ["G", 3], ["Bb", 3]]),
                chord("F major", [["F", 3], ["A", 3], ["C", 4]]),
                chord("C major", [["E", 3], ["G", 3], ["C", 4]])
            ]
        },
        {
            id: "haunt2-minor-dyads",
            title: "Minor Dyads",
            concept: "The minor-chord counterpart to the major-only idea above: an all-minor progression (Am | Cm | Gm | Am) in the key of A minor, played as bare root+minor-3rd dyads (no fifth at all) — the minor-third interval alone is enough to read as 'minor'. Same 'one interval, movable shape' philosophy as the fifths lessons, just a different interval doing the work. Gloomy and downbeat by design.",
            synthGuide: {
                mixer: { osc1: 0.85, osc2: 0.3, sub: 0.15, noise: 0.05 },
                filter: { drive: 0.2, cutoff: 0.25, resonance: 0.2 },
                ampEnv: { attack: 0.5, decay: 0.3, sustain: 0.6, release: 0.7 },
                filterEnv: { attack: 0.45, decay: 0.35, sustain: 0.4, release: 0.65 },
                reverb: { amount: 0.55, label: "Dark hall, damp tone" },
                delay: { amount: 0.15, label: "Minimal" }
            },
            chords: [
                chord("Am (dyad)", [["A", 3], ["C", 4]]),
                chord("Cm (dyad)", [["C", 4], ["Eb", 4]]),
                chord("Gm (dyad)", [["G", 3], ["Bb", 3]]),
                chord("Am (dyad)", [["A", 3], ["C", 4]])
            ]
        },
        {
            id: "haunt2-borrowed-minor",
            title: "Borrowed Minor",
            concept: "A minor-chord progression in C# minor, with one borrowed chord: G#m over a C# bass. That's the exact same trick as the previous lesson (a minor chord built a minor third above the home root) but here it's a full triad over a held bass note instead of a bare dyad — same idea, richer voicing, eerie quality.",
            synthGuide: {
                mixer: { osc1: 0.85, osc2: 0.35, sub: 0.1, noise: 0.05 },
                filter: { drive: 0.25, cutoff: 0.22, resonance: 0.35 },
                ampEnv: { attack: 0.4, decay: 0.35, sustain: 0.55, release: 0.75 },
                filterEnv: { attack: 0.35, decay: 0.4, sustain: 0.35, release: 0.7 },
                reverb: { amount: 0.6, label: "Long, dark reverb" },
                delay: { amount: 0.2, label: "Slow, subtle" }
            },
            chords: [
                chord("C#m", [["C#", 3], ["E", 3], ["G#", 3]]),
                chord("G#m/C#", [["C#", 3], ["G#", 3], ["B", 3], ["D#", 4]]),
                chord("Em", [["E", 3], ["G", 3], ["B", 3]]),
                chord("F#m", [["F#", 3], ["A", 3], ["C#", 4]]),
                chord("C#m", [["C#", 3], ["E", 3], ["G#", 3]])
            ]
        },
        {
            id: "haunt2-add9-lead",
            title: "Add9 Lead",
            concept: "Add9 chords (root, 3rd, 5th, 9th) moved around as one fixed shape — F#add9 | Aadd9 | Eadd9 | Badd9, no voice leading, just the same colourful voicing transposed. In B major, the Aadd9 is a borrowed bVII, the same non-diatonic trick as the Borrowed Major lesson's opening chord.",
            chords: [
                chord("F#add9", [["F#", 3], ["A#", 3], ["C#", 4], ["G#", 4]]),
                chord("Aadd9", [["A", 3], ["C#", 4], ["E", 4], ["B", 4]]),
                chord("Eadd9", [["E", 3], ["G#", 3], ["B", 3], ["F#", 4]]),
                chord("Badd9", [["B", 3], ["C#", 4], ["D#", 4], ["F#", 4]])
            ]
        },
        {
            id: "haunt2-parallel-major-minor",
            title: "Parallel Maj/Min",
            concept: "Shape-shifting between F major and F minor — 'parallel keys', major and minor sharing the same root. The progression is F | F | Ebsus4 | Eb: the sus4-to-major move on the last two chords (Ebsus4 resolving to Eb) briefly suspends the 3rd before landing, a classic tension-and-release colour inside an otherwise ambiguous major/minor progression.",
            chords: [
                chord("F major", [["F", 3], ["A", 3], ["C", 4]]),
                chord("F major", [["F", 3], ["A", 3], ["C", 4]]),
                chord("Ebsus4", [["Eb", 3], ["Ab", 3], ["Bb", 3]]),
                chord("Eb major", [["Eb", 3], ["G", 3], ["Bb", 3]])
            ]
        },
        {
            id: "haunt2-automatic-harmony",
            title: "Automatic Harmony",
            concept: "The stacking trick from the Fifths pack's Stacked Fifths lesson, generalized: play a simple 3-note chord and a fifth interval together and you land on a recognizable, richer chord name for free — no need to think in chord theory while playing. A + E becomes Asus2 (A, B, E). C + A becomes C6 (C, E, G, A). C + E becomes Cmaj7 (C, E, G, B). Same two ingredients each time (a chord shape + a fifth), three different results depending which notes you pick.",
            synthGuide: {
                ampEnv: { attack: 0.7, decay: 0.4, sustain: 0.8, release: 0.9 },
                filterEnv: { attack: 0.6, decay: 0.5, sustain: 0.5, release: 0.8 },
                filter: { drive: 0.15, cutoff: 0.4, resonance: 0.15 },
                reverb: { amount: 0.85, label: "Huge hall, very long tail" },
                delay: { amount: 0.6, label: "Long, high feedback — go big here" }
            },
            chords: [
                chord("Asus2 (from A + E)", [["A", 3], ["B", 3], ["E", 4]]),
                chord("C6 (from C + A)", [["C", 3], ["E", 3], ["G", 3], ["A", 3]]),
                chord("Cmaj7 (from C + E)", [["C", 3], ["E", 3], ["G", 3], ["B", 3]])
            ]
        },
        {
            id: "haunt2-chromatic-bassline",
            title: "Chromatic Bassline",
            concept: "No chords at all here — just a bare chromatic bassline: F, a half-step below (E), a half-step above (Gb), then back to F. No harmony to lean on means fewer clash risks for a melody on top, but the bass movement alone carries real tension. A pure single-note bassline exercise, exactly the muscle this app is built to train.",
            synthGuide: {
                mixer: { osc1: 0.9, osc2: 0.2, sub: 0.7, noise: 0 },
                filter: { drive: 0.4, cutoff: 0.15, resonance: 0.2 },
                ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.12 },
                filterEnv: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.15 },
                reverb: { amount: 0.1, label: "Minimal — keep the bass tight and dry" },
                delay: { amount: 0.05, label: "Off" }
            },
            chords: [
                chord("F (bass)", [["F", 2]], 2),
                chord("E (bass)", [["E", 2]], 2),
                chord("Gb (bass)", [["Gb", 2]], 2),
                chord("F (bass)", [["F", 2]], 2)
            ]
        }
    ]
};
