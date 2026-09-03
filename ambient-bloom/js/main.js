import { AudioEngine } from "./audioEngine.js";

import { Analysis, sceneParams } from "./analysis.js";

import { Scene } from "./scene.js";

const els = {
  gate: document.getElementById("gate"),
  app: document.getElementById("app"),
  deviceSelect: document.getElementById("deviceSelect"),
  startBtn: document.getElementById("startBtn"),
  gateError: document.getElementById("gateError"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  canvas: document.getElementById("sceneCanvas"),
  gainSlider: document.getElementById("gainSlider"),
  gainReadout: document.getElementById("gainReadout"),
  saveFrameBtn: document.getElementById("saveFrameBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  hudBtn: document.getElementById("hudBtn"),
  reopenGateBtn: document.getElementById("reopenGateBtn"),
  hud: document.getElementById("hud"),
  hudLevel: document.getElementById("hudLevel"),
  hudBass: document.getElementById("hudBass"),
  hudFlat: document.getElementById("hudFlat"),
  hudBright: document.getElementById("hudBright"),
  hudFlux: document.getElementById("hudFlux"),
  hudPulse: document.getElementById("hudPulse"),
  hudTime: document.getElementById("hudTime"),
  timeBackBtn: document.getElementById("timeBackBtn"),
  timeFwdBtn: document.getElementById("timeFwdBtn"),
  timeLabel: document.getElementById("timeLabel")
};

const store = window.TSStore ? window.TSStore.create("ambient-bloom") : null;

const audioEngine = new AudioEngine({
  fftSize: 4096
});

const analysis = new Analysis;

const ctx = els.canvas.getContext("2d", {
  alpha: false
});

let scene = null;

let running = false;

let paused = false;

let rafId = null;

let lastFrameMs = 0;

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = els.canvas.getBoundingClientRect();
  const w = Math.max(320, Math.round(rect.width));
  const h = Math.max(240, Math.round(rect.height));
  els.canvas.width = Math.round(w * dpr);
  els.canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!scene) scene = new Scene(w, h, 7); else scene.resize(w, h);
  ctx.fillStyle = "#0a0c14";
  ctx.fillRect(0, 0, w, h);
}

window.addEventListener("resize", resizeCanvas);

async function populateDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === "audioinput");
    els.deviceSelect.innerHTML = "";
    if (inputs.length === 0) {
      const o = document.createElement("option");
      o.textContent = "No input devices found";
      els.deviceSelect.appendChild(o);
      return;
    }
    inputs.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || `Input ${i + 1}`;
      els.deviceSelect.appendChild(o);
    });
  } catch (err) {
    console.warn("[ambient-bloom] could not list devices:", err);
  }
}

async function start() {
  els.gateError.hidden = true;
  try {
    const {sampleRate: sampleRate, deviceLabel: deviceLabel} = await audioEngine.start(els.deviceSelect.value);
    audioEngine.setGain(parseFloat(els.gainSlider.value) || 4);
    els.gate.hidden = true;
    els.app.hidden = false;
    running = true;
    els.statusDot.classList.add("live");
    els.statusText.textContent = `Listening — ${deviceLabel || "input"} · ${sampleRate} Hz`;
    resizeCanvas();
    lastFrameMs = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  } catch (err) {
    els.gateError.hidden = false;
    els.gateError.textContent = `Could not open that input: ${err.message}`;
  }
}

els.startBtn.addEventListener("click", start);

function pickLouderChannel(timeData) {
  if (!timeData || timeData.length === 0) return null;
  if (timeData.length === 1) return {
    buf: timeData[0],
    index: 0
  };
  const a = timeData[0], b = timeData[1];
  if (!b) return {
    buf: a,
    index: 0
  };
  let sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) {
    sa += a[i] * a[i];
    sb += b[i] * b[i];
  }
  return sb > sa ? {
    buf: b,
    index: 1
  } : {
    buf: a,
    index: 0
  };
}

let hudAccum = 0;

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - lastFrameMs);
  lastFrameMs = now;
  if (paused || !running || !audioEngine.isRunning) return;
  const picked = pickLouderChannel(audioEngine.getTimeDomainData());
  if (!picked) return;
  const freqDb = audioEngine.getFrequencyData()[picked.index];
  const state = analysis.update(freqDb, picked.buf, audioEngine.sampleRate, audioEngine.minDecibels, audioEngine.maxDecibels, dtMs, now);
  const params = sceneParams(state);
  scene.setPhase(state.pulsePhase);
  scene.update(params, dtMs);
  scene.draw(ctx, params);
  hudAccum += dtMs;
  if (hudAccum > 100) {
    hudAccum = 0;
    updateHud(state, params);
  }
}

const bar = (v, n = 10) => {
  const filled = Math.round(Math.max(0, Math.min(1, v)) * n);
  return "█".repeat(filled) + "·".repeat(n - filled);
};

function updateHud(s, p) {
  if (els.hud.hidden) return;
  els.hudLevel.textContent = bar(s.loud);
  els.hudBass.textContent = `${bar(s.smooth.sub, 5)} ${bar(s.smooth.bass, 5)}`;
  els.hudFlat.textContent = bar(s.flatness);
  els.hudBright.textContent = bar(s.brightness);
  els.hudFlux.textContent = bar(s.flux);
  els.hudPulse.textContent = s.pulseConfidence > .45 ? `${bar(s.pulseConfidence, 5)} ${Math.round(s.bpm)} bpm` : `${bar(s.pulseConfidence, 5)} free`;
  if (scene) {
    els.hudTime.textContent = scene.timeOfDay;
    els.timeLabel.textContent = scene.timeOfDay;
  }
}

function nudgeTime(delta) {
  if (scene) {
    scene.nudgeTime(delta);
    els.timeLabel.textContent = scene.timeOfDay;
  }
}

function setPaused(on) {
  paused = on;
  els.pauseBtn.setAttribute("aria-pressed", on ? "true" : "false");
  els.pauseBtn.textContent = on ? "Resume" : "Pause";
}

function saveFrame() {
  els.canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ambient-bloom-${(new Date).toISOString().replace(/[:.]/g, "-").slice(0, 19)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }, "image/png");
}

function toggleHud() {
  const show = els.hud.hidden;
  els.hud.hidden = !show;
  els.hudBtn.setAttribute("aria-pressed", show ? "true" : "false");
  if (store) store.set("hud", show);
}

els.gainSlider.addEventListener("input", () => {
  const g = parseFloat(els.gainSlider.value);
  els.gainReadout.textContent = `${g}×`;
  if (audioEngine.isRunning) audioEngine.setGain(g);
  if (store) store.set("gain", g);
});

els.saveFrameBtn.addEventListener("click", saveFrame);

els.pauseBtn.addEventListener("click", () => setPaused(!paused));

els.hudBtn.addEventListener("click", toggleHud);

els.timeBackBtn.addEventListener("click", () => nudgeTime(-.06));

els.timeFwdBtn.addEventListener("click", () => nudgeTime(.06));

els.fullscreenBtn.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(e => console.warn("[ambient-bloom] fullscreen refused:", e));
});

document.addEventListener("fullscreenchange", () => {
  els.fullscreenBtn.textContent = document.fullscreenElement ? "Exit full" : "Fullscreen";
  setTimeout(resizeCanvas, 60);
});

els.reopenGateBtn.addEventListener("click", () => {
  running = false;
  try {
    audioEngine.stop && audioEngine.stop();
  } catch (e) {}
  els.app.hidden = true;
  els.gate.hidden = false;
  els.statusDot.classList.remove("live");
  els.statusText.textContent = "Not running";
  populateDevices();
});

if (store) {
  const g = store.get("gain", 4);
  els.gainSlider.value = g;
  els.gainReadout.textContent = `${g}×`;
  if (store.get("hud", true) === false) {
    els.hud.hidden = true;
    els.hudBtn.setAttribute("aria-pressed", "false");
  }
}

populateDevices();

if (window.TSShortcuts) {
  window.TSShortcuts.register([ {
    keys: "space",
    group: "Visual",
    label: "Freeze / resume",
    run: () => setPaused(!paused)
  }, {
    keys: "s",
    group: "Visual",
    label: "Save the current frame as a PNG",
    run: saveFrame
  }, {
    keys: "f",
    group: "Visual",
    label: "Fullscreen",
    run: () => els.fullscreenBtn.click()
  }, {
    keys: "h",
    group: "Visual",
    label: "Show / hide the readout",
    run: toggleHud
  }, {
    keys: "[",
    group: "Time of day",
    label: "Wind the clock back",
    run: () => nudgeTime(-.06)
  }, {
    keys: "]",
    group: "Time of day",
    label: "Wind the clock forward",
    run: () => nudgeTime(.06)
  }, {
    keys: "n",
    group: "Time of day",
    label: "Jump to night",
    run: () => {
      if (scene) {
        scene.dayPhase = 0;
        els.timeLabel.textContent = scene.timeOfDay;
      }
    }
  }, {
    keys: "d",
    group: "Time of day",
    label: "Jump to midday",
    run: () => {
      if (scene) {
        scene.dayPhase = .5;
        els.timeLabel.textContent = scene.timeOfDay;
      }
    }
  }, {
    keys: "?",
    group: "General",
    label: "Show this help"
  } ]);
}