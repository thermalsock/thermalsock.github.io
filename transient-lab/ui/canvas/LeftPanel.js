import { leftPanelWidth } from "../../core/state/Layout.js";

import { bpm, bpmString, editingBPM } from "../../core/state/UIState.js";

import { midiState } from "../../core/midi/MidiState.js";

import { controlsState } from "../../core/state/ControlsState.js";

import { getLeftPanelLayout } from "../../core/state/LeftPanelLayout.js";

import { getActiveLesson, getActivePack, getAvailablePacks, contentState, SCALE_TYPES, getActiveScaleType } from "../../core/state/ContentState.js";

import { theme } from "../theme/theme.js";

import { drawBrandWatermark } from "./BrandWatermark.js";

function labelY(box) {
  return box.y - 7;
}

export function drawLeftPanel(ctx, canvas) {
  const layout = getLeftPanelLayout();
  ctx.fillStyle = theme.panelBg;
  ctx.fillRect(0, 0, leftPanelWidth, canvas.height);
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  const brandX = 20;
  const cellSize = 8;
  const cellGap = 2;
  const cellY = 16;
  const cell1X = brandX;
  const cell2X = cell1X + cellSize + cellGap;
  const cell3X = cell2X + cellSize + cellGap;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(cell1X, cellY, cellSize, cellSize);
  ctx.strokeRect(cell2X, cellY, cellSize, cellSize);
  ctx.fillStyle = theme.accentDeep;
  ctx.fillRect(cell3X, cellY, cellSize, cellSize);
  const tickY = cellY + cellSize / 2;
  ctx.strokeStyle = theme.playhead;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cell3X - 5, tickY);
  ctx.lineTo(cell3X + cellSize + 5, tickY);
  ctx.stroke();
  ctx.lineWidth = 1;
  const textX = cell3X + cellSize + 9;
  ctx.font = "bold 18px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.accentDeep;
  ctx.fillText("TRANSIENT LAB", textX, 28);
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText("Thermalsock Labs", textX, 43);
  const midiBox = layout.midiStatusBox;
  const deviceNames = midiState.connectedDeviceNames;
  const connected = midiState.supported && deviceNames.length > 0;
  ctx.fillStyle = connected ? theme.accentBg : theme.fieldBg;
  ctx.strokeStyle = connected ? theme.accent : theme.border;
  ctx.fillRect(midiBox.x, midiBox.y, midiBox.w, midiBox.h);
  ctx.strokeRect(midiBox.x, midiBox.y, midiBox.w, midiBox.h);
  ctx.font = "bold 11px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = connected ? theme.accentDeep : theme.textDim;
  if (!connected) {
    ctx.fillText(midiState.supported ? "No synth connected" : "MIDI unavailable", midiBox.x + 7, midiBox.y + 19);
  } else {
    const line1 = deviceNames[0];
    let line2 = null;
    if (deviceNames.length === 2) line2 = deviceNames[1]; else if (deviceNames.length > 2) line2 = `+${deviceNames.length - 1} more`;
    ctx.fillText(line1, midiBox.x + 7, midiBox.y + 18);
    if (line2) {
      ctx.font = "10px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = theme.textSecondary;
      ctx.fillText(line2, midiBox.x + 7, midiBox.y + 33);
    }
  }
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  const sc = layout.scalesHalf;
  const gn = layout.genresHalf;
  const inScales = contentState.contentCategory === "scales";
  ctx.fillStyle = inScales ? theme.accent : theme.buttonBg;
  ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
  ctx.fillStyle = !inScales ? theme.accent : theme.buttonBg;
  ctx.fillRect(gn.x, gn.y, gn.w, gn.h);
  ctx.strokeStyle = theme.border;
  ctx.strokeRect(sc.x, sc.y, sc.w, sc.h);
  ctx.strokeRect(gn.x, gn.y, gn.w, gn.h);
  ctx.font = "bold 11px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = inScales ? theme.textOnAccent : theme.textSecondary;
  ctx.fillText("SCALES", sc.x + sc.w / 2, sc.y + sc.h / 2 + 4);
  ctx.fillStyle = !inScales ? theme.textOnAccent : theme.textSecondary;
  ctx.fillText("GENRES", gn.x + gn.w / 2, gn.y + gn.h / 2 + 4);
  ctx.textAlign = "left";
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  if (inScales && layout.scaleTypeBox) {
    const stBox = layout.scaleTypeBox;
    const activeType = getActiveScaleType();
    ctx.fillStyle = contentState.scaleTypeDropdownOpen ? theme.fieldBgActive : theme.fieldBg;
    ctx.strokeStyle = contentState.scaleTypeDropdownOpen ? theme.borderStrong : theme.border;
    ctx.fillRect(stBox.x, stBox.y, stBox.w, stBox.h);
    ctx.strokeRect(stBox.x, stBox.y, stBox.w, stBox.h);
    ctx.font = "8px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.fillText("SCALE TYPE", stBox.x + 7, stBox.y + 11);
    ctx.font = "bold 12px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(activeType.label, stBox.x + 7, stBox.y + 27);
    ctx.font = "10px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.textAlign = "right";
    ctx.fillText("▾", stBox.x + stBox.w - 8, stBox.y + 22);
    ctx.textAlign = "left";
    if (contentState.scaleTypeDropdownOpen) {
      const listStartY = stBox.y + stBox.h + 6;
      SCALE_TYPES.forEach((t, i) => {
        const itemY = listStartY + i * 26;
        const isActive = i === contentState.scaleTypeIndex;
        ctx.fillStyle = isActive ? theme.accentBg : theme.moduleBg;
        ctx.strokeStyle = isActive ? theme.accent : theme.border;
        ctx.fillRect(stBox.x, itemY, stBox.w, 24);
        ctx.strokeRect(stBox.x, itemY, stBox.w, 24);
        ctx.fillStyle = isActive ? theme.accentDeep : theme.textPrimary;
        ctx.font = "11px -apple-system, system-ui, sans-serif";
        ctx.fillText(t.label, stBox.x + 7, itemY + 16);
      });
      const dropdownBottom = listStartY + SCALE_TYPES.length * 26;
      ctx.fillStyle = theme.panelBg;
      ctx.fillRect(0, dropdownBottom, leftPanelWidth, canvas.height - dropdownBottom);
      ctx.font = "12px -apple-system, system-ui, sans-serif";
      return;
    }
  }
  const packBox = layout.packBox;
  const activePack = getActivePack();
  ctx.fillStyle = contentState.packDropdownOpen ? theme.fieldBgActive : theme.fieldBg;
  ctx.strokeStyle = contentState.packDropdownOpen ? theme.borderStrong : theme.border;
  ctx.fillRect(packBox.x, packBox.y, packBox.w, packBox.h);
  ctx.strokeRect(packBox.x, packBox.y, packBox.w, packBox.h);
  ctx.font = "8px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText(inScales ? "SCALE" : "GENRE", packBox.x + 7, packBox.y + 11);
  ctx.font = "bold 12px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(activePack.name, packBox.x + 7, packBox.y + 27);
  ctx.font = "10px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.textAlign = "right";
  ctx.fillText("▾", packBox.x + packBox.w - 8, packBox.y + 22);
  ctx.textAlign = "left";
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  if (contentState.packDropdownOpen) {
    const packs = getAvailablePacks();
    const listStartY = packBox.y + packBox.h + 6;
    packs.forEach((p, i) => {
      const itemY = listStartY + i * 26;
      const isActive = i === contentState.packIndex;
      ctx.fillStyle = isActive ? theme.accentBg : theme.moduleBg;
      ctx.strokeStyle = isActive ? theme.accent : theme.border;
      ctx.fillRect(packBox.x, itemY, packBox.w, 24);
      ctx.strokeRect(packBox.x, itemY, packBox.w, 24);
      ctx.fillStyle = isActive ? theme.accentDeep : theme.textPrimary;
      ctx.font = "11px -apple-system, system-ui, sans-serif";
      ctx.fillText(p.name, packBox.x + 7, itemY + 16);
    });
    const dropdownBottom = listStartY + packs.length * 26;
    ctx.fillStyle = theme.panelBg;
    ctx.fillRect(0, dropdownBottom, leftPanelWidth, canvas.height - dropdownBottom);
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    return;
  }
  const bpmBox = layout.bpmBox;
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText("BPM", bpmBox.x, labelY(bpmBox));
  ctx.fillStyle = editingBPM ? theme.fieldBgActive : theme.fieldBg;
  ctx.strokeStyle = editingBPM ? theme.borderStrong : theme.border;
  ctx.fillRect(bpmBox.x, bpmBox.y, bpmBox.w, bpmBox.h);
  ctx.strokeRect(bpmBox.x, bpmBox.y, bpmBox.w, bpmBox.h);
  ctx.font = "bold 14px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textPrimary;
  const bpmText = editingBPM ? bpmString.length ? bpmString : "" : String(bpm);
  ctx.fillText(bpmText, bpmBox.x + 6, bpmBox.y + 20);
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  const tapBox = layout.tapTempoBox;
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText("Tap Tempo", tapBox.x, labelY(tapBox));
  ctx.fillStyle = theme.buttonBg;
  ctx.strokeStyle = theme.border;
  ctx.fillRect(tapBox.x, tapBox.y, tapBox.w, tapBox.h);
  ctx.strokeRect(tapBox.x, tapBox.y, tapBox.w, tapBox.h);
  ctx.fillStyle = theme.textDim;
  ctx.textAlign = "center";
  ctx.fillText("Tap here", tapBox.x + tapBox.w / 2, tapBox.y + tapBox.h / 2 + 4);
  ctx.textAlign = "left";
  const nlBox = layout.nowLearningBox;
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText("Now Learning", nlBox.x, labelY(nlBox));
  ctx.fillStyle = contentState.lessonDropdownOpen ? theme.fieldBgActive : theme.fieldBg;
  ctx.strokeStyle = contentState.lessonDropdownOpen ? theme.borderStrong : theme.border;
  ctx.fillRect(nlBox.x, nlBox.y, nlBox.w, nlBox.h);
  ctx.strokeRect(nlBox.x, nlBox.y, nlBox.w, nlBox.h);
  const lesson = getActiveLesson();
  ctx.fillStyle = theme.textPrimary;
  ctx.font = "bold 13px -apple-system, system-ui, sans-serif";
  ctx.fillText(lesson.title, nlBox.x + 7, nlBox.y + 19);
  ctx.font = "10px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText(activePack.name, nlBox.x + 7, nlBox.y + 35);
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  if (contentState.lessonDropdownOpen) {
    const startY = nlBox.y + nlBox.h + 6;
    activePack.lessons.forEach((l, i) => {
      const itemY = startY + i * 26;
      const isActive = i === contentState.lessonIndex;
      ctx.fillStyle = isActive ? theme.accentBg : theme.moduleBg;
      ctx.strokeStyle = isActive ? theme.accent : theme.border;
      ctx.fillRect(nlBox.x, itemY, nlBox.w, 24);
      ctx.strokeRect(nlBox.x, itemY, nlBox.w, 24);
      ctx.fillStyle = isActive ? theme.accentDeep : theme.textPrimary;
      ctx.font = "11px -apple-system, system-ui, sans-serif";
      ctx.fillText(l.title, nlBox.x + 7, itemY + 16);
    });
    const dropdownBottom = startY + activePack.lessons.length * 26;
    ctx.fillStyle = theme.panelBg;
    ctx.fillRect(0, dropdownBottom, leftPanelWidth, canvas.height - dropdownBottom);
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    return;
  }
  drawTransport(ctx, layout);
  drawBrandWatermark(ctx, canvas, layout);
}

function drawTransport(ctx, layout) {
  const t = layout.transport;
  const pad = 9;
  const cardX = t.start.x - pad;
  const cardY = t.y - pad;
  const cardW = t.reset.x + t.reset.w - t.start.x + pad * 2;
  const cardH = t.size + pad * 2;
  ctx.fillStyle = theme.moduleBg;
  ctx.strokeStyle = theme.border;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 9);
  ctx.fill();
  ctx.stroke();
  function transportButton(box, iconFn, active) {
    ctx.fillStyle = active ? theme.buttonActiveBg : theme.buttonBg;
    ctx.strokeStyle = active ? theme.buttonActiveBorder : theme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 6);
    ctx.fill();
    ctx.stroke();
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.fillStyle = active ? theme.accentDeep : theme.textSecondary;
    ctx.strokeStyle = ctx.fillStyle;
    iconFn(cx, cy);
  }
  transportButton(t.start, (cx, cy) => {
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 6);
    ctx.lineTo(cx - 4, cy + 6);
    ctx.lineTo(cx + 6, cy);
    ctx.closePath();
    ctx.fill();
  }, controlsState.isPlaying);
  transportButton(t.stop, (cx, cy) => {
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
  }, false);
  transportButton(t.pause, (cx, cy) => {
    ctx.fillRect(cx - 6, cy - 6, 4, 12);
    ctx.fillRect(cx + 2, cy - 6, 4, 12);
  }, false);
  transportButton(t.reset, (cx, cy) => {
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, -Math.PI * .15, Math.PI * 1.35);
    ctx.stroke();
    const headAngle = Math.PI * 1.35;
    const hx = cx + Math.cos(headAngle) * 6;
    const hy = cy + Math.sin(headAngle) * 6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - 4, hy - 2);
    ctx.lineTo(hx - 1, hy + 4);
    ctx.closePath();
    ctx.fill();
  }, false);
  return {
    cardX: cardX,
    cardY: cardY,
    cardW: cardW,
    cardH: cardH
  };
}

export function hitTestTransport(x, y) {
  const layout = getLeftPanelLayout();
  const t = layout.transport;
  for (const [name, box] of Object.entries(t)) {
    if (typeof box !== "object") continue;
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
      return name;
    }
  }
  return null;
}

export function hitTestCategorySelector(x, y) {
  const layout = getLeftPanelLayout();
  if (pointInBox(x, y, layout.scalesHalf)) return "scales";
  if (pointInBox(x, y, layout.genresHalf)) return "genres";
  return null;
}

export function hitTestScaleTypeSelector(x, y) {
  const layout = getLeftPanelLayout();
  if (!layout.scaleTypeBox) return null;
  const stBox = layout.scaleTypeBox;
  if (pointInBox(x, y, stBox)) return "toggle";
  if (contentState.scaleTypeDropdownOpen) {
    const listStartY = stBox.y + stBox.h + 6;
    for (let i = 0; i < SCALE_TYPES.length; i++) {
      const itemBox = {
        x: stBox.x,
        y: listStartY + i * 26,
        w: stBox.w,
        h: 24
      };
      if (pointInBox(x, y, itemBox)) return i;
    }
  }
  return null;
}

export function hitTestBPM(x, y) {
  const layout = getLeftPanelLayout();
  return pointInBox(x, y, layout.bpmBox);
}

export function hitTestPackSelector(x, y) {
  const layout = getLeftPanelLayout();
  const packBox = layout.packBox;
  if (pointInBox(x, y, packBox)) return "toggle";
  if (contentState.packDropdownOpen) {
    const packs = getAvailablePacks();
    const listStartY = packBox.y + packBox.h + 6;
    for (let i = 0; i < packs.length; i++) {
      const itemBox = {
        x: packBox.x,
        y: listStartY + i * 26,
        w: packBox.w,
        h: 24
      };
      if (pointInBox(x, y, itemBox)) return i;
    }
  }
  return null;
}

export function hitTestNowLearning(x, y) {
  const layout = getLeftPanelLayout();
  const nlBox = layout.nowLearningBox;
  if (pointInBox(x, y, nlBox)) return "toggle";
  if (contentState.lessonDropdownOpen) {
    const pack = getActivePack();
    const startY = nlBox.y + nlBox.h + 6;
    for (let i = 0; i < pack.lessons.length; i++) {
      const itemBox = {
        x: nlBox.x,
        y: startY + i * 26,
        w: nlBox.w,
        h: 24
      };
      if (pointInBox(x, y, itemBox)) return i;
    }
  }
  return null;
}

function pointInBox(x, y, box) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}