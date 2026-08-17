import { AudioEngine } from './audioEngine.js';
import { detectPitch } from './pitchDetect.js';
import { ActivityDetector } from './activity.js';
import { Book } from './book.js';
import { drawGlyph, drawBlot, GLYPH_ADVANCE } from './glyphs.js';

const els = {
  gate: document.getElementById('gate'),
  app: document.getElementById('app'),
  deviceSelect: document.getElementById('deviceSelect'),
  startBtn: document.getElementById('startBtn'),
  gateError: document.getElementById('gateError'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  pacePill: document.getElementById('pacePill'),
  canvas: document.getElementById('bookCanvas'),
  pageCounter: document.getElementById('pageCounter'),
  glyphCounter: document.getElementById('glyphCounter'),
};
const ctx = els.canvas.getContext('2d');

// ---------------- Page / book geometry ----------------

const PAGE_W = 340, PAGE_H = 460, SPINE_GAP = 14;
const TOTAL_W = PAGE_W * 2 + SPINE_GAP, TOTAL_H = PAGE_H;

const INK = '#2B2620';
const PAPER = '#F3ECDD';
const RULE_COLOR = 'rgba(43, 38, 32, 0.09)';
const PAGE_RADIUS = 6;

function roundedRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function makePageCanvas(baselineYs, marginX, colsPerLine) {
  const c = document.createElement('canvas');
  c.width = PAGE_W;
  c.height = PAGE_H;
  const pctx = c.getContext('2d');
  pctx.fillStyle = PAPER;
  pctx.fillRect(0, 0, PAGE_W, PAGE_H);
  pctx.strokeStyle = RULE_COLOR;
  pctx.lineWidth = 1;
  const lineWidth = colsPerLine * GLYPH_ADVANCE;
  baselineYs.forEach((y) => {
    pctx.beginPath();
    pctx.moveTo(marginX - 4, y + 4);
    pctx.lineTo(marginX - 4 + Math.min(lineWidth + 8, PAGE_W - 2 * (marginX - 4)), y + 4);
    pctx.stroke();
  });
  return { canvas: c, ctx: pctx };
}

const book = new Book({ width: PAGE_W, height: PAGE_H });
let pageState = {
  left: makePageCanvas(book.left.baselineYs, book.left.marginX, book.left.colsPerLine),
  right: makePageCanvas(book.right.baselineYs, book.right.marginX, book.right.colsPerLine),
};

let turn = null; // { oldLeft, oldRight, start, duration }
let totalGlyphs = 0;

// ---------------- Canvas sizing (DPR-aware) ----------------

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  els.canvas.width = TOTAL_W * dpr;
  els.canvas.height = TOTAL_H * dpr;
  els.canvas.style.width = TOTAL_W + 'px';
  els.canvas.style.height = TOTAL_H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ---------------- Audio setup ----------------

const audioEngine = new AudioEngine({ fftSize: 4096 });
const activity = new ActivityDetector();
let captureRunning = false;

async function populateDevices() {
  try {
    const devices = await AudioEngine.listInputDevices();
    els.deviceSelect.innerHTML = '<option value="">Default input</option>';
    devices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Input ${i + 1}`;
      els.deviceSelect.appendChild(opt);
    });
  } catch (e) {
    console.warn('Could not enumerate devices yet:', e);
  }
}
populateDevices();

function showError(message) {
  els.gateError.textContent = message;
  els.gateError.hidden = false;
}
function friendlyErrorMessage(err) {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Microphone/input access was denied. Check your browser\u2019s site permissions and try again.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No audio input device was found. Plug in an interface or microphone and try again.';
  }
  if (err.name === 'NotReadableError') {
    return 'The selected input is already in use by another application.';
  }
  return `Could not start listening: ${err.message || err.name || 'unknown error'}`;
}

els.startBtn.addEventListener('click', async () => {
  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Requesting permission\u2026';
  els.gateError.hidden = true;
  try {
    const deviceId = els.deviceSelect.value || null;
    const { sampleRate, channelCount } = await audioEngine.start(deviceId);
    captureRunning = true;
    els.statusDot.classList.add('live');
    els.statusText.textContent = `Listening \u2014 ${sampleRate} Hz, ${channelCount} ch`;
    els.gate.hidden = true;
    els.app.hidden = false;
    resizeCanvas();
    lastFrameTime = performance.now();
    requestAnimationFrame(frame);
  } catch (err) {
    console.error('[ambient-bloom] Failed to start capture:', err);
    els.startBtn.disabled = false;
    els.startBtn.textContent = 'Start listening';
    showError(friendlyErrorMessage(err));
  }
});

// ---------------- Writing logic ----------------

const PAUSE_THRESHOLD_MS = 550; // a gap this long in the music reads as a space
const TRICKLE_MAX_PER_SEC = 3; // ambient writing rate at activityLevel = 1
const BLOT_STRENGTH_THRESHOLD = 0.55; // onsets sharper than this also leave an ink blot

let lastMarkAtMs = 0; // last time ANY slot (glyph or skip) was placed
let trickleAccum = 0;
let trickleCounter = 0;
let jitterCounter = 0;

function freqToPitchClass(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  return ((Math.round(midi) % 12) + 12) % 12;
}

/** Places one glyph (with an optional preceding space if there's been a
 * pause), handling the page-turn transition if it fills the spread. */
function writeGlyph(pitchClass, strength, nowMs) {
  if (nowMs - lastMarkAtMs > PAUSE_THRESHOLD_MS && lastMarkAtMs > 0) {
    const skip = book.skipSlot();
    if (skip && skip.turnedPage) triggerPageTurn();
  }

  const placed = book.placeGlyph();
  if (!placed) return;
  const target = pageState[placed.side];
  jitterCounter++;
  drawGlyph(target.ctx, placed.x, placed.y, pitchClass, strength, INK, jitterCounter * 97);
  if (strength >= BLOT_STRENGTH_THRESHOLD) {
    drawBlot(target.ctx, placed.x + (Math.random() - 0.5) * 10, placed.y + 6 + Math.random() * 4, strength, INK, jitterCounter * 53 + 7);
  }
  totalGlyphs++;
  lastMarkAtMs = nowMs;
  els.glyphCounter.textContent = `${totalGlyphs} mark${totalGlyphs === 1 ? '' : 's'}`;

  if (placed.turnedPage) triggerPageTurn();
}

function triggerPageTurn() {
  turn = {
    oldLeft: pageState.left.canvas,
    oldRight: pageState.right.canvas,
    start: performance.now(),
    duration: 850,
  };
  book.startNewSpread();
  pageState = {
    left: makePageCanvas(book.left.baselineYs, book.left.marginX, book.left.colsPerLine),
    right: makePageCanvas(book.right.baselineYs, book.right.marginX, book.right.colsPerLine),
  };
  els.pageCounter.textContent = `Page ${book.pageNumber}`;
}

function paceLabel(level) {
  if (level < 0.12) return 'quiet';
  if (level < 0.35) return 'gentle';
  if (level < 0.65) return 'flowing';
  return 'brisk';
}

// ---------------- Render loop ----------------

let lastFrameTime = performance.now();

function frame(now) {
  const dtMs = Math.min(100, now - lastFrameTime); // clamp in case of a tab-switch stall
  lastFrameTime = now;

  if (captureRunning && audioEngine.isRunning) {
    const timeData = audioEngine.getTimeDomainData();
    const buf = timeData[0];
    const { onset, strength, activityLevel } = activity.update(buf, dtMs);

    if (onset) {
      const pitchResult = detectPitch(buf, audioEngine.sampleRate, { minHz: 60, maxHz: 1400 });
      const pitchClass = pitchResult ? freqToPitchClass(pitchResult.freq) : (trickleCounter = (trickleCounter + 5) % 12);
      writeGlyph(pitchClass, strength, now);
    }

    // Ambient trickle: keeps the book slowly writing during sustained,
    // low-onset material (pads), and adds extra pace on top of discrete
    // onsets during genuinely busy passages.
    trickleAccum += activityLevel * (TRICKLE_MAX_PER_SEC / 1000) * dtMs;
    while (trickleAccum >= 1) {
      trickleAccum -= 1;
      trickleCounter = (trickleCounter + 5) % 12;
      writeGlyph(trickleCounter, 0.3 + activityLevel * 0.3, now);
    }

    els.pacePill.textContent = `pace: ${paceLabel(activityLevel)}`;
  }

  render(now);
  requestAnimationFrame(frame);
}

function render(now) {
  ctx.clearRect(0, 0, TOTAL_W, TOTAL_H);

  if (turn) {
    const t = Math.min(1, (now - turn.start) / turn.duration);
    if (t >= 1) {
      turn = null;
      drawSpread(pageState.left.canvas, pageState.right.canvas, 1);
    } else if (t < 0.5) {
      drawSpread(turn.oldLeft, turn.oldRight, 1 - t / 0.5);
    } else {
      drawSpread(pageState.left.canvas, pageState.right.canvas, (t - 0.5) / 0.5);
    }
  } else {
    drawSpread(pageState.left.canvas, pageState.right.canvas, 1);
  }
}

/** Draws both pages with a horizontal-scale "closing/opening" transform,
 * pivoting at the spine — scaleX 0 = fully closed, 1 = fully open. */
function drawSpread(leftCanvas, rightCanvas, scaleX) {
  const spineX = TOTAL_W / 2;

  ctx.save();
  ctx.translate(spineX, 0);
  ctx.scale(Math.max(0.02, scaleX), 1);

  // Left page (drawn right-to-left from the spine).
  ctx.save();
  roundedRectPath(ctx, -PAGE_W, 0, PAGE_W, PAGE_H, PAGE_RADIUS);
  ctx.clip();
  ctx.drawImage(leftCanvas, -PAGE_W, 0);
  ctx.restore();

  // Right page.
  ctx.save();
  roundedRectPath(ctx, SPINE_GAP, 0, PAGE_W, PAGE_H, PAGE_RADIUS);
  ctx.clip();
  ctx.drawImage(rightCanvas, SPINE_GAP, 0);
  ctx.restore();

  // Spine shadow.
  const grad = ctx.createLinearGradient(-14, 0, 14, 0);
  grad.addColorStop(0, 'rgba(43,38,32,0)');
  grad.addColorStop(0.5, 'rgba(43,38,32,0.16)');
  grad.addColorStop(1, 'rgba(43,38,32,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-14, 0, 28, PAGE_H);

  ctx.restore();
}

render(performance.now());
