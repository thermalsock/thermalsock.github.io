import { AudioEngine } from "./audioEngine.js";

import { TriggerEngine, TriggerMode } from "./triggerEngine.js";

import { Renderer } from "./renderer.js";

import { themes, defaultThemeId } from "./themes.js";

import { measureVpp, measureRms, measureFrequency, formatHz, formatMs, computeChroma, NOTE_NAMES, findSpectralPeaks, freqToNote, tagHarmonics, computeHarmonicBalance } from "./measurements.js";

import { MATH_OPS, computeMathChannel, computeMagnitudeSpectrumDb } from "./mathChannels.js";

const els = {
  gate: document.getElementById("gate"),
  app: document.getElementById("app"),
  deviceSelect: document.getElementById("deviceSelect"),
  startBtn: document.getElementById("startBtn"),
  gateError: document.getElementById("gateError"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  canvas: document.getElementById("scopeCanvas"),
  scopeWrap: document.getElementById("scopeWrap"),
  displayMode: document.getElementById("displayMode"),
  themeSelect: document.getElementById("themeSelect"),
  chBToggle: document.getElementById("chBToggle"),
  triggerMode: document.getElementById("triggerMode"),
  triggerSlope: document.getElementById("triggerSlope"),
  triggerLevel: document.getElementById("triggerLevel"),
  singleShotBtn: document.getElementById("singleShotBtn"),
  vScale: document.getElementById("vScale"),
  cursorsToggle: document.getElementById("cursorsToggle"),
  cursorDeltaT: document.getElementById("cursorDeltaT"),
  cursorFreq: document.getElementById("cursorFreq"),
  cursorDeltaV: document.getElementById("cursorDeltaV"),
  triggerStatus: document.getElementById("triggerStatus"),
  measVpp: document.getElementById("measVpp"),
  measRms: document.getElementById("measRms"),
  measFreq: document.getElementById("measFreq"),
  measPeriod: document.getElementById("measPeriod"),
  measPeakFreq: document.getElementById("measPeakFreq"),
  heroLabel: document.getElementById("heroLabel"),
  heroValueNum: document.getElementById("heroValueNum"),
  heroUnit: document.getElementById("heroUnit"),
  heroSub: document.getElementById("heroSub"),
  overlayBlendToggle: document.getElementById("overlayBlendToggle"),
  msModeToggle: document.getElementById("msModeToggle"),
  mathOpSelect: document.getElementById("mathOpSelect"),
  spectrumSourceSelect: document.getElementById("spectrumSourceSelect"),
  chBDelay: document.getElementById("chBDelay"),
  chBDelayReadout: document.getElementById("chBDelayReadout"),
  corrReadout: document.getElementById("corrReadout"),
  corrFill: document.getElementById("corrFill"),
  corrNeedle: document.getElementById("corrNeedle"),
  widthReadout: document.getElementById("widthReadout"),
  widthFill: document.getElementById("widthFill"),
  phaseReadout: document.getElementById("phaseReadout"),
  phaseNeedle: document.getElementById("phaseNeedle"),
  timebase: document.getElementById("timebase"),
  timePerDivReadout: document.getElementById("timePerDivReadout"),
  windowSpanReadout: document.getElementById("windowSpanReadout"),
  vScaleReadout: document.getElementById("vScaleReadout"),
  triggerLevelReadout: document.getElementById("triggerLevelReadout"),
  freezeBtn: document.getElementById("freezeBtn"),
  exportPngBtn: document.getElementById("exportPngBtn"),
  reopenGateBtn: document.getElementById("reopenGateBtn")
};

const store = window.TSStore ? window.TSStore.create("oscilloscope") : null;

const saveSettings = () => {
  if (!store) return;
  store.set("settings", {
    displayMode: els.displayMode.value,
    theme: els.themeSelect.value,
    chB: els.chBToggle.checked,
    triggerMode: els.triggerMode.value,
    triggerSlope: els.triggerSlope.value,
    triggerLevel: els.triggerLevel.value,
    vScale: els.vScale.value,
    timebase: els.timebase.value,
    cursors: els.cursorsToggle.checked,
    overlayBlend: els.overlayBlendToggle.checked,
    msMode: els.msModeToggle.checked,
    chBDelay: els.chBDelay.value,
    mathOp: els.mathOpSelect.value,
    spectrumSource: els.spectrumSourceSelect.value
  });
};

const MODE_LABELS = {
  time: "Time Domain",
  xy: "XY / Lissajous",
  spectrum: "FFT / Spectrum",
  spectrogram: "Spectrogram",
  chromagram: "Chromagram",
  harmonics: "Harmonics / Tuner",
  balance: "Harmonic Balance"
};

const audioEngine = new AudioEngine({
  fftSize: 4096
});

const triggerEngine = new TriggerEngine;

const renderer = new Renderer(els.canvas);

const DEFAULT_GAIN = 2.5;

let displayMode = "time";

let showChannelB = true;

let showCursors = false;

let overlayBlend = false;

let msMode = false;

let mathOp = "chB";

let spectrumSource = "chA";

let chBDelaySamples = 0;

let lastFrameA = null;

let lastFrameB = null;

let rafId = null;

const chromaSmooth = new Float32Array(12);

let balanceSmooth = {
  oddRatio: .5,
  thdPercent: 0
};

const stereoMeterSmooth = {
  correlation: 0,
  widthPercent: 0,
  phaseAngleDeg: 0
};

const cursors = {
  vA: null,
  vB: null,
  hA: null,
  hB: null
};

let draggingCursor = null;

const CURSOR_HIT_RADIUS = 8;

function populateThemes() {
  els.themeSelect.innerHTML = "";
  Object.values(themes).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    els.themeSelect.appendChild(opt);
  });
  els.themeSelect.value = defaultThemeId;
  renderer.setTheme(themes[defaultThemeId]);
}

populateThemes();

els.themeSelect.addEventListener("change", () => {
  renderer.setTheme(themes[els.themeSelect.value]);
  saveSettings();
});

function populateMathOps() {
  els.mathOpSelect.innerHTML = "";
  MATH_OPS.forEach(op => {
    const opt = document.createElement("option");
    opt.value = op.id;
    opt.textContent = op.label;
    els.mathOpSelect.appendChild(opt);
  });
  els.mathOpSelect.value = mathOp;
}

populateMathOps();

els.mathOpSelect.addEventListener("change", () => {
  mathOp = els.mathOpSelect.value;
});

els.spectrumSourceSelect.addEventListener("change", () => {
  spectrumSource = els.spectrumSourceSelect.value;
});

els.overlayBlendToggle.addEventListener("change", () => {
  overlayBlend = els.overlayBlendToggle.checked;
});

els.msModeToggle.addEventListener("change", () => {
  msMode = els.msModeToggle.checked;
});

els.chBDelay.addEventListener("input", () => {
  chBDelaySamples = parseInt(els.chBDelay.value, 10);
  els.chBDelayReadout.textContent = `${chBDelaySamples >= 0 ? "+" : ""}${chBDelaySamples} smp`;
});

async function populateDevices() {
  try {
    const devices = await AudioEngine.listInputDevices();
    els.deviceSelect.innerHTML = '<option value="">Default input</option>';
    devices.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Input ${i + 1}`;
      els.deviceSelect.appendChild(opt);
    });
    const sharedIn = window.TSDevices && window.TSDevices.audioInput();
    if (sharedIn && [ ...els.deviceSelect.options ].some(o => o.value === sharedIn.deviceId)) {
      els.deviceSelect.value = sharedIn.deviceId;
    }
    els.deviceSelect.addEventListener("change", () => {
      if (window.TSDevices) window.TSDevices.setAudioInput(els.deviceSelect.value || null);
    }, {
      once: false
    });
  } catch (e) {
    console.warn("Could not enumerate devices yet:", e);
  }
}

populateDevices();

function showError(message) {
  els.gateError.textContent = message;
  els.gateError.hidden = false;
}

function friendlyErrorMessage(err) {
  if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
    return "Microphone/input access was denied. Check your browser’s site permissions and try again.";
  }
  if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
    return "No audio input device was found. Plug in an interface or microphone and try again.";
  }
  if (err.name === "NotReadableError") {
    return "The selected input is already in use by another application.";
  }
  return `Could not start capture: ${err.message || err.name || "unknown error"}`;
}

els.startBtn.addEventListener("click", async () => {
  console.log("[oscilloscope] Start capture clicked");
  els.startBtn.disabled = true;
  els.startBtn.textContent = "Requesting permission…";
  els.gateError.hidden = true;
  try {
    const deviceId = els.deviceSelect.value || null;
    console.log("[oscilloscope] Calling getUserMedia, deviceId =", deviceId || "(default)");
    const {channelCount: channelCount} = await audioEngine.start(deviceId);
    console.log("[oscilloscope] Capture started:", {
      channelCount: channelCount,
      sampleRate: audioEngine.sampleRate
    });
    audioEngine.setGain(DEFAULT_GAIN);
    els.chBToggle.disabled = channelCount < 2;
    if (channelCount < 2) {
      els.chBToggle.checked = false;
      showChannelB = false;
    }
    els.gate.hidden = true;
    els.app.hidden = false;
    els.startBtn.disabled = false;
    els.startBtn.textContent = "Start listening";
    els.statusDot.classList.add("live");
    els.statusText.textContent = `Running — ${audioEngine.sampleRate} Hz, ${channelCount} ch`;
    renderer.resize();
    window.addEventListener("resize", () => renderer.resize());
    applyTimebase(parseInt(els.timebase.value, 10));
    setFrozen(false);
    startLoop();
    setTimeout(() => {
      const cmp = audioEngine.compareChannels();
      if (!cmp) return;
      if (cmp.likelyIdentical) {
        console.warn("[oscilloscope] Channels A and B look identical (max sample diff:", cmp.maxDiff.toFixed(6), ", correlation:", cmp.correlation?.toFixed(4), "). This usually means the OS/interface is sending the same mono " + "signal to both channels, not a bug in this app’s channel splitting. " + "Check: (1) the correct stereo input device is selected above, not " + '"Default input"; (2) your audio interface doesn’t have a MONO/LINK ' + "switch enabled; (3) each oscillator is physically patched into a " + "separate input (1/L and 2/R) on the interface.");
      } else {
        console.log("[oscilloscope] Channels A and B carry distinct signals (correlation:", cmp.correlation?.toFixed(4), ") — stereo separation looks correct.");
      }
    }, 1500);
  } catch (err) {
    console.error("[oscilloscope] Failed to start capture:", err.name, err.message, err);
    showError(friendlyErrorMessage(err));
    els.startBtn.disabled = false;
    els.startBtn.textContent = "Start listening";
  }
});

els.displayMode.addEventListener("change", () => {
  displayMode = els.displayMode.value;
  saveSettings();
});

els.chBToggle.addEventListener("change", () => {
  showChannelB = els.chBToggle.checked;
  saveSettings();
});

els.vScale.addEventListener("input", () => {
  const g = parseFloat(els.vScale.value);
  audioEngine.setGain(g);
  els.vScaleReadout.textContent = `${g.toFixed(1)}×`;
  saveSettings();
});

els.timebase.addEventListener("change", () => {
  applyTimebase(parseInt(els.timebase.value, 10));
  saveSettings();
});

els.cursorsToggle.addEventListener("change", () => {
  showCursors = els.cursorsToggle.checked;
  if (showCursors && cursors.vA == null) {
    cursors.vA = renderer.width * .35;
    cursors.vB = renderer.width * .65;
    cursors.hA = renderer.height * .3;
    cursors.hB = renderer.height * .7;
  }
  saveSettings();
});

function canvasPos(evt) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

els.canvas.addEventListener("mousedown", evt => {
  if (!showCursors || displayMode !== "time" || cursors.vA == null) return;
  const {x: x, y: y} = canvasPos(evt);
  const candidates = [ {
    key: "vA",
    dist: Math.abs(x - cursors.vA)
  }, {
    key: "vB",
    dist: Math.abs(x - cursors.vB)
  }, {
    key: "hA",
    dist: Math.abs(y - cursors.hA)
  }, {
    key: "hB",
    dist: Math.abs(y - cursors.hB)
  } ];
  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates[0].dist <= CURSOR_HIT_RADIUS) {
    draggingCursor = candidates[0].key;
    evt.preventDefault();
  }
});

window.addEventListener("mousemove", evt => {
  if (!draggingCursor) return;
  const {x: x, y: y} = canvasPos(evt);
  if (draggingCursor === "vA" || draggingCursor === "vB") {
    cursors[draggingCursor] = Math.max(0, Math.min(renderer.width, x));
  } else {
    cursors[draggingCursor] = Math.max(0, Math.min(renderer.height, y));
  }
});

window.addEventListener("mouseup", () => {
  draggingCursor = null;
});

els.triggerMode.addEventListener("change", () => {
  triggerEngine.setMode(els.triggerMode.value);
});

els.triggerSlope.addEventListener("change", () => {
  triggerEngine.slope = els.triggerSlope.value;
});

els.triggerLevel.addEventListener("input", () => {
  const lvl = parseFloat(els.triggerLevel.value);
  triggerEngine.level = lvl;
  els.triggerLevelReadout.textContent = lvl.toFixed(2);
  saveSettings();
});

els.singleShotBtn.addEventListener("click", () => {
  els.triggerMode.value = TriggerMode.SINGLE;
  triggerEngine.setMode(TriggerMode.SINGLE);
  triggerEngine.rearm();
});

let WINDOW_SIZE = 1024;

const GRID_DIVISIONS = 10;

function applyTimebase(samples) {
  const max = audioEngine.fftSize || 4096;
  WINDOW_SIZE = Math.max(64, Math.min(samples, max));
  updateTimebaseReadout();
}

function updateTimebaseReadout() {
  const sr = audioEngine.sampleRate;
  if (!sr) {
    els.timePerDivReadout.textContent = "--";
    els.windowSpanReadout.textContent = "--";
    return;
  }
  const spanMs = WINDOW_SIZE / sr * 1e3;
  els.timePerDivReadout.textContent = formatMs(spanMs / GRID_DIVISIONS);
  els.windowSpanReadout.textContent = `${formatMs(spanMs)} · ${WINDOW_SIZE} smp`;
}

function updateMeasurements(frameA) {
  if (!frameA) return;
  const vpp = measureVpp(frameA);
  const rms = measureRms(frameA);
  const freqResult = measureFrequency(frameA, audioEngine.sampleRate);
  els.measVpp.textContent = vpp.toFixed(3);
  els.measRms.textContent = rms.toFixed(3);
  els.measFreq.textContent = freqResult ? formatHz(freqResult.frequencyHz) : "--";
  els.measPeriod.textContent = freqResult ? formatMs(freqResult.periodMs) : "--";
}

function updateTriggerStatus(resultA) {
  els.triggerStatus.classList.remove("trig", "hold", "armed");
  if (triggerEngine.mode === TriggerMode.SINGLE) {
    if (!triggerEngine.armed) {
      els.triggerStatus.textContent = "HELD";
      els.triggerStatus.classList.add("hold");
    } else {
      els.triggerStatus.textContent = "ARMED";
      els.triggerStatus.classList.add("armed");
    }
    return;
  }
  if (resultA.triggered) {
    els.triggerStatus.textContent = "TRIG'D";
    els.triggerStatus.classList.add("trig");
  } else if (resultA.data) {
    els.triggerStatus.textContent = "AUTO (free-run)";
  } else {
    els.triggerStatus.textContent = "HOLD (no trigger)";
    els.triggerStatus.classList.add("hold");
  }
}

function updatePeakFrequency(freqDataA) {
  if (!freqDataA || !audioEngine.sampleRate) {
    els.measPeakFreq.textContent = "--";
    return;
  }
  const binHz = audioEngine.sampleRate / audioEngine.fftSize;
  updatePeakFrequencyFromSpectrum(freqDataA, binHz);
}

function updatePeakFrequencyFromSpectrum(freqData, binHz) {
  if (!freqData) {
    els.measPeakFreq.textContent = "--";
    return;
  }
  let peakIdx = 0;
  let peakDb = -Infinity;
  for (let i = 0; i < freqData.length; i++) {
    if (freqData[i] > peakDb) {
      peakDb = freqData[i];
      peakIdx = i;
    }
  }
  els.measPeakFreq.textContent = formatHz(peakIdx * binHz);
}

function updateStereoMeters(metrics) {
  if (!metrics || metrics.correlation == null) {
    els.corrReadout.textContent = "--";
    els.widthReadout.textContent = "--";
    els.phaseReadout.textContent = "--";
    els.corrFill.style.width = "0%";
    els.corrFill.style.left = "50%";
    els.corrNeedle.style.left = "50%";
    els.widthFill.style.width = "0%";
    els.phaseNeedle.style.transform = "rotate(0deg)";
    return;
  }
  stereoMeterSmooth.correlation += (metrics.correlation - stereoMeterSmooth.correlation) * .25;
  stereoMeterSmooth.widthPercent += (metrics.widthPercent - stereoMeterSmooth.widthPercent) * .25;
  stereoMeterSmooth.phaseAngleDeg += (metrics.phaseAngleDeg - stereoMeterSmooth.phaseAngleDeg) * .25;
  const corr = stereoMeterSmooth.correlation;
  els.corrReadout.textContent = corr.toFixed(2);
  const corrPct = Math.abs(corr) * 50;
  els.corrFill.style.width = `${corrPct}%`;
  els.corrFill.style.left = corr >= 0 ? "50%" : `${50 - corrPct}%`;
  els.corrNeedle.style.left = `${50 + corr * 50}%`;
  const width = Math.max(0, Math.min(100, stereoMeterSmooth.widthPercent));
  els.widthReadout.textContent = `${width.toFixed(0)}%`;
  els.widthFill.style.width = `${width}%`;
  const phase = stereoMeterSmooth.phaseAngleDeg;
  els.phaseReadout.textContent = `${phase >= 0 ? "+" : ""}${phase.toFixed(0)}°`;
  els.phaseNeedle.style.transform = `rotate(${phase}deg)`;
}

function updateCursorReadout() {
  if (!showCursors || displayMode !== "time" || cursors.vA == null || !audioEngine.sampleRate) {
    els.cursorDeltaT.textContent = "--";
    els.cursorFreq.textContent = "--";
    els.cursorDeltaV.textContent = "--";
    return;
  }
  const msPerPixel = WINDOW_SIZE / audioEngine.sampleRate * 1e3 / renderer.width;
  const deltaTms = Math.abs(cursors.vB - cursors.vA) * msPerPixel;
  els.cursorDeltaT.textContent = formatMs(deltaTms);
  els.cursorFreq.textContent = deltaTms > 0 ? formatHz(1e3 / deltaTms) : "--";
  const deltaV = Math.abs(renderer.pixelToAmplitude(cursors.hA) - renderer.pixelToAmplitude(cursors.hB));
  els.cursorDeltaV.textContent = deltaV.toFixed(3);
}

function updateHeroCard(state) {
  els.heroLabel.textContent = state.label;
  els.heroValueNum.textContent = state.value;
  els.heroUnit.textContent = state.unit || "";
  els.heroSub.innerHTML = state.sub || "&nbsp;";
}

let frozen = false;

function setFrozen(on) {
  frozen = on;
  if (els.freezeBtn) {
    els.freezeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    els.freezeBtn.textContent = on ? "Frozen" : "Freeze";
  }
  els.statusText.textContent = on ? "Frozen — display held" : `Running — ${audioEngine.sampleRate} Hz`;
  els.statusDot.classList.toggle("live", !on);
}

function exportPng() {
  try {
    const stamp = (new Date).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    els.canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thermalsock-scope-${displayMode}-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }, "image/png");
  } catch (err) {
    console.error("[oscilloscope] PNG export failed:", err);
  }
}

function frame() {
  if (frozen) {
    rafId = requestAnimationFrame(frame);
    return;
  }
  const buffers = audioEngine.getTimeDomainData();
  const bufA = buffers[0];
  const bufB = buffers[1];
  const resultA = triggerEngine.process(bufA, WINDOW_SIZE);
  if (resultA.data) {
    lastFrameA = resultA.data;
    if (bufB && resultA.index >= 0) {
      const start = Math.max(0, Math.min(bufB.length - 1, resultA.index + chBDelaySamples));
      const end = Math.min(start + WINDOW_SIZE, bufB.length);
      lastFrameB = bufB.slice(start, end);
    }
  }
  let stereoMetrics = null;
  if (bufA && bufB) {
    stereoMetrics = AudioEngine.computeStereoMetrics(bufA, bufB);
    updateStereoMeters(stereoMetrics);
  } else {
    updateStereoMeters(null);
  }
  let trace1 = lastFrameA;
  let trace2 = null;
  if (lastFrameA && showChannelB) {
    if (msMode) {
      trace1 = computeMathChannel(lastFrameA, lastFrameB, "mid");
      trace2 = computeMathChannel(lastFrameA, lastFrameB, "side");
    } else {
      trace2 = computeMathChannel(lastFrameA, lastFrameB, mathOp);
    }
  }
  if (displayMode === "time") {
    renderer.drawTimeDomain([ trace1, trace2 ], {
      overlayBlend: overlayBlend
    });
    renderer.drawTriggerLevel(triggerEngine.level);
    if (showCursors && cursors.vA != null) {
      renderer.drawCursors(cursors);
    }
    els.measPeakFreq.textContent = "--";
    const freqResult = lastFrameA ? measureFrequency(lastFrameA, audioEngine.sampleRate) : null;
    updateHeroCard({
      label: msMode ? "Frequency (Mid)" : "Frequency",
      value: freqResult ? freqResult.frequencyHz.toFixed(1) : "--",
      unit: freqResult ? "Hz" : "",
      sub: freqResult ? `Period ${formatMs(freqResult.periodMs)}` : ""
    });
  } else if (displayMode === "xy") {
    renderer.drawXY(lastFrameA, lastFrameB, {
      stereoMetrics: stereoMetrics
    });
    els.measPeakFreq.textContent = "--";
    const freqResult = lastFrameA ? measureFrequency(lastFrameA, audioEngine.sampleRate) : null;
    updateHeroCard({
      label: "Frequency (Ch A)",
      value: freqResult ? freqResult.frequencyHz.toFixed(1) : "--",
      unit: freqResult ? "Hz" : "",
      sub: showChannelB ? "Plotted against Ch B" : "Enable Ch B for a real Lissajous"
    });
  } else if (displayMode === "spectrum") {
    if (spectrumSource === "math" && trace2) {
      const spectrum = computeMagnitudeSpectrumDb(trace2);
      renderer.drawSpectrum(spectrum, {
        sampleRate: audioEngine.sampleRate,
        fftSize: WINDOW_SIZE,
        minDb: audioEngine.minDecibels,
        maxDb: audioEngine.maxDecibels
      });
      updatePeakFrequencyFromSpectrum(spectrum, audioEngine.sampleRate / WINDOW_SIZE);
      updateHeroCard({
        label: "Peak (Math FFT)",
        value: els.measPeakFreq.textContent,
        unit: "",
        sub: `Source: ${MATH_OPS.find(o => o.id === mathOp)?.label || "Trace 2"}`
      });
    } else {
      const freqBuffers = audioEngine.getFrequencyData();
      renderer.drawSpectrum(freqBuffers[0], {
        sampleRate: audioEngine.sampleRate,
        fftSize: audioEngine.fftSize,
        minDb: audioEngine.minDecibels,
        maxDb: audioEngine.maxDecibels
      });
      updatePeakFrequency(freqBuffers[0]);
      updateHeroCard({
        label: "Peak (FFT)",
        value: els.measPeakFreq.textContent,
        unit: "",
        sub: "Dominant frequency bin"
      });
    }
  } else if (displayMode === "spectrogram") {
    const freqBuffers = audioEngine.getFrequencyData();
    renderer.drawSpectrogramColumn(freqBuffers[0], {
      sampleRate: audioEngine.sampleRate,
      fftSize: audioEngine.fftSize,
      minDb: audioEngine.minDecibels,
      maxDb: audioEngine.maxDecibels
    });
    updatePeakFrequency(freqBuffers[0]);
    updateHeroCard({
      label: "Peak (FFT)",
      value: els.measPeakFreq.textContent,
      unit: "",
      sub: "Dominant frequency bin"
    });
  } else if (displayMode === "chromagram") {
    const freqBuffers = audioEngine.getFrequencyData();
    const chroma = computeChroma(freqBuffers[0], audioEngine.sampleRate, audioEngine.fftSize);
    for (let i = 0; i < 12; i++) {
      chromaSmooth[i] = chromaSmooth[i] * .75 + chroma[i] * .25;
    }
    renderer.drawChromagram(chromaSmooth, NOTE_NAMES);
    els.measPeakFreq.textContent = "--";
    let maxIdx = 0;
    for (let i = 1; i < 12; i++) if (chromaSmooth[i] > chromaSmooth[maxIdx]) maxIdx = i;
    updateHeroCard({
      label: "Dominant pitch class",
      value: chromaSmooth[maxIdx] > .05 ? NOTE_NAMES[maxIdx] : "--",
      unit: "",
      sub: "Octave-collapsed across 80Hz–5kHz"
    });
  } else if (displayMode === "harmonics") {
    const freqBuffers = audioEngine.getFrequencyData();
    const rawPeaks = findSpectralPeaks(freqBuffers[0], audioEngine.sampleRate, audioEngine.fftSize, {
      minDb: audioEngine.minDecibels + 30,
      maxPeaks: 6
    });
    const tagged = tagHarmonics(rawPeaks);
    const peaks = tagged.map(p => {
      const note = freqToNote(p.freq);
      const label = note ? `${note.name}${note.octave}  ${p.freq.toFixed(1)}Hz  ${note.cents >= 0 ? "+" : ""}${note.cents.toFixed(0)}¢` : `${p.freq.toFixed(1)}Hz`;
      return {
        freq: p.freq,
        label: label,
        harmonicOf: p.harmonicOf,
        harmonicNumber: p.harmonicNumber
      };
    });
    renderer.drawHarmonicLadder(peaks);
    els.measPeakFreq.textContent = "--";
    if (peaks.length > 0) {
      const rootPeak = peaks[0];
      const note = freqToNote(rootPeak.freq);
      updateHeroCard({
        label: "Fundamental",
        value: rootPeak.freq.toFixed(1),
        unit: "Hz",
        sub: note ? `${note.name}${note.octave} · ${note.cents >= 0 ? "+" : ""}${note.cents.toFixed(0)}¢ · ${peaks.length} peaks` : ""
      });
    } else {
      updateHeroCard({
        label: "Fundamental",
        value: "--",
        unit: "",
        sub: "Listening…"
      });
    }
  } else if (displayMode === "balance") {
    const freqBuffers = audioEngine.getFrequencyData();
    const rawPeaks = findSpectralPeaks(freqBuffers[0], audioEngine.sampleRate, audioEngine.fftSize, {
      minDb: audioEngine.minDecibels + 30,
      maxPeaks: 1
    });
    if (rawPeaks.length > 0) {
      const fundamentalHz = rawPeaks[0].freq;
      const {oddRatio: oddRatio, thdPercent: thdPercent} = computeHarmonicBalance(freqBuffers[0], fundamentalHz, audioEngine.sampleRate, audioEngine.fftSize);
      balanceSmooth.oddRatio = balanceSmooth.oddRatio * .8 + oddRatio * .2;
      balanceSmooth.thdPercent = balanceSmooth.thdPercent * .8 + thdPercent * .2;
      const reliable = balanceSmooth.thdPercent >= 2;
      const note = freqToNote(fundamentalHz);
      const label = note ? `${note.name}${note.octave}  ${fundamentalHz.toFixed(1)}Hz` : `${fundamentalHz.toFixed(1)}Hz`;
      renderer.drawHarmonicBalance(label, balanceSmooth.oddRatio, balanceSmooth.thdPercent, reliable);
      updateHeroCard({
        label: "THD",
        value: balanceSmooth.thdPercent.toFixed(1),
        unit: "%",
        sub: note ? `${note.name}${note.octave} fundamental · ${reliable ? balanceSmooth.oddRatio > .5 ? "odd-dominant" : "even-dominant" : "near-pure tone"}` : ""
      });
    } else {
      renderer.drawHarmonicBalance(null, .5, 0);
      updateHeroCard({
        label: "THD",
        value: "--",
        unit: "",
        sub: "Listening…"
      });
    }
    els.measPeakFreq.textContent = "--";
  }
  updateMeasurements(lastFrameA);
  updateTriggerStatus(resultA);
  updateCursorReadout();
  rafId = requestAnimationFrame(frame);
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  frame();
}

function restoreSettings() {
  if (!store) return;
  const cfg = store.get("settings", null);
  if (!cfg) return;
  const apply = (el, value, prop = "value") => {
    if (el && value != null) el[prop] = value;
  };
  apply(els.displayMode, cfg.displayMode);
  apply(els.themeSelect, cfg.theme);
  apply(els.triggerMode, cfg.triggerMode);
  apply(els.triggerSlope, cfg.triggerSlope);
  apply(els.triggerLevel, cfg.triggerLevel);
  apply(els.vScale, cfg.vScale);
  apply(els.timebase, cfg.timebase);
  apply(els.chBDelay, cfg.chBDelay);
  apply(els.mathOpSelect, cfg.mathOp);
  apply(els.spectrumSourceSelect, cfg.spectrumSource);
  apply(els.chBToggle, cfg.chB, "checked");
  apply(els.cursorsToggle, cfg.cursors, "checked");
  apply(els.overlayBlendToggle, cfg.overlayBlend, "checked");
  apply(els.msModeToggle, cfg.msMode, "checked");
  [ "displayMode", "themeSelect", "triggerMode", "triggerSlope", "timebase", "mathOpSelect", "spectrumSourceSelect", "chBToggle", "cursorsToggle", "overlayBlendToggle", "msModeToggle" ].forEach(k => {
    if (els[k]) els[k].dispatchEvent(new Event("change"));
  });
  [ "triggerLevel", "vScale", "chBDelay" ].forEach(k => {
    if (els[k]) els[k].dispatchEvent(new Event("input"));
  });
}

if (els.freezeBtn) {
  els.freezeBtn.addEventListener("click", () => setFrozen(!frozen));
}

if (els.exportPngBtn) {
  els.exportPngBtn.addEventListener("click", exportPng);
}

if (els.reopenGateBtn) {
  els.reopenGateBtn.addEventListener("click", async () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    try {
      audioEngine.stop?.();
    } catch (e) {}
    els.app.hidden = true;
    els.gate.hidden = false;
    els.statusDot.classList.remove("live");
    els.statusText.textContent = "Not running";
    await populateDevices();
  });
}

restoreSettings();

if (window.TSShortcuts) {
  const cycle = (el, dir) => {
    const opts = Array.from(el.options);
    const i = (opts.findIndex(o => o.value === el.value) + dir + opts.length) % opts.length;
    el.value = opts[i].value;
    el.dispatchEvent(new Event("change"));
  };
  window.TSShortcuts.register([ {
    keys: "space",
    group: "Acquisition",
    label: "Freeze / unfreeze the display",
    run: () => setFrozen(!frozen)
  }, {
    keys: "s",
    group: "Acquisition",
    label: "Save the current trace as a PNG",
    run: exportPng
  }, {
    keys: "n",
    group: "Acquisition",
    label: "Force a single capture",
    run: () => els.singleShotBtn.click()
  }, {
    keys: "m",
    group: "Display",
    label: "Next display mode",
    run: () => cycle(els.displayMode, 1)
  }, {
    keys: "b",
    group: "Display",
    label: "Previous display mode",
    run: () => cycle(els.displayMode, -1)
  }, {
    keys: "t",
    group: "Display",
    label: "Next theme",
    run: () => cycle(els.themeSelect, 1)
  }, {
    keys: "c",
    group: "Display",
    label: "Toggle cursors",
    run: () => {
      els.cursorsToggle.checked = !els.cursorsToggle.checked;
      els.cursorsToggle.dispatchEvent(new Event("change"));
    }
  }, {
    keys: "left",
    group: "Horizontal",
    label: "Shorter window (faster timebase)",
    run: () => cycle(els.timebase, -1)
  }, {
    keys: "right",
    group: "Horizontal",
    label: "Longer window (slower timebase)",
    run: () => cycle(els.timebase, 1)
  }, {
    keys: "?",
    group: "General",
    label: "Show this help"
  } ]);
}