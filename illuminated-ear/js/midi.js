let midiAccess = null;

let onNoteOnCallback = () => {};

let onNoteOffCallback = () => {};

let onDevicesChangedCallback = () => {};

function handleMidiMessage(e) {
  const [status, d1, d2] = e.data;
  const type = status & 240;
  if (type === 144 && d2 > 0) onNoteOnCallback(d1, d2); else if (type === 128 || type === 144 && d2 === 0) onNoteOffCallback(d1);
}

function attachToAllInputs() {
  const inputs = [ ...midiAccess.inputs.values() ];
  inputs.forEach(input => {
    input.onmidimessage = handleMidiMessage;
  });
  onDevicesChangedCallback(inputs.map(i => i.name));
}

export async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    return {
      supported: false,
      deviceNames: []
    };
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({
      sysex: false
    });
    attachToAllInputs();
    midiAccess.onstatechange = attachToAllInputs;
    return {
      supported: true,
      deviceNames: [ ...midiAccess.inputs.values() ].map(i => i.name)
    };
  } catch (err) {
    return {
      supported: false,
      deviceNames: []
    };
  }
}

export function onMidiNoteOn(cb) {
  onNoteOnCallback = cb;
}

export function onMidiNoteOff(cb) {
  onNoteOffCallback = cb;
}

export function onMidiDevicesChanged(cb) {
  onDevicesChangedCallback = cb;
}

export function hasMidiDevice() {
  return !!midiAccess && midiAccess.inputs.size > 0;
}