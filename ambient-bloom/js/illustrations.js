// illustrations.js
// Invented "impossible botanical" and astrological-rosette illustrations,
// in the spirit of the Voynich manuscript's strange plant drawings and
// circular star-diagrams — every shape here is generated from geometry
// with a seeded random, not traced or copied from the real manuscript.

function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A strange, unidentifiable plant: a root system, a stem, and an irregular
 * cluster of bulbous "petals"/leaves that don't resemble any real species
 * — the Voynich botanical section's whole character.
 */
export function drawWeirdFlower(ctx, x, y, scale, inkColor, seed) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = inkColor;
  ctx.fillStyle = inkColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.62;

  // Roots: a few branching curved lines beneath the baseline.
  const rootCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < rootCount; i++) {
    const a = (Math.PI * 0.5) + (rand() - 0.5) * 1.6;
    const len = 10 + rand() * 14;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const midX = Math.cos(a) * len * 0.5 + (rand() - 0.5) * 8;
    const midY = Math.sin(a) * len * 0.5;
    ctx.quadraticCurveTo(midX, midY, Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }

  // Stem: a gently curved line rising up.
  const stemH = 30 + rand() * 20;
  const stemLean = (rand() - 0.5) * 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(stemLean * 0.5, -stemH * 0.5, stemLean, -stemH);
  ctx.stroke();

  // A few leaves along the stem.
  const leafCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < leafCount; i++) {
    const t = 0.25 + (i / leafCount) * 0.6;
    const lx = stemLean * t, ly = -stemH * t;
    const side = rand() < 0.5 ? -1 : 1;
    const leafLen = 8 + rand() * 10;
    const leafAngle = side * (0.6 + rand() * 0.5);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(
      lx + Math.cos(leafAngle) * leafLen * 0.6, ly - Math.sin(Math.abs(leafAngle)) * leafLen * 0.3,
      lx + Math.cos(leafAngle) * leafLen, ly - leafLen * 0.4
    );
    ctx.quadraticCurveTo(
      lx + Math.cos(leafAngle) * leafLen * 0.5, ly - leafLen * 0.15,
      lx, ly
    );
    ctx.stroke();
  }

  // The flower head: an irregular cluster of bulbous overlapping shapes --
  // deliberately not a real, identifiable flower structure.
  const headX = stemLean, headY = -stemH;
  const petalCount = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 + rand() * 0.4;
    const rOut = 6 + rand() * 10;
    const px = headX + Math.cos(a) * rOut * 0.5;
    const py = headY + Math.sin(a) * rOut * 0.5 * 0.8;
    ctx.beginPath();
    ctx.ellipse(px, py, rOut * 0.5, rOut * 0.28, a, 0, Math.PI * 2);
    ctx.globalAlpha = 0.4 + rand() * 0.2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(headX, headY, 3 + rand() * 2, 0, Math.PI * 2);
  ctx.globalAlpha = 0.55;
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * A circular astrological-style rosette: concentric rings with small
 * radiating marks and star-points, evoking the manuscript's cosmological
 * diagrams without reproducing any real zodiac or star-chart content.
 */
export function drawRosette(ctx, x, y, radius, inkColor, seed) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = inkColor;
  ctx.fillStyle = inkColor;
  ctx.lineWidth = 0.8;

  const ringCount = 2 + Math.floor(rand() * 2);
  for (let ring = 0; ring < ringCount; ring++) {
    const r = radius * (0.35 + ring * (0.65 / ringCount));
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    const pointCount = 8 + Math.floor(rand() * 6);
    for (let i = 0; i < pointCount; i++) {
      const a = (i / pointCount) * Math.PI * 2 + rand() * 0.15;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (rand() < 0.5) {
        // A tiny star-point mark.
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        const starR = 1.2 + rand() * 1.3;
        for (let k = 0; k < 8; k++) {
          const sa = (k / 8) * Math.PI * 2;
          const sr = k % 2 === 0 ? starR : starR * 0.4;
          const sx = px + Math.cos(sa) * sr, sy = py + Math.sin(sa) * sr;
          if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        // A small radial tick mark instead.
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94);
        ctx.lineTo(Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06);
        ctx.stroke();
      }
    }
  }

  // Center mark.
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * Filled silhouette version of the flower, for background-bloom use where
 * heavy blur is applied -- thin strokes vanish under blur, so this uses
 * solid filled shapes instead, sized to still read as a recognizable
 * silhouette once softened.
 */
export function drawFlowerSilhouette(ctx, x, y, scale, color, alpha, seed) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;

  const stemH = 34 + rand() * 18;
  const stemLean = (rand() - 0.5) * 14;

  // Stem as a thick filled band.
  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.quadraticCurveTo(stemLean * 0.5 - 2, -stemH * 0.5, stemLean - 2, -stemH);
  ctx.lineTo(stemLean + 2, -stemH);
  ctx.quadraticCurveTo(stemLean * 0.5 + 2, -stemH * 0.5, 2, 4);
  ctx.closePath();
  ctx.fill();

  // Flower head: filled overlapping petal blobs.
  const headX = stemLean, headY = -stemH;
  const petalCount = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 + rand() * 0.4;
    const rOut = 10 + rand() * 14;
    const px = headX + Math.cos(a) * rOut * 0.5;
    const py = headY + Math.sin(a) * rOut * 0.5 * 0.8;
    ctx.beginPath();
    ctx.ellipse(px, py, rOut * 0.6, rOut * 0.36, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(headX, headY, 6 + rand() * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * Filled silhouette version of the rosette, for background-bloom use.
 */
export function drawRosetteSilhouette(ctx, x, y, radius, color, alpha, seed) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2, true);
  ctx.fill('evenodd');

  const pointCount = 8 + Math.floor(rand() * 6);
  for (let i = 0; i < pointCount; i++) {
    const a = (i / pointCount) * Math.PI * 2;
    const r = radius * 0.85;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}
