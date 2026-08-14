export const TriggerMode = { AUTO: "auto", NORMAL: "normal", SINGLE: "single" };
export const TriggerSlope = { RISING: "rising", FALLING: "falling" };
const AUTO_TIMEOUT_MS = 200;
export class TriggerEngine {
  constructor() {
    this.mode = TriggerMode.AUTO;
    this.slope = TriggerSlope.RISING;
    this.level = 0;
    this.armed = true;
    this._lastTriggerTime = 0;
  }
  setMode(mode) {
    this.mode = mode;
    if (mode === TriggerMode.SINGLE) this.armed = true;
  }
  rearm() {
    this.armed = true;
  }
  findTriggerIndex(buffer) {
    const searchEnd = Math.floor(buffer.length / 2);
    for (let i = 1; i < searchEnd; i++) {
      const prev = buffer[i - 1];
      const curr = buffer[i];
      if (this.slope === TriggerSlope.RISING) {
        if (prev < this.level && curr >= this.level) return i;
      } else {
        if (prev > this.level && curr <= this.level) return i;
      }
    }
    return -1;
  }
  process(buffer, windowSize) {
    if (this.mode === TriggerMode.SINGLE && !this.armed) {
      return { data: null, index: -1, triggered: false, shouldFreeze: true };
    }
    const idx = this.findTriggerIndex(buffer);
    if (idx !== -1) {
      this._lastTriggerTime = performance.now();
      const end = Math.min(idx + windowSize, buffer.length);
      const data = buffer.slice(idx, end);
      if (this.mode === TriggerMode.SINGLE) {
        this.armed = false;
        return { data, index: idx, triggered: true, shouldFreeze: true };
      }
      return { data, index: idx, triggered: true, shouldFreeze: false };
    }
    if (this.mode === TriggerMode.NORMAL || this.mode === TriggerMode.SINGLE) {
      return { data: null, index: -1, triggered: false, shouldFreeze: false };
    }
    const elapsed = performance.now() - this._lastTriggerTime;
    if (elapsed > AUTO_TIMEOUT_MS) {
      const data = buffer.slice(0, windowSize);
      return { data, index: 0, triggered: false, shouldFreeze: false };
    }
    return { data: null, index: -1, triggered: false, shouldFreeze: false };
  }
}
