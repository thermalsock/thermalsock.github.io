(function() {
  "use strict";
  var CLOCK = 248, START = 250, STOP = 252;
  function noteEvents(pattern, stepMs, opts) {
    opts = opts || {};
    var ch = opts.channel || 0;
    var events = [];
    var fixedGate = opts.fixedGate || null;
    pattern.steps.forEach(function(s, i) {
      if (s.rest) return;
      var at = (i + (opts.ignoreShift ? 0 : s.shift || 0)) * stepMs;
      var reps = s.ratchet || 1;
      var vel = opts.fixedVelocity || s.vel;
      var dur = fixedGate !== null ? fixedGate : Math.max(12, stepMs * s.gate / reps);
      for (var r = 0; r < reps; r++) {
        (function(when) {
          s.notes.forEach(function(n) {
            events.push({
              t: when,
              bytes: [ 144 | ch, n, vel ]
            });
            events.push({
              t: when + dur,
              bytes: [ 128 | ch, n, 0 ]
            });
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
  Injector.prototype.send = function(bytes, at) {
    if (!this.out) return;
    try {
      this.out.send(bytes, at);
    } catch (e) {}
  };
  Injector.prototype.panic = function() {
    var i, n;
    for (i = 0; i < 16; i++) {
      this.send([ 176 | i, 123, 0 ]);
      for (n = 0; n < 128; n++) this.send([ 128 | i, n, 0 ]);
    }
    this.send([ STOP ]);
    this.running = false;
  };
  Injector.prototype.selectPattern = function(n) {
    this.send([ 192 | this.channel, Math.max(0, Math.min(127, n - 1)) ]);
  };
  Injector.prototype.realtime = function(pattern, opts) {
    opts = opts || {};
    var bpm = opts.bpm || 120;
    var division = opts.division || 4;
    var beatMs = 6e4 / bpm;
    var stepMs = beatMs / division;
    var countInBeats = opts.countInBeats === undefined ? 4 : opts.countInBeats;
    var lead = 400;
    var t0 = performance.now() + lead;
    var self = this;
    var musicStart = t0 + countInBeats * beatMs;
    if (opts.clockMaster) {
      var clockMs = beatMs / 24;
      this.send([ STOP ], t0);
      var totalBeats = countInBeats + pattern.steps.length / division + 1;
      var clocks = Math.ceil(totalBeats * 24);
      for (var c = 0; c < clocks; c++) this.send([ CLOCK ], t0 + c * clockMs);
      this.send([ START ], musicStart - 1);
    }
    noteEvents(pattern, stepMs, {
      channel: this.channel
    }).forEach(function(e) {
      self.send(e.bytes, musicStart + e.t);
    });
    var endAt = musicStart + pattern.steps.length * stepMs + 200;
    if (opts.clockMaster) this.send([ STOP ], endAt);
    this.running = true;
    return {
      startsAt: musicStart,
      endsAt: endAt,
      countInMs: countInBeats * beatMs,
      durationMs: pattern.steps.length * stepMs,
      stepMs: stepMs
    };
  };
  Injector.prototype.followRecord = function(pattern, input, opts) {
    opts = opts || {};
    var division = opts.division || 4;
    var pulsesPerStep = 24 / division;
    var self = this;
    var pulse = 0, stepIndex = -1, armed = true, started = false;
    var lastClockAt = 0, stepMs = 125;
    var handled = 0;
    function fireStep(i) {
      var s = pattern.steps[i];
      if (!s || s.rest) return;
      var now = performance.now();
      var dur = Math.max(15, stepMs * s.gate);
      s.notes.forEach(function(n) {
        self.send([ 144 | self.channel, n, s.vel ], now);
        self.send([ 128 | self.channel, n, 0 ], now + dur);
      });
      handled++;
    }
    function onMessage(ev) {
      if (!armed) return;
      var b = ev.data[0];
      if (b === START) {
        started = true;
        pulse = 0;
        stepIndex = -1;
        if (opts.onStart) opts.onStart();
        return;
      }
      if (b === STOP) {
        if (opts.onStop) opts.onStop(handled);
        return;
      }
      if (b !== CLOCK || !started) return;
      var now = performance.now();
      if (lastClockAt) {
        var dt = now - lastClockAt;
        if (dt > 2 && dt < 200) stepMs = stepMs * .85 + dt * pulsesPerStep * .15;
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
    input.addEventListener("midimessage", onMessage);
    this._followInput = input;
    this._followHandler = onMessage;
    this.running = true;
    return {
      waiting: true,
      disarm: function() {
        self.disarm();
      },
      bpmEstimate: function() {
        return Math.round(6e4 / (stepMs * division));
      }
    };
  };
  Injector.prototype.disarm = function() {
    if (this._followInput && this._followHandler) {
      this._followInput.removeEventListener("midimessage", this._followHandler);
      this._followInput = null;
      this._followHandler = null;
    }
    this.running = false;
  };
  Injector.prototype.stepRecord = function(pattern, opts) {
    opts = opts || {};
    var period = opts.periodMs || 40;
    var gate = Math.max(8, Math.min(period * .5, opts.gateMs || 15));
    var lead = 300;
    var t0 = performance.now() + lead;
    var self = this;
    var written = 0;
    pattern.steps.forEach(function(s) {
      if (s.rest) return;
      var at = t0 + written * period;
      s.notes.forEach(function(n) {
        self.send([ 144 | self.channel, n, 100 ], at);
        self.send([ 128 | self.channel, n, 0 ], at + gate);
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
  function preflight(pattern, opts) {
    var issues = [];
    var m = pattern.meta;
    if (!opts.output) {
      issues.push({
        level: "stop",
        text: "No MIDI output selected."
      });
    } else if (!/keystep/i.test(opts.output.name)) {
      issues.push({
        level: "stop",
        text: 'Sending to "' + opts.output.name + '", which is not the KeyStep Pro. ' + "Notes fired at the wrong port vanish silently."
      });
    }
    if (!m.onDevice) {
      issues.push({
        level: "warn",
        text: m.scaleName + " is not one of the hardware scales. Set the KeyStep Pro " + "scale to Chromatic first, or it will quantise these notes to something else."
      });
    }
    issues.push({
      level: "warn",
      text: "Set Lst Step to " + pattern.steps.length + " on the target track. " + "A pattern shorter than the injection wraps round and overwrites its own start."
    });
    var rests = pattern.steps.filter(function(s) {
      return s.rest;
    }).length;
    if (opts.mode === "step" && rests > 0) {
      issues.push({
        level: "warn",
        text: rests + " rest" + (rests === 1 ? "" : "s") + " cannot be written in Step Record — " + "there is no MIDI message for an empty step. The line will come out compacted. " + "Use Realtime Record to keep the spacing."
      });
    }
    if (opts.mode === "step") {
      issues.push({
        level: "warn",
        text: "Step Record discards velocity and gate. Pitches and chords land intact; " + "dynamics do not."
      });
    }
    var lo = m.low, hi = m.high;
    if (lo < 24 || hi > 96) {
      issues.push({
        level: "warn",
        text: "Range " + m.lowName + "–" + m.highName + " runs outside the 37 keys the " + "panel shows. The sequencer will still hold the notes."
      });
    }
    return issues;
  }
  window.KSPInject = {
    create: function(output, channel) {
      return new Injector(output, channel);
    },
    preflight: preflight,
    noteEvents: noteEvents
  };
})();