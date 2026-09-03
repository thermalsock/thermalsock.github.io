(function() {
  "use strict";
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function() {
      a |= 0;
      a = a + 1831565813 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    var rnd = mulberry32(seed);
    return {
      next: rnd,
      range: function(lo, hi) {
        return lo + rnd() * (hi - lo);
      },
      int: function(lo, hi) {
        return Math.floor(lo + rnd() * (hi - lo + 1));
      },
      chance: function(p) {
        return rnd() < p;
      },
      pick: function(arr) {
        return arr[Math.floor(rnd() * arr.length)];
      },
      weighted: function(items, weights) {
        var total = 0, i;
        for (i = 0; i < weights.length; i++) total += weights[i];
        var r = rnd() * total;
        for (i = 0; i < items.length; i++) {
          r -= weights[i];
          if (r <= 0) return items[i];
        }
        return items[items.length - 1];
      }
    };
  }
  var SCALES = {
    chromatic: {
      name: "Chromatic",
      pcs: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ],
      onDevice: true
    },
    major: {
      name: "Major",
      pcs: [ 0, 2, 4, 5, 7, 9, 11 ],
      onDevice: true
    },
    minor: {
      name: "Minor (Aeolian)",
      pcs: [ 0, 2, 3, 5, 7, 8, 10 ],
      onDevice: true
    },
    dorian: {
      name: "Dorian",
      pcs: [ 0, 2, 3, 5, 7, 9, 10 ],
      onDevice: true
    },
    mixolydian: {
      name: "Mixolydian",
      pcs: [ 0, 2, 4, 5, 7, 9, 10 ],
      onDevice: true
    },
    harmonic: {
      name: "Harmonic Minor",
      pcs: [ 0, 2, 3, 5, 7, 8, 11 ],
      onDevice: true
    },
    blues: {
      name: "Blues",
      pcs: [ 0, 3, 5, 6, 7, 10 ],
      onDevice: true
    },
    phrygian: {
      name: "Phrygian",
      pcs: [ 0, 1, 3, 5, 7, 8, 10 ],
      onDevice: false
    },
    lydian: {
      name: "Lydian",
      pcs: [ 0, 2, 4, 6, 7, 9, 11 ],
      onDevice: false
    },
    pentMinor: {
      name: "Minor Pentatonic",
      pcs: [ 0, 3, 5, 7, 10 ],
      onDevice: false
    },
    wholeTone: {
      name: "Whole Tone",
      pcs: [ 0, 2, 4, 6, 8, 10 ],
      onDevice: false
    },
    octatonic: {
      name: "Octatonic",
      pcs: [ 0, 2, 3, 5, 6, 8, 9, 11 ],
      onDevice: false
    }
  };
  var NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
  var STYLES = {
    berlin: {
      name: "Berlin School",
      blurb: "Tangerine Dream, Schulze. Dense 16ths, narrow range, relentless motion.",
      density: .85,
      syncopation: .15,
      restRun: .1,
      stepBias: .72,
      leapMax: 4,
      octaveJump: .12,
      gate: .35,
      gateVary: .15,
      tie: .05,
      accent: .25,
      accentDepth: 30,
      range: 2,
      harmonicRhythm: 16,
      contours: [ "wave", "arch", "rise" ],
      progression: [ 0, 0, 5, 5 ],
      scaleHint: "minor"
    },
    acid: {
      name: "Acid Line",
      blurb: "303 vocabulary. Octave jumps, slides, hard accents, one chord.",
      density: .75,
      syncopation: .45,
      restRun: .25,
      stepBias: .5,
      leapMax: 7,
      octaveJump: .3,
      gate: .5,
      gateVary: .35,
      tie: .22,
      accent: .35,
      accentDepth: 45,
      range: 2,
      harmonicRhythm: 16,
      contours: [ "wave", "valley", "static" ],
      progression: [ 0, 0, 0, 0 ],
      scaleHint: "pentMinor"
    },
    motorik: {
      name: "Motorik",
      blurb: "Neu!, Kraftwerk. Steady pulse, few pitches, forward momentum.",
      density: .65,
      syncopation: .08,
      restRun: .15,
      stepBias: .85,
      leapMax: 3,
      octaveJump: .05,
      gate: .45,
      gateVary: .1,
      tie: .08,
      accent: .2,
      accentDepth: 25,
      range: 1,
      harmonicRhythm: 16,
      contours: [ "static", "rise", "wave" ],
      progression: [ 0, 0, 4, 4 ],
      scaleHint: "dorian"
    },
    phase: {
      name: "Minimal / Phase",
      blurb: "Reich. A short cell, repeated, designed to drift against itself.",
      density: .7,
      syncopation: .1,
      restRun: .1,
      stepBias: .8,
      leapMax: 4,
      octaveJump: .02,
      gate: .4,
      gateVary: .05,
      tie: .02,
      accent: .15,
      accentDepth: 18,
      range: 1,
      harmonicRhythm: 16,
      contours: [ "wave", "arch" ],
      progression: [ 0, 0, 0, 0 ],
      cell: true,
      scaleHint: "major"
    },
    cinematic: {
      name: "Cinematic",
      blurb: "Vangelis. Sparse, long gates, wide arcs, plenty of air.",
      density: .4,
      syncopation: .12,
      restRun: .4,
      stepBias: .65,
      leapMax: 6,
      octaveJump: .06,
      gate: .85,
      gateVary: .2,
      tie: .3,
      accent: .15,
      accentDepth: 20,
      range: 2,
      harmonicRhythm: 8,
      contours: [ "arch", "rise", "fall" ],
      progression: [ 0, 5, 3, 4 ],
      scaleHint: "lydian"
    },
    detroit: {
      name: "Detroit",
      blurb: "Syncopated, chord-driven, sevenths over a moving bass.",
      density: .55,
      syncopation: .55,
      restRun: .25,
      stepBias: .6,
      leapMax: 5,
      octaveJump: .15,
      gate: .5,
      gateVary: .25,
      tie: .1,
      accent: .3,
      accentDepth: 35,
      range: 2,
      harmonicRhythm: 8,
      contours: [ "wave", "valley" ],
      progression: [ 0, 5, 1, 4 ],
      scaleHint: "minor"
    },
    neoambient: {
      name: "Neo-Ambient Arp",
      blurb: "Slow and wide. Fifths, ninths and suspensions, with a lot of air between them.",
      density: .3,
      syncopation: .05,
      restRun: .55,
      stepBias: .2,
      leapMax: 8,
      octaveJump: .1,
      gate: 1.5,
      gateVary: .25,
      tie: .4,
      accent: .08,
      accentDepth: 14,
      range: 2.5,
      harmonicRhythm: 16,
      contours: [ "arch", "rise", "static" ],
      progression: [ 0, 3, 0, 4 ],
      intervalPool: [ 4, 5, 8, 3 ],
      suspend: .45,
      scaleHint: "lydian"
    },
    idm: {
      name: "IDM / Glitch Arp",
      blurb: "Irregular cells, micro-shifted timing, notes that break and stutter.",
      density: .62,
      syncopation: .6,
      restRun: .3,
      stepBias: .45,
      leapMax: 7,
      octaveJump: .22,
      gate: .3,
      gateVary: .55,
      tie: .05,
      accent: .4,
      accentDepth: 40,
      range: 2,
      harmonicRhythm: 8,
      contours: [ "wave", "valley", "static" ],
      progression: [ 0, 4, 2, 6 ],
      micro: .28,
      glitch: .18,
      irregular: true,
      scaleHint: "octatonic"
    },
    trance: {
      name: "Trance Gate",
      blurb: "Root and fifth, hammered. Bright, predictable, hypnotic.",
      density: .95,
      syncopation: .05,
      restRun: .08,
      stepBias: .5,
      leapMax: 5,
      octaveJump: .18,
      gate: .28,
      gateVary: .06,
      tie: 0,
      accent: .3,
      accentDepth: 28,
      range: 2,
      harmonicRhythm: 16,
      contours: [ "static", "wave" ],
      progression: [ 0, 0, 5, 5 ],
      toneBias: [ 0, 4 ],
      accentBeats: [ 0, 4, 8, 12 ],
      scaleHint: "minor"
    },
    synthwave: {
      name: "Synthwave / Outrun",
      blurb: "Aeolian, a two-bar motif, root-fifth-octave jumps, accents on 1 and 3.",
      density: .7,
      syncopation: .15,
      restRun: .18,
      stepBias: .45,
      leapMax: 7,
      octaveJump: .28,
      gate: .45,
      gateVary: .12,
      tie: .08,
      accent: .2,
      accentDepth: 34,
      range: 2,
      harmonicRhythm: 16,
      contours: [ "wave", "rise" ],
      progression: [ 0, 5, 3, 4 ],
      intervalPool: [ 4, 7, 3 ],
      accentBeats: [ 0, 8 ],
      motif: 2,
      scaleHint: "minor"
    },
    dubtechno: {
      name: "Dub Techno Stabs",
      blurb: "Very sparse chords rather than notes, pushed off the grid, heavily swung.",
      density: .22,
      syncopation: .7,
      restRun: .6,
      stepBias: .5,
      leapMax: 4,
      octaveJump: .05,
      gate: .7,
      gateVary: .3,
      tie: .1,
      accent: .25,
      accentDepth: 26,
      range: 1.5,
      harmonicRhythm: 16,
      contours: [ "static", "valley" ],
      progression: [ 0, 0, 3, 3 ],
      forceChord: 3,
      swing: .42,
      micro: .2,
      scaleHint: "dorian"
    },
    psybient: {
      name: "Psybient / Drone Motion",
      blurb: "Notes orbit a drone root. Very slow movement, modal, clustered.",
      density: .35,
      syncopation: .1,
      restRun: .45,
      stepBias: .9,
      leapMax: 3,
      octaveJump: .04,
      gate: 1.4,
      gateVary: .2,
      tie: .35,
      accent: .08,
      accentDepth: 12,
      range: 1.5,
      harmonicRhythm: 16,
      contours: [ "static", "wave" ],
      progression: [ 0, 0, 0, 0 ],
      dronePull: .55,
      cluster: true,
      scaleHint: "phrygian"
    },
    additive: {
      name: "Minimalist Classical",
      blurb: "Reich and Glass. A cell that grows a note at a time, then mutates.",
      density: .8,
      syncopation: .05,
      restRun: .1,
      stepBias: .9,
      leapMax: 3,
      octaveJump: .02,
      gate: .42,
      gateVary: .05,
      tie: .02,
      accent: .12,
      accentDepth: 16,
      range: 1.5,
      harmonicRhythm: 16,
      contours: [ "wave", "arch" ],
      progression: [ 0, 0, 0, 0 ],
      additive: true,
      mutate: .18,
      scaleHint: "major"
    },
    electro: {
      name: "Electro Bassline",
      blurb: "Root, octave, seventh, with chromatic passing tones. Detroit and acid crossed.",
      density: .72,
      syncopation: .5,
      restRun: .2,
      stepBias: .5,
      leapMax: 7,
      octaveJump: .32,
      gate: .4,
      gateVary: .25,
      tie: .12,
      accent: .32,
      accentDepth: 38,
      range: 1.5,
      harmonicRhythm: 16,
      contours: [ "valley", "wave" ],
      progression: [ 0, 0, 6, 0 ],
      intervalPool: [ 7, 6, 4 ],
      passing: .22,
      scaleHint: "minor"
    },
    breakbeat: {
      name: "Breakbeat Arp",
      blurb: "Syncopated accents, notes nudged off the grid, pentatonic with blue notes.",
      density: .6,
      syncopation: .65,
      restRun: .3,
      stepBias: .55,
      leapMax: 5,
      octaveJump: .18,
      gate: .35,
      gateVary: .3,
      tie: .06,
      accent: .4,
      accentDepth: 42,
      range: 2,
      harmonicRhythm: 16,
      contours: [ "wave", "valley" ],
      progression: [ 0, 0, 4, 0 ],
      micro: .22,
      swing: .2,
      scaleHint: "blues"
    },
    pulse: {
      name: "Cinematic Pulse",
      blurb: "Low ostinato, one rhythmic cell repeating, the occasional octave lift.",
      density: .78,
      syncopation: .1,
      restRun: .12,
      stepBias: .8,
      leapMax: 4,
      octaveJump: .14,
      gate: .32,
      gateVary: .1,
      tie: .04,
      accent: .22,
      accentDepth: 30,
      range: 1.5,
      harmonicRhythm: 16,
      contours: [ "static", "rise" ],
      progression: [ 0, 0, 5, 4 ],
      cellLen: 4,
      accentBeats: [ 0, 8 ],
      scaleHint: "harmonic"
    },
    arpeggio: {
      name: "Classic Arpeggio",
      blurb: "Straight chord tones, up and down. The reliable one.",
      density: 1,
      syncopation: 0,
      restRun: 0,
      stepBias: .3,
      leapMax: 8,
      octaveJump: .2,
      gate: .4,
      gateVary: .05,
      tie: 0,
      accent: .25,
      accentDepth: 22,
      range: 2,
      harmonicRhythm: 16,
      contours: [ "rise" ],
      progression: [ 0, 0, 0, 0 ],
      arp: true,
      scaleHint: "minor"
    }
  };
  var ROLES = {
    bass: {
      name: "Bass",
      octave: -1,
      densityMul: .8,
      rangeMul: .6,
      rootPull: .55,
      poly: 1,
      gateMul: .9
    },
    lead: {
      name: "Lead",
      octave: 1,
      densityMul: 1,
      rangeMul: 1.2,
      rootPull: .2,
      poly: 1,
      gateMul: 1
    },
    counter: {
      name: "Counter",
      octave: 0,
      densityMul: .9,
      rangeMul: 1,
      rootPull: .25,
      poly: 1,
      gateMul: 1,
      contrary: true
    },
    pad: {
      name: "Pad",
      octave: 0,
      densityMul: .35,
      rangeMul: .8,
      rootPull: .4,
      poly: 3,
      gateMul: 1.8
    }
  };
  var METRIC = [ 10, 1, 4, 2, 7, 1, 4, 2, 8, 1, 4, 2, 6, 1, 5, 3 ];
  function degreeToMidi(degree, scalePcs, rootMidi) {
    var n = scalePcs.length;
    var oct = Math.floor(degree / n);
    var idx = (degree % n + n) % n;
    return rootMidi + oct * 12 + scalePcs[idx];
  }
  function triadDegrees(rootDegree) {
    return [ rootDegree, rootDegree + 2, rootDegree + 4 ];
  }
  function noteName(midi) {
    return NOTE_NAMES[(midi % 12 + 12) % 12] + (Math.floor(midi / 12) - 1);
  }
  function buildContour(shape, steps, span, rng) {
    var out = [], i, t;
    for (i = 0; i < steps; i++) {
      t = i / (steps - 1);
      var v;
      switch (shape) {
       case "rise":
        v = t;
        break;

       case "fall":
        v = 1 - t;
        break;

       case "arch":
        v = Math.sin(t * Math.PI);
        break;

       case "valley":
        v = 1 - Math.sin(t * Math.PI);
        break;

       case "wave":
        v = .5 + .5 * Math.sin(t * Math.PI * 2 - Math.PI / 2);
        break;

       default:
        v = .5;
        break;
      }
      out.push(v * span);
    }
    return out;
  }
  function buildRhythm(style, role, density, steps, rng, occupancy, avoid) {
    var onsets = new Array(steps), i;
    var d = Math.max(.05, Math.min(1, density * role.densityMul));
    if (style.arp && !occupancy) {
      for (i = 0; i < steps; i++) onsets[i] = true;
      return onsets;
    }
    if (style.additive) {
      for (i = 0; i < steps; i++) onsets[i] = false;
      var at = 0, group = 1;
      while (at < steps) {
        for (var q = 0; q < group && at < steps; q++) onsets[at++] = true;
        at++;
        group++;
        if (group > 5) group = 1;
      }
      return onsets;
    }
    if (style.irregular) {
      for (i = 0; i < steps; i++) onsets[i] = false;
      var pos = 0;
      var cells = [ 3, 5, 2, 7, 3, 4, 2, 5 ];
      var ci = rng.int(0, cells.length - 1);
      while (pos < steps) {
        onsets[pos] = true;
        var len = cells[ci % cells.length];
        ci++;
        for (var w = 1; w < len && pos + w < steps; w++) {
          onsets[pos + w] = rng.chance(.35);
        }
        pos += len;
      }
      return onsets;
    }
    for (i = 0; i < steps; i++) {
      var m = METRIC[i % 16] / 10;
      var weight = m * (1 - style.syncopation) + (1 - m) * style.syncopation;
      var p = d * .55 + weight * .75 * d;
      if (occupancy) p /= 1 + occupancy[i % occupancy.length] * (avoid === undefined ? 1.9 : avoid);
      onsets[i] = rng.next() < p;
    }
    var claimDownbeat = !occupancy || occupancy[0] === 0;
    if (claimDownbeat && !onsets[0] && !rng.chance(style.restRun * .5)) onsets[0] = true;
    var tolerance = 3 + Math.floor(style.restRun * 6) + (occupancy ? 4 : 0);
    var run = 0, runStart = 0;
    for (i = 0; i < steps; i++) {
      if (!onsets[i]) {
        if (run === 0) runStart = i;
        run++;
        if (run > tolerance) {
          var put = i;
          if (occupancy) {
            var best = Infinity;
            for (var k = runStart; k <= i; k++) {
              var occ = occupancy[k % occupancy.length];
              if (occ < best) {
                best = occ;
                put = k;
              }
            }
          }
          onsets[put] = true;
          run = 0;
        }
      } else run = 0;
    }
    return onsets;
  }
  function generateCore(opts) {
    opts = opts || {};
    var styleKey = opts.style || "berlin";
    var style = STYLES[styleKey] || STYLES.berlin;
    var roleKey = opts.role || "lead";
    var role = ROLES[roleKey] || ROLES.lead;
    var scaleKey = opts.scale || style.scaleHint || "minor";
    var scale = SCALES[scaleKey] || SCALES.minor;
    var steps = opts.steps || 16;
    var rootPc = opts.root === undefined ? 2 : opts.root;
    var baseOctave = opts.octave === undefined ? 3 : opts.octave;
    var seed = opts.seed === undefined ? Date.now() & 65535 : opts.seed;
    var density = opts.density === undefined ? style.density : opts.density;
    var rangeOct = opts.range === undefined ? style.range : opts.range;
    var rng = makeRng(seed);
    var rootMidi = (baseOctave + 1) * 12 + rootPc + role.octave * 12;
    var scaleLen = scale.pcs.length;
    var span = Math.max(2, Math.round(rangeOct * role.rangeMul * scaleLen));
    var windowSemis = Math.max(12, Math.round(rangeOct * role.rangeMul * 12));
    var floorMidi = rootMidi - Math.round(windowSemis * .22);
    var ceilMidi = floorMidi + windowSemis;
    var onsets = buildRhythm(style, role, density, steps, rng, opts.occupancy, opts.avoid);
    var shape = opts.contour || rng.pick(style.contours);
    var contour = buildContour(shape, steps, span, rng);
    if (style.dronePull) {
      contour = contour.map(function(v) {
        return v * .28;
      });
    }
    var hr = opts.harmonicRhythm || style.harmonicRhythm;
    var prog = opts.progression || style.progression;
    function chordAt(i) {
      var slot = Math.floor(i / hr) % prog.length;
      return triadDegrees(prog[slot]);
    }
    var out = [], prevDegree = null, lastLeap = 0, notesUsed = [];
    var arpIndex = 0;
    for (var i = 0; i < steps; i++) {
      if (!onsets[i]) {
        out.push({
          rest: true
        });
        continue;
      }
      var chord = chordAt(i);
      var strong = METRIC[i % 16] >= 6;
      var degree;
      if (style.arp) {
        var span2 = Math.max(3, Math.round(span / 2));
        degree = chord[arpIndex % 3] + Math.floor(arpIndex / 3) * scaleLen;
        while (degree > span2) degree -= scaleLen;
        arpIndex++;
      } else if (prevDegree === null) {
        degree = rng.chance(.6) ? chord[0] : rng.pick(chord);
      } else {
        var target = contour[i];
        var candidates = [], weights = [];
        for (var d = -style.leapMax; d <= style.leapMax; d++) {
          if (d === 0 && !rng.chance(.12)) continue;
          var cand = prevDegree + d;
          if (cand < -scaleLen || cand > span + scaleLen) continue;
          var w = 1;
          w *= Math.abs(d) <= 1 ? style.stepBias * 4 : Math.abs(d) <= 2 ? 1.4 : Math.max(.15, 1 - Math.abs(d) * .12);
          if (style.intervalPool && style.intervalPool.indexOf(Math.abs(d)) !== -1) w *= 6;
          if (style.dronePull) {
            var fromRoot = Math.abs((cand % scaleLen + scaleLen) % scaleLen);
            w *= 1 + style.dronePull * 3 / (1 + fromRoot);
          }
          if (style.toneBias) {
            var pcIdx = (cand % scaleLen + scaleLen) % scaleLen;
            w *= style.toneBias.indexOf(pcIdx) !== -1 ? 5 : .08;
          }
          w *= 1 / (1 + Math.abs(cand - target) * .45);
          if (strong) {
            var isChordTone = chord.some(function(c) {
              return ((cand - c) % scaleLen + scaleLen) % scaleLen === 0;
            });
            w *= isChordTone ? 3.2 : .4;
          }
          if (role.rootPull > 0) {
            var isRoot = ((cand - chord[0]) % scaleLen + scaleLen) % scaleLen === 0;
            if (isRoot) w *= 1 + role.rootPull * 2;
          }
          if (lastLeap !== 0) {
            var sameWay = d > 0 === lastLeap > 0;
            if (sameWay && Math.abs(d) > 1) w *= .25;
            if (!sameWay && Math.abs(d) <= 2) w *= 2.2;
          }
          if (role.contrary && i > 0) {
            var wantUp = contour[i] > contour[i - 1];
            if (d > 0 === wantUp) w *= .6;
          }
          candidates.push(cand);
          weights.push(w);
        }
        if (!candidates.length) degree = prevDegree; else degree = rng.weighted(candidates, weights);
        var moved = degree - prevDegree;
        lastLeap = Math.abs(moved) > 2 ? moved : 0;
      }
      var oct = 0;
      if (rng.chance(style.octaveJump)) oct = rng.chance(.7) ? 1 : -1;
      var midi = degreeToMidi(degree, scale.pcs, rootMidi) + oct * 12;
      while (midi > ceilMidi) midi -= 12;
      while (midi < floorMidi) midi += 12;
      var notes = [ midi ];
      var poly = style.forceChord || role.poly;
      if (poly > 1) {
        for (var k = 1; k < poly; k++) {
          var up = style.cluster ? k : k * 2;
          if (style.suspend && k === 1 && rng.chance(style.suspend)) up = 3;
          notes.push(midi + (degreeToMidi(degree + up, scale.pcs, rootMidi) - degreeToMidi(degree, scale.pcs, rootMidi)));
        }
        notes = notes.filter(function(v, idx, a) {
          return a.indexOf(v) === idx;
        });
      }
      notes = notes.map(function(n) {
        while (n > ceilMidi) n -= 12;
        while (n < floorMidi) n += 12;
        return n;
      });
      var vel = 62 + Math.round(METRIC[i % 16] * 2.2);
      if (style.accentBeats && style.accentBeats.indexOf(i % 16) !== -1) vel += style.accentDepth;
      if (rng.chance(style.accent)) vel += style.accentDepth;
      if (prevDegree !== null && degree === prevDegree) vel -= 12;
      vel = Math.max(20, Math.min(127, vel + rng.int(-5, 5)));
      var gate = style.gate * role.gateMul * (1 + rng.range(-style.gateVary, style.gateVary));
      gate = Math.max(.08, Math.min(1.9, gate));
      var tie = rng.chance(style.tie);
      var shift = 0;
      if (style.swing && i % 2 === 1) shift += style.swing * .5;
      if (style.micro) shift += rng.range(-style.micro, style.micro) * .5;
      shift = Math.max(-.49, Math.min(.49, shift));
      var ratchet = 1;
      if (style.glitch) {
        if (rng.chance(style.glitch * .6)) ratchet = rng.pick([ 2, 3, 4 ]); else if (rng.chance(style.glitch * .35)) {
          out.push({
            rest: true
          });
          continue;
        }
      }
      out.push({
        rest: false,
        notes: notes,
        degree: degree,
        vel: vel,
        gate: gate,
        tie: tie,
        accent: vel > 100,
        chord: chord[0],
        shift: shift,
        ratchet: ratchet
      });
      notesUsed.push(midi);
      prevDegree = degree;
    }
    if (style.passing) {
      for (var pi = 1; pi < out.length - 1; pi++) {
        if (out[pi].rest || METRIC[pi % 16] >= 6) continue;
        var before = out[pi - 1], after = out[pi + 1];
        if (before.rest || after.rest) continue;
        var gapSemis = after.notes[0] - before.notes[0];
        var target = after.notes[0];
        var approach = null;
        if (Math.abs(gapSemis) === 2) {
          approach = before.notes[0] + (gapSemis > 0 ? 1 : -1);
        } else if (METRIC[(pi + 1) % 16] >= 6 && Math.abs(gapSemis) > 2) {
          approach = target + (rng.chance(.7) ? -1 : 1);
        }
        if (approach !== null && rng.chance(style.passing * 2.2)) {
          out[pi].notes = [ approach ];
          out[pi].passing = true;
          out[pi].vel = Math.max(24, out[pi].vel - 14);
        }
      }
    }
    if (style.cellLen) {
      for (var cy = style.cellLen; cy < out.length; cy++) {
        out[cy] = JSON.parse(JSON.stringify(out[cy % style.cellLen]));
        if (!out[cy].rest && rng.chance(style.octaveJump)) {
          out[cy].notes = out[cy].notes.map(function(n) {
            return n + 12;
          });
        }
      }
      for (var ac2 = 0; ac2 < out.length; ac2 += style.cellLen) {
        if (out[ac2] && !out[ac2].rest) out[ac2].vel = Math.min(127, out[ac2].vel + 18);
      }
    }
    if (style.motif && steps >= 32) {
      var barLen = 16;
      for (var mb = barLen; mb < out.length; mb++) {
        var src2 = out[mb % barLen];
        out[mb] = JSON.parse(JSON.stringify(src2));
      }
      var tweak = rng.int(barLen, out.length - 1);
      if (!out[tweak].rest) {
        out[tweak].notes = out[tweak].notes.map(function(n) {
          return n + 12;
        });
        out[tweak].vel = Math.min(127, out[tweak].vel + 15);
      }
    }
    if (style.mutate) {
      for (var mu = 0; mu < out.length; mu++) {
        if (!out[mu].rest && rng.chance(style.mutate)) {
          var dir = rng.chance(.5) ? 1 : -1;
          out[mu].degree += dir;
          out[mu].notes = [ degreeToMidi(out[mu].degree, scale.pcs, rootMidi) ];
        }
      }
    }
    if (style.cell) {
      var cellLen = rng.pick([ 5, 7, 9 ]);
      for (var j = cellLen; j < steps; j++) out[j] = JSON.parse(JSON.stringify(out[j % cellLen]));
    }
    var finalNotes = [];
    out.forEach(function(st) {
      if (!st.rest && st.notes) st.notes.forEach(function(n) {
        finalNotes.push(n);
      });
    });
    var lo = finalNotes.length ? Math.min.apply(null, finalNotes) : rootMidi;
    var hi = finalNotes.length ? Math.max.apply(null, finalNotes) : rootMidi;
    return {
      steps: out,
      meta: {
        style: styleKey,
        styleName: style.name,
        role: roleKey,
        roleName: role.name,
        scale: scaleKey,
        scaleName: scale.name,
        onDevice: scale.onDevice,
        root: rootPc,
        rootName: NOTE_NAMES[rootPc],
        octave: baseOctave,
        seed: seed,
        contour: shape,
        density: density,
        length: steps,
        low: lo,
        high: hi,
        lowName: noteName(lo),
        highName: noteName(hi),
        onsetCount: out.filter(function(s) {
          return !s.rest;
        }).length,
        progression: prog,
        harmonicRhythm: hr,
        range: rangeOct,
        floorMidi: floorMidi,
        ceilMidi: ceilMidi,
        scalePcs: scale.pcs,
        rootMidi: rootMidi
      }
    };
  }
  var PHRASINGS = {
    through: {
      name: "Through-composed",
      blurb: "One continuous line. No answering, no repetition.",
      parts: 1,
      relations: []
    },
    callResponse: {
      name: "Call and response",
      blurb: "Two linked phrases: the call states, the response answers.",
      parts: 2,
      relations: [ "answerGeneric" ]
    },
    variation: {
      name: "Call → Variation",
      blurb: "The response is the call mutated. Contour kept, intervals and rhythm altered.",
      parts: 2,
      relations: [ "variation" ]
    },
    answer: {
      name: "Call → Answer",
      blurb: "The response resolves the call. Lands on root or fifth, shorter and plainer.",
      parts: 2,
      relations: [ "answer" ],
      preferStrategy: "short"
    },
    echo: {
      name: "Call → Echo",
      blurb: "The response repeats the call with the intensity taken out of it.",
      parts: 2,
      relations: [ "echo" ],
      preferStrategy: "short"
    },
    contrast: {
      name: "Call → Contrast",
      blurb: "The response argues with the call. Opposite contour, different rhythm and density.",
      parts: 2,
      relations: [ "contrast" ]
    },
    questionAnswer: {
      name: "Question → Answer",
      blurb: "Classical phrasing. The question hangs on a non-root; the answer resolves.",
      parts: 2,
      relations: [ "questionAnswer" ]
    },
    themeVariation: {
      name: "Theme → Variation (A–A′)",
      blurb: "Same length, same shape, different intervals, accents and density.",
      parts: 2,
      relations: [ "themeVar" ],
      preferStrategy: "mirror"
    },
    twoPart: {
      name: "Two-part phrase (A–B)",
      blurb: "The second phrase is independent: new motif, new contour, new rhythm.",
      parts: 2,
      relations: [ "independent" ]
    },
    ternary: {
      name: "Ternary (A–B–A)",
      blurb: "Statement, contrast, return. The shape most long-form music uses.",
      parts: 3,
      relations: [ "contrast", "return" ]
    },
    loopGrowth: {
      name: "Loop growth",
      blurb: "Each phrase adds to the last. The Berlin School and minimalist engine.",
      parts: 4,
      relations: [ "growth", "growth", "growth" ],
      preferStrategy: "expansion"
    },
    cadential: {
      name: "Cadential",
      blurb: "A short resolving phrase to close a loop or a section.",
      parts: 2,
      relations: [ "cadence" ],
      preferStrategy: "cadential"
    }
  };
  var LENGTH_STRATEGIES = {
    mirror: {
      name: "Mirror — same length",
      resolve: function(c) {
        return c;
      }
    },
    short: {
      name: "Short answer — half",
      resolve: function(c) {
        return Math.max(4, Math.round(c / 2));
      }
    },
    long: {
      name: "Long answer — double",
      resolve: function(c) {
        return c * 2;
      }
    },
    independent: {
      name: "Independent — free",
      varies: true,
      resolve: function(c, rng) {
        return rng.pick([ 4, 6, 8, 12, 16, 24 ]);
      }
    },
    cadential: {
      name: "Cadential — 4 to 8, resolving",
      varies: true,
      resolve: function(c, rng) {
        return rng.pick([ 4, 6, 8 ]);
      }
    },
    expansion: {
      name: "Expansion — grows",
      resolve: function(c) {
        return Math.round(c * 1.5);
      }
    },
    compression: {
      name: "Compression — distilled",
      resolve: function(c) {
        return c;
      },
      thin: true
    }
  };
  function padToGrid(phrase, grid) {
    if (!grid || phrase.length % grid === 0) return phrase;
    var target = Math.ceil(phrase.length / grid) * grid;
    var out = phrase.slice();
    var added = target - phrase.length;
    for (var i = 0; i < added; i++) out.push({
      rest: true
    });
    var li = lastOnset(out);
    if (li >= 0) {
      var room = out.length - li;
      out[li].gate = Math.min(1.9, Math.max(out[li].gate || .5, Math.min(1.9, room * .45)));
    }
    return out;
  }
  function fitLength(phrase, target, rng, ctx) {
    var src = clone(phrase);
    if (src.length === target) return src;
    if (target < src.length) {
      var keep = src.map(function(s, i) {
        return {
          s: s,
          i: i,
          w: s.rest ? -1 : METRIC[i % 16] + (s.accent ? 4 : 0)
        };
      }).filter(function(o) {
        return o.w >= 0;
      }).sort(function(a, b) {
        return b.w - a.w;
      }).slice(0, Math.max(1, Math.round(target * .6))).map(function(o) {
        return o.i;
      });
      var out = [];
      for (var i = 0; i < target; i++) {
        var from = Math.round(i * src.length / target);
        out.push(keep.indexOf(from) !== -1 ? clone(src[from]) : {
          rest: true
        });
      }
      return out;
    }
    var grown = [];
    while (grown.length < target) {
      var chunk = clone(src);
      if (grown.length > 0) {
        chunk.forEach(function(st) {
          if (st.rest) return;
          if (rng.chance(.25)) st.degree += rng.pick([ -1, 1, 2 ]);
          if (rng.chance(.2)) st.vel = Math.min(127, st.vel + 10);
        });
      }
      grown = grown.concat(chunk);
    }
    return grown.slice(0, target);
  }
  function rebuild(phrase, ctx, dropOctave) {
    var floor = ctx.floorMidi - (dropOctave ? 12 : 0);
    var ceil = ctx.ceilMidi - (dropOctave ? 12 : 0);
    return phrase.map(function(s) {
      if (s.rest || s.degree === undefined) return s;
      var m = degreeToMidi(s.degree, ctx.scalePcs, ctx.rootMidi);
      while (m > ceil) m -= 12;
      while (m < floor) m += 12;
      s.notes = [ m ];
      return s;
    });
  }
  function lastOnset(phrase) {
    for (var i = phrase.length - 1; i >= 0; i--) if (!phrase[i].rest) return i;
    return -1;
  }
  function resolveTo(phrase, degree, ctx) {
    var i = lastOnset(phrase);
    if (i < 0) return phrase;
    phrase[i].degree = degree;
    phrase[i].gate = Math.min(1.9, (phrase[i].gate || .5) * 1.6);
    phrase[i].vel = Math.min(127, (phrase[i].vel || 90) + 8);
    return rebuild(phrase, ctx);
  }
  var RELATIONS = {
    answerGeneric: {
      resolves: "root",
      label: "answered",
      apply: function(call, ctx, rng) {
        var pivot = 0;
        call.some(function(s) {
          if (!s.rest) {
            pivot = s.degree;
            return true;
          }
          return false;
        });
        var out = clone(call).map(function(s) {
          if (s.rest) return s;
          s.degree = pivot * 2 - s.degree;
          return s;
        });
        return resolveTo(rebuild(out, ctx), ctx.chordRoot, ctx);
      }
    },
    variation: {
      label: "varied — same shape, new intervals",
      apply: function(call, ctx, rng) {
        var prev = null;
        var out = clone(call).map(function(s) {
          if (s.rest) return rng.chance(.2) ? {
            rest: true
          } : s;
          if (prev !== null) {
            var dir = s.degree >= prev ? 1 : -1;
            var size = rng.pick([ 1, 2, 3 ]);
            s.degree = prev + dir * size;
          }
          prev = s.degree;
          if (rng.chance(.3)) s.gate = Math.max(.1, s.gate * rng.range(.6, 1.5));
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    answer: {
      resolves: "rootOrFifth",
      label: "resolved — lands on root or fifth",
      apply: function(call, ctx, rng) {
        var out = clone(call).map(function(s, i) {
          if (s.rest) return s;
          if (METRIC[i % 16] < 4 && rng.chance(.45)) return {
            rest: true
          };
          s.vel = Math.max(30, s.vel - 6);
          return s;
        });
        return resolveTo(rebuild(out, ctx), rng.chance(.75) ? ctx.chordRoot : ctx.chordRoot + 4, ctx);
      }
    },
    echo: {
      label: "echoed — an octave down and quieter",
      apply: function(call, ctx, rng) {
        var out = clone(call).map(function(s, i) {
          if (s.rest) return s;
          if (METRIC[i % 16] < 4 && rng.chance(.4)) return {
            rest: true
          };
          s.degree -= ctx.scalePcs.length;
          s.vel = Math.max(22, Math.round(s.vel * .6));
          return s;
        });
        return rebuild(out, ctx, true);
      }
    },
    contrast: {
      label: "contrasted — opposite contour and density",
      apply: function(call, ctx, rng) {
        var dense = call.filter(function(s) {
          return !s.rest;
        }).length / call.length > .55;
        var pivot = 0;
        call.some(function(s) {
          if (!s.rest) {
            pivot = s.degree;
            return true;
          }
          return false;
        });
        var out = clone(call).map(function(s, i) {
          var strong = METRIC[i % 16] >= 6;
          if (dense) {
            if (!strong && rng.chance(.72)) return {
              rest: true
            };
          } else if (s.rest && rng.chance(.55)) {
            var fill = JSON.parse(JSON.stringify(call.find(function(c) {
              return !c.rest;
            }) || {
              rest: true
            }));
            if (fill.rest) return fill;
            fill.degree = pivot + rng.int(-2, 3);
            fill.vel = 70 + rng.int(0, 25);
            return fill;
          }
          if (s.rest) return s;
          s.degree = pivot * 2 - s.degree + rng.int(-1, 1);
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    questionAnswer: {
      resolves: "root",
      label: "answered — the question hung, the answer resolves",
      apply: function(call, ctx, rng) {
        var qi = lastOnset(call);
        if (qi >= 0) {
          call[qi].degree = ctx.chordRoot + rng.pick([ 1, 4, 6 ]);
          rebuild(call, ctx);
        }
        var out = clone(call).map(function(s, i) {
          if (s.rest) return s;
          if (METRIC[i % 16] < 4 && rng.chance(.35)) return {
            rest: true
          };
          s.degree = s.degree - rng.pick([ 1, 2 ]);
          return s;
        });
        return resolveTo(rebuild(out, ctx), ctx.chordRoot, ctx);
      }
    },
    themeVar: {
      label: "a variation — same bones, different detail",
      apply: function(call, ctx, rng) {
        var out = clone(call).map(function(s, i) {
          if (s.rest) return rng.chance(.18) ? clone(call[(i + 1) % call.length]) : s;
          if (rng.chance(.55)) s.degree += rng.pick([ -2, -1, 1, 2 ]);
          if (rng.chance(.4)) s.vel = Math.max(28, Math.min(127, s.vel + rng.int(-22, 26)));
          if (rng.chance(.3)) s.gate = Math.max(.1, s.gate * rng.range(.65, 1.6));
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    growth: {
      label: "grown — more material than the last",
      apply: function(call, ctx, rng) {
        var out = clone(call).map(function(s, i) {
          if (!s.rest) {
            if (rng.chance(.3)) s.vel = Math.min(127, s.vel + 9);
            return s;
          }
          if (rng.chance(.42)) {
            var src = call.find(function(c) {
              return !c.rest;
            });
            if (!src) return s;
            var add = JSON.parse(JSON.stringify(src));
            add.degree = src.degree + rng.pick([ -2, -1, 1, 2, 3 ]);
            add.vel = Math.max(40, src.vel - 10);
            return add;
          }
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    cadence: {
      resolves: "root",
      label: "a cadence — short and closing",
      apply: function(call, ctx, rng) {
        var pivot = ctx.chordRoot;
        var out = call.map(function(s, i) {
          if (METRIC[i % 16] < 5) return {
            rest: true
          };
          var c = JSON.parse(JSON.stringify(call.find(function(x) {
            return !x.rest;
          }) || {
            rest: true
          }));
          if (c.rest) return c;
          c.degree = pivot + (call.length - i > 2 ? 2 : 0);
          c.vel = 96;
          return c;
        });
        return resolveTo(rebuild(out, ctx), pivot, ctx);
      }
    },
    return: {
      label: "a return to the opening",
      apply: function(call) {
        return clone(call);
      }
    },
    independent: {
      label: "independent — new material",
      apply: null
    }
  };
  function generate(opts) {
    opts = opts || {};
    var modeKey = opts.phrasing || "through";
    var mode = PHRASINGS[modeKey] || PHRASINGS.through;
    if (mode.parts === 1) {
      var single = generateCore(opts);
      single.meta.phrasing = "through";
      single.meta.phrasingName = PHRASINGS.through.name;
      single.meta.phrases = [ {
        from: 0,
        length: single.steps.length,
        label: "through-composed"
      } ];
      return single;
    }
    var seed = opts.seed === undefined ? Date.now() & 65535 : opts.seed;
    var rng = makeRng(seed + 4177 >>> 0);
    var callLen = opts.callLength || 16;
    var grid = opts.phraseGrid === undefined ? 16 : opts.phraseGrid;
    var stratKey = opts.lengthStrategy || mode.preferStrategy || "mirror";
    var strat = LENGTH_STRATEGIES[stratKey] || LENGTH_STRATEGIES.mirror;
    var call = generateCore(Object.assign({}, opts, {
      steps: callLen,
      seed: seed
    }));
    var ctx = {
      scalePcs: call.meta.scalePcs,
      rootMidi: call.meta.rootMidi,
      floorMidi: call.meta.floorMidi,
      ceilMidi: call.meta.ceilMidi,
      chordRoot: call.meta.progression && call.meta.progression[0] || 0
    };
    var callPlaced = padToGrid(call.steps, grid);
    var phrases = [ {
      steps: callPlaced,
      label: "call",
      length: callPlaced.length,
      material: callLen
    } ];
    var prev = call.steps;
    for (var pi = 0; pi < mode.parts - 1; pi++) {
      var relKey = mode.relations[Math.min(pi, mode.relations.length - 1)];
      var rel = RELATIONS[relKey];
      var targetLen = relKey === "return" ? phrases[0].length : strat.resolve(callLen, rng);
      if (strat.thin) targetLen = callLen;
      var derived;
      if (relKey === "return") {
        derived = clone(phrases[0].steps);
      } else if (!rel.apply) {
        derived = generateCore(Object.assign({}, opts, {
          steps: targetLen,
          seed: seed + 7717 + pi * 131 & 65535
        })).steps;
      } else {
        derived = rel.apply(clone(prev), ctx, rng);
      }
      var dropped = relKey === "echo";
      if (derived.length !== targetLen) derived = fitLength(derived, targetLen, rng, ctx);
      derived = rebuild(derived, ctx, dropped);
      if (rel && rel.resolves) {
        var target = rel.resolves === "rootOrFifth" && rng.chance(.25) ? ctx.chordRoot + 4 : ctx.chordRoot;
        derived = resolveTo(derived, target, ctx);
        if (dropped) derived = rebuild(derived, ctx, true);
      }
      if (strat.thin && relKey !== "return") {
        derived = derived.map(function(st, i) {
          if (st.rest) return st;
          return METRIC[i % 16] >= 5 || rng.chance(.2) ? st : {
            rest: true
          };
        });
      }
      prev = derived;
      var placed = padToGrid(derived, grid);
      phrases.push({
        steps: placed,
        length: placed.length,
        material: derived.length,
        label: relKey === "return" ? "return" : rel.label || relKey
      });
    }
    var all = [], layout = [], cursor = 0;
    phrases.forEach(function(ph) {
      all = all.concat(ph.steps);
      layout.push({
        from: cursor,
        length: ph.length,
        material: ph.material,
        label: ph.label
      });
      cursor += ph.length;
    });
    var truncated = false;
    while (all.length > 64 && phrases.length > 1) {
      phrases.pop();
      layout.pop();
      all = phrases.reduce(function(a, ph) {
        return a.concat(ph.steps);
      }, []);
      truncated = true;
    }
    if (all.length > 64) {
      all = all.slice(0, 64);
      truncated = true;
    }
    var used = all.filter(function(st) {
      return !st.rest;
    }).reduce(function(a, st) {
      return a.concat(st.notes);
    }, []);
    return {
      steps: all,
      meta: Object.assign({}, call.meta, {
        length: all.length,
        onsetCount: all.filter(function(st) {
          return !st.rest;
        }).length,
        low: used.length ? Math.min.apply(null, used) : call.meta.low,
        high: used.length ? Math.max.apply(null, used) : call.meta.high,
        lowName: noteName(used.length ? Math.min.apply(null, used) : call.meta.low),
        highName: noteName(used.length ? Math.max.apply(null, used) : call.meta.high),
        phrasing: modeKey,
        phrasingName: mode.name,
        phraseGrid: grid,
        lengthStrategy: stratKey,
        lengthStrategyName: strat.name,
        phrases: layout,
        truncated: truncated,
        seed: seed
      })
    };
  }
  function developedLength(seedLen, target) {
    target = target || 64;
    return Math.min(target, seedLen * Math.max(1, Math.floor(target / seedLen)));
  }
  function projectedLength(modeKey, stratKey, callLen, grid) {
    var mode = PHRASINGS[modeKey] || PHRASINGS.through;
    callLen = callLen || 16;
    grid = grid === undefined ? 16 : grid;
    function place(n) {
      return grid ? Math.ceil(n / grid) * grid : n;
    }
    if (mode.parts === 1) return place(callLen);
    var strat = LENGTH_STRATEGIES[stratKey || mode.preferStrategy || "mirror"] || LENGTH_STRATEGIES.mirror;
    var lens = [ place(callLen) ];
    for (var i = 0; i < mode.parts - 1; i++) {
      var relKey = mode.relations[Math.min(i, mode.relations.length - 1)];
      var n = relKey === "return" ? callLen : strat.thin ? callLen : strat.resolve(callLen, {
        pick: function(a) {
          return a[Math.floor(a.length / 2)];
        }
      });
      lens.push(place(n));
    }
    var total = 0;
    for (var k = 0; k < lens.length; k++) {
      if (total + lens[k] > 64) break;
      total += lens[k];
    }
    return total || lens[0];
  }
  var OPS = {
    repeat: {
      label: "Restated unchanged",
      apply: function(bar) {
        return clone(bar);
      }
    },
    transposeUp: {
      label: "Transposed up a third within the scale",
      apply: function(bar, ctx) {
        return shiftDegrees(bar, 2, ctx);
      }
    },
    transposeDown: {
      label: "Transposed down a step within the scale",
      apply: function(bar, ctx) {
        return shiftDegrees(bar, -1, ctx);
      }
    },
    retrogradeHalf: {
      label: "Second half played backwards",
      apply: function(bar) {
        var b = clone(bar), half = Math.floor(b.length / 2);
        var tail = b.slice(half).reverse();
        return b.slice(0, half).concat(tail);
      }
    },
    octavePeak: {
      label: "Highest note displaced an octave up",
      apply: function(bar, ctx) {
        var b = clone(bar), best = -1, bestVal = -Infinity;
        b.forEach(function(s, i) {
          if (!s.rest && s.notes[0] > bestVal) {
            bestVal = s.notes[0];
            best = i;
          }
        });
        if (best >= 0) b[best].notes = b[best].notes.map(function(n) {
          return fold(n + 12, ctx);
        });
        return b;
      }
    },
    thinOut: {
      label: "Thinned to the strong beats",
      apply: function(bar) {
        return clone(bar).map(function(s, i) {
          return METRIC[i % 16] >= 4 ? s : {
            rest: true
          };
        });
      }
    },
    crescendo: {
      label: "Velocity rising across the bar",
      apply: function(bar) {
        var b = clone(bar), n = b.length;
        b.forEach(function(s, i) {
          if (!s.rest) s.vel = Math.max(20, Math.min(127, Math.round(s.vel * (.78 + .42 * (i / n)))));
        });
        return b;
      }
    },
    longGates: {
      label: "Gates opened out for a legato feel",
      apply: function(bar) {
        var b = clone(bar);
        b.forEach(function(s) {
          if (!s.rest) s.gate = Math.min(1.9, s.gate * 1.9);
        });
        return b;
      }
    },
    turnaround: {
      label: "Last two steps rewritten as a turnaround back to the top",
      apply: function(bar, ctx) {
        var b = clone(bar), n = b.length;
        var lead = ctx.firstDegree === null ? 0 : ctx.firstDegree;
        for (var i = n - 2; i < n; i++) {
          var deg = lead - (n - i);
          b[i] = {
            rest: false,
            notes: [ degreeToMidi(deg, ctx.scalePcs, ctx.rootMidi) ],
            degree: deg,
            vel: 92 + (i - (n - 2)) * 12,
            gate: .5,
            tie: false,
            accent: false
          };
        }
        return b;
      }
    }
  };
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  function shiftDegrees(bar, delta, ctx) {
    return clone(bar).map(function(s) {
      if (s.rest) return s;
      var deg = (s.degree === undefined ? 0 : s.degree) + delta;
      s.degree = deg;
      var interval = degreeToMidi(deg, ctx.scalePcs, ctx.rootMidi) - degreeToMidi(s.degree - delta, ctx.scalePcs, ctx.rootMidi);
      s.notes = s.notes.map(function(n) {
        return fold(n + interval, ctx);
      });
      return s;
    });
  }
  function fold(midi, ctx) {
    if (!ctx.ceilMidi) return midi;
    while (midi > ctx.ceilMidi) midi -= 12;
    while (midi < ctx.floorMidi) midi += 12;
    return midi;
  }
  var PLAN = [ [ "repeat" ], [ "transposeUp", "retrogradeHalf", "transposeDown" ], [ "octavePeak", "thinOut", "transposeUp", "longGates" ], [ "crescendo", "turnaround", "repeat" ] ];
  function planFor(n) {
    if (n <= 1) return [ PLAN[0] ];
    if (n === 2) return [ PLAN[0], [ "transposeUp", "octavePeak", "crescendo" ] ];
    if (n === 3) return [ PLAN[0], PLAN[1], PLAN[3] ];
    return PLAN;
  }
  function develop(pattern, opts) {
    opts = opts || {};
    var m = pattern.meta;
    var scale = SCALES[m.scale] || SCALES.minor;
    var role = ROLES[m.role] || ROLES.lead;
    var rootMidi = (m.octave + 1) * 12 + m.root + role.octave * 12;
    var rng = makeRng(m.seed + 7919 >>> 0);
    var firstDegree = null;
    pattern.steps.some(function(s) {
      if (!s.rest) {
        firstDegree = s.degree;
        return true;
      }
      return false;
    });
    var ctx = {
      scalePcs: scale.pcs,
      rootMidi: rootMidi,
      firstDegree: firstDegree,
      floorMidi: rootMidi - Math.round(Math.max(12, (m.range || 2) * role.rangeMul * 12) * .22),
      ceilMidi: rootMidi - Math.round(Math.max(12, (m.range || 2) * role.rangeMul * 12) * .22) + Math.max(12, Math.round((m.range || 2) * role.rangeMul * 12))
    };
    var target = opts.target || 64;
    var seedLen = pattern.steps.length;
    var repeats = Math.max(1, Math.floor(target / seedLen));
    var plan = planFor(repeats);
    var last = repeats - 1;
    var bars = [], applied = [];
    var prog = m.progression || [ 0, 0, 0, 0 ];
    for (var b = 0; b < repeats; b++) {
      var opKey = opts.ops && opts.ops[b] ? opts.ops[b] : rng.pick(plan[b]);
      var bar = OPS[opKey].apply(pattern.steps, ctx);
      var chordShift = prog[b % prog.length] - prog[0];
      if (chordShift !== 0) bar = shiftDegrees(bar, chordShift, ctx);
      if (b === last && opKey !== "turnaround" && rng.chance(.7)) {
        bar = OPS.turnaround.apply(bar, ctx);
        applied.push({
          bar: b + 1,
          op: opKey,
          label: OPS[opKey].label + ", then a turnaround"
        });
      } else {
        applied.push({
          bar: b + 1,
          op: opKey,
          label: OPS[opKey].label
        });
      }
      bars.push(bar);
    }
    var steps = bars.reduce(function(a, b2) {
      return a.concat(b2);
    }, []);
    if (steps.length > target) steps = steps.slice(0, target);
    var used = steps.filter(function(s) {
      return !s.rest;
    }).map(function(s) {
      return s.notes[0];
    });
    return {
      steps: steps,
      bars: bars,
      meta: Object.assign({}, m, {
        length: steps.length,
        developedFrom: m.seed,
        operations: applied,
        low: used.length ? Math.min.apply(null, used) : rootMidi,
        high: used.length ? Math.max.apply(null, used) : rootMidi,
        onsetCount: used.length
      })
    };
  }
  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }
  function lcm(a, b) {
    return a * b / gcd(a, b);
  }
  function cycleLength(lengths) {
    return lengths.reduce(function(acc, n) {
      return lcm(acc, n);
    }, 1);
  }
  var LENGTH_PRESETS = {
    aligned: {
      name: "Aligned (16/16/16/16)",
      lengths: [ 16, 16, 16, 16 ]
    },
    slipping: {
      name: "Slipping (16/15/14/13)",
      lengths: [ 16, 15, 14, 13 ]
    },
    drifting: {
      name: "Drifting (16/12/15/14)",
      lengths: [ 16, 12, 15, 14 ]
    },
    ratio: {
      name: "Ratio 4:3:2 (16/12/8/6)",
      lengths: [ 16, 12, 8, 6 ]
    },
    wide: {
      name: "Wide drift (16/9/11/13)",
      lengths: [ 16, 9, 11, 13 ]
    },
    subtle: {
      name: "Subtle (16/16/15/16)",
      lengths: [ 16, 16, 15, 16 ]
    }
  };
  var ENSEMBLE_ROLES = [ "bass", "lead", "counter", "pad" ];
  function ensemble(opts) {
    opts = opts || {};
    var count = Math.max(2, Math.min(4, opts.count || 3));
    var preset = LENGTH_PRESETS[opts.preset || "drifting"];
    var lengths = (opts.lengths || preset.lengths).slice(0, count);
    var seed = opts.seed === undefined ? Date.now() & 65535 : opts.seed;
    var roles = opts.roles || ENSEMBLE_ROLES.slice(0, count);
    var thin = opts.space === undefined ? 1 : opts.space;
    var perTrack = (opts.density || .6) / (1 + .42 * (count - 1) * thin);
    var occupancy = new Array(16);
    for (var z = 0; z < 16; z++) occupancy[z] = 0;
    var tracks = [];
    for (var t = 0; t < count; t++) {
      var len = lengths[t];
      var pattern = generateCore({
        style: opts.style || "berlin",
        role: roles[t],
        scale: opts.scale,
        root: opts.root,
        octave: opts.octave,
        steps: len,
        seed: seed + t * 1013 & 65535,
        density: perTrack * (roles[t] === "bass" ? 1.15 : 1),
        range: opts.range,
        occupancy: occupancy,
        avoid: t === 0 ? 0 : 1.6 + thin * .8,
        phrasing: opts.phrasing
      });
      pattern.steps.forEach(function(s, i) {
        if (!s.rest) occupancy[i % 16] += 1;
      });
      pattern.meta.trackLength = len;
      tracks.push({
        index: t + 1,
        role: roles[t],
        length: len,
        pattern: pattern
      });
    }
    var cycle = cycleLength(lengths);
    var densest = 0;
    for (var q = 0; q < 16; q++) densest = Math.max(densest, occupancy[q]);
    return {
      tracks: tracks,
      lengths: lengths,
      cycle: cycle,
      cycleBars: cycle / 16,
      occupancy: occupancy,
      maxStack: densest,
      preset: opts.preset || "drifting",
      seed: seed
    };
  }
  window.KSPGen = {
    LENGTH_PRESETS: LENGTH_PRESETS,
    ensemble: ensemble,
    PHRASINGS: PHRASINGS,
    LENGTH_STRATEGIES: LENGTH_STRATEGIES,
    RELATIONS: RELATIONS,
    projectedLength: projectedLength,
    padToGrid: padToGrid,
    developedLength: developedLength,
    SCALES: SCALES,
    STYLES: STYLES,
    ROLES: ROLES,
    METRIC: METRIC,
    NOTE_NAMES: NOTE_NAMES,
    OPS: OPS,
    generate: generate,
    develop: develop,
    cycleLength: cycleLength,
    lcm: lcm,
    gcd: gcd,
    noteName: noteName,
    degreeToMidi: degreeToMidi,
    makeRng: makeRng
  };
})();