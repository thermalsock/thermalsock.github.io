// midi.js
// Web MIDI device connection and note on/off dispatch. Kept deliberately
// dumb — no music theory, no game logic — it just tells the caller "this
// note number went down" / "this note number went up." game.js decides
// what that means.

let midiAccess = null;
let onNoteOnCallback = () => {};
let onNoteOffCallback = () => {};
let onDevicesChangedCallback = () => {};

function handleMidiMessage(e) {
  const [status, d1, d2] = e.data;
  const type = status & 0xf0;
  if (type === 0x90 && d2 > 0) onNoteOnCallback(d1, d2);
  else if (type === 0x80 || (type === 0x90 && d2 === 0)) onNoteOffCallback(d1);
}

function attachToAllInputs() {
  const inputs = [...midiAccess.inputs.values()];
  inputs.forEach((input) => { input.onmidimessage = handleMidiMessage; });
  onDevicesChangedCallback(inputs.map((i) => i.name));
}

/** @returns {Promise<{supported: boolean, deviceNames: string[]}>} */
export async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    return { supported: false, deviceNames: [] };
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    attachToAllInputs();
    midiAccess.onstatechange = attachToAllInputs;
    return { supported: true, deviceNames: [...midiAccess.inputs.values()].map((i) => i.name) };
  } catch (err) {
    return { supported: false, deviceNames: [] };
  }
}

export function onMidiNoteOn(cb) { onNoteOnCallback = cb; }
export function onMidiNoteOff(cb) { onNoteOffCallback = cb; }
export function onMidiDevicesChanged(cb) { onDevicesChangedCallback = cb; }

export function hasMidiDevice() {
  return !!midiAccess && midiAccess.inputs.size > 0;
}
