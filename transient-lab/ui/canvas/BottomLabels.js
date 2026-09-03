import { theme } from "../theme/theme.js";

import { bottomLabelHeight } from "../../core/state/Layout.js";

import { getUsedNotesForActiveLesson } from "../../core/state/ContentState.js";

const INACTIVE_ALPHA = .18;

export function drawBottomLabels(ctx, gridGeometry) {
  const {gridStartX: gridStartX, laneWidth: laneWidth, gridBottom: gridBottom, lanes: lanes} = gridGeometry;
  const stripHeight = bottomLabelHeight;
  const blackKeyHeight = stripHeight * .6;
  const usedNotes = getUsedNotesForActiveLesson();
  lanes.forEach((lane, i) => {
    if (lane.isBlack) return;
    const x = gridStartX + i * laneWidth;
    const isUsed = usedNotes.has(lane.noteNumber);
    ctx.globalAlpha = isUsed ? 1 : INACTIVE_ALPHA;
    ctx.fillStyle = theme.fieldBg;
    ctx.fillRect(x, gridBottom, laneWidth, stripHeight);
    if (isUsed) {
      ctx.fillStyle = theme.accentBgSubtle;
      ctx.fillRect(x, gridBottom, laneWidth, stripHeight);
    }
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(x, gridBottom, laneWidth, stripHeight);
    ctx.globalAlpha = 1;
  });
  lanes.forEach((lane, i) => {
    if (!lane.isBlack) return;
    const x = gridStartX + i * laneWidth;
    const isUsed = usedNotes.has(lane.noteNumber);
    ctx.globalAlpha = isUsed ? 1 : INACTIVE_ALPHA;
    ctx.fillStyle = theme.pianoKeyBlack;
    ctx.fillRect(x, gridBottom, laneWidth, blackKeyHeight);
    if (isUsed) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, gridBottom, laneWidth, 3);
    }
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(x, gridBottom, laneWidth, blackKeyHeight);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = "center";
  lanes.forEach((lane, i) => {
    if (lane.isBlack) return;
    const cx = gridStartX + i * laneWidth + laneWidth / 2;
    const isC = lane.label.startsWith("C");
    const isUsed = usedNotes.has(lane.noteNumber);
    ctx.font = isC ? "bold 13px -apple-system, system-ui, sans-serif" : "bold 11px -apple-system, system-ui, sans-serif";
    ctx.globalAlpha = isUsed ? 1 : INACTIVE_ALPHA;
    ctx.fillStyle = isC ? theme.accentDeep : isUsed ? theme.accent : theme.textPrimary;
    ctx.fillText(lane.label, cx, gridBottom + stripHeight - 10);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = "left";
}