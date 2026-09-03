import { theme } from "../theme/theme.js";

import { getFingering } from "../../core/music/PianoFingering.js";

const LETTER_INDEX = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6
};

function stepNumber(letter, octave) {
  return octave * 7 + LETTER_INDEX[letter];
}

const STAFF_TOP_STEP = stepNumber("F", 5);

const STAFF_BOTTOM_STEP = stepNumber("E", 4);

function accidentalSymbol(accidental) {
  if (accidental === 1) return "♯";
  if (accidental === -1) return "♭";
  if (accidental === 2) return "𝄪";
  if (accidental === -2) return "𝄫";
  return null;
}

function normalizeForDisplay(scaleSpelling) {
  if (!scaleSpelling.length) return [];
  const offset = 4 - scaleSpelling[0].octave;
  return scaleSpelling.map(n => ({
    ...n,
    octave: n.octave + offset
  }));
}

export function drawScaleNotation(ctx, box, pack) {
  ctx.fillStyle = theme.moduleBg;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 7);
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  const padX = 10;
  const padTop = 10;
  ctx.font = "bold 12px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = theme.accentDeep;
  ctx.fillText(pack.name, box.x + padX, box.y + padTop);
  if (!pack.scaleSpelling || pack.scaleSpelling.length === 0) return;
  const notes = normalizeForDisplay(pack.scaleSpelling);
  const fingering = getFingering(pack);
  const nameAreaBottom = box.y + padTop + 8;
  const bottomPad = 6;
  const fingeringRowH = 24;
  const staffAreaTop = nameAreaBottom;
  const staffAreaBottom = box.y + box.h - bottomPad - fingeringRowH;
  const staffAreaH = staffAreaBottom - staffAreaTop;
  const lineGap = 9;
  const staffVisualH = lineGap * 4;
  const clefAbove = 4;
  const clefBelow = 14;
  const totalVisualH = clefAbove + staffVisualH + clefBelow;
  const blockTop = staffAreaTop + Math.max(0, (staffAreaH - totalVisualH) / 2);
  const staffTop = blockTop + clefAbove;
  const staffLeft = box.x + padX + 6;
  const staffRight = box.x + box.w - padX;
  function yForStep(step) {
    return staffTop + (STAFF_TOP_STEP - step) * (lineGap / 2);
  }
  ctx.strokeStyle = theme.textSecondary;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = staffTop + i * lineGap;
    ctx.beginPath();
    ctx.moveTo(staffLeft, y);
    ctx.lineTo(staffRight, y);
    ctx.stroke();
  }
  const clefFontSize = lineGap * 3.6;
  ctx.font = `${clefFontSize}px -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = theme.textPrimary;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("𝄞", staffLeft - 2, staffTop + lineGap * 3.05);
  const noteAreaLeft = staffLeft + 34;
  const noteAreaWidth = staffRight - noteAreaLeft - 10;
  const slot = noteAreaWidth / notes.length;
  const noteRadius = lineGap * .42;
  const noteCenters = [];
  notes.forEach((n, i) => {
    const cx = noteAreaLeft + slot * i + slot / 2;
    noteCenters.push(cx);
    const step = stepNumber(n.letter, n.octave);
    const cy = yForStep(step);
    ctx.strokeStyle = theme.textSecondary;
    ctx.lineWidth = 1;
    if (step < STAFF_BOTTOM_STEP) {
      for (let s = STAFF_BOTTOM_STEP - 2; s >= step; s -= 2) {
        if (s % 2 !== 0) continue;
        const ly = yForStep(s);
        ctx.beginPath();
        ctx.moveTo(cx - noteRadius - 3, ly);
        ctx.lineTo(cx + noteRadius + 3, ly);
        ctx.stroke();
      }
    } else if (step > STAFF_TOP_STEP) {
      for (let s = STAFF_TOP_STEP + 2; s <= step; s += 2) {
        if (s % 2 !== 0) continue;
        const ly = yForStep(s);
        ctx.beginPath();
        ctx.moveTo(cx - noteRadius - 3, ly);
        ctx.lineTo(cx + noteRadius + 3, ly);
        ctx.stroke();
      }
    }
    const sym = accidentalSymbol(n.accidental);
    if (sym) {
      ctx.font = `bold ${lineGap * 1.3}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = theme.accentDeep;
      ctx.textAlign = "right";
      ctx.fillText(sym, cx - noteRadius - 3, cy + lineGap * .35);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = theme.textPrimary;
    ctx.beginPath();
    ctx.ellipse(cx, cy, noteRadius, noteRadius * .8, -.35, 0, Math.PI * 2);
    ctx.fill();
  });
  const rhY = staffAreaBottom + 11;
  const lhY = staffAreaBottom + 23;
  if (fingering) {
    ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = theme.streak;
    notes.forEach((n, i) => ctx.fillText(String(fingering.rh[i]), noteCenters[i], rhY));
    ctx.fillStyle = theme.scopeTraceFrozen;
    notes.forEach((n, i) => ctx.fillText(String(fingering.lh[i]), noteCenters[i], lhY));
    ctx.font = "bold 7px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = theme.streak;
    ctx.fillText("RH", staffLeft - 4, rhY);
    ctx.fillStyle = theme.scopeTraceFrozen;
    ctx.fillText("LH", staffLeft - 4, lhY);
    ctx.textAlign = "left";
  } else {
    ctx.font = "italic 9px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.textAlign = "left";
    ctx.fillText("Standard fingering varies for this scale type.", staffLeft, rhY + 4);
  }
}