// waveformView.js
// Renders the live input waveform on a scrolling canvas, with a freeze
// overlay and a read-head marker positioned from the worklet's telemetry.
// Dragging on the canvas while frozen enters "manual scan" — it posts an
// absolute position straight to the processor.

export class WaveformView {
  constructor(canvas, { onScan } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.history = []; // ring of recent peak-pairs for the scrolling trace
    this.maxHistory = 600;
    this.frozen = false;
    this.readHeadNorm = 0;
    this.scanSpread = 0.06; // set each frame from the current Jitter value
    this.scanRangeStart = 0;
    this.scanRangeEnd = 1;
    this.onScan = onScan || (() => {});
    this._scanning = false;

    this._bindDrag();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  _bindDrag() {
    const posFromEvent = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    };
    const start = (e) => { this._scanning = true; this.onScan(posFromEvent(e)); };
    const move = (e) => { if (this._scanning) { this.onScan(posFromEvent(e)); e.preventDefault(); } };
    const end = () => { this._scanning = false; };
    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    this.canvas.addEventListener('touchstart', start, { passive: true });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end);
  }

  setFrozen(v) { this.frozen = v; }
  setReadHead(norm) { this.readHeadNorm = norm; }
  setScanSpread(v) { this.scanSpread = v; }
  setScanRange(start, end) { this.scanRangeStart = start; this.scanRangeEnd = end; }

  /**
   * Replaces the scrolling live-input trace with a fixed representation of
   * a loaded sample, covering the whole buffer rather than a recent window
   * of live audio. Reuses the exact same rendering path as the live
   * scrolling trace (draw() just reads this.history either way) — it
   * always resamples to exactly `maxHistory` columns so the trace fills the
   * canvas width correctly regardless of the source sample's length.
   */
  setStaticWaveform(dataL) {
    const n = dataL.length;
    const cols = this.maxHistory;
    const peaks = new Array(cols);
    for (let c = 0; c < cols; c++) {
      const i0 = Math.floor((c / cols) * n);
      const i1 = Math.max(i0 + 1, Math.floor(((c + 1) / cols) * n));
      let min = 0, max = 0;
      if (i0 < n) {
        min = 1; max = -1;
        for (let j = i0; j < Math.min(n, i1); j++) {
          const v = dataL[j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      peaks[c] = [min, max];
    }
    this.history = peaks;
  }

  /** Drops the static waveform and lets the live scrolling trace resume
   * (once unfrozen — pushSamples() itself no-ops while frozen). */
  clearStaticWaveform() { this.history = []; }

  pushSamples(floatArray) {
    if (this.frozen) return;
    // Downsample into min/max pairs per pixel column, appended to a rolling history.
    const step = Math.max(1, Math.floor(floatArray.length / 64));
    for (let i = 0; i < floatArray.length; i += step) {
      let min = 1, max = -1;
      for (let j = i; j < Math.min(floatArray.length, i + step); j++) {
        const v = floatArray[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      this.history.push([min, max]);
    }
    while (this.history.length > this.maxHistory) this.history.shift();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Waveform trace
    const n = this.history.length;
    if (n > 1) {
      ctx.strokeStyle = this.frozen ? '#7fb8a8' : '#e0a26b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (this.maxHistory - 1)) * w;
        const [min, max] = this.history[i];
        const y1 = h / 2 - max * (h / 2) * 0.92;
        const y2 = h / 2 - min * (h / 2) * 0.92;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
      ctx.stroke();
    }

    // Scan range — the custom region the auto-scan head bounces/loops
    // within, when it's been narrowed from the full buffer. Drawn as a
    // dim fill outside the active region plus two boundary flags, so it
    // reads as "the head is confined between these two markers" rather
    // than blending in with the jitter band around the read head itself.
    const rangeStart = Math.max(0, Math.min(1, this.scanRangeStart));
    const rangeEnd = Math.max(rangeStart, Math.min(1, this.scanRangeEnd));
    if (rangeStart > 0.001 || rangeEnd < 0.999) {
      const sx = rangeStart * w;
      const ex = rangeEnd * w;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      if (sx > 0) ctx.fillRect(0, 0, sx, h);
      if (ex < w) ctx.fillRect(ex, 0, w - ex, h);

      ctx.strokeStyle = '#7fb8e0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
      ctx.moveTo(ex, 0); ctx.lineTo(ex, h);
      ctx.stroke();

      ctx.fillStyle = '#7fb8e0';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText('START', sx + 3, h - 4);
      ctx.textAlign = 'right';
      ctx.fillText('END', ex - 3, h - 4);
      ctx.textAlign = 'left';
    }

    // Grain scan region — a soft highlighted band around the read head,
    // sized by the current Jitter amount, echoing the shaded "active grain
    // window" region on hardware granular units rather than just a bare
    // playhead line.
    const rx = this.readHeadNorm * w;
    const bandWidth = w * Math.max(0.025, Math.min(0.32, 0.03 + this.scanSpread * 0.3));
    const grad = ctx.createLinearGradient(rx - bandWidth / 2, 0, rx + bandWidth / 2, 0);
    grad.addColorStop(0, 'rgba(211, 160, 90, 0)');
    grad.addColorStop(0.5, 'rgba(211, 160, 90, 0.16)');
    grad.addColorStop(1, 'rgba(211, 160, 90, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(rx - bandWidth / 2, 0, bandWidth, h);

    // Read head marker
    ctx.strokeStyle = '#ff5a5f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, h);
    ctx.stroke();
    ctx.fillStyle = '#ff5a5f';
    ctx.beginPath();
    ctx.moveTo(rx - 5, 0);
    ctx.lineTo(rx + 5, 0);
    ctx.lineTo(rx, 8);
    ctx.closePath();
    ctx.fill();

    // Freeze overlay
    if (this.frozen) {
      ctx.fillStyle = 'rgba(127, 184, 168, 0.10)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7fb8a8';
      ctx.textBaseline = 'top';
      ctx.fillText('FROZEN — drag to scan', 10, 8);
    }
  }
}
