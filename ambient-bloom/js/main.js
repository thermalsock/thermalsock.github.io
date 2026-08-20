import { AudioEngine } from './audioEngine.js';
import { detectPitch, levelDb } from './pitchDetect.js';
import { ActivityDetector } from './activity.js';
import { Book } from './book.js';
import { drawGlyph, drawBlot, drawSparkle, GLYPH_ADVANCE } from './glyphs.js';
import { drawWeirdFlower, drawRosette, drawFlowerSilhouette, drawRosetteSilhouette } from './illustrations.js';
import { bandEnergies, spectralCentroid, zeroCrossingRate } from './spectral.js';
import { powerCurve, expCurve, mapRange } from './curve.js';

const els = {
  gate: document.getElementById('gate'),
  app: document.getElementById('app'),
  deviceSelect: document.getElementById('deviceSelect'),
  startBtn: document.getElementById('startBtn'),
  gateError: document.getElementById('gateError'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  levelPill: document.getElementById('levelPill'),
  pacePill: document.getElementById('pacePill'),
  canvas: document.getElementById('bookCanvas'),
  pageCounter: document.getElementById('pageCounter'),
  glyphCounter: document.getElementById('glyphCounter'),
};
const ctx = els.canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');

// ---------------- Page / book geometry ----------------

const PAGE_W = 460, PAGE_H = 600, SPINE_GAP = 16;
const TOTAL_W = PAGE_W * 2 + SPINE_GAP, TOTAL_H = PAGE_H;

const INK = '#4a3826'; // faded iron-gall-ink brown, not flat black
const PAGE_RADIUS = 3;

function roundedRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

let _pageSeed = 1;
function seededRand(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Paints an aged-vellum ground: a mottled base tone, soft foxing spots,
 * a darker vignette toward the edges, and fine speckle -- no ruled lines,
 * no flat uniform color. */
function paintAgedVellum(pctx, seed) {
  const rand = seededRand(seed);

  // Base tone varies slightly page to page, always in a worn parchment range.
  const baseHue = 38 + rand() * 12;
  const baseLight = 74 + rand() * 6;
  pctx.fillStyle = `hsl(${baseHue}, 34%, ${baseLight}%)`;
  pctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Broad mottling: a handful of large, very soft irregular tone shifts.
  for (let i = 0; i < 7; i++) {
    const x = rand() * PAGE_W, y = rand() * PAGE_H;
    const r = 60 + rand() * 140;
    const darker = rand() < 0.6;
    const grad = pctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = darker ? `hsla(${30 + rand() * 20}, 40%, ${40 + rand() * 15}%,` : `hsla(${45 + rand() * 15}, 45%, ${85 + rand() * 8}%,`;
    grad.addColorStop(0, tone + (0.06 + rand() * 0.05) + ')');
    grad.addColorStop(1, tone + '0)');
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, PAGE_W, PAGE_H);
  }

  // Foxing: small rust/brown age spots, denser near edges and corners.
  const spotCount = 45 + Math.floor(rand() * 35);
  for (let i = 0; i < spotCount; i++) {
    let x = rand() * PAGE_W, y = rand() * PAGE_H;
    // Bias toward edges: pull samples that land centrally back out.
    const edgeBiasX = Math.abs(x - PAGE_W / 2) / (PAGE_W / 2);
    const edgeBiasY = Math.abs(y - PAGE_H / 2) / (PAGE_H / 2);
    if (Math.max(edgeBiasX, edgeBiasY) < 0.5 && rand() < 0.55) continue;
    const r = 1 + rand() * 4.5;
    pctx.beginPath();
    pctx.arc(x, y, r, 0, Math.PI * 2);
    pctx.fillStyle = `hsla(${20 + rand() * 25}, 45%, ${30 + rand() * 20}%, ${0.05 + rand() * 0.1})`;
    pctx.fill();
  }

  // Vignette: edges and corners read darker/worn, like a handled old book.
  const vg = pctx.createRadialGradient(PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.3, PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.75);
  vg.addColorStop(0, 'rgba(40,28,16,0)');
  vg.addColorStop(1, 'rgba(40,28,16,0.16)');
  pctx.fillStyle = vg;
  pctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Fine speckle for texture (very subtle, low alpha).
  for (let i = 0; i < 260; i++) {
    const x = rand() * PAGE_W, y = rand() * PAGE_H;
    pctx.fillStyle = rand() < 0.5 ? 'rgba(40,28,16,0.03)' : 'rgba(255,250,235,0.04)';
    pctx.fillRect(x, y, 1, 1);
  }

  // A worn, slightly irregular border line near the edge, like a ruled
  // margin worn thin by age -- not a text-ruling grid, just a page edge.
  pctx.strokeStyle = 'rgba(40,28,16,0.10)';
  pctx.lineWidth = 1;
  pctx.beginPath();
  pctx.rect(10, 10, PAGE_W - 20, PAGE_H - 20);
  pctx.stroke();
}

function makePageCanvas(baselineYs, marginX, colsPerLine, allowIllustration) {
  const c = document.createElement('canvas');
  c.width = PAGE_W;
  c.height = PAGE_H;
  const pctx = c.getContext('2d');
  _pageSeed += 1;
  paintAgedVellum(pctx, _pageSeed * 7793 + 11);

  // Roughly a third of fresh pages open with a small illustration tucked
  // in a corner -- the manuscript's actual mix of text-only and
  // illustrated pages, not a diagram on every single one.
  const rand = seededRand(_pageSeed * 104729 + 3);
  if (allowIllustration && rand() < 0.55) {
    const corner = rand() < 0.5 ? 'flower' : 'rosette';
    const cx = PAGE_W * (0.62 + rand() * 0.24);
    const cy = PAGE_H * (0.68 + rand() * 0.2);
    if (corner === 'flower') {
      drawWeirdFlower(pctx, cx, cy, 1.1 + rand() * 0.7, INK, _pageSeed * 991 + 5);
    } else {
      drawRosette(pctx, cx, cy - 20, 75 + rand() * 35, INK, _pageSeed * 991 + 5);
    }
  }
  return { canvas: c, ctx: pctx };
}

const book = new Book({ width: PAGE_W, height: PAGE_H });
let pageState = {
  left: makePageCanvas(book.left.baselineYs, book.left.marginX, book.left.colsPerLine, true),
  right: makePageCanvas(book.right.baselineYs, book.right.marginX, book.right.colsPerLine, true),
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

  const stage = document.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  bgCanvas.width = rect.width * dpr;
  bgCanvas.height = rect.height * dpr;
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const { sampleRate, channelCount, deviceLabel } = await audioEngine.start(deviceId);
    // Unlike Oscilloscope/Subharmonicon (which expose a user-adjustable gain
    // slider), this app never applied any pre-analysis gain at all -- stuck
    // at the AudioEngine default of 1x. A real instrument-level signal
    // through an interface is often genuinely quiet at 1x; a modest fixed
    // boost here gets it into a comparable range without needing a control
    // the person has to go find first.
    audioEngine.setGain(4);
    captureRunning = true;
    els.statusDot.classList.add('live');
    els.statusText.textContent = `Listening \u2014 ${deviceLabel || 'unknown device'} \u2014 ${sampleRate} Hz, ${channelCount} ch`;
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
const TRICKLE_BASE_PER_SEC = 0.35; // near-still floor when nothing's playing -- just enough that the book never looks frozen
const TRICKLE_MAX_PER_SEC = 24;  // additional ambient rate at activityLevel = 1 (busy passages) -- this is what actually drives pace now
const BLOT_BASE_CHANCE = 0.12;   // every mark has at least this much chance of an ink blot
const BLOT_STRENGTH_BONUS = 0.75; // a strong onset adds up to this much more chance on top

let lastMarkAtMs = 0; // last time ANY slot (glyph or skip) was placed
let trickleAccum = 0;
let trickleCounter = 0;
let jitterCounter = 0;

function freqToPitchClass(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  return ((Math.round(midi) % 12) + 12) % 12;
}

/** Picks whichever channel is louder THIS frame, rather than averaging them
 * together. Averaging (an earlier version of this) can partially cancel a
 * real signal if the two channels aren't in phase with each other, which
 * is a common enough situation (any DI/balanced signal path, or just two
 * mic capsules at different distances) that it's not a safe assumption --
 * this can only ever match or beat reading a single fixed channel, never
 * do worse, since it always picks whichever channel actually has signal
 * rather than blending in a channel that might partially cancel it.
 * Returns the channel index too, so the matching frequency-domain buffer
 * can be read for spectral analysis. */
function pickLouderChannel(timeData) {
  if (timeData.length === 1) return { buf: timeData[0], index: 0 };
  let sumA = 0, sumB = 0;
  const a = timeData[0], b = timeData[1];
  for (let i = 0; i < a.length; i++) { sumA += a[i] * a[i]; sumB += b[i] * b[i]; }
  return sumB > sumA ? { buf: b, index: 1 } : { buf: a, index: 0 };
}

/** Which of the three bands has the largest *share* of energy (not an
 * absolute threshold — those bands cover very different bandwidths and
 * absolute dB-derived magnitudes vary a lot with source material, so a
 * fixed floor would need real-world calibration this environment can't
 * do; a relative-share comparison is meaningful regardless of overall
 * level). Drives the "low band -> large organic shapes, mid -> medium
 * marks, high -> tiny sparkles" split. */
function dominantBand(bands) {
  const total = bands.low + bands.mid + bands.high + 1e-6;
  const shareLow = bands.low / total, shareMid = bands.mid / total, shareHigh = bands.high / total;
  if (shareHigh >= shareLow && shareHigh >= shareMid) return 'high';
  if (shareLow >= shareMid) return 'low';
  return 'mid';
}

/** Places one glyph (with an optional preceding space if there's been a
 * pause), handling the page-turn transition if it fills the spread.
 * Blots are probabilistic, not a hard cutoff — even a modest mark has a
 * baseline chance of one, so the page never goes long without any.
 *
 * `features`, when present, is {bands, centroidHz, zcr} from spectral.js —
 * this is what actually varies mark size/style/jitter by the audio's
 * spectral character rather than pitch-class + a jitter counter alone:
 *   low band dominant  -> larger, more "organic" glyph (bigger sizeMult)
 *   high band dominant -> a tiny sparkle mark instead of a full glyph
 *   mid band (default) -> baseline-sized glyph
 *   spectral centroid   -> biases which of the 8 stroke variants for this
 *                          pitch class gets drawn (brighter material skews
 *                          toward later/more angular variants)
 *   zero-crossing rate  -> scales per-stroke jitter (noisier signal =
 *                          more irregular placement/wobble)
 */
function writeGlyph(pitchClass, strength, nowMs, features) {
  if (nowMs - lastMarkAtMs > PAUSE_THRESHOLD_MS && lastMarkAtMs > 0) {
    const skip = book.skipSlot();
    if (skip && skip.turnedPage) triggerPageTurn(nowMs);
  }

  const placed = book.placeGlyph();
  if (!placed) return;
  const target = pageState[placed.side];
  jitterCounter++;

  const bands = features?.bands || { low: 0.34, mid: 0.34, high: 0.32 };
  const band = dominantBand(bands);
  const jitterAmount = 0.55 + (features?.zcr ?? 0) * 1.7;
  const centroidVariant = features?.centroidHz != null
    ? Math.floor(mapRange(Math.log2(features.centroidHz / 110), 0, 7, 0, 7.999))
    : null;

  if (band === 'high') {
    // High band dominant -> tiny sparkle instead of a full manuscript
    // glyph: a bright, thin transient (cymbal, breath noise, fret
    // squeak) reads as too heavy if drawn with the same weight as a note.
    const size = 2.6 + strength * 4.5;
    drawSparkle(target.ctx, placed.x + GLYPH_ADVANCE * 0.32, placed.y - 2, size, INK, 0.5 + strength * 0.4, jitterCounter * 61 + 3);
  } else {
    const sizeMult = band === 'low'
      ? 1.25 + strength * 1.35   // low band -> large organic shapes
      : 0.82 + strength * 0.55;  // mid band (default) -> medium marks
    drawGlyph(target.ctx, placed.x, placed.y, pitchClass, strength, INK, jitterCounter * 97, sizeMult, 0, jitterAmount, centroidVariant);
  }

  if (Math.random() < BLOT_BASE_CHANCE + strength * BLOT_STRENGTH_BONUS) {
    drawBlot(target.ctx, placed.x + (Math.random() - 0.5) * 12, placed.y + 6 + Math.random() * 5, Math.max(strength, 0.3), INK, jitterCounter * 53 + 7, jitterAmount);
  }
  totalGlyphs++;
  lastMarkAtMs = nowMs;
  els.glyphCounter.textContent = `${totalGlyphs} mark${totalGlyphs === 1 ? '' : 's'}`;
  pulseBackground(strength, nowMs);

  if (placed.turnedPage) triggerPageTurn(nowMs);
}

// ---------------- Document structure ----------------
// The book doesn't just fill a uniform grid of marks — it reads more like
// a real hand-written document: paragraphs of a random rough length,
// occasional headers (a bigger "title" line + a smaller skewed "subtitle"
// line, standing in for bold/italic), paragraph indents, whitespace
// deliberately left for an illustration instead of more text, and pages
// that sometimes end early partway down rather than always filling every
// last slot -- a "new chapter" rather than a hard-packed page.

const PARAGRAPH_MIN = 10, PARAGRAPH_MAX = 30;
const HEADER_CHANCE = 0.22;
const IMAGE_GAP_CHANCE = 0.16;
const CHAPTER_FILL_THRESHOLD = 0.6; // page has to be at least this full before a chapter break is considered
const CHAPTER_CHANCE = 0.32; // probability of taking it, once eligible, at each paragraph boundary

let marksUntilBreak = PARAGRAPH_MIN + Math.floor(Math.random() * (PARAGRAPH_MAX - PARAGRAPH_MIN));
let structureSeed = 1;

function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

/** The real entry point for placing a mark -- decides whether this beat is
 * just another glyph in the current paragraph, or a structural break. */
function writeMark(pitchClass, strength, nowMs, features) {
  marksUntilBreak--;
  if (marksUntilBreak > 0) {
    writeGlyph(pitchClass, strength, nowMs, features);
    return;
  }
  marksUntilBreak = randInt(PARAGRAPH_MIN, PARAGRAPH_MAX);

  const fillFrac = book.spreadFillFraction;
  const roll = Math.random();

  if (fillFrac > CHAPTER_FILL_THRESHOLD && roll < CHAPTER_CHANCE) {
    startNewChapter(nowMs);
  } else if (roll < CHAPTER_CHANCE + HEADER_CHANCE) {
    writeHeaderBlock(nowMs);
  } else if (roll < CHAPTER_CHANCE + HEADER_CHANCE + IMAGE_GAP_CHANCE) {
    writeImageGap(nowMs);
  } else {
    writeParagraphBreak();
  }
}

/** A normal paragraph break: drop to a fresh line, leave one blank line as
 * a gap, indent the new paragraph's first mark slightly. */
function writeParagraphBreak() {
  let r = book.newLine();
  if (r && r.turnedPage) { triggerPageTurn(performance.now()); return; }
  r = book.newLine(); // the blank gap line
  if (r && r.turnedPage) { triggerPageTurn(performance.now()); return; }
  book.indent(randInt(1, 3));
}

/** A title line (bigger glyphs) + an indented subtitle line (smaller,
 * skewed) standing in for a heading, then a gap before body text resumes. */
function writeHeaderBlock(nowMs) {
  let r = book.newLine();
  if (r && r.turnedPage) { triggerPageTurn(nowMs); return; }

  const titleLen = randInt(3, 6);
  for (let i = 0; i < titleLen; i++) {
    const placed = book.placeGlyph();
    if (!placed) { triggerPageTurn(nowMs); return; }
    structureSeed++;
    drawGlyph(pageState[placed.side].ctx, placed.x, placed.y, structureSeed % 12, 0.75, INK, structureSeed * 61, 1.55, 0);
    if (placed.turnedPage) { triggerPageTurn(nowMs); return; }
  }

  r = book.newLine();
  if (r && r.turnedPage) { triggerPageTurn(nowMs); return; }
  book.indent(randInt(1, 2));

  const subtitleLen = randInt(2, 5);
  for (let i = 0; i < subtitleLen; i++) {
    const placed = book.placeGlyph();
    if (!placed) { triggerPageTurn(nowMs); return; }
    structureSeed++;
    drawGlyph(pageState[placed.side].ctx, placed.x, placed.y, structureSeed % 12, 0.45, INK, structureSeed * 61, 0.72, 0.22);
    if (placed.turnedPage) { triggerPageTurn(nowMs); return; }
  }

  r = book.newLine();
  if (r && r.turnedPage) { triggerPageTurn(nowMs); return; }
  book.indent(randInt(1, 3));
}

/** Leaves a few blank lines and fills that whitespace with a small
 * illustration instead of more text -- the manuscript's actual habit of
 * text stopping to make room for a drawing, not wrapping around it. */
function writeImageGap(nowMs) {
  let r = book.newLine();
  if (r && r.turnedPage) { triggerPageTurn(nowMs); return; }

  const gapLines = randInt(4, 6);
  const side = book.activeSide;
  const page = side === 'left' ? book.left : book.right;
  const startLine = page.line;
  const targetCtx = pageState[side].ctx;

  for (let i = 0; i < gapLines; i++) {
    const rr = book.newLine();
    if (rr && rr.turnedPage) { triggerPageTurn(nowMs); return; }
  }

  const yTop = page.lineY(startLine);
  const yBottom = page.lineY(Math.min(page.line, startLine + gapLines));
  const cx = page.marginX + (page.colsPerLine * 21) / 2 + (Math.random() - 0.5) * 20;
  const cy = (yTop + yBottom) / 2;
  structureSeed++;
  if (Math.random() < 0.5) {
    drawWeirdFlower(targetCtx, cx, cy + (yBottom - yTop) * 0.3, 1.0 + Math.random() * 0.6, INK, structureSeed * 991 + 5);
  } else {
    drawRosette(targetCtx, cx, cy, Math.max(28, (yBottom - yTop) * 0.5), INK, structureSeed * 991 + 5);
  }

  book.indent(randInt(1, 3));
}

/** Ends the current spread early -- partway down the page rather than
 * packed to the last slot -- and opens the new spread with a header, like
 * turning to a new chapter mid-page. */
function startNewChapter(nowMs) {
  book.forceEndSpread();
  triggerPageTurn(nowMs);
  writeHeaderBlock(nowMs);
}

// ---------------- Ambient background blooms ----------------
// Reclaims the app's "Bloom" identity as something alive happening in the
// space around the book -- soft expanding rings of ink, not literal
// bubbles, spawned both on a slow ambient timer (so the room never feels
// dead even in silence) and whenever a mark lands on the page (scaled by
// how strong that mark was).

const blooms = [];
const MAX_BLOOMS = 60;
const BLOOM_COLORS = ['139,74,43', '43,38,32', '51,71,92']; // rust, ink, ink-blue

function spawnBloom(strength, now) {
  if (blooms.length >= MAX_BLOOMS) blooms.shift();
  const rect = document.querySelector('.stage').getBoundingClientRect();
  blooms.push({
    x: Math.random() * rect.width,
    y: Math.random() * rect.height,
    maxR: 55 + strength * 150 + Math.random() * 70,
    birth: now,
    life: 2200 + Math.random() * 2600,
    color: BLOOM_COLORS[Math.floor(Math.random() * BLOOM_COLORS.length)],
    peakAlpha: 0.16 + strength * 0.3,
    shape: Math.random() < 0.5 ? 'flower' : 'rosette',
    seed: Math.floor(Math.random() * 1e9),
    rotation: Math.random() * Math.PI * 2,
  });
}

function pulseBackground(strength, now) {
  // Only some marks spawn a visible bloom (otherwise it's too busy) --
  // stronger marks are more likely to.
  if (Math.random() < 0.15 + strength * 0.5) spawnBloom(strength, now);
}

let ambientBloomAccum = 0;
function updateAmbientBlooms(dtMs, activityLevel, now) {
  // A slow baseline rate regardless of activity, plus a bit more during
  // busier playing -- the background is never fully still.
  const rate = 0.6 + activityLevel * 1.1; // blooms per second
  ambientBloomAccum += (rate / 1000) * dtMs;
  while (ambientBloomAccum >= 1) {
    ambientBloomAccum -= 1;
    spawnBloom(0.15 + Math.random() * 0.25, now);
  }
}

function renderBlooms(now) {
  const dpr = window.devicePixelRatio || 1;
  const w = bgCanvas.width / dpr;
  const h = bgCanvas.height / dpr;
  bgCtx.clearRect(0, 0, w, h);
  for (let i = blooms.length - 1; i >= 0; i--) {
    const b = blooms[i];
    // Clamped to 0: a bloom's own birth timestamp should never be after
    // the frame timestamp it's compared against now that both come from
    // the same clock read (see spawnBloom), but this stays as a defensive
    // floor regardless -- a negative t here is exactly what previously
    // produced a negative radius and crashed createRadialGradient, taking
    // the entire render loop down with it permanently (an uncaught
    // exception before the recursive requestAnimationFrame call stops the
    // whole app, not just that one frame). Never again worth risking.
    const t = Math.max(0, (now - b.birth) / b.life);
    if (t >= 1) { blooms.splice(i, 1); continue; }
    // Grow fast at first, then ease; fade in quickly and out slowly, like
    // ink actually spreading through water/paper.
    const grow = 1 - Math.pow(1 - Math.min(1, t / 0.4), 2);
    const r = Math.max(0.01, b.maxR * grow);
    const alpha = Math.max(0, t < 0.15 ? (t / 0.15) * b.peakAlpha : b.peakAlpha * (1 - (t - 0.15) / 0.85));
    const color = `rgb(${b.color})`;
    const blurPx = Math.max(2, r * 0.16);

    bgCtx.save();
    bgCtx.filter = `blur(${blurPx}px)`;
    bgCtx.translate(b.x, b.y);
    bgCtx.rotate(b.rotation);
    if (b.shape === 'flower') {
      drawFlowerSilhouette(bgCtx, 0, r * 0.25, r / 40, color, alpha, b.seed);
    } else {
      drawRosetteSilhouette(bgCtx, 0, 0, r * 0.55, color, alpha, b.seed);
    }
    bgCtx.restore();
  }
}

function triggerPageTurn(now) {
  turn = {
    oldLeft: pageState.left.canvas,
    oldRight: pageState.right.canvas,
    start: now,
    duration: 850,
  };
  book.startNewSpread();
  pageState = {
    left: makePageCanvas(book.left.baselineYs, book.left.marginX, book.left.colsPerLine, true),
    right: makePageCanvas(book.right.baselineYs, book.right.marginX, book.right.colsPerLine, true),
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
    // Pick whichever channel is louder this frame -- robust to a signal on
    // either channel, without the phase-cancellation risk of averaging them.
    const { buf, index: chIdx } = pickLouderChannel(timeData);
    const { onset, strength: rawStrength, activityLevel } = activity.update(buf, dtMs);

    // The reactivity curve: every visual consumer downstream reads this
    // curved value, not the raw linear one — quiet stays quiet longer,
    // loud disproportionately bigger, instead of a flat ruler from 0 to 1.
    const strength = powerCurve(rawStrength, 0.65);

    // Spectral features -- computed every frame (cheap: a few hundred bin
    // reads), not just on onset, since band-driven size/style should also
    // apply to the ambient trickle marks, not only hard transients.
    const freqBuf = audioEngine.getFrequencyData()[chIdx];
    const bands = bandEnergies(freqBuf, audioEngine.sampleRate, audioEngine.minDecibels, audioEngine.maxDecibels);
    const centroidHz = spectralCentroid(freqBuf, audioEngine.sampleRate, audioEngine.minDecibels, audioEngine.maxDecibels);
    const zcr = zeroCrossingRate(buf);
    const features = { bands, centroidHz, zcr };

    if (onset) {
      const pitchResult = detectPitch(buf, audioEngine.sampleRate, { minHz: 60, maxHz: 1400 });
      const basePitchClass = pitchResult ? freqToPitchClass(pitchResult.freq) : (trickleCounter = (trickleCounter + 5) % 12);
      // Burst events: a separate, steeper curve from the general
      // reactivity one above -- a merely-loud onset and a genuinely hard
      // one should look meaningfully different in how many marks land at
      // once, not just proportionally different. A single quiet note is
      // one small stroke; a hard hit is an emphatic little cluster, like
      // a word landing hard on the page.
      const burstCount = 1 + Math.floor(expCurve(rawStrength, 2.5) * 3.5);
      for (let i = 0; i < burstCount; i++) {
        writeMark((basePitchClass + i) % 12, strength, now, features);
      }
    }

    // Ambient trickle: a near-still floor keeps the book from looking
    // frozen in true silence, with a much larger activity-scaled rate on
    // top that's what actually drives pace during real playing.
    const trickleRate = TRICKLE_BASE_PER_SEC + activityLevel * TRICKLE_MAX_PER_SEC;
    trickleAccum += trickleRate / 1000 * dtMs;
    while (trickleAccum >= 1) {
      trickleAccum -= 1;
      trickleCounter = (trickleCounter + 5) % 12;
      writeMark(trickleCounter, 0.25 + activityLevel * 0.4, now, features);
    }

    const db = levelDb(buf);
    els.levelPill.textContent = isFinite(db) ? `level: ${db.toFixed(0)} dB` : 'level: silent';
    els.levelPill.classList.toggle('pill-warn', !isFinite(db) || db < -50);

    els.pacePill.textContent = `pace: ${paceLabel(activityLevel)}`;
    updateAmbientBlooms(dtMs, activityLevel, now);
  }

  render(now);
  requestAnimationFrame(frame);
}

function render(now) {
  renderBlooms(now);
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
