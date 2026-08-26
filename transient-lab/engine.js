// engine.js
//
// Entry point, loaded by index.html. Sets up the canvas, starts real
// MIDI input, builds the active lesson's timeline, runs the transport
// clock + judgement engine + render loop, and wires up click/keyboard
// input.

import { render } from "./ui/canvas/Render.js";
import { initMidi } from "./core/midi/MidiState.js";
import { initAudioAnalysis, toggleSnapshot, toggleScopeMaximized, closeScopeMaximized, connectAudioInput, selectDevice, toggleDeviceList, closeDeviceList, audioAnalysisState } from "./core/audio/AudioAnalysis.js";
import { hitTestSnapshotButton, hitTestMaximizeButton, hitTestAudioStatus, hitTestDeviceList } from "./ui/canvas/AnalysisBar.js";
import { controlsState } from "./core/state/ControlsState.js";
import { hitTestTransport, hitTestCategorySelector, hitTestScaleTypeSelector, hitTestPackSelector, hitTestNowLearning, hitTestBPM } from "./ui/canvas/LeftPanel.js";
import { hitTestFullscreenButton, hitTestThemeButton } from "./ui/canvas/TopBar.js";
import { cycleTheme } from "./ui/theme/theme.js";
import {
  nextChord, prevChord, nextLesson, prevLesson, nextPack, getActiveLesson, getEffectiveBpm,
  selectLesson, selectPack, setContentCategory, selectScaleType, toggleScaleTypeDropdown, closeScaleTypeDropdown,
  togglePackDropdown, closePackDropdown, toggleLessonDropdown, closeLessonDropdown, contentState, getActivePack,
  allPacks, SCALE_TYPES, getAvailablePacks
} from "./core/state/ContentState.js";
import { buildTimeline } from "./core/engine/Timeline.js";
import { tick } from "./core/engine/Transport.js";
import { resetForTimeline, evaluate, getAllJudgements } from "./core/scoring/JudgementEngine.js";
import { recordRun, getLessonProgress, getSummary, resetProgress, exportProgress, getLastPlayed } from "./core/state/Progress.js";
import { editingBPM, setEditingBPM, appendBpmDigit, backspaceBpmDigit, commitBpmEdit, setBpm } from "./core/state/UIState.js";

// Electron build: fullscreen goes over IPC to electronAPI (see the
// desktop app's preload.cjs). Browser build: electronAPI doesn't
// exist at all, so this falls back to the standard Fullscreen API on
// the canvas's own container -- same "f" key and same button, just a
// different mechanism depending on which shell is actually running.
function toggleFullscreen() {
  if (window.electronAPI) {
    window.electronAPI.toggleFullscreen();
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {
      // Some browsers reject requestFullscreen outside a direct user
      // gesture or on restricted platforms (e.g. embedded iframes) --
      // failing silently here is preferable to throwing, since
      // fullscreen is a convenience, not something the app depends on.
    });
  }
}

const canvas = document.getElementById("sequencer");
const ctx = canvas.getContext("2d");

initMidi();
initAudioAnalysis();

// loadActiveLesson() rebuilds the timeline, resets judgement/transport,
// AND now sets BPM from the lesson's own data (see
// ContentState.js's getEffectiveBpm) -- every lesson used to inherit
// whatever BPM was last typed in, defaulting to 90 for everything,
// which made no sense once lessons started ranging from a 50 BPM
// drone hold to a 150 BPM scale sprint. Called once immediately below
// for the very first lesson too, so nothing has to duplicate this logic.
let activeTimeline;

/* Store a completed pass. Called on loop (a full run finished) and before
 * switching lessons, so a partial attempt still counts what it reached. */
function commitRun() {
  try {
    const pack = getActivePack();
    const lesson = getActiveLesson();
    if (!pack || !lesson) return;
    recordRun(pack.name || "Pack", lesson.name || "Lesson", getAllJudgements());
  } catch (err) {
    // Never let progress bookkeeping interrupt playback.
    console.warn("[transient-lab] could not record run:", err);
  }
}

function loadActiveLesson() {
  commitRun();
  activeTimeline = buildTimeline(getActiveLesson());
  resetForTimeline(activeTimeline);
  controlsState.currentBeat = 0;
  controlsState.isPlaying = false;
  setBpm(getEffectiveBpm());
}

loadActiveLesson();

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Checked FIRST, before anything else: while the scope is maximized
  // it visually covers the whole app, so any click should close it
  // rather than accidentally hitting whatever control is now hidden
  // underneath. The close button drawn in the overlay still exists as
  // a clear, discoverable affordance, but isn't the only way out.
  if (audioAnalysisState.scopeMaximized) {
    closeScopeMaximized();
    return;
  }

  const category = hitTestCategorySelector(x, y);
  if (category) {
    setContentCategory(category);
    loadActiveLesson();
    return;
  }

  if (hitTestFullscreenButton(x, y, canvas)) {
    toggleFullscreen();
    return;
  }

  if (hitTestThemeButton(x, y, canvas)) {
    cycleTheme();
    return;
  }

  if (hitTestMaximizeButton(x, y, canvas)) {
    toggleScopeMaximized();
    return;
  }

  if (hitTestSnapshotButton(x, y, canvas)) {
    toggleSnapshot();
    return;
  }

  const deviceRowHit = hitTestDeviceList(x, y, canvas);
  if (deviceRowHit !== null) {
    selectDevice(audioAnalysisState.availableDevices[deviceRowHit].deviceId);
    return;
  }

  if (hitTestAudioStatus(x, y, canvas)) {
    if (audioAnalysisState.connected) {
      toggleDeviceList();
    } else {
      connectAudioInput(null); // retry default device
    }
    return;
  }

  if (audioAnalysisState.deviceListOpen) {
    // Clicked elsewhere while the device list was open -- close it,
    // same pattern as the lesson dropdown.
    closeDeviceList();
    return;
  }

  if (hitTestBPM(x, y)) {
    setEditingBPM(true);
    return;
  } else if (editingBPM) {
    // Clicked anywhere else while editing -- commit what's typed
    // rather than leaving the field stuck in edit mode.
    commitBpmEdit();
  }

  const packHit = hitTestPackSelector(x, y);
  if (packHit === "toggle") {
    togglePackDropdown();
    return;
  }
  if (typeof packHit === "number") {
    selectPack(packHit);
    loadActiveLesson();
    return;
  }
  if (contentState.packDropdownOpen) {
    closePackDropdown();
    return;
  }

  const scaleTypeHit = hitTestScaleTypeSelector(x, y);
  if (scaleTypeHit === "toggle") {
    toggleScaleTypeDropdown();
    return;
  }
  if (typeof scaleTypeHit === "number") {
    selectScaleType(scaleTypeHit);
    loadActiveLesson();
    return;
  }
  if (contentState.scaleTypeDropdownOpen) {
    closeScaleTypeDropdown();
    return;
  }

  const nowLearningHit = hitTestNowLearning(x, y);
  if (nowLearningHit === "toggle") {
    toggleLessonDropdown();
    return;
  }
  if (typeof nowLearningHit === "number") {
    selectLesson(nowLearningHit);
    loadActiveLesson();
    return;
  }
  if (contentState.lessonDropdownOpen) {
    // Clicked elsewhere on the canvas while the list was open -- close
    // it rather than leaving it stuck open until another lesson pick.
    closeLessonDropdown();
    return;
  }

  const transportHit = hitTestTransport(x, y);
  if (transportHit === "start") controlsState.isPlaying = true;
  if (transportHit === "stop") {
    controlsState.isPlaying = false;
    controlsState.currentBeat = 0;
    resetForTimeline(activeTimeline);
  }
  if (transportHit === "pause") controlsState.isPlaying = false;
  if (transportHit === "reset") {
    controlsState.currentBeat = 0;
    resetForTimeline(activeTimeline);
  }
});

window.addEventListener("keydown", (e) => {
  // Same "closes on any interaction" behavior as clicking, for parity
  // with the standard Escape-to-close convention.
  if (audioAnalysisState.scopeMaximized) {
    if (e.key === "Escape") closeScopeMaximized();
    return;
  }

  // While editing BPM, keystrokes go to the BPM field and nowhere
  // else -- otherwise typing "9" "0" would also fire any other "0"/"9"
  // shortcut that might exist, which is exactly the kind of input
  // conflict a text-entry mode is supposed to prevent.
  if (editingBPM) {
    if (/^[0-9]$/.test(e.key)) { appendBpmDigit(e.key); return; }
    if (e.key === "Backspace") { backspaceBpmDigit(); return; }
    if (e.key === "Enter") { commitBpmEdit(); return; }
    if (e.key === "Escape") { setEditingBPM(false); return; }
    return; // swallow everything else while editing so e.g. 't' can't retheme mid-type
  }

  if (e.key === "t") cycleTheme();
  if (e.key === "f") toggleFullscreen();

  // Content-pack browsing (see ContentState.js) -- moving the preview
  // cursor with the arrow keys. Lesson/pack changes reload the
  // timeline (and now the lesson's own BPM); chord stepping alone
  // (left/right) is just a look-ahead preview and doesn't touch
  // playback.
  if (e.key === "ArrowRight") nextChord();
  if (e.key === "ArrowLeft") prevChord();
  if (e.key === "ArrowDown") { nextLesson(); loadActiveLesson(); }
  if (e.key === "ArrowUp") { prevLesson(); loadActiveLesson(); }
  if (e.key === "p") { nextPack(); loadActiveLesson(); }

  if (e.key === " ") {
    e.preventDefault();
    controlsState.isPlaying = !controlsState.isPlaying;
  }
});

let lastTimestamp = null;

function loop(timestamp) {
  if (lastTimestamp === null) lastTimestamp = timestamp;
  const dtSeconds = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  const looped = tick(dtSeconds, activeTimeline.totalBeats);
  if (looped) {
    // A loop means a full pass just completed — score it before the
    // judgements are cleared for the next repeat.
    commitRun();
    resetForTimeline(activeTimeline); // fresh judgements each time the lesson repeats
  }

  evaluate(activeTimeline, controlsState.currentBeat);
  render(ctx, canvas, activeTimeline);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

/* =========================================================================
   PROGRESS PANEL, LESSON SEARCH, SHORTCUT HELP

   Six keyboard shortcuts existed (t, f, space, arrows, p) with no legend, no
   help overlay and no '?' key — completely undiscoverable. Loom and Modulus
   Studio both have a walkthrough; the app with the most shortcuts had none.
   ========================================================================= */

function refreshProgressReadout() {
  const el = document.getElementById("hsProgress");
  if (!el) return;
  const s = getSummary();
  el.textContent = s.attempted === 0
    ? "no runs yet"
    : `${s.passed}/${s.attempted} passed \u00b7 ${s.runs} run${s.runs === 1 ? "" : "s"}`;
}

function renderProgressPanel() {
  const body = document.getElementById("progressBody");
  if (!body) return;

  const summary = getSummary();
  const rows = [];

  allPacks.forEach(pack => {
    pack.lessons.forEach(lesson => {
      const entry = getLessonProgress(pack.name, lesson.name);
      if (entry) rows.push({ pack: pack.name, lesson: lesson.name, entry });
    });
  });

  // Most recently played first — that's what you came to look at.
  rows.sort((a, b) => (b.entry.lastPlayed || 0) - (a.entry.lastPlayed || 0));

  if (rows.length === 0) {
    body.innerHTML = '<p class="pp-empty">No runs recorded yet. Play a lesson through once and its accuracy will show up here.</p>';
    return;
  }

  let html = `<p class="pp-summary">${summary.passed} of ${summary.attempted} lessons passed, across ${summary.runs} run${summary.runs === 1 ? "" : "s"}. A lesson counts as passed at 80% accuracy or better.</p>`;
  rows.slice(0, 40).forEach(r => {
    const pct = Math.round(r.entry.bestAccuracy * 100);
    html += `<div class="pp-row">
      <span class="pp-name">${r.lesson}<small>${r.pack} \u00b7 ${r.entry.runs} run${r.entry.runs === 1 ? "" : "s"}</small></span>
      <span class="pp-bar"><span class="pp-bar-fill" style="width:${pct}%"></span></span>
      <span class="pp-pct">${pct}%</span>
    </div>`;
  });
  body.innerHTML = html;
}

function openProgressPanel() {
  renderProgressPanel();
  const panel = document.getElementById("progressPanel");
  if (panel) panel.hidden = false;
}

function closeProgressPanel() {
  const panel = document.getElementById("progressPanel");
  if (panel) panel.hidden = true;
}

/* Jump straight to a lesson. Searches every pack, not just the active
   category, and switches category/pack/lesson to land on it. */
function wireLessonSearch() {
  const input = document.getElementById("lessonSearch");
  const results = document.getElementById("lessonSearchResults");
  if (!input || !results) return;

  const close = () => { results.classList.remove("open"); results.innerHTML = ""; };

  const run = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { close(); return; }

    const hits = [];
    allPacks.forEach((pack, packIdx) => {
      pack.lessons.forEach((lesson, lessonIdx) => {
        if (hits.length >= 12) return;
        const hay = `${lesson.name} ${pack.name}`.toLowerCase();
        if (hay.includes(q)) hits.push({ pack, packIdx, lesson, lessonIdx });
      });
    });

    results.innerHTML = "";
    if (hits.length === 0) {
      results.innerHTML = '<div class="ls-empty">No lesson matches that.</div>';
    } else {
      hits.forEach(h => {
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `${h.lesson.name}<span class="ls-pack">${h.pack.name}</span>`;
        b.addEventListener("click", () => {
          // Switch category first — the pack list is filtered by it, so
          // selecting a pack index before this would target the wrong list.
          setContentCategory(h.pack.category);
          if (h.pack.category === "scales" && h.pack.scaleType) {
            const idx = SCALE_TYPES.findIndex(t => t.key === h.pack.scaleType);
            if (idx >= 0) selectScaleType(idx);
          }
          const packs = getAvailablePacks();
          const realPackIdx = packs.findIndex(p => p.name === h.pack.name);
          if (realPackIdx >= 0) selectPack(realPackIdx);
          selectLesson(h.lessonIdx);
          loadActiveLesson();
          close();
          input.value = "";
          input.blur();
        });
        results.appendChild(b);
      });
    }
    results.classList.add("open");
  };

  input.addEventListener("input", run);
  input.addEventListener("focus", run);
  input.addEventListener("keydown", e => {
    e.stopPropagation();   // don't let lesson shortcuts fire while typing
    if (e.key === "Escape") { close(); input.blur(); }
    if (e.key === "Enter") {
      const first = results.querySelector("button");
      if (first) first.click();
    }
  });
  document.addEventListener("click", e => {
    if (!results.contains(e.target) && e.target !== input) close();
  });
}

function wireTransientLabExtras() {
  wireLessonSearch();
  refreshProgressReadout();

  const progressBtn = document.getElementById("progressBtn");
  if (progressBtn) progressBtn.addEventListener("click", openProgressPanel);

  const closeBtn = document.getElementById("progressClose");
  if (closeBtn) closeBtn.addEventListener("click", closeProgressPanel);

  const panel = document.getElementById("progressPanel");
  if (panel) panel.addEventListener("click", e => { if (e.target === panel) closeProgressPanel(); });

  const exportBtn = document.getElementById("exportProgressBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(exportProgress(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transient-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  const resetBtn = document.getElementById("resetProgressBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("Reset all progress?\n\nEvery lesson's accuracy history will be cleared. This cannot be undone \u2014 export first if you want a copy.")) return;
      resetProgress();
      renderProgressPanel();
      refreshProgressReadout();
    });
  }

  const shortcutsBtn = document.getElementById("shortcutsBtn");
  if (shortcutsBtn && window.TSShortcuts) {
    shortcutsBtn.addEventListener("click", () => window.TSShortcuts.open());
  }

  // Documented here so the shortcuts that already existed are finally
  // discoverable. `run` is omitted: the engine's own keydown handler still
  // performs them, this just registers them for the help overlay.
  if (window.TSShortcuts) {
    window.TSShortcuts.register([
      { keys: "space", group: "Transport", label: "Play / pause" },
      { keys: "left", group: "Browsing", label: "Previous chord (preview only)" },
      { keys: "right", group: "Browsing", label: "Next chord (preview only)" },
      { keys: "up", group: "Browsing", label: "Previous lesson" },
      { keys: "down", group: "Browsing", label: "Next lesson" },
      { keys: "p", group: "Browsing", label: "Next content pack" },
      { keys: "t", group: "Display", label: "Cycle the colour theme" },
      { keys: "f", group: "Display", label: "Toggle fullscreen" },
      { keys: "escape", group: "Display", label: "Close the maximised scope" },
      { keys: "?", group: "General", label: "Show this help" },
    ]);
  }

  // Keep the readout current as runs are recorded.
  setInterval(refreshProgressReadout, 3000);

  // Reopen on the lesson you were last playing.
  const last = getLastPlayed();
  if (last) console.log("[transient-lab] last played:", last.pack, "\u2014", last.lesson);
}

wireTransientLabExtras();
