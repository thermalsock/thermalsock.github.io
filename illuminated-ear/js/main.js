import { AudioEngine, pickLouderChannel } from "./audioEngine.js";

import { detectPitch, levelDb, PitchLock } from "./pitchDetect.js";

import { ActivityDetector, rms } from "./activity.js";

import { GameSession, getAvailableGameLessons, getStageName } from "./game.js";

import { initMidi, onMidiNoteOn, onMidiDevicesChanged, hasMidiDevice } from "./midi.js";

import { STAGES } from "./curriculum.js";

import { renderLesson, setAudioCtx, setTonic as setLessonTonic, stopAll as stopLessonAudio, setTempoScale as setLessonTempo } from "./lessonEngine.js";

import { isLessonCompleted, getCompletedLessonIds, getTryScore, resetProgress } from "./progress.js";

const $ = id => document.getElementById(id);

const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

const audioEngine = new AudioEngine;

const activity = new ActivityDetector;

const tuningLock = new PitchLock({
  requiredStableFrames: 12,
  toleranceCents: 12
});

let appState = "tuning";

let currentMode = "train";

let tonicLockedAtMs = null;

const TUNE_CONFIRM_MS = 900;

let tonicFreq = null;

let tonicMidi = null;

let midiConnected = false;

let gameSession = null;

let allTimeBest = parseInt(localStorage.getItem("illuminatedEar.bestStreak") || "0", 10);

const PITCH_DETECT_MIN_RMS = .012;

function freqToNoteName(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[(rounded % 12 + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

function midiToNoteName(midi) {
  const name = NOTE_NAMES[(midi % 12 + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function freqToMidi(freq) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function gatedDetectPitch(buf, opts) {
  return rms(buf) >= PITCH_DETECT_MIN_RMS ? detectPitch(buf, audioEngine.sampleRate, opts) : null;
}

function semitoneToFreq(semitones) {
  return tonicFreq * Math.pow(2, semitones / 12);
}

function playGameTone(semitones, durSec = .5, vol = .18) {
  if (!audioEngine.audioCtx) return;
  const freq = semitoneToFreq(semitones);
  const osc = audioEngine.audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const gain = audioEngine.audioCtx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(audioEngine.audioCtx.destination);
  const now = audioEngine.audioCtx.currentTime + .02;
  osc.start(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + .03);
  gain.gain.setValueAtTime(vol, now + durSec - .08);
  gain.gain.linearRampToValueAtTime(0, now + durSec);
  osc.stop(now + durSec + .02);
}

function playGamePair(a, b) {
  playGameTone(a, .45);
  setTimeout(() => playGameTone(b, .45), 500);
}

initMidi().then(({supported: supported, deviceNames: deviceNames}) => {
  const gateStatus = $("midiGateStatus");
  if (!supported) {
    gateStatus.textContent = "No MIDI support — mic/voice input will be used.";
  } else if (deviceNames.length === 0) {
    gateStatus.textContent = "No MIDI keyboard connected — plug one in any time.";
  } else {
    gateStatus.textContent = `MIDI keyboard: ${deviceNames.join(", ")}`;
  }
});

onMidiDevicesChanged(deviceNames => {
  midiConnected = deviceNames.length > 0;
  const pill = $("midiStatusPill");
  if (pill) pill.textContent = midiConnected ? `MIDI: ${deviceNames[0]}` : "MIDI: —";
  const tuneCopy = $("tuneCopy");
  if (tuneCopy && midiConnected) {
    tuneCopy.textContent = "Press a single key on your MIDI keyboard — everything that follows is relative to it.";
  }
});

let onMidiAnswer = null;

let currentQuestionControls = null;

onMidiNoteOn((midiNoteNumber, velocity) => {
  if (appState === "tuning") {
    confirmTonicFromMidi(midiNoteNumber);
    return;
  }
  if (onMidiAnswer) {
    onMidiAnswer(midiNoteNumber);
  }
});

async function populateDevices() {
  try {
    const devices = await AudioEngine.listInputDevices();
    const select = $("deviceSelect");
    devices.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Input ${i + 1}`;
      select.appendChild(opt);
    });
  } catch {}
}

populateDevices();

$("startBtn").addEventListener("click", async () => {
  $("startBtn").disabled = true;
  $("startBtn").textContent = "Starting…";
  try {
    await audioEngine.start($("deviceSelect").value || null);
    $("gate").hidden = true;
    $("app").hidden = false;
    boot();
  } catch (err) {
    $("gateError").hidden = false;
    $("gateError").textContent = err.name === "NotAllowedError" ? "Microphone access was denied." : `Could not start: ${err.message || err}`;
    $("startBtn").disabled = false;
    $("startBtn").textContent = "Start";
  }
});

function updateTuning(buf, nowMs) {
  const pitchResult = gatedDetectPitch(buf, {
    minHz: 50,
    maxHz: 1500
  });
  const locked = tuningLock.update(pitchResult ? pitchResult.freq : null);
  if (pitchResult) {
    $("tuneNote").textContent = freqToNoteName(pitchResult.freq);
  }
  if (locked != null) {
    if (tonicLockedAtMs == null) {
      tonicLockedAtMs = nowMs;
      $("tuneHint").textContent = "Locked — hold it…";
    }
    const progress = Math.min(1, (nowMs - tonicLockedAtMs) / TUNE_CONFIRM_MS);
    $("tuneProgressFill").style.width = `${progress * 100}%`;
    if (progress >= 1) confirmTonic(locked);
  } else {
    tonicLockedAtMs = null;
    $("tuneProgressFill").style.width = "0%";
    if (!pitchResult) $("tuneHint").textContent = "Waiting for a steady note…";
  }
}

function confirmTonic(freq) {
  tonicFreq = freq;
  tonicMidi = freqToMidi(freq);
  setLessonTonic(freq);
  if (audioEngine.audioCtx) setAudioCtx(audioEngine.audioCtx);
  $("tonicReadout").textContent = freqToNoteName(freq);
  appState = "playing";
  $("tuneCard").hidden = true;
  $("modeTabBar").hidden = false;
  $("statusText").textContent = "Ready";
  switchMode(currentMode);
}

let midiTuneTimer = null;

function confirmTonicFromMidi(midiNoteNumber) {
  const freq = midiToFreq(midiNoteNumber);
  $("tuneNote").textContent = midiToNoteName(midiNoteNumber);
  $("tuneHint").textContent = "Locked — from your MIDI keyboard.";
  $("tuneProgressFill").style.width = "100%";
  if (midiTuneTimer) clearTimeout(midiTuneTimer);
  midiTuneTimer = setTimeout(() => {
    if (appState === "tuning") confirmTonic(freq);
  }, 500);
}

function goToRetune() {
  appState = "tuning";
  tonicLockedAtMs = null;
  tonicFreq = null;
  tonicMidi = null;
  tuningLock.reset();
  stopLessonAudio();
  onMidiAnswer = null;
  $("gameView").hidden = true;
  $("trainView").hidden = true;
  $("modeTabBar").hidden = true;
  $("tuneCard").hidden = false;
  $("tuneNote").textContent = "—";
  $("tuneHint").textContent = "Waiting for a steady note…";
  $("tuneProgressFill").style.width = "0%";
  $("statusText").textContent = "Tuning";
}

function boot() {
  $("statAllTimeBest").textContent = allTimeBest;
  $("retuneBtn").addEventListener("click", goToRetune);
  $("trainTab").addEventListener("click", () => switchMode("train"));
  $("gameTab").addEventListener("click", () => switchMode("game"));
  $("backToStagesBtn").addEventListener("click", showStageNav);
  renderStageNav();
  renderProgressSummary();
  requestAnimationFrame(frame);
}

function switchMode(mode) {
  currentMode = mode;
  stopLessonAudio();
  onMidiAnswer = null;
  $("trainTab").classList.toggle("active", mode === "train");
  $("gameTab").classList.toggle("active", mode === "game");
  $("trainView").hidden = mode !== "train";
  $("trainSidebar").hidden = mode !== "train";
  $("gameView").hidden = mode !== "game";
  $("gameSidebar").hidden = mode !== "game";
  $("gameSidebar2").hidden = mode !== "game";
  $("gameSidebar3").hidden = mode !== "game";
  if (mode === "game") {
    showGameLessonNav();
  } else {
    showStageNav();
    renderProgressSummary();
  }
}

function renderStageNav() {
  const container = $("stageList");
  container.innerHTML = "";
  STAGES.forEach(stage => {
    const group = document.createElement("div");
    group.className = "stage-group";
    group.innerHTML = `<h3>${stage.name}</h3><p class="stage-desc">${stage.desc}</p>`;
    const list = document.createElement("div");
    list.className = "lesson-list";
    stage.lessons.forEach(lesson => {
      const card = document.createElement("div");
      card.className = "lesson-card";
      const completed = isLessonCompleted(lesson.id);
      card.innerHTML = `<div><div class="lc-name">${lesson.name}</div><div class="lc-sub">${lesson.subtitle}</div></div><span class="lc-check">${completed ? "✓" : ""}</span>`;
      card.addEventListener("click", () => openLesson(lesson));
      list.appendChild(card);
    });
    group.appendChild(list);
    container.appendChild(group);
  });
}

function showStageNav() {
  stopLessonAudio();
  onMidiAnswer = null;
  $("stageNav").hidden = false;
  $("lessonContainer").hidden = true;
  renderStageNav();
  renderProgressSummary();
}

function openLesson(lesson) {
  $("stageNav").hidden = true;
  $("lessonContainer").hidden = false;
  if (audioEngine.audioCtx) setAudioCtx(audioEngine.audioCtx);
  renderLesson($("lessonContent"), lesson, passed => {
    renderProgressSummary();
    showStageNav();
  });
}

function renderProgressSummary() {
  const container = $("progressSummary");
  container.innerHTML = "";
  const completed = getCompletedLessonIds();
  STAGES.forEach(stage => {
    const total = stage.lessons.length;
    const done = stage.lessons.filter(l => completed.includes(l.id)).length;
    const pct = total > 0 ? done / total * 100 : 0;
    const div = document.createElement("div");
    div.className = "progress-stage";
    div.innerHTML = `<span class="ps-name">${stage.name}</span><div class="ps-bar"><div class="ps-bar-fill" style="width:${pct}%"></div></div><span class="ps-count">${done}/${total} completed</span>`;
    container.appendChild(div);
  });
  const totalEl = $("progressTotal");
  if (totalEl) {
    const allLessons = STAGES.reduce((n, st) => n + st.lessons.length, 0);
    const allDone = STAGES.reduce((n, st) => n + st.lessons.filter(l => completed.includes(l.id)).length, 0);
    totalEl.textContent = `${allDone} / ${allLessons}`;
  }
}

function offsetToNoteName(semitones) {
  if (tonicMidi == null) return `+${semitones}st`;
  return midiToNoteName(tonicMidi + semitones);
}

function showGameLessonNav() {
  onMidiAnswer = null;
  $("gameLessonNav").hidden = false;
  $("gamePlayArea").hidden = true;
  const list = $("gameLessonList");
  list.innerHTML = "";
  const available = getAvailableGameLessons();
  if (available.length === 0) {
    list.innerHTML = '<p class="mode-desc">Complete at least one lesson in Training to unlock game content.</p>';
    return;
  }
  const mixedCard = document.createElement("div");
  mixedCard.className = "lesson-card";
  mixedCard.innerHTML = '<div><div class="lc-name">Mixed — all completed lessons</div><div class="lc-sub">Random questions from everything you\'ve trained</div></div>';
  mixedCard.addEventListener("click", () => startGameRound(null));
  list.appendChild(mixedCard);
  STAGES.forEach(stage => {
    const stageLessons = available.filter(l => stage.lessons.some(sl => sl.id === l.id));
    if (stageLessons.length === 0) return;
    const group = document.createElement("div");
    group.className = "stage-group";
    group.innerHTML = `<h3>${stage.name}</h3>`;
    const lessonList = document.createElement("div");
    lessonList.className = "lesson-list";
    stageLessons.forEach(lesson => {
      const card = document.createElement("div");
      card.className = "lesson-card";
      card.innerHTML = `<div><div class="lc-name">${lesson.name}</div><div class="lc-sub">${lesson.subtitle}</div></div>`;
      card.addEventListener("click", () => startGameRound(lesson.id));
      lessonList.appendChild(card);
    });
    group.appendChild(lessonList);
    list.appendChild(group);
  });
}

function startGameRound(lessonId) {
  gameSession = new GameSession;
  if (!gameSession.start(lessonId)) return;
  $("gameLessonNav").hidden = true;
  $("gamePlayArea").hidden = false;
  $("gameRoundSummary").hidden = true;
  $("gameRoundTitle").textContent = gameSession.lessonName;
  $("statusText").textContent = "Game";
  renderGameQuestion();
}

function renderGameQuestion() {
  const q = gameSession.currentQuestion;
  if (!q) return;
  $("gameRoundStatus").textContent = `${gameSession.currentIndex + 1}/${gameSession.totalQuestions}  ·  Streak: ${gameSession.streak}`;
  $("gameFeedback").textContent = "";
  $("gameFeedback").className = "try-feedback";
  const area = $("gameQuestionArea");
  area.innerHTML = "";
  const tonicName = offsetToNoteName(0);
  let questionDisplay = "";
  let instruction = "";
  if (q.type === "higher_lower") {
    questionDisplay = "♩  ♩";
    instruction = "You'll hear two tones. Is the second one higher, lower, or the same as the first?";
  } else if (q.type === "identify_interval") {
    questionDisplay = `${tonicName} → ?`;
    instruction = `You'll hear your tonic (${tonicName}) then a second note. Play back the second note on your keyboard, or click the interval name below.`;
  } else if (q.type === "identify_degree") {
    questionDisplay = `${tonicName} → ?`;
    instruction = `You'll hear your tonic (${tonicName}) then a scale degree. Play back the second note on your keyboard, or click the degree below.`;
  }
  const display = document.createElement("div");
  display.className = "game-note-display";
  display.textContent = questionDisplay;
  area.appendChild(display);
  const playBtn = document.createElement("button");
  playBtn.className = "lesson-play-btn";
  playBtn.textContent = "▶ Listen";
  playBtn.addEventListener("click", () => {
    if (q.type === "higher_lower") {
      playGamePair(q.a, q.b);
    } else if (q.type === "identify_interval") {
      playGameTone(0, .4, .15);
      setTimeout(() => playGameTone(q.b, .5, .2), 500);
    } else if (q.type === "identify_degree") {
      playGameTone(0, .4, .15);
      setTimeout(() => playGameTone(q.offset, .5, .2), 500);
    }
  });
  area.appendChild(playBtn);
  const prompt = document.createElement("p");
  prompt.className = "try-prompt";
  prompt.textContent = instruction;
  area.appendChild(prompt);
  let answered = false;
  onMidiAnswer = midiNoteNumber => {
    if (answered) return;
    if (q.type === "higher_lower") return;
    const playedOffset = ((midiNoteNumber - tonicMidi) % 12 + 12) % 12;
    const playedNoteName = midiToNoteName(midiNoteNumber);
    let matchedChoice = null;
    if (q.type === "identify_interval" && q.choiceSemitones) {
      const idx = q.choiceSemitones.indexOf(playedOffset);
      if (idx >= 0) matchedChoice = q.choices[idx];
    } else if (q.type === "identify_degree" && q.choiceOffsets) {
      const idx = q.choiceOffsets.indexOf(playedOffset);
      if (idx >= 0) matchedChoice = q.choices[idx];
    }
    if (matchedChoice) {
      answered = true;
      submitGameAnswer(matchedChoice, area.querySelector(".try-choices"), playedNoteName);
    } else {
      display.textContent = `${offsetToNoteName(0)} → ${playedNoteName}`;
      display.className = "game-note-display pressed-miss";
      setTimeout(() => {
        display.textContent = questionDisplay;
        display.className = "game-note-display";
      }, 600);
    }
  };
  currentQuestionControls = {
    replay: () => playBtn.click(),
    choices: []
  };
  const choicesWrap = document.createElement("div");
  choicesWrap.className = "try-choices";
  q.choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "try-choice-btn";
    btn.textContent = choice;
    if (currentQuestionControls) currentQuestionControls.choices.push(btn);
    btn.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      onMidiAnswer = null;
      submitGameAnswer(choice, choicesWrap, null);
    });
    choicesWrap.appendChild(btn);
  });
  area.appendChild(choicesWrap);
  playBtn.click();
}

function submitGameAnswer(choice, choicesWrap, pressedNoteName) {
  const result = gameSession.answer(choice);
  if (!result) return;
  const q = gameSession.currentQuestion;
  const area = $("gameQuestionArea");
  if (choicesWrap) {
    choicesWrap.querySelectorAll(".try-choice-btn").forEach(b => {
      if (b.textContent === choice) b.classList.add(result.correct ? "correct" : "wrong");
      if (!result.correct && b.textContent === result.correctAnswer) b.classList.add("correct");
    });
  }
  const display = area.querySelector(".game-note-display");
  if (display && pressedNoteName) {
    display.textContent = `${offsetToNoteName(0)} → ${pressedNoteName}`;
    display.className = "game-note-display " + (result.correct ? "pressed-correct" : "pressed-wrong");
  }
  const fb = $("gameFeedback");
  fb.className = "try-feedback " + (result.correct ? "fb-correct" : "fb-wrong");
  if (result.correct) {
    fb.textContent = `Correct! +${result.xpGained} XP`;
  } else {
    let correctNoteName = "";
    if (q && q.type === "identify_interval" && q.choiceSemitones) {
      const correctIdx = q.choices.indexOf(result.correctAnswer);
      if (correctIdx >= 0) correctNoteName = offsetToNoteName(q.choiceSemitones[correctIdx]);
    } else if (q && q.type === "identify_degree" && q.choiceOffsets) {
      const correctIdx = q.choices.indexOf(result.correctAnswer);
      if (correctIdx >= 0) correctNoteName = offsetToNoteName(q.choiceOffsets[correctIdx]);
    }
    let msg = pressedNoteName ? `You played ${pressedNoteName}. The answer was ${result.correctAnswer}` : `The answer was ${result.correctAnswer}`;
    if (correctNoteName) msg += ` (${correctNoteName})`;
    msg += ".";
    if (result.explanation) msg += " " + result.explanation;
    fb.textContent = msg;
  }
  $("gameRoundStatus").textContent = `${gameSession.currentIndex + 1}/${gameSession.totalQuestions}  ·  Streak: ${gameSession.streak}`;
  if (result.correct) {
    setTimeout(() => {
      onMidiAnswer = null;
      if (result.roundOver) showGameSummary(result.summary); else {
        gameSession.next();
        renderGameQuestion();
      }
    }, 900);
  } else {
    onMidiAnswer = null;
    const wrongControls = document.createElement("div");
    wrongControls.className = "try-btn-row";
    wrongControls.style.marginTop = "12px";
    if (q && (q.type === "identify_interval" || q.type === "identify_degree")) {
      const hearBtn = document.createElement("button");
      hearBtn.className = "lesson-play-btn";
      hearBtn.textContent = "▶ Hear correct answer";
      hearBtn.addEventListener("click", () => {
        const correctOffset = q.type === "identify_interval" ? q.choiceSemitones[q.choices.indexOf(result.correctAnswer)] : q.choiceOffsets[q.choices.indexOf(result.correctAnswer)];
        playGameTone(0, .35, .13);
        setTimeout(() => playGameTone(correctOffset, .5, .2), 450);
      });
      wrongControls.appendChild(hearBtn);
    }
    const nextBtn = document.createElement("button");
    nextBtn.className = "lesson-play-btn";
    nextBtn.textContent = result.roundOver ? "See results" : "Next question";
    nextBtn.addEventListener("click", () => {
      if (result.roundOver) showGameSummary(result.summary); else {
        gameSession.next();
        renderGameQuestion();
      }
    });
    wrongControls.appendChild(nextBtn);
    fb.after(wrongControls);
  }
}

function showGameSummary(summary) {
  onMidiAnswer = null;
  $("gameQuestionArea").innerHTML = "";
  $("gameFeedback").textContent = "";
  $("gameFeedback").className = "try-feedback";
  $("gameRoundStatus").textContent = "Round complete";
  const wrap = $("gameRoundSummary");
  wrap.hidden = false;
  wrap.innerHTML = `\n    <div class="gs-score">${summary.correct}/${summary.total}</div>\n    <div class="gs-detail">${summary.pct}% correct — best streak: ${summary.bestStreak}</div>\n    <div class="gs-xp">+${summary.xpEarned} XP earned</div>\n  `;
  const btnRow = document.createElement("div");
  btnRow.className = "try-btn-row";
  btnRow.style.justifyContent = "center";
  btnRow.style.marginTop = "14px";
  const againBtn = document.createElement("button");
  againBtn.className = "lesson-play-btn";
  againBtn.textContent = "Play again";
  againBtn.addEventListener("click", () => startGameRound(gameSession.lessonId));
  const backBtn = document.createElement("button");
  backBtn.className = "lesson-play-btn";
  backBtn.textContent = "Choose another";
  backBtn.addEventListener("click", showGameLessonNav);
  btnRow.appendChild(againBtn);
  btnRow.appendChild(backBtn);
  wrap.appendChild(btnRow);
  $("statusText").textContent = "Ready";
}

let lastFrameTime = performance.now();

function frame(now) {
  const dtMs = Math.min(80, now - lastFrameTime);
  lastFrameTime = now;
  if (audioEngine.isRunning) {
    const timeData = audioEngine.getTimeDomainData();
    const buf = pickLouderChannel(timeData);
    activity.update(buf, dtMs);
    if (appState === "tuning") updateTuning(buf, now);
  }
  requestAnimationFrame(frame);
}

const earStore = window.TSStore ? window.TSStore.create("illuminated-ear") : null;

function wireProgressControls() {
  const resetBtn = $("resetProgressBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("Reset all progress?\n\nEvery completed lesson and best score will be cleared. This cannot be undone — export first if you want a copy.")) return;
      resetProgress();
      renderProgressSummary();
      showStageNav();
    });
  }
  const exportBtn = $("exportProgressBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const completed = getCompletedLessonIds();
      const payload = {
        kind: "illuminated-ear-progress",
        version: 1,
        exported: (new Date).toISOString(),
        completed: completed,
        scores: completed.reduce((acc, id) => {
          const sc = getTryScore(id);
          if (sc) acc[id] = sc;
          return acc;
        }, {}),
        stages: STAGES.map(st => ({
          id: st.id,
          name: st.name,
          done: st.lessons.filter(l => completed.includes(l.id)).length,
          total: st.lessons.length
        }))
      };
      const blob = new Blob([ JSON.stringify(payload, null, 2) ], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `illuminated-ear-progress-${(new Date).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    });
  }
}

function wireTempoControl() {
  const slider = $("tempoSlider");
  const readout = $("tempoReadout");
  if (!slider) return;
  const saved = earStore ? earStore.get("tempo", 100) : 100;
  slider.value = saved;
  readout.textContent = `${saved}%`;
  setLessonTempo(saved / 100);
  slider.addEventListener("input", () => {
    const pct = parseInt(slider.value, 10);
    readout.textContent = `${pct}%`;
    setLessonTempo(pct / 100);
    if (earStore) earStore.set("tempo", pct);
  });
}

function wireEarShortcuts() {
  if (!window.TSShortcuts) return;
  const pickChoice = n => {
    if (!currentQuestionControls) return;
    const btn = currentQuestionControls.choices[n];
    if (btn) btn.click();
  };
  window.TSShortcuts.register([ {
    keys: "space",
    group: "Question",
    label: "Replay the current question",
    run: () => currentQuestionControls && currentQuestionControls.replay()
  }, {
    keys: "1",
    group: "Question",
    label: "Choose the first answer",
    run: () => pickChoice(0)
  }, {
    keys: "2",
    group: "Question",
    label: "Choose the second answer",
    run: () => pickChoice(1)
  }, {
    keys: "3",
    group: "Question",
    label: "Choose the third answer",
    run: () => pickChoice(2)
  }, {
    keys: "4",
    group: "Question",
    label: "Choose the fourth answer",
    run: () => pickChoice(3)
  }, {
    keys: "escape",
    group: "Navigation",
    label: "Back to the lesson list",
    run: () => {
      const b = $("backToStagesBtn");
      if (b && !b.hidden) b.click();
    }
  }, {
    keys: "?",
    group: "General",
    label: "Show this help"
  } ]);
}

wireProgressControls();

wireTempoControl();

wireEarShortcuts();