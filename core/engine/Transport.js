import { controlsState } from "../state/ControlsState.js";
import { bpm } from "../state/UIState.js";
export function tick(dtSeconds, totalBeats) {
    if (!controlsState.isPlaying)
        return false;
    const beatsPerSecond = bpm / 60;
    controlsState.currentBeat += dtSeconds * beatsPerSecond;
    if (totalBeats > 0 && controlsState.currentBeat >= totalBeats) {
        controlsState.currentBeat = controlsState.currentBeat % totalBeats;
        return true;
    }
    return false;
}
