// ControlsState.js
// Same shape as Rudiment's — a plain mutable object every draw/input
// file reads/writes directly, no event system. Trimmed to just what
// the UI shell needs; grows as the engine/judgement layer lands.

export const controlsState = {
  isPlaying: false,
  currentBeat: 0
};
