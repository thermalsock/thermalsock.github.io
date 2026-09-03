export class MidiManager {
  constructor() {
    this.access = null;
    this.inputs = [];
    this.onNoteOn = null;
    this.onNoteOff = null;
    this.onCC = null;
    this.onAftertouch = null;
    this.onPitchBend = null;
    this.onClockTick = null;
    this.onClockStart = null;
    this.onClockStop = null;
    this.onDeviceChange = null;
    this.learnTarget = null;
    this.clockSource = "internal";
    this.internalBpm = 120;
    this._tickTimes = [];
    this._internalTimer = null;
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
      console.warn("[granulator] MIDI access denied or unavailable:", err);
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
    if (status === 248) {
      this._registerClockTick();
      if (this.onClockTick) this.onClockTick();
      return;
    }
    if (status === 250 || status === 251) {
      if (this.onClockStart) this.onClockStart();
      return;
    }
    if (status === 252) {
      if (this.onClockStop) this.onClockStop();
      return;
    }
    if (type === 144 && d2 > 0) {
      if (this.onNoteOn) this.onNoteOn(d1, d2 / 127, channel);
    } else if (type === 128 || type === 144 && d2 === 0) {
      if (this.onNoteOff) this.onNoteOff(d1, channel);
    } else if (type === 176) {
      if (this.learnTarget) {
        this.learnTarget(d1);
        this.learnTarget = null;
      }
      if (this.onCC) this.onCC(d1, d2 / 127, channel);
    } else if (type === 208) {
      if (this.onAftertouch) this.onAftertouch(d1 / 127, channel);
    } else if (type === 224) {
      const val14 = (d2 << 7 | d1) - 8192;
      if (this.onPitchBend) this.onPitchBend(val14 / 8192, channel);
    }
  }
  _registerClockTick() {
    const now = performance.now();
    this._tickTimes.push(now);
    if (this._tickTimes.length > 24) this._tickTimes.shift();
    if (this._tickTimes.length >= 2) {
      const span = this._tickTimes[this._tickTimes.length - 1] - this._tickTimes[0];
      const ticks = this._tickTimes.length - 1;
      const msPerTick = span / ticks;
      const bpm = 6e4 / (msPerTick * 24);
      if (isFinite(bpm) && bpm > 20 && bpm < 300) this.internalBpm = bpm;
    }
  }
  learnNextCC(cb) {
    this.learnTarget = cb;
  }
  cancelLearn() {
    this.learnTarget = null;
  }
  setClockSource(source) {
    this.clockSource = source;
  }
}

export function noteToName(note) {
  const names = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
  const octave = Math.floor(note / 12) - 1;
  return `${names[note % 12]}${octave}`;
}