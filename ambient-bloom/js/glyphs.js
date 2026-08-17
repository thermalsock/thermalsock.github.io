// glyphs.js
// A small invented wedge-stroke writing system, evoking cuneiform without
// being an actual reproduction of Sumerian or any real script — every glyph
// here is generated from geometric primitives, not copied characters.
//
// Each of the 12 pitch classes gets a fixed "family" of stroke positions
// (seeded, so it's the same shape every time that pitch class recurs —
// this is what makes the page start to look like a real, if illegible,
// writing system rather than pure noise), with small per-instance jitter
// layered on top for a handwritten feel.

function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// One wedge = a triangular stylus mark: a thick "head" tapering to a thin
// tail, the classic cuneiform stroke shape.
function drawWedge(ctx, x, y, angle, length, headWidth, color, alpha) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const tipX = x + cos * length, tipY = y + sin * length;
  const hw = headWidth / 2;
  const perpX = -sin * hw, perpY = cos * hw;

  ctx.beginPath();
  ctx.moveTo(x + perpX, y + perpY);
  ctx.lineTo(x - perpX, y - perpY);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
}

// Build 12 stroke-position "families", one per pitch class. Each is a list
// of {x, y, angle, length, headWidth} within a nominal 16x16 box, 2-4
// wedges per glyph.
const GLYPH_BOX = 16;
export const GLYPH_TEMPLATES = Array.from({ length: 12 }, (_, pitchClass) => {
  const rand = seededRandom(pitchClass * 7919 + 13);
  const strokeCount = 2 + Math.floor(rand() * 3); // 2-4 strokes
  const strokes = [];
  for (let i = 0; i < strokeCount; i++) {
    // Bias toward the classic cuneiform angles (mostly vertical/horizontal/
    // diagonal wedges), not fully random rotation, so it reads as a
    // consistent stroke vocabulary rather than arbitrary triangles.
    const angleFamily = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI][Math.floor(rand() * 5)];
    strokes.push({
      x: 2 + rand() * (GLYPH_BOX - 4),
      y: 2 + rand() * (GLYPH_BOX - 4),
      angle: angleFamily + (rand() - 0.5) * 0.3,
      length: 4 + rand() * 6,
      headWidth: 1.6 + rand() * 2,
    });
  }
  return strokes;
});

/**
 * Draws one glyph at (x, y), representing the given pitch class (0-11),
 * with a strength value (0..1, from the onset) controlling ink darkness and
 * a small per-instance jitter for a handwritten, not-mechanically-repeated
 * feel.
 */
export function drawGlyph(ctx, x, y, pitchClass, strength, inkColor, jitterSeed) {
  const template = GLYPH_TEMPLATES[((pitchClass % 12) + 12) % 12];
  const jitter = seededRandom(jitterSeed >>> 0);
  const scale = 0.85 + jitter() * 0.3;
  const rotJitter = (jitter() - 0.5) * 0.25;
  const alphaBase = 0.55 + strength * 0.4;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotJitter);
  ctx.scale(scale, scale);
  template.forEach((s) => {
    const dx = (jitter() - 0.5) * 1.2;
    const dy = (jitter() - 0.5) * 1.2;
    drawWedge(ctx, s.x + dx, s.y + dy, s.angle, s.length, s.headWidth, inkColor, alphaBase * (0.75 + jitter() * 0.25));
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * Draws a small ink blot — an irregular splatter, for strong transient hits.
 * Size and droplet count scale with strength.
 */
export function drawBlot(ctx, x, y, strength, inkColor, jitterSeed) {
  const jitter = seededRandom(jitterSeed >>> 0);
  const baseR = 1.5 + strength * 3.5;

  ctx.save();
  ctx.fillStyle = inkColor;
  ctx.globalAlpha = 0.5 + strength * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.fill();

  // A few small satellite droplets around the main blot.
  const dropletCount = 1 + Math.floor(strength * 4);
  for (let i = 0; i < dropletCount; i++) {
    const a = jitter() * Math.PI * 2;
    const d = baseR * (0.8 + jitter() * 1.4);
    const r = baseR * (0.12 + jitter() * 0.22);
    ctx.globalAlpha = (0.35 + strength * 0.3) * (0.6 + jitter() * 0.4);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export const GLYPH_ADVANCE = GLYPH_BOX + 5; // horizontal spacing between glyphs, including a gap
