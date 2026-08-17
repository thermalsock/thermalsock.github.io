// triggerEngine.js
// Finds a stable trigger point in a time-domain buffer so the trace holds still
// frame to frame, the way a real scope's trigger circuit does.

export const TriggerMode = {
  AUTO: 'auto',     // free-runs if no trigger found within a timeout
  NORMAL: 'normal',  // waits indefinitely for a trigger; holds last good frame otherwise
  SINGLE: 'single',  // captures exactly one triggered frame, then stops
};

export const TriggerSlope = {
  RISING: 'rising',
  FALLING: 'falling',
};

const AUTO_TIMEOUT_MS = 200; // how long AUTO waits before free-running

export class TriggerEngine {
  constructor() {
    this.mode = TriggerMode.AUTO;
    this.slope = TriggerSlope.RISING;
    this.level = 0; // trigger level, in the same [-1, 1] units as sample data
    this.armed = true; // for SINGLE mode: whether we're waiting to capture
    this._lastTriggerTime = 0;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === TriggerMode.SINGLE) this.armed = true;
  }

  // Re-arm a SINGLE trigger (e.g. user pressed "Single" again).
  rearm() {
    this.armed = true;
  }

  /**
   * Scan `buffer` for a trigger crossing on `this.level`/`this.slope`.
   * Returns the sample index of the crossing, or -1 if none found.
   * Searches only the first half of the buffer so there's always enough
   * trailing data to draw a full trace after the trigger point.
   */
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

  /**
   * Decide what slice of `buffer` to display this frame, given the current mode.
   * `windowSize` is how many samples to return.
   * Returns { data: Float32Array|null, index: number, triggered: boolean, shouldFreeze: boolean }
   * - data === null means "keep showing whatever was drawn last frame"
   * - index is the sample offset the window was cut from (-1 if free-running from 0
   *   or no data), so callers can slice other channels at the same point for a
   *   stable multi-channel display.
   */
  process(buffer, windowSize) {
    if (this.mode === TriggerMode.SINGLE && !this.armed) {
      // Already captured our one shot; hold it.
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

    // No trigger found this frame.
    if (this.mode === TriggerMode.NORMAL || this.mode === TriggerMode.SINGLE) {
      // Hold last frame, don't free-run.
      return { data: null, index: -1, triggered: false, shouldFreeze: false };
    }

    // AUTO: free-run if we've been untriggered longer than the timeout.
    const elapsed = performance.now() - this._lastTriggerTime;
    if (elapsed > AUTO_TIMEOUT_MS) {
      const data = buffer.slice(0, windowSize);
      return { data, index: 0, triggered: false, shouldFreeze: false };
    }

    return { data: null, index: -1, triggered: false, shouldFreeze: false };
  }
}
