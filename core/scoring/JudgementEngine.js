export const HIT_WINDOW_BEATS = 0.35;
export const RELEASE_TOLERANCE_BEATS = 0.25;
const LOG_RETENTION_BEATS = 16;
let activeTimeline = null;
let noteSpans = [];
let onsetJudgements = [];
let holdJudgements = [];
export function resetForTimeline(timeline) {
    activeTimeline = timeline;
    noteSpans = [];
    onsetJudgements = timeline.events.map(() => "pending");
    holdJudgements = timeline.events.map(() => "n/a");
}
function pruneSpans(nowBeat) {
    noteSpans = noteSpans.filter(span => {
        const anchor = span.offBeat !== null ? span.offBeat : span.onBeat;
        return anchor >= nowBeat - LOG_RETENTION_BEATS;
    });
}
export function registerNoteOn(noteNumber, beat) {
    const stillOpen = noteSpans.find(s => s.noteNumber === noteNumber && s.offBeat === null);
    if (stillOpen)
        stillOpen.offBeat = beat;
    noteSpans.push({ noteNumber, onBeat: beat, offBeat: null });
    pruneSpans(beat);
}
export function registerNoteOff(noteNumber, beat) {
    const openSpan = [...noteSpans].reverse().find(s => s.noteNumber === noteNumber && s.offBeat === null);
    if (openSpan)
        openSpan.offBeat = beat;
    pruneSpans(beat);
    if (!activeTimeline)
        return;
    activeTimeline.events.forEach((event, i) => {
        if (onsetJudgements[i] !== "hit")
            return;
        if (holdJudgements[i] !== "pending")
            return;
        if (!event.notes.includes(noteNumber))
            return;
        const expectedRelease = event.hitBeat + event.beats;
        if (beat < expectedRelease - RELEASE_TOLERANCE_BEATS) {
            holdJudgements[i] = "dropped";
        }
    });
}
export function evaluate(timeline, currentBeat) {
    timeline.events.forEach((event, i) => {
        if (onsetJudgements[i] === "pending" && currentBeat >= event.hitBeat + HIT_WINDOW_BEATS) {
            const windowStart = event.hitBeat - HIT_WINDOW_BEATS;
            const windowEnd = event.hitBeat + HIT_WINDOW_BEATS;
            let matched = 0;
            event.notes.forEach(expectedNote => {
                const hasMatch = noteSpans.some(span => span.noteNumber === expectedNote && span.onBeat >= windowStart && span.onBeat <= windowEnd);
                if (hasMatch)
                    matched++;
            });
            if (event.notes.length === 0) {
                onsetJudgements[i] = "hit";
                holdJudgements[i] = "pending";
            }
            else if (matched === 0)
                onsetJudgements[i] = "miss";
            else if (matched === event.notes.length) {
                onsetJudgements[i] = "hit";
                holdJudgements[i] = "pending";
            }
            else {
                onsetJudgements[i] = "partial";
            }
        }
        if (holdJudgements[i] === "pending" && currentBeat >= event.hitBeat + event.beats) {
            holdJudgements[i] = "held";
        }
    });
}
function combinedJudgement(i) {
    if (onsetJudgements[i] !== "hit")
        return onsetJudgements[i];
    return holdJudgements[i] === "dropped" ? "dropped" : "hit";
}
export function getJudgement(chordIndex) {
    return combinedJudgement(chordIndex);
}
export function getAllJudgements() {
    return onsetJudgements.map((_, i) => combinedJudgement(i));
}
