// vision.js
// The "Perceptual Upgrade" system's Level 2 and 3 hints — Pitch Vision and
// Interval Vision — drawn as brief telegraphs on the page canvas just
// before each note plays during the Listen phase, once unlocked.
//
// Levels 4-6 (Triad Vision, Progression Vision, Melody Vision, Rhythm
// Vision, Mastery) are NOT implemented here — there's no triad, chord-
// progression, melody-contour, or rhythm gameplay yet for them to attach
// to. Building convincing placeholder icons for mechanics that don't
// exist would be worse than just not having them yet.

const STABILITY = { 0: 1.0, 7: 0.92, 5: 0.85, 4: 0.68, 9: 0.68, 3: 0.62, 8: 0.62, 2: 0.42, 10: 0.42, 1: 0.28, 11: 0.28, 6: 0.18 };

/** Color = pitch class, spread evenly around the hue wheel so all 12
 * classes are visually distinct and the mapping is consistent every time
 * that class appears. */
export function pitchClassColor(offset) {
  const hue = (((offset % 12) + 12) % 12) * 30;
  return `hsl(${hue}, 55%, 42%)`;
}

/** Glow intensity = stability (tonic/5th/4th read as consonant and
 * "at rest"; 2nds, 7ths, and the tritone read as tense) — a simple,
 * standard consonance ranking relative to the tonic, not a claim about
 * the specific mode's own characteristic tones. */
export function pitchStability(offset) {
  return STABILITY[((offset % 12) + 12) % 12] ?? 0.5;
}

/** Signed shortest-path interval (in semitones, -6..+6) from one relative
 * offset to the next — positive is ascending, negative descending, taking
 * whichever direction around the 12-tone circle is actually shorter. */
export function signedInterval(fromOffset, toOffset) {
  let diff = toOffset - fromOffset;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

/** Color = interval quality — perfect intervals read as stable, the
 * tritone as tension, steps and leaps distinguished from each other. */
export function intervalColor(signedSemitones) {
  const abs = Math.abs(signedSemitones);
  if (abs === 0) return '#6b6153';
  if (abs === 6) return '#b8402a';        // tritone — tension
  if (abs === 5 || abs === 7) return '#3f7a4f'; // perfect 4th/5th — stable
  if (abs <= 2) return '#33475C';          // step (2nd)
  return '#9a6a1f';                        // 3rd/leap
}

/**
 * Pitch Vision: a small glowing dot, colored by pitch class, glow
 * strength by stability, with a short directional stroke hinting
 * ascending/descending relative to the previous note (direction: -1, 0, 1).
 */
export function drawPitchVision(ctx, x, y, offset, direction) {
  const color = pitchClassColor(offset);
  const stability = pitchStability(offset);
  const r = 9 + stability * 6;

  ctx.save();
  ctx.globalAlpha = 0.32 + stability * 0.42;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  if (direction !== 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55;
    const dy = direction > 0 ? 9 : -9;
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x, y + dy * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Interval Vision: a tilted line whose length encodes interval size and
 * color encodes quality — drawn alongside (not instead of) the Pitch
 * Vision dot for the same note, since they answer different questions
 * ("what note" vs. "how far from the last one").
 */
export function drawIntervalVision(ctx, x, y, signedSemitones) {
  if (signedSemitones === 0) return;
  const len = 8 + Math.abs(signedSemitones) * 3.2;
  const color = intervalColor(signedSemitones);
  const rise = signedSemitones < 0 ? 7 : -7;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y - rise);
  ctx.lineTo(x + len / 2, y + rise);
  ctx.stroke();
  ctx.restore();
}
