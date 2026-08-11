import { leftPanelWidth, gridStartX, gridEndXPadding, noteGridTop, stepHeight, canvasHeight, bottomLabelHeight, HIT_LINE_PERCENT_FROM_BOTTOM } from "../../core/state/Layout.js";
import { getActiveLanes } from "../../core/state/PitchLanes.js";
import { getActiveChord, getUsedNotesForActiveLesson } from "../../core/state/ContentState.js";
import { controlsState } from "../../core/state/ControlsState.js";
import { midiState } from "../../core/midi/MidiState.js";
import { theme } from "../theme/theme.js";
export function drawGrid(ctx, canvas) {
    const lanes = getActiveLanes();
    const gridTop = noteGridTop;
    const gridBottom = canvasHeight - bottomLabelHeight;
    const gridHeight = gridBottom - gridTop;
    const hitLineY = gridBottom - HIT_LINE_PERCENT_FROM_BOTTOM * gridHeight;
    const totalWidth = canvas.width - gridStartX - gridEndXPadding;
    const laneWidth = totalWidth / lanes.length;
    const chord = getActiveChord();
    const chordNotes = (chord && !controlsState.isPlaying) ? new Set(chord.notes) : new Set();
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
    for (let i = 0; i <= lanes.length; i++) {
        const x = gridStartX + i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, gridTop);
        ctx.lineTo(x, gridBottom);
        ctx.strokeStyle = theme.border;
        ctx.stroke();
    }
    const rows = Math.ceil(gridHeight / stepHeight);
    for (let r = 0; r <= rows; r++) {
        const y = gridTop + r * stepHeight;
        ctx.beginPath();
        ctx.moveTo(gridStartX, y);
        ctx.lineTo(gridStartX + totalWidth, y);
        ctx.strokeStyle = r % 4 === 0 ? theme.gridLineMajor : theme.gridLineMinor;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(gridStartX, hitLineY);
    ctx.lineTo(gridStartX + totalWidth, hitLineY);
    ctx.strokeStyle = theme.playhead;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < lanes.length; i++) {
        if (!midiState.heldNotes.has(lanes[i].noteNumber))
            continue;
        const x = gridStartX + i * laneWidth;
        ctx.fillStyle = theme.consistency;
        ctx.fillRect(x + 1, hitLineY - 14, laneWidth - 2, 14);
    }
    return { gridStartX, totalWidth, laneWidth, gridTop, gridBottom, hitLineY, lanes };
}
