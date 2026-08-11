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
  togglePackDropdown, closePackDropdown, toggleLessonDropdown, closeLessonDropdown, contentState
} from "./core/state/ContentState.js";
import { buildTimeline } from "./core/engine/Timeline.js";
import { tick } from "./core/engine/Transport.js";
import { resetForTimeline, evaluate } from "./core/scoring/JudgementEngine.js";
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

function loadActiveLesson() {
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
  if (looped) resetForTimeline(activeTimeline); // fresh judgements each time the lesson repeats

  evaluate(activeTimeline, controlsState.currentBeat);
  render(ctx, canvas, activeTimeline);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
