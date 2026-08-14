// SynthGuide.js
//
// A static reference panel, NOT a functional synth -- nothing here
// produces sound or responds to input. Modeled directly on a real
// subtractive synth's panel layout (Sequential Take 5 reference):
// bordered section groups -- OSCILLATORS, MIXER, FILTER (one large,
// prominent Cutoff knob), ENVELOPES, FX SENDS -- content vertically
// centered within each box.
//
// Deliberately compact: this zone was narrowed (see Layout.js's
// GUIDE_ZONE_PERCENT) to make room for the new audio-analysis bar
// below it, so every offset/size here is intentionally tight -- title
// and box-header text sizes, padding, and knob radii were all
// recomputed for the smaller footprint (verified in Node against real
// zone dimensions before being hardcoded here), not just shrunk from
// the wider version and hoped to still fit.
//
// Pulls its data from the active pack's `synthGuide` field (see
// core/content/packs/*.js) rather than the active lesson -- one guide
// per pack's overall target sound, not per individual chord.

import { gridStartX, gridEndXPadding, guideZoneTop, guideZoneBottom } from "../../core/state/Layout.js";
import { getActivePack, getEffectiveSynthGuide } from "../../core/state/ContentState.js";
import { theme } from "../theme/theme.js";

const KNOB_COLOR = "accent";
const BOX_GAP = 6;
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

function drawWaveIcon(ctx, cx, cy, r, waveType) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.fieldBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.stroke();

  ctx.strokeStyle = theme[KNOB_COLOR];
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const w = r * 1.2;
  const left = cx - w / 2;

  if (waveType === "sine") {
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = left + t * w;
      const y = cy - Math.sin(t * Math.PI * 2) * (r * 0.5);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  } else if (waveType === "saw") {
    ctx.moveTo(left, cy + r * 0.5);
    ctx.lineTo(left, cy - r * 0.5);
    ctx.lineTo(cx, cy + r * 0.5);
    ctx.lineTo(cx, cy - r * 0.5);
    ctx.lineTo(left + w, cy + r * 0.5);
  } else if (waveType === "square") {
    ctx.moveTo(left, cy + r * 0.5);
    ctx.lineTo(left, cy - r * 0.5);
    ctx.lineTo(cx, cy - r * 0.5);
    ctx.lineTo(cx, cy + r * 0.5);
    ctx.lineTo(left + w, cy + r * 0.5);
    ctx.lineTo(left + w, cy - r * 0.5);
  } else { // triangle
    ctx.moveTo(left, cy + r * 0.5);
    ctx.lineTo(cx, cy - r * 0.5);
    ctx.lineTo(left + w, cy + r * 0.5);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawKnob(ctx, cx, cy, r, value01) {
  const startAngle = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  const valueAngle = startAngle + sweep * Math.max(0, Math.min(1, value01));

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
  ctx.strokeStyle = theme.gridLineMajor;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valueAngle);
  ctx.strokeStyle = theme[KNOB_COLOR];
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = theme.fieldBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(valueAngle) * r * 0.55, cy + Math.sin(valueAngle) * r * 0.55);
  ctx.strokeStyle = theme.accentDeep;
  ctx.lineWidth = Math.max(1.3, r * 0.09);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function labeledKnob(ctx, cx, cy, r, value01, label) {
  drawKnob(ctx, cx, cy, r, value01);
  ctx.font = "9px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  ctx.textAlign = "center";
  ctx.fillText(label, cx, cy + r + 12);
  ctx.textAlign = "left";
}

function drawSendBar(ctx, x, y, w, h, amount01) {
  ctx.fillStyle = theme.fieldBg;
  ctx.strokeStyle = theme.border;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  const fillW = w * Math.max(0, Math.min(1, amount01));
  ctx.fillStyle = theme[KNOB_COLOR];
  ctx.fillRect(x, y, fillW, h);
}

function drawSectionBox(ctx, x, y, w, h, title) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, BOX_RADIUS);
  ctx.fillStyle = theme.moduleBg;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "bold 10px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.textAlign = "center";
  ctx.fillText(title, x + w / 2, y + 13);
  ctx.textAlign = "left";

  const headerH = 18;
  const bottomPad = 3;
  return { x: x + 6, y: y + headerH, w: w - 12, h: h - headerH - bottomPad };
}

export function drawSynthGuide(ctx, canvas) {
  const pack = getActivePack();
  const guide = getEffectiveSynthGuide();

  const zoneX = gridStartX;
  const zoneW = canvas.width - gridStartX - gridEndXPadding;
  const zoneTop = guideZoneTop;
  const zoneBottom = guideZoneBottom;

  ctx.fillStyle = theme.panelBgAlt;
  ctx.fillRect(zoneX, zoneTop, zoneW, zoneBottom - zoneTop);
  ctx.strokeStyle = theme.border;
  ctx.beginPath();
  ctx.moveTo(zoneX, zoneBottom);
  ctx.lineTo(zoneX + zoneW, zoneBottom);
  ctx.stroke();

  if (!guide || !guide.title) return;

  const padX = 16;

  ctx.font = "bold 15px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.accentDeep;
  ctx.fillText(guide.title, zoneX + padX, zoneTop + 16);

  ctx.font = "bold 10px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textDim;
  ctx.textAlign = "right";
  ctx.fillText("SYNTH GUIDE — REFERENCE ONLY", zoneX + zoneW - padX, zoneTop + 16);
  ctx.textAlign = "left";

  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  wrapText(ctx, guide.description, zoneX + padX, zoneTop + 30, zoneW - padX * 2, 13, 2);

  const boxTop = zoneTop + 48;
  const boxBottom = zoneBottom - 4;
  const boxH = boxBottom - boxTop;

  const groups = [
    { key: "osc", title: "OSCILLATORS", weight: 1.9 },
    { key: "mixer", title: "MIXER", weight: 1.3 },
    { key: "filter", title: "FILTER", weight: 1.5 },
    { key: "env", title: "ENVELOPES", weight: 1.7 },
    { key: "fx", title: "FX SENDS", weight: 1.3 }
  ];

  const totalGap = BOX_GAP * (groups.length - 1);
  const totalWeight = groups.reduce((sum, g) => sum + g.weight, 0);
  const availableW = zoneW - totalGap;

  let cursor = zoneX;
  const boxes = groups.map(g => {
    const w = (availableW / totalWeight) * g.weight;
    const box = { x: cursor, y: boxTop, w, h: boxH };
    cursor += w + BOX_GAP;
    return box;
  });

  const smallR = Math.min(20, boxH / 6);
  const bigR = smallR * 1.85;

  // OSCILLATORS
  {
    const content = drawSectionBox(ctx, boxes[0].x, boxes[0].y, boxes[0].w, boxes[0].h, "OSCILLATORS");
    const blockH = smallR * 2 + 11 + 16;
    const blockTop = content.y + (content.h - blockH) / 2;
    const iconY = blockTop + smallR;

    [guide.osc1, guide.osc2].forEach((osc, i) => {
      const cx = content.x + content.w * (0.28 + i * 0.44);
      ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = theme.textDim;
      ctx.textAlign = "center";
      ctx.fillText(`OSC ${i + 1}`, cx, blockTop - 2);
      drawWaveIcon(ctx, cx, iconY, smallR, osc.wave);
      ctx.font = "9px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = theme.textSecondary;
      wrapText(ctx, osc.label, cx, iconY + smallR + 14, content.w * 0.42, 10, 2);
      ctx.textAlign = "left";
    });
  }

  // MIXER
  {
    const content = drawSectionBox(ctx, boxes[1].x, boxes[1].y, boxes[1].w, boxes[1].h, "MIXER");
    const knobR = smallR * 0.85;
    const rowY = content.y + content.h / 2;

    const mixerKnobs = [
      { v: guide.mixer.osc1, label: "OSC1" },
      { v: guide.mixer.osc2, label: "OSC2" },
      { v: guide.mixer.sub, label: "SUB" },
      { v: guide.mixer.noise, label: "NOISE" }
    ];
    const slot = content.w / mixerKnobs.length;
    mixerKnobs.forEach((k, j) => {
      const cx = content.x + slot * j + slot / 2;
      labeledKnob(ctx, cx, rowY, knobR, k.v, k.label);
    });
  }

  // FILTER -- single row: small Drive/Res flank the big Cutoff knob.
  {
    const content = drawSectionBox(ctx, boxes[2].x, boxes[2].y, boxes[2].w, boxes[2].h, "FILTER");
    const smallKnobR = smallR * 0.78;
    const rowY = content.y + content.h / 2;
    const cx = content.x + content.w / 2;

    labeledKnob(ctx, cx - content.w * 0.28, rowY, smallKnobR, guide.filter.drive, "Drive");
    labeledKnob(ctx, cx, rowY, bigR, guide.filter.cutoff, "Cutoff");
    labeledKnob(ctx, cx + content.w * 0.28, rowY, smallKnobR, guide.filter.resonance, "Res");
  }

  // ENVELOPES -- AMP ENV stacked ABOVE FILTER ENV, each row with a
  // compact inline tag (not a separate header line) to its left,
  // saving the vertical space a full sub-header row would need.
  {
    const content = drawSectionBox(ctx, boxes[3].x, boxes[3].y, boxes[3].w, boxes[3].h, "ENVELOPES");
    const knobR = Math.max(8, Math.min(14, (content.h - 6) / 4 - 9));
    const rowH = knobR * 2 + 18;
    const gapBetweenRows = 6;
    const firstRowCenterY = content.y + rowH / 2 + (content.h - (rowH * 2 + gapBetweenRows)) / 2;

    const tagW = 16;
    const knobsAreaX = content.x + tagW;
    const knobsAreaW = content.w - tagW;

    [
      { tag: "AMP", env: guide.ampEnv, cy: firstRowCenterY },
      { tag: "FLT", env: guide.filterEnv, cy: firstRowCenterY + rowH + gapBetweenRows }
    ].forEach(({ tag, env, cy }) => {
      ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = theme.textDim;
      ctx.textAlign = "left";
      ctx.fillText(tag, content.x, cy + 3);

      const params = [
        { v: env.attack, label: "A" },
        { v: env.decay, label: "D" },
        { v: env.sustain, label: "S" },
        { v: env.release, label: "R" }
      ];
      const slot = knobsAreaW / params.length;
      params.forEach((p, j) => {
        const cx = knobsAreaX + slot * j + slot / 2;
        labeledKnob(ctx, cx, cy, knobR, p.v, p.label);
      });
    });
  }

  // FX SENDS -- reverb + delay bars, stacked.
  {
    const content = drawSectionBox(ctx, boxes[4].x, boxes[4].y, boxes[4].w, boxes[4].h, "FX SENDS");
    const barH = 7;
    const rowH = content.h / 2;

    ctx.font = "10px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText("Reverb", content.x, content.y + 10);
    drawSendBar(ctx, content.x, content.y + 11, content.w, barH, guide.reverb.amount);
    ctx.fillStyle = theme.textDim;
    ctx.font = "9px -apple-system, system-ui, sans-serif";
    wrapText(ctx, guide.reverb.label, content.x, content.y + 28, content.w, 10, 1);

    ctx.font = "10px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText("Delay", content.x, content.y + rowH + 10);
    drawSendBar(ctx, content.x, content.y + rowH + 11, content.w, barH, guide.delay.amount);
    ctx.fillStyle = theme.textDim;
    ctx.font = "9px -apple-system, system-ui, sans-serif";
    wrapText(ctx, guide.delay.label, content.x, content.y + rowH + 28, content.w, 10, 1);
  }
}
