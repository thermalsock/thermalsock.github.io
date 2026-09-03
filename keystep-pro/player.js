/* Thermalsock Labs — live playback engine.
 *
 * Not injection. Injection records a pattern into the sequencer and takes a
 * pass in real time to do it, which is fine for committing something but
 * useless for teaching: an A/B comparison has to flip in the time it takes to
 * press a button. So this streams the notes out over MIDI as they happen and
 * lets the hardware voice make the sound. Flipping A to B is a swap of the
 * pattern the scheduler is reading from.
 *
 * The browser synth is kept as a fallback for anyone without a device
 * plugged in, and it is deliberately plain. If there is a Take 5 on the end
 * of the cable, nothing here should be competing with it.
 *
 * Scheduling is lookahead: a timer wakes every 25 ms and schedules anything
 * due in the next 150 ms with an explicit timestamp. Web MIDI and Web Audio
 * both dispatch on their own clocks, so the timing does not degrade when the
 * page is busy — which matters when the whole point is hearing a 20 ms
 * difference in swing.
 *
 * window.KSPPlayer
 */
(function () {
  'use strict';

  var LOOKAHEAD = 0.15;      /* seconds scheduled ahead */
  var TICK = 25;             /* ms between wakeups */

  function create(opts) {
    opts = opts || {};
    var getOutput = opts.getOutput || function () { return null; };
    var getChannel = opts.getChannel || function () { return 1; };
    var getSink = opts.getSink || function () { return 'midi'; };
    var onStep = opts.onStep || function () {};
    var onLoop = opts.onLoop || function () {};

    var ac = null;
    var timer = null;
    var pattern = null;
    var pending = null;        /* swapped in at the next loop boundary */
    var bpm = 120;
    var division = 4;          /* sixteenths */
    var startedAt = 0;         /* audio-clock seconds */
    var cursor = 0;            /* absolute step index scheduled so far */
    var lastReported = -1;
    var live = [];             /* notes currently sounding, for panic */

    function ctx() {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function now() { return ctx().currentTime; }
    function stepSec() { return 60 / bpm / division; }

    /* ---------- sinks ---------- */

    function midiSend(bytes, atSec) {
      var out = getOutput();
      if (!out) return;
      /* Web MIDI timestamps are performance.now() milliseconds; the audio
         clock is seconds from a different origin, so convert through the
         offset between them rather than assuming they share a zero. */
      var ms = performance.now() + (atSec - now()) * 1000;
      try { out.send(bytes, Math.max(performance.now(), ms)); } catch (e) {}
    }

    function voiceFor(role) {
      if (role === 'bass') return { wave: 'sawtooth', cutoff: 900, q: 6, gain: 0.28 };
      if (role === 'pad') return { wave: 'triangle', cutoff: 2200, q: 1, gain: 0.12 };
      return { wave: 'sawtooth', cutoff: 2400, q: 3, gain: 0.16 };
    }

    function audioNote(midi, vel, dur, at, v) {
      var a = ctx();
      var osc = a.createOscillator(), filt = a.createBiquadFilter(), amp = a.createGain();
      osc.type = v.wave;
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(v.cutoff * (0.5 + vel / 127), at);
      filt.frequency.exponentialRampToValueAtTime(Math.max(180, v.cutoff * 0.35), at + dur * 0.9);
      filt.Q.value = v.q;
      var peak = v.gain * (0.35 + vel / 127 * 0.65);
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.exponentialRampToValueAtTime(peak, at + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, dur));
      osc.connect(filt); filt.connect(amp); amp.connect(a.destination);
      osc.start(at); osc.stop(at + Math.max(0.06, dur) + 0.02);
    }

    function fire(step, at, role) {
      var reps = step.ratchet || 1;
      var dur = stepSec() * (step.gate || 0.5) / reps;
      var ch = (getChannel() - 1) & 0x0F;
      var useMidi = getSink() === 'midi' && getOutput();
      var v = voiceFor(role);

      for (var r = 0; r < reps; r++) {
        var when = at + r * (stepSec() / reps);
        /* eslint-disable no-loop-func */
        step.notes.forEach(function (n) {
          if (useMidi) {
            midiSend([0x90 | ch, n, step.vel], when);
            midiSend([0x80 | ch, n, 0], when + dur);
            live.push(n);
          } else {
            audioNote(n, step.vel, dur, when, v);
          }
        });
      }
    }

    /* ---------- transport ---------- */

    function pump() {
      if (!pattern) return;
      var horizon = now() + LOOKAHEAD;
      var len = pattern.steps.length;

      while (startedAt + cursor * stepSec() < horizon) {
        var idx = cursor % len;

        /* A swap waits for the top of the loop. Changing pattern mid-bar
           makes the comparison about the seam rather than the difference. */
        if (idx === 0 && cursor > 0) {
          if (pending) { pattern = pending; pending = null; len = pattern.steps.length; }
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
      pattern = p; pending = null;
      bpm = settings.bpm || bpm;
      division = settings.division || division;
      cursor = 0; lastReported = -1;
      startedAt = now() + 0.06;
      pump();
    }

    /* Swap without restarting the clock: the pulse continues, the material
       changes. That continuity is what makes the difference audible. */
    function swap(p, immediate) {
      if (!pattern) { play(p); return; }
      if (immediate) {
        allOff();
        pattern = p; pending = null;
        cursor = Math.ceil((now() - startedAt) / stepSec());
      } else {
        pending = p;
      }
    }

    function allOff() {
      var out = getOutput();
      if (!out) { live.length = 0; return; }
      var ch = (getChannel() - 1) & 0x0F;
      try {
        out.send([0xB0 | ch, 123, 0]);
        live.forEach(function (n) { out.send([0x80 | ch, n, 0]); });
      } catch (e) {}
      live.length = 0;
    }

    function stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      allOff();
      pattern = null; pending = null;
      lastReported = -1;
    }

    return {
      play: play, swap: swap, stop: stop, allOff: allOff,
      isPlaying: function () { return !!timer; },
      setTempo: function (v) { bpm = v; },
      tempo: function () { return bpm; },
      current: function () { return pattern; },
      /* One note, for auditioning a single step or checking the cable. */
      ping: function (midi, vel) {
        var ch = (getChannel() - 1) & 0x0F;
        if (getSink() === 'midi' && getOutput()) {
          midiSend([0x90 | ch, midi, vel || 100], now() + 0.02);
          midiSend([0x80 | ch, midi, 0], now() + 0.4);
        } else {
          audioNote(midi, vel || 100, 0.35, now() + 0.02, voiceFor('lead'));
        }
      }
    };
  }

  window.KSPPlayer = { create: create };
})();
