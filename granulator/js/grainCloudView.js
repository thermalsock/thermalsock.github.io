const ENV_COLORS = {
  hann: "#e0a26b",
  gaussian: "#8fb5e0",
  tukey: "#c98fd6",
  exponential: "#7fd68f"
};

export class GrainCloudView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grains = [];
    this._resize();
    window.addEventListener("resize", () => this._resize());
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
  setGrains(list) {
    this.grains = list;
  }
  draw() {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    for (const g of this.grains) {
      const x = g.x * w;
      const y = h / 2 - Math.max(-1, Math.min(1, g.pitch / 24)) * (h / 2) * .82;
      const radius = 2 + Math.min(1, g.dur / .2) * 8;
      const opacity = Math.max(0, 1 - g.age) * .8 + .15;
      const color = ENV_COLORS[g.env] || "#e0a26b";
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(color, opacity);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (Math.abs(g.pan) > .15) {
        ctx.beginPath();
        ctx.strokeStyle = hexToRgba(color, opacity * .5);
        ctx.lineWidth = 1;
        ctx.moveTo(x - g.pan * 8, y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}