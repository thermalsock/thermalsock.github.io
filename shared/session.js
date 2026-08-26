/* Thermalsock Labs — shared session.
 *
 * Six apps each implemented their own device gate, and nothing carried
 * between them: pick your interface in the Oscilloscope, go to Subharmonicon,
 * pick it again, then again in Ambient Bloom. That's the clearest signal
 * that these are separate programs which happen to share a stylesheet.
 *
 * This stores the chosen input device once, site-wide, so every gate can
 * default to it — and can skip the gate entirely when permission has already
 * been granted and the device is still present.
 *
 * Deliberately site-wide rather than namespaced per app: the whole point is
 * that it crosses app boundaries. Everything else stays in each app's own
 * TSStore namespace.
 */
(function (global) {
  'use strict';

  var KEY = 'thermalsock.session';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }

  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); return true; }
    catch (e) { return false; }
  }

  /** Remember the input device the user just chose. */
  function setInputDevice(deviceId, label) {
    var s = read();
    s.inputDeviceId = deviceId || '';
    s.inputDeviceLabel = label || '';
    s.inputChosenAt = Date.now();
    return write(s);
  }

  function getInputDevice() {
    var s = read();
    if (!s.inputDeviceId) return null;
    return { deviceId: s.inputDeviceId, label: s.inputDeviceLabel || 'saved device' };
  }

  function clearInputDevice() {
    var s = read();
    delete s.inputDeviceId;
    delete s.inputDeviceLabel;
    delete s.inputChosenAt;
    return write(s);
  }

  /**
   * Has the browser already granted mic permission? Used to decide whether a
   * gate can be skipped. The Permissions API isn't available everywhere
   * (notably Safari), so an unknown answer resolves to false and the gate
   * shows as normal — never assume permission we can't confirm.
   */
  function micPermissionGranted() {
    if (!navigator.permissions || !navigator.permissions.query) {
      return Promise.resolve(false);
    }
    return navigator.permissions.query({ name: 'microphone' })
      .then(function (status) { return status.state === 'granted'; })
      .catch(function () { return false; });
  }

  /**
   * Select the saved device in a <select> of inputs, if it's still present.
   * Returns the label when it matched, null otherwise (device unplugged, or
   * nothing saved yet).
   */
  function applyToDeviceSelect(selectEl) {
    var saved = getInputDevice();
    if (!saved || !selectEl) return null;
    var found = Array.prototype.some.call(selectEl.options, function (o) {
      return o.value === saved.deviceId;
    });
    if (!found) return null;
    selectEl.value = saved.deviceId;
    return saved.label;
  }

  /**
   * Show a small note explaining that the device came from another app, with
   * a way to change it. Continuity should be visible — silently reusing a
   * device the user picked somewhere else is worse than not reusing it.
   */
  function renderNote(container, label, onChange) {
    if (!container || !label) return null;
    var note = document.createElement('div');
    note.className = 'ts-session-note';
    note.innerHTML = '<span>Using <strong>' + label +
      '</strong>, carried over from your last session.</span>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Change';
    btn.addEventListener('click', function () {
      clearInputDevice();
      note.remove();
      if (onChange) onChange();
    });
    note.appendChild(btn);
    container.insertBefore(note, container.firstChild);
    return note;
  }

  /**
   * Wire a standard gate: remembers the device on start, restores it on
   * later visits, and shows the continuity note.
   *
   * opts: { select, startBtn, noteContainer }
   */
  function wireGate(opts) {
    var select = opts.select;
    var startBtn = opts.startBtn;
    if (!select || !startBtn) return;

    startBtn.addEventListener('click', function () {
      var opt = select.options[select.selectedIndex];
      setInputDevice(select.value, opt ? opt.textContent : '');
    }, true);

    // The device list is populated asynchronously, so re-apply whenever it
    // changes rather than only once at load.
    var apply = function () {
      var label = applyToDeviceSelect(select);
      if (label && opts.noteContainer) {
        var existing = opts.noteContainer.querySelector('.ts-session-note');
        if (existing) existing.remove();
        renderNote(opts.noteContainer, label, function () {
          select.selectedIndex = 0;
        });
      }
    };
    apply();
    // Device lists repopulate after permission is granted; catch that too.
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', function () {
        setTimeout(apply, 300);
      });
    }
    return apply;
  }

  /* ---- Cross-app links ----
   * Which tools are about the same thing. Rendered into [data-related] so a
   * tool can point at its siblings without hardcoding the list in eleven
   * places.
   */
  var RELATED = {
    oscilloscope:   [['subharmonicon', 'Tune with Subharmonicon'], ['sound-design', 'Take 5 patch reference']],
    subharmonicon:  [['oscilloscope', 'See it on the scope'], ['loom', 'Find a chord in Loom']],
    'sound-design': [['oscilloscope', 'See it on the scope'], ['modulus-studio', 'Shape its modulation']],
    loom:           [['subharmonicon', 'Tune the result'], ['transient-lab', 'Practise the voicings']],
    'modulus-studio': [['sound-design', 'Patch reference'], ['oscilloscope', 'See the result']],
    granulator:     [['spectral-mutation-lab', 'Mutate the spectrum instead'], ['oscilloscope', 'See the output']],
    'spectral-mutation-lab': [['granulator', 'Granular processing instead'], ['oscilloscope', 'See the output']],
    'illuminated-ear': [['transient-lab', 'Train hands as well as ears'], ['loom', 'Hear the chords in context']],
    'transient-lab':   [['illuminated-ear', 'Ear training'], ['loom', 'Generate a progression']],
    'ambient-bloom':   [['oscilloscope', 'See what it is hearing'], ['granulator', 'Process the source']],
    'signal-path':     [['sound-design', 'Patch reference'], ['subharmonicon', 'Tune the rig']],
  };

  var NAMES = {
    oscilloscope: 'Oscilloscope', granulator: 'Granulator',
    'spectral-mutation-lab': 'Spectral Lab', loom: 'Loom',
    subharmonicon: 'Subharmonicon', 'modulus-studio': 'Modulus Studio',
    'sound-design': 'Sound Design', 'illuminated-ear': 'The Illuminated Ear',
    'transient-lab': 'Transient Lab', 'ambient-bloom': 'Ambient Bloom',
    'signal-path': 'Signal Path',
  };

  function renderRelated() {
    var mounts = document.querySelectorAll('[data-related]');
    if (!mounts.length) return;
    var app = document.documentElement.getAttribute('data-app');
    var links = RELATED[app];
    if (!links) return;

    Array.prototype.forEach.call(mounts, function (mount) {
      var base = mount.getAttribute('data-base') || '../';
      var html = '<span class="ts-related-label">Related</span>';
      links.forEach(function (l) {
        html += '<a href="' + base + l[0] + '/index.html" title="' + NAMES[l[0]] + '">' + l[1] + '</a>';
      });
      mount.className = 'ts-related';
      mount.innerHTML = html;
    });
  }

  function init() { renderRelated(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
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
    renderRelated: renderRelated,
  };
})(window);

/* Auto-wire the standard gate.
 *
 * Every audio app on the site uses the same three ids (#gate-panel container,
 * #deviceSelect, #startBtn), so the wiring can be done once here rather than
 * patched into six separate main.js files — which is what let them drift
 * apart in the first place.
 *
 * This only pre-selects and annotates. It never auto-starts capture: getting
 * audio without an explicit click is exactly the behaviour a permission gate
 * exists to prevent.
 */
(function () {
  function autoWire() {
    var select = document.getElementById('deviceSelect');
    var startBtn = document.getElementById('startBtn');
    var panel = document.querySelector('.gate-panel');
    if (!select || !startBtn || !window.TSSession) return;

    var apply = window.TSSession.wireGate({
      select: select,
      startBtn: startBtn,
      noteContainer: panel,
    });

    // The device list is filled in asynchronously after enumerateDevices
    // resolves, so re-apply on a short delay as well as immediately.
    if (apply) {
      setTimeout(apply, 400);
      setTimeout(apply, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoWire);
  } else {
    autoWire();
  }
})();
