// BrandWatermark.js
//
// Ported from Rudiment: faded vertical wordmark filling the dead space
// between the last content row and the transport. Reads
// layout.watermarkZone rather than computing its own position, same
// reasoning as the original — anchored to two fixed points so it can
// never collide with either regardless of panel content.

import { theme } from "../theme/theme.js";

const WORDMARK = "TRANSIENT LAB";

export function drawBrandWatermark(ctx, canvas, layout) {
  const zone = layout.watermarkZone;
  if (!zone || zone.bottom <= zone.top) return;

  const cellSize = 16;
  const cellGap = 4;
  const iconWidth = cellSize * 3 + cellGap * 2;
  const iconReserve = iconWidth + 10;
  const availableForText = zone.bottom - zone.top - iconReserve - 12;
  if (availableForText < 20) return; // zone too small to draw legibly — skip rather than overlap

  // The font size was previously just capped at a flat 30px based on
  // the zone's HEIGHT alone -- it never actually checked how wide the
  // word "TRANSIENT LAB" renders at that size (which becomes the
  // vertical extent once rotated). That's a latent bug: a longer word
  // than Rudiment's "RUDIMENT" could silently overflow past the top of
  // the zone at the same fixed cap. Measuring properly here also lets
  // the watermark go genuinely bigger/bolder (matching Rudiment's
  // visual weight, which this was previously undershooting) whenever
  // the zone has the room for it, rather than settling for a
  // conservative fixed number.
  ctx.font = `bold 100px -apple-system, system-ui, sans-serif`;
  const widthAt100 = ctx.measureText(WORDMARK).width;
  const fontSize = Math.max(14, Math.min(44, (availableForText / widthAt100) * 100));

  ctx.save();
  ctx.globalAlpha = 0.55; // more prominent than the original 0.3 -- Rudiment's reads as solid, not barely-there

  ctx.translate(zone.x + fontSize * 0.55, zone.bottom - iconReserve);
  ctx.rotate(-Math.PI / 2);

  const cell1X = -iconReserve + 5;
  const cell2X = cell1X + cellSize + cellGap;
  const cell3X = cell2X + cellSize + cellGap;
  const cellY = -cellSize / 2;

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(cell1X, cellY, cellSize, cellSize);
  ctx.strokeRect(cell2X, cellY, cellSize, cellSize);

  ctx.fillStyle = theme.accentDeep;
  ctx.fillRect(cell3X, cellY, cellSize, cellSize);

  // Hit line marker instead of Rudiment's vertical playhead line — a
  // horizontal tick through the lit cell, echoing this app's fixed
  // hit line being horizontal rather than vertical.
  const tickY = cellY + cellSize / 2;
  ctx.strokeStyle = theme.playhead;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cell3X - 7, tickY);
  ctx.lineTo(cell3X + cellSize + 7, tickY);
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSize}px -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = theme.accentDeep;
  ctx.fillText(WORDMARK, 0, 0);
  ctx.restore();
}
