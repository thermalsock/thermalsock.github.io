// AnalysisBar.js
//
// Three sections left to right: EQ/spectrum display, oscilloscope
// (with snapshot/freeze AND maximize-to-fullscreen), and an info block
// showing the chord to play (from the real timeline, same lookup
// TopBar.js uses) alongside the chord actually being played (detected
// live from MIDI-held notes) plus audio connection status.
//
// The EQ and oscilloscope are driven by REAL audio input (see
// AudioAnalysis.js) -- this is genuinely listening to whatever's
// plugged into the audio interface's line-in, not a simulation.

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

// ---- Graticule / glow-trace helpers, shared by EQ and Oscilloscope ----
// Modeled on a classic analog CRT scope: near-black screen, faint
// green grid, glowing phosphor trace. Kept as small standalone
// functions since both displays use the same "instrument screen" look.

function drawGraticule(ctx, content, cols, rows) {
  for (let c = 1; c < cols; c++) {
    const x = content.x + (content.w / cols) * c;
    ctx.strokeStyle = theme.scopeGridLine;
    ctx.beginPath();
    ctx.moveTo(x, content.y);
    ctx.lineTo(x, content.y + content.h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = content.y + (content.h / rows) * r;
    ctx.strokeStyle = theme.scopeGridLine;
    ctx.beginPath();
    ctx.moveTo(content.x, y);
    ctx.lineTo(content.x + content.w, y);
    ctx.stroke();
  }
  // Center row/column drawn brighter -- the "0" reference lines on a
  // real graticule are usually a heavier weight than the rest of the grid.
  const midX = content.x + content.w / 2;
  const midY = content.y + content.h / 2;
  ctx.strokeStyle = theme.scopeGridLineBright;
  ctx.beginPath();
  ctx.moveTo(midX, content.y); ctx.lineTo(midX, content.y + content.h);
  ctx.moveTo(content.x, midY); ctx.lineTo(content.x + content.w, midY);
  ctx.stroke();
}

// Draws a smooth curve through a set of points using the standard
// "quadratic-through-midpoints" technique: connects each point to the
// midpoint of itself and its neighbor with a curve bulging toward the
// point itself, which eliminates the hard corners a plain lineTo
// polyline has AT EVERY POINT, regardless of how granular the
// underlying data is. This is what actually fixes the "still blocky"
// staircase look, not just the sample-smoothing above -- smoothing
// reduces how JAGGED the underlying values are, curve interpolation
// removes the sharp corners in how they're CONNECTED, and both matter.
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

// Three-pass glow: a very wide, very soft outer bloom (the actual
// "bleed across the screen" look), a medium glow layer, then a crisp
// full-opacity core line on top. A single blur pass reads as "fuzzy";
// layering multiple radii/opacities is what real neon-sign and CRT
// phosphor renders actually do to get that soft-bleed look. Uses
// save()/restore() to isolate shadow/alpha/lineWidth per pass so none
// of this leaks into whatever draws next.
function strokeGlowingPath(ctx, points, color, big) {
  const passes = big
    ? [{ blur: 34, alpha: 0.22, width: 9 }, { blur: 16, alpha: 0.45, width: 4.5 }, { blur: 4, alpha: 1, width: 2 }]
    : [{ blur: 18, alpha: 0.22, width: 5.5 }, { blur: 8, alpha: 0.45, width: 2.6 }, { blur: 2, alpha: 1, width: 1.2 }];

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
  return { x: x + 6, y: y + headerH, w: w - 12, h: h - headerH - 6 };
}

// Layout is recomputed from scratch every call (cheap, and matches the
// pattern used everywhere else in this app -- e.g. LeftPanelLayout.js)
// so the draw function and the hit-test function can never drift out
// of sync with each other.
function getAnalysisBarLayout(canvas) {
  const zoneX = gridStartX;
  const zoneW = canvas.width - gridStartX - gridEndXPadding;
  const zoneTop = analysisZoneTop;
  const zoneBottom = analysisZoneBottom;

  // Info gets more room now that "what's being played" is the
  // headline readout -- EQ gives up some width to it. Scope's weight
  // is untouched (1.15 both before and after) so its width doesn't
  // shift at all; only EQ (1 -> 0.75) and Info (0.85 -> 1.1) trade
  // space, total held at 3.0 either way.
  const weights = [0.75, 1.15, 1.1]; // EQ, Scope, Info
  const totalGap = SECTION_GAP * (weights.length - 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const availableW = zoneW - totalGap;

  let cursor = zoneX;
  const boxes = weights.map(w => {
    const width = (availableW / totalWeight) * w;
    const box = { x: cursor, y: zoneTop, w: width, h: zoneBottom - zoneTop };
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

  const infoContent = { x: infoBox.x + 6, y: infoBox.y + 18, w: infoBox.w - 12, h: infoBox.h - 24 };
  const audioStatusBox = { x: infoContent.x, y: infoContent.y + infoContent.h - 12, w: infoContent.w, h: 12 };

  const deviceListBox = {
    x: infoBox.x,
    y: infoBox.y + infoBox.h + 4,
    w: infoBox.w,
    rowH: 16
  };

  return { zoneX, zoneW, zoneTop, zoneBottom, eqBox, scopeBox, infoBox, snapshotButton, maximizeButton, audioStatusBox, deviceListBox };
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

// Returns the device INDEX if a row in the open device-list overlay
// was clicked, or null otherwise.
export function hitTestDeviceList(x, y, canvas) {
  if (!audioAnalysisState.deviceListOpen) return null;
  const { deviceListBox } = getAnalysisBarLayout(canvas);
  const devices = audioAnalysisState.availableDevices;
  for (let i = 0; i < devices.length; i++) {
    const rowY = deviceListBox.y + i * deviceListBox.rowH;
    if (pointInBox(x, y, { x: deviceListBox.x, y: rowY, w: deviceListBox.w, h: deviceListBox.rowH })) return i;
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
  const bars = bucketSpectrumLog(spectrum, getSampleRate(), 2048, numBars, 30, 16000);
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

// Shared by both the small panel and the maximized overlay -- one
// source of truth for the actual waveform-drawing pipeline
// (background, center line, trigger-stabilization, auto-gain,
// smoothing, trace) so the two views can never drift apart from each
// other. `big` just scales text/line-weight for the larger view.
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
    ctx.fillText(
      audioAnalysisState.error ? "No signal — " + audioAnalysisState.error : "No audio input",
      content.x + content.w / 2, content.y + content.h / 2 + (big ? 18 : 12)
    );
    ctx.textAlign = "left";
    return;
  }

  // Trigger-stabilized start point -- keeps even the LIVE view reading
  // as a steady waveform instead of jittering every frame.
  const triggerOffset = findTriggerOffset(waveform);
  const displaySamples = Math.min(waveform.length - triggerOffset, 800);

  // Auto-gain: scales a quiet signal up to nearly fill the display
  // without amplifying true silence/noise-floor jitter (see
  // computeAutoGain's own guard for that).
  const gain = computeAutoGain(waveform, triggerOffset, displaySamples);

  // Light smoothing on top of full float-precision capture (see
  // AudioAnalysis.js's getFloatTimeDomainData) -- the old "staircase"
  // problem was caused by the lossy 8-bit byte API only having 256
  // amplitude levels total; amplifying a quiet signal amplified that
  // quantization. Float data doesn't have that ceiling at all (verified
  // in Node: ~245 distinct levels for the same quiet signal that only
  // managed ~44-66 under the byte API even with heavy smoothing), so
  // this pass is just gentle noise reduction now, not artifact
  // correction -- combined with the curve interpolation in
  // strokeGlowingPath below (which smooths how points CONNECT,
  // independent of how continuous the underlying values are), the two
  // together are what produce a genuinely analog-looking trace.
  const smoothed = smoothSamples(waveform, 3);

  const points = [];
  for (let i = 0; i < displaySamples; i++) {
    const sample = smoothed[triggerOffset + i];
    const deviation = sample * gain;
    const clamped = Math.max(-1, Math.min(1, deviation));
    const px = content.x + (i / displaySamples) * content.w;
    const py = content.y + content.h / 2 - clamped * (content.h / 2);
    points.push({ x: px, y: py });
  }

  const color = audioAnalysisState.frozen ? theme.scopeTraceFrozen : theme.scopeTraceLive;
  strokeGlowingPath(ctx, points, color, big);
}

function drawOscilloscope(ctx, box) {
  const content = drawSectionFrame(ctx, box.x, box.y, box.w, box.h, "OSCILLOSCOPE");
  renderScopeTrace(ctx, content, false);
}

function drawSnapshotButton(ctx, canvas) {
  const { snapshotButton: b } = getAnalysisBarLayout(canvas);

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
  const { maximizeButton: b } = getAnalysisBarLayout(canvas);

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

  const heldNotes = [...midiState.heldNotes];
  const playing = heldNotes.length ? detectChordName(heldNotes) : null;

  // TO PLAY -- compact reference row at the top.
  const y = content.y + 10;
  ctx.font = "bold 8px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.fillText("TO PLAY", content.x, y);
  ctx.font = "bold 17px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.accentDeep;
  ctx.fillText(toPlay, content.x, y + 18);

  // PLAYING -- the headline readout this whole panel exists for. Given
  // the most visual weight by far: a highlighted backing pill (only
  // when something's actually being played) plus a much larger value
  // than anything else in this box, so "what am I playing right now"
  // reads at a glance instead of needing to be read as text.
  const playingLabelY = y + 34;
  const playingValueTop = playingLabelY + 8;
  const playingValueH = content.h - (playingValueTop - content.y) - 14; // leaves room for the status line below

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
  const statusText = audioAnalysisState.connected
    ? `Audio: ${audioAnalysisState.deviceLabel}  (change ▾)`
    : audioAnalysisState.supported
      ? `Audio: not connected${audioAnalysisState.error ? " (" + audioAnalysisState.error + ")" : ""} — click to retry`
      : "Audio: unsupported";
  wrapText(ctx, statusText, content.x, statusY, content.w, 8, 1);
}

function drawDeviceListOverlay(ctx, canvas) {
  if (!audioAnalysisState.deviceListOpen) return;
  const { deviceListBox } = getAnalysisBarLayout(canvas);
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

// The maximized scope overlay -- floats a large version of the same
// trace (renderScopeTrace, `big: true`) over most of the canvas, with
// a dim backdrop and a visible close button, drawn LAST so it sits on
// top of literally everything else. Click-anywhere-to-close is wired
// in engine.js (checked first, before any other hit-test) rather than
// requiring a precise hit on the small close button -- the button
// still exists for a clear, discoverable affordance, but isn't the
// only way out.
export function getMaximizedScopeLayout(canvas) {
  const margin = Math.min(80, canvas.width * 0.06);
  const panelX = margin, panelY = margin;
  const panelW = canvas.width - margin * 2;
  const panelH = canvas.height - margin * 2;
  const closeBox = { x: panelX + panelW - 34, y: panelY + 10, w: 24, h: 24 };
  const content = { x: panelX + 16, y: panelY + 44, w: panelW - 32, h: panelH - 60 };
  return { panelX, panelY, panelW, panelH, closeBox, content };
}

export function drawMaximizedScope(ctx, canvas) {
  if (!audioAnalysisState.scopeMaximized) return;
  const { panelX, panelY, panelW, panelH, closeBox, content } = getMaximizedScopeLayout(canvas);

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
  ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
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

  // When Scales is the active category, the EQ display is replaced
  // with real staff notation for the current scale -- an EQ reading of
  // whatever audio happens to be plugged in isn't useful information
  // while practicing a scale ladder, but "what does this scale look
  // like written out" is exactly the reference a player wants there.
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
