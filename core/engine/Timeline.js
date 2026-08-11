import { BEATS_VISIBLE } from "../state/Layout.js";
const LEAD_IN_BEATS = BEATS_VISIBLE;
export function buildTimeline(lesson) {
    let cursor = LEAD_IN_BEATS;
    const events = lesson.chords.map((chord, chordIndex) => {
        const event = {
            chordIndex,
            label: chord.label,
            notes: chord.notes,
            hitBeat: cursor,
            beats: chord.beats
        };
        cursor += chord.beats;
        return event;
    });
    return { events, totalBeats: cursor };
}
export function findCurrentEventIndex(timeline, currentBeat) {
    const events = timeline.events;
    let currentIndex = -1;
    for (let i = 0; i < events.length; i++) {
        if (events[i].hitBeat <= currentBeat)
            currentIndex = i;
        else
            break;
    }
    return currentIndex;
}
