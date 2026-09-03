export class MidiManager {
  constructor() {
    this.access = null;
    this.inputs = [];
    this.onNoteOn = null;
    this.onNoteOff = null;
    this.onCC = null;
    this.onAftertouch = null;
    this.onDeviceChange = null;
  }
  get available() {
    return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  }
  async init() {
    if (!this.available) return false;
    try {
      this.access = await navigator.requestMIDIAccess({
        sysex: false
      });
      this._refreshInputs();
      this.access.onstatechange = () => this._refreshInputs();
      return true;
    } catch (err) {
      console.warn("[spectral-lab] MIDI access denied or unavailable:", err);
      return false;
    }
  }
  _refreshInputs() {
    this.inputs = [];
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = e => this._handleMessage(e);
      this.inputs.push(input);
    }
    if (this.onDeviceChange) this.onDeviceChange(this.inputs);
  }
  _handleMessage(e) {
    const [status, d1, d2] = e.data;
    const type = status & 240;
    const channel = (status & 15) + 1;
    if (type === 144 && d2 > 0) {
      if (this.onNoteOn) this.onNoteOn(d1, d2 / 127, channel);
    } else if (type === 128 || type === 144 && d2 === 0) {
      if (this.onNoteOff) this.onNoteOff(d1, channel);
    } else if (type === 176) {
      if (this.onCC) this.onCC(d1, d2 / 127, channel);
    } else if (type === 208) {
      if (this.onAftertouch) this.onAftertouch(d1 / 127, channel);
    }
  }
}