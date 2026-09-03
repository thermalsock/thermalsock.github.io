/* Thermalsock Labs — shared device memory.
 *
 * Twelve apps on this site ask you to pick a device. Each one enumerated
 * ports itself, each one remembered its own answer in its own storage key,
 * and moving from the Arp Machine to the Oscilloscope meant choosing the same
 * interface again. This is one place to keep that choice.
 *
 * Two things it deliberately does NOT do:
 *
 *   It never prompts on load. Web MIDI raises a permission dialog on the first
 *   requestMIDIAccess, and an app that ambushes you with one before you have
 *   asked for anything is worse than an extra dropdown. It checks whether
 *   permission is already on record and only connects silently in that case;
 *   otherwise it waits for connect() to be called from a click.
 *
 *   It never calls getUserMedia to read audio labels. Browsers hide audio
 *   device names until microphone access has been granted, so before that the
 *   list is real but anonymous. Requesting the microphone purely to populate a
 *   dropdown would be a bad trade, so the count is reported honestly and the
 *   names fill in once a tool has legitimately asked for the mic.
 *
 * window.TSDevices
 */
(function (global) {
  'use strict';

  var store = global.TSStore ? global.TSStore.create('shared-devices') : null;

  var midiAccess = null;
  var audioIn = [];
  var audioOut = [];
  var listeners = [];
  var state = 'idle';        /* idle | connecting | ready | denied | unsupported */

  function get(key, fallback) { return store ? store.get(key, fallback) : fallback; }
  function set(key, value) { if (store) store.set(key, value); }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(api); } catch (e) { /* one bad listener must not stop the rest */ }
    });
  }

  /* ---------- MIDI ---------- */

  function midiList(which) {
    var out = [];
    if (!midiAccess) return out;
    midiAccess[which].forEach(function (p) { out.push(p); });
    return out;
  }

  /* Resolution order: the port you last chose, then anything whose name looks
     like a sequencer or interface rather than a software loopback, then the
     first one. A saved id that is no longer plugged in falls through rather
     than leaving the app pointed at nothing. */
  function resolve(ports, savedId, prefer) {
    var i;
    if (savedId) {
      for (i = 0; i < ports.length; i++) if (ports[i].id === savedId) return ports[i];
    }
    if (prefer) {
      for (i = 0; i < ports.length; i++) if (prefer.test(ports[i].name)) return ports[i];
    }
    return ports[0] || null;
  }

  var PREFER = /keystep|arturia|sequential|prophet|moog|elektron|novation|roland|korg|midi/i;

  /* ---------- audio ---------- */

  function refreshAudio() {
    if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve();
    }
    return navigator.mediaDevices.enumerateDevices().then(function (list) {
      audioIn = list.filter(function (d) { return d.kind === 'audioinput'; });
      audioOut = list.filter(function (d) { return d.kind === 'audiooutput'; });
      emit();
    }).catch(function () { /* enumeration blocked; leave the lists empty */ });
  }

  /* ---------- lifecycle ---------- */

  function attach(access) {
    midiAccess = access;
    state = 'ready';
    midiAccess.onstatechange = function () { emit(); };
    emit();
  }

  function connect() {
    if (!global.navigator || !navigator.requestMIDIAccess) {
      state = 'unsupported'; emit();
      return Promise.resolve(null);
    }
    if (midiAccess) return Promise.resolve(midiAccess);
    state = 'connecting'; emit();
    return navigator.requestMIDIAccess({ sysex: false }).then(function (access) {
      attach(access);
      return access;
    }).catch(function () {
      state = 'denied'; emit();
      return null;
    });
  }

  /* Connect only if the browser already holds the permission, so nothing is
     prompted for by the mere act of loading a page. */
  var started = false;
  function init() {
    if (started) return;          /* every page loads this; only start once */
    started = true;
    refreshAudio();
    if (global.navigator && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshAudio);
    }
    if (!global.navigator || !navigator.requestMIDIAccess) { state = 'unsupported'; return; }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'midi', sysex: false }).then(function (st) {
        if (st.state === 'granted') connect();
        st.onchange = function () { if (st.state === 'granted') connect(); };
      }).catch(function () { /* older browser: wait for an explicit connect() */ });
    }
  }

  var api = {
    init: init,
    connect: connect,
    state: function () { return state; },
    onChange: function (fn) { listeners.push(fn); return api; },
    refreshAudio: refreshAudio,

    midiInputs: function () { return midiList('inputs'); },
    midiOutputs: function () { return midiList('outputs'); },

    /* The chosen port, resolved live against what is actually connected. */
    output: function () { return resolve(midiList('outputs'), get('midiOut', null), PREFER); },
    input: function () { return resolve(midiList('inputs'), get('midiIn', null), PREFER); },

    setOutput: function (id) { set('midiOut', id || null); emit(); },
    setInput: function (id) { set('midiIn', id || null); emit(); },

    /* The stored ids, readable the instant the page parses. An app that
       enumerates its own ports needs the preference before TSDevices has
       finished connecting, and waiting for state 'ready' loses the race —
       the app populates its dropdown first and the choice appears ignored. */
    savedOutputId: function () { return get('midiOut', null); },
    savedInputId: function () { return get('midiIn', null); },
    savedAudioInputId: function () { return get('audioIn', null); },

    audioInputs: function () { return audioIn.slice(); },
    audioOutputs: function () { return audioOut.slice(); },
    audioInput: function () {
      var saved = get('audioIn', null), i;
      for (i = 0; i < audioIn.length; i++) if (audioIn[i].deviceId === saved) return audioIn[i];
      return audioIn[0] || null;
    },
    setAudioInput: function (deviceId) { set('audioIn', deviceId || null); emit(); },

    /* Audio names are hidden until a tool has been granted the microphone. */
    audioLabelsAvailable: function () {
      return audioIn.some(function (d) { return !!d.label; });
    },

    /* A one-line summary for a status pill. */
    summary: function () {
      if (state === 'unsupported') return 'Web MIDI unavailable';
      if (state === 'denied') return 'MIDI blocked';
      if (state !== 'ready') return 'MIDI not connected';
      var o = api.output();
      return o ? o.name : 'No MIDI outputs';
    }
  };

  global.TSDevices = api;

  /* Self-start. This is safe to do on every page because init() never raises
     a permission dialog — it only attaches to MIDI if the browser already
     holds the grant, and enumerates audio devices, which needs no permission
     (it just returns them unnamed until one is given). Without this, apps
     that read the shared choice would find an empty list unless the page
     happened to call init() itself. */
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(window);
