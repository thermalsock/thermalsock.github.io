import { hauntologyFifthsPack } from "../content/packs/hauntologyFifths.js";
import { hauntologyColourPack } from "../content/packs/hauntologyColour.js";
import { psybientPack } from "../content/packs/psybient.js";
import { dronePack } from "../content/packs/drone.js";
import { ambientHousePack } from "../content/packs/ambientHouse.js";
import { allScalePacks } from "../content/packs/scales.js";
export const allPacks = [
    hauntologyFifthsPack, hauntologyColourPack, psybientPack, dronePack, ambientHousePack,
    ...allScalePacks
];
const DEFAULT_BPM = 90;
export const SCALE_TYPES = [
    { key: "major", label: "Major" },
    { key: "minor", label: "Minor" },
    { key: "harmonicMinor", label: "Harmonic Minor" },
    { key: "ionian", label: "Ionian" },
    { key: "dorian", label: "Dorian" },
    { key: "phrygian", label: "Phrygian" },
    { key: "lydian", label: "Lydian" },
    { key: "mixolydian", label: "Mixolydian" },
    { key: "aeolian", label: "Aeolian" },
    { key: "locrian", label: "Locrian" },
    { key: "majorPentatonic", label: "Major Pentatonic" },
    { key: "minorPentatonic", label: "Minor Pentatonic" },
    { key: "majorBlues", label: "Major Blues" },
    { key: "minorBlues", label: "Minor Blues" },
    { key: "wholeTone", label: "Whole Tone" },
    { key: "diminishedWH", label: "Diminished W-H" },
    { key: "diminishedHW", label: "Diminished H-W" },
    { key: "chromatic", label: "Chromatic" }
];
export const contentState = {
    contentCategory: "genres",
    scaleTypeIndex: 0,
    packIndex: 0,
    lessonIndex: 0,
    chordIndex: 0,
    scaleTypeDropdownOpen: false,
    packDropdownOpen: false,
    lessonDropdownOpen: false
};
export function getActiveScaleType() {
    return SCALE_TYPES[contentState.scaleTypeIndex];
}
export function getAvailablePacks() {
    let packs = allPacks.filter(p => p.category === contentState.contentCategory);
    if (contentState.contentCategory === "scales") {
        const typeKey = getActiveScaleType().key;
        packs = packs.filter(p => p.scaleType === typeKey);
    }
    return packs;
}
export function setContentCategory(category) {
    if (category !== "genres" && category !== "scales")
        return;
    if (contentState.contentCategory === category)
        return;
    contentState.contentCategory = category;
    contentState.scaleTypeIndex = 0;
    contentState.packIndex = 0;
    contentState.lessonIndex = 0;
    contentState.chordIndex = 0;
    contentState.scaleTypeDropdownOpen = false;
    contentState.packDropdownOpen = false;
    contentState.lessonDropdownOpen = false;
}
export function selectScaleType(index) {
    if (index < 0 || index >= SCALE_TYPES.length)
        return;
    contentState.scaleTypeIndex = index;
    contentState.packIndex = 0;
    contentState.lessonIndex = 0;
    contentState.chordIndex = 0;
    contentState.scaleTypeDropdownOpen = false;
}
export function toggleScaleTypeDropdown() {
    contentState.scaleTypeDropdownOpen = !contentState.scaleTypeDropdownOpen;
    if (contentState.scaleTypeDropdownOpen) {
        contentState.packDropdownOpen = false;
        contentState.lessonDropdownOpen = false;
    }
}
export function closeScaleTypeDropdown() {
    contentState.scaleTypeDropdownOpen = false;
}
export function getActivePack() {
    const packs = getAvailablePacks();
    return packs[contentState.packIndex] || packs[0];
}
export function getActiveLesson() {
    return getActivePack().lessons[contentState.lessonIndex];
}
export function getActiveChord() {
    return getActiveLesson().chords[contentState.chordIndex];
}
export function getUsedNotesForActiveLesson() {
    const lesson = getActiveLesson();
    const used = new Set();
    lesson.chords.forEach(c => c.notes.forEach(n => used.add(n)));
    return used;
}
export function getEffectiveSynthGuide() {
    const pack = getActivePack();
    const lesson = getActiveLesson();
    return { ...(pack.synthGuide || {}), ...(lesson.synthGuide || {}) };
}
export function getEffectiveBpm() {
    const pack = getActivePack();
    const lesson = getActiveLesson();
    return lesson.bpm ?? pack.bpm ?? DEFAULT_BPM;
}
export function nextChord() {
    const lesson = getActiveLesson();
    contentState.chordIndex = (contentState.chordIndex + 1) % lesson.chords.length;
}
export function prevChord() {
    const lesson = getActiveLesson();
    contentState.chordIndex =
        (contentState.chordIndex - 1 + lesson.chords.length) % lesson.chords.length;
}
export function nextLesson() {
    const pack = getActivePack();
    contentState.lessonIndex = (contentState.lessonIndex + 1) % pack.lessons.length;
    contentState.chordIndex = 0;
}
export function prevLesson() {
    const pack = getActivePack();
    contentState.lessonIndex =
        (contentState.lessonIndex - 1 + pack.lessons.length) % pack.lessons.length;
    contentState.chordIndex = 0;
}
export function selectLesson(index) {
    const pack = getActivePack();
    if (index < 0 || index >= pack.lessons.length)
        return;
    contentState.lessonIndex = index;
    contentState.chordIndex = 0;
    contentState.lessonDropdownOpen = false;
}
export function selectPack(index) {
    const packs = getAvailablePacks();
    if (index < 0 || index >= packs.length)
        return;
    contentState.packIndex = index;
    contentState.lessonIndex = 0;
    contentState.chordIndex = 0;
    contentState.packDropdownOpen = false;
}
export function togglePackDropdown() {
    contentState.packDropdownOpen = !contentState.packDropdownOpen;
    if (contentState.packDropdownOpen) {
        contentState.scaleTypeDropdownOpen = false;
        contentState.lessonDropdownOpen = false;
    }
}
export function closePackDropdown() {
    contentState.packDropdownOpen = false;
}
export function toggleLessonDropdown() {
    contentState.lessonDropdownOpen = !contentState.lessonDropdownOpen;
    if (contentState.lessonDropdownOpen) {
        contentState.scaleTypeDropdownOpen = false;
        contentState.packDropdownOpen = false;
    }
}
export function closeLessonDropdown() {
    contentState.lessonDropdownOpen = false;
}
export function nextPack() {
    const packs = getAvailablePacks();
    contentState.packIndex = (contentState.packIndex + 1) % packs.length;
    contentState.lessonIndex = 0;
    contentState.chordIndex = 0;
}
