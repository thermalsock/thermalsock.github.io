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
  if (availableForText < 20) return;
  ctx.font = `bold 100px -apple-system, system-ui, sans-serif`;
  const widthAt100 = ctx.measureText(WORDMARK).width;
  const fontSize = Math.max(14, Math.min(44, availableForText / widthAt100 * 100));
  ctx.save();
  ctx.globalAlpha = .55;
  ctx.translate(zone.x + fontSize * .55, zone.bottom - iconReserve);
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