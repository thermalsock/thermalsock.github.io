// BottomLabels.js
//
// A piano-key strip below the grid, not just text labels -- white
// keys (natural notes, full-height) and black keys (sharps, shorter,
// drawn on top) in each lane's own column. This is a "flat" piano-roll
// style (each lane gets its own uniform-width cell, no physical
// left/right offset between keys) rather than a literal keyboard replica
// -- matches how most DAW piano rolls actually draw their key strip,
// and fits our uniform-lane-width grid without needing to redesign
// lane geometry.
//
// Keys the active lesson never uses are faded (same INACTIVE_ALPHA and
// same getUsedNotesForActiveLesson() as Grid.js, so the two stay in
// visual agreement about which lanes matter for this lesson). Used
// keys also get the same faint accentBgSubtle wash Grid.js applies to
// its columns, so the key strip and the grid above it read as one
// continuous "these lanes matter" signal rather than two separately-
// faded elements that happen to agree in the abstract.

import { theme } from "../theme/theme.js";
import { bottomLabelHeight } from "../../core/state/Layout.js";
import { getUsedNotesForActiveLesson } from "../../core/state/ContentState.js";

const INACTIVE_ALPHA = 0.18;

export function drawBottomLabels(ctx, gridGeometry) {
  const { gridStartX, laneWidth, gridBottom, lanes } = gridGeometry;

  const stripHeight = bottomLabelHeight;
  const blackKeyHeight = stripHeight * 0.6;
  const usedNotes = getUsedNotesForActiveLesson();

  // White keys first (full-height base layer), including the vertical
  // dividers between lanes so it reads as a row of individual keys.
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

  // Black keys on top -- shorter, dark, sitting at the top of the
  // strip (nearest the grid) the way a real black key only occupies
  // the upper portion of a keyboard's depth.
  lanes.forEach((lane, i) => {
    if (!lane.isBlack) return;
    const x = gridStartX + i * laneWidth;
    const isUsed = usedNotes.has(lane.noteNumber);
    ctx.globalAlpha = isUsed ? 1 : INACTIVE_ALPHA;
    ctx.fillStyle = theme.pianoKeyBlack;
    ctx.fillRect(x, gridBottom, laneWidth, blackKeyHeight);
    if (isUsed) {
      // pianoKeyBlack is a fixed dark tone (not theme-tinted), so the
      // wash goes on as a thin top-edge accent bar instead of a full
      // overlay -- a translucent wash over near-black barely reads,
      // where a solid accent sliver at the key's outer edge does.
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, gridBottom, laneWidth, 3);
    }
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(x, gridBottom, laneWidth, blackKeyHeight);
    ctx.globalAlpha = 1;
  });

  // Natural-note labels, prominent -- bold white text near the bottom
  // of each white key, C marked in the accent color so octave
  // boundaries are readable at a glance. Active labels also get an
  // accent-family color (not just full opacity) so the distinction
  // from inactive labels doesn't rely on alpha alone.
  ctx.textAlign = "center";
  lanes.forEach((lane, i) => {
    if (lane.isBlack) return;
    const cx = gridStartX + i * laneWidth + laneWidth / 2;
    const isC = lane.label.startsWith("C");
    const isUsed = usedNotes.has(lane.noteNumber);
    ctx.font = isC
      ? "bold 13px -apple-system, system-ui, sans-serif"
      : "bold 11px -apple-system, system-ui, sans-serif";
    ctx.globalAlpha = isUsed ? 1 : INACTIVE_ALPHA;
    ctx.fillStyle = isC ? theme.accentDeep : (isUsed ? theme.accent : theme.textPrimary);
    ctx.fillText(lane.label, cx, gridBottom + stripHeight - 10);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = "left";
}
