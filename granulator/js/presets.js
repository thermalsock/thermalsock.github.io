const STORAGE_KEY = "thermalsock-granulator-presets-v2";

const SNAPSHOT_KEY = "thermalsock-granulator-snapshots-v1";

export const PRESET_CATEGORIES = [ "Textures", "Percussive", "Drones", "Glitch", "User" ];

export class PresetStore {
  constructor() {
    this.presets = this._load();
  }
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : this._factoryPresets();
    } catch (err) {
      return this._factoryPresets();
    }
  }
  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets));
    } catch (err) {
      console.warn("[granulator] could not persist presets:", err);
    }
  }
  _factoryPresets() {
    return [ {
      name: "Glass Dust",
      category: "Textures",
      state: baseState({
        grainDuration: 22,
        density: 60,
        pitch: 7,
        jitter: .4,
        spread: .9,
        dryWet: .85,
        envelope: "gaussian",
        position: .05
      })
    }, {
      name: "Silk Veil",
      category: "Textures",
      state: baseState({
        grainDuration: 90,
        density: 24,
        pitch: 0,
        jitter: .08,
        spread: .65,
        dryWet: .9,
        envelope: "gaussian",
        position: .1
      })
    }, {
      name: "Pitch Confetti",
      category: "Textures",
      state: baseState({
        grainDuration: 35,
        density: 45,
        pitch: 3,
        jitter: .6,
        spread: 1,
        dryWet: .8,
        envelope: "tukey",
        position: .08,
        orbitMode: true,
        orbitRate: .6,
        orbitDepth: .3
      })
    }, {
      name: "Sub Cloud",
      category: "Drones",
      state: baseState({
        grainDuration: 160,
        density: 8,
        pitch: -12,
        jitter: .1,
        spread: .3,
        dryWet: 1,
        envelope: "hann",
        orbitMode: true,
        orbitRate: .2,
        orbitDepth: .4
      })
    }, {
      name: "Frozen Choir",
      category: "Drones",
      state: baseState({
        grainDuration: 190,
        density: 6,
        pitch: -5,
        jitter: .05,
        spread: .85,
        dryWet: 1,
        envelope: "hann",
        formantPreserve: true,
        orbitMode: true,
        orbitRate: .08,
        orbitDepth: .5,
        bufferLengthSeconds: 8
      })
    }, {
      name: "Reverse Swell",
      category: "Drones",
      state: baseState({
        grainDuration: 175,
        density: 5,
        pitch: -2,
        jitter: .05,
        spread: .7,
        dryWet: 1,
        envelope: "gaussian",
        reverse: true,
        position: .2
      })
    }, {
      name: "Stutter Bed",
      category: "Percussive",
      state: baseState({
        grainDuration: 12,
        density: 40,
        pitch: 0,
        jitter: 0,
        spread: .2,
        dryWet: .6,
        envelope: "exponential",
        position: .03
      })
    }, {
      name: "Ratchet Snap",
      category: "Percussive",
      state: baseState({
        grainDuration: 6,
        density: 140,
        pitch: -3,
        jitter: .02,
        spread: .15,
        dryWet: .7,
        envelope: "exponential",
        position: .02,
        reverse: false
      })
    }, {
      name: "Broken Loop",
      category: "Percussive",
      state: baseState({
        grainDuration: 45,
        density: 14,
        pitch: 0,
        jitter: .15,
        spread: .4,
        dryWet: .65,
        envelope: "tukey",
        position: .06,
        scanSpeed: .5,
        autoAdvance: true
      })
    }, {
      name: "Shattered Ice",
      category: "Glitch",
      state: baseState({
        grainDuration: 8,
        density: 90,
        pitch: 12,
        jitter: .9,
        spread: 1,
        dryWet: 1,
        envelope: "tukey",
        sprayMode: true
      })
    }, {
      name: "Bitcrush Skitter",
      category: "Glitch",
      state: baseState({
        grainDuration: 5,
        density: 120,
        pitch: 5,
        jitter: 1,
        spread: 1,
        dryWet: 1,
        envelope: "exponential",
        sprayMode: true,
        orbitMode: true,
        orbitRate: 3.5,
        orbitDepth: .6
      })
    }, {
      name: "Static Bloom",
      category: "Glitch",
      state: baseState({
        grainDuration: 3,
        density: 180,
        pitch: -8,
        jitter: 1,
        spread: .9,
        dryWet: 1,
        envelope: "exponential",
        sprayMode: true,
        pitchLock: true
      })
    }, {
      name: "Init Patch",
      category: "User",
      state: baseState({
        grainDuration: 60,
        density: 20,
        pitch: 0,
        jitter: .15,
        spread: .5,
        dryWet: 1,
        envelope: "hann",
        position: .06
      })
    } ];
  }
  list(category = null) {
    return category ? this.presets.filter(p => p.category === category) : this.presets;
  }
  save(name, category, state) {
    const existingIdx = this.presets.findIndex(p => p.name === name);
    const entry = {
      name: name,
      category: category,
      state: state
    };
    if (existingIdx >= 0) this.presets[existingIdx] = entry; else this.presets.push(entry);
    this._persist();
    return entry;
  }
  delete(name) {
    this.presets = this.presets.filter(p => p.name !== name);
    this._persist();
  }
  get(name) {
    return this.presets.find(p => p.name === name) || null;
  }
  exportJSON(state, name = "granulator-preset") {
    const payload = {
      name: name,
      exportedAt: (new Date).toISOString(),
      state: state
    };
    const blob = new Blob([ JSON.stringify(payload, null, 2) ], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  exportAllJSON() {
    const blob = new Blob([ JSON.stringify(this.presets, null, 2) ], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "granulator-preset-bank.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async importJSONFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      for (const entry of data) {
        if (entry && entry.name && entry.state) this.save(entry.name, entry.category || "User", entry.state);
      }
      return {
        type: "bank",
        count: data.length
      };
    }
    if (data && data.state) {
      this.save(data.name || "Imported preset", "User", data.state);
      return {
        type: "single",
        name: data.name
      };
    }
    throw new Error("Unrecognized preset JSON shape");
  }
  saveSnapshot(slot, state) {
    const snaps = this._loadSnapshots();
    snaps[slot] = state;
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps));
  }
  getSnapshot(slot) {
    const snaps = this._loadSnapshots();
    return snaps[slot] || null;
  }
  _loadSnapshots() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "preset";
}

function baseState(overrides) {
  const defaultParams = {
    inputGain: 1,
    outputGain: 1.6,
    dryWet: 1,
    position: .3,
    grainDuration: 60,
    density: 20,
    pitch: 0,
    jitter: .15,
    spread: .5,
    crossfadeAB: 0,
    orbitRate: .25,
    orbitDepth: 0,
    scanSpeed: 1,
    scanStart: 0,
    scanEnd: 1
  };
  const defaultDiscrete = {
    envelope: "hann",
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
    monoInput: true,
    scanLoopMode: false
  };
  const applied = applyOverrides(overrides);
  return {
    params: {
      ...defaultParams,
      ...applied.params
    },
    discrete: {
      ...defaultDiscrete,
      ...applied.discrete
    },
    modulation: {
      sources: [],
      routes: [],
      macros: [ .5, .5, .5, .5 ]
    },
    midiMappings: []
  };
}

function applyOverrides(overrides) {
  const out = {
    params: {},
    discrete: {}
  };
  for (const [k, v] of Object.entries(overrides)) {
    if ([ "grainDuration", "density", "pitch", "jitter", "spread", "dryWet", "position", "crossfadeAB", "orbitRate", "orbitDepth", "scanSpeed", "scanStart", "scanEnd", "inputGain", "outputGain" ].includes(k)) {
      out.params[k] = v;
    } else {
      out.discrete[k] = v;
    }
  }
  return out;
}