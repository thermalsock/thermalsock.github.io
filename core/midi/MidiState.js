import { registerNoteOn, registerNoteOff } from "../scoring/JudgementEngine.js";
import { controlsState } from "../state/ControlsState.js";
export const midiState = {
    supported: false,
    connectedDeviceNames: [],
    get connectedDeviceName() {
        return this.connectedDeviceNames[0] || null;
    },
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
        if (controlsState.isPlaying) {
            registerNoteOn(noteNumber, controlsState.currentBeat);
        }
    }
    else if (isNoteOff) {
        midiState.heldNotes.delete(noteNumber);
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
    }
    catch (e) {
        midiState.supported = false;
    }
}
