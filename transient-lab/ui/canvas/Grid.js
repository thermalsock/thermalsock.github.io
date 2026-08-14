// Grid.js
//
// Rotated version of Rudiment's Grid.js. There, fixed horizontal lanes
// (rows) scrolled left-to-right past a fixed vertical playhead. Here,
// fixed vertical pitch columns run top-to-bottom, and content falls
// DOWN past a horizontal hit line — same alternating-shade-per-lane
// and major/minor gridline conventions, just swapped onto the other
// axis.

import {
  leftPanelWidth,
  gridStartX,
  gridEndXPadding,
  noteGridTop,
  stepHeight,
  canvasHeight,
  bottomLabelHeight,
  HIT_LINE_PERCENT_FROM_BOTTOM
} from "../../core/state/Layout.js";

import { getActiveLanes } from "../../core/state/PitchLanes.js";
import { getActiveChord, getUsedNotesForActiveLesson } from "../../core/state/ContentState.js";
import { controlsState } from "../../core/state/ControlsState.js";
import { midiState } from "../../core/midi/MidiState.js";
import { theme } from "../theme/theme.js";

export function drawGrid(ctx, canvas) {
  const lanes = getActiveLanes();
  const gridTop = noteGridTop;
  const gridBottom = canvasHeight - bottomLabelHeight; // leaves room for the piano-key strip
  const gridHeight = gridBottom - gridTop;

  // Hit line sits HIT_LINE_PERCENT_FROM_BOTTOM of the way up from the
  // grid's bottom edge (not flush against it) -- see Layout.js. This
  // is now computed here, from the grid's own real height, and
  // returned in gridGeometry so Blocks.js positions everything off the
  // same single value instead of a separately-imported constant that
  // could drift out of sync with the actual grid bounds.
  const hitLineY = gridBottom - HIT_LINE_PERCENT_FROM_BOTTOM * gridHeight;

  const totalWidth = canvas.width - gridStartX - gridEndXPadding;
  const laneWidth = totalWidth / lanes.length;

  // At 36 lanes, alternating-by-index shading (Rudiment's convention)
  // stops being readable as "which column am I looking at" -- so this
  // shades by white/black key instead, same visual logic as a real
  // keyboard. isBlack comes from PitchLanes.js, not computed here.
  //
  // On top of that: the active lesson chord's notes light up in the
  // accent color, full height -- a static content preview (see
  // ContentState.js), shown only while NOT playing. Once playback
  // starts, the real falling blocks (Blocks.js) carry per-note timing
  // and judgement color -- showing both at once would fight each other.
  const chord = getActiveChord();
  const chordNotes = (chord && !controlsState.isPlaying) ? new Set(chord.notes) : new Set();

  // Every lane whose note this lesson never actually uses gets faded
  // -- 30+ mostly-irrelevant lanes competing for attention was the
  // problem; a lesson typically only touches a handful of notes.
  // Any note in chordNotes is by construction also in usedNotes (the
  // active chord is one of the lesson's own chords), so there's no
  // conflict between the two -- the highlighted chord-preview lane is
  // always full-opacity.
  //
  // Two separate signals were riding on opacity alone before (1.0 vs
  // 0.35, against an already-light grey/white palette), which made
  // "is this lane active" a squint-and-compare judgement rather than
  // something readable at a glance. Used lanes now also get a faint
  // accent wash (accentBgSubtle) on top of their normal white/black
  // key shading -- a color cue in addition to opacity, not instead of
  // it -- and inactive lanes fade further (down from 0.35) now that
  // there's a real gap to create between the two states.
  const usedNotes = getUsedNotesForActiveLesson();
  const INACTIVE_ALPHA = 0.18;

  for (let i = 0; i < lanes.length; i++) {
    const x = gridStartX + i * laneWidth;
    const inChord = chordNotes.has(lanes[i].noteNumber);
    const isUsed = usedNotes.has(lanes[i].noteNumber);

    ctx.globalAlpha = isUsed ? 1 : INACTIVE_ALPHA;
    ctx.fillStyle = lanes[i].isBlack ? theme.gridBgInactive : theme.gridBgA;
    ctx.fillRect(x, gridTop, laneWidth, gridHeight);
    if (isUsed && !inChord) {
      // Subtle accent wash for "used somewhere in this lesson" --
      // distinct from (and weaker than) the strong accentBg fill below
      // reserved for the specific chord being previewed right now.
      ctx.fillStyle = theme.accentBgSubtle;
      ctx.fillRect(x, gridTop, laneWidth, gridHeight);
    }
    if (inChord) {
      ctx.fillStyle = theme.accentBg;
      ctx.fillRect(x, gridTop, laneWidth, gridHeight);
    }
    ctx.globalAlpha = 1;

    if (inChord) {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, gridTop + 1, laneWidth - 2, gridHeight - 2);
      ctx.lineWidth = 1;
    }
  }

  // Lane divider lines (vertical, between columns)
  for (let i = 0; i <= lanes.length; i++) {
    const x = gridStartX + i * laneWidth;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridBottom);
    ctx.strokeStyle = theme.border;
    ctx.stroke();
  }

  // Horizontal subdivision lines (time), major every 4 steps — same
  // convention as Rudiment's step gridlines, just running the other way.
  const rows = Math.ceil(gridHeight / stepHeight);
  for (let r = 0; r <= rows; r++) {
    const y = gridTop + r * stepHeight;
    ctx.beginPath();
    ctx.moveTo(gridStartX, y);
    ctx.lineTo(gridStartX + totalWidth, y);
    ctx.strokeStyle = r % 4 === 0 ? theme.gridLineMajor : theme.gridLineMinor;
    ctx.stroke();
  }

  // Hit line — the judgement line, rotated equivalent of Rudiment's
  // Playhead.js. Now sits 15% up from the grid's bottom edge instead
  // of flush against it, leaving a visible "linger zone" below where a
  // just-played block is still on screen for a moment, rather than
  // vanishing the instant it arrives.
  ctx.beginPath();
  ctx.moveTo(gridStartX, hitLineY);
  ctx.lineTo(gridStartX + totalWidth, hitLineY);
  ctx.strokeStyle = theme.playhead;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;

  // LIVE MIDI FEEDBACK — a filled marker at the hit line for any lane
  // whose note is currently held down on the connected controller.
  // Deliberately independent of isPlaying/judgement entirely: this is
  // "is a key physically down right now", full stop. theme.consistency
  // (blue) is used specifically because it's a different color from
  // every judgement state (hit/partial/miss) and the chord-preview
  // accent, so it never gets mistaken for scoring feedback.
  for (let i = 0; i < lanes.length; i++) {
    if (!midiState.heldNotes.has(lanes[i].noteNumber)) continue;
    const x = gridStartX + i * laneWidth;
    ctx.fillStyle = theme.consistency;
    ctx.fillRect(x + 1, hitLineY - 14, laneWidth - 2, 14);
  }

  return { gridStartX, totalWidth, laneWidth, gridTop, gridBottom, hitLineY, lanes };
}
