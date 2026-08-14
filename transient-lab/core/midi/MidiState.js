// MidiState.js
//
// Connects to Web MIDI, tracks EVERY connected device (not just the
// first one — a class-compliant audio interface often exposes its own
// MIDI port alongside a real keyboard controller, and originally this
// only looked at inputs[0], so an interface like a MiniFuse could
// silently shadow the actual synth in the panel display even though
// both were still being listened to underneath). Also parses real
// note-on/note-off messages and feeds them into the JudgementEngine
// tagged with the current transport beat.

import { registerNoteOn, registerNoteOff } from "../scoring/JudgementEngine.js";
import { controlsState } from "../state/ControlsState.js";

export const midiState = {
  supported: false,
  // Every currently connected input's name, in the order Web MIDI
  // reports them — the panel lists all of these now instead of
  // silently picking one. connectedDeviceName (singular) is kept as
  // the first entry for any old call sites, but new code should read
  // connectedDeviceNames.
  connectedDeviceNames: [],
  get connectedDeviceName() {
    return this.connectedDeviceNames[0] || null;
  },
  // Currently held-down note numbers, from ANY connected device. Not
  // gated on isPlaying — this updates immediately on every note-on/
  // note-off regardless of transport state, so the grid can show live
  // "yes, MIDI is arriving" feedback even before you press Play.
  heldNotes: new Set()
};

function handleMidiMessage(e) {
  const [statusByte, data1, data2] = e.data;
  const command = statusByte & 0xf0;
  const noteNumber = data1;
  const velocity = data2;

  const isNoteOn = command === 0x90 && velocity > 0;
  const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);

  if (isNoteOn) {
    midiState.heldNotes.add(noteNumber);
    // Judgement scoring only makes sense once playback has actually
    // started — a note played while stopped has no beat position to
    // judge against — but heldNotes above updates unconditionally so
    // there's still visible feedback either way.
    if (controlsState.isPlaying) {
      registerNoteOn(noteNumber, controlsState.currentBeat);
    }
  } else if (isNoteOff) {
    midiState.heldNotes.delete(noteNumber);
    // Symmetric with the note-on side: only meaningful once playback
    // has actually started, since a release has no beat position to
    // judge a hold against otherwise. This is what lets the
    // JudgementEngine detect an early release in real time.
    if (controlsState.isPlaying) {
      registerNoteOff(noteNumber, controlsState.currentBeat);
    }
  }
}

export async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    midiState.supported = false;
    return;
  }

  try {
    const access = await navigator.requestMIDIAccess();
    midiState.supported = true;

    const attachHandlers = () => {
      const inputs = Array.from(access.inputs.values());
      midiState.connectedDeviceNames = inputs.map(input => input.name);
      inputs.forEach(input => {
        input.onmidimessage = handleMidiMessage;
      });
    };

    attachHandlers();
    access.onstatechange = attachHandlers;
  } catch (e) {
    // Permission denied or unavailable — treat same as unsupported,
    // panel just shows "No synth connected".
    midiState.supported = false;
  }
}
