import { AudioEngine } from "./audioEngine.js";

import { ModulationEngine, TARGETS, LFO_WAVEFORMS } from "./modulation.js";

import { MidiManager, noteToName } from "./midi.js";

import { PresetStore, PRESET_CATEGORIES } from "./presets.js";

import { WaveformView } from "./waveformView.js";

import { GrainCloudView } from "./grainCloudView.js";

import { ModMatrixView } from "./modMatrixView.js";

import { Knob, getKnob, getKnobValue, setKnobValue } from "./knobControl.js";

import { Fader, HFader, getFaderValue, setFaderValue, getHFaderValue, setHFaderValue, setHFaderLabel } from "./faderControl.js";

const $ = id => document.getElementById(id);

const audioEngine = new AudioEngine;

const midi = new MidiManager;

const presetStore = new PresetStore;

let modEngine = null;

let waveformView = null;

let grainCloudView = null;

let modMatrixView = null;

let sampleLoaded = false;

let lastPositionForWindow = .06;

const discrete = {
  envelope: "hann",
  pitchMode: "semitone",
  reverse: false,
  pitchLock: false,
  formantPreserve: false,
  sprayMode: false,
  orbitMode: false,
  autoAdvance: true,
  multiBuffer: false,
  activeRecordBuffer: "A",
  stereoMode: "stereo",
  limiter: true,
  bufferLengthSeconds: 4,
  frozen: false,
  mpe: false,
  monoInput: true,
  scanLoopMode: false
};

const ccMappings = [];

const KNOB_MOUNT_MAP = {};

function knobMountIdFor(targetId) {
  return KNOB_MOUNT_MAP[targetId] || `knob${capitalize(targetId)}`;
}

const FADER_MOUNT_MAP = {
  grainDuration: "faderDuration"
};

function faderMountIdFor(targetId) {
  return FADER_MOUNT_MAP[targetId] || `fader${capitalize(targetId)}`;
}

const FADER_TARGETS = [ "grainDuration", "density", "jitter", "spread" ];

const HFADER_TARGETS = [ "position" ];

function widgetTypeFor(targetId) {
  if (HFADER_TARGETS.includes(targetId)) return "hfader";
  if (FADER_TARGETS.includes(targetId)) return "fader";
  return "knob";
}

function getParamValue(id) {
  const type = widgetTypeFor(id);
  if (type === "hfader") return getHFaderValue(id);
  if (type === "fader") return getFaderValue(id);
  return getKnobValue(id);
}

function setParamValue(id, v) {
  const type = widgetTypeFor(id);
  if (type === "hfader") setHFaderValue(id, v); else if (type === "fader") setFaderValue(id, v); else setKnobValue(id, v);
  if (id === "position" && audioEngine) {
    audioEngine.send("manualScanPosition", v);
    lastPositionForWindow = v;
  }
}

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
    const sharedIn = window.TSDevices && window.TSDevices.audioInput();
    if (sharedIn && [ ...select.options ].some(o => o.value === sharedIn.deviceId)) {
      select.value = sharedIn.deviceId;
    }
    select.addEventListener("change", () => {
      if (window.TSDevices) window.TSDevices.setAudioInput(select.value || null);
    }, {
      once: false
    });
  } catch (err) {}
}

populateDevices();

$("startBtn").addEventListener("click", async () => {
  const deviceId = $("deviceSelect").value || null;
  const initialLen = parseFloat($("initialBufferLength").value);
  $("startBtn").disabled = true;
  $("startBtn").textContent = "Starting…";
  try {
    const {sampleRate: sampleRate} = await audioEngine.start(deviceId);
    discrete.bufferLengthSeconds = initialLen;
    audioEngine.send("bufferLengthSeconds", initialLen);
    audioEngine.send("limiter", true);
    $("footerSampleRate").textContent = `${(sampleRate / 1e3).toFixed(1)} kHz`;
    $("gate").hidden = true;
    $("app").hidden = false;
    boot();
  } catch (err) {
    console.error(err);
    $("gateError").hidden = false;
    $("gateError").textContent = err.name === "NotAllowedError" ? "Microphone / input access was denied. Grant permission and try again." : `Could not start the audio engine: ${err.message || err}`;
    $("startBtn").disabled = false;
    $("startBtn").textContent = "Start engine";
  }
});

function boot() {
  wireGrainEngineControls();
  wirePerformanceControls();
  modEngine = new ModulationEngine(audioEngine);
  seedBaseValues();
  waveformView = new WaveformView($("waveformCanvas"), {
    onScan: norm => {
      if (!discrete.frozen) return;
      audioEngine.send("manualScanPosition", norm);
    }
  });
  waveformView.setScanRange(getFaderValue("scanStart") ?? 0, getFaderValue("scanEnd") ?? 1);
  grainCloudView = new GrainCloudView($("grainCloudCanvas"));
  modMatrixView = new ModMatrixView($("modMatrixCanvas"));
  audioEngine.onMeter = msg => {
    waveformView.setReadHead(msg.readHeadNorm);
    $("footerGrains").textContent = `${msg.activeGrainCount}`;
    $("footerCpu").textContent = `${Math.round(msg.cpuLoad * 100)}%`;
  };
  audioEngine.onGrains = list => grainCloudView.setGrains(list);
  wireToggleChips();
  wireModulationPanel();
  wireMidiPanel();
  wirePresetsPanel();
  wireSampleLoading();
  syncDiscreteStateToWorklet();
  updatePositionLabel();
  $("freezeToggle").addEventListener("click", () => {
    discrete.frozen = !discrete.frozen;
    audioEngine.send("freeze", discrete.frozen);
    $("freezeToggle").classList.toggle("on", discrete.frozen);
    waveformView.setFrozen(discrete.frozen);
    updatePositionLabel();
  });
  $("randomiseBtn").addEventListener("click", randomiseGrainParams);
  midi.init().then(ok => {
    if (!ok) {
      $("midiDeviceList").innerHTML = "<li>Web MIDI unavailable in this browser</li>";
    }
  });
  wireMidiCallbacks();
  requestAnimationFrame(loop);
  $("footerWorklet").textContent = "running";
}

function syncDiscreteStateToWorklet() {
  audioEngine.send("envelope", discrete.envelope);
  audioEngine.send("reverse", discrete.reverse);
  audioEngine.send("pitchLock", discrete.pitchLock);
  audioEngine.send("formantPreserve", discrete.formantPreserve);
  audioEngine.send("sprayMode", discrete.sprayMode);
  audioEngine.send("orbitMode", discrete.orbitMode);
  audioEngine.send("autoAdvance", discrete.autoAdvance);
  audioEngine.send("multiBuffer", discrete.multiBuffer);
  audioEngine.send("activeRecordBuffer", discrete.activeRecordBuffer);
  audioEngine.send("stereoMode", discrete.stereoMode);
  audioEngine.send("monoInput", discrete.monoInput);
  audioEngine.send("limiter", discrete.limiter);
  audioEngine.send("bufferLengthSeconds", discrete.bufferLengthSeconds);
  audioEngine.send("freeze", discrete.frozen);
  audioEngine.send("scanRangeMode", discrete.scanLoopMode ? "loop" : "pingpong");
}

function updatePositionLabel() {
  const tracking = discrete.autoAdvance && !discrete.frozen;
  setHFaderLabel("position", tracking ? "Live Lag" : "Position");
}

function seedBaseValues() {
  for (const t of TARGETS) {
    const v = getParamValue(t.id);
    modEngine.baseValues[t.id] = v !== undefined ? v : (t.min + t.max) / 2;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildTargetKnob(targetId, opts = {}) {
  const t = TARGETS.find(x => x.id === targetId);
  const mount = $(knobMountIdFor(targetId));
  if (!t || !mount) return null;
  return new Knob(mount, {
    id: targetId,
    min: t.min,
    max: t.max,
    step: opts.step ?? (t.max - t.min) / 200,
    value: opts.value ?? (t.min + t.max) / 2,
    defaultValue: opts.defaultValue ?? opts.value,
    format: opts.format || (v => v.toFixed(2)),
    label: opts.label,
    onChange: v => {
      if (modEngine) modEngine.baseValues[targetId] = v;
    }
  });
}

function buildTargetFader(targetId, opts = {}) {
  const t = TARGETS.find(x => x.id === targetId);
  const mount = $(faderMountIdFor(targetId));
  if (!t || !mount) return null;
  return new Fader(mount, {
    id: targetId,
    min: t.min,
    max: t.max,
    step: opts.step ?? (t.max - t.min) / 200,
    value: opts.value ?? (t.min + t.max) / 2,
    defaultValue: opts.defaultValue ?? opts.value,
    format: opts.format || (v => v.toFixed(2)),
    label: opts.label,
    onChange: v => {
      if (modEngine) modEngine.baseValues[targetId] = v;
    }
  });
}

function buildTargetHFader(targetId, opts = {}) {
  const t = TARGETS.find(x => x.id === targetId);
  const mount = $(`hfader${capitalize(targetId)}`);
  if (!t || !mount) return null;
  return new HFader(mount, {
    id: targetId,
    min: t.min,
    max: t.max,
    step: opts.step ?? (t.max - t.min) / 400,
    value: opts.value ?? (t.min + t.max) / 2,
    defaultValue: opts.defaultValue ?? opts.value,
    format: opts.format || (v => v.toFixed(2)),
    label: opts.label,
    onChange: v => {
      if (modEngine) modEngine.baseValues[targetId] = v;
    }
  });
}

function envelopeCurveSamples(type) {
  const n = 48;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let v;
    if (type === "hann") v = .5 - .5 * Math.cos(2 * Math.PI * t); else if (type === "gaussian") {
      const x = (t - .5) / .18;
      v = Math.exp(-.5 * x * x);
    } else if (type === "tukey") {
      const alpha = .5;
      if (t < alpha / 2) v = .5 * (1 + Math.cos(Math.PI * (2 * t / alpha - 1))); else if (t > 1 - alpha / 2) v = .5 * (1 + Math.cos(Math.PI * (2 * t / alpha - 2 / alpha + 1))); else v = 1;
    } else {
      const attack = .08;
      v = t < attack ? t / attack : Math.exp(-5 * (t - attack) / (1 - attack));
    }
    pts.push([ t * 100, 28 - v * 25 ]);
  }
  return pts;
}

function updateEnvelopePreview() {
  const pathEl = $("envelopePreviewPath");
  if (!pathEl) return;
  const pts = envelopeCurveSamples(discrete.envelope);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  pathEl.setAttribute("d", d);
}

function wireGrainEngineControls() {
  buildTargetKnob("outputGain", {
    value: 1.6,
    defaultValue: 1.6,
    step: .01,
    format: v => v.toFixed(2),
    label: "Master"
  });
  buildTargetFader("grainDuration", {
    value: 60,
    defaultValue: 60,
    step: 1,
    format: v => `${Math.round(v)}ms`,
    label: "Dur"
  });
  buildTargetFader("density", {
    value: 20,
    defaultValue: 20,
    step: .5,
    format: v => `${v.toFixed(1)}/s`,
    label: "Dens"
  });
  buildTargetFader("jitter", {
    value: .15,
    defaultValue: .15,
    step: .01,
    format: v => v.toFixed(2),
    label: "Jit"
  });
  buildTargetFader("spread", {
    value: .5,
    defaultValue: .5,
    step: .01,
    format: v => v.toFixed(2),
    label: "Spr"
  });
  const onScanRangeChange = () => {
    const s = getFaderValue("scanStart"), e = getFaderValue("scanEnd");
    audioEngine.setParamImmediate("scanStart", s);
    audioEngine.setParamImmediate("scanEnd", e);
    waveformView.setScanRange(s, e);
  };
  new Fader($("faderScanStart"), {
    id: "scanStart",
    min: 0,
    max: 1,
    step: .005,
    value: 0,
    defaultValue: 0,
    format: v => v.toFixed(2),
    label: "Start",
    onChange: onScanRangeChange
  });
  new Fader($("faderScanEnd"), {
    id: "scanEnd",
    min: 0,
    max: 1,
    step: .005,
    value: 1,
    defaultValue: 1,
    format: v => v.toFixed(2),
    label: "End",
    onChange: onScanRangeChange
  });
  new Fader($("faderBufferLength"), {
    id: "bufferLength",
    min: 1,
    max: 10,
    step: .5,
    value: discrete.bufferLengthSeconds,
    defaultValue: discrete.bufferLengthSeconds,
    format: v => `${v.toFixed(1)}s`,
    label: "Buf",
    onChange: v => {
      discrete.bufferLengthSeconds = v;
      audioEngine.send("bufferLengthSeconds", v);
      $("footerBuffer").textContent = `${v.toFixed(1)} s`;
    }
  });
  $("footerBuffer").textContent = `${discrete.bufferLengthSeconds.toFixed(1)} s`;
  $("setScanStartBtn").addEventListener("click", () => {
    const v = waveformView.readHeadNorm;
    setFaderValue("scanStart", v);
    onScanRangeChange();
  });
  $("setScanEndBtn").addEventListener("click", () => {
    const v = waveformView.readHeadNorm;
    setFaderValue("scanEnd", v);
    onScanRangeChange();
  });
  $("resetScanRangeBtn").addEventListener("click", () => {
    setFaderValue("scanStart", 0);
    setFaderValue("scanEnd", 1);
    onScanRangeChange();
  });
  {
    const posTarget = TARGETS.find(t => t.id === "position");
    new HFader($("hfaderPosition"), {
      id: "position",
      min: posTarget.min,
      max: posTarget.max,
      step: .005,
      value: .06,
      defaultValue: .06,
      format: v => v.toFixed(2),
      label: "Position",
      onChange: v => {
        if (modEngine) modEngine.baseValues.position = v;
        audioEngine.send("manualScanPosition", v);
        const delta = v - lastPositionForWindow;
        lastPositionForWindow = v;
        const s = getFaderValue("scanStart"), e = getFaderValue("scanEnd");
        const width = e - s;
        let newStart = s + delta, newEnd = e + delta;
        if (newStart < 0) {
          newStart = 0;
          newEnd = width;
        }
        if (newEnd > 1) {
          newEnd = 1;
          newStart = 1 - width;
        }
        setFaderValue("scanStart", newStart);
        setFaderValue("scanEnd", newEnd);
        audioEngine.setParamImmediate("scanStart", newStart);
        audioEngine.setParamImmediate("scanEnd", newEnd);
        waveformView.setScanRange(newStart, newEnd);
      }
    });
  }
  new Knob($("knobOrbitRate"), {
    id: "orbitRate",
    min: .01,
    max: 8,
    step: .01,
    value: .25,
    defaultValue: .25,
    format: v => `${v.toFixed(2)}Hz`,
    label: "Orbit Rt",
    onChange: v => audioEngine.setParamImmediate("orbitRate", v)
  });
  buildTargetKnob("orbitDepth", {
    value: 0,
    defaultValue: 0,
    step: .01,
    format: v => v.toFixed(2),
    label: "Orbit Dp"
  });
  buildTargetKnob("pitch", {
    value: 0,
    defaultValue: 0,
    step: 1,
    label: "Pitch",
    format: v => discrete.pitchMode === "ratio" ? `${Math.pow(2, v / 12).toFixed(3)}x` : `${v >= 0 ? "+" : ""}${Math.round(v)}st`
  });
  buildTargetKnob("scanSpeed", {
    value: 1,
    defaultValue: 1,
    step: .05,
    format: v => `${v.toFixed(2)}x`,
    label: "Scan Spd"
  });
  buildTargetKnob("crossfadeAB", {
    value: 0,
    defaultValue: 0,
    step: .01,
    format: v => v.toFixed(2),
    label: "X-fade"
  });
  $("ctlPitchMode").addEventListener("change", () => {
    discrete.pitchMode = $("ctlPitchMode").value;
    const k = getKnob("pitch");
    if (k) k.setValue(k.value);
  });
  $("ctlEnvelope").addEventListener("change", () => {
    discrete.envelope = $("ctlEnvelope").value;
    audioEngine.send("envelope", discrete.envelope);
    updateEnvelopePreview();
  });
  updateEnvelopePreview();
  $("ctlRecordBuffer").addEventListener("change", () => {
    discrete.activeRecordBuffer = $("ctlRecordBuffer").value;
    audioEngine.send("activeRecordBuffer", discrete.activeRecordBuffer);
  });
  $("ctlStereoMode").addEventListener("change", () => {
    discrete.stereoMode = $("ctlStereoMode").value;
    audioEngine.send("stereoMode", discrete.stereoMode);
  });
  $("resetBuffersBtn").addEventListener("click", () => {
    audioEngine.send("resetBuffers", true);
    sampleLoaded = false;
    $("footerSource").textContent = "Live input";
    waveformView.clearStaticWaveform();
  });
}

const MAX_SAMPLE_SECONDS = 10;

function wireSampleLoading() {
  $("loadSampleBtn").addEventListener("click", () => $("sampleFileInput").click());
  $("sampleFileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) loadSampleFile(file);
    e.target.value = "";
  });
  const wrap = $("waveformWrap");
  let dragDepth = 0;
  wrap.addEventListener("dragenter", e => {
    e.preventDefault();
    dragDepth++;
    wrap.classList.add("drag-over");
  });
  wrap.addEventListener("dragover", e => e.preventDefault());
  wrap.addEventListener("dragleave", e => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) wrap.classList.remove("drag-over");
  });
  wrap.addEventListener("drop", e => {
    e.preventDefault();
    dragDepth = 0;
    wrap.classList.remove("drag-over");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadSampleFile(file);
  });
}

function flashFooterSource(text, revertAfterMs) {
  $("footerSource").textContent = text;
  if (revertAfterMs) {
    setTimeout(() => {
      $("footerSource").textContent = sampleLoaded ? $("footerSource").dataset.loadedName || "Sample" : "Live input";
    }, revertAfterMs);
  }
}

async function loadSampleFile(file) {
  if (!audioEngine.audioCtx) return;
  flashFooterSource("Decoding…");
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioEngine.audioCtx.decodeAudioData(arrayBuffer);
    const chL = audioBuffer.getChannelData(0);
    const chR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
    const durationSeconds = Math.max(1, Math.min(MAX_SAMPLE_SECONDS, audioBuffer.duration));
    const truncated = audioBuffer.duration > MAX_SAMPLE_SECONDS;
    const numSamples = Math.min(chL.length, Math.floor(durationSeconds * audioEngine.sampleRate));
    discrete.bufferLengthSeconds = durationSeconds;
    setFaderValue("bufferLength", durationSeconds);
    audioEngine.send("bufferLengthSeconds", durationSeconds);
    $("footerBuffer").textContent = `${durationSeconds.toFixed(1)} s`;
    const dataL = chL.slice(0, numSamples);
    const dataR = chR ? chR.slice(0, numSamples) : null;
    audioEngine.loadSample(dataL, dataR, numSamples);
    waveformView.setStaticWaveform(dataL);
    waveformView.setReadHead(0);
    if (!discrete.frozen) {
      discrete.frozen = true;
      audioEngine.send("freeze", true);
      $("freezeToggle").classList.add("on");
      waveformView.setFrozen(true);
      updatePositionLabel();
    }
    sampleLoaded = true;
    const label = file.name.length > 26 ? `${file.name.slice(0, 23)}…` : file.name;
    $("footerSource").textContent = label;
    $("footerSource").dataset.loadedName = label;
    if (truncated) {
      console.warn(`[granulator] "${file.name}" is longer than ${MAX_SAMPLE_SECONDS}s — loaded the first ${MAX_SAMPLE_SECONDS}s only.`);
      flashFooterSource(`Truncated to ${MAX_SAMPLE_SECONDS}s`, 2200);
    }
  } catch (err) {
    console.error("[granulator] sample load failed:", err);
    flashFooterSource("Load failed — see console", 3e3);
  }
}

function randomiseGrainParams() {
  const rand = (min, max) => min + Math.random() * (max - min);
  setParamValue("grainDuration", Math.round(rand(5, 150)));
  setParamValue("density", +rand(2, 80).toFixed(1));
  setParamValue("jitter", +rand(0, .8).toFixed(2));
  setParamValue("spread", +rand(0, 1).toFixed(2));
  const pitch = Math.round(rand(-12, 12));
  setParamValue("pitch", pitch);
  if (modEngine) {
    modEngine.baseValues.grainDuration = getParamValue("grainDuration");
    modEngine.baseValues.density = getParamValue("density");
    modEngine.baseValues.jitter = getParamValue("jitter");
    modEngine.baseValues.spread = getParamValue("spread");
    modEngine.baseValues.pitch = pitch;
  }
  const envs = [ "hann", "gaussian", "tukey", "exponential" ];
  const env = envs[Math.floor(Math.random() * envs.length)];
  $("ctlEnvelope").value = env;
  discrete.envelope = env;
  audioEngine.send("envelope", env);
  updateEnvelopePreview();
}

function wireToggleChips() {
  document.querySelectorAll(".toggle-chip").forEach(chip => {
    const key = chip.dataset.toggle;
    chip.addEventListener("click", () => {
      discrete[key] = !discrete[key];
      chip.classList.toggle("on", discrete[key]);
      if (key === "scanLoopMode") {
        audioEngine.send("scanRangeMode", discrete.scanLoopMode ? "loop" : "pingpong");
        return;
      }
      audioEngine.send(key, discrete[key]);
      if (key === "autoAdvance") updatePositionLabel();
    });
  });
}

function wirePerformanceControls() {
  buildTargetKnob("dryWet", {
    value: 1,
    defaultValue: 1,
    step: .01,
    format: v => v.toFixed(2)
  });
  new Knob($("knobInputGain"), {
    id: "inputGain",
    min: 0,
    max: 4,
    step: .01,
    value: 1,
    defaultValue: 1,
    format: v => v.toFixed(2),
    onChange: v => audioEngine.setParam("inputGain", v)
  });
  const macroBank = $("macroBank");
  for (let i = 0; i < 4; i++) {
    const mount = document.createElement("div");
    macroBank.appendChild(mount);
    new Knob(mount, {
      id: `macro${i}`,
      min: 0,
      max: 1,
      step: .01,
      value: .5,
      defaultValue: .5,
      label: `M${i + 1}`,
      format: v => v.toFixed(2),
      size: 44,
      onChange: v => {
        if (modEngine) modEngine.setMacro(i, v);
      }
    });
  }
  const xAxisSelect = $("xyAxisX");
  const yAxisSelect = $("xyAxisY");
  for (const t of TARGETS) {
    const optX = document.createElement("option");
    optX.value = t.id;
    optX.textContent = t.label;
    xAxisSelect.appendChild(optX);
    const optY = document.createElement("option");
    optY.value = t.id;
    optY.textContent = t.label;
    yAxisSelect.appendChild(optY);
  }
  xAxisSelect.value = "position";
  yAxisSelect.value = "density";
  const pad = $("xyPad");
  const dot = $("xyPadDot");
  let dragging = false;
  function applyXY(clientX, clientY) {
    const rect = pad.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    dot.style.left = `${nx * 100}%`;
    dot.style.top = `${ny * 100}%`;
    const xTarget = TARGETS.find(t => t.id === xAxisSelect.value);
    const yTarget = TARGETS.find(t => t.id === yAxisSelect.value);
    if (xTarget) {
      const v = xTarget.min + nx * (xTarget.max - xTarget.min);
      if (modEngine) modEngine.baseValues[xTarget.id] = v;
      syncControlDisplay(xTarget.id, v);
    }
    if (yTarget) {
      const v = yTarget.min + (1 - ny) * (yTarget.max - yTarget.min);
      if (modEngine) modEngine.baseValues[yTarget.id] = v;
      syncControlDisplay(yTarget.id, v);
    }
  }
  pad.addEventListener("pointerdown", e => {
    dragging = true;
    pad.setPointerCapture(e.pointerId);
    applyXY(e.clientX, e.clientY);
  });
  pad.addEventListener("pointermove", e => {
    if (dragging) applyXY(e.clientX, e.clientY);
  });
  pad.addEventListener("pointerup", () => {
    dragging = false;
  });
  dot.style.left = "30%";
  dot.style.top = "80%";
}

function syncControlDisplay(targetId, value) {
  setParamValue(targetId, value);
}

function wireModulationPanel() {
  renderSourceList();
  renderRouteList();
  document.querySelectorAll("[data-add-source]").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.addSource;
      const count = modEngine.sources.filter(s => s.type === type).length + 1;
      modEngine.addSource(type, {
        label: `${labelForType(type)} ${count}`
      });
      renderSourceList();
      renderRouteList();
    });
  });
  $("addRouteBtn").addEventListener("click", () => {
    if (modEngine.sources.length === 0) return;
    modEngine.addRoute(modEngine.sources[0].id, TARGETS[0].id, .5);
    renderRouteList();
  });
  $("clearRoutesBtn").addEventListener("click", () => {
    modEngine.clearRoutes();
    renderRouteList();
  });
}

function labelForType(type) {
  return {
    lfo: "LFO",
    envelope: "Env",
    stepSeq: "Steps",
    random: "Random",
    midicc: "CC"
  }[type] || type;
}

function renderSourceList() {
  const list = $("modSourceList");
  list.innerHTML = "";
  for (const s of modEngine.sources) {
    const row = document.createElement("div");
    row.className = "mod-source-item";
    row.innerHTML = `<div class="src-meta"><span>${s.label}</span><small>${sourceSubtitle(s)}</small></div>`;
    const controls = document.createElement("div");
    controls.className = "src-controls";
    controls.appendChild(buildSourceControls(s));
    if (![ "macro", "midicc", "aftertouch" ].includes(s.type)) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-small danger";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        modEngine.removeSource(s.id);
        renderSourceList();
        renderRouteList();
      });
      controls.appendChild(removeBtn);
    }
    row.appendChild(controls);
    list.appendChild(row);
  }
}

function sourceSubtitle(s) {
  if (s.type === "lfo") return `${s.waveform} · ${s.rateHz.toFixed(2)} Hz`;
  if (s.type === "envelope") return `A${s.attack.toFixed(2)} D${s.decay.toFixed(2)} S${s.sustain.toFixed(2)} R${s.release.toFixed(2)}`;
  if (s.type === "stepSeq") return `${s.steps.length} steps · ${s.rateHz.toFixed(1)} Hz`;
  if (s.type === "random") return s.mode;
  if (s.type === "midicc") return s.cc === null ? "unassigned" : `CC ${s.cc}`;
  if (s.type === "macro") return "performance macro";
  if (s.type === "aftertouch") return "channel aftertouch";
  return s.type;
}

function buildSourceControls(s) {
  const frag = document.createElement("span");
  if (s.type === "lfo") {
    const wave = document.createElement("select");
    LFO_WAVEFORMS.forEach(w => {
      const o = document.createElement("option");
      o.value = w;
      o.textContent = w;
      if (w === s.waveform) o.selected = true;
      wave.appendChild(o);
    });
    wave.addEventListener("change", () => {
      s.waveform = wave.value;
      renderSourceList();
    });
    const rate = document.createElement("input");
    rate.type = "number";
    rate.min = "0.01";
    rate.max = "20";
    rate.step = "0.01";
    rate.value = s.rateHz;
    rate.style.width = "52px";
    rate.addEventListener("input", () => {
      s.rateHz = parseFloat(rate.value) || .1;
      renderSourceList();
    });
    frag.appendChild(wave);
    frag.appendChild(rate);
  } else if (s.type === "envelope") {
    const trigBtn = document.createElement("button");
    trigBtn.className = "btn-small";
    trigBtn.textContent = "Trigger";
    trigBtn.addEventListener("mousedown", () => modEngine.triggerEnvelopes());
    trigBtn.addEventListener("mouseup", () => modEngine.releaseEnvelopes());
    frag.appendChild(trigBtn);
  } else if (s.type === "stepSeq") {
    const rate = document.createElement("input");
    rate.type = "number";
    rate.min = "0.1";
    rate.max = "32";
    rate.step = "0.1";
    rate.value = s.rateHz;
    rate.style.width = "48px";
    rate.addEventListener("input", () => {
      s.rateHz = parseFloat(rate.value) || 1;
    });
    frag.appendChild(rate);
    const stepsSelect = document.createElement("select");
    [ 1, 4, 8, 16, 32, 64 ].forEach(n => {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = `${n} steps`;
      if (s.steps.length === n) o.selected = true;
      stepsSelect.appendChild(o);
    });
    stepsSelect.addEventListener("change", () => {
      const n = parseInt(stepsSelect.value, 10);
      const arr = new Array(n).fill(0).map((_, i) => Math.sin(i / n * Math.PI * 2) * .6);
      s.steps = arr;
      s.pos = 0;
    });
    frag.appendChild(stepsSelect);
  } else if (s.type === "random") {
    const mode = document.createElement("select");
    [ "noise", "chaos", "brownian" ].forEach(m => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      if (m === s.mode) o.selected = true;
      mode.appendChild(o);
    });
    mode.addEventListener("change", () => {
      s.mode = mode.value;
      renderSourceList();
    });
    frag.appendChild(mode);
  } else if (s.type === "midicc") {
    const learnBtn = document.createElement("button");
    learnBtn.className = "btn-small";
    learnBtn.textContent = s.cc === null ? "Learn" : `CC${s.cc}`;
    learnBtn.addEventListener("click", () => {
      learnBtn.textContent = "listening…";
      midi.learnNextCC(cc => {
        s.cc = cc;
        renderSourceList();
      });
    });
    frag.appendChild(learnBtn);
  } else if (s.type === "macro") {
    const note = document.createElement("span");
    note.style.fontSize = "10px";
    note.style.color = "var(--text-dim)";
    note.textContent = `Macro ${s.macroIndex + 1}`;
    frag.appendChild(note);
  }
  return frag;
}

function renderRouteList() {
  const list = $("routeList");
  list.innerHTML = "";
  for (const r of modEngine.routes) {
    const row = document.createElement("div");
    row.className = "route-row";
    const srcSelect = document.createElement("select");
    modEngine.sources.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      if (s.id === r.sourceId) o.selected = true;
      srcSelect.appendChild(o);
    });
    srcSelect.addEventListener("change", () => {
      r.sourceId = srcSelect.value;
    });
    const tgtSelect = document.createElement("select");
    TARGETS.forEach(t => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.label;
      if (t.id === r.targetId) o.selected = true;
      tgtSelect.appendChild(o);
    });
    tgtSelect.addEventListener("change", () => {
      r.targetId = tgtSelect.value;
    });
    const depth = document.createElement("input");
    depth.type = "range";
    depth.min = "-1";
    depth.max = "1";
    depth.step = "0.01";
    depth.value = r.depth;
    depth.addEventListener("input", () => {
      r.depth = parseFloat(depth.value);
    });
    const enable = document.createElement("input");
    enable.type = "checkbox";
    enable.checked = r.enabled;
    enable.addEventListener("change", () => {
      r.enabled = enable.checked;
    });
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-small danger";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      modEngine.removeRoute(r.id);
      renderRouteList();
    });
    row.appendChild(srcSelect);
    row.appendChild(tgtSelect);
    row.appendChild(depth);
    row.appendChild(enable);
    row.appendChild(removeBtn);
    list.appendChild(row);
  }
}

function wireMidiPanel() {
  $("clockSourceSelect").addEventListener("change", () => {
    midi.setClockSource($("clockSourceSelect").value);
  });
  $("mpeToggle").addEventListener("change", () => {
    discrete.mpe = $("mpeToggle").checked;
  });
  $("learnCcBtn").addEventListener("click", () => {
    $("learnCcBtn").textContent = "Listening for a CC message…";
    midi.learnNextCC(cc => {
      const count = modEngine.sources.filter(s => s.type === "midicc").length + 1;
      const src = modEngine.addSource("midicc", {
        label: `CC ${cc}`,
        cc: cc
      });
      renderSourceList();
      renderCcMappingList();
      $("learnCcBtn").textContent = "MIDI Learn — add CC mapping";
    });
  });
  renderCcMappingList();
  midi.onDeviceChange = inputs => {
    const list = $("midiDeviceList");
    list.innerHTML = "";
    if (inputs.length === 0) {
      list.innerHTML = "<li>No devices connected</li>";
      return;
    }
    inputs.forEach(inp => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${inp.name || "MIDI device"}</span><span style="color:var(--accent)">connected</span>`;
      list.appendChild(li);
    });
  };
}

function renderCcMappingList() {
  const list = $("ccMappingList");
  list.innerHTML = "";
  const ccSources = modEngine.sources.filter(s => s.type === "midicc");
  if (ccSources.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text-dim);">No CC mappings yet</div>';
    return;
  }
  ccSources.forEach(s => {
    const row = document.createElement("div");
    row.className = "cc-mapping-row";
    row.innerHTML = `<span>${s.label}</span><span style="font-family:var(--mono);color:var(--accent);">CC ${s.cc ?? "--"}</span>`;
    list.appendChild(row);
  });
}

function wireMidiCallbacks() {
  midi.onNoteOn = (note, vel, channel) => {
    const semis = Math.max(-24, Math.min(24, note - 60));
    modEngine.baseValues.pitch = semis;
    setKnobValue("pitch", semis);
    modEngine.triggerEnvelopes();
  };
  midi.onNoteOff = () => modEngine.releaseEnvelopes();
  midi.onCC = (cc, value01, channel) => modEngine.feedMidiCC(cc, value01, channel);
  midi.onAftertouch = value01 => modEngine.setAftertouch(value01);
  midi.onPitchBend = bipolar => {
    if (!discrete.mpe) return;
    const bendSemis = bipolar * 2;
    audioEngine.setParamImmediate("pitch", Math.max(-24, Math.min(24, modEngine.baseValues.pitch + bendSemis)));
  };
  midi.onClockTick = () => {
    $("bpmReadout").textContent = `${midi.internalBpm.toFixed(1)} BPM`;
  };
}

function wirePresetsPanel() {
  const categorySelect = $("presetCategory");
  PRESET_CATEGORIES.forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    categorySelect.appendChild(o);
  });
  categorySelect.addEventListener("change", refreshPresetSelect);
  refreshPresetSelect();
  $("presetSelect").addEventListener("change", () => {
    const p = presetStore.get($("presetSelect").value);
    if (p) applyState(p.state);
  });
  $("savePresetBtn").addEventListener("click", () => {
    const name = $("presetNameInput").value.trim();
    if (!name) return;
    presetStore.save(name, categorySelect.value, captureState());
    refreshPresetSelect();
    $("presetNameInput").value = "";
  });
  $("deletePresetBtn").addEventListener("click", () => {
    const name = $("presetSelect").value;
    if (name) {
      presetStore.delete(name);
      refreshPresetSelect();
    }
  });
  $("exportPresetBtn").addEventListener("click", () => {
    const name = $("presetNameInput").value.trim() || $("presetSelect").value || "granulator-preset";
    presetStore.exportJSON(captureState(), name);
  });
  $("exportBankBtn").addEventListener("click", () => presetStore.exportAllJSON());
  $("importPresetInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await presetStore.importJSONFile(file);
      refreshPresetSelect();
    } catch (err) {
      console.error("[granulator] preset import failed:", err);
    }
    e.target.value = "";
  });
  const snapshotBank = $("snapshotBank");
  [ "A", "B", "C", "D" ].forEach(slot => {
    const btn = document.createElement("div");
    btn.className = "snapshot-btn";
    btn.innerHTML = `<strong>${slot}</strong><span class="snap-hint">click: recall</span>`;
    btn.addEventListener("click", () => {
      const state = presetStore.getSnapshot(slot);
      if (state) applyState(state);
    });
    btn.addEventListener("dblclick", () => {
      presetStore.saveSnapshot(slot, captureState());
      btn.querySelector(".snap-hint").textContent = "saved!";
      setTimeout(() => {
        btn.querySelector(".snap-hint").textContent = "click: recall";
      }, 900);
    });
    btn.title = "Click to recall, double-click to save this snapshot";
    snapshotBank.appendChild(btn);
  });
}

function refreshPresetSelect() {
  const category = $("presetCategory").value;
  const select = $("presetSelect");
  select.innerHTML = "";
  presetStore.list(category || null).forEach(p => {
    const o = document.createElement("option");
    o.value = p.name;
    o.textContent = p.name;
    select.appendChild(o);
  });
}

function captureState() {
  return {
    params: {
      ...modEngine.baseValues,
      inputGain: getKnobValue("inputGain"),
      orbitRate: getKnobValue("orbitRate"),
      scanStart: getFaderValue("scanStart"),
      scanEnd: getFaderValue("scanEnd")
    },
    discrete: {
      ...discrete
    },
    modulation: {
      sources: modEngine.sources.map(s => ({
        ...s
      })),
      routes: modEngine.routes.map(r => ({
        ...r
      })),
      macros: [ ...modEngine.macros ]
    }
  };
}

const DIRECT_KNOB_PARAMS = [ "orbitRate" ];

const DIRECT_FADER_PARAMS = [ "scanStart", "scanEnd" ];

function applyState(state) {
  if (!state) return;
  if (state.params) {
    for (const [k, v] of Object.entries(state.params)) {
      if (k === "inputGain") {
        setKnobValue("inputGain", v);
        audioEngine.setParam("inputGain", v);
        continue;
      }
      if (TARGETS.find(t => t.id === k)) {
        modEngine.baseValues[k] = v;
        syncControlDisplay(k, v);
      } else if (DIRECT_KNOB_PARAMS.includes(k)) {
        setKnobValue(k, v);
        audioEngine.setParamImmediate(k, v);
      } else if (DIRECT_FADER_PARAMS.includes(k)) {
        setFaderValue(k, v);
        audioEngine.setParamImmediate(k, v);
      }
    }
    if ("scanStart" in state.params || "scanEnd" in state.params) {
      waveformView.setScanRange(getFaderValue("scanStart") ?? 0, getFaderValue("scanEnd") ?? 1);
    }
  }
  if (state.discrete) {
    Object.assign(discrete, state.discrete);
    audioEngine.send("envelope", discrete.envelope);
    audioEngine.send("reverse", discrete.reverse);
    audioEngine.send("pitchLock", discrete.pitchLock);
    audioEngine.send("formantPreserve", discrete.formantPreserve);
    audioEngine.send("sprayMode", discrete.sprayMode);
    audioEngine.send("orbitMode", discrete.orbitMode);
    audioEngine.send("autoAdvance", discrete.autoAdvance);
    audioEngine.send("multiBuffer", discrete.multiBuffer);
    audioEngine.send("activeRecordBuffer", discrete.activeRecordBuffer);
    audioEngine.send("stereoMode", discrete.stereoMode);
    audioEngine.send("monoInput", discrete.monoInput);
    audioEngine.send("limiter", discrete.limiter);
    audioEngine.send("bufferLengthSeconds", discrete.bufferLengthSeconds);
    audioEngine.send("freeze", discrete.frozen);
    audioEngine.send("scanRangeMode", discrete.scanLoopMode ? "loop" : "pingpong");
    $("ctlEnvelope").value = discrete.envelope;
    updateEnvelopePreview();
    $("ctlRecordBuffer").value = discrete.activeRecordBuffer;
    $("ctlStereoMode").value = discrete.stereoMode;
    setFaderValue("bufferLength", discrete.bufferLengthSeconds);
    $("footerBuffer").textContent = `${discrete.bufferLengthSeconds.toFixed(1)} s`;
    $("freezeToggle").classList.toggle("on", discrete.frozen);
    waveformView.setFrozen(discrete.frozen);
    updatePositionLabel();
    document.querySelectorAll(".toggle-chip").forEach(chip => {
      const key = chip.dataset.toggle;
      chip.classList.toggle("on", !!discrete[key]);
    });
  }
  if (state.modulation) {
    modEngine.sources = state.modulation.sources.map(s => ({
      ...s
    }));
    modEngine.routes = state.modulation.routes.map(r => ({
      ...r
    }));
    modEngine.macros = state.modulation.macros || [ .5, .5, .5, .5 ];
    modEngine.macros.forEach((m, i) => setKnobValue(`macro${i}`, m));
    renderSourceList();
    renderRouteList();
    renderCcMappingList();
  }
}

const waveformBuf = new Float32Array(2048);

function loop() {
  if (modEngine) {
    const resolved = modEngine.tick();
    modMatrixView.update(modEngine.sources, modEngine.macros);
    modMatrixView.draw();
    audioEngine.getInputWaveform(waveformBuf);
    waveformView.pushSamples(waveformBuf);
    waveformView.setScanSpread(resolved.jitter !== undefined ? resolved.jitter : modEngine.baseValues.jitter);
    waveformView.draw();
    grainCloudView.draw();
    $("footerWorklet").textContent = audioEngine.isRunning ? "running" : "suspended";
  }
  requestAnimationFrame(loop);
}

const undoStack = [];

const UNDO_LIMIT = 30;

function pushUndo(label) {
  try {
    undoStack.push({
      label: label,
      state: captureState()
    });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    refreshUndoButton();
  } catch (err) {
    console.warn("[granulator] could not snapshot for undo:", err);
  }
}

function refreshUndoButton() {
  const btn = $("undoBtn");
  if (!btn) return;
  const top = undoStack[undoStack.length - 1];
  btn.disabled = undoStack.length === 0;
  btn.textContent = top ? `Undo ${top.label}` : "Undo";
  btn.title = top ? `Undo ${top.label} (Z)` : "Nothing to undo";
}

function performUndo() {
  const entry = undoStack.pop();
  if (!entry) return;
  applyState(entry.state);
  refreshUndoButton();
}

let recorder = null;

let recordTimer = null;

function updateRecordUi(on) {
  const btn = $("recordBtn");
  if (!btn) return;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  if (!on) {
    $("recordLabel").textContent = "Record";
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
  }
}

function startRecording() {
  if (!window.TSRecorder || !audioEngine.workletNode) return;
  recorder = window.TSRecorder.create(audioEngine.audioCtx, audioEngine.workletNode);
  recorder.start().then(() => {
    updateRecordUi(true);
    recordTimer = setInterval(() => {
      const secs = recorder.durationSeconds();
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      $("recordLabel").textContent = `${m}:${String(s).padStart(2, "0")}`;
    }, 250);
  }).catch(err => {
    console.error("[granulator] could not start recording:", err);
    updateRecordUi(false);
  });
}

function stopRecording() {
  if (!recorder) return;
  recorder.stop();
  const wrote = recorder.download("granulator");
  if (!wrote) console.warn("[granulator] nothing captured — recording was too short");
  recorder = null;
  updateRecordUi(false);
}

function toggleRecording() {
  if (recorder && recorder.recording) stopRecording(); else startRecording();
}

function wireGranulatorExtras() {
  const undoBtn = $("undoBtn");
  if (undoBtn) undoBtn.addEventListener("click", performUndo);
  refreshUndoButton();
  const recBtn = $("recordBtn");
  if (recBtn) recBtn.addEventListener("click", toggleRecording);
  $("randomiseBtn").addEventListener("click", () => pushUndo("randomise"), true);
  $("presetSelect").addEventListener("change", () => pushUndo("preset load"), true);
  const store = window.TSStore ? window.TSStore.create("granulator") : null;
  const collapsedSaved = store ? store.get("collapsedPanels", []) : [];
  document.querySelectorAll(".card.collapsible").forEach((card, i) => {
    const toggle = card.querySelector(".panel-toggle");
    if (!toggle) return;
    const key = `panel${i}`;
    const setCollapsed = collapsed => {
      card.setAttribute("data-collapsed", collapsed ? "true" : "false");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };
    setCollapsed(collapsedSaved.indexOf(key) !== -1);
    toggle.addEventListener("click", () => {
      const nowCollapsed = card.getAttribute("data-collapsed") !== "true";
      setCollapsed(nowCollapsed);
      if (store) {
        const list = [];
        document.querySelectorAll(".card.collapsible").forEach((c, j) => {
          if (c.getAttribute("data-collapsed") === "true") list.push(`panel${j}`);
        });
        store.set("collapsedPanels", list);
      }
    });
  });
  if (window.TSShortcuts) {
    window.TSShortcuts.register([ {
      keys: "space",
      group: "Performance",
      label: "Freeze / unfreeze the buffer",
      run: () => $("freezeToggle").click()
    }, {
      keys: "r",
      group: "Performance",
      label: "Start / stop recording to WAV",
      run: toggleRecording
    }, {
      keys: "z",
      group: "Patch",
      label: "Undo the last patch change",
      run: performUndo
    }, {
      keys: "x",
      group: "Patch",
      label: "Randomise the grain engine",
      run: () => $("randomiseBtn").click()
    }, {
      keys: "l",
      group: "Patch",
      label: "Load a sample into the buffer",
      run: () => $("loadSampleBtn").click()
    }, {
      keys: "?",
      group: "General",
      label: "Show this help"
    } ]);
  }
}

wireGranulatorExtras();

const tempoSync = {
  grainDuration: null,
  density: null,
  scanSpeed: null
};

function currentBpm() {
  const bpm = midi && typeof midi.internalBpm === "number" ? midi.internalBpm : 120;
  return bpm > 20 && bpm < 400 ? bpm : 120;
}

function applyTempoSync() {
  const bpm = currentBpm();
  const beatSeconds = 60 / bpm;
  if (tempoSync.grainDuration) {
    const ms = beatSeconds * tempoSync.grainDuration * 1e3;
    setParamValue("grainDuration", Math.max(1, Math.min(500, Math.round(ms))));
    if (modEngine) modEngine.baseValues.grainDuration = getParamValue("grainDuration");
  }
  if (tempoSync.density) {
    const grainsPerSecond = 1 / (beatSeconds * tempoSync.density);
    setParamValue("density", +Math.max(.1, Math.min(200, grainsPerSecond)).toFixed(1));
    if (modEngine) modEngine.baseValues.density = getParamValue("density");
  }
  if (tempoSync.scanSpeed) {
    const passSeconds = beatSeconds * tempoSync.scanSpeed;
    const speed = passSeconds > 0 ? 1 / passSeconds : 1;
    setParamValue("scanSpeed", +Math.max(-4, Math.min(4, speed)).toFixed(3));
    if (modEngine) modEngine.baseValues.scanSpeed = getParamValue("scanSpeed");
  }
}

function wireTempoSync() {
  const map = {
    syncDurationSelect: "grainDuration",
    syncDensitySelect: "density",
    syncScanSelect: "scanSpeed"
  };
  Object.keys(map).forEach(selectId => {
    const el = $(selectId);
    if (!el) return;
    el.addEventListener("change", () => {
      const v = parseFloat(el.value);
      tempoSync[map[selectId]] = el.value === "" || Number.isNaN(v) ? null : v;
      applyTempoSync();
    });
  });
  const previousOnClockTick = midi.onClockTick;
  midi.onClockTick = () => {
    if (previousOnClockTick) previousOnClockTick();
    if (tempoSync.grainDuration || tempoSync.density || tempoSync.scanSpeed) {
      applyTempoSync();
    }
  };
}

wireTempoSync();