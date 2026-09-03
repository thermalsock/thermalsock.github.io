(function() {
  "use strict";
  var LOOKAHEAD = .15;
  var TICK = 25;
  function create(opts) {
    opts = opts || {};
    var getOutput = opts.getOutput || function() {
      return null;
    };
    var getChannel = opts.getChannel || function() {
      return 1;
    };
    var getSink = opts.getSink || function() {
      return "midi";
    };
    var onStep = opts.onStep || function() {};
    var onLoop = opts.onLoop || function() {};
    var ac = null;
    var timer = null;
    var pattern = null;
    var pending = null;
    var bpm = 120;
    var division = 4;
    var startedAt = 0;
    var cursor = 0;
    var lastReported = -1;
    var live = [];
    function ctx() {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext);
      if (ac.state === "suspended") ac.resume();
      return ac;
    }
    function now() {
      return ctx().currentTime;
    }
    function stepSec() {
      return 60 / bpm / division;
    }
    function midiSend(bytes, atSec) {
      var out = getOutput();
      if (!out) return;
      var ms = performance.now() + (atSec - now()) * 1e3;
      try {
        out.send(bytes, Math.max(performance.now(), ms));
      } catch (e) {}
    }
    function voiceFor(role) {
      if (role === "bass") return {
        wave: "sawtooth",
        cutoff: 900,
        q: 6,
        gain: .28
      };
      if (role === "pad") return {
        wave: "triangle",
        cutoff: 2200,
        q: 1,
        gain: .12
      };
      return {
        wave: "sawtooth",
        cutoff: 2400,
        q: 3,
        gain: .16
      };
    }
    function audioNote(midi, vel, dur, at, v) {
      var a = ctx();
      var osc = a.createOscillator(), filt = a.createBiquadFilter(), amp = a.createGain();
      osc.type = v.wave;
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(v.cutoff * (.5 + vel / 127), at);
      filt.frequency.exponentialRampToValueAtTime(Math.max(180, v.cutoff * .35), at + dur * .9);
      filt.Q.value = v.q;
      var peak = v.gain * (.35 + vel / 127 * .65);
      amp.gain.setValueAtTime(1e-4, at);
      amp.gain.exponentialRampToValueAtTime(peak, at + .006);
      amp.gain.exponentialRampToValueAtTime(1e-4, at + Math.max(.05, dur));
      osc.connect(filt);
      filt.connect(amp);
      amp.connect(a.destination);
      osc.start(at);
      osc.stop(at + Math.max(.06, dur) + .02);
    }
    function fire(step, at, role) {
      var reps = step.ratchet || 1;
      var dur = stepSec() * (step.gate || .5) / reps;
      var ch = getChannel() - 1 & 15;
      var useMidi = getSink() === "midi" && getOutput();
      var v = voiceFor(role);
      for (var r = 0; r < reps; r++) {
        var when = at + r * (stepSec() / reps);
        step.notes.forEach(function(n) {
          if (useMidi) {
            midiSend([ 144 | ch, n, step.vel ], when);
            midiSend([ 128 | ch, n, 0 ], when + dur);
            live.push(n);
          } else {
            audioNote(n, step.vel, dur, when, v);
          }
        });
      }
    }
    function pump() {
      if (!pattern) return;
      var horizon = now() + LOOKAHEAD;
      var len = pattern.steps.length;
      while (startedAt + cursor * stepSec() < horizon) {
        var idx = cursor % len;
        if (idx === 0 && cursor > 0) {
          if (pending) {
            pattern = pending;
            pending = null;
            len = pattern.steps.length;
          }
          onLoop();
        }
        var s = pattern.steps[idx];
        if (s && !s.rest) {
          var at = startedAt + (cursor + (s.shift || 0)) * stepSec();
          fire(s, Math.max(now(), at), pattern.meta && pattern.meta.role);
        }
        cursor++;
      }
      var pos = Math.floor((now() - startedAt) / stepSec());
      if (pos !== lastReported && pos >= 0) {
        lastReported = pos;
        onStep(pos % len, len);
      }
      timer = setTimeout(pump, TICK);
    }
    function play(p, settings) {
      settings = settings || {};
      stop();
      pattern = p;
      pending = null;
      bpm = settings.bpm || bpm;
      division = settings.division || division;
      cursor = 0;
      lastReported = -1;
      startedAt = now() + .06;
      pump();
    }
    function swap(p, immediate) {
      if (!pattern) {
        play(p);
        return;
      }
      if (immediate) {
        allOff();
        pattern = p;
        pending = null;
        cursor = Math.ceil((now() - startedAt) / stepSec());
      } else {
        pending = p;
      }
    }
    function allOff() {
      var out = getOutput();
      if (!out) {
        live.length = 0;
        return;
      }
      var ch = getChannel() - 1 & 15;
      try {
        out.send([ 176 | ch, 123, 0 ]);
        live.forEach(function(n) {
          out.send([ 128 | ch, n, 0 ]);
        });
      } catch (e) {}
      live.length = 0;
    }
    function stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      allOff();
      pattern = null;
      pending = null;
      lastReported = -1;
    }
    return {
      play: play,
      swap: swap,
      stop: stop,
      allOff: allOff,
      isPlaying: function() {
        return !!timer;
      },
      setTempo: function(v) {
        bpm = v;
      },
      tempo: function() {
        return bpm;
      },
      current: function() {
        return pattern;
      },
      ping: function(midi, vel) {
        var ch = getChannel() - 1 & 15;
        if (getSink() === "midi" && getOutput()) {
          midiSend([ 144 | ch, midi, vel || 100 ], now() + .02);
          midiSend([ 128 | ch, midi, 0 ], now() + .4);
        } else {
          audioNote(midi, vel || 100, .35, now() + .02, voiceFor("lead"));
        }
      }
    };
  }
  window.KSPPlayer = {
    create: create
  };
})();