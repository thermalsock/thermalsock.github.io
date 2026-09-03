const STABILITY = {
  0: 1,
  7: .92,
  5: .85,
  4: .68,
  9: .68,
  3: .62,
  8: .62,
  2: .42,
  10: .42,
  1: .28,
  11: .28,
  6: .18
};

export function pitchClassColor(offset) {
  const hue = (offset % 12 + 12) % 12 * 30;
  return `hsl(${hue}, 55%, 42%)`;
}

export function pitchStability(offset) {
  return STABILITY[(offset % 12 + 12) % 12] ?? .5;
}

export function signedInterval(fromOffset, toOffset) {
  let diff = toOffset - fromOffset;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

export function intervalColor(signedSemitones) {
  const abs = Math.abs(signedSemitones);
  if (abs === 0) return "#8AA0B8";
  if (abs === 6) return "#FF5A6E";
  if (abs === 5 || abs === 7) return "#3f7a4f";
  if (abs <= 2) return "#33475C";
  return "#9a6a1f";
}

export function drawPitchVision(ctx, x, y, offset, direction) {
  const color = pitchClassColor(offset);
  const stability = pitchStability(offset);
  const r = 9 + stability * 6;
  ctx.save();
  ctx.globalAlpha = .32 + stability * .42;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (direction !== 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.globalAlpha = .55;
    const dy = direction > 0 ? 9 : -9;
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x, y + dy * .25);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawIntervalVision(ctx, x, y, signedSemitones) {
  if (signedSemitones === 0) return;
  const len = 8 + Math.abs(signedSemitones) * 3.2;
  const color = intervalColor(signedSemitones);
  const rise = signedSemitones < 0 ? 7 : -7;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.globalAlpha = .6;
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y - rise);
  ctx.lineTo(x + len / 2, y + rise);
  ctx.stroke();
  ctx.restore();
}