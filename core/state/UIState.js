export let bpm = 90;
export let bpmString = "";
export let editingBPM = false;
export function setBpm(value) {
    bpm = Math.max(30, Math.min(300, value));
}
export function setEditingBPM(value) {
    editingBPM = value;
    if (!value)
        bpmString = "";
}
export function appendBpmDigit(digit) {
    if (bpmString.length >= 3)
        return;
    bpmString += digit;
}
export function backspaceBpmDigit() {
    bpmString = bpmString.slice(0, -1);
}
export function commitBpmEdit() {
    const parsed = parseInt(bpmString, 10);
    if (bpmString.length && !isNaN(parsed) && parsed > 0) {
        setBpm(parsed);
    }
    setEditingBPM(false);
}
