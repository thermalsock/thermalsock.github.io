import { BEATS_VISIBLE } from "../../core/state/Layout.js";

import { theme } from "../theme/theme.js";

import { getAllJudgements } from "../../core/scoring/JudgementEngine.js";

import { getActivePack } from "../../core/state/ContentState.js";

const JUDGEMENT_COLOR = {
  pending: null,
  hit: "streak",
  partial: "score",
  miss: "playhead",
  dropped: "streakPro"
};

function drawBar(ctx, x, laneWidth, yOnset, yTrailing, gridTop, gridBottom, fillColor, alpha) {
  const rectTop = Math.max(yTrailing, gridTop);
  const rectBottom = Math.min(yOnset, gridBottom);
  const rectHeight = Math.max(3, rectBottom - rectTop);
  const barWidth = laneWidth * .55;
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
  if (bottom < gridTop - 5 || top > gridBottom + 5) return;
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
  if (h >= size * .6) {
    const circleR = size * .22;
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
  const {gridStartX: gridStartX, laneWidth: laneWidth, gridTop: gridTop, gridBottom: gridBottom, hitLineY: hitLineY, lanes: lanes} = gridGeometry;
  const approachHeight = hitLineY - gridTop;
  const pixelsPerBeat = approachHeight / BEATS_VISIBLE;
  const noteToLaneIndex = new Map(lanes.map((lane, i) => [ lane.noteNumber, i ]));
  const judgements = getAllJudgements();
  const blockStyle = getActivePack().blockStyle || "bar";
  function yForBeat(beat) {
    return hitLineY - (beat - currentBeat) * pixelsPerBeat;
  }
  timeline.events.forEach((event, i) => {
    const yOnset = yForBeat(event.hitBeat);
    const yTrailing = yForBeat(event.hitBeat + event.beats);
    if (blockStyle === "bar") {
      if (yTrailing < gridTop - 20 && yOnset < gridTop - 20) return;
      if (yTrailing > gridBottom + 20) return;
    } else {
      if (yOnset < gridTop - 40 && yOnset > gridBottom + 40) return;
    }
    const judgement = judgements[i] || "pending";
    const colorKey = JUDGEMENT_COLOR[judgement];
    const alpha = judgement === "pending" ? .9 : .55;
    event.notes.forEach(noteNumber => {
      const laneIndex = noteToLaneIndex.get(noteNumber);
      if (laneIndex === undefined) return;
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