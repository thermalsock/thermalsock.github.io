// spectrogramView.js
// A scrolling waterfall spectrogram: each incoming spectrum frame becomes
// one new column of pixels on the right edge, with everything else shifted
// one pixel left — time runs left-to-right, frequency runs bottom-to-top
// (log-scaled), color represents magnitude. This is the signature visual
// for a spectral processor, the way the waveform + grain cloud is for the
// Granulator.

function magToColor(v) {
  // v is expected roughly in [0,1] after the sqrt compression below — map
  // through a warm dark -> amber -> pale gradient.
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.5) {
    const u = t / 0.5;
    const r = Math.round(12 + u * (211 - 12));
    const g = Math.round(10 + u * (120 - 10));
    const b = Math.round(8 + u * (40 - 8));
    return [r, g, b];
  }
  const u = (t - 0.5) / 0.5;
  const r = Math.round(211 + u * (250 - 211));
  const g = Math.round(120 + u * (225 - 120));
  const b = Math.round(40 + u * (190 - 40));
  return [r, g, b];
}

export class SpectrogramView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.hasFrozenA = false;
    this.hasFrozenB = false;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1); // cap DPR — redrawn every frame, keep it cheap
    const newW = Math.max(1, Math.floor(rect.width * dpr));
    const newH = Math.max(1, Math.floor(rect.height * dpr));
    if (newW === this.canvas.width && newH === this.canvas.height) return;
    this.canvas.width = newW;
    this.canvas.height = newH;
    this.w = newW;
    this.h = newH;
    this.ctx.fillStyle = '#0a0806';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  setFreezeState(a, b) {
    this.hasFrozenA = a;
    this.hasFrozenB = b;
  }

  pushSpectrum(spectrum) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    if (w < 2 || h < 2) return;

    // Shift the existing image one pixel left.
    ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);

    // Draw the new column at the right edge. Frequency axis is log-scaled
    // (bin index -> perceptual position) and magnitude is sqrt-compressed
    // before color mapping so quiet detail stays visible against loud peaks.
    const n = spectrum.length;
    const colX = w - 1;
    for (let y = 0; y < h; y++) {
      const frac = 1 - y / h; // 0 at bottom (low freq) -> 1 at top (high freq)
      const logPos = Math.pow(frac, 2.2); // bias toward showing more low/mid detail
      const bin = Math.min(n - 1, Math.floor(logPos * n));
      const mag = spectrum[bin];
      const compressed = Math.min(1, Math.sqrt(mag) * 0.18);
      const [r, g, b] = magToColor(compressed);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(colX, y, 1, 1);
    }
  }

  draw() {
    // Freeze-slot indicators, drawn last each frame so they sit on top of
    // the scrolling image rather than getting shifted/overwritten by it.
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    if (w < 2 || h < 2) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const chipW = 62 * dpr, chipH = 18 * dpr, gap = 6 * dpr, pad = 8 * dpr;
    ctx.font = `${Math.round(10 * dpr)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    const drawChip = (x, label, active) => {
      ctx.fillStyle = active ? 'rgba(211,160,90,0.92)' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, pad, chipW, chipH);
      ctx.fillStyle = active ? '#241505' : 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + chipW / 2, pad + chipH / 2 + 1);
    };
    drawChip(pad, 'FREEZE A', this.hasFrozenA);
    drawChip(pad + chipW + gap, 'FREEZE B', this.hasFrozenB);
    ctx.textAlign = 'left';
  }
}
