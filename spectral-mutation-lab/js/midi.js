// midi.js
// Web MIDI integration, scoped to what actually helps a hands-on performer
// here rather than a full modulation matrix: device list, note-on captures
// Freeze A (so a key press grabs a spectral snapshot of whatever you just
// played), and mod-wheel / aftertouch convenience mappings onto Smear and
// Scatter.

export class MidiManager {
  constructor() {
    this.access = null;
    this.inputs = [];
    this.onNoteOn = null; // (note, velocity01, channel) => void
    this.onNoteOff = null;
    this.onCC = null; // (cc, value01, channel) => void
    this.onAftertouch = null; // (value01, channel) => void
    this.onDeviceChange = null; // (devices[]) => void
  }

  get available() {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async init() {
    if (!this.available) return false;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this._refreshInputs();
      this.access.onstatechange = () => this._refreshInputs();
      return true;
    } catch (err) {
      console.warn('[spectral-lab] MIDI access denied or unavailable:', err);
      return false;
    }
  }

  _refreshInputs() {
    this.inputs = [];
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (e) => this._handleMessage(e);
      this.inputs.push(input);
    }
    if (this.onDeviceChange) this.onDeviceChange(this.inputs);
  }

  _handleMessage(e) {
    const [status, d1, d2] = e.data;
    const type = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    if (type === 0x90 && d2 > 0) {
      if (this.onNoteOn) this.onNoteOn(d1, d2 / 127, channel);
    } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
      if (this.onNoteOff) this.onNoteOff(d1, channel);
    } else if (type === 0xb0) {
      if (this.onCC) this.onCC(d1, d2 / 127, channel);
    } else if (type === 0xd0) {
      if (this.onAftertouch) this.onAftertouch(d1 / 127, channel);
    }
  }
}
