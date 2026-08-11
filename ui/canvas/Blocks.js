// Blocks.js
//
// Two visual styles now, chosen by the active pack's `blockStyle`
// field (see core/content/packs/*.js):
//
// "bar" (genre packs, default) -- the sustain-bar convention already
// documented below: a note's leading edge crosses the hit line at
// onset, its length represents how long to hold it. Made slightly
// THINNER than before (a fraction of the lane width, not nearly the
// full width) so it visually reads as a distinct style from scale
// markers, not just "the same bar, still there".
//
// "square" (scale packs) -- small square marker blocks with a circle
// indicator, matching a classic rhythm-game note-marker look (fixed
// size regardless of note duration, since scale drills are short
// quick notes, not sustained holds). Pending notes are colored per
// LANE (theme.laneSwatches) rather than the genre packs' single
// neutral color -- for a scale exercise, consistently coloring each
// scale degree is a genuine practice aid (you start recognizing "that
// note is always yellow"), which doesn't apply the same way to chords.
//
// Standard falling-note/sustain-bar convention (Guitar Hero, Clone
// Hero, Synthesia) still applies to the "bar" style: a note's LEADING
// edge (bottom, since it's falling) crosses the hit line exactly at
// its onset (hitBeat); its LENGTH represents how long it should be
// held.
//
// y(beat) = hitLineY - (beat - currentBeat) * pixelsPerBeat

import { BEATS_VISIBLE } from "../../core/state/Layout.js";
import { theme } from "../theme/theme.js";
import { getAllJudgements } from "../../core/scoring/JudgementEngine.js";
import { getActivePack } from "../../core/state/ContentState.js";

const JUDGEMENT_COLOR = {
  pending: null, // style-dependent -- see below
  hit: "streak",       // theme.streak (green) -- struck correctly, holding or held through
  partial: "score",    // theme.score (amber) -- wrong notes at the strike
  miss: "playhead",    // theme.playhead (red) -- nothing played near onset
  dropped: "streakPro" // theme.streakPro (purple) -- struck correctly, released too early
};

function drawBar(ctx, x, laneWidth, yOnset, yTrailing, gridTop, gridBottom, fillColor, alpha) {
  const rectTop = Math.max(yTrailing, gridTop);
  const rectBottom = Math.min(yOnset, gridBottom);
  const rectHeight = Math.max(3, rectBottom - rectTop);

  // Thinner than the old full-width bar -- ~55% of the lane, centered.
  const barWidth = laneWidth * 0.55;
  const barX = x + (laneWidth - barWidth) / 2;

  ctx.fillStyle = fillColor;
  ctx.globalAlpha = alpha;
  ctx.fillRect(barX, rectTop, barWidth, rectHeight);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = theme.border;
  ctx.strokeRect(barX, rectTop, barWidth, rectHeight);
}

function drawSquare(ctx, x, laneWidth, yOnset, gridTop, gridBottom, fillColor, alpha) {
  const size = Math.min(laneWidth - 6, 30);
  const bottom = Math.min(yOnset, gridBottom);
  const top = bottom - size;
  if (bottom < gridTop - 5 || top > gridBottom + 5) return; // fully outside, don't draw

  const clampedTop = Math.max(top, gridTop);
  const clampedBottom = Math.min(bottom, gridBottom);
  const h = clampedBottom - clampedTop;
  if (h <= 0) return;

  const cx = x + laneWidth / 2;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.roundRect(cx - size / 2, clampedTop, size, h, 5);
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Circle indicator, only drawn once the square is tall enough to
  // actually look like a circle-in-a-square rather than a sliver.
  if (h >= size * 0.6) {
    const circleR = size * 0.22;
    const circleCy = clampedTop + Math.min(h, size) / 2;
    ctx.beginPath();
    ctx.arc(cx, circleCy, circleR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.globalAlpha = 1;
}

export function drawBlocks(ctx, gridGeometry, timeline, currentBeat) {
  const { gridStartX, laneWidth, gridTop, gridBottom, hitLineY, lanes } = gridGeometry;

  const approachHeight = hitLineY - gridTop;
  const pixelsPerBeat = approachHeight / BEATS_VISIBLE;

  const noteToLaneIndex = new Map(lanes.map((lane, i) => [lane.noteNumber, i]));
  const judgements = getAllJudgements();
  const blockStyle = (getActivePack().blockStyle) || "bar";

  function yForBeat(beat) {
    return hitLineY - (beat - currentBeat) * pixelsPerBeat;
  }

  timeline.events.forEach((event, i) => {
    const yOnset = yForBeat(event.hitBeat);
    const yTrailing = yForBeat(event.hitBeat + event.beats);

    // Cull anything fully off-screen. Bar style uses yTrailing (see
    // the long-standing reasoning in this file's header comment --
    // that's what fixed blocks vanishing mid-hold); square style only
    // ever needs the onset position since it's not duration-stretched.
    if (blockStyle === "bar") {
      if (yTrailing < gridTop - 20 && yOnset < gridTop - 20) return;
      if (yTrailing > gridBottom + 20) return;
    } else {
      if (yOnset < gridTop - 40 && yOnset > gridBottom + 40) return;
    }

    const judgement = judgements[i] || "pending";
    const colorKey = JUDGEMENT_COLOR[judgement];
    const alpha = judgement === "pending" ? 0.9 : 0.55;

    event.notes.forEach(noteNumber => {
      const laneIndex = noteToLaneIndex.get(noteNumber);
      if (laneIndex === undefined) return; // note outside the visible lane range -- silently skip, not a crash

      const x = gridStartX + laneIndex * laneWidth;

      if (blockStyle === "square") {
        const fillColor = colorKey ? theme[colorKey] : theme.laneSwatches[laneIndex % theme.laneSwatches.length];
        drawSquare(ctx, x, laneWidth, yOnset, gridTop, gridBottom, fillColor, alpha);
      } else {
        const fillColor = colorKey ? theme[colorKey] : theme.noteBlock;
        drawBar(ctx, x, laneWidth, yOnset, yTrailing, gridTop, gridBottom, fillColor, alpha);
      }
    });
  });
}
