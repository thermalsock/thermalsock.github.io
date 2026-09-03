let uid = 1;

const nextId = () => `m${uid++}`;

export const TARGETS = [ {
  id: "position",
  label: "Grain Position",
  min: 0,
  max: 1
}, {
  id: "grainDuration",
  label: "Grain Duration",
  min: 1,
  max: 200
}, {
  id: "density",
  label: "Grain Density",
  min: .5,
  max: 200
}, {
  id: "pitch",
  label: "Grain Pitch",
  min: -24,
  max: 24
}, {
  id: "jitter",
  label: "Jitter",
  min: 0,
  max: 1
}, {
  id: "spread",
  label: "Stereo Spread",
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
}, {
  id: "crossfadeAB",
  label: "Buffer Crossfade",
  min: 0,
  max: 1
}, {
  id: "orbitDepth",
  label: "Orbit Depth",
  min: 0,
  max: 1
}, {
  id: "scanSpeed",
  label: "Scan Speed",
  min: -4,
  max: 4
} ];

const LFO_WAVEFORMS = [ "sine", "triangle", "square", "saw", "sample-hold" ];

function lfoValue(waveform, phase, heldRandom) {
  const p = phase - Math.floor(phase);
  switch (waveform) {
   case "sine":
    return Math.sin(p * Math.PI * 2);

   case "triangle":
    return p < .5 ? 4 * p - 1 : 3 - 4 * p;

   case "square":
    return p < .5 ? 1 : -1;

   case "saw":
    return 2 * p - 1;

   case "sample-hold":
    return heldRandom;

   default:
    return 0;
  }
}

export class ModulationEngine {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.sources = [];
    this.routes = [];
    this.macros = [ .5, .5, .5, .5 ];
    this.baseValues = {};
    for (const t of TARGETS) this.baseValues[t.id] = null;
    this._lastTime = performance.now();
    this._clockBpm = 120;
    this._clockPhase = 0;
    this._addDefaultSources();
  }
  _addDefaultSources() {
    this.addSource("lfo", {
      label: "LFO 1",
      waveform: "sine",
      rateHz: .5,
      sync: false,
      division: 4
    });
    this.addSource("envelope", {
      label: "Env 1"
    });
    this.addSource("stepSeq", {
      label: "Steps",
      steps: makeSteps(16),
      rateHz: 4,
      pos: 0
    });
    this.addSource("random", {
      label: "Random",
      mode: "noise"
    });
    for (let i = 0; i < 4; i++) this.addSource("macro", {
      label: `Macro ${i + 1}`,
      macroIndex: i
    });
    const modWheel = this.addSource("midicc", {
      label: "Mod Wheel (CC1)",
      cc: 1,
      channel: "any"
    });
    const aftertouch = this.addSource("aftertouch", {
      label: "Aftertouch"
    });
    this.addRoute(modWheel.id, "density", .5);
    this.addRoute(aftertouch.id, "jitter", .5);
  }
  addSource(type, opts = {}) {
    const id = nextId();
    const base = {
      id: id,
      type: type,
      value: 0,
      label: opts.label || type
    };
    let src;
    if (type === "lfo") {
      src = {
        ...base,
        waveform: "sine",
        rateHz: .5,
        sync: false,
        division: 4,
        phase: Math.random(),
        held: 0,
        ...opts
      };
    } else if (type === "envelope") {
      src = {
        ...base,
        stage: "idle",
        stageTime: 0,
        attack: .02,
        decay: .15,
        sustain: .6,
        release: .4,
        retrigger: true,
        ...opts
      };
    } else if (type === "stepSeq") {
      src = {
        ...base,
        steps: makeSteps(16),
        rateHz: 4,
        pos: 0,
        phaseAcc: 0,
        ...opts
      };
    } else if (type === "random") {
      src = {
        ...base,
        mode: "noise",
        rateHz: 8,
        phaseAcc: 0,
        walk: 0,
        chaosX: .42,
        ...opts
      };
    } else if (type === "midicc") {
      src = {
        ...base,
        cc: null,
        channel: "any",
        ...opts
      };
    } else if (type === "macro") {
      src = {
        ...base,
        macroIndex: opts.macroIndex ?? 0,
        ...opts
      };
    } else if (type === "aftertouch") {
      src = {
        ...base,
        ...opts
      };
    } else {
      src = {
        ...base,
        ...opts
      };
    }
    this.sources.push(src);
    return src;
  }
  removeSource(id) {
    this.sources = this.sources.filter(s => s.id !== id);
    this.routes = this.routes.filter(r => r.sourceId !== id);
  }
  addRoute(sourceId, targetId, depth = .5) {
    const route = {
      id: nextId(),
      sourceId: sourceId,
      targetId: targetId,
      depth: depth,
      enabled: true
    };
    this.routes.push(route);
    return route;
  }
  removeRoute(id) {
    this.routes = this.routes.filter(r => r.id !== id);
  }
  clearRoutes() {
    this.routes = [];
  }
  triggerEnvelopes() {
    for (const s of this.sources) {
      if (s.type === "envelope") {
        s.stage = "attack";
        s.stageTime = 0;
      }
    }
  }
  releaseEnvelopes() {
    for (const s of this.sources) {
      if (s.type === "envelope" && (s.stage === "attack" || s.stage === "decay" || s.stage === "sustain")) {
        s.stage = "release";
        s.stageTime = 0;
      }
    }
  }
  feedMidiCC(cc, value01, channel) {
    for (const s of this.sources) {
      if (s.type === "midicc" && s.cc === cc && (s.channel === "any" || s.channel === channel)) {
        s.value = value01 * 2 - 1;
      }
    }
  }
  setAftertouch(value01) {
    for (const s of this.sources) {
      if (s.type === "aftertouch") s.value = value01 * 2 - 1;
    }
  }
  setMacro(index, value01) {
    this.macros[index] = value01;
    for (const s of this.sources) {
      if (s.type === "macro" && s.macroIndex === index) s.value = value01 * 2 - 1;
    }
  }
  tick() {
    const now = performance.now();
    const dt = Math.min(.1, (now - this._lastTime) / 1e3);
    this._lastTime = now;
    for (const s of this.sources) {
      switch (s.type) {
       case "lfo":
        {
          const rate = s.sync ? this._clockBpm / 60 / s.division : s.rateHz;
          s.phase += rate * dt;
          if (s.phase >= 1) {
            s.phase -= Math.floor(s.phase);
            s.held = Math.random() * 2 - 1;
          }
          s.value = lfoValue(s.waveform, s.phase, s.held);
          break;
        }

       case "envelope":
        {
          s.stageTime += dt;
          if (s.stage === "attack") {
            s.value = Math.min(1, s.stageTime / Math.max(.001, s.attack));
            if (s.stageTime >= s.attack) {
              s.stage = "decay";
              s.stageTime = 0;
            }
          } else if (s.stage === "decay") {
            const t = Math.min(1, s.stageTime / Math.max(.001, s.decay));
            s.value = 1 + t * (s.sustain - 1);
            if (t >= 1) {
              s.stage = "sustain";
              s.stageTime = 0;
            }
          } else if (s.stage === "sustain") {
            s.value = s.sustain;
          } else if (s.stage === "release") {
            const t = Math.min(1, s.stageTime / Math.max(.001, s.release));
            s.value = s.sustain * (1 - t);
            if (t >= 1) {
              s.stage = "idle";
              s.value = 0;
            }
          } else {
            s.value = 0;
          }
          break;
        }

       case "stepSeq":
        {
          s.phaseAcc += s.rateHz * dt;
          if (s.phaseAcc >= 1) {
            s.phaseAcc -= Math.floor(s.phaseAcc);
            s.pos = (s.pos + 1) % s.steps.length;
          }
          s.value = s.steps[s.pos];
          break;
        }

       case "random":
        {
          if (s.mode === "noise") {
            s.phaseAcc += s.rateHz * dt;
            if (s.phaseAcc >= 1) {
              s.phaseAcc -= Math.floor(s.phaseAcc);
              s.value = Math.random() * 2 - 1;
            }
          } else if (s.mode === "brownian") {
            s.walk += (Math.random() * 2 - 1) * dt * 4;
            s.walk = Math.max(-1, Math.min(1, s.walk));
            s.value = s.walk;
          } else if (s.mode === "chaos") {
            s.phaseAcc += s.rateHz * dt;
            if (s.phaseAcc >= 1) {
              s.phaseAcc -= Math.floor(s.phaseAcc);
              s.chaosX = 3.9 * s.chaosX * (1 - s.chaosX);
              s.value = s.chaosX * 2 - 1;
            }
          }
          break;
        }

       case "midicc":
       case "macro":
       default:
        break;
      }
    }
    const resolved = {};
    for (const t of TARGETS) {
      const base = this.baseValues[t.id];
      if (base === null || base === undefined) continue;
      let mod = 0;
      for (const r of this.routes) {
        if (!r.enabled || r.targetId !== t.id) continue;
        const src = this.sources.find(s => s.id === r.sourceId);
        if (!src) continue;
        mod += src.value * r.depth;
      }
      const range = t.max - t.min;
      const value = base + mod * range * .5;
      resolved[t.id] = Math.max(t.min, Math.min(t.max, value));
      this.audioEngine.setParamImmediate(t.id, resolved[t.id]);
    }
    return resolved;
  }
}

function makeSteps(n) {
  const arr = new Array(n).fill(0);
  for (let i = 0; i < n; i++) arr[i] = Math.sin(i / n * Math.PI * 2) * .6;
  return arr;
}

export { LFO_WAVEFORMS };