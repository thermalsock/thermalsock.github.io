(function(global) {
  "use strict";
  var KEY = "thermalsock.session";
  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function write(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  }
  function setInputDevice(deviceId, label) {
    var s = read();
    s.inputDeviceId = deviceId || "";
    s.inputDeviceLabel = label || "";
    s.inputChosenAt = Date.now();
    return write(s);
  }
  function getInputDevice() {
    var s = read();
    if (!s.inputDeviceId) return null;
    return {
      deviceId: s.inputDeviceId,
      label: s.inputDeviceLabel || "saved device"
    };
  }
  function clearInputDevice() {
    var s = read();
    delete s.inputDeviceId;
    delete s.inputDeviceLabel;
    delete s.inputChosenAt;
    return write(s);
  }
  function micPermissionGranted() {
    if (!navigator.permissions || !navigator.permissions.query) {
      return Promise.resolve(false);
    }
    return navigator.permissions.query({
      name: "microphone"
    }).then(function(status) {
      return status.state === "granted";
    }).catch(function() {
      return false;
    });
  }
  function applyToDeviceSelect(selectEl) {
    var saved = getInputDevice();
    if (!saved || !selectEl) return null;
    var found = Array.prototype.some.call(selectEl.options, function(o) {
      return o.value === saved.deviceId;
    });
    if (!found) return null;
    selectEl.value = saved.deviceId;
    return saved.label;
  }
  function renderNote(container, label, onChange) {
    if (!container || !label) return null;
    var note = document.createElement("div");
    note.className = "ts-session-note";
    note.innerHTML = "<span>Using <strong>" + label + "</strong>, carried over from your last session.</span>";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Change";
    btn.addEventListener("click", function() {
      clearInputDevice();
      note.remove();
      if (onChange) onChange();
    });
    note.appendChild(btn);
    container.insertBefore(note, container.firstChild);
    return note;
  }
  function wireGate(opts) {
    var select = opts.select;
    var startBtn = opts.startBtn;
    if (!select || !startBtn) return;
    startBtn.addEventListener("click", function() {
      var opt = select.options[select.selectedIndex];
      setInputDevice(select.value, opt ? opt.textContent : "");
    }, true);
    var apply = function() {
      var label = applyToDeviceSelect(select);
      if (label && opts.noteContainer) {
        var existing = opts.noteContainer.querySelector(".ts-session-note");
        if (existing) existing.remove();
        renderNote(opts.noteContainer, label, function() {
          select.selectedIndex = 0;
        });
      }
    };
    apply();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", function() {
        setTimeout(apply, 300);
      });
    }
    return apply;
  }
  var RELATED = {
    oscilloscope: [ [ "subharmonicon", "Tune with Subharmonicon" ], [ "sound-design", "Take 5 patch reference" ] ],
    subharmonicon: [ [ "oscilloscope", "See it on the scope" ], [ "loom", "Find a chord in Loom" ] ],
    "sound-design": [ [ "oscilloscope", "See it on the scope" ], [ "modulus-studio", "Shape its modulation" ] ],
    loom: [ [ "subharmonicon", "Tune the result" ], [ "transient-lab", "Practise the voicings" ] ],
    "modulus-studio": [ [ "sound-design", "Patch reference" ], [ "oscilloscope", "See the result" ] ],
    granulator: [ [ "spectral-mutation-lab", "Mutate the spectrum instead" ], [ "oscilloscope", "See the output" ] ],
    "spectral-mutation-lab": [ [ "granulator", "Granular processing instead" ], [ "oscilloscope", "See the output" ] ],
    "illuminated-ear": [ [ "transient-lab", "Train hands as well as ears" ], [ "loom", "Hear the chords in context" ] ],
    "transient-lab": [ [ "illuminated-ear", "Ear training" ], [ "loom", "Generate a progression" ] ],
    "ambient-bloom": [ [ "oscilloscope", "See what it is hearing" ], [ "granulator", "Process the source" ] ],
    "signal-path": [ [ "sound-design", "Patch reference" ], [ "subharmonicon", "Tune the rig" ] ]
  };
  var NAMES = {
    oscilloscope: "Oscilloscope",
    granulator: "Granulator",
    "spectral-mutation-lab": "Spectral Lab",
    loom: "Loom",
    subharmonicon: "Subharmonicon",
    "modulus-studio": "Modulus Studio",
    "sound-design": "Sound Design",
    "illuminated-ear": "The Illuminated Ear",
    "transient-lab": "Transient Lab",
    "ambient-bloom": "Ambient Bloom",
    "signal-path": "Signal Path"
  };
  function renderRelated() {
    var mounts = document.querySelectorAll("[data-related]");
    if (!mounts.length) return;
    var app = document.documentElement.getAttribute("data-app");
    var links = RELATED[app];
    if (!links) return;
    Array.prototype.forEach.call(mounts, function(mount) {
      var base = mount.getAttribute("data-base") || "../";
      var html = '<span class="ts-related-label">Related</span>';
      links.forEach(function(l) {
        html += '<a href="' + base + l[0] + '/index.html" title="' + NAMES[l[0]] + '">' + l[1] + "</a>";
      });
      mount.className = "ts-related";
      mount.innerHTML = html;
    });
  }
  function init() {
    renderRelated();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  global.TSSession = {
    setInputDevice: setInputDevice,
    getInputDevice: getInputDevice,
    clearInputDevice: clearInputDevice,
    micPermissionGranted: micPermissionGranted,
    applyToDeviceSelect: applyToDeviceSelect,
    wireGate: wireGate,
    renderRelated: renderRelated
  };
})(window);

(function() {
  function autoWire() {
    var select = document.getElementById("deviceSelect");
    var startBtn = document.getElementById("startBtn");
    var panel = document.querySelector(".gate-panel");
    if (!select || !startBtn || !window.TSSession) return;
    var apply = window.TSSession.wireGate({
      select: select,
      startBtn: startBtn,
      noteContainer: panel
    });
    if (apply) {
      setTimeout(apply, 400);
      setTimeout(apply, 1200);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoWire);
  } else {
    autoWire();
  }
})();