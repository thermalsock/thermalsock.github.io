import { gridStartX, gridEndXPadding, analysisZoneTop, analysisZoneBottom } from "../../core/state/Layout.js";

import { getActiveLesson, getActivePack, contentState } from "../../core/state/ContentState.js";

import { findCurrentEventIndex } from "../../core/engine/Timeline.js";

import { midiState } from "../../core/midi/MidiState.js";

import { detectChordName } from "../../core/music/ChordDetector.js";

import { audioAnalysisState, getWaveform, getSpectrum, getSampleRate } from "../../core/audio/AudioAnalysis.js";

import { findTriggerOffset, bucketSpectrumLog, computeAutoGain, smoothSamples } from "../../core/audio/WaveformMath.js";

import { theme } from "../theme/theme.js";

import { drawScaleNotation } from "./ScaleNotation.js";

const SECTION_GAP = 6;

const BOX_RADIUS = 7;

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  let lines = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
      lines++;
      if (maxLines && lines >= maxLines) {
        ctx.fillText(line.replace(/\s*\S*$/, "") + "…", x, cy);
        return;
      }
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function drawGraticule(ctx, content, cols, rows) {
  for (let c = 1; c < cols; c++) {
    const x = content.x + content.w / cols * c;
    ctx.strokeStyle = theme.scopeGridLine;
    ctx.beginPath();
    ctx.moveTo(x, content.y);
    ctx.lineTo(x, content.y + content.h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = content.y + content.h / rows * r;
    ctx.strokeStyle = theme.scopeGridLine;
    ctx.beginPath();
    ctx.moveTo(content.x, y);
    ctx.lineTo(content.x + content.w, y);
    ctx.stroke();
  }
  const midX = content.x + content.w / 2;
  const midY = content.y + content.h / 2;
  ctx.strokeStyle = theme.scopeGridLineBright;
  ctx.beginPath();
  ctx.moveTo(midX, content.y);
  ctx.lineTo(midX, content.y + content.h);
  ctx.moveTo(content.x, midY);
  ctx.lineTo(content.x + content.w, midY);
  ctx.stroke();
}

function strokeSmoothPath(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

function strokeGlowingPath(ctx, points, color, big) {
  const passes = big ? [ {
    blur: 34,
    alpha: .22,
    width: 9
  }, {
    blur: 16,
    alpha: .45,
    width: 4.5
  }, {
    blur: 4,
    alpha: 1,
    width: 2
  } ] : [ {
    blur: 18,
    alpha: .22,
    width: 5.5
  }, {
    blur: 8,
    alpha: .45,
    width: 2.6
  }, {
    blur: 2,
    alpha: 1,
    width: 1.2
  } ];
  passes.forEach(p => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = p.blur;
    ctx.strokeStyle = color;
    ctx.globalAlpha = p.alpha;
    ctx.lineWidth = p.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    strokeSmoothPath(ctx, points);
    ctx.restore();
  });
}

function drawSectionFrame(ctx, x, y, w, h, title) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, BOX_RADIUS);
  ctx.fillStyle = theme.moduleBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = "bold 8px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText(title, x + 8, y + 12);
  const headerH = 18;
  return {
    x: x + 6,
    y: y + headerH,
    w: w - 12,
    h: h - headerH - 6
  };
}

function getAnalysisBarLayout(canvas) {
  const zoneX = gridStartX;
  const zoneW = canvas.width - gridStartX - gridEndXPadding;
  const zoneTop = analysisZoneTop;
  const zoneBottom = analysisZoneBottom;
  const weights = [ .75, 1.15, 1.1 ];
  const totalGap = SECTION_GAP * (weights.length - 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const availableW = zoneW - totalGap;
  let cursor = zoneX;
  const boxes = weights.map(w => {
    const width = availableW / totalWeight * w;
    const box = {
      x: cursor,
      y: zoneTop,
      w: width,
      h: zoneBottom - zoneTop
    };
    cursor += width + SECTION_GAP;
    return box;
  });
  const [eqBox, scopeBox, infoBox] = boxes;
  const snapshotButton = {
    x: scopeBox.x + scopeBox.w - 54,
    y: scopeBox.y + 3,
    w: 48,
    h: 13
  };
  const maximizeButton = {
    x: snapshotButton.x - 22,
    y: scopeBox.y + 3,
    w: 18,
    h: 13
  };
  const infoContent = {
    x: infoBox.x + 6,
    y: infoBox.y + 18,
    w: infoBox.w - 12,
    h: infoBox.h - 24
  };
  const audioStatusBox = {
    x: infoContent.x,
    y: infoContent.y + infoContent.h - 12,
    w: infoContent.w,
    h: 12
  };
  const deviceListBox = {
    x: infoBox.x,
    y: infoBox.y + infoBox.h + 4,
    w: infoBox.w,
    rowH: 16
  };
  return {
    zoneX: zoneX,
    zoneW: zoneW,
    zoneTop: zoneTop,
    zoneBottom: zoneBottom,
    eqBox: eqBox,
    scopeBox: scopeBox,
    infoBox: infoBox,
    snapshotButton: snapshotButton,
    maximizeButton: maximizeButton,
    audioStatusBox: audioStatusBox,
    deviceListBox: deviceListBox
  };
}

function pointInBox(x, y, box) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function hitTestSnapshotButton(x, y, canvas) {
  return pointInBox(x, y, getAnalysisBarLayout(canvas).snapshotButton);
}

export function hitTestMaximizeButton(x, y, canvas) {
  return pointInBox(x, y, getAnalysisBarLayout(canvas).maximizeButton);
}

export function hitTestAudioStatus(x, y, canvas) {
  return pointInBox(x, y, getAnalysisBarLayout(canvas).audioStatusBox);
}

export function hitTestDeviceList(x, y, canvas) {
  if (!audioAnalysisState.deviceListOpen) return null;
  const {deviceListBox: deviceListBox} = getAnalysisBarLayout(canvas);
  const devices = audioAnalysisState.availableDevices;
  for (let i = 0; i < devices.length; i++) {
    const rowY = deviceListBox.y + i * deviceListBox.rowH;
    if (pointInBox(x, y, {
      x: deviceListBox.x,
      y: rowY,
      w: deviceListBox.w,
      h: deviceListBox.rowH
    })) return i;
  }
  return null;
}

function drawEQ(ctx, box) {
  const content = drawSectionFrame(ctx, box.x, box.y, box.w, box.h, "EQ");
  ctx.fillStyle = theme.scopeBg;
  ctx.fillRect(content.x, content.y, content.w, content.h);
  const spectrum = audioAnalysisState.connected ? getSpectrum() : null;
  drawGraticule(ctx, content, 14, 4);
  ctx.strokeStyle = theme.border;
  ctx.strokeRect(content.x, content.y, content.w, content.h);
  if (!spectrum) {
    ctx.font = "9px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.textAlign = "center";
    ctx.fillText(audioAnalysisState.error ? "No signal — " + audioAnalysisState.error : "No audio input", content.x + content.w / 2, content.y + content.h / 2 + 3);
    ctx.textAlign = "left";
    return;
  }
  const numBars = 28;
  const bars = bucketSpectrumLog(spectrum, getSampleRate(), 2048, numBars, 30, 16e3);
  const barSlot = content.w / numBars;
  const barW = Math.max(1, barSlot - 1);
  ctx.save();
  ctx.shadowColor = theme.scopeTraceLive;
  ctx.shadowBlur = 6;
  bars.forEach((v, i) => {
    const magnitude01 = v / 255;
    const barH = Math.max(1, magnitude01 * content.h);
    const x = content.x + i * barSlot;
    const y = content.y + content.h - barH;
    ctx.fillStyle = theme.scopeTraceLive;
    ctx.fillRect(x, y, barW, barH);
  });
  ctx.restore();
}

function renderScopeTrace(ctx, content, big) {
  ctx.fillStyle = theme.scopeBg;
  ctx.fillRect(content.x, content.y, content.w, content.h);
  drawGraticule(ctx, content, big ? 16 : 10, big ? 8 : 4);
  ctx.strokeStyle = theme.border;
  ctx.strokeRect(content.x, content.y, content.w, content.h);
  const waveform = audioAnalysisState.connected ? getWaveform() : null;
  if (!waveform) {
    ctx.font = (big ? "13px" : "9px") + " -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.textAlign = "center";
    ctx.fillText(audioAnalysisState.error ? "No signal — " + audioAnalysisState.error : "No audio input", content.x + content.w / 2, content.y + content.h / 2 + (big ? 18 : 12));
    ctx.textAlign = "left";
    return;
  }
  const triggerOffset = findTriggerOffset(waveform);
  const displaySamples = Math.min(waveform.length - triggerOffset, 800);
  const gain = computeAutoGain(waveform, triggerOffset, displaySamples);
  const smoothed = smoothSamples(waveform, 3);
  const points = [];
  for (let i = 0; i < displaySamples; i++) {
    const sample = smoothed[triggerOffset + i];
    const deviation = sample * gain;
    const clamped = Math.max(-1, Math.min(1, deviation));
    const px = content.x + i / displaySamples * content.w;
    const py = content.y + content.h / 2 - clamped * (content.h / 2);
    points.push({
      x: px,
      y: py
    });
  }
  const color = audioAnalysisState.frozen ? theme.scopeTraceFrozen : theme.scopeTraceLive;
  strokeGlowingPath(ctx, points, color, big);
}

function drawOscilloscope(ctx, box) {
  const content = drawSectionFrame(ctx, box.x, box.y, box.w, box.h, "OSCILLOSCOPE");
  renderScopeTrace(ctx, content, false);
}

function drawSnapshotButton(ctx, canvas) {
  const {snapshotButton: b} = getAnalysisBarLayout(canvas);
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 3);
  ctx.fillStyle = audioAnalysisState.frozen ? theme.buttonActiveBg : theme.buttonBg;
  ctx.fill();
  ctx.strokeStyle = audioAnalysisState.frozen ? theme.buttonActiveBorder : theme.border;
  ctx.stroke();
  ctx.font = "bold 8px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = audioAnalysisState.frozen ? theme.accentDeep : theme.textSecondary;
  ctx.textAlign = "center";
  ctx.fillText(audioAnalysisState.frozen ? "FROZEN" : "SNAPSHOT", b.x + b.w / 2, b.y + b.h / 2 + 3);
  ctx.textAlign = "left";
}

function drawMaximizeButton(ctx, canvas) {
  const {maximizeButton: b} = getAnalysisBarLayout(canvas);
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 3);
  ctx.fillStyle = theme.buttonBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.stroke();
  ctx.font = "10px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  ctx.textAlign = "center";
  ctx.fillText("⤢", b.x + b.w / 2, b.y + b.h / 2 + 3.5);
  ctx.textAlign = "left";
}

function drawInfoBlock(ctx, box, timeline, currentBeat) {
  const content = drawSectionFrame(ctx, box.x, box.y, box.w, box.h, "CHORD INFO");
  const currentIndex = findCurrentEventIndex(timeline, currentBeat);
  const toPlay = currentIndex >= 0 ? timeline.events[currentIndex].label : "—";
  const heldNotes = [ ...midiState.heldNotes ];
  const playing = heldNotes.length ? detectChordName(heldNotes) : null;
  const y = content.y + 10;
  ctx.font = "bold 8px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText("TO PLAY", content.x, y);
  ctx.font = "bold 17px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.accentDeep;
  ctx.fillText(toPlay, content.x, y + 18);
  const playingLabelY = y + 34;
  const playingValueTop = playingLabelY + 8;
  const playingValueH = content.h - (playingValueTop - content.y) - 14;
  ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText("PLAYING", content.x, playingLabelY);
  if (playing) {
    ctx.beginPath();
    ctx.roundRect(content.x, playingValueTop, content.w, playingValueH, 6);
    ctx.fillStyle = theme.accentBg;
    ctx.fill();
    ctx.strokeStyle = theme.streak;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.font = "bold 32px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = playing ? theme.streak : theme.textDim;
  ctx.textBaseline = "middle";
  ctx.fillText(playing || "—", content.x + 10, playingValueTop + playingValueH / 2);
  ctx.textBaseline = "alphabetic";
  const statusY = content.y + content.h - 4;
  ctx.font = "7px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = audioAnalysisState.connected ? theme.textSecondary : theme.accentDeep;
  const statusText = audioAnalysisState.connected ? `Audio: ${audioAnalysisState.deviceLabel}  (change ▾)` : audioAnalysisState.supported ? `Audio: not connected${audioAnalysisState.error ? " (" + audioAnalysisState.error + ")" : ""} — click to retry` : "Audio: unsupported";
  wrapText(ctx, statusText, content.x, statusY, content.w, 8, 1);
}

function drawDeviceListOverlay(ctx, canvas) {
  if (!audioAnalysisState.deviceListOpen) return;
  const {deviceListBox: deviceListBox} = getAnalysisBarLayout(canvas);
  const devices = audioAnalysisState.availableDevices;
  if (devices.length === 0) {
    ctx.font = "9px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.moduleBg;
    ctx.fillRect(deviceListBox.x, deviceListBox.y, deviceListBox.w, 20);
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(deviceListBox.x, deviceListBox.y, deviceListBox.w, 20);
    ctx.fillStyle = theme.textDim;
    ctx.fillText("No input devices found", deviceListBox.x + 6, deviceListBox.y + 14);
    return;
  }
  devices.forEach((d, i) => {
    const rowY = deviceListBox.y + i * deviceListBox.rowH;
    const isActive = d.deviceId === audioAnalysisState.selectedDeviceId;
    ctx.fillStyle = isActive ? theme.accentBg : theme.moduleBg;
    ctx.strokeStyle = isActive ? theme.accent : theme.border;
    ctx.fillRect(deviceListBox.x, rowY, deviceListBox.w, deviceListBox.rowH);
    ctx.strokeRect(deviceListBox.x, rowY, deviceListBox.w, deviceListBox.rowH);
    ctx.font = "9px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = isActive ? theme.accentDeep : theme.textPrimary;
    ctx.fillText(d.label, deviceListBox.x + 6, rowY + 11);
  });
}

export function getMaximizedScopeLayout(canvas) {
  const margin = Math.min(80, canvas.width * .06);
  const panelX = margin, panelY = margin;
  const panelW = canvas.width - margin * 2;
  const panelH = canvas.height - margin * 2;
  const closeBox = {
    x: panelX + panelW - 34,
    y: panelY + 10,
    w: 24,
    h: 24
  };
  const content = {
    x: panelX + 16,
    y: panelY + 44,
    w: panelW - 32,
    h: panelH - 60
  };
  return {
    panelX: panelX,
    panelY: panelY,
    panelW: panelW,
    panelH: panelH,
    closeBox: closeBox,
    content: content
  };
}

export function drawMaximizedScope(ctx, canvas) {
  if (!audioAnalysisState.scopeMaximized) return;
  const {panelX: panelX, panelY: panelY, panelW: panelW, panelH: panelH, closeBox: closeBox, content: content} = getMaximizedScopeLayout(canvas);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 10);
  ctx.fillStyle = theme.moduleBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = "bold 14px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText("OSCILLOSCOPE", panelX + 16, panelY + 24);
  ctx.font = "10px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText(audioAnalysisState.frozen ? "FROZEN — click anywhere to close" : "LIVE — click anywhere to close", panelX + 16, panelY + 38);
  renderScopeTrace(ctx, content, true);
  ctx.beginPath();
  ctx.roundRect(closeBox.x, closeBox.y, closeBox.w, closeBox.h, 5);
  ctx.fillStyle = theme.buttonBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.stroke();
  ctx.strokeStyle = theme.textSecondary;
  ctx.lineWidth = 1.6;
  const cx = closeBox.x + closeBox.w / 2, cy = closeBox.y + closeBox.h / 2, r = 5;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r);
  ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
  ctx.lineWidth = 1;
}

export function drawAnalysisBar(ctx, canvas, timeline, currentBeat) {
  const layout = getAnalysisBarLayout(canvas);
  ctx.fillStyle = theme.panelBgAlt;
  ctx.fillRect(layout.zoneX, layout.zoneTop, layout.zoneW, layout.zoneBottom - layout.zoneTop);
  ctx.strokeStyle = theme.border;
  ctx.beginPath();
  ctx.moveTo(layout.zoneX, layout.zoneBottom);
  ctx.lineTo(layout.zoneX + layout.zoneW, layout.zoneBottom);
  ctx.stroke();
  if (contentState.contentCategory === "scales") {
    drawScaleNotation(ctx, layout.eqBox, getActivePack());
  } else {
    drawEQ(ctx, layout.eqBox);
  }
  drawOscilloscope(ctx, layout.scopeBox);
  drawSnapshotButton(ctx, canvas);
  drawMaximizeButton(ctx, canvas);
  drawInfoBlock(ctx, layout.infoBox, timeline, currentBeat);
  drawDeviceListOverlay(ctx, canvas);
}