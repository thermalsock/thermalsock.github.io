// Timeline.js
//
// A lesson's chords are stored as a simple sequence, each with its own
// `beats` duration (see content pack files). This turns that sequence
// into a timeline: each chord gets a `hitBeat` — the absolute beat
// position (from the start of the lesson) at which it should be
// played — by summing the durations of everything before it. Pure
// function, no state: same lesson always produces the same timeline,
// so it's cheap to rebuild whenever the active lesson changes.
//
// LEAD_IN_BEATS offsets every event by a fixed count-in so the FIRST
// chord isn't a special case: without this, chord 0's hitBeat is 0,
// which is also exactly when playback starts (currentBeat=0) — so it
// would always arrive with zero warning, unlike every chord after it
// which gets a full BEATS_VISIBLE of approach time. Matches BEATS_VISIBLE
// itself so chord 0 gets the exact same lead-in as every other chord.
// This also means every loop of the lesson gets a fresh silent count-in
// before it repeats, not just the very first playthrough.

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

// Shared "which event is current" lookup -- used by both TopBar.js
// (NOW/NEXT display) and AnalysisBar.js's info block ("TO PLAY"), so
// the two displays can never silently drift out of sync with each
// other by each re-implementing their own version of this walk.
// Returns the INDEX of the last event whose hitBeat has already
// passed (-1 if playback hasn't reached the first event yet, e.g.
// during the lead-in).
export function findCurrentEventIndex(timeline, currentBeat) {
  const events = timeline.events;
  let currentIndex = -1;
  for (let i = 0; i < events.length; i++) {
    if (events[i].hitBeat <= currentBeat) currentIndex = i;
    else break;
  }
  return currentIndex;
}
