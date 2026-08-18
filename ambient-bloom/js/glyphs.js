// glyphs.js
// An invented flowing/looping script, deliberately evoking the character
// of Voynich manuscript writing (bulbous loops, hooked tails, small
// ascender-loops) — every stroke here is generated from geometry, not
// traced or copied from the real manuscript's actual glyph shapes.
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

// A closed loop (ellipse, at an angle) — the "o"/"a"-family bulbous shapes
// that dominate Voynichese.
function drawLoop(ctx, x, y, angle, rx, ry, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.restore();
}

// A hooked curl/tail — a stroke that curves and tightens into a small
// spiral at the end, like a descender.
function drawCurl(ctx, x, y, angle, length, color, alpha) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const endX = x + cos * length, endY = y + sin * length;
  const hookAngle = angle + Math.PI * 0.7;
  const hookR = length * 0.28;
  const hookCx = endX + Math.cos(hookAngle) * hookR * 0.6;
  const hookCy = endY + Math.sin(hookAngle) * hookR * 0.6;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + cos * length * 0.6 - sin * length * 0.25, y + sin * length * 0.6 + cos * length * 0.25, endX, endY);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(hookCx, hookCy, hookR, hookAngle, hookAngle + Math.PI * 1.4);
  ctx.stroke();
}

// A tall stem with a small loop near the top — the ascender-loop shape
// seen in several Voynichese character families (EVA "k"/"t"/"ch"-like
// forms).
function drawStemLoop(ctx, x, y, height, color, alpha) {
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x, y + height * 0.32);
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x + height * 0.16, y + height * 0.18, height * 0.19, height * 0.15, -0.3, 0, Math.PI * 2);
  ctx.stroke();
}

// A tiny dot/pip — used sparingly as a diacritic-like accent.
function drawPip(ctx, x, y, r, color, alpha) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
}

// 12 pitch classes x 8 variants each = 96 distinct invented characters.
// Same pitch class still shares a family resemblance (which primitives it
// favors) so the page reads as one consistent-if-illegible system, but
// with enough per-class variety that the same note played repeatedly
// doesn't draw the identical mark every time.
const GLYPH_BOX = 15;
const VARIANTS_PER_CLASS = 8;
const STROKE_KINDS = ['loop', 'loop', 'loop', 'curl', 'curl', 'stem', 'pip'];

export const GLYPH_TEMPLATES = [];
for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
  for (let variant = 0; variant < VARIANTS_PER_CLASS; variant++) {
    const rand = seededRandom(pitchClass * 7919 + variant * 104729 + 13);
    const strokeCount = 1 + Math.floor(rand() * 3); // 1-3 primitives -- each one is already visually busy
    const strokes = [];
    for (let i = 0; i < strokeCount; i++) {
      const kind = STROKE_KINDS[Math.floor(rand() * STROKE_KINDS.length)];
      strokes.push({
        kind,
        x: 2 + rand() * (GLYPH_BOX - 4),
        y: 2 + rand() * (GLYPH_BOX - 4),
        angle: rand() * Math.PI * 2,
        length: 5 + rand() * 5,
        rx: 2 + rand() * 2.4,
        ry: 1.4 + rand() * 1.8,
        height: 8 + rand() * 5,
        r: 0.7 + rand() * 0.8,
      });
    }
    GLYPH_TEMPLATES.push(strokes);
  }
}

/**
 * Draws one glyph at (x, y), representing the given pitch class (0-11).
 * The variant is picked from jitterSeed, so repeated notes of the same
 * pitch class cycle through that class's 8 looks rather than repeating the
 * identical mark. Strength controls ink darkness; per-instance jitter on
 * top of the fixed template keeps it feeling handwritten rather than
 * stamped.
 */
export function drawGlyph(ctx, x, y, pitchClass, strength, inkColor, jitterSeed, sizeMult = 1, skew = 0) {
  const pc = ((pitchClass % 12) + 12) % 12;
  const variant = jitterSeed % VARIANTS_PER_CLASS;
  const template = GLYPH_TEMPLATES[pc * VARIANTS_PER_CLASS + variant];
  const jitter = seededRandom(jitterSeed >>> 0);
  const scale = (0.85 + jitter() * 0.35) * sizeMult;
  const rotJitter = (jitter() - 0.5) * 0.22;
  const alphaBase = 0.55 + strength * 0.35;

  ctx.save();
  ctx.translate(x, y);
  if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.rotate(rotJitter);
  ctx.scale(scale, scale);
  template.forEach((s) => {
    const dx = (jitter() - 0.5) * 1.2;
    const dy = (jitter() - 0.5) * 1.2;
    const a = alphaBase * (0.7 + jitter() * 0.3);
    if (s.kind === 'loop') drawLoop(ctx, s.x + dx, s.y + dy, s.angle, s.rx, s.ry, inkColor, a);
    else if (s.kind === 'curl') drawCurl(ctx, s.x + dx, s.y + dy, s.angle, s.length, inkColor, a);
    else if (s.kind === 'stem') drawStemLoop(ctx, s.x + dx, s.y + dy - s.height * 0.5, s.height, inkColor, a);
    else drawPip(ctx, s.x + dx, s.y + dy, s.r, inkColor, a);
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
  const baseR = 1.8 + strength * 4.5;

  ctx.save();
  ctx.fillStyle = inkColor;
  ctx.globalAlpha = 0.55 + strength * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.fill();

  // A few small satellite droplets around the main blot.
  const dropletCount = 2 + Math.floor(strength * 5);
  for (let i = 0; i < dropletCount; i++) {
    const a = jitter() * Math.PI * 2;
    const d = baseR * (0.8 + jitter() * 1.6);
    const r = baseR * (0.12 + jitter() * 0.24);
    ctx.globalAlpha = (0.4 + strength * 0.3) * (0.6 + jitter() * 0.4);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export const GLYPH_ADVANCE = GLYPH_BOX + 6; // horizontal spacing between glyphs, including a gap
