import { PRESETS, CATEGORIES } from "./synthPresets.js";

const LEVEL_ANGLE = {
  min: -115,
  low: -60,
  mid: 0,
  high: 60,
  max: 115
};

const els = {
  sidebar: document.getElementById("soundSidebar"),
  title: document.getElementById("soundTitle"),
  categoryTag: document.getElementById("soundCategoryTag"),
  blurb: document.getElementById("soundBlurb"),
  settingsList: document.getElementById("soundSettingsList"),
  adsrChart: document.getElementById("adsrChart"),
  suggDelayType: document.getElementById("suggDelayType"),
  suggDelayText: document.getElementById("suggDelayText"),
  suggReverbType: document.getElementById("suggReverbType"),
  suggReverbText: document.getElementById("suggReverbText"),
  suggModText: document.getElementById("suggModText")
};

const CATEGORY_EFFECTS = {
  "Bread-and-Butter Analog": {
    delayType: "Off / Very Subtle",
    delayText: "These are foundational tones meant to sit clean in a mix — skip delay on bass entirely; a faint slap is fine on pads/strings if you want extra width.",
    reverbType: "Short-Medium Room/Plate",
    reverbText: "Just enough to add depth without smearing the attack. Keep it shorter and drier on bass than on pads.",
    modText: "Minimal on bass/brass. A slow, gentle LFO to filter cutoff or amplitude adds believable life to pads and strings without drawing attention to itself."
  },
  "Leads & Solo Instruments": {
    delayType: "Slap or Ping-Pong",
    delayText: "A short synced delay (1/8 or dotted 1/8) adds width and rhythmic interest without muddying single-note lines.",
    reverbType: "Medium Plate",
    reverbText: "Enough to feel present in a mix without pushing the lead into the background.",
    modText: "Vibrato via mod wheel to pitch is classic for leads — light, performer-controlled rather than always-on. A touch of chorus can widen PWM/sync leads further."
  },
  "Motion & Modulated": {
    delayType: "Tempo-Synced (1/8 or Dotted 1/8)",
    delayText: "Since the patch is already about movement, a synced delay reinforces rather than fights the internal modulation — keep feedback moderate so it doesn’t turn to mush.",
    reverbType: "Medium-Long Hall",
    reverbText: "These patches like room to breathe; a longer tail supports the evolving texture.",
    modText: "Modulation IS the point of this category — consider syncing the LFO rate to tempo so the motion feels intentional rather than arbitrary against the rest of a track."
  },
  "Percussive & Plucked": {
    delayType: "Off or Very Short Slap",
    delayText: "Keep transients sharp — a long delay smears the attack that makes these sounds work. A very short slap can add width without softening the hit.",
    reverbType: "Short Room/Plate",
    reverbText: "Just enough to avoid sounding completely dry and clinical; too much washes out the percussive snap.",
    modText: "Generally none needed — the pitch/filter envelopes already provide the movement. Save modulation budget for sustained sounds instead."
  },
  "Drones & Atmospheric": {
    delayType: "Long, Feedback-Heavy",
    delayText: "These patches reward a delay that becomes part of the texture itself — long time, higher feedback, possibly filtered in the feedback path.",
    reverbType: "Huge Hall / Shimmer",
    reverbText: "Go big here — a cavernous, near-infinite tail is exactly what atmospheric material wants.",
    modText: "A slow LFO to filter cutoff (very low rate, moderate depth) keeps a static drone from feeling frozen without turning it into an obvious sweep."
  },
  "Aggressive / Experimental": {
    delayType: "Short + Driven, or Ring-Modulated Feedback",
    delayText: "A conventional clean delay often softens these patches’ edge — try a short delay with saturation in the feedback path, or skip it and let the raw modulation carry the sound.",
    reverbType: "Short/Gritty Plate or None",
    reverbText: "Keep it tight and in-your-face; a long reverb tends to dilute exactly the aggression these patches are going for.",
    modText: "Audio-rate modulation is usually already baked into the patch itself here — additional slow modulation is rarely needed and can muddy the effect."
  },
  "Bell-Like / Metallic": {
    delayType: "Tempo-Synced (1/8), Low Feedback",
    delayText: "A light synced echo adds shimmer and complements the inharmonic overtones without cluttering the attack.",
    reverbType: "Long, Bright Plate/Hall",
    reverbText: "Bells want space to ring out — a longer, brighter tail sells the metallic character.",
    modText: "A slow, subtle LFO to amplitude (tremolo) can add a gentle shimmer, but keep it light — too much fights the bell’s natural decay."
  },
  "Keyboard-Tracking Variants": {
    delayType: "Depends on the Host Patch",
    delayText: "These are a filter-tracking technique layered onto another patch, not a standalone sound — inherit delay/reverb from whichever lead/pad/bass you’re applying this tracking behavior to.",
    reverbType: "Depends on the Host Patch",
    reverbText: "Same as delay — match whatever the underlying sound calls for.",
    modText: "None specific to tracking itself; any modulation choices come from the base patch this technique is applied to."
  },
  "Utility / Foundational": {
    delayType: "Off",
    delayText: "These are building blocks meant to be combined into a full patch later — keep them completely dry so you can hear exactly what they’re contributing.",
    reverbType: "Off / Minimal",
    reverbText: "Same reasoning as delay — add space later, once this element is combined with others, not now.",
    modText: "None — apply modulation after this element is layered into a complete patch, not while it’s still an isolated building block."
  }
};

const KNOB_IDS = {
  filter: {
    cutoff: "ptrFilterCutoff",
    resonance: "ptrFilterResonance",
    drive: "ptrFilterDrive"
  },
  filterEnv: {
    attack: "ptrFEnvAttack",
    decay: "ptrFEnvDecay",
    sustain: "ptrFEnvSustain",
    release: "ptrFEnvRelease"
  },
  ampEnv: {
    attack: "ptrAEnvAttack",
    decay: "ptrAEnvDecay",
    sustain: "ptrAEnvSustain",
    release: "ptrAEnvRelease"
  },
  osc1: {
    shape: "ptrOsc1Shape",
    octave: "ptrOsc1Octave",
    pitch: "ptrOsc1Pitch"
  },
  osc2: {
    shape: "ptrOsc2Shape",
    octave: "ptrOsc2Octave",
    pitch: "ptrOsc2Pitch"
  },
  mix: {
    osc1: "ptrMixOsc1",
    osc1Sub: "ptrMixOsc1Sub",
    osc2: "ptrMixOsc2",
    noise: "ptrMixNoise"
  }
};

function populateSidebar() {
  els.sidebar.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const group = document.createElement("div");
    group.className = "sound-nav-group";
    const heading = document.createElement("h4");
    heading.textContent = cat;
    group.appendChild(heading);
    PRESETS.filter(p => p.category === cat).forEach(p => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sound-nav-item";
      btn.textContent = p.name;
      btn.dataset.name = p.name;
      btn.addEventListener("click", () => selectPresetByName(p.name));
      group.appendChild(btn);
    });
    els.sidebar.appendChild(group);
  });
}

const ADSR_ATTACK_W = {
  min: 15,
  low: 35,
  mid: 55,
  high: 80,
  max: 110
};

const ADSR_DECAY_W = {
  min: 15,
  low: 30,
  mid: 45,
  high: 65,
  max: 90
};

const ADSR_RELEASE_W = {
  min: 15,
  low: 35,
  mid: 60,
  high: 90,
  max: 120
};

const ADSR_SUSTAIN_FRAC = {
  min: .08,
  low: .32,
  mid: .55,
  high: .75,
  max: .92
};

const ADSR_SUSTAIN_HOLD_W = 40;

const TIME_WORDS = {
  min: "Instant",
  low: "Fast",
  mid: "Medium",
  high: "Slow",
  max: "V.Slow"
};

const LEVEL_WORDS = {
  min: "V.Low",
  low: "Low",
  mid: "Mid",
  high: "High",
  max: "Max"
};

function buildAdsrChart(env) {
  const plotX0 = 55, plotX1 = 305;
  const plotY0 = 35, plotY1 = 215;
  const availW = plotX1 - plotX0;
  const rawA = ADSR_ATTACK_W[env.attack];
  const rawD = ADSR_DECAY_W[env.decay];
  const rawR = ADSR_RELEASE_W[env.release];
  const rawTotal = rawA + rawD + ADSR_SUSTAIN_HOLD_W + rawR;
  const scale = availW / rawTotal;
  const aW = rawA * scale, dW = rawD * scale, sW = ADSR_SUSTAIN_HOLD_W * scale, rW = rawR * scale;
  const x0 = plotX0;
  const xPeak = x0 + aW, yPeak = plotY0;
  const xSusStart = xPeak + dW;
  const ySus = plotY1 - ADSR_SUSTAIN_FRAC[env.sustain] * (plotY1 - plotY0);
  const xSusEnd = xSusStart + sW;
  const xEnd = xSusEnd + rW;
  const attackFill = `M${x0},${plotY1} L${xPeak},${yPeak} L${xPeak},${plotY1} Z`;
  const decayFill = `M${xPeak},${plotY1} L${xPeak},${yPeak} L${xSusStart},${ySus} L${xSusStart},${plotY1} Z`;
  const sustainFill = `M${xSusStart},${plotY1} L${xSusStart},${ySus} L${xSusEnd},${ySus} L${xSusEnd},${plotY1} Z`;
  const releaseFill = `M${xSusEnd},${plotY1} L${xSusEnd},${ySus} L${xEnd},${plotY1} Z`;
  const outline = `M${x0},${plotY1} L${xPeak},${yPeak} L${xSusStart},${ySus} L${xSusEnd},${ySus} L${xEnd},${plotY1}`;
  const midA = (x0 + xPeak) / 2, midD = (xPeak + xSusStart) / 2;
  const midS = (xSusStart + xSusEnd) / 2, midR = (xSusEnd + xEnd) / 2;
  const labelY = plotY1 + 22, subY = plotY1 + 36;
  return `\n    <path class="adsr-fill-attack" d="${attackFill}" />\n    <path class="adsr-fill-decay" d="${decayFill}" />\n    <path class="adsr-fill-sustain" d="${sustainFill}" />\n    <path class="adsr-fill-release" d="${releaseFill}" />\n    <path class="adsr-outline" d="${outline}" />\n\n    <line class="adsr-axis" x1="${plotX0}" y1="${plotY0}" x2="${plotX0}" y2="${plotY1}" />\n    <line class="adsr-axis" x1="${plotX0}" y1="${plotY1}" x2="${plotX1 + 5}" y2="${plotY1}" />\n    <text class="adsr-axis-label" x="${plotX0 - 8}" y="${plotY0 + 4}" text-anchor="end">Max</text>\n    <text class="adsr-axis-label" x="${plotX0 - 8}" y="${plotY1 + 4}" text-anchor="end">0</text>\n    <text class="adsr-axis-label" x="14" y="${(plotY0 + plotY1) / 2}" text-anchor="middle"\n      transform="rotate(-90, 14, ${(plotY0 + plotY1) / 2})">Amplitude</text>\n    <text class="adsr-axis-label" x="${(plotX0 + plotX1) / 2}" y="${plotY1 + 68}" text-anchor="middle">Time</text>\n\n    <text class="adsr-phase-label" x="${midA}" y="${labelY}">A</text>\n    <text class="adsr-phase-sub" x="${midA}" y="${subY}">${TIME_WORDS[env.attack]}</text>\n    <text class="adsr-phase-label" x="${midD}" y="${labelY}">D</text>\n    <text class="adsr-phase-sub" x="${midD}" y="${subY}">${TIME_WORDS[env.decay]}</text>\n    <text class="adsr-phase-label" x="${midS}" y="${labelY}">S</text>\n    <text class="adsr-phase-sub" x="${midS}" y="${subY}">${LEVEL_WORDS[env.sustain]}</text>\n    <text class="adsr-phase-label" x="${midR}" y="${labelY}">R</text>\n    <text class="adsr-phase-sub" x="${midR}" y="${subY}">${TIME_WORDS[env.release]}</text>\n\n    <line class="adsr-marker-line" x1="${x0}" y1="${plotY0 - 10}" x2="${x0}" y2="${plotY1}" stroke="var(--teal)" />\n    <text class="adsr-marker-text" x="${x0}" y="${plotY0 - 14}" text-anchor="start" fill="var(--teal)">Key pressed</text>\n    <line class="adsr-marker-line" x1="${xSusEnd}" y1="${plotY0 - 10}" x2="${xSusEnd}" y2="${plotY1}" stroke="var(--danger)" />\n    <text class="adsr-marker-text" x="${xSusEnd}" y="${plotY0 - 14}" text-anchor="middle" fill="var(--danger)">Key released</text>\n  `;
}

function setKnobAngle(id, level) {
  const el = document.getElementById(id);
  if (el) el.style.setProperty("--angle", `${LEVEL_ANGLE[level]}deg`);
}

function setButton(id, on) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("on", !!on);
}

function applyPreset(preset) {
  els.title.textContent = preset.name;
  els.categoryTag.textContent = preset.category;
  els.blurb.textContent = preset.blurb;
  els.settingsList.innerHTML = `\n    <li><strong>Oscillators</strong> — ${preset.osc}</li>\n    <li><strong>Mixer</strong> — ${preset.mixer}</li>\n    <li><strong>Filter</strong> — ${preset.filterText}</li>\n    <li><strong>Filter Env</strong> — ${preset.filterEnvText}</li>\n    <li><strong>Amp Env</strong> — ${preset.ampEnvText}</li>\n  `;
  setKnobAngle(KNOB_IDS.filter.cutoff, preset.filter.cutoff);
  setKnobAngle(KNOB_IDS.filter.resonance, preset.filter.resonance);
  setKnobAngle(KNOB_IDS.filter.drive, preset.filter.drive);
  Object.entries(KNOB_IDS.filterEnv).forEach(([key, id]) => setKnobAngle(id, preset.filterEnv[key]));
  Object.entries(KNOB_IDS.ampEnv).forEach(([key, id]) => setKnobAngle(id, preset.ampEnv[key]));
  setKnobAngle(KNOB_IDS.osc1.shape, preset.osc1.shape);
  setKnobAngle(KNOB_IDS.osc1.octave, preset.osc1.octave);
  setKnobAngle(KNOB_IDS.osc1.pitch, preset.osc1.pitch);
  setButton("btnSync", preset.osc1.sync);
  setKnobAngle(KNOB_IDS.osc2.shape, preset.osc2.shape);
  setKnobAngle(KNOB_IDS.osc2.octave, preset.osc2.octave);
  setKnobAngle(KNOB_IDS.osc2.pitch, preset.osc2.pitch);
  setButton("btnOsc2Low", preset.osc2.low);
  setKnobAngle(KNOB_IDS.mix.osc1, preset.mix.osc1);
  setKnobAngle(KNOB_IDS.mix.osc1Sub, preset.mix.osc1Sub);
  setButton("btnFm", preset.mix.fm);
  setKnobAngle(KNOB_IDS.mix.osc2, preset.mix.osc2);
  setKnobAngle(KNOB_IDS.mix.noise, preset.mix.noise);
  els.adsrChart.innerHTML = buildAdsrChart(preset.ampEnv);
  const fx = CATEGORY_EFFECTS[preset.category];
  els.suggDelayType.textContent = fx.delayType;
  els.suggDelayText.textContent = fx.delayText;
  els.suggReverbType.textContent = fx.reverbType;
  els.suggReverbText.textContent = fx.reverbText;
  els.suggModText.textContent = fx.modText;
  els.sidebar.querySelectorAll(".sound-nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.name === preset.name);
  });
}

function selectPresetByName(name) {
  const preset = PRESETS.find(p => p.name === name);
  if (preset) applyPreset(preset);
}

populateSidebar();

selectPresetByName("Classic Analog Bass");

import { AuditionVoice } from "./audition.js";

const voice = new AuditionVoice;

const sdStore = window.TSStore ? window.TSStore.create("sound-design") : null;

let currentPreset = null;

let edited = false;

function auditionNote() {
  const sel = document.getElementById("auditionNote");
  return sel ? parseInt(sel.value, 10) : 48;
}

function setAuditionUi(on) {
  const btn = document.getElementById("auditionBtn");
  if (!btn) return;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  document.getElementById("auditionLabel").textContent = on ? "Playing" : "Audition";
}

function toggleAudition() {
  if (voice.playing) {
    voice.stop();
    setAuditionUi(false);
    return;
  }
  if (!currentPreset) return;
  voice.play(livePresetFromPanel(), auditionNote());
  setAuditionUi(true);
}

voice.onEnded = () => setAuditionUi(false);

const ANGLE_MIN = -115;

const ANGLE_MAX = 115;

function angleToLevel(angle) {
  const t = (angle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
  const names = [ "min", "low", "mid", "high", "max" ];
  const idx = Math.max(0, Math.min(4, Math.round(t * 4)));
  return names[idx];
}

function angleOf(pointerEl) {
  const raw = pointerEl.style.getPropertyValue("--angle");
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 0 : n;
}

function buildKnobFieldMap() {
  const map = {};
  Object.entries(KNOB_IDS).forEach(([section, entry]) => {
    Object.entries(entry).forEach(([field, id]) => {
      map[id] = [ section, field ];
    });
  });
  return map;
}

const KNOB_FIELDS = buildKnobFieldMap();

function livePresetFromPanel() {
  if (!currentPreset) return null;
  const live = JSON.parse(JSON.stringify(currentPreset));
  Object.entries(KNOB_FIELDS).forEach(([id, path]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const level = angleToLevel(angleOf(el));
    if (path.length === 2) {
      if (!live[path[0]]) live[path[0]] = {};
      live[path[0]][path[1]] = level;
    }
  });
  return live;
}

function markEdited(on) {
  edited = on;
  const badge = document.getElementById("editedBadge");
  if (badge) badge.classList.toggle("show", on);
}

function syncOctaveLeds(pointerId) {
  const ptr = document.getElementById(pointerId);
  if (!ptr) return;
  const svg = ptr.closest("svg");
  if (!svg) return;
  const leds = svg.querySelectorAll(".knob-led");
  if (!leds.length) return;
  const level = angleToLevel(angleOf(ptr));
  const idx = [ "min", "low", "mid", "high", "max" ].indexOf(level);
  const ledIdx = Math.max(0, Math.min(leds.length - 1, Math.round(idx * (leds.length - 1) / 4)));
  leds.forEach((led, i) => led.classList.toggle("on", i === ledIdx));
}

function makeKnobInteractive(pointerEl) {
  const svg = pointerEl.closest("svg");
  const wrap = pointerEl.closest(".knob-wrap");
  if (!svg || !wrap) return;
  let readout = wrap.querySelector(".knob-readout");
  if (!readout) {
    readout = document.createElement("span");
    readout.className = "knob-readout";
    wrap.appendChild(readout);
  }
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("role", "slider");
  svg.setAttribute("aria-valuemin", "0");
  svg.setAttribute("aria-valuemax", "4");
  const applyAngle = angle => {
    const clamped = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, angle));
    pointerEl.style.setProperty("--angle", `${clamped}deg`);
    const level = angleToLevel(clamped);
    readout.textContent = level;
    svg.setAttribute("aria-valuenow", String([ "min", "low", "mid", "high", "max" ].indexOf(level)));
    svg.setAttribute("aria-valuetext", level);
    syncOctaveLeds(pointerEl.id);
    markEdited(true);
    refreshChartFromPanel();
  };
  let startY = 0, startAngle = 0, dragging = false;
  svg.addEventListener("pointerdown", e => {
    dragging = true;
    startY = e.clientY;
    startAngle = angleOf(pointerEl);
    wrap.classList.add("is-dragging");
    readout.textContent = angleToLevel(startAngle);
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (!dragging) return;
    applyAngle(startAngle + (startY - e.clientY) * 1.6);
  });
  const end = e => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove("is-dragging");
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {}
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", e => {
    const step = (ANGLE_MAX - ANGLE_MIN) / 4;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      applyAngle(angleOf(pointerEl) + step);
      e.preventDefault();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      applyAngle(angleOf(pointerEl) - step);
      e.preventDefault();
    }
  });
}

function refreshChartFromPanel() {
  const live = livePresetFromPanel();
  if (live && typeof buildAdsrChart === "function") buildAdsrChart(live.ampEnv);
}

function filterSidebar(query) {
  const q = query.trim().toLowerCase();
  let visible = 0;
  els.sidebar.querySelectorAll(".sound-nav-group").forEach(group => {
    let groupHits = 0;
    group.querySelectorAll(".sound-nav-item").forEach(btn => {
      const preset = PRESETS.find(p => p.name === btn.dataset.name);
      const hay = `${btn.dataset.name} ${preset ? preset.category : ""} ${preset ? preset.blurb : ""}`.toLowerCase();
      const hit = !q || hay.includes(q);
      btn.hidden = !hit;
      if (hit) {
        groupHits++;
        visible++;
      }
    });
    group.hidden = groupHits === 0;
  });
  const empty = document.getElementById("sidebarEmpty");
  if (empty) empty.hidden = visible > 0;
}

function stepPreset(delta) {
  if (!currentPreset) return;
  const i = PRESETS.findIndex(p => p.name === currentPreset.name);
  if (i < 0) return;
  const next = PRESETS[(i + delta + PRESETS.length) % PRESETS.length];
  selectPresetByName(next.name);
  const btn = els.sidebar.querySelector(`[data-name="${CSS.escape(next.name)}"]`);
  if (btn) btn.scrollIntoView({
    block: "nearest"
  });
}

function wireSoundDesignExtras() {
  document.querySelectorAll(".knob-pointer").forEach(makeKnobInteractive);
  document.querySelectorAll(".knob-octave .knob-pointer").forEach(p => syncOctaveLeds(p.id));
  const title = document.getElementById("soundTitle");
  if (title && !document.getElementById("editedBadge")) {
    const badge = document.createElement("button");
    badge.id = "editedBadge";
    badge.className = "edited-badge";
    badge.type = "button";
    badge.textContent = "Edited · reset";
    badge.title = "The panel no longer matches the documented preset. Click to restore it.";
    badge.addEventListener("click", () => {
      if (currentPreset) selectPresetByName(currentPreset.name);
    });
    title.appendChild(badge);
  }
  const auditionBtn = document.getElementById("auditionBtn");
  if (auditionBtn) auditionBtn.addEventListener("click", toggleAudition);
  const noteSel = document.getElementById("auditionNote");
  if (noteSel) {
    const saved = sdStore ? sdStore.get("auditionNote", null) : null;
    if (saved) noteSel.value = saved;
    noteSel.addEventListener("change", () => {
      if (sdStore) sdStore.set("auditionNote", noteSel.value);
    });
  }
  const prev = document.getElementById("prevPresetBtn");
  const next = document.getElementById("nextPresetBtn");
  if (prev) prev.addEventListener("click", () => stepPreset(-1));
  if (next) next.addEventListener("click", () => stepPreset(1));
  const search = document.getElementById("presetSearch");
  if (search) {
    search.addEventListener("input", () => filterSidebar(search.value));
    search.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        search.value = "";
        filterSidebar("");
        search.blur();
      }
    });
  }
  if (window.TSShortcuts) {
    window.TSShortcuts.register([ {
      keys: "space",
      group: "Audition",
      label: "Play / stop the current patch",
      run: toggleAudition
    }, {
      keys: "left",
      group: "Browsing",
      label: "Previous sound",
      run: () => stepPreset(-1)
    }, {
      keys: "right",
      group: "Browsing",
      label: "Next sound",
      run: () => stepPreset(1)
    }, {
      keys: "/",
      group: "Browsing",
      label: "Search the sound list",
      run: () => {
        const el = document.getElementById("presetSearch");
        if (el) el.focus();
      }
    }, {
      keys: "r",
      group: "Panel",
      label: "Reset the panel to the documented preset",
      run: () => {
        if (currentPreset) selectPresetByName(currentPreset.name);
      }
    }, {
      keys: "?",
      group: "General",
      label: "Show this help"
    } ]);
  }
}

const _applyPreset = applyPreset;

applyPreset = function(preset) {
  _applyPreset(preset);
  currentPreset = preset;
  markEdited(false);
  if (voice.playing) {
    voice.stop();
    setAuditionUi(false);
  }
  document.querySelectorAll(".knob-octave .knob-pointer").forEach(p => syncOctaveLeds(p.id));
};

wireSoundDesignExtras();

selectPresetByName("Classic Analog Bass");