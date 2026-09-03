(function(global) {
  "use strict";
  var store = global.TSStore ? global.TSStore.create("shared-devices") : null;
  var midiAccess = null;
  var audioIn = [];
  var audioOut = [];
  var listeners = [];
  var state = "idle";
  function get(key, fallback) {
    return store ? store.get(key, fallback) : fallback;
  }
  function set(key, value) {
    if (store) store.set(key, value);
  }
  function emit() {
    listeners.forEach(function(fn) {
      try {
        fn(api);
      } catch (e) {}
    });
  }
  function midiList(which) {
    var out = [];
    if (!midiAccess) return out;
    midiAccess[which].forEach(function(p) {
      out.push(p);
    });
    return out;
  }
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
  function refreshAudio() {
    if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve();
    }
    return navigator.mediaDevices.enumerateDevices().then(function(list) {
      audioIn = list.filter(function(d) {
        return d.kind === "audioinput";
      });
      audioOut = list.filter(function(d) {
        return d.kind === "audiooutput";
      });
      emit();
    }).catch(function() {});
  }
  function attach(access) {
    midiAccess = access;
    state = "ready";
    midiAccess.onstatechange = function() {
      emit();
    };
    emit();
  }
  function connect() {
    if (!global.navigator || !navigator.requestMIDIAccess) {
      state = "unsupported";
      emit();
      return Promise.resolve(null);
    }
    if (midiAccess) return Promise.resolve(midiAccess);
    state = "connecting";
    emit();
    return navigator.requestMIDIAccess({
      sysex: false
    }).then(function(access) {
      attach(access);
      return access;
    }).catch(function() {
      state = "denied";
      emit();
      return null;
    });
  }
  var started = false;
  function init() {
    if (started) return;
    started = true;
    refreshAudio();
    if (global.navigator && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshAudio);
    }
    if (!global.navigator || !navigator.requestMIDIAccess) {
      state = "unsupported";
      return;
    }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({
        name: "midi",
        sysex: false
      }).then(function(st) {
        if (st.state === "granted") connect();
        st.onchange = function() {
          if (st.state === "granted") connect();
        };
      }).catch(function() {});
    }
  }
  var api = {
    init: init,
    connect: connect,
    state: function() {
      return state;
    },
    onChange: function(fn) {
      listeners.push(fn);
      return api;
    },
    refreshAudio: refreshAudio,
    midiInputs: function() {
      return midiList("inputs");
    },
    midiOutputs: function() {
      return midiList("outputs");
    },
    output: function() {
      return resolve(midiList("outputs"), get("midiOut", null), PREFER);
    },
    input: function() {
      return resolve(midiList("inputs"), get("midiIn", null), PREFER);
    },
    setOutput: function(id) {
      set("midiOut", id || null);
      emit();
    },
    setInput: function(id) {
      set("midiIn", id || null);
      emit();
    },
    savedOutputId: function() {
      return get("midiOut", null);
    },
    savedInputId: function() {
      return get("midiIn", null);
    },
    savedAudioInputId: function() {
      return get("audioIn", null);
    },
    audioInputs: function() {
      return audioIn.slice();
    },
    audioOutputs: function() {
      return audioOut.slice();
    },
    audioInput: function() {
      var saved = get("audioIn", null), i;
      for (i = 0; i < audioIn.length; i++) if (audioIn[i].deviceId === saved) return audioIn[i];
      return audioIn[0] || null;
    },
    setAudioInput: function(deviceId) {
      set("audioIn", deviceId || null);
      emit();
    },
    audioLabelsAvailable: function() {
      return audioIn.some(function(d) {
        return !!d.label;
      });
    },
    summary: function() {
      if (state === "unsupported") return "Web MIDI unavailable";
      if (state === "denied") return "MIDI blocked";
      if (state !== "ready") return "MIDI not connected";
      var o = api.output();
      return o ? o.name : "No MIDI outputs";
    }
  };
  global.TSDevices = api;
  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(window);