// JudgementEngine.js
//
// Two-phase judgement, Guitar Hero/Clone Hero-style:
//
// PHASE 1 (onset): same as before -- was every one of a chord's note
// numbers played within HIT_WINDOW_BEATS of the chord's hitBeat? Result
// is 'miss' (none matched), 'partial' (some matched), or 'hit' (all
// matched). This resolves shortly after the onset window closes, same
// timing as before.
//
// PHASE 2 (hold) -- NEW: only kicks in once phase 1 resolves to 'hit'.
// From that moment, the chord's notes need to stay held down through
// the bar's full length (hitBeat + beats). If ANY expected note is
// released before that (minus a small release tolerance), the event
// immediately flips to 'dropped' -- same instant feedback a real
// sustain-note game gives when you let go too early, not something you
// only find out about after the fact. If nothing is released early, it
// finalizes as 'held' once the bar's duration has fully elapsed.
//
// v1 SCOPE, stated plainly:
// - Only fully-correct-onset chords ('hit') get hold tracking at all --
//   a 'partial' onset (wrong notes at the start) stays 'partial'
//   regardless of what happens after; this file doesn't try to also
//   track partial-hold on top of partial-strike.
// - "Released early" is checked per NOTE NUMBER, not per specific
//   press -- if a note is released and re-pressed rapidly during a
//   hold, the release still counts against that hold. Reasonable for
//   the pad/chord-holding lessons this app is built around; a real
//   edge case for fast re-articulation, not attempted here.
// - Chord notes don't have to go down in the exact same instant at
//   onset (see the original phase-1 scope note below) -- each is
//   independently checked against the target window.

export const HIT_WINDOW_BEATS = 0.35; // ~230ms of tolerance at 90 BPM each side of the target onset
export const RELEASE_TOLERANCE_BEATS = 0.25; // forgiveness on releasing right at (not slightly before) the expected end

// How far back to keep note history. Generous relative to the two
// tolerances above so nothing needed for judgement gets pruned early.
const LOG_RETENTION_BEATS = 16;

let activeTimeline = null;
let noteSpans = []; // { noteNumber, onBeat, offBeat: number|null }
let onsetJudgements = []; // parallel to timeline.events: 'pending' | 'hit' | 'partial' | 'miss'
let holdJudgements = []; // parallel to timeline.events: 'n/a' | 'pending' | 'held' | 'dropped'

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
  // Safety: if this note number somehow still has an open span (no
  // matching note-off arrived), close it now rather than leaving two
  // open spans for the same note.
  const stillOpen = noteSpans.find(s => s.noteNumber === noteNumber && s.offBeat === null);
  if (stillOpen) stillOpen.offBeat = beat;

  noteSpans.push({ noteNumber, onBeat: beat, offBeat: null });
  pruneSpans(beat);
}

export function registerNoteOff(noteNumber, beat) {
  const openSpan = [...noteSpans].reverse().find(s => s.noteNumber === noteNumber && s.offBeat === null);
  if (openSpan) openSpan.offBeat = beat;
  pruneSpans(beat);

  // Real-time drop detection -- this is what makes release feedback
  // immediate instead of only discovered on the next evaluate() pass
  // long after the fact.
  if (!activeTimeline) return;
  activeTimeline.events.forEach((event, i) => {
    if (onsetJudgements[i] !== "hit") return;
    if (holdJudgements[i] !== "pending") return;
    if (!event.notes.includes(noteNumber)) return;

    const expectedRelease = event.hitBeat + event.beats;
    if (beat < expectedRelease - RELEASE_TOLERANCE_BEATS) {
      holdJudgements[i] = "dropped";
    }
  });
}

// Call every frame.
export function evaluate(timeline, currentBeat) {
  timeline.events.forEach((event, i) => {
    // Phase 1: onset judgement (unchanged logic from the original
    // single-phase version).
    if (onsetJudgements[i] === "pending" && currentBeat >= event.hitBeat + HIT_WINDOW_BEATS) {
      const windowStart = event.hitBeat - HIT_WINDOW_BEATS;
      const windowEnd = event.hitBeat + HIT_WINDOW_BEATS;

      let matched = 0;
      event.notes.forEach(expectedNote => {
        const hasMatch = noteSpans.some(
          span => span.noteNumber === expectedNote && span.onBeat >= windowStart && span.onBeat <= windowEnd
        );
        if (hasMatch) matched++;
      });

      // A rest (empty notes array, used for silent gaps in a lesson's
      // real bar structure -- see Pete Standing Alone) has nothing to
      // check and should never register as a miss. Handled as its own
      // case FIRST: matched===0 is also true for a 0-note event, so
      // without this it would fall into the miss branch below purely
      // because there was nothing to match, not because anything was
      // actually missed.
      if (event.notes.length === 0) {
        onsetJudgements[i] = "hit";
        holdJudgements[i] = "pending";
      } else if (matched === 0) onsetJudgements[i] = "miss";
      else if (matched === event.notes.length) {
        onsetJudgements[i] = "hit";
        holdJudgements[i] = "pending"; // hold tracking starts now
      } else {
        onsetJudgements[i] = "partial";
      }
    }

    // Phase 2: finalize the hold once the bar's full duration has
    // elapsed, PROVIDED nothing already flipped it to 'dropped' via
    // registerNoteOff's real-time check above.
    if (holdJudgements[i] === "pending" && currentBeat >= event.hitBeat + event.beats) {
      holdJudgements[i] = "held";
    }
  });
}

// Combined display state for one event: onset problems (miss/partial/
// pending) pass through as-is; a confirmed-correct onset shows as
// 'hit' whether the hold is still in progress or has finalized as
// 'held' (both read the same visually -- green, still going well),
// and flips to 'dropped' the instant an early release is detected.
function combinedJudgement(i) {
  if (onsetJudgements[i] !== "hit") return onsetJudgements[i];
  return holdJudgements[i] === "dropped" ? "dropped" : "hit";
}

export function getJudgement(chordIndex) {
  return combinedJudgement(chordIndex);
}

export function getAllJudgements() {
  return onsetJudgements.map((_, i) => combinedJudgement(i));
}
