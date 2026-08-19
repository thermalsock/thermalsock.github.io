// main.js — Thermalsock Spectral Mutation Lab
// Simpler wiring than the Granulator: no modulation-matrix layer here, so
// every knob talks directly to the AudioWorkletNode's params. The XY pad
// and MIDI convenience mappings write straight into those same params too,
// with the knob display kept in sync via setKnobValue().

import { AudioEngine } from './audioEngine.js';
import { MidiManager } from './midi.js';
import { PresetStore, PRESET_CATEGORIES } from './presets.js';
import { SpectrogramView } from './spectrogramView.js';
import { Knob, getKnob, getKnobValue, setKnobValue } from './knobControl.js';

const $ = (id) => document.getElementById(id);

const audioEngine = new AudioEngine();
const midi = new MidiManager();
const presetStore = new PresetStore();
let spectrogramView = null;

// Every knob-controlled AudioParam, described once so the XY pad axis
// selects, MIDI convenience-mapping selects, and preset capture/restore can
// all iterate over the same list instead of hardcoding it three times.
const TARGETS = [
  { id: 'freezeMix', label: 'Freeze Mix', min: 0, max: 1 },
  { id: 'morphAB', label: 'A/B Morph', min: 0, max: 1 },
  { id: 'shiftSemi', label: 'Shift', min: -24, max: 24 },
  { id: 'reverseAmt', label: 'Reverse', min: 0, max: 1 },
  { id: 'smearAmt', label: 'Smear', min: 0, max: 1 },
  { id: 'scatterAmt', label: 'Scatter', min: 0, max: 1 },
  { id: 'dryWet', label: 'Dry / Wet', min: 0, max: 1 },
  { id: 'outputGain', label: 'Output Gain', min: 0, max: 4 },
];

const discrete = {
  monoInput: true,
  limiter: true,
  freezeA: false,
  freezeB: false,
};

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
  } catch (err) {
    // enumerateDevices without prior permission may throw in some browsers; non-fatal.
  }
}
populateDevices();

$('startBtn').addEventListener('click', async () => {
  const deviceId = $('deviceSelect').value || null;
  $('startBtn').disabled = true;
  $('startBtn').textContent = 'Starting…';
  try {
    const { sampleRate } = await audioEngine.start(deviceId);
    $('footerSampleRate').textContent = `${(sampleRate / 1000).toFixed(1)} kHz`;
    $('gate').hidden = true;
    $('app').hidden = false;
    boot();
  } catch (err) {
    console.error(err);
    $('gateError').hidden = false;
    $('gateError').textContent = err.name === 'NotAllowedError'
      ? 'Microphone / input access was denied. Grant permission and try again.'
      : `Could not start the audio engine: ${err.message || err}`;
    $('startBtn').disabled = false;
    $('startBtn').textContent = 'Start engine';
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  wireSpectralControls();
  wirePerformanceControls();

  spectrogramView = new SpectrogramView($('spectrogramCanvas'));

  audioEngine.onMeter = (msg) => {
    spectrogramView.pushSpectrum(msg.spectrum);
    spectrogramView.setFreezeState(msg.hasFrozenA, msg.hasFrozenB);
    $('footerCpu').textContent = `${Math.round(msg.cpuLoad * 100)}%`;
  };

  wireToggleChips();
  wireMidiPanel();
  wirePresetsPanel();
  syncDiscreteStateToWorklet();

  $('freezeAToggle').addEventListener('click', () => toggleFreeze('freezeA', 'freezeAToggle'));
  $('freezeBToggle').addEventListener('click', () => toggleFreeze('freezeB', 'freezeBToggle'));

  midi.init().then((ok) => {
    if (!ok) $('midiDeviceList').innerHTML = '<li>Web MIDI unavailable in this browser</li>';
  });
  wireMidiCallbacks();

  requestAnimationFrame(loop);
  $('footerWorklet').textContent = 'running';
}

function toggleFreeze(key, pillId) {
  discrete[key] = !discrete[key];
  audioEngine.send(key, discrete[key]);
  $(pillId).classList.toggle('on', discrete[key]);
  const chip = document.querySelector(`.toggle-chip[data-toggle="${key}"]`);
  if (chip) chip.classList.toggle('on', discrete[key]);
}

function syncDiscreteStateToWorklet() {
  audioEngine.send('monoInput', discrete.monoInput);
  audioEngine.send('limiter', discrete.limiter);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function mountIdFor(targetId) { return `knob${capitalize(targetId)}`; }

// ---------------------------------------------------------------------------
// Spectral engine controls
// ---------------------------------------------------------------------------

function buildTargetKnob(targetId, opts = {}) {
  const t = TARGETS.find((x) => x.id === targetId);
  const mount = $(mountIdFor(targetId));
  if (!t || !mount) return null;
  return new Knob(mount, {
    id: targetId,
    min: t.min,
    max: t.max,
    step: opts.step ?? (t.max - t.min) / 200,
    value: opts.value ?? (t.min + t.max) / 2,
    defaultValue: opts.defaultValue ?? opts.value,
    format: opts.format || ((v) => v.toFixed(2)),
    onChange: (v) => audioEngine.setParamImmediate(targetId, v),
  });
}

function wireSpectralControls() {
  buildTargetKnob('freezeMix', { value: 0, defaultValue: 0, step: 0.01, format: (v) => v.toFixed(2) });
  buildTargetKnob('morphAB', { value: 0.5, defaultValue: 0.5, step: 0.01, format: (v) => v.toFixed(2) });
  buildTargetKnob('shiftSemi', { value: 0, defaultValue: 0, step: 1, format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}st` });
  buildTargetKnob('reverseAmt', { value: 0, defaultValue: 0, step: 0.01, format: (v) => v.toFixed(2) });
  buildTargetKnob('smearAmt', { value: 0, defaultValue: 0, step: 0.01, format: (v) => v.toFixed(2) });
  buildTargetKnob('scatterAmt', { value: 0, defaultValue: 0, step: 0.01, format: (v) => v.toFixed(2) });

  $('clearFreezeBtn').addEventListener('click', () => {
    audioEngine.send('clearFreeze', true);
    discrete.freezeA = false; discrete.freezeB = false;
    $('freezeAToggle').classList.remove('on');
    $('freezeBToggle').classList.remove('on');
    document.querySelectorAll('.toggle-chip[data-toggle="freezeA"], .toggle-chip[data-toggle="freezeB"]').forEach((c) => c.classList.remove('on'));
  });
}

function wireToggleChips() {
  document.querySelectorAll('.toggle-chip').forEach((chip) => {
    const key = chip.dataset.toggle;
    if (key === 'freezeA' || key === 'freezeB') {
      chip.addEventListener('click', () => toggleFreeze(key, key === 'freezeA' ? 'freezeAToggle' : 'freezeBToggle'));
      return;
    }
    chip.addEventListener('click', () => {
      discrete[key] = !discrete[key];
      chip.classList.toggle('on', discrete[key]);
      audioEngine.send(key, discrete[key]);
    });
  });
}

// ---------------------------------------------------------------------------
// Performance controls: XY pad + mix knobs
// ---------------------------------------------------------------------------

function wirePerformanceControls() {
  buildTargetKnob('dryWet', { value: 1, defaultValue: 1, step: 0.01, format: (v) => v.toFixed(2) });
  buildTargetKnob('outputGain', { value: 1.6, defaultValue: 1.6, step: 0.01, format: (v) => v.toFixed(2) });

  new Knob($('knobInputGain'), {
    id: 'inputGain', min: 0, max: 4, step: 0.01, value: 1, defaultValue: 1,
    format: (v) => v.toFixed(2),
    onChange: (v) => audioEngine.setParam('inputGain', v),
  });

  const xAxisSelect = $('xyAxisX');
  const yAxisSelect = $('xyAxisY');
  for (const t of TARGETS) {
    const optX = document.createElement('option'); optX.value = t.id; optX.textContent = t.label;
    xAxisSelect.appendChild(optX);
    const optY = document.createElement('option'); optY.value = t.id; optY.textContent = t.label;
    yAxisSelect.appendChild(optY);
  }
  xAxisSelect.value = 'freezeMix';
  yAxisSelect.value = 'morphAB';

  const pad = $('xyPad');
  const dot = $('xyPadDot');
  let dragging = false;

  function applyXY(clientX, clientY) {
    const rect = pad.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    dot.style.left = `${nx * 100}%`;
    dot.style.top = `${ny * 100}%`;

    const xTarget = TARGETS.find((t) => t.id === xAxisSelect.value);
    const yTarget = TARGETS.find((t) => t.id === yAxisSelect.value);
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

  pad.addEventListener('pointerdown', (e) => { dragging = true; pad.setPointerCapture(e.pointerId); applyXY(e.clientX, e.clientY); });
  pad.addEventListener('pointermove', (e) => { if (dragging) applyXY(e.clientX, e.clientY); });
  pad.addEventListener('pointerup', () => { dragging = false; });
  dot.style.left = '0%';
  dot.style.top = '50%';
}

// ---------------------------------------------------------------------------
// MIDI panel
// ---------------------------------------------------------------------------

function wireMidiPanel() {
  const modSelect = $('modWheelTargetSelect');
  const atSelect = $('aftertouchTargetSelect');
  const noneOpt1 = document.createElement('option'); noneOpt1.value = ''; noneOpt1.textContent = '(none)';
  modSelect.appendChild(noneOpt1);
  const noneOpt2 = document.createElement('option'); noneOpt2.value = ''; noneOpt2.textContent = '(none)';
  atSelect.appendChild(noneOpt2);
  for (const t of TARGETS) {
    const o1 = document.createElement('option'); o1.value = t.id; o1.textContent = t.label;
    modSelect.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = t.id; o2.textContent = t.label;
    atSelect.appendChild(o2);
  }
  modSelect.value = 'smearAmt';
  atSelect.value = 'scatterAmt';

  midi.onDeviceChange = (inputs) => {
    const list = $('midiDeviceList');
    list.innerHTML = '';
    if (inputs.length === 0) { list.innerHTML = '<li>No devices connected</li>'; return; }
    inputs.forEach((inp) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${inp.name || 'MIDI device'}</span><span style="color:var(--accent)">connected</span>`;
      list.appendChild(li);
    });
  };
}

function wireMidiCallbacks() {
  midi.onNoteOn = () => {
    if (!$('noteTriggersFreeze').checked) return;
    if (!discrete.freezeA) toggleFreeze('freezeA', 'freezeAToggle');
    else {
      // Already frozen — a fresh note re-captures a new snapshot into A.
      audioEngine.send('freezeA', false);
      audioEngine.send('freezeA', true);
    }
  };
  midi.onCC = (cc, value01) => {
    if (cc !== 1) return; // mod wheel
    const targetId = $('modWheelTargetSelect').value;
    if (!targetId) return;
    const t = TARGETS.find((x) => x.id === targetId);
    if (!t) return;
    const v = t.min + value01 * (t.max - t.min);
    audioEngine.setParamImmediate(targetId, v);
    setKnobValue(targetId, v);
  };
  midi.onAftertouch = (value01) => {
    const targetId = $('aftertouchTargetSelect').value;
    if (!targetId) return;
    const t = TARGETS.find((x) => x.id === targetId);
    if (!t) return;
    const v = t.min + value01 * (t.max - t.min);
    audioEngine.setParamImmediate(targetId, v);
    setKnobValue(targetId, v);
  };
}

// ---------------------------------------------------------------------------
// Presets panel
// ---------------------------------------------------------------------------

function wirePresetsPanel() {
  const categorySelect = $('presetCategory');
  PRESET_CATEGORIES.forEach((c) => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    categorySelect.appendChild(o);
  });
  categorySelect.addEventListener('change', refreshPresetSelect);
  refreshPresetSelect();

  $('presetSelect').addEventListener('change', () => {
    const p = presetStore.get($('presetSelect').value);
    if (p) applyState(p.state);
  });

  $('savePresetBtn').addEventListener('click', () => {
    const name = $('presetNameInput').value.trim();
    if (!name) return;
    presetStore.save(name, categorySelect.value, captureState());
    refreshPresetSelect();
    $('presetNameInput').value = '';
  });

  $('deletePresetBtn').addEventListener('click', () => {
    const name = $('presetSelect').value;
    if (name) { presetStore.delete(name); refreshPresetSelect(); }
  });

  $('exportPresetBtn').addEventListener('click', () => {
    const name = $('presetNameInput').value.trim() || $('presetSelect').value || 'spectral-lab-preset';
    presetStore.exportJSON(captureState(), name);
  });

  $('exportBankBtn').addEventListener('click', () => presetStore.exportAllJSON());

  $('importPresetInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await presetStore.importJSONFile(file);
      refreshPresetSelect();
    } catch (err) {
      console.error('[spectral-lab] preset import failed:', err);
    }
    e.target.value = '';
  });

  const snapshotBank = $('snapshotBank');
  ['A', 'B', 'C', 'D'].forEach((slot) => {
    const btn = document.createElement('div');
    btn.className = 'snapshot-btn';
    btn.innerHTML = `<strong>${slot}</strong><span class="snap-hint">click: recall</span>`;
    btn.addEventListener('click', () => {
      const state = presetStore.getSnapshot(slot);
      if (state) applyState(state);
    });
    btn.addEventListener('dblclick', () => {
      presetStore.saveSnapshot(slot, captureState());
      btn.querySelector('.snap-hint').textContent = 'saved!';
      setTimeout(() => { btn.querySelector('.snap-hint').textContent = 'click: recall'; }, 900);
    });
    btn.title = 'Click to recall, double-click to save this snapshot';
    snapshotBank.appendChild(btn);
  });
}

function refreshPresetSelect() {
  const category = $('presetCategory').value;
  const select = $('presetSelect');
  select.innerHTML = '';
  presetStore.list(category || null).forEach((p) => {
    const o = document.createElement('option'); o.value = p.name; o.textContent = p.name;
    select.appendChild(o);
  });
}

function captureState() {
  const params = {};
  for (const t of TARGETS) params[t.id] = getKnobValue(t.id);
  params.inputGain = getKnobValue('inputGain');
  return { params, discrete: { monoInput: discrete.monoInput, limiter: discrete.limiter } };
}

function applyState(state) {
  if (!state) return;
  if (state.params) {
    for (const [k, v] of Object.entries(state.params)) {
      if (k === 'inputGain') { setKnobValue('inputGain', v); audioEngine.setParam('inputGain', v); continue; }
      if (TARGETS.find((t) => t.id === k)) {
        setKnobValue(k, v);
        audioEngine.setParamImmediate(k, v);
      }
    }
  }
  if (state.discrete) {
    Object.assign(discrete, state.discrete);
    audioEngine.send('monoInput', discrete.monoInput);
    audioEngine.send('limiter', discrete.limiter);
    document.querySelectorAll('.toggle-chip').forEach((chip) => {
      const key = chip.dataset.toggle;
      if (key in discrete) chip.classList.toggle('on', !!discrete[key]);
    });
  }
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function loop() {
  if (spectrogramView) {
    spectrogramView.draw();
    $('footerWorklet').textContent = audioEngine.isRunning ? 'running' : 'suspended';
  }
  requestAnimationFrame(loop);
}
