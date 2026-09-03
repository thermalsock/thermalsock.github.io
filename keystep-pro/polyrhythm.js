(function() {
  "use strict";
  var G = window.KSPGen;
  var DIVISIONS = {
    q: {
      name: "1/4",
      perBar: 4,
      panel: "Time Division 1/4"
    },
    qt: {
      name: "1/4 triplet",
      perBar: 6,
      panel: "Time Division 1/4 + Triplet"
    },
    e: {
      name: "1/8",
      perBar: 8,
      panel: "Time Division 1/8"
    },
    et: {
      name: "1/8 triplet",
      perBar: 12,
      panel: "Time Division 1/8 + Triplet"
    },
    s: {
      name: "1/16",
      perBar: 16,
      panel: "Time Division 1/16"
    },
    st: {
      name: "1/16 triplet",
      perBar: 24,
      panel: "Time Division 1/16 + Triplet"
    },
    t: {
      name: "1/32",
      perBar: 32,
      panel: "Time Division 1/32"
    }
  };
  var PRESETS = {
    "3:4": {
      name: "3 against 4 — the classic",
      pulses: [ 3, 4 ]
    },
    "3:4:5": {
      name: "3 : 4 : 5 — three-way",
      pulses: [ 3, 4, 5 ]
    },
    "2:3": {
      name: "2 against 3 — hemiola",
      pulses: [ 2, 3 ]
    },
    "5:4": {
      name: "5 against 4 — restless",
      pulses: [ 5, 4 ]
    },
    "7:8": {
      name: "7 against 8 — nearly aligned",
      pulses: [ 7, 8 ]
    },
    "5:7": {
      name: "5 against 7 — never settles",
      pulses: [ 5, 7 ]
    },
    "3:5:7": {
      name: "3 : 5 : 7 — all coprime",
      pulses: [ 3, 5, 7 ]
    },
    "4:6:9": {
      name: "4 : 6 : 9 — stacked thirds",
      pulses: [ 4, 6, 9 ]
    },
    "9:8": {
      name: "9 against 8 — long cycle",
      pulses: [ 9, 8 ]
    },
    tresillo: {
      name: "Tresillo E(3,8) against 4",
      pulses: [ 3, 4 ],
      euclid: true,
      over: [ 8, 16 ]
    }
  };
  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }
  function lcm(a, b) {
    return a * b / gcd(a, b);
  }
  function euclid(k, n) {
    if (k <= 0 || n <= 0) return new Array(Math.max(0, n)).fill(false);
    if (k >= n) return new Array(n).fill(true);
    var a = [], b = [], i;
    for (i = 0; i < k; i++) a.push([ true ]);
    for (i = 0; i < n - k; i++) b.push([ false ]);
    while (b.length > 1) {
      var pairs = Math.min(a.length, b.length);
      var na = [], nb = [];
      for (i = 0; i < pairs; i++) na.push(a[i].concat(b[i]));
      if (a.length > pairs) for (i = pairs; i < a.length; i++) nb.push(a[i]); else for (i = pairs; i < b.length; i++) nb.push(b[i]);
      a = na;
      b = nb;
      if (!b.length) break;
    }
    return a.concat(b).reduce(function(acc, g) {
      return acc.concat(g);
    }, []);
  }
  function ratioPattern(k, n) {
    var out = new Array(n).fill(false);
    if (k <= 0) return out;
    for (var i = 0; i < k; i++) out[Math.round(i * n / k) % n] = true;
    return out;
  }
  function rotate(arr, by) {
    var n = arr.length;
    if (!n) return arr;
    var r = (by % n + n) % n;
    return arr.slice(n - r).concat(arr.slice(0, n - r));
  }
  var PITCH_MODES = {
    single: {
      name: "One note"
    },
    rootFifth: {
      name: "Root and fifth"
    },
    cell: {
      name: "Short cell"
    },
    arp: {
      name: "Chord tones"
    }
  };
  function pitchFor(mode, hitIndex, scalePcs, rootMidi, rng) {
    var deg;
    switch (mode) {
     case "rootFifth":
      deg = hitIndex % 2 === 0 ? 0 : 4;
      break;

     case "cell":
      deg = [ 0, 2, 1, 4 ][hitIndex % 4];
      break;

     case "arp":
      deg = [ 0, 2, 4, 2 ][hitIndex % 4];
      break;

     default:
      deg = 0;
      break;
    }
    return {
      degree: deg,
      midi: G.degreeToMidi(deg, scalePcs, rootMidi)
    };
  }
  function build(opts) {
    opts = opts || {};
    var cycle = opts.cycle || 16;
    var method = opts.method || "ratio";
    var scaleKey = opts.scale || "minor";
    var scale = G.SCALES[scaleKey] || G.SCALES.minor;
    var rootPc = opts.root === undefined ? 2 : opts.root;
    var baseOct = opts.octave === undefined ? 3 : opts.octave;
    var seed = opts.seed === undefined ? Date.now() & 65535 : opts.seed;
    var rng = G.makeRng(seed);
    var specs = opts.voices || [ {
      pulses: 3
    }, {
      pulses: 4
    } ];
    var voices = [];
    specs.forEach(function(spec, vi) {
      var pulses = Math.max(1, spec.pulses || 4);
      var rotation = spec.rotation || 0;
      var octave = baseOct + (spec.octaveOffset === undefined ? [ -1, 0, 1, 0 ][vi % 4] : spec.octaveOffset);
      var rootMidi = (octave + 1) * 12 + rootPc;
      var pitchMode = spec.pitchMode || [ "single", "rootFifth", "cell", "arp" ][vi % 4];
      var mask, len = cycle, perBar = null;
      if (method === "division") {
        var div = DIVISIONS[spec.division || "s"];
        perBar = div.perBar;
        len = Math.min(64, perBar * (opts.bars || 1));
        mask = new Array(len).fill(true);
        if (spec.pulses && spec.pulses < len) mask = ratioPattern(spec.pulses, len);
      } else if (method === "euclid") {
        mask = rotate(euclid(pulses, cycle), rotation);
      } else {
        mask = rotate(ratioPattern(pulses, cycle), rotation);
      }
      var hit = 0;
      var steps = mask.map(function(on, i) {
        if (!on) return {
          rest: true
        };
        var p = pitchFor(pitchMode, hit, scale.pcs, rootMidi, rng);
        var vel = i === 0 ? 118 : hit % 2 === 0 ? 96 : 78;
        hit++;
        return {
          rest: false,
          notes: [ p.midi ],
          degree: p.degree,
          vel: vel,
          gate: spec.gate || .45,
          tie: false,
          accent: vel > 100,
          shift: 0,
          ratchet: 1
        };
      });
      voices.push({
        index: vi + 1,
        pulses: method === "division" ? spec.pulses || perBar : pulses,
        rotation: rotation,
        length: len,
        perBar: perBar,
        division: spec.division || null,
        pitchMode: pitchMode,
        pattern: {
          steps: steps,
          meta: {
            styleName: "Polyrhythm",
            roleName: "Voice " + (vi + 1),
            scale: scaleKey,
            scaleName: scale.name,
            onDevice: scale.onDevice,
            root: rootPc,
            rootName: G.NOTE_NAMES[rootPc],
            octave: octave,
            scalePcs: scale.pcs,
            rootMidi: rootMidi,
            length: len,
            seed: seed,
            onsetCount: steps.filter(function(s) {
              return !s.rest;
            }).length,
            low: Math.min.apply(null, steps.filter(function(s) {
              return !s.rest;
            }).map(function(s) {
              return s.notes[0];
            })),
            high: Math.max.apply(null, steps.filter(function(s) {
              return !s.rest;
            }).map(function(s) {
              return s.notes[0];
            }))
          }
        }
      });
    });
    voices.forEach(function(v) {
      v.pattern.meta.lowName = G.noteName(v.pattern.meta.low);
      v.pattern.meta.highName = G.noteName(v.pattern.meta.high);
    });
    return Object.assign({
      voices: voices,
      cycle: cycle,
      method: method,
      seed: seed
    }, analyse(voices, cycle, method));
  }
  function analyse(voices, cycle, method) {
    method = method || "ratio";
    var counts = voices.map(function(v) {
      return method === "division" ? v.perBar : v.pulses;
    });
    var g = counts.reduce(function(a, b) {
      return gcd(a, b);
    });
    var ratio = counts.map(function(c) {
      return c / g;
    }).join(":");
    var trueRatio = g === 1;
    var period = counts.reduce(function(a, b) {
      return lcm(a, b);
    }, 1);
    var coincide = [];
    if (method !== "division") {
      for (var i = 0; i < cycle; i++) {
        var n = 0;
        voices.forEach(function(v) {
          var s = v.pattern.steps[i % v.length];
          if (s && !s.rest) n++;
        });
        if (n > 1) coincide.push({
          at: i,
          voices: n
        });
      }
    }
    var barsToRealign = method === "division" ? period / Math.max.apply(null, counts) : null;
    return {
      counts: counts,
      ratio: ratio,
      trueRatio: trueRatio,
      period: period,
      coincide: coincide,
      barsToRealign: barsToRealign,
      note: method === "division" ? trueRatio ? "A " + ratio + " cross-rhythm straight off the hardware clock." : "These divisions give a true " + ratio + " cross-rhythm." : trueRatio ? "Coprime, so the voices only agree on the downbeat." : "These share a factor of " + g + ", so this is really " + ratio + " with extra notes."
    };
  }
  function hardwarePlan(built) {
    return built.voices.map(function(v, i) {
      var div = v.division ? DIVISIONS[v.division] : null;
      return {
        track: i + 1,
        lastStep: v.length,
        division: div ? div.panel : "Time Division 1/16",
        pulses: v.pulses,
        note: div ? "Runs at " + div.perBar + " steps to the bar." : v.pulses + " hits across " + v.length + " steps."
      };
    });
  }
  window.KSPPoly = {
    DIVISIONS: DIVISIONS,
    PRESETS: PRESETS,
    PITCH_MODES: PITCH_MODES,
    euclid: euclid,
    ratioPattern: ratioPattern,
    rotate: rotate,
    build: build,
    analyse: analyse,
    hardwarePlan: hardwarePlan,
    gcd: gcd,
    lcm: lcm
  };
})();