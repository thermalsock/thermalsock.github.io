// main.js — The Illuminated Ear
// Ties together: AudioEngine (mic), pitchDetect.js + activity.js (listening),
// glyphs.js (drawing), sequence.js + game.js (the actual game), all reused
// as-is from Ambient Bloom/Loom's proven implementations rather than
// rewritten.

import { AudioEngine, pickLouderChannel } from './audioEngine.js';
import { detectPitch, levelDb, PitchLock } from './pitchDetect.js';
import { ActivityDetector, rms } from './activity.js';
import { drawGlyph, GLYPH_ADVANCE } from './glyphs.js';
import { Game, PHASE, LEVELS } from './game.js';
import { SCALES } from './sequence.js';
import { initMidi, onMidiNoteOn, onMidiDevicesChanged, hasMidiDevice } from './midi.js';
import { drawPitchVision, drawIntervalVision, signedInterval } from './vision.js';

const $ = (id) => document.getElementById(id);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const INK = '#4a3826';
const INK_GOLD = '#8B4A2B'; // "illumination" color for confirmed-correct marks — the site's own accent, doubling as literal gilt ink
const INK_CORRECTION = '#b8402a';

const audioEngine = new AudioEngine();
const activity = new ActivityDetector();
const tuningLock = new PitchLock({ requiredStableFrames: 12, toleranceCents: 12 });
let game = null;

let appState = 'tuning'; // 'tuning' | 'playing'
let tonicLockedAtMs = null;
const TUNE_CONFIRM_MS = 900; // held on top of the lock itself, so confirming a tonic reads as a deliberate "yes, that one" rather than an instant, easy-to-miss flash

let ctx = null;
let pageW = 0, pageH = 0;
let targetX = 0, responseX = 0; // running horizontal write-position for each row, reset every round
const TARGET_ROW_Y = 90;
const RESPONSE_ROW_Y = 210;
const ROW_START_X = 40;

let jitterCounter = 1;
let allTimeBest = parseInt(localStorage.getItem('illuminatedEar.bestStreak') || '0', 10);
let pitchVisionEnabled = true;
let intervalVisionEnabled = true;
let midiConnected = false;

// ---------------------------------------------------------------------------
// MIDI — set up as early as possible (doesn't need mic permission first),
// so the gate can honestly say whether a keyboard is available before the
// player even hits Start.
// ---------------------------------------------------------------------------

initMidi().then(({ supported, deviceNames }) => {
  const gateStatus = $('midiGateStatus');
  if (!supported) {
    gateStatus.textContent = 'No MIDI support detected in this browser — mic/voice input will be used instead.';
  } else if (deviceNames.length === 0) {
    gateStatus.textContent = 'No MIDI keyboard connected yet — mic/voice input will be used, or plug one in any time.';
  } else {
    gateStatus.textContent = `MIDI keyboard connected: ${deviceNames.join(', ')}.`;
  }
});

onMidiDevicesChanged((deviceNames) => {
  midiConnected = deviceNames.length > 0;
  const pill = $('midiStatusPill');
  if (pill) pill.textContent = midiConnected ? `MIDI: ${deviceNames[0]}` : 'MIDI: not connected';
  const tuneCopy = $('tuneCopy');
  if (tuneCopy) {
    tuneCopy.textContent = midiConnected
      ? 'Press a single key on your MIDI keyboard — or sing/play a sustained note into the mic instead. Everything that follows is relative to it, so there\'s no wrong note to start on.'
      : 'Play or sing a single sustained note — whatever\'s comfortable for your instrument or voice. Everything that follows is relative to it, so there\'s no wrong note to start on.';
  }
});

onMidiNoteOn((midiNoteNumber, velocity) => {
  if (!game) return;
  const nowMs = performance.now();
  if (appState === 'tuning') {
    confirmTonicFromMidi(midiNoteNumber, nowMs);
  } else if (game.phase === PHASE.RECALLING) {
    const result = game.processMidiNoteOn(midiNoteNumber, nowMs);
    handleRecallResult(result);
  }
});

// Minimum RMS before even attempting pitch detection. Normalized
// autocorrelation only measures *shape* correlation, not absolute level —
// it doesn't inherently know the difference between a real played note and
// mic self-noise or 50/60Hz electrical hum picked up from a laptop's own
// power supply, both of which are genuinely periodic enough to sometimes
// read as a confident "pitch" even at a barely-there amplitude. Confirmed
// directly: a simulated near-silent hum buffer (RMS ~0.0006) produced a
// "confident" (0.89) detection with no gate in place. This is what caused
// tuning to fire on nothing at all — not a tolerance/timing problem, a
// missing floor.
const PITCH_DETECT_MIN_RMS = 0.012;

function gatedDetectPitch(buf, opts) {
  return rms(buf) >= PITCH_DETECT_MIN_RMS ? detectPitch(buf, audioEngine.sampleRate, opts) : null;
}

// ---------------------------------------------------------------------------
// Gate / startup
// ---------------------------------------------------------------------------

async function populateDevices() {
  try {
    const devices = await AudioEngine.listInputDevices();
    const select = $('deviceSelect');
    devices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Input ${i + 1}`;
      select.appendChild(opt);
    });
  } catch (err) { /* pre-permission enumeration can throw in some browsers; non-fatal */ }
}
populateDevices();

$('startBtn').addEventListener('click', async () => {
  const deviceId = $('deviceSelect').value || null;
  $('startBtn').disabled = true;
  $('startBtn').textContent = 'Starting…';
  try {
    await audioEngine.start(deviceId);
    $('gate').hidden = true;
    $('app').hidden = false;
    boot();
  } catch (err) {
    console.error(err);
    $('gateError').hidden = false;
    $('gateError').textContent = err.name === 'NotAllowedError'
      ? 'Microphone access was denied. Grant permission and try again.'
      : `Could not start listening: ${err.message || err}`;
    $('startBtn').disabled = false;
    $('startBtn').textContent = 'Start';
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  const scaleSelect = $('scaleSelect');
  SCALES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    scaleSelect.appendChild(opt);
  });
  scaleSelect.value = SCALES[0].id;
  updateScaleDesc();
  scaleSelect.addEventListener('change', () => {
    if (game) game.setScale(SCALES.find((s) => s.id === scaleSelect.value));
    updateScaleDesc();
  });

  game = new Game(SCALES[0]);
  $('statAllTimeBest').textContent = allTimeBest;
  updateStatsUI();

  setupCanvas();

  $('replayBtn').addEventListener('click', () => {
    if (game.phase === PHASE.RECALLING || game.phase === PHASE.LISTENING) {
      replayCurrentSequence();
    }
  });
  $('retuneBtn').addEventListener('click', () => {
    appState = 'tuning';
    tonicLockedAtMs = null;
    tuningLock.reset();
    $('gameCard').hidden = true;
    $('tuneCard').hidden = false;
    $('tuneNote').textContent = '—';
    $('tuneHint').textContent = 'Waiting for a steady note…';
    $('tuneProgressFill').style.width = '0%';
    $('statusText').textContent = 'Tuning';
  });

  $('pitchVisionCb').addEventListener('change', (e) => { pitchVisionEnabled = e.target.checked; });
  $('intervalVisionCb').addEventListener('change', (e) => { intervalVisionEnabled = e.target.checked; });

  requestAnimationFrame(frame);
}

function updateScaleDesc() {
  const s = SCALES.find((x) => x.id === $('scaleSelect').value) || SCALES[0];
  $('scaleDesc').textContent = s.desc;
}

function setupCanvas() {
  const canvas = $('pageCanvas');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  pageW = Math.max(1, Math.round(rect.width));
  pageH = Math.max(1, Math.round(rect.height));
  canvas.width = pageW * dpr;
  canvas.height = pageH * dpr;
  ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintVellum();
}

// ---------------------------------------------------------------------------
// Page rendering — a simplified single-page version of Ambient Bloom's
// aged-vellum background, since this game only ever needs one page visible
// at a time rather than a two-page spread.
// ---------------------------------------------------------------------------

function seededRand(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function paintVellum() {
  const rand = seededRand((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const baseHue = 38 + rand() * 12;
  const baseLight = 78 + rand() * 5;
  ctx.fillStyle = `hsl(${baseHue}, 30%, ${baseLight}%)`;
  ctx.fillRect(0, 0, pageW, pageH);

  for (let i = 0; i < 4; i++) {
    const x = rand() * pageW, y = rand() * pageH, r = 50 + rand() * 120;
    const darker = rand() < 0.6;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = darker
      ? `hsla(${30 + rand() * 20}, 36%, ${44 + rand() * 15}%,`
      : `hsla(${45 + rand() * 15}, 40%, ${88 + rand() * 6}%,`;
    grad.addColorStop(0, tone + (0.05 + rand() * 0.04) + ')');
    grad.addColorStop(1, tone + '0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, pageW, pageH);
  }

  const spotCount = 16 + Math.floor(rand() * 16);
  for (let i = 0; i < spotCount; i++) {
    const x = rand() * pageW, y = rand() * pageH, r = 0.7 + rand() * 2.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${18 + rand() * 16}, 45%, ${34 + rand() * 15}%, ${0.06 + rand() * 0.08})`;
    ctx.fill();
  }

  // Faint baseline rules for the two rows, like a manuscript's ruled lines.
  ctx.strokeStyle = 'rgba(43,38,32,0.09)';
  ctx.lineWidth = 1;
  [TARGET_ROW_Y + 8, RESPONSE_ROW_Y + 8].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(ROW_START_X - 10, y);
    ctx.lineTo(pageW - 20, y);
    ctx.stroke();
  });

  targetX = ROW_START_X;
  responseX = ROW_START_X;
}

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

function freqToNoteName(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

function updateTuning(buf, nowMs) {
  const pitchResult = gatedDetectPitch(buf, { minHz: 50, maxHz: 1500 });
  const locked = tuningLock.update(pitchResult ? pitchResult.freq : null);

  if (pitchResult) {
    $('tuneNote').textContent = freqToNoteName(pitchResult.freq);
  }

  if (locked != null) {
    if (tonicLockedAtMs == null) {
      tonicLockedAtMs = nowMs;
      $('tuneHint').textContent = 'Locked — hold it a moment longer…';
    }
    const progress = Math.min(1, (nowMs - tonicLockedAtMs) / TUNE_CONFIRM_MS);
    $('tuneProgressFill').style.width = `${progress * 100}%`;
    if (progress >= 1) {
      confirmTonic(locked);
    }
  } else {
    tonicLockedAtMs = null;
    $('tuneProgressFill').style.width = '0%';
    if (!pitchResult) $('tuneHint').textContent = 'Waiting for a steady note…';
  }
}

function confirmTonic(freq) {
  game.setTonic(freq);
  $('tonicReadout').textContent = freqToNoteName(freq);
  appState = 'playing';
  $('tuneCard').hidden = true;
  $('gameCard').hidden = false;
  $('statusText').textContent = 'Listening';
  startNewRound();
}

// MIDI tuning is exact (a note-on is unambiguous, no autocorrelation
// guesswork to wait out) but still holds for a brief beat before
// switching screens — an instant, zero-feedback cut would reproduce
// exactly the "it vanished before I could react" problem the mic flow
// had before its confirm delay was added, just via a different cause.
let midiTuneTimer = null;
function confirmTonicFromMidi(midiNoteNumber, nowMs) {
  const freq = 440 * Math.pow(2, (midiNoteNumber - 69) / 12);
  $('tuneNote').textContent = freqToNoteName(freq);
  $('tuneHint').textContent = 'Locked — from your MIDI keyboard.';
  $('tuneProgressFill').style.width = '100%';
  if (midiTuneTimer) clearTimeout(midiTuneTimer);
  midiTuneTimer = setTimeout(() => { if (appState === 'tuning') confirmTonic(freq); }, 500);
}

// ---------------------------------------------------------------------------
// Listen phase — plays the sequence with a simple pad voice, writing each
// glyph onto the target row in sync with its note.
// ---------------------------------------------------------------------------

function playTone(semitoneOffset, whenSec, durSec) {
  const freq = game.tonicFreq * Math.pow(2, semitoneOffset / 12);
  const osc = audioEngine.audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const gain = audioEngine.audioCtx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(audioEngine.audioCtx.destination);
  osc.start(whenSec);
  const attack = 0.03, release = 0.12;
  gain.gain.setValueAtTime(0, whenSec);
  gain.gain.linearRampToValueAtTime(0.16, whenSec + attack);
  gain.gain.setValueAtTime(0.16, whenSec + durSec - release);
  gain.gain.linearRampToValueAtTime(0, whenSec + durSec);
  osc.stop(whenSec + durSec + 0.02);
}

let listenTimers = [];
function clearListenTimers() {
  listenTimers.forEach((t) => clearTimeout(t));
  listenTimers = [];
}

const NOTE_DUR_MS = 480;
const NOTE_GAP_MS = 140;

function scheduleListenPhase(sequence) {
  clearListenTimers();
  $('phaseLabel').textContent = 'Listen…';
  $('statusText').textContent = 'Playing';
  const VISION_LEAD_MS = 160; // how far ahead of the note the hint appears — "telegraphed," not simultaneous
  let nextTargetX = targetX; // precomputed so the vision cue (drawn before the note) lands at the same x the glyph will use
  sequence.forEach((offset, i) => {
    const stepMs = i * (NOTE_DUR_MS + NOTE_GAP_MS);
    const cueX = nextTargetX;
    nextTargetX += GLYPH_ADVANCE;

    if (pitchVisionEnabled || intervalVisionEnabled) {
      listenTimers.push(setTimeout(() => {
        if (game.visionUnlocked.pitch && pitchVisionEnabled) {
          const prev = i > 0 ? sequence[i - 1] : offset;
          const direction = i === 0 ? 0 : Math.sign(signedInterval(prev, offset));
          drawPitchVision(ctx, cueX, TARGET_ROW_Y, offset, direction);
        }
        if (i > 0 && game.visionUnlocked.interval && intervalVisionEnabled) {
          drawIntervalVision(ctx, cueX, TARGET_ROW_Y - 16, signedInterval(sequence[i - 1], offset));
        }
      }, Math.max(0, stepMs - VISION_LEAD_MS)));
    }

    listenTimers.push(setTimeout(() => {
      playTone(offset, audioEngine.audioCtx.currentTime, NOTE_DUR_MS / 1000);
      jitterCounter++;
      drawGlyph(ctx, targetX, TARGET_ROW_Y, offset, 0.75, INK, jitterCounter * 97);
      targetX += GLYPH_ADVANCE;
    }, stepMs));
  });
  const totalMs = sequence.length * (NOTE_DUR_MS + NOTE_GAP_MS) + 350;
  listenTimers.push(setTimeout(() => beginRecall(), totalMs));
}

function replayCurrentSequence() {
  clearListenTimers();
  game.restartListen();
  // Re-write the target row from scratch so a replay doesn't double up marks.
  paintVellum();
  scheduleListenPhase(game.sequence);
}

function beginRecall() {
  game.beginRecall(performance.now());
  $('phaseLabel').textContent = 'Your turn — play it back';
  $('statusText').textContent = 'Your turn';
}

// ---------------------------------------------------------------------------
// Recall phase feedback
// ---------------------------------------------------------------------------

function drawResponseMark(correct, offset) {
  jitterCounter++;
  if (correct) {
    drawGlyph(ctx, responseX, RESPONSE_ROW_Y, offset, 0.9, INK_GOLD, jitterCounter * 97);
  } else {
    // A scribe's correction mark, not a wrong glyph — showing the wrong
    // shape wouldn't mean anything to the player, a correction slash does.
    ctx.save();
    ctx.strokeStyle = INK_CORRECTION;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(responseX - 4, RESPONSE_ROW_Y - 7);
    ctx.lineTo(responseX + 9, RESPONSE_ROW_Y + 7);
    ctx.moveTo(responseX + 9, RESPONSE_ROW_Y - 7);
    ctx.lineTo(responseX - 4, RESPONSE_ROW_Y + 7);
    ctx.stroke();
    ctx.restore();
  }
  responseX += GLYPH_ADVANCE;
}

function showFeedback(success, notesCorrect, totalNotes) {
  const banner = $('feedbackBanner');
  banner.hidden = false;
  banner.className = 'feedback-banner ' + (success ? 'success' : 'fail');
  banner.textContent = success
    ? `Decoded! ${totalNotes}/${totalNotes} notes — the page illuminates.`
    : `${notesCorrect}/${totalNotes} notes matched before the line broke.`;
}

function updateStatsUI() {
  $('scorePill').textContent = `Score ${game.score}`;
  $('streakPill').textContent = `Streak ${game.streak}`;
  $('statRounds').textContent = game.roundsPlayed;
  $('statLength').textContent = `${game.sequenceLength} note${game.sequenceLength === 1 ? '' : 's'}`;
  $('statBestStreak').textContent = game.bestStreak;
  if (game.bestStreak > allTimeBest) {
    allTimeBest = game.bestStreak;
    localStorage.setItem('illuminatedEar.bestStreak', String(allTimeBest));
    $('statAllTimeBest').textContent = allTimeBest;
  }

  const level = game.levelInfo;
  const next = game.nextLevelInfo;
  $('levelPill').textContent = `Lv.${level.level} ${level.name}`;
  if (next) {
    const span = next.xpRequired - level.xpRequired;
    const into = game.xp - level.xpRequired;
    $('xpBarFill').style.width = `${Math.min(100, (into / span) * 100)}%`;
    $('xpLabel').textContent = `${next.xpRequired - game.xp} XP to Level ${next.level}`;
  } else {
    $('xpBarFill').style.width = '100%';
    $('xpLabel').textContent = `Level ${level.level} — Full Vision reached`;
  }

  const unlocked = game.visionUnlocked;
  const anyUnlocked = Object.keys(unlocked).length > 0;
  $('visionToggleRow').hidden = !anyUnlocked;
  $('intervalVisionLabel').hidden = !unlocked.interval;
}

/** Shared by both the mic/audio recall path (frame(), below) and the MIDI
 * note-on handler above — same UI reaction either way to a note being
 * scored or a round ending, regardless of which input produced it. */
function handleRecallResult(result) {
  if (!result) return;
  if (result.noteScored) {
    drawResponseMark(result.correct, result.offset);
  }
  if (result.roundOver) {
    const notesCorrect = game.responses.filter((r) => r.correct).length;
    showFeedback(result.success, notesCorrect, game.sequence.length);
    updateStatsUI();
    $('phaseLabel').textContent = result.success ? 'Illuminated' : 'Line broken';
    $('statusText').textContent = 'Listening';
    setTimeout(() => { if (appState === 'playing') startNewRound(); }, 1700);
  }
}

function startNewRound() {
  $('feedbackBanner').hidden = true;
  paintVellum();
  const seq = game.startRound();
  updateStatsUI();
  scheduleListenPhase(seq);
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

let lastFrameTime = performance.now();

function frame(now) {
  const dtMs = Math.min(80, now - lastFrameTime);
  lastFrameTime = now;

  if (audioEngine.isRunning) {
    const timeData = audioEngine.getTimeDomainData();
    const buf = pickLouderChannel(timeData);

    // The activity detector's envelopes run continuously whenever the mic
    // is live, not just during recall — otherwise they'd go stale across
    // however long the (silent-to-the-detector) listen phase lasts, and
    // the first onset of a fresh recall phase would be checked against a
    // slow-envelope baseline from well before it, rather than the
    // just-quiet room it should be comparing against.
    const { onset } = activity.update(buf, dtMs);

    if (appState === 'tuning') {
      updateTuning(buf, now);
    } else if (game.phase === PHASE.RECALLING) {
      const pitchResult = gatedDetectPitch(buf, { minHz: 50, maxHz: 1500 });
      const result = game.processRecallFrame(onset, pitchResult, now);
      handleRecallResult(result);
    }
  }

  requestAnimationFrame(frame);
}
