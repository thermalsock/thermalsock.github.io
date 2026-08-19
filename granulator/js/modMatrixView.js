// modMatrixView.js
// A compact animated visualization that sits above the modulation matrix
// table: one scrolling trace per active source, plus macro level bars.
// The actual source/target/depth rows are plain DOM (built in main.js) —
// this view is purely the "animated LFOs, routing lines, macro indicators"
// glanceable strip called for in the spec.

export class ModMatrixView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.traces = new Map(); // sourceId -> rolling value history
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

  update(sources, macros) {
    this.sources = sources;
    this.macros = macros;
    for (const s of sources) {
      if (!this.traces.has(s.id)) this.traces.set(s.id, []);
      const arr = this.traces.get(s.id);
      arr.push(s.value);
      if (arr.length > 240) arr.shift();
    }
    // Drop traces for removed sources.
    for (const id of Array.from(this.traces.keys())) {
      if (!sources.find((s) => s.id === id)) this.traces.delete(id);
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    if (!this.sources) return;

    const rowH = Math.max(18, (h - 8) / Math.max(1, this.sources.length));
    const colors = ['#e0a26b', '#8fb5e0', '#c98fd6', '#7fd68f', '#e6c15a', '#e08f8f'];

    this.sources.forEach((s, idx) => {
      const trace = this.traces.get(s.id) || [];
      const y0 = idx * rowH + rowH / 2;
      const color = colors[idx % colors.length];

      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(s.label, 4, y0 - rowH / 2 + 10);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      const labelOffset = 70;
      const plotW = Math.max(10, w - labelOffset - 8);
      for (let i = 0; i < trace.length; i++) {
        const x = labelOffset + (i / 239) * plotW;
        const v = trace[i];
        const y = y0 - v * (rowH / 2) * 0.8;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // Macro indicators along the bottom edge.
    if (this.macros) {
      const barW = 40, gap = 8;
      const totalW = this.macros.length * (barW + gap) - gap;
      let x = w - totalW - 6;
      const y = h - 6;
      this.macros.forEach((m, i) => {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x, y - 4, barW, 4);
        ctx.fillStyle = '#e0a26b';
        ctx.fillRect(x, y - 4, barW * m, 4);
        x += barW + gap;
      });
    }
  }
}
