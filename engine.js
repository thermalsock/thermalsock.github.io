import { render } from "./ui/canvas/Render.js";
import { initMidi } from "./core/midi/MidiState.js";
import { initAudioAnalysis, toggleSnapshot, toggleScopeMaximized, closeScopeMaximized, connectAudioInput, selectDevice, toggleDeviceList, closeDeviceList, audioAnalysisState } from "./core/audio/AudioAnalysis.js";
import { hitTestSnapshotButton, hitTestMaximizeButton, hitTestAudioStatus, hitTestDeviceList } from "./ui/canvas/AnalysisBar.js";
import { controlsState } from "./core/state/ControlsState.js";
import { hitTestTransport, hitTestCategorySelector, hitTestScaleTypeSelector, hitTestPackSelector, hitTestNowLearning, hitTestBPM } from "./ui/canvas/LeftPanel.js";
import { hitTestFullscreenButton, hitTestThemeButton } from "./ui/canvas/TopBar.js";
import { cycleTheme } from "./ui/theme/theme.js";
import { nextChord, prevChord, nextLesson, prevLesson, nextPack, getActiveLesson, getEffectiveBpm, selectLesson, selectPack, setContentCategory, selectScaleType, toggleScaleTypeDropdown, closeScaleTypeDropdown, togglePackDropdown, closePackDropdown, toggleLessonDropdown, closeLessonDropdown, contentState } from "./core/state/ContentState.js";
import { buildTimeline } from "./core/engine/Timeline.js";
import { tick } from "./core/engine/Transport.js";
import { resetForTimeline, evaluate } from "./core/scoring/JudgementEngine.js";
import { editingBPM, setEditingBPM, appendBpmDigit, backspaceBpmDigit, commitBpmEdit, setBpm } from "./core/state/UIState.js";
function toggleFullscreen() {
    if (window.electronAPI) {
        window.electronAPI.toggleFullscreen();
        return;
    }
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    else {
        document.documentElement.requestFullscreen().catch(() => {
        });
    }
}
const canvas = document.getElementById("sequencer");
const ctx = canvas.getContext("2d");
initMidi();
initAudioAnalysis();
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
        }
        else {
            connectAudioInput(null);
        }
        return;
    }
    if (audioAnalysisState.deviceListOpen) {
        closeDeviceList();
        return;
    }
    if (hitTestBPM(x, y)) {
        setEditingBPM(true);
        return;
    }
    else if (editingBPM) {
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
        closeLessonDropdown();
        return;
    }
    const transportHit = hitTestTransport(x, y);
    if (transportHit === "start")
        controlsState.isPlaying = true;
    if (transportHit === "stop") {
        controlsState.isPlaying = false;
        controlsState.currentBeat = 0;
        resetForTimeline(activeTimeline);
    }
    if (transportHit === "pause")
        controlsState.isPlaying = false;
    if (transportHit === "reset") {
        controlsState.currentBeat = 0;
        resetForTimeline(activeTimeline);
    }
});
window.addEventListener("keydown", (e) => {
    if (audioAnalysisState.scopeMaximized) {
        if (e.key === "Escape")
            closeScopeMaximized();
        return;
    }
    if (editingBPM) {
        if (/^[0-9]$/.test(e.key)) {
            appendBpmDigit(e.key);
            return;
        }
        if (e.key === "Backspace") {
            backspaceBpmDigit();
            return;
        }
        if (e.key === "Enter") {
            commitBpmEdit();
            return;
        }
        if (e.key === "Escape") {
            setEditingBPM(false);
            return;
        }
        return;
    }
    if (e.key === "t")
        cycleTheme();
    if (e.key === "f")
        toggleFullscreen();
    if (e.key === "ArrowRight")
        nextChord();
    if (e.key === "ArrowLeft")
        prevChord();
    if (e.key === "ArrowDown") {
        nextLesson();
        loadActiveLesson();
    }
    if (e.key === "ArrowUp") {
        prevLesson();
        loadActiveLesson();
    }
    if (e.key === "p") {
        nextPack();
        loadActiveLesson();
    }
    if (e.key === " ") {
        e.preventDefault();
        controlsState.isPlaying = !controlsState.isPlaying;
    }
});
let lastTimestamp = null;
function loop(timestamp) {
    if (lastTimestamp === null)
        lastTimestamp = timestamp;
    const dtSeconds = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    const looped = tick(dtSeconds, activeTimeline.totalBeats);
    if (looped)
        resetForTimeline(activeTimeline);
    evaluate(activeTimeline, controlsState.currentBeat);
    render(ctx, canvas, activeTimeline);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
