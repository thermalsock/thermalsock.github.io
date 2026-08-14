// UIState.js
export let bpm = 90;
export let bpmString = "";
export let editingBPM = false;

export function setBpm(value) {
  bpm = Math.max(30, Math.min(300, value));
}

export function setEditingBPM(value) {
  editingBPM = value;
  if (!value) bpmString = "";
}

export function appendBpmDigit(digit) {
  if (bpmString.length >= 3) return;
  bpmString += digit;
}

export function backspaceBpmDigit() {
  bpmString = bpmString.slice(0, -1);
}

// Commits whatever's been typed as the new BPM and exits edit mode. An
// empty or zero entry is treated as "no change" (just closes editing)
// rather than clamping to the 30 BPM floor, since that's almost
// certainly not what someone meant by pressing Enter on an empty field.
export function commitBpmEdit() {
  const parsed = parseInt(bpmString, 10);
  if (bpmString.length && !isNaN(parsed) && parsed > 0) {
    setBpm(parsed);
  }
  setEditingBPM(false);
}
