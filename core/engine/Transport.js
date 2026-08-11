// Transport.js
//
// Advances controlsState.currentBeat in real time while playing, using
// the current BPM to convert elapsed seconds into elapsed beats. Loops
// back to 0 at the end of the timeline (via the totalBeats passed in
// each tick) so a lesson repeats for practice, same spirit as
// Rudiment's looping pattern playback.

import { controlsState } from "../state/ControlsState.js";
import { bpm } from "../state/UIState.js";

export function tick(dtSeconds, totalBeats) {
  if (!controlsState.isPlaying) return false; // returns whether a loop wrap happened

  const beatsPerSecond = bpm / 60;
  controlsState.currentBeat += dtSeconds * beatsPerSecond;

  if (totalBeats > 0 && controlsState.currentBeat >= totalBeats) {
    controlsState.currentBeat = controlsState.currentBeat % totalBeats;
    return true;
  }
  return false;
}
