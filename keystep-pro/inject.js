/* Thermalsock Labs — KeyStep Pro injector.
 *
 * Written against measured behaviour, not the manual. What the probes told us:
 *
 *   Step Record   pitch and chords only. Velocity and gate are replaced with
 *                 the device's defaults. Runs happily at 25 ms per step.
 *   Realtime Rec  keeps velocity, gate and chords, and quantises cleanly to
 *                 the grid. Costs one bar of real time per bar of music.
 *   Overrun       wraps and overwrites, so the injector must count steps and
 *                 stop itself rather than trusting the device to.
 *
 * Everything is scheduled with output.send(bytes, timestamp) against a
 * performance.now() baseline. Web MIDI dispatches those on its own clock, so
 * the timing does not depend on this tab staying responsive — which matters,
 * because a stutter mid-injection writes a wrong note rather than a late one.
 *
 * window.KSPInject
 */
(function () {
  'use strict';

  var CLOCK = 0xF8, START = 0xFA, STOP = 0xFC;

  /* Flatten a pattern into note events at millisecond offsets from zero. */
  function noteEvents(pattern, stepMs, opts) {
    opts = opts || {};
    var ch = opts.channel || 0;
    var events = [];
    var fixedGate = opts.fixedGate || null;

    pattern.steps.forEach(function (s, i) {
      if (s.rest) return;
      /* Swing and micro-timing live in the step's own shift value. With the
         device quantiser on these get snapped away, which is fine — the grid
         is what the user asked for. With it off they survive, and the groove
         comes across. Either way we send the truth. */
      var at = (i + (opts.ignoreShift ? 0 : (s.shift || 0))) * stepMs;
      var reps = s.ratchet || 1;
      var vel = opts.fixedVelocity || s.vel;
      var dur = fixedGate !== null ? fixedGate
              : Math.max(12, stepMs * s.gate / reps);
      for (var r = 0; r < reps; r++) {
        (function (when) {
          s.notes.forEach(function (n) {
            events.push({ t: when, bytes: [0x90 | ch, n, vel] });
            events.push({ t: when + dur, bytes: [0x80 | ch, n, 0] });
          });
        })(at + r * (stepMs / reps));
      }
    });
    return events;
  }

  function Injector(output, channel) {
    this.out = output;
    this.channel = (channel || 1) - 1;
    this.pending = [];
    this.running = false;
  }

  Injector.prototype.send = function (bytes, at) {
    if (!this.out) return;
    try { this.out.send(bytes, at); } catch (e) { /* port vanished mid-run */ }
  };

  Injector.prototype.panic = function () {
    var i, n;
    for (i = 0; i < 16; i++) {
      this.send([0xB0 | i, 123, 0]);
      for (n = 0; n < 128; n++) this.send([0x80 | i, n, 0]);
    }
    this.send([STOP]);
    this.running = false;
  };

  /* Select a pattern on the target track. Probe 7 confirmed this works. */
  Injector.prototype.selectPattern = function (n) {
    this.send([0xC0 | this.channel, Math.max(0, Math.min(127, n - 1))]);
  };

  /* ------------------------------------------------------------------
     Realtime Record — the full-fidelity path.

     Two ways to stay in step with the device. As clock master we send Start
     and 24-ppqn clock, and the KeyStep Pro runs on our grid, which removes
     alignment error entirely — but it needs the device set to external sync.
     As a follower we simply match its tempo and rely on its quantiser, which
     needs no setup but depends on the user's Record+Play press landing near a
     bar line.
     ------------------------------------------------------------------ */
  Injector.prototype.realtime = function (pattern, opts) {
    opts = opts || {};
    var bpm = opts.bpm || 120;
    var division = opts.division || 4;          /* 4 = sixteenths */
    var beatMs = 60000 / bpm;
    var stepMs = beatMs / division;
    var countInBeats = opts.countInBeats === undefined ? 4 : opts.countInBeats;
    var lead = 400;
    var t0 = performance.now() + lead;
    var self = this;

    /* MIDI Start means "play from the top", so the device begins advancing the
       moment it arrives. An earlier version sent Start and then counted in for
       four beats, which the sequencer happily consumed as sixteen real steps —
       so a 64-step injection began writing at step 17. A 16-step one wrapped
       cleanly back to step 1 and looked fine, which is how the bug survived.
       Start now lands exactly where the music does. The count-in is clock only:
       the device holds position while a stable tempo reference arrives. */
    var musicStart = t0 + countInBeats * beatMs;

    if (opts.clockMaster) {
      var clockMs = beatMs / 24;
      /* Stop first, so a device left mid-pattern is reset rather than resumed. */
      this.send([STOP], t0);
      var totalBeats = countInBeats + (pattern.steps.length / division) + 1;
      var clocks = Math.ceil(totalBeats * 24);
      for (var c = 0; c < clocks; c++) this.send([CLOCK], t0 + c * clockMs);
      this.send([START], musicStart - 1);
    }

    noteEvents(pattern, stepMs, { channel: this.channel }).forEach(function (e) {
      self.send(e.bytes, musicStart + e.t);
    });

    var endAt = musicStart + pattern.steps.length * stepMs + 200;
    if (opts.clockMaster) this.send([STOP], endAt);

    this.running = true;
    return {
      startsAt: musicStart,
      endsAt: endAt,
      countInMs: countInBeats * beatMs,
      durationMs: pattern.steps.length * stepMs,
      stepMs: stepMs
    };
  };

  /* ------------------------------------------------------------------
     Follow mode — align to the device instead of guessing.

     When the KeyStep Pro is clock master we cannot reset its playhead, and
     asking the user to press Record+Play "somewhere near a bar line" is not
     alignment, it is hope. Instead: listen to its clock output, wait for the
     Start it emits when playback begins, then place each step on its own
     clock pulse. Twenty-four pulses to the quarter note, six to a sixteenth.

     This needs no tempo entry at all — the device's own clock is the grid, so
     tempo drift and swing come out right for free.
     ------------------------------------------------------------------ */
  Injector.prototype.followRecord = function (pattern, input, opts) {
    opts = opts || {};
    var division = opts.division || 4;
    var pulsesPerStep = 24 / division;          /* 6 for sixteenths */
    var self = this;
    var pulse = 0, stepIndex = -1, armed = true, started = false;
    var lastClockAt = 0, stepMs = 125;          /* refined from the real clock */
    var handled = 0;

    function fireStep(i) {
      var s = pattern.steps[i];
      if (!s || s.rest) return;
      var now = performance.now();
      var dur = Math.max(15, stepMs * s.gate);
      s.notes.forEach(function (n) {
        self.send([0x90 | self.channel, n, s.vel], now);
        self.send([0x80 | self.channel, n, 0], now + dur);
      });
      handled++;
    }

    function onMessage(ev) {
      if (!armed) return;
      var b = ev.data[0];

      if (b === START) {
        started = true; pulse = 0; stepIndex = -1;
        if (opts.onStart) opts.onStart();
        return;
      }
      if (b === STOP) {
        if (opts.onStop) opts.onStop(handled);
        return;
      }
      if (b !== CLOCK || !started) return;

      /* Track the real inter-pulse time so gate lengths follow the device. */
      var now = performance.now();
      if (lastClockAt) {
        var dt = now - lastClockAt;
        if (dt > 2 && dt < 200) stepMs = stepMs * 0.85 + (dt * pulsesPerStep) * 0.15;
      }
      lastClockAt = now;

      var step = Math.floor(pulse / pulsesPerStep);
      if (step !== stepIndex && step < pattern.steps.length) {
        stepIndex = step;
        fireStep(step);
        if (opts.onStep) opts.onStep(step, pattern.steps.length);
      }
      pulse++;

      if (stepIndex >= pattern.steps.length - 1 && pulse > pattern.steps.length * pulsesPerStep) {
        self.disarm();
      }
    }

    input.addEventListener('midimessage', onMessage);
    this._followInput = input;
    this._followHandler = onMessage;
    this.running = true;

    return {
      waiting: true,
      disarm: function () { self.disarm(); },
      bpmEstimate: function () { return Math.round(60000 / (stepMs * division)); }
    };
  };

  Injector.prototype.disarm = function () {
    if (this._followInput && this._followHandler) {
      this._followInput.removeEventListener('midimessage', this._followHandler);
      this._followInput = null; this._followHandler = null;
    }
    this.running = false;
  };

  /* ------------------------------------------------------------------
     Step Record — the fast path.

     Probe 11 ran 25 ms per step with nothing dropped, so 64 steps land in
     about 1.6 seconds. The catch is structural rather than a timing one:
     Step Record advances on note-off, and there is no MIDI message for "leave
     this step empty". Rests are entered with the Tie/Rest button on the front
     panel, which we cannot press. So a pattern with rests comes out compacted
     — the notes are right, the spacing is not.
     ------------------------------------------------------------------ */
  Injector.prototype.stepRecord = function (pattern, opts) {
    opts = opts || {};
    var period = opts.periodMs || 40;
    var gate = Math.max(8, Math.min(period * 0.5, opts.gateMs || 15));
    var lead = 300;
    var t0 = performance.now() + lead;
    var self = this;
    var written = 0;

    pattern.steps.forEach(function (s) {
      if (s.rest) return;                       /* cannot be expressed; skipped */
      var at = t0 + written * period;
      s.notes.forEach(function (n) {
        self.send([0x90 | self.channel, n, 100], at);
        self.send([0x80 | self.channel, n, 0], at + gate);
      });
      written++;
    });

    this.running = true;
    return {
      startsAt: t0,
      endsAt: t0 + written * period,
      durationMs: written * period,
      stepsWritten: written,
      restsDropped: pattern.steps.length - written
    };
  };

  /* ------------------------------------------------------------------
     Preflight: everything that can go wrong before a note is sent.
     ------------------------------------------------------------------ */
  function preflight(pattern, opts) {
    var issues = [];
    var m = pattern.meta;

    if (!opts.output) {
      issues.push({ level: 'stop', text: 'No MIDI output selected.' });
    } else if (!/keystep/i.test(opts.output.name)) {
      issues.push({
        level: 'stop',
        text: 'Sending to "' + opts.output.name + '", which is not the KeyStep Pro. ' +
              'Notes fired at the wrong port vanish silently.'
      });
    }

    if (!m.onDevice) {
      issues.push({
        level: 'warn',
        text: m.scaleName + ' is not one of the hardware scales. Set the KeyStep Pro ' +
              'scale to Chromatic first, or it will quantise these notes to something else.'
      });
    }

    /* Overrun wraps and overwrites — probe 13. */
    issues.push({
      level: 'warn',
      text: 'Set Lst Step to ' + pattern.steps.length + ' on the target track. ' +
            'A pattern shorter than the injection wraps round and overwrites its own start.'
    });

    var rests = pattern.steps.filter(function (s) { return s.rest; }).length;
    if (opts.mode === 'step' && rests > 0) {
      issues.push({
        level: 'warn',
        text: rests + ' rest' + (rests === 1 ? '' : 's') + ' cannot be written in Step Record — ' +
              'there is no MIDI message for an empty step. The line will come out compacted. ' +
              'Use Realtime Record to keep the spacing.'
      });
    }
    if (opts.mode === 'step') {
      issues.push({
        level: 'warn',
        text: 'Step Record discards velocity and gate. Pitches and chords land intact; ' +
              'dynamics do not.'
      });
    }

    var lo = m.low, hi = m.high;
    if (lo < 24 || hi > 96) {
      issues.push({
        level: 'warn',
        text: 'Range ' + m.lowName + '–' + m.highName + ' runs outside the 37 keys the ' +
              'panel shows. The sequencer will still hold the notes.'
      });
    }
    return issues;
  }

  window.KSPInject = {
    create: function (output, channel) { return new Injector(output, channel); },
    preflight: preflight,
    noteEvents: noteEvents
  };
})();
