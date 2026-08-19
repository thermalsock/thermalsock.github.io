// presets.js
// Serializes/restores knob + toggle state to/from JSON, backed by
// localStorage, plus file export/import and 4 quick-recall snapshot slots.
//
// Deliberately does NOT serialize actual Freeze A/B captured spectra —
// those are a performance action (like engaging a freeze pedal mid-take),
// not saved state, the same way the Granulator's presets don't capture
// "whatever happens to be in the buffer right now." Loading a preset always
// starts with both freeze slots empty; you re-engage them live.

const STORAGE_KEY = 'thermalsock-spectral-lab-presets-v1';
const SNAPSHOT_KEY = 'thermalsock-spectral-lab-snapshots-v1';

export const PRESET_CATEGORIES = ['Drones', 'Textures', 'Glitch', 'Shift', 'User'];

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
      console.warn('[spectral-lab] could not persist presets:', err);
    }
  }

  _factoryPresets() {
    return [
      // --- Drones ---------------------------------------------------------
      {
        name: 'Still Water', category: 'Drones',
        state: baseState({ freezeMix: 0, smearAmt: 0.55, reverseAmt: 0, scatterAmt: 0, dryWet: 0.9 }),
      },
      {
        name: 'Held Breath', category: 'Drones',
        state: baseState({ freezeMix: 0.85, smearAmt: 0.3, scatterAmt: 0.05, dryWet: 1 }),
      },
      {
        name: 'Two Ghosts', category: 'Drones',
        state: baseState({ freezeMix: 1, morphAB: 0.5, smearAmt: 0.4, dryWet: 1 }),
      },

      // --- Textures ---------------------------------------------------------
      {
        name: 'Soft Focus', category: 'Textures',
        state: baseState({ freezeMix: 0.2, smearAmt: 0.65, scatterAmt: 0.15, dryWet: 0.85 }),
      },
      {
        name: 'Slow Bloom', category: 'Textures',
        state: baseState({ freezeMix: 0.5, smearAmt: 0.8, shiftSemi: 5, dryWet: 0.9 }),
      },
      {
        name: 'Underwater Choir', category: 'Textures',
        state: baseState({ freezeMix: 0.7, morphAB: 0.3, smearAmt: 0.5, shiftSemi: -7, dryWet: 1 }),
      },

      // --- Glitch ---------------------------------------------------------
      {
        name: 'Bin Storm', category: 'Glitch',
        state: baseState({ freezeMix: 0, scatterAmt: 0.75, smearAmt: 0.1, dryWet: 1 }),
      },
      {
        name: 'Fractured Glass', category: 'Glitch',
        state: baseState({ freezeMix: 0.4, scatterAmt: 0.9, reverseAmt: 0.3, dryWet: 1 }),
      },

      // --- Shift ---------------------------------------------------------
      {
        name: 'Inverted Choir', category: 'Shift',
        state: baseState({ freezeMix: 0.3, reverseAmt: 1, smearAmt: 0.35, dryWet: 1 }),
      },
      {
        name: 'Octave Drift', category: 'Shift',
        state: baseState({ freezeMix: 0.2, shiftSemi: -12, smearAmt: 0.3, scatterAmt: 0.1, dryWet: 0.9 }),
      },

      // --- User ---------------------------------------------------------
      {
        name: 'Init Patch', category: 'User',
        state: baseState({}),
      },
    ];
  }

  list(category = null) {
    return category ? this.presets.filter((p) => p.category === category) : this.presets;
  }

  save(name, category, state) {
    const existingIdx = this.presets.findIndex((p) => p.name === name);
    const entry = { name, category, state };
    if (existingIdx >= 0) this.presets[existingIdx] = entry;
    else this.presets.push(entry);
    this._persist();
    return entry;
  }

  delete(name) {
    this.presets = this.presets.filter((p) => p.name !== name);
    this._persist();
  }

  get(name) {
    return this.presets.find((p) => p.name === name) || null;
  }

  exportJSON(state, name = 'spectral-lab-preset') {
    const payload = { name, exportedAt: new Date().toISOString(), state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  exportAllJSON() {
    const blob = new Blob([JSON.stringify(this.presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spectral-lab-preset-bank.json';
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
        if (entry && entry.name && entry.state) this.save(entry.name, entry.category || 'User', entry.state);
      }
      return { type: 'bank', count: data.length };
    }
    if (data && data.state) {
      this.save(data.name || 'Imported preset', 'User', data.state);
      return { type: 'single', name: data.name };
    }
    throw new Error('Unrecognized preset JSON shape');
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
  return name.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'preset';
}

function baseState(overrides) {
  const defaultParams = {
    inputGain: 1, outputGain: 1.6, dryWet: 1,
    freezeMix: 0, morphAB: 0.5, shiftSemi: 0, reverseAmt: 0, smearAmt: 0, scatterAmt: 0,
  };
  const defaultDiscrete = { monoInput: true, limiter: true };
  const applied = applyOverrides(overrides);
  return {
    params: { ...defaultParams, ...applied.params },
    discrete: { ...defaultDiscrete, ...applied.discrete },
  };
}

function applyOverrides(overrides) {
  const out = { params: {}, discrete: {} };
  const paramKeys = ['inputGain', 'outputGain', 'dryWet', 'freezeMix', 'morphAB', 'shiftSemi', 'reverseAmt', 'smearAmt', 'scatterAmt'];
  for (const [k, v] of Object.entries(overrides)) {
    if (paramKeys.includes(k)) out.params[k] = v;
    else out.discrete[k] = v;
  }
  return out;
}
