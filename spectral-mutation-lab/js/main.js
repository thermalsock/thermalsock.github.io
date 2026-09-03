import { AudioEngine } from "./audioEngine.js";

import { MidiManager } from "./midi.js";

import { PresetStore, PRESET_CATEGORIES } from "./presets.js";

import { SpectrogramView } from "./spectrogramView.js";

import { Knob, getKnob, getKnobValue, setKnobValue } from "./knobControl.js";

const $ = id => document.getElementById(id);

const audioEngine = new AudioEngine;

const midi = new MidiManager;

const presetStore = new PresetStore;

let spectrogramView = null;

const TARGETS = [ {
  id: "freezeMix",
  label: "Freeze Mix",
  min: 0,
  max: 1
}, {
  id: "morphAB",
  label: "A/B Morph",
  min: 0,
  max: 1
}, {
  id: "shiftSemi",
  label: "Shift",
  min: -24,
  max: 24
}, {
  id: "reverseAmt",
  label: "Reverse",
  min: 0,
  max: 1
}, {
  id: "smearAmt",
  label: "Smear",
  min: 0,
  max: 1
}, {
  id: "scatterAmt",
  label: "Scatter",
  min: 0,
  max: 1
}, {
  id: "dryWet",
  label: "Dry / Wet",
  min: 0,
  max: 1
}, {
  id: "outputGain",
  label: "Output Gain",
  min: 0,
  max: 4
} ];

const discrete = {
  monoInput: true,
  limiter: true,
  freezeA: false,
  freezeB: false
};

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
  } catch (err) {}
}

populateDevices();

$("startBtn").addEventListener("click", async () => {
  const deviceId = $("deviceSelect").value || null;
  $("startBtn").disabled = true;
  $("startBtn").textContent = "Starting…";
  try {
    const {sampleRate: sampleRate} = await audioEngine.start(deviceId);
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
  wireSpectralControls();
  wirePerformanceControls();
  spectrogramView = new SpectrogramView($("spectrogramCanvas"));
  audioEngine.onMeter = msg => {
    spectrogramView.pushSpectrum(msg.spectrum);
    spectrogramView.setFreezeState(msg.hasFrozenA, msg.hasFrozenB);
    $("footerCpu").textContent = `${Math.round(msg.cpuLoad * 100)}%`;
  };
  wireToggleChips();
  wireMidiPanel();
  wirePresetsPanel();
  syncDiscreteStateToWorklet();
  $("freezeAToggle").addEventListener("click", () => toggleFreeze("freezeA", "freezeAToggle"));
  $("freezeBToggle").addEventListener("click", () => toggleFreeze("freezeB", "freezeBToggle"));
  midi.init().then(ok => {
    if (!ok) $("midiDeviceList").innerHTML = "<li>Web MIDI unavailable in this browser</li>";
  });
  wireMidiCallbacks();
  requestAnimationFrame(loop);
  $("footerWorklet").textContent = "running";
}

function toggleFreeze(key, pillId) {
  discrete[key] = !discrete[key];
  audioEngine.send(key, discrete[key]);
  $(pillId).classList.toggle("on", discrete[key]);
  const chip = document.querySelector(`.toggle-chip[data-toggle="${key}"]`);
  if (chip) chip.classList.toggle("on", discrete[key]);
}

function syncDiscreteStateToWorklet() {
  audioEngine.send("monoInput", discrete.monoInput);
  audioEngine.send("limiter", discrete.limiter);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mountIdFor(targetId) {
  return `knob${capitalize(targetId)}`;
}

function buildTargetKnob(targetId, opts = {}) {
  const t = TARGETS.find(x => x.id === targetId);
  const mount = $(mountIdFor(targetId));
  if (!t || !mount) return null;
  return new Knob(mount, {
    id: targetId,
    min: t.min,
    max: t.max,
    step: opts.step ?? (t.max - t.min) / 200,
    value: opts.value ?? (t.min + t.max) / 2,
    defaultValue: opts.defaultValue ?? opts.value,
    format: opts.format || (v => v.toFixed(2)),
    onChange: v => audioEngine.setParamImmediate(targetId, v)
  });
}

function wireSpectralControls() {
  buildTargetKnob("freezeMix", {
    value: 0,
    defaultValue: 0,
    step: .01,
    format: v => v.toFixed(2)
  });
  buildTargetKnob("morphAB", {
    value: .5,
    defaultValue: .5,
    step: .01,
    format: v => v.toFixed(2)
  });
  buildTargetKnob("shiftSemi", {
    value: 0,
    defaultValue: 0,
    step: 1,
    format: v => `${v >= 0 ? "+" : ""}${Math.round(v)}st`
  });
  buildTargetKnob("reverseAmt", {
    value: 0,
    defaultValue: 0,
    step: .01,
    format: v => v.toFixed(2)
  });
  buildTargetKnob("smearAmt", {
    value: 0,
    defaultValue: 0,
    step: .01,
    format: v => v.toFixed(2)
  });
  buildTargetKnob("scatterAmt", {
    value: 0,
    defaultValue: 0,
    step: .01,
    format: v => v.toFixed(2)
  });
  $("clearFreezeBtn").addEventListener("click", () => {
    audioEngine.send("clearFreeze", true);
    discrete.freezeA = false;
    discrete.freezeB = false;
    $("freezeAToggle").classList.remove("on");
    $("freezeBToggle").classList.remove("on");
    document.querySelectorAll('.toggle-chip[data-toggle="freezeA"], .toggle-chip[data-toggle="freezeB"]').forEach(c => c.classList.remove("on"));
  });
}

function wireToggleChips() {
  document.querySelectorAll(".toggle-chip").forEach(chip => {
    const key = chip.dataset.toggle;
    if (key === "freezeA" || key === "freezeB") {
      chip.addEventListener("click", () => toggleFreeze(key, key === "freezeA" ? "freezeAToggle" : "freezeBToggle"));
      return;
    }
    chip.addEventListener("click", () => {
      discrete[key] = !discrete[key];
      chip.classList.toggle("on", discrete[key]);
      audioEngine.send(key, discrete[key]);
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
  buildTargetKnob("outputGain", {
    value: 1.6,
    defaultValue: 1.6,
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
  xAxisSelect.value = "freezeMix";
  yAxisSelect.value = "morphAB";
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
      audioEngine.setParamImmediate(xTarget.id, v);
      setKnobValue(xTarget.id, v);
    }
    if (yTarget) {
      const v = yTarget.min + (1 - ny) * (yTarget.max - yTarget.min);
      audioEngine.setParamImmediate(yTarget.id, v);
      setKnobValue(yTarget.id, v);
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
  dot.style.left = "0%";
  dot.style.top = "50%";
}

function wireMidiPanel() {
  const modSelect = $("modWheelTargetSelect");
  const atSelect = $("aftertouchTargetSelect");
  const noneOpt1 = document.createElement("option");
  noneOpt1.value = "";
  noneOpt1.textContent = "(none)";
  modSelect.appendChild(noneOpt1);
  const noneOpt2 = document.createElement("option");
  noneOpt2.value = "";
  noneOpt2.textContent = "(none)";
  atSelect.appendChild(noneOpt2);
  for (const t of TARGETS) {
    const o1 = document.createElement("option");
    o1.value = t.id;
    o1.textContent = t.label;
    modSelect.appendChild(o1);
    const o2 = document.createElement("option");
    o2.value = t.id;
    o2.textContent = t.label;
    atSelect.appendChild(o2);
  }
  modSelect.value = "smearAmt";
  atSelect.value = "scatterAmt";
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

function wireMidiCallbacks() {
  midi.onNoteOn = () => {
    if (!$("noteTriggersFreeze").checked) return;
    if (!discrete.freezeA) toggleFreeze("freezeA", "freezeAToggle"); else {
      audioEngine.send("freezeA", false);
      audioEngine.send("freezeA", true);
    }
  };
  midi.onCC = (cc, value01) => {
    if (cc !== 1) return;
    const targetId = $("modWheelTargetSelect").value;
    if (!targetId) return;
    const t = TARGETS.find(x => x.id === targetId);
    if (!t) return;
    const v = t.min + value01 * (t.max - t.min);
    audioEngine.setParamImmediate(targetId, v);
    setKnobValue(targetId, v);
  };
  midi.onAftertouch = value01 => {
    const targetId = $("aftertouchTargetSelect").value;
    if (!targetId) return;
    const t = TARGETS.find(x => x.id === targetId);
    if (!t) return;
    const v = t.min + value01 * (t.max - t.min);
    audioEngine.setParamImmediate(targetId, v);
    setKnobValue(targetId, v);
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
    const name = $("presetNameInput").value.trim() || $("presetSelect").value || "spectral-lab-preset";
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
      console.error("[spectral-lab] preset import failed:", err);
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
  const params = {};
  for (const t of TARGETS) params[t.id] = getKnobValue(t.id);
  params.inputGain = getKnobValue("inputGain");
  return {
    params: params,
    discrete: {
      monoInput: discrete.monoInput,
      limiter: discrete.limiter
    }
  };
}

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
        setKnobValue(k, v);
        audioEngine.setParamImmediate(k, v);
      }
    }
  }
  if (state.discrete) {
    Object.assign(discrete, state.discrete);
    audioEngine.send("monoInput", discrete.monoInput);
    audioEngine.send("limiter", discrete.limiter);
    document.querySelectorAll(".toggle-chip").forEach(chip => {
      const key = chip.dataset.toggle;
      if (key in discrete) chip.classList.toggle("on", !!discrete[key]);
    });
  }
}

function loop(nowMs) {
  if (spectrogramView) {
    spectrogramView.draw();
    $("footerWorklet").textContent = audioEngine.isRunning ? "running" : "suspended";
  }
  tickLfos(typeof nowMs === "number" ? nowMs : performance.now());
  requestAnimationFrame(loop);
}

const lfos = [ {
  id: 1,
  target: "",
  rate: .15,
  depth: 0,
  shape: "sine",
  phase: 0,
  sh: 0,
  shClock: 0
}, {
  id: 2,
  target: "",
  rate: .4,
  depth: 0,
  shape: "sine",
  phase: 0,
  sh: 0,
  shClock: 0
} ];

function lfoValue(lfo, dt) {
  lfo.phase += dt * lfo.rate;
  if (lfo.phase > 1) lfo.phase -= Math.floor(lfo.phase);
  switch (lfo.shape) {
   case "triangle":
    return 1 - 4 * Math.abs(lfo.phase - .5);

   case "ramp":
    return lfo.phase * 2 - 1;

   case "random":
    lfo.shClock += dt * lfo.rate;
    if (lfo.shClock >= 1) {
      lfo.shClock -= Math.floor(lfo.shClock);
      lfo.sh = Math.random() * 2 - 1;
    }
    return lfo.sh;

   case "sine":
   default:
    return Math.sin(lfo.phase * Math.PI * 2);
  }
}

let lastLfoTime = 0;

function tickLfos(nowMs) {
  if (!lastLfoTime) {
    lastLfoTime = nowMs;
    return;
  }
  const dt = Math.min(.1, (nowMs - lastLfoTime) / 1e3);
  lastLfoTime = nowMs;
  for (const lfo of lfos) {
    if (!lfo.target || lfo.depth <= 0) continue;
    const t = TARGETS.find(x => x.id === lfo.target);
    if (!t) continue;
    const bipolar = lfoValue(lfo, dt);
    const mid = (t.min + t.max) / 2;
    const halfRange = (t.max - t.min) / 2;
    const v = mid + bipolar * halfRange * lfo.depth;
    audioEngine.setParamImmediate(lfo.target, v);
    setKnobValue(lfo.target, v);
  }
}

function wireModulationPanel() {
  lfos.forEach(lfo => {
    const sel = $(`lfo${lfo.id}Target`);
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "(none)";
    sel.appendChild(none);
    for (const t of TARGETS) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.label;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
      lfo.target = sel.value;
    });
    const rate = $(`lfo${lfo.id}Rate`);
    const rateOut = $(`lfo${lfo.id}RateReadout`);
    rate.addEventListener("input", () => {
      lfo.rate = parseFloat(rate.value);
      rateOut.textContent = `${lfo.rate.toFixed(2)} Hz`;
    });
    const depth = $(`lfo${lfo.id}Depth`);
    const depthOut = $(`lfo${lfo.id}DepthReadout`);
    depth.addEventListener("input", () => {
      lfo.depth = parseFloat(depth.value);
      depthOut.textContent = `${Math.round(lfo.depth * 100)}%`;
    });
    const shape = $(`lfo${lfo.id}Shape`);
    shape.addEventListener("change", () => {
      lfo.shape = shape.value;
    });
  });
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

function toggleRecording() {
  if (recorder && recorder.recording) {
    recorder.stop();
    if (!recorder.download("spectral-lab")) {
      console.warn("[spectral-mutation-lab] nothing captured — recording was too short");
    }
    recorder = null;
    updateRecordUi(false);
    return;
  }
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
    console.error("[spectral-mutation-lab] could not start recording:", err);
    updateRecordUi(false);
  });
}

async function loadSampleFile(file) {
  if (!audioEngine.audioCtx) return;
  const status = $("statusText");
  const previous = status.textContent;
  status.textContent = "Decoding…";
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioEngine.audioCtx.decodeAudioData(arrayBuffer);
    audioEngine.playSample(audioBuffer);
    status.textContent = `Sample: ${file.name.slice(0, 24)}`;
    $("footerSource") && ($("footerSource").textContent = file.name);
  } catch (err) {
    console.error("[spectral-mutation-lab] sample decode failed:", err);
    status.textContent = previous;
  }
}

function wireSpectralExtras() {
  const recBtn = $("recordBtn");
  if (recBtn) recBtn.addEventListener("click", toggleRecording);
  const loadBtn = $("loadSampleBtn");
  if (loadBtn) loadBtn.addEventListener("click", () => $("sampleFileInput").click());
  const fileInput = $("sampleFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) loadSampleFile(file);
      e.target.value = "";
    });
  }
  const wrap = $("spectrogramWrap");
  if (wrap) {
    let depth = 0;
    wrap.addEventListener("dragenter", e => {
      e.preventDefault();
      depth++;
      wrap.classList.add("drag-over");
    });
    wrap.addEventListener("dragover", e => e.preventDefault());
    wrap.addEventListener("dragleave", e => {
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) wrap.classList.remove("drag-over");
    });
    wrap.addEventListener("drop", e => {
      e.preventDefault();
      depth = 0;
      wrap.classList.remove("drag-over");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadSampleFile(file);
    });
  }
  const STAGE_PARAMS = {
    freezeStage: [ "freezeMix" ],
    shiftStage: [ "shiftSemi" ],
    reverseStage: [ "reverseAmt" ],
    smearStage: [ "smearAmt" ],
    scatterStage: [ "scatterAmt" ]
  };
  const stashed = {};
  document.querySelectorAll(".stage-bypass").forEach(btn => {
    const stageId = btn.getAttribute("data-stage-toggle");
    btn.addEventListener("click", () => {
      const section = document.querySelector(`[data-stage="${stageId}"]`);
      const bypassed = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", bypassed ? "true" : "false");
      if (section) section.setAttribute("data-bypassed", bypassed ? "true" : "false");
      (STAGE_PARAMS[stageId] || []).forEach(param => {
        if (bypassed) {
          stashed[param] = getKnobValue(param);
          audioEngine.setParamImmediate(param, 0);
        } else if (stashed[param] !== undefined) {
          audioEngine.setParamImmediate(param, stashed[param]);
          setKnobValue(param, stashed[param]);
        }
      });
    });
  });
  const expandBtn = $("expandViewBtn");
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      const on = document.body.getAttribute("data-maximised") !== "true";
      document.body.setAttribute("data-maximised", on ? "true" : "false");
      expandBtn.setAttribute("aria-pressed", on ? "true" : "false");
      expandBtn.textContent = on ? "Restore" : "Maximise";
      if (spectrogramView && spectrogramView.resize) spectrogramView.resize();
    });
  }
  if (window.TSShortcuts) {
    window.TSShortcuts.register([ {
      keys: "a",
      group: "Performance",
      label: "Capture / release Freeze A",
      run: () => $("freezeAToggle").click()
    }, {
      keys: "s",
      group: "Performance",
      label: "Capture / release Freeze B",
      run: () => $("freezeBToggle").click()
    }, {
      keys: "c",
      group: "Performance",
      label: "Clear the frozen spectrum",
      run: () => $("clearFreezeBtn").click()
    }, {
      keys: "r",
      group: "Performance",
      label: "Start / stop recording to WAV",
      run: toggleRecording
    }, {
      keys: "v",
      group: "Display",
      label: "Maximise / restore the spectrogram",
      run: () => $("expandViewBtn") && $("expandViewBtn").click()
    }, {
      keys: "l",
      group: "Source",
      label: "Load a sample to mutate",
      run: () => $("loadSampleBtn").click()
    }, {
      keys: "?",
      group: "General",
      label: "Show this help"
    } ]);
  }
}

wireModulationPanel();

wireSpectralExtras();