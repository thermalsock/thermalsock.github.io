/* Thermalsock Labs — KeyStep Pro pattern engine.
 *
 * The difference between a melody generator and a random note picker is that
 * this one commits to two things before it chooses a single pitch: a harmonic
 * frame, and a contour. Every note is then chosen to serve those. Notes on
 * strong beats land on chord tones, motion is stepwise by default, and a leap
 * is answered by a step back the other way — the same rules a human writing a
 * bassline follows without thinking about it.
 *
 * Everything is driven by a seeded PRNG, so a pattern you like can be
 * reproduced exactly and then developed into 64 steps. That reproducibility is
 * the whole point of the "confirm the 16, then build the 64" workflow.
 *
 * Plain script, no build step. window.KSPGen.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Seeded randomness. Math.random would make "regenerate the one I liked"
     impossible, and that workflow is the product.
     ------------------------------------------------------------------ */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    var rnd = mulberry32(seed);
    return {
      next: rnd,
      range: function (lo, hi) { return lo + rnd() * (hi - lo); },
      int: function (lo, hi) { return Math.floor(lo + rnd() * (hi - lo + 1)); },
      chance: function (p) { return rnd() < p; },
      pick: function (arr) { return arr[Math.floor(rnd() * arr.length)]; },
      /* weighted pick: weights need not sum to 1 */
      weighted: function (items, weights) {
        var total = 0, i;
        for (i = 0; i < weights.length; i++) total += weights[i];
        var r = rnd() * total;
        for (i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
        return items[items.length - 1];
      }
    };
  }

  /* ------------------------------------------------------------------
     Scales. The `onDevice` flag marks the ones the KeyStep Pro can itself
     quantise to — if we generate outside that set and the user has the
     hardware scale engaged, the box will silently bend our notes.
     ------------------------------------------------------------------ */
  var SCALES = {
    chromatic:  { name: 'Chromatic',       pcs: [0,1,2,3,4,5,6,7,8,9,10,11], onDevice: true },
    major:      { name: 'Major',           pcs: [0,2,4,5,7,9,11],            onDevice: true },
    minor:      { name: 'Minor (Aeolian)', pcs: [0,2,3,5,7,8,10],            onDevice: true },
    dorian:     { name: 'Dorian',          pcs: [0,2,3,5,7,9,10],            onDevice: true },
    mixolydian: { name: 'Mixolydian',      pcs: [0,2,4,5,7,9,10],            onDevice: true },
    harmonic:   { name: 'Harmonic Minor',  pcs: [0,2,3,5,7,8,11],            onDevice: true },
    blues:      { name: 'Blues',           pcs: [0,3,5,6,7,10],              onDevice: true },
    phrygian:   { name: 'Phrygian',        pcs: [0,1,3,5,7,8,10],            onDevice: false },
    lydian:     { name: 'Lydian',          pcs: [0,2,4,6,7,9,11],            onDevice: false },
    pentMinor:  { name: 'Minor Pentatonic',pcs: [0,3,5,7,10],                onDevice: false },
    wholeTone:  { name: 'Whole Tone',      pcs: [0,2,4,6,8,10],              onDevice: false },
    octatonic:  { name: 'Octatonic',       pcs: [0,2,3,5,6,8,9,11],          onDevice: false }
  };

  var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  /* ------------------------------------------------------------------
     Styles. Each is a rule set, not a preset of notes: interval appetite,
     rest density, syncopation, accent behaviour, gate character, and the
     harmonic rhythm the style implies.
     ------------------------------------------------------------------ */
  var STYLES = {
    berlin: {
      name: 'Berlin School',
      blurb: 'Tangerine Dream, Schulze. Dense 16ths, narrow range, relentless motion.',
      density: 0.85, syncopation: 0.15, restRun: 0.1,
      stepBias: 0.72, leapMax: 4, octaveJump: 0.12,
      gate: 0.35, gateVary: 0.15, tie: 0.05,
      accent: 0.25, accentDepth: 30,
      range: 2, harmonicRhythm: 16,
      contours: ['wave', 'arch', 'rise'],
      progression: [0, 0, 5, 5],
      scaleHint: 'minor'
    },
    acid: {
      name: 'Acid Line',
      blurb: '303 vocabulary. Octave jumps, slides, hard accents, one chord.',
      density: 0.75, syncopation: 0.45, restRun: 0.25,
      stepBias: 0.5, leapMax: 7, octaveJump: 0.3,
      gate: 0.5, gateVary: 0.35, tie: 0.22,
      accent: 0.35, accentDepth: 45,
      range: 2, harmonicRhythm: 16,
      contours: ['wave', 'valley', 'static'],
      progression: [0, 0, 0, 0],
      scaleHint: 'pentMinor'
    },
    motorik: {
      name: 'Motorik',
      blurb: 'Neu!, Kraftwerk. Steady pulse, few pitches, forward momentum.',
      density: 0.65, syncopation: 0.08, restRun: 0.15,
      stepBias: 0.85, leapMax: 3, octaveJump: 0.05,
      gate: 0.45, gateVary: 0.1, tie: 0.08,
      accent: 0.2, accentDepth: 25,
      range: 1, harmonicRhythm: 16,
      contours: ['static', 'rise', 'wave'],
      progression: [0, 0, 4, 4],
      scaleHint: 'dorian'
    },
    phase: {
      name: 'Minimal / Phase',
      blurb: 'Reich. A short cell, repeated, designed to drift against itself.',
      density: 0.7, syncopation: 0.1, restRun: 0.1,
      stepBias: 0.8, leapMax: 4, octaveJump: 0.02,
      gate: 0.4, gateVary: 0.05, tie: 0.02,
      accent: 0.15, accentDepth: 18,
      range: 1, harmonicRhythm: 16,
      contours: ['wave', 'arch'],
      progression: [0, 0, 0, 0],
      cell: true,
      scaleHint: 'major'
    },
    cinematic: {
      name: 'Cinematic',
      blurb: 'Vangelis. Sparse, long gates, wide arcs, plenty of air.',
      density: 0.4, syncopation: 0.12, restRun: 0.4,
      stepBias: 0.65, leapMax: 6, octaveJump: 0.06,
      gate: 0.85, gateVary: 0.2, tie: 0.3,
      accent: 0.15, accentDepth: 20,
      range: 2, harmonicRhythm: 8,
      contours: ['arch', 'rise', 'fall'],
      progression: [0, 5, 3, 4],
      scaleHint: 'lydian'
    },
    detroit: {
      name: 'Detroit',
      blurb: 'Syncopated, chord-driven, sevenths over a moving bass.',
      density: 0.55, syncopation: 0.55, restRun: 0.25,
      stepBias: 0.6, leapMax: 5, octaveJump: 0.15,
      gate: 0.5, gateVary: 0.25, tie: 0.1,
      accent: 0.3, accentDepth: 35,
      range: 2, harmonicRhythm: 8,
      contours: ['wave', 'valley'],
      progression: [0, 5, 1, 4],
      scaleHint: 'minor'
    },
    neoambient: {
      name: 'Neo-Ambient Arp',
      blurb: 'Slow and wide. Fifths, ninths and suspensions, with a lot of air between them.',
      density: 0.3, syncopation: 0.05, restRun: 0.55,
      stepBias: 0.2, leapMax: 8, octaveJump: 0.1,
      gate: 1.5, gateVary: 0.25, tie: 0.4,
      accent: 0.08, accentDepth: 14,
      range: 2.5, harmonicRhythm: 16,
      contours: ['arch', 'rise', 'static'],
      progression: [0, 3, 0, 4],
      intervalPool: [4, 5, 8, 3],        /* fifths, ninths, sixths in degrees */
      suspend: 0.45,
      scaleHint: 'lydian'
    },
    idm: {
      name: 'IDM / Glitch Arp',
      blurb: 'Irregular cells, micro-shifted timing, notes that break and stutter.',
      density: 0.62, syncopation: 0.6, restRun: 0.3,
      stepBias: 0.45, leapMax: 7, octaveJump: 0.22,
      gate: 0.3, gateVary: 0.55, tie: 0.05,
      accent: 0.4, accentDepth: 40,
      range: 2, harmonicRhythm: 8,
      contours: ['wave', 'valley', 'static'],
      progression: [0, 4, 2, 6],
      micro: 0.28, glitch: 0.18, irregular: true,
      scaleHint: 'octatonic'
    },
    trance: {
      name: 'Trance Gate',
      blurb: 'Root and fifth, hammered. Bright, predictable, hypnotic.',
      density: 0.95, syncopation: 0.05, restRun: 0.08,
      stepBias: 0.5, leapMax: 5, octaveJump: 0.18,
      gate: 0.28, gateVary: 0.06, tie: 0,
      accent: 0.3, accentDepth: 28,
      range: 2, harmonicRhythm: 16,
      contours: ['static', 'wave'],
      progression: [0, 0, 5, 5],
      toneBias: [0, 4],                  /* root and fifth only */
      accentBeats: [0, 4, 8, 12],
      scaleHint: 'minor'
    },
    synthwave: {
      name: 'Synthwave / Outrun',
      blurb: 'Aeolian, a two-bar motif, root-fifth-octave jumps, accents on 1 and 3.',
      density: 0.7, syncopation: 0.15, restRun: 0.18,
      stepBias: 0.45, leapMax: 7, octaveJump: 0.28,
      gate: 0.45, gateVary: 0.12, tie: 0.08,
      accent: 0.2, accentDepth: 34,
      range: 2, harmonicRhythm: 16,
      contours: ['wave', 'rise'],
      progression: [0, 5, 3, 4],
      intervalPool: [4, 7, 3],
      accentBeats: [0, 8],
      motif: 2,
      scaleHint: 'minor'
    },
    dubtechno: {
      name: 'Dub Techno Stabs',
      blurb: 'Very sparse chords rather than notes, pushed off the grid, heavily swung.',
      density: 0.22, syncopation: 0.7, restRun: 0.6,
      stepBias: 0.5, leapMax: 4, octaveJump: 0.05,
      gate: 0.7, gateVary: 0.3, tie: 0.1,
      accent: 0.25, accentDepth: 26,
      range: 1.5, harmonicRhythm: 16,
      contours: ['static', 'valley'],
      progression: [0, 0, 3, 3],
      forceChord: 3, swing: 0.42, micro: 0.2,
      scaleHint: 'dorian'
    },
    psybient: {
      name: 'Psybient / Drone Motion',
      blurb: 'Notes orbit a drone root. Very slow movement, modal, clustered.',
      density: 0.35, syncopation: 0.1, restRun: 0.45,
      stepBias: 0.9, leapMax: 3, octaveJump: 0.04,
      gate: 1.4, gateVary: 0.2, tie: 0.35,
      accent: 0.08, accentDepth: 12,
      range: 1.5, harmonicRhythm: 16,
      contours: ['static', 'wave'],
      progression: [0, 0, 0, 0],
      dronePull: 0.55, cluster: true,
      scaleHint: 'phrygian'
    },
    additive: {
      name: 'Minimalist Classical',
      blurb: 'Reich and Glass. A cell that grows a note at a time, then mutates.',
      density: 0.8, syncopation: 0.05, restRun: 0.1,
      stepBias: 0.9, leapMax: 3, octaveJump: 0.02,
      gate: 0.42, gateVary: 0.05, tie: 0.02,
      accent: 0.12, accentDepth: 16,
      range: 1.5, harmonicRhythm: 16,
      contours: ['wave', 'arch'],
      progression: [0, 0, 0, 0],
      additive: true, mutate: 0.18,
      scaleHint: 'major'
    },
    electro: {
      name: 'Electro Bassline',
      blurb: 'Root, octave, seventh, with chromatic passing tones. Detroit and acid crossed.',
      density: 0.72, syncopation: 0.5, restRun: 0.2,
      stepBias: 0.5, leapMax: 7, octaveJump: 0.32,
      gate: 0.4, gateVary: 0.25, tie: 0.12,
      accent: 0.32, accentDepth: 38,
      range: 1.5, harmonicRhythm: 16,
      contours: ['valley', 'wave'],
      progression: [0, 0, 6, 0],
      intervalPool: [7, 6, 4], passing: 0.22,
      scaleHint: 'minor'
    },
    breakbeat: {
      name: 'Breakbeat Arp',
      blurb: 'Syncopated accents, notes nudged off the grid, pentatonic with blue notes.',
      density: 0.6, syncopation: 0.65, restRun: 0.3,
      stepBias: 0.55, leapMax: 5, octaveJump: 0.18,
      gate: 0.35, gateVary: 0.3, tie: 0.06,
      accent: 0.4, accentDepth: 42,
      range: 2, harmonicRhythm: 16,
      contours: ['wave', 'valley'],
      progression: [0, 0, 4, 0],
      micro: 0.22, swing: 0.2,
      scaleHint: 'blues'
    },
    pulse: {
      name: 'Cinematic Pulse',
      blurb: 'Low ostinato, one rhythmic cell repeating, the occasional octave lift.',
      density: 0.78, syncopation: 0.1, restRun: 0.12,
      stepBias: 0.8, leapMax: 4, octaveJump: 0.14,
      gate: 0.32, gateVary: 0.1, tie: 0.04,
      accent: 0.22, accentDepth: 30,
      range: 1.5, harmonicRhythm: 16,
      contours: ['static', 'rise'],
      progression: [0, 0, 5, 4],
      cellLen: 4, accentBeats: [0, 8],
      scaleHint: 'harmonic'
    },
    arpeggio: {
      name: 'Classic Arpeggio',
      blurb: 'Straight chord tones, up and down. The reliable one.',
      density: 1.0, syncopation: 0, restRun: 0,
      stepBias: 0.3, leapMax: 8, octaveJump: 0.2,
      gate: 0.4, gateVary: 0.05, tie: 0,
      accent: 0.25, accentDepth: 22,
      range: 2, harmonicRhythm: 16,
      contours: ['rise'],
      progression: [0, 0, 0, 0],
      arp: true,
      scaleHint: 'minor'
    }
  };

  /* ------------------------------------------------------------------
     Track roles. Tracks 1-4 usually drive four different voices, so the
     generator needs to know whether it is writing a bassline or a pad.
     ------------------------------------------------------------------ */
  var ROLES = {
    bass:    { name: 'Bass',    octave: -1, densityMul: 0.8, rangeMul: 0.6, rootPull: 0.55, poly: 1, gateMul: 0.9 },
    lead:    { name: 'Lead',    octave: 1,  densityMul: 1.0, rangeMul: 1.2, rootPull: 0.2,  poly: 1, gateMul: 1.0 },
    counter: { name: 'Counter', octave: 0,  densityMul: 0.9, rangeMul: 1.0, rootPull: 0.25, poly: 1, gateMul: 1.0, contrary: true },
    pad:     { name: 'Pad',     octave: 0,  densityMul: 0.35, rangeMul: 0.8, rootPull: 0.4, poly: 3, gateMul: 1.8 }
  };

  /* Metric weight of each of the 16 positions. The downbeat is strongest,
     then the other beats, then the eighths, then the sixteenths. This is what
     makes generated rhythm feel placed rather than sprinkled. */
  var METRIC = [10, 1, 4, 2, 7, 1, 4, 2, 8, 1, 4, 2, 6, 1, 5, 3];

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  /* Convert a scale degree (can go below 0 or above the scale length) into a
     MIDI note, wrapping octaves as it goes. */
  function degreeToMidi(degree, scalePcs, rootMidi) {
    var n = scalePcs.length;
    var oct = Math.floor(degree / n);
    var idx = ((degree % n) + n) % n;
    return rootMidi + oct * 12 + scalePcs[idx];
  }

  /* The triad sitting on a scale degree, as degree offsets. Using scale
     degrees rather than fixed intervals keeps everything diatonic for free. */
  function triadDegrees(rootDegree) {
    return [rootDegree, rootDegree + 2, rootDegree + 4];
  }

  function noteName(midi) {
    return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  /* Contour: a target scale degree for each of the 16 positions. The melody
     does not have to hit these exactly — they are gravity, not rails. */
  function buildContour(shape, steps, span, rng) {
    var out = [], i, t;
    for (i = 0; i < steps; i++) {
      t = i / (steps - 1);
      var v;
      switch (shape) {
        case 'rise':   v = t; break;
        case 'fall':   v = 1 - t; break;
        case 'arch':   v = Math.sin(t * Math.PI); break;
        case 'valley': v = 1 - Math.sin(t * Math.PI); break;
        case 'wave':   v = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2); break;
        default:       v = 0.5; break;   /* static */
      }
      out.push(v * span);
    }
    return out;
  }

  /* ------------------------------------------------------------------
     Rhythm: which of the 16 positions carry a note.
     ------------------------------------------------------------------ */
  function buildRhythm(style, role, density, steps, rng, occupancy, avoid) {
    var onsets = new Array(steps), i;
    var d = Math.max(0.05, Math.min(1, density * role.densityMul));

    if (style.arp && !occupancy) {
      for (i = 0; i < steps; i++) onsets[i] = true;
      return onsets;
    }

    /* Additive process: a cell of one note, then two, then three, each group
       separated by a rest. Glass and Reich build whole pieces this way, and it
       is a rhythm you cannot get out of a probability per step. */
    if (style.additive) {
      for (i = 0; i < steps; i++) onsets[i] = false;
      var at = 0, group = 1;
      while (at < steps) {
        for (var q = 0; q < group && at < steps; q++) onsets[at++] = true;
        at++;                                   /* the rest between groups */
        group++;
        if (group > 5) group = 1;
      }
      return onsets;
    }

    /* IDM works in uneven cells rather than a steady grid. */
    if (style.irregular) {
      for (i = 0; i < steps; i++) onsets[i] = false;
      var pos = 0;
      var cells = [3, 5, 2, 7, 3, 4, 2, 5];
      var ci = rng.int(0, cells.length - 1);
      while (pos < steps) {
        onsets[pos] = true;
        var len = cells[ci % cells.length];
        ci++;
        for (var w = 1; w < len && pos + w < steps; w++) {
          onsets[pos + w] = rng.chance(0.35);
        }
        pos += len;
      }
      return onsets;
    }

    for (i = 0; i < steps; i++) {
      var m = METRIC[i % 16] / 10;
      /* Syncopation lifts the weak positions and shaves the strong ones, which
         is what actually produces a syncopated feel rather than just noise. */
      var weight = m * (1 - style.syncopation) + (1 - m) * style.syncopation;
      var p = d * 0.55 + weight * 0.75 * d;
      /* Hocket. When other tracks already occupy a position, back off it. This
         is the whole difference between a polyrhythm and a pile-up: the parts
         have to leave each other room, not just run at different lengths. */
      if (occupancy) p /= (1 + occupancy[i % occupancy.length] * (avoid === undefined ? 1.9 : avoid));
      onsets[i] = rng.next() < p;
    }
    /* The downbeat carries the pattern. Rests there are a deliberate choice,
       not an accident of the dice — but in an ensemble only the first part
       gets that guarantee, or all four pile onto step 1 and the polyrhythm
       announces itself as a unison thud every cycle. */
    var claimDownbeat = !occupancy || occupancy[0] === 0;
    if (claimDownbeat && !onsets[0] && !rng.chance(style.restRun * 0.5)) onsets[0] = true;

    /* Break up runs of rests longer than the style tolerates. In an ensemble
       long rests are the point, so the tolerance widens — and when a run does
       have to be broken, the note goes in the emptiest slot rather than
       wherever the counter happened to trip, which is how four sparse parts
       ended up landing on the same step. */
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
              if (occ < best) { best = occ; put = k; }
            }
          }
          onsets[put] = true; run = 0;
        }
      } else run = 0;
    }
    return onsets;
  }

  /* ------------------------------------------------------------------
     The main generator.
     ------------------------------------------------------------------ */
  function generateCore(opts) {
    opts = opts || {};
    var styleKey = opts.style || 'berlin';
    var style = STYLES[styleKey] || STYLES.berlin;
    var roleKey = opts.role || 'lead';
    var role = ROLES[roleKey] || ROLES.lead;
    var scaleKey = opts.scale || style.scaleHint || 'minor';
    var scale = SCALES[scaleKey] || SCALES.minor;
    var steps = opts.steps || 16;
    var rootPc = opts.root === undefined ? 2 : opts.root;      /* default D */
    var baseOctave = opts.octave === undefined ? 3 : opts.octave;
    var seed = opts.seed === undefined ? (Date.now() & 0xFFFF) : opts.seed;
    var density = opts.density === undefined ? style.density : opts.density;
    var rangeOct = opts.range === undefined ? style.range : opts.range;

    var rng = makeRng(seed);
    var rootMidi = (baseOctave + 1) * 12 + rootPc + role.octave * 12;
    var scaleLen = scale.pcs.length;
    var span = Math.max(2, Math.round(rangeOct * role.rangeMul * scaleLen));

    /* The working register, in semitones rather than rounded-up octaves.
       Rounding 2.4 octaves up to 3 and then allowing slack underneath turned a
       two-octave request into three and a half. */
    var windowSemis = Math.max(12, Math.round(rangeOct * role.rangeMul * 12));
    var floorMidi = rootMidi - Math.round(windowSemis * 0.22);
    var ceilMidi = floorMidi + windowSemis;

    var onsets = buildRhythm(style, role, density, steps, rng, opts.occupancy, opts.avoid);
    var shape = opts.contour || rng.pick(style.contours);
    var contour = buildContour(shape, steps, span, rng);

    /* A drone orbits its root. The contour is gravity toward the middle of the
       register by default, which fights the drone pull and wins — so for these
       styles the gravity has to sit on the root instead. */
    if (style.dronePull) {
      contour = contour.map(function (v) { return v * 0.28; });
    }

    /* Harmonic frame: which chord is in force at each step. */
    var hr = opts.harmonicRhythm || style.harmonicRhythm;
    var prog = opts.progression || style.progression;
    function chordAt(i) {
      var slot = Math.floor(i / hr) % prog.length;
      return triadDegrees(prog[slot]);
    }

    var out = [], prevDegree = null, lastLeap = 0, notesUsed = [];
    var arpIndex = 0;

    for (var i = 0; i < steps; i++) {
      if (!onsets[i]) { out.push({ rest: true }); continue; }

      var chord = chordAt(i);
      var strong = METRIC[i % 16] >= 6;
      var degree;

      if (style.arp) {
        /* Straight chord tones cycling up through the available range. */
        var span2 = Math.max(3, Math.round(span / 2));
        degree = chord[arpIndex % 3] + Math.floor(arpIndex / 3) * scaleLen;
        while (degree > span2) degree -= scaleLen;
        arpIndex++;
      } else if (prevDegree === null) {
        /* Open on a chord tone, usually the root. */
        degree = rng.chance(0.6) ? chord[0] : rng.pick(chord);
      } else {
        var target = contour[i];
        var candidates = [], weights = [];

        for (var d = -style.leapMax; d <= style.leapMax; d++) {
          if (d === 0 && !rng.chance(0.12)) continue;      /* rarely repeat */
          var cand = prevDegree + d;
          if (cand < -scaleLen || cand > span + scaleLen) continue;

          var w = 1;
          /* stepwise motion is the default voice of a melodic line */
          w *= Math.abs(d) <= 1 ? style.stepBias * 4
             : Math.abs(d) <= 2 ? 1.4
             : Math.max(0.15, 1 - Math.abs(d) * 0.12);

          /* Some styles are built on specific intervals rather than on
             stepwise motion — an ambient arp wants fifths and ninths, an
             electro bassline wants octaves and sevenths. Where a pool is
             declared it outweighs the default. */
          if (style.intervalPool && style.intervalPool.indexOf(Math.abs(d)) !== -1) w *= 6;

          /* A drone piece orbits its root instead of travelling away from it. */
          if (style.dronePull) {
            var fromRoot = Math.abs(((cand % scaleLen) + scaleLen) % scaleLen);
            w *= 1 + style.dronePull * 3 / (1 + fromRoot);
          }

          /* Trance gates live on the root and the fifth and nowhere else. */
          if (style.toneBias) {
            var pcIdx = (((cand % scaleLen) + scaleLen) % scaleLen);
            w *= style.toneBias.indexOf(pcIdx) !== -1 ? 5 : 0.08;
          }
          /* pull toward the contour */
          w *= 1 / (1 + Math.abs(cand - target) * 0.45);
          /* strong beats want chord tones */
          if (strong) {
            var isChordTone = chord.some(function (c) {
              return (((cand - c) % scaleLen) + scaleLen) % scaleLen === 0;
            });
            w *= isChordTone ? 3.2 : 0.4;
          }
          /* a bass sits on roots far more than a lead does */
          if (role.rootPull > 0) {
            var isRoot = (((cand - chord[0]) % scaleLen) + scaleLen) % scaleLen === 0;
            if (isRoot) w *= 1 + role.rootPull * 2;
          }
          /* answer a leap with a step back the other way */
          if (lastLeap !== 0) {
            var sameWay = (d > 0) === (lastLeap > 0);
            if (sameWay && Math.abs(d) > 1) w *= 0.25;
            if (!sameWay && Math.abs(d) <= 2) w *= 2.2;
          }
          /* counter-lines lean against the contour rather than with it */
          if (role.contrary && i > 0) {
            var wantUp = contour[i] > contour[i - 1];
            if ((d > 0) === wantUp) w *= 0.6;
          }
          candidates.push(cand); weights.push(w);
        }

        if (!candidates.length) degree = prevDegree;
        else degree = rng.weighted(candidates, weights);

        var moved = degree - prevDegree;
        lastLeap = Math.abs(moved) > 2 ? moved : 0;
      }

      /* Octave displacement — the acid trick, and what stops Berlin lines
         sitting in one narrow band for sixteen bars. */
      var oct = 0;
      if (rng.chance(style.octaveJump)) oct = rng.chance(0.7) ? 1 : -1;

      var midi = degreeToMidi(degree, scale.pcs, rootMidi) + oct * 12;

      /* Octave displacement stacks on top of a degree that already spans the
         requested range, so without a clamp an acid line drifts into the top
         of the keyboard where no bass synth can follow it. Fold it back. */
      while (midi > ceilMidi) midi -= 12;
      while (midi < floorMidi) midi += 12;

      /* Chords for pad roles: stack the triad above the chosen note. */
      var notes = [midi];
      var poly = style.forceChord || role.poly;
      if (poly > 1) {
        /* Stack the triad in scale degrees — thirds, not fifths. Building it
           from degrees rather than semitones keeps it diatonic automatically,
           so a chord on the second degree comes out minor without asking. */
        for (var k = 1; k < poly; k++) {
          /* Cluster styles stack adjacent degrees rather than thirds, which is
             what gives a drone its beating, unresolved quality. A suspension
             replaces the third with the fourth. */
          var up = style.cluster ? k : k * 2;
          if (style.suspend && k === 1 && rng.chance(style.suspend)) up = 3;
          notes.push(midi + (degreeToMidi(degree + up, scale.pcs, rootMidi)
                           - degreeToMidi(degree, scale.pcs, rootMidi)));
        }
        notes = notes.filter(function (v, idx, a) { return a.indexOf(v) === idx; });
      }
      /* Stacked voices are built by interval from the root note, so they can
         sit above the ceiling even when the root does not. Fold them too. */
      notes = notes.map(function (n) {
        while (n > ceilMidi) n -= 12;
        while (n < floorMidi) n += 12;
        return n;
      });

      /* Velocity from metric position plus style accent behaviour. */
      var vel = 62 + Math.round(METRIC[i % 16] * 2.2);
      if (style.accentBeats && style.accentBeats.indexOf(i % 16) !== -1) vel += style.accentDepth;
      if (rng.chance(style.accent)) vel += style.accentDepth;
      if (prevDegree !== null && degree === prevDegree) vel -= 12;
      vel = Math.max(20, Math.min(127, vel + rng.int(-5, 5)));

      /* Gate as a 0..1 proportion of the step. */
      var gate = style.gate * role.gateMul * (1 + rng.range(-style.gateVary, style.gateVary));
      gate = Math.max(0.08, Math.min(1.9, gate));

      var tie = rng.chance(style.tie);

      /* Timing offset as a fraction of a step. Swing pushes every other
         sixteenth late; micro adds the small human-or-broken variation IDM and
         breakbeat live on. The KeyStep Pro cannot receive this over MIDI — it
         is a Time Shift encoder value — so it is carried through to the crib
         sheet and applied when auditioning, and to injection when quantise is
         off. */
      var shift = 0;
      if (style.swing && i % 2 === 1) shift += style.swing * 0.5;
      if (style.micro) shift += rng.range(-style.micro, style.micro) * 0.5;
      shift = Math.max(-0.49, Math.min(0.49, shift));

      /* Glitch: a note that stutters, or one that simply breaks. */
      var ratchet = 1;
      if (style.glitch) {
        if (rng.chance(style.glitch * 0.6)) ratchet = rng.pick([2, 3, 4]);
        else if (rng.chance(style.glitch * 0.35)) { out.push({ rest: true }); continue; }
      }

      out.push({
        rest: false, notes: notes, degree: degree, vel: vel,
        gate: gate, tie: tie, accent: vel > 100, chord: chord[0],
        shift: shift, ratchet: ratchet
      });
      notesUsed.push(midi);
      prevDegree = degree;
    }

    /* Call and response: the second half answers the first rather than
       continuing it. The answer is derived from the call — inverted, sequenced
       or echoed — and lands on the root, so the phrase closes instead of just
       stopping. A short gap before the answer is what makes the two halves
       read as two voices rather than one long line. */
    /* Chromatic passing tones on weak beats: the note between two scale tones,
       which is what makes an electro bassline sound like one rather than like
       an arpeggio. Only where it actually passes between two different pitches. */
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
          /* Lead into the next strong beat from a semitone below or above. */
          approach = target + (rng.chance(0.7) ? -1 : 1);
        }
        if (approach !== null && rng.chance(style.passing * 2.2)) {
          out[pi].notes = [approach];
          out[pi].passing = true;
          out[pi].vel = Math.max(24, out[pi].vel - 14);
        }
      }
    }

    /* A fixed rhythmic cell, repeated. Cinematic ostinatos are built this way. */
    if (style.cellLen) {
      for (var cy = style.cellLen; cy < out.length; cy++) {
        out[cy] = JSON.parse(JSON.stringify(out[cy % style.cellLen]));
        /* The rhythm is the identity; the pitch can lift an octave now and
           then, which is what stops an ostinato reading as a stuck loop. */
        if (!out[cy].rest && rng.chance(style.octaveJump)) {
          out[cy].notes = out[cy].notes.map(function (n) { return n + 12; });
        }
      }
      /* Lean on the start of each cell so the pulse is audible. */
      for (var ac2 = 0; ac2 < out.length; ac2 += style.cellLen) {
        if (out[ac2] && !out[ac2].rest) out[ac2].vel = Math.min(127, out[ac2].vel + 18);
      }
    }

    /* Two-bar motif: the second bar restates the first with one thing changed. */
    if (style.motif && steps >= 32) {
      var barLen = 16;
      for (var mb = barLen; mb < out.length; mb++) {
        var src2 = out[mb % barLen];
        out[mb] = JSON.parse(JSON.stringify(src2));
      }
      var tweak = rng.int(barLen, out.length - 1);
      if (!out[tweak].rest) {
        out[tweak].notes = out[tweak].notes.map(function (n) { return n + 12; });
        out[tweak].vel = Math.min(127, out[tweak].vel + 15);
      }
    }

    /* Additive cells mutate slightly as they repeat. */
    if (style.mutate) {
      for (var mu = 0; mu < out.length; mu++) {
        if (!out[mu].rest && rng.chance(style.mutate)) {
          var dir = rng.chance(0.5) ? 1 : -1;
          out[mu].degree += dir;
          out[mu].notes = [degreeToMidi(out[mu].degree, scale.pcs, rootMidi)];
        }
      }
    }

    /* The phase style repeats a short cell rather than writing 16 unique
       positions — that repetition is the entire point of the technique. */
    if (style.cell) {
      var cellLen = rng.pick([5, 7, 9]);
      for (var j = cellLen; j < steps; j++) out[j] = JSON.parse(JSON.stringify(out[j % cellLen]));
    }

    /* Recompute from the finished pattern. Phrasing and cell repetition both
       rewrite steps after the main loop, so the notes collected during
       generation are stale by now — and this figure drives the range warning
       shown before injection, so a stale one is worse than none. */
    var finalNotes = [];
    out.forEach(function (st) {
      if (!st.rest && st.notes) st.notes.forEach(function (n) { finalNotes.push(n); });
    });
    var lo = finalNotes.length ? Math.min.apply(null, finalNotes) : rootMidi;
    var hi = finalNotes.length ? Math.max.apply(null, finalNotes) : rootMidi;

    return {
      steps: out,
      meta: {
        style: styleKey, styleName: style.name, role: roleKey, roleName: role.name,
        scale: scaleKey, scaleName: scale.name, onDevice: scale.onDevice,
        root: rootPc, rootName: NOTE_NAMES[rootPc], octave: baseOctave,
        seed: seed, contour: shape, density: density, length: steps,
        low: lo, high: hi, lowName: noteName(lo), highName: noteName(hi),
        onsetCount: out.filter(function (s) { return !s.rest; }).length,
        progression: prog, harmonicRhythm: hr,
        range: rangeOct,
        floorMidi: floorMidi, ceilMidi: ceilMidi, scalePcs: scale.pcs, rootMidi: rootMidi
      }
    };
  }

  /* ------------------------------------------------------------------
     Phrasing.

     A phrase is a unit of material with a beginning and an end. Everything
     here is about the relationship between one phrase and the next: whether
     the second answers the first, mutates it, contradicts it, or ignores it.
     That relationship is what a listener actually hears as structure, and it
     is entirely separate from how long each phrase runs — so mode and length
     strategy are chosen independently and combined.
     ------------------------------------------------------------------ */

  var PHRASINGS = {
    through: {
      name: 'Through-composed',
      blurb: 'One continuous line. No answering, no repetition.',
      parts: 1, relations: []
    },
    callResponse: {
      name: 'Call and response',
      blurb: 'Two linked phrases: the call states, the response answers.',
      parts: 2, relations: ['answerGeneric']
    },
    variation: {
      name: 'Call \u2192 Variation',
      blurb: 'The response is the call mutated. Contour kept, intervals and rhythm altered.',
      parts: 2, relations: ['variation']
    },
    answer: {
      name: 'Call \u2192 Answer',
      blurb: 'The response resolves the call. Lands on root or fifth, shorter and plainer.',
      parts: 2, relations: ['answer'], preferStrategy: 'short'
    },
    echo: {
      name: 'Call \u2192 Echo',
      blurb: 'The response repeats the call with the intensity taken out of it.',
      parts: 2, relations: ['echo'], preferStrategy: 'short'
    },
    contrast: {
      name: 'Call \u2192 Contrast',
      blurb: 'The response argues with the call. Opposite contour, different rhythm and density.',
      parts: 2, relations: ['contrast']
    },
    questionAnswer: {
      name: 'Question \u2192 Answer',
      blurb: 'Classical phrasing. The question hangs on a non-root; the answer resolves.',
      parts: 2, relations: ['questionAnswer']
    },
    themeVariation: {
      name: 'Theme \u2192 Variation (A\u2013A\u2032)',
      blurb: 'Same length, same shape, different intervals, accents and density.',
      parts: 2, relations: ['themeVar'], preferStrategy: 'mirror'
    },
    twoPart: {
      name: 'Two-part phrase (A\u2013B)',
      blurb: 'The second phrase is independent: new motif, new contour, new rhythm.',
      parts: 2, relations: ['independent']
    },
    ternary: {
      name: 'Ternary (A\u2013B\u2013A)',
      blurb: 'Statement, contrast, return. The shape most long-form music uses.',
      parts: 3, relations: ['contrast', 'return']
    },
    loopGrowth: {
      name: 'Loop growth',
      blurb: 'Each phrase adds to the last. The Berlin School and minimalist engine.',
      parts: 4, relations: ['growth', 'growth', 'growth'], preferStrategy: 'expansion'
    },
    cadential: {
      name: 'Cadential',
      blurb: 'A short resolving phrase to close a loop or a section.',
      parts: 2, relations: ['cadence'], preferStrategy: 'cadential'
    }
  };

  var LENGTH_STRATEGIES = {
    mirror:      { name: 'Mirror \u2014 same length',      resolve: function (c) { return c; } },
    short:       { name: 'Short answer \u2014 half',       resolve: function (c) { return Math.max(4, Math.round(c / 2)); } },
    long:        { name: 'Long answer \u2014 double',      resolve: function (c) { return c * 2; } },
    independent: { name: 'Independent \u2014 free',        varies: true, resolve: function (c, rng) { return rng.pick([4, 6, 8, 12, 16, 24]); } },
    cadential:   { name: 'Cadential \u2014 4 to 8, resolving', varies: true, resolve: function (c, rng) { return rng.pick([4, 6, 8]); } },
    expansion:   { name: 'Expansion \u2014 grows',         resolve: function (c) { return Math.round(c * 1.5); } },
    compression: { name: 'Compression \u2014 distilled',   resolve: function (c) { return c; }, thin: true }
  };

  /* Pad a phrase out to a metrical boundary. A short answer is short in
     material, not usually in bar count: sixteen steps of call answered by
     eight of material and eight of silence still loops as a two-bar unit,
     where a 16+8 = 24-step pattern loops every bar and a half and slides
     against anything in four. The last note is also let ring into the gap,
     so the phrase ends rather than stops. */
  function padToGrid(phrase, grid) {
    if (!grid || phrase.length % grid === 0) return phrase;
    var target = Math.ceil(phrase.length / grid) * grid;
    var out = phrase.slice();
    var added = target - phrase.length;
    for (var i = 0; i < added; i++) out.push({ rest: true });
    var li = lastOnset(out);
    if (li >= 0) {
      var room = out.length - li;
      out[li].gate = Math.min(1.9, Math.max(out[li].gate || 0.5, Math.min(1.9, room * 0.45)));
    }
    return out;
  }

  /* Reshape a phrase to a target length without destroying it. Compressing
     keeps the metrically strongest notes; expanding restates and then varies,
     which is what a composer does rather than looping. */
  function fitLength(phrase, target, rng, ctx) {
    var src = clone(phrase);
    if (src.length === target) return src;

    if (target < src.length) {
      var keep = src.map(function (s, i) {
        return { s: s, i: i, w: s.rest ? -1 : METRIC[i % 16] + (s.accent ? 4 : 0) };
      }).filter(function (o) { return o.w >= 0; })
        .sort(function (a, b) { return b.w - a.w; })
        .slice(0, Math.max(1, Math.round(target * 0.6)))
        .map(function (o) { return o.i; });
      var out = [];
      for (var i = 0; i < target; i++) {
        var from = Math.round(i * src.length / target);
        out.push(keep.indexOf(from) !== -1 ? clone(src[from]) : { rest: true });
      }
      return out;
    }

    var grown = [];
    while (grown.length < target) {
      var chunk = clone(src);
      if (grown.length > 0) {
        /* Later restatements are not carbon copies. */
        chunk.forEach(function (st) {
          if (st.rest) return;
          if (rng.chance(0.25)) st.degree += rng.pick([-1, 1, 2]);
          if (rng.chance(0.2)) st.vel = Math.min(127, st.vel + 10);
        });
      }
      grown = grown.concat(chunk);
    }
    return grown.slice(0, target);
  }

  function rebuild(phrase, ctx, dropOctave) {
    /* An echo that means to sit an octave lower will breach the floor, and the
       clamp would helpfully fold it straight back up to where it started —
       undoing the one thing the relation exists to do. So the floor moves for
       those phrases rather than the notes. */
    var floor = ctx.floorMidi - (dropOctave ? 12 : 0);
    var ceil = ctx.ceilMidi - (dropOctave ? 12 : 0);
    return phrase.map(function (s) {
      if (s.rest || s.degree === undefined) return s;
      var m = degreeToMidi(s.degree, ctx.scalePcs, ctx.rootMidi);
      while (m > ceil) m -= 12;
      while (m < floor) m += 12;
      s.notes = [m];
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
    phrase[i].gate = Math.min(1.9, (phrase[i].gate || 0.5) * 1.6);
    phrase[i].vel = Math.min(127, (phrase[i].vel || 90) + 8);
    return rebuild(phrase, ctx);
  }

  /* Each relation is a way of deriving the next phrase from the previous. */
  var RELATIONS = {
    answerGeneric: {
      resolves: 'root', label: 'answered',
      apply: function (call, ctx, rng) {
        var pivot = 0;
        call.some(function (s) { if (!s.rest) { pivot = s.degree; return true; } return false; });
        var out = clone(call).map(function (s) {
          if (s.rest) return s;
          s.degree = pivot * 2 - s.degree;      /* mirror around the opening note */
          return s;
        });
        return resolveTo(rebuild(out, ctx), ctx.chordRoot, ctx);
      }
    },
    variation: {
      label: 'varied \u2014 same shape, new intervals',
      apply: function (call, ctx, rng) {
        var prev = null;
        var out = clone(call).map(function (s) {
          if (s.rest) return rng.chance(0.2) ? { rest: true } : s;
          if (prev !== null) {
            var dir = s.degree >= prev ? 1 : -1;       /* keep the contour */
            var size = rng.pick([1, 2, 3]);            /* change the interval */
            s.degree = prev + dir * size;
          }
          prev = s.degree;
          if (rng.chance(0.3)) s.gate = Math.max(0.1, s.gate * rng.range(0.6, 1.5));
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    answer: {
      resolves: 'rootOrFifth', label: 'resolved \u2014 lands on root or fifth',
      apply: function (call, ctx, rng) {
        var out = clone(call).map(function (s, i) {
          if (s.rest) return s;
          if (METRIC[i % 16] < 4 && rng.chance(0.45)) return { rest: true };
          s.vel = Math.max(30, s.vel - 6);
          return s;
        });
        return resolveTo(rebuild(out, ctx), rng.chance(0.75) ? ctx.chordRoot : ctx.chordRoot + 4, ctx);
      }
    },
    echo: {
      label: 'echoed \u2014 an octave down and quieter',
      apply: function (call, ctx, rng) {
        var out = clone(call).map(function (s, i) {
          if (s.rest) return s;
          if (METRIC[i % 16] < 4 && rng.chance(0.4)) return { rest: true };
          s.degree -= ctx.scalePcs.length;              /* an octave in degrees */
          s.vel = Math.max(22, Math.round(s.vel * 0.6));
          return s;
        });
        return rebuild(out, ctx, true);
      }
    },
    contrast: {
      label: 'contrasted \u2014 opposite contour and density',
      apply: function (call, ctx, rng) {
        var dense = call.filter(function (s) { return !s.rest; }).length / call.length > 0.55;
        var pivot = 0;
        call.some(function (s) { if (!s.rest) { pivot = s.degree; return true; } return false; });
        var out = clone(call).map(function (s, i) {
          var strong = METRIC[i % 16] >= 6;
          if (dense) {
            /* answer a busy call with a sparse one */
            if (!strong && rng.chance(0.72)) return { rest: true };
          } else if (s.rest && rng.chance(0.55)) {
            /* answer a sparse call with a busy one */
            var fill = JSON.parse(JSON.stringify(call.find(function (c) { return !c.rest; }) || { rest: true }));
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
      resolves: 'root', label: 'answered \u2014 the question hung, the answer resolves',
      apply: function (call, ctx, rng) {
        /* The question must not already sound finished. */
        var qi = lastOnset(call);
        if (qi >= 0) {
          call[qi].degree = ctx.chordRoot + rng.pick([1, 4, 6]);
          rebuild(call, ctx);
        }
        var out = clone(call).map(function (s, i) {
          if (s.rest) return s;
          if (METRIC[i % 16] < 4 && rng.chance(0.35)) return { rest: true };
          s.degree = s.degree - rng.pick([1, 2]);
          return s;
        });
        return resolveTo(rebuild(out, ctx), ctx.chordRoot, ctx);
      }
    },
    themeVar: {
      label: 'a variation \u2014 same bones, different detail',
      apply: function (call, ctx, rng) {
        var out = clone(call).map(function (s, i) {
          if (s.rest) return rng.chance(0.18) ? clone(call[(i + 1) % call.length]) : s;
          if (rng.chance(0.55)) s.degree += rng.pick([-2, -1, 1, 2]);
          if (rng.chance(0.4)) s.vel = Math.max(28, Math.min(127, s.vel + rng.int(-22, 26)));
          if (rng.chance(0.3)) s.gate = Math.max(0.1, s.gate * rng.range(0.65, 1.6));
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    growth: {
      label: 'grown \u2014 more material than the last',
      apply: function (call, ctx, rng) {
        var out = clone(call).map(function (s, i) {
          if (!s.rest) {
            if (rng.chance(0.3)) s.vel = Math.min(127, s.vel + 9);
            return s;
          }
          /* fill rests to thicken each successive pass */
          if (rng.chance(0.42)) {
            var src = call.find(function (c) { return !c.rest; });
            if (!src) return s;
            var add = JSON.parse(JSON.stringify(src));
            add.degree = src.degree + rng.pick([-2, -1, 1, 2, 3]);
            add.vel = Math.max(40, src.vel - 10);
            return add;
          }
          return s;
        });
        return rebuild(out, ctx);
      }
    },
    cadence: {
      resolves: 'root', label: 'a cadence \u2014 short and closing',
      apply: function (call, ctx, rng) {
        var pivot = ctx.chordRoot;
        var out = call.map(function (s, i) {
          if (METRIC[i % 16] < 5) return { rest: true };
          var c = JSON.parse(JSON.stringify(call.find(function (x) { return !x.rest; }) || { rest: true }));
          if (c.rest) return c;
          c.degree = pivot + (call.length - i > 2 ? 2 : 0);
          c.vel = 96;
          return c;
        });
        return resolveTo(rebuild(out, ctx), pivot, ctx);
      }
    },
    return: { label: 'a return to the opening', apply: function (call) { return clone(call); } },
    independent: { label: 'independent \u2014 new material', apply: null }
  };

  /* ------------------------------------------------------------------
     The assembler. Mode decides the relationships, strategy decides the
     lengths, and they are chosen independently — a Ternary shape with a
     Cadential final phrase is a different piece from a Ternary shape with
     Mirror lengths, and both are worth having.
     ------------------------------------------------------------------ */

  function generate(opts) {
    opts = opts || {};
    var modeKey = opts.phrasing || 'through';
    var mode = PHRASINGS[modeKey] || PHRASINGS.through;

    if (mode.parts === 1) {
      var single = generateCore(opts);
      single.meta.phrasing = 'through';
      single.meta.phrasingName = PHRASINGS.through.name;
      single.meta.phrases = [{ from: 0, length: single.steps.length, label: 'through-composed' }];
      return single;
    }

    var seed = opts.seed === undefined ? (Date.now() & 0xFFFF) : opts.seed;
    var rng = makeRng((seed + 4177) >>> 0);
    var callLen = opts.callLength || 16;
    var grid = opts.phraseGrid === undefined ? 16 : opts.phraseGrid;
    var stratKey = opts.lengthStrategy || mode.preferStrategy || 'mirror';
    var strat = LENGTH_STRATEGIES[stratKey] || LENGTH_STRATEGIES.mirror;

    /* The opening phrase is generated normally; everything after it is
       derived, which is what makes the result cohere. */
    var call = generateCore(Object.assign({}, opts, { steps: callLen, seed: seed }));
    var ctx = {
      scalePcs: call.meta.scalePcs, rootMidi: call.meta.rootMidi,
      floorMidi: call.meta.floorMidi, ceilMidi: call.meta.ceilMidi,
      chordRoot: (call.meta.progression && call.meta.progression[0]) || 0
    };

    var callPlaced = padToGrid(call.steps, grid);
    var phrases = [{ steps: callPlaced, label: 'call', length: callPlaced.length, material: callLen }];
    var prev = call.steps;

    for (var pi = 0; pi < mode.parts - 1; pi++) {
      var relKey = mode.relations[Math.min(pi, mode.relations.length - 1)];
      var rel = RELATIONS[relKey];
      var targetLen = relKey === 'return' ? phrases[0].length : strat.resolve(callLen, rng);
      if (strat.thin) targetLen = callLen;

      var derived;
      if (relKey === 'return') {
        derived = clone(phrases[0].steps);
      } else if (!rel.apply) {
        /* Independent: genuinely new material, in the same key and register. */
        derived = generateCore(Object.assign({}, opts, {
          steps: targetLen, seed: (seed + 7717 + pi * 131) & 0xFFFF
        })).steps;
      } else {
        derived = rel.apply(clone(prev), ctx, rng);
      }

      var dropped = relKey === 'echo';
      if (derived.length !== targetLen) derived = fitLength(derived, targetLen, rng, ctx);
      derived = rebuild(derived, ctx, dropped);

      /* Resolution has to be the last thing that happens. Applying it inside
         the relation and then trimming the phrase to length throws the
         resolving note away, which is how a cadence ends up hanging. */
      if (rel && rel.resolves) {
        var target = rel.resolves === 'rootOrFifth' && rng.chance(0.25)
          ? ctx.chordRoot + 4 : ctx.chordRoot;
        derived = resolveTo(derived, target, ctx);
        if (dropped) derived = rebuild(derived, ctx, true);
      }

      /* Compression distils rather than shortens: same length, fewer notes. */
      if (strat.thin && relKey !== 'return') {
        derived = derived.map(function (st, i) {
          if (st.rest) return st;
          return METRIC[i % 16] >= 5 || rng.chance(0.2) ? st : { rest: true };
        });
      }

      prev = derived;                          /* derive from the material, not the padding */
      var placed = padToGrid(derived, grid);
      phrases.push({
        steps: placed, length: placed.length,
        material: derived.length,
        label: relKey === 'return' ? 'return' : (rel.label || relKey)
      });
    }

    var all = [], layout = [], cursor = 0;
    phrases.forEach(function (ph) {
      all = all.concat(ph.steps);
      layout.push({ from: cursor, length: ph.length, material: ph.material, label: ph.label });
      cursor += ph.length;
    });

    /* The hardware holds 64 steps. Overrunning would wrap and overwrite. Drop
       whole phrases rather than cutting one in half — a missing phrase is a
       shorter piece, a severed one is a mistake. */
    var truncated = false;
    while (all.length > 64 && phrases.length > 1) {
      phrases.pop(); layout.pop();
      all = phrases.reduce(function (a, ph) { return a.concat(ph.steps); }, []);
      truncated = true;
    }
    if (all.length > 64) { all = all.slice(0, 64); truncated = true; }

    var used = all.filter(function (st) { return !st.rest; })
                  .reduce(function (a, st) { return a.concat(st.notes); }, []);

    return {
      steps: all,
      meta: Object.assign({}, call.meta, {
        length: all.length,
        onsetCount: all.filter(function (st) { return !st.rest; }).length,
        low: used.length ? Math.min.apply(null, used) : call.meta.low,
        high: used.length ? Math.max.apply(null, used) : call.meta.high,
        lowName: noteName(used.length ? Math.min.apply(null, used) : call.meta.low),
        highName: noteName(used.length ? Math.max.apply(null, used) : call.meta.high),
        phrasing: modeKey, phrasingName: mode.name, phraseGrid: grid,
        lengthStrategy: stratKey, lengthStrategyName: strat.name,
        phrases: layout, truncated: truncated, seed: seed
      })
    };
  }

  /* How long a pattern a given mode and strategy will produce, so the UI can
     say so on the button before anything is generated. */
  /* What "build the 64" will actually produce for a given seed length. */
  function developedLength(seedLen, target) {
    target = target || 64;
    return Math.min(target, seedLen * Math.max(1, Math.floor(target / seedLen)));
  }

  function projectedLength(modeKey, stratKey, callLen, grid) {
    var mode = PHRASINGS[modeKey] || PHRASINGS.through;
    callLen = callLen || 16;
    grid = grid === undefined ? 16 : grid;
    function place(n) { return grid ? Math.ceil(n / grid) * grid : n; }
    if (mode.parts === 1) return place(callLen);
    var strat = LENGTH_STRATEGIES[stratKey || mode.preferStrategy || 'mirror'] || LENGTH_STRATEGIES.mirror;
    var lens = [place(callLen)];
    for (var i = 0; i < mode.parts - 1; i++) {
      var relKey = mode.relations[Math.min(i, mode.relations.length - 1)];
      var n = relKey === 'return' ? callLen
            : (strat.thin ? callLen : strat.resolve(callLen, { pick: function (a) { return a[Math.floor(a.length / 2)]; } }));
      lens.push(place(n));
    }
    var total = 0;
    for (var k = 0; k < lens.length; k++) {
      if (total + lens[k] > 64) break;
      total += lens[k];
    }
    return total || lens[0];
  }

  /* ------------------------------------------------------------------
     Development: 16 steps become 64.

     Not four fresh generations — that produces four unrelated bars. The seed
     bar is treated as a germ cell and put through named compositional
     operations, so bar 4 is recognisably descended from bar 1.
     ------------------------------------------------------------------ */

  var OPS = {
    repeat: {
      label: 'Restated unchanged',
      apply: function (bar) { return clone(bar); }
    },
    transposeUp: {
      label: 'Transposed up a third within the scale',
      apply: function (bar, ctx) { return shiftDegrees(bar, 2, ctx); }
    },
    transposeDown: {
      label: 'Transposed down a step within the scale',
      apply: function (bar, ctx) { return shiftDegrees(bar, -1, ctx); }
    },
    retrogradeHalf: {
      label: 'Second half played backwards',
      apply: function (bar) {
        var b = clone(bar), half = Math.floor(b.length / 2);
        var tail = b.slice(half).reverse();
        return b.slice(0, half).concat(tail);
      }
    },
    octavePeak: {
      label: 'Highest note displaced an octave up',
      apply: function (bar, ctx) {
        var b = clone(bar), best = -1, bestVal = -Infinity;
        b.forEach(function (s, i) {
          if (!s.rest && s.notes[0] > bestVal) { bestVal = s.notes[0]; best = i; }
        });
        if (best >= 0) b[best].notes = b[best].notes.map(function (n) { return fold(n + 12, ctx); });
        return b;
      }
    },
    thinOut: {
      label: 'Thinned to the strong beats',
      apply: function (bar) {
        return clone(bar).map(function (s, i) {
          return METRIC[i % 16] >= 4 ? s : { rest: true };
        });
      }
    },
    crescendo: {
      label: 'Velocity rising across the bar',
      apply: function (bar) {
        var b = clone(bar), n = b.length;
        b.forEach(function (s, i) {
          if (!s.rest) s.vel = Math.max(20, Math.min(127, Math.round(s.vel * (0.78 + 0.42 * (i / n)))));
        });
        return b;
      }
    },
    longGates: {
      label: 'Gates opened out for a legato feel',
      apply: function (bar) {
        var b = clone(bar);
        b.forEach(function (s) { if (!s.rest) s.gate = Math.min(1.9, s.gate * 1.9); });
        return b;
      }
    },
    turnaround: {
      label: 'Last two steps rewritten as a turnaround back to the top',
      apply: function (bar, ctx) {
        var b = clone(bar), n = b.length;
        var lead = ctx.firstDegree === null ? 0 : ctx.firstDegree;
        for (var i = n - 2; i < n; i++) {
          var deg = lead - (n - i);
          b[i] = {
            rest: false,
            notes: [degreeToMidi(deg, ctx.scalePcs, ctx.rootMidi)],
            degree: deg, vel: 92 + (i - (n - 2)) * 12,
            gate: 0.5, tie: false, accent: false
          };
        }
        return b;
      }
    }
  };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function shiftDegrees(bar, delta, ctx) {
    return clone(bar).map(function (s) {
      if (s.rest) return s;
      var deg = (s.degree === undefined ? 0 : s.degree) + delta;
      s.degree = deg;
      var interval = degreeToMidi(deg, ctx.scalePcs, ctx.rootMidi)
                   - degreeToMidi(s.degree - delta, ctx.scalePcs, ctx.rootMidi);
      s.notes = s.notes.map(function (n) { return fold(n + interval, ctx); });
      return s;
    });
  }

  /* Three bars of transposition can walk a lead line off the top of the
     keyboard. Fold anything that escapes back into the working register. */
  function fold(midi, ctx) {
    if (!ctx.ceilMidi) return midi;
    while (midi > ctx.ceilMidi) midi -= 12;
    while (midi < ctx.floorMidi) midi += 12;
    return midi;
  }

  /* Which operations suit which bar. Bar 1 states, bar 2 answers, bar 3
     departs, bar 4 returns with more weight. */
  var PLAN = [
    ['repeat'],
    ['transposeUp', 'retrogradeHalf', 'transposeDown'],
    ['octavePeak', 'thinOut', 'transposeUp', 'longGates'],
    ['crescendo', 'turnaround', 'repeat']
  ];

  /* A 16-step seed becomes four bars; a 32-step call-and-response pair becomes
     two statements. Either way the target is 64 steps, because that is what
     the hardware holds. */
  function planFor(n) {
    if (n <= 1) return [PLAN[0]];
    if (n === 2) return [PLAN[0], ['transposeUp', 'octavePeak', 'crescendo']];
    if (n === 3) return [PLAN[0], PLAN[1], PLAN[3]];
    return PLAN;
  }

  function develop(pattern, opts) {
    opts = opts || {};
    var m = pattern.meta;
    var scale = SCALES[m.scale] || SCALES.minor;
    var role = ROLES[m.role] || ROLES.lead;
    var rootMidi = (m.octave + 1) * 12 + m.root + role.octave * 12;
    var rng = makeRng((m.seed + 7919) >>> 0);
    var firstDegree = null;
    pattern.steps.some(function (s) {
      if (!s.rest) { firstDegree = s.degree; return true; }
      return false;
    });
    var ctx = {
      scalePcs: scale.pcs, rootMidi: rootMidi, firstDegree: firstDegree,
      floorMidi: rootMidi - Math.round(Math.max(12, (m.range || 2) * role.rangeMul * 12) * 0.22),
      ceilMidi: rootMidi - Math.round(Math.max(12, (m.range || 2) * role.rangeMul * 12) * 0.22)
                + Math.max(12, Math.round((m.range || 2) * role.rangeMul * 12))
    };

    var target = opts.target || 64;
    var seedLen = pattern.steps.length;
    /* Floor, not round. Rounding a 24-step seed up to three statements gives
       72 steps, and the hardware holds 64 — the overflow would wrap and
       overwrite the opening. Better a shorter pattern than a corrupted one. */
    var repeats = Math.max(1, Math.floor(target / seedLen));
    var plan = planFor(repeats);
    var last = repeats - 1;

    var bars = [], applied = [];
    var prog = m.progression || [0, 0, 0, 0];

    for (var b = 0; b < repeats; b++) {
      var opKey = opts.ops && opts.ops[b] ? opts.ops[b] : rng.pick(plan[b]);
      var bar = OPS[opKey].apply(pattern.steps, ctx);

      /* Move the whole bar onto its chord in the progression, so the four
         bars form a progression rather than four transpositions of one. */
      var chordShift = prog[b % prog.length] - prog[0];
      if (chordShift !== 0) bar = shiftDegrees(bar, chordShift, ctx);

      /* The final statement gets a second, intensifying operation on top. */
      if (b === last && opKey !== 'turnaround' && rng.chance(0.7)) {
        bar = OPS.turnaround.apply(bar, ctx);
        applied.push({ bar: b + 1, op: opKey, label: OPS[opKey].label + ', then a turnaround' });
      } else {
        applied.push({ bar: b + 1, op: opKey, label: OPS[opKey].label });
      }
      bars.push(bar);
    }

    var steps = bars.reduce(function (a, b2) { return a.concat(b2); }, []);
    if (steps.length > target) steps = steps.slice(0, target);
    var used = steps.filter(function (s) { return !s.rest; }).map(function (s) { return s.notes[0]; });

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

  /* ------------------------------------------------------------------
     Polyrhythm helper: when do independently-lengthed tracks realign?
     ------------------------------------------------------------------ */
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function lcm(a, b) { return a * b / gcd(a, b); }

  /* Given track lengths (in steps), the cycle over which the whole thing
     repeats. This is the number that makes a polyrhythm feel composed rather
     than merely out of sync. */
  function cycleLength(lengths) {
    return lengths.reduce(function (acc, n) { return lcm(acc, n); }, 1);
  }

  /* ------------------------------------------------------------------
     Polyrhythm ensemble.

     Two things make a polyrhythm work, and only one of them is arithmetic.
     The lengths have to be coprime enough to drift — 16 against 15 takes 240
     steps to come round, 16 against 12 only 48. But drift alone just produces
     four busy parts colliding at random. The second thing is space: each part
     is generated knowing where the others already are, and backs off those
     positions. Bass claims the strong beats first, the rest fill the gaps.
     ------------------------------------------------------------------ */

  var LENGTH_PRESETS = {
    aligned:  { name: 'Aligned (16/16/16/16)',    lengths: [16, 16, 16, 16] },
    slipping: { name: 'Slipping (16/15/14/13)',   lengths: [16, 15, 14, 13] },
    drifting: { name: 'Drifting (16/12/15/14)',   lengths: [16, 12, 15, 14] },
    ratio:    { name: 'Ratio 4:3:2 (16/12/8/6)',  lengths: [16, 12, 8, 6] },
    wide:     { name: 'Wide drift (16/9/11/13)',  lengths: [16, 9, 11, 13] },
    subtle:   { name: 'Subtle (16/16/15/16)',     lengths: [16, 16, 15, 16] }
  };

  var ENSEMBLE_ROLES = ['bass', 'lead', 'counter', 'pad'];

  function ensemble(opts) {
    opts = opts || {};
    var count = Math.max(2, Math.min(4, opts.count || 3));
    var preset = LENGTH_PRESETS[opts.preset || 'drifting'];
    var lengths = (opts.lengths || preset.lengths).slice(0, count);
    var seed = opts.seed === undefined ? (Date.now() & 0xFFFF) : opts.seed;
    var roles = opts.roles || ENSEMBLE_ROLES.slice(0, count);

    /* More parts, less from each. Without this the texture thickens with every
       track added, which is the opposite of what a polyrhythm wants. */
    var thin = opts.space === undefined ? 1 : opts.space;
    var perTrack = (opts.density || 0.6) / (1 + 0.42 * (count - 1) * thin);

    /* Occupancy over the perceptual bar, in the order parts are written. */
    var occupancy = new Array(16);
    for (var z = 0; z < 16; z++) occupancy[z] = 0;

    var tracks = [];
    for (var t = 0; t < count; t++) {
      var len = lengths[t];
      var pattern = generateCore({
        style: opts.style || 'berlin',
        role: roles[t],
        scale: opts.scale,
        root: opts.root,
        octave: opts.octave,
        steps: len,
        seed: (seed + t * 1013) & 0xFFFF,
        density: perTrack * (roles[t] === 'bass' ? 1.15 : 1),
        range: opts.range,
        occupancy: occupancy,
        avoid: t === 0 ? 0 : 1.6 + thin * 0.8,
        phrasing: opts.phrasing
      });
      pattern.steps.forEach(function (s, i) {
        if (!s.rest) occupancy[i % 16] += 1;
      });
      pattern.meta.trackLength = len;
      tracks.push({ index: t + 1, role: roles[t], length: len, pattern: pattern });
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
      preset: opts.preset || 'drifting',
      seed: seed
    };
  }

  window.KSPGen = {
    LENGTH_PRESETS: LENGTH_PRESETS, ensemble: ensemble,
    PHRASINGS: PHRASINGS, LENGTH_STRATEGIES: LENGTH_STRATEGIES,
    RELATIONS: RELATIONS, projectedLength: projectedLength, padToGrid: padToGrid,
    developedLength: developedLength,
    SCALES: SCALES, STYLES: STYLES, ROLES: ROLES, METRIC: METRIC,
    NOTE_NAMES: NOTE_NAMES, OPS: OPS,
    generate: generate, develop: develop, cycleLength: cycleLength, lcm: lcm, gcd: gcd,
    noteName: noteName, degreeToMidi: degreeToMidi, makeRng: makeRng
  };
})();
