(function() {
  "use strict";
  var G = window.KSPGen;
  var store = window.TSStore ? window.TSStore.create("keystep-arp") : null;
  var panel = null;
  var current = null;
  var developed = null;
  var showing = null;
  function $(id) {
    return document.getElementById(id);
  }
  function fillSelect(el, obj, labelKey) {
    Object.keys(obj).forEach(function(k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = obj[k][labelKey || "name"];
      el.appendChild(o);
    });
  }
  var STYLE_GROUPS = [ {
    label: "Sequencer classics",
    keys: [ "berlin", "motorik", "acid", "electro", "detroit", "trance" ]
  }, {
    label: "Ambient and modal",
    keys: [ "neoambient", "psybient", "cinematic", "pulse" ]
  }, {
    label: "Minimalism",
    keys: [ "phase", "additive" ]
  }, {
    label: "Broken and swung",
    keys: [ "idm", "breakbeat", "dubtechno" ]
  }, {
    label: "Retro",
    keys: [ "synthwave", "arpeggio" ]
  } ];
  function initControls() {
    STYLE_GROUPS.forEach(function(grp) {
      var og = document.createElement("optgroup");
      og.label = grp.label;
      grp.keys.forEach(function(k) {
        if (!G.STYLES[k]) return;
        var o = document.createElement("option");
        o.value = k;
        o.textContent = G.STYLES[k].name;
        og.appendChild(o);
      });
      $("style").appendChild(og);
    });
    fillSelect($("role"), G.ROLES);
    fillSelect($("phrasing"), G.PHRASINGS);
    fillSelect($("lengthStrategy"), G.LENGTH_STRATEGIES);
    var sc = $("scale");
    Object.keys(G.SCALES).forEach(function(k) {
      var s = G.SCALES[k];
      var o = document.createElement("option");
      o.value = k;
      o.textContent = s.name + (s.onDevice ? "" : "  (not on the hardware)");
      sc.appendChild(o);
    });
    var rt = $("root");
    G.NOTE_NAMES.forEach(function(n, i) {
      var o = document.createElement("option");
      o.value = i;
      o.textContent = n;
      rt.appendChild(o);
    });
    var saved = store && store.get("controls", null);
    if (saved) {
      [ "style", "role", "scale", "root", "octave", "density", "range", "tempo", "mode", "track", "clockMode", "period", "phrasing", "lengthStrategy", "phraseGrid", "ensCount", "ensPreset", "ensSpace" ].forEach(function(k) {
        if (saved[k] !== undefined && $(k)) $(k).value = saved[k];
      });
    } else {
      $("style").value = "berlin";
      $("role").value = "lead";
      $("scale").value = "minor";
      $("root").value = 2;
    }
    syncStyleHint();
    updateReadouts();
    updateGenerateLabel();
  }
  function readControls() {
    return {
      style: $("style").value,
      role: $("role").value,
      scale: $("scale").value,
      root: parseInt($("root").value, 10),
      octave: parseInt($("octave").value, 10),
      density: parseFloat($("density").value) / 100,
      range: parseFloat($("range").value),
      seed: parseInt($("seed").value, 10) || 1,
      phrasing: $("phrasing").value,
      lengthStrategy: $("lengthStrategy").value,
      phraseGrid: parseInt($("phraseGrid").value, 10)
    };
  }
  function saveControls() {
    if (!store) return;
    var c = {};
    [ "style", "role", "scale", "root", "octave", "density", "range", "tempo", "seed" ].forEach(function(k) {
      if ($(k)) c[k] = $(k).value;
    });
    store.set("controls", c);
  }
  function syncStyleHint() {
    var st = G.STYLES[$("style").value];
    $("styleBlurb").textContent = st ? st.blurb : "";
  }
  function updateGenerateLabel() {
    var mode = $("phrasing").value;
    var stratKey = $("lengthStrategy").value;
    var n = G.projectedLength(mode, stratKey, 16, parseInt($("phraseGrid").value, 10));
    var strat = G.LENGTH_STRATEGIES[stratKey];
    var m0 = G.PHRASINGS[mode];
    var varies = strat && strat.varies && m0 && m0.parts > 1;
    $("generate").textContent = "Generate " + (varies ? "about " : "") + n + " steps";
    var m = G.PHRASINGS[mode];
    $("phraseBlurb").textContent = m ? m.blurb : "";
    $("strategyCtl").style.display = m && m.parts > 1 ? "" : "none";
    $("gridCtl").style.display = m && m.parts > 1 ? "" : "none";
  }
  function renderPhraseMap(pattern) {
    var host = $("phraseMap");
    host.innerHTML = "";
    var ph = pattern.meta.phrases || [];
    if (ph.length < 2) return;
    ph.forEach(function(f) {
      var d = document.createElement("div");
      d.className = "ph";
      d.style.flex = f.length;
      var b = document.createElement("b");
      b.textContent = f.label.split(" — ")[0];
      var t = document.createElement("span");
      t.textContent = f.material && f.material < f.length ? f.material + " of " + f.length + " steps" : f.length + " steps";
      d.appendChild(b);
      d.appendChild(t);
      d.title = f.label + " · steps " + (f.from + 1) + "–" + (f.from + f.length);
      host.appendChild(d);
    });
  }
  function updateReadouts() {
    $("densityOut").textContent = $("density").value + "%";
    $("rangeOut").textContent = $("range").value + (parseFloat($("range").value) === 1 ? " octave" : " octaves");
    $("octaveOut").textContent = "C" + $("octave").value;
  }
  function paint(pattern) {
    showing = pattern;
    var m = pattern.meta;
    panel.clearSteps();
    for (var i = 0; i < 16; i++) {
      var s = pattern.steps[i];
      panel.setStep(i + 1, !s || s.rest ? "off" : s.accent ? "accent" : "on");
    }
    var scale = G.SCALES[m.scale];
    var lit = [], rootPc = m.root;
    for (var n = 36; n <= 72; n++) {
      if (scale.pcs.indexOf(((n - rootPc) % 12 + 12) % 12) !== -1) lit.push(n);
    }
    panel.setKeys(lit, "on");
    panel.setDisplay(1, m.length);
    panel.setDisplay(2, m.onsetCount);
    panel.setDisplay(3, m.seed % 100);
    panel.setDisplay(4, Math.round(m.density * 100));
    panel.setSeqBox("SEQ 1", "USB", 1);
    renderGrid(pattern);
    renderMeta(pattern);
    renderPhraseMap(pattern);
    if (editor) {
      decorateGrid();
      renderStepEditor();
    }
    if ($("preflight")) refreshPreflight();
  }
  function renderGrid(pattern) {
    var host = $("grid");
    host.innerHTML = "";
    host.setAttribute("data-len", pattern.steps.length);
    pattern.steps.forEach(function(s, i) {
      var cell = document.createElement("div");
      cell.className = "cell" + (s.rest ? " rest" : "") + (s.accent ? " accent" : "");
      if (i % 16 === 0) cell.classList.add("bar");
      if (G.METRIC[i % 16] >= 6) cell.classList.add("strong");
      cell.setAttribute("data-i", i);
      var num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      cell.appendChild(num);
      var note = document.createElement("span");
      note.className = "note";
      note.textContent = s.rest ? "·" : G.noteName(s.notes[0]);
      cell.appendChild(note);
      if (!s.rest && s.notes.length > 1) {
        var extra = document.createElement("span");
        extra.className = "extra";
        extra.textContent = "+" + (s.notes.length - 1);
        cell.appendChild(extra);
      }
      var bars = document.createElement("span");
      bars.className = "bars";
      var v = document.createElement("i");
      v.className = "v";
      v.style.height = s.rest ? "0" : Math.round(s.vel / 127 * 100) + "%";
      var g = document.createElement("i");
      g.className = "g";
      g.style.height = s.rest ? "0" : Math.min(100, Math.round(s.gate / 1.9 * 100)) + "%";
      bars.appendChild(v);
      bars.appendChild(g);
      cell.appendChild(bars);
      cell.addEventListener("mousedown", function(ev) {
        if (!editor) return;
        editor.select(i);
        if (s.rest) return;
        var startY = ev.clientY, startDeg = 0, moved = false;
        function onMove(e2) {
          var steps = Math.round((startY - e2.clientY) / 12);
          if (steps !== startDeg) {
            if (!moved) {
              moved = true;
            }
            editor.nudgePitch(steps - startDeg, e2.altKey);
            startDeg = steps;
          }
        }
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
      if (!s.rest) {
        cell.title = G.noteName(s.notes[0]) + (s.notes.length > 1 ? " + " + s.notes.slice(1).map(G.noteName).join(" ") : "") + "  ·  velocity " + s.vel + "  ·  gate " + s.gate.toFixed(2) + (s.tie ? "  ·  tied" : "");
      }
      host.appendChild(cell);
    });
  }
  function renderMeta(pattern) {
    var m = pattern.meta;
    var bits = [ m.styleName, m.roleName, m.rootName + " " + m.scaleName, m.onsetCount + " of " + m.length + " steps", m.lowName + "–" + m.highName ];
    if (m.phrasingName && m.phrases && m.phrases.length > 1) {
      bits.push(m.phrasingName + ", " + m.phrases.map(function(f) {
        return f.length;
      }).join("+"));
    }
    if (m.contour) bits.push("contour: " + m.contour);
    if (m.seed !== undefined) bits.push("seed " + m.seed);
    if (m.truncated) bits.push("trimmed to 64 for the hardware");
    $("meta").textContent = bits.join("   ·   ");
    var warn = $("scaleWarn");
    if (!m.onDevice) {
      warn.style.display = "";
      warn.textContent = m.scaleName + " is not in the KeyStep Pro’s own scale list. " + "Set the hardware scale to Chromatic before injecting, or the box will quantise these notes to something else.";
    } else warn.style.display = "none";
    var ops = $("ops");
    if (m.operations) {
      ops.style.display = "";
      ops.innerHTML = "<b>How the 64 was built from your 16</b>" + m.operations.map(function(o) {
        return "<span><i>Bar " + o.bar + "</i>" + o.label + "</span>";
      }).join("");
    } else ops.style.display = "none";
  }
  var ac = null, playTimer = null, playPos = 0;
  function voiceFor(role) {
    if (role === "bass") return {
      wave: "sawtooth",
      cutoff: 900,
      q: 6,
      decay: .9,
      gain: .3
    };
    if (role === "pad") return {
      wave: "triangle",
      cutoff: 2200,
      q: 1,
      decay: 1.6,
      gain: .13
    };
    if (role === "counter") return {
      wave: "square",
      cutoff: 1800,
      q: 3,
      decay: .7,
      gain: .16
    };
    return {
      wave: "sawtooth",
      cutoff: 2600,
      q: 4,
      decay: .8,
      gain: .18
    };
  }
  function playNote(midi, vel, dur, when, v) {
    var osc = ac.createOscillator();
    var filt = ac.createBiquadFilter();
    var amp = ac.createGain();
    osc.type = v.wave;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(v.cutoff * (.5 + vel / 127), when);
    filt.frequency.exponentialRampToValueAtTime(Math.max(180, v.cutoff * .35), when + dur * .9);
    filt.Q.value = v.q;
    var peak = v.gain * (.35 + vel / 127 * .65);
    amp.gain.setValueAtTime(1e-4, when);
    amp.gain.exponentialRampToValueAtTime(peak, when + .006);
    amp.gain.exponentialRampToValueAtTime(1e-4, when + Math.max(.05, dur));
    osc.connect(filt);
    filt.connect(amp);
    amp.connect(ac.destination);
    osc.start(when);
    osc.stop(when + Math.max(.06, dur) + .02);
  }
  function play() {
    if (!showing) return;
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext);
    if (ac.state === "suspended") ac.resume();
    stop(true);
    var bpm = parseFloat($("tempo").value) || 120;
    var stepSec = 60 / bpm / 4;
    var v = voiceFor(showing.meta.role);
    playPos = 0;
    $("play").textContent = "Stop";
    $("play").setAttribute("data-playing", "yes");
    var startAt = ac.currentTime + .08;
    var scheduled = 0;
    function pump() {
      var horizon = ac.currentTime + .35;
      while (scheduled < showing.steps.length && startAt + scheduled * stepSec < horizon) {
        var s = showing.steps[scheduled];
        if (!s.rest) {
          var base = startAt + (scheduled + (s.shift || 0)) * stepSec;
          var reps = s.ratchet || 1;
          var dur = stepSec * s.gate / reps;
          for (var r = 0; r < reps; r++) {
            (function(when) {
              s.notes.forEach(function(n) {
                playNote(n, s.vel, dur, when, v);
              });
            })(base + r * (stepSec / reps));
          }
        }
        scheduled++;
      }
      var elapsed = ac.currentTime - startAt;
      var pos = Math.floor(elapsed / stepSec);
      if (pos !== playPos && pos >= 0 && pos < showing.steps.length) {
        playPos = pos;
        highlight(pos);
      }
      if (scheduled >= showing.steps.length && elapsed > showing.steps.length * stepSec) {
        if ($("loop").checked) {
          stop(true);
          play();
          return;
        }
        stop();
        return;
      }
      playTimer = setTimeout(pump, 25);
    }
    pump();
  }
  function highlight(i) {
    var cells = $("grid").children;
    for (var k = 0; k < cells.length; k++) cells[k].classList.toggle("now", k === i);
    if (i < 16) panel.setStep(i + 1, "cursor");
    if (i > 0 && i <= 16) {
      var prev = showing.steps[i - 1];
      panel.setStep(i, !prev || prev.rest ? "off" : prev.accent ? "accent" : "on");
    }
  }
  function stop(quiet) {
    if (playTimer) {
      clearTimeout(playTimer);
      playTimer = null;
    }
    if (!quiet) {
      $("play").textContent = "Audition";
      $("play").removeAttribute("data-playing");
      var cells = $("grid").children;
      for (var k = 0; k < cells.length; k++) cells[k].classList.remove("now");
      if (showing) paint(showing);
    }
  }
  function generate(newSeed) {
    stop();
    stopEns();
    stopPoly();
    if (editor) editor.reset();
    if (newSeed) $("seed").value = Math.floor(Math.random() * 65536);
    var opts = readControls();
    current = G.generate(opts);
    developed = null;
    paint(current);
    $("develop").disabled = false;
    var devLen = G.developedLength(current.steps.length, 64);
    var reps = Math.round(devLen / current.steps.length);
    $("develop").textContent = reps > 1 ? "Confirm — develop to " + devLen + " (" + reps + " statements)" : "Confirm — develop this";
    $("back").style.display = "none";
    $("back").textContent = "Back to the " + current.steps.length;
    saveControls();
  }
  function develop() {
    if (!current) return;
    stop();
    developed = G.develop(current);
    paint(developed);
    $("back").style.display = "";
  }
  var editor = null;
  function initEditor() {
    if (!window.KSPEdit || !$("stepEditor")) return;
    editor = window.KSPEdit.create({
      getPattern: function() {
        return showing;
      },
      onChange: function(kind) {
        if (kind === "select" || kind === "lock") {
          decorateGrid();
          renderStepEditor();
        } else {
          paint(showing);
          renderStepEditor();
        }
        $("undo").disabled = !editor.canUndo();
        $("redo").disabled = !editor.canRedo();
        var n = editor.lockCount();
        $("lockCount").textContent = n ? n + " step" + (n === 1 ? "" : "s") + " locked" : "";
      }
    });
    $("reroll2").addEventListener("click", rerollUnlocked);
    $("lockAll").addEventListener("click", function() {
      editor.lockAll();
    });
    $("lockClear").addEventListener("click", function() {
      editor.clearLocks();
    });
    $("undo").addEventListener("click", function() {
      editor.undo();
    });
    $("redo").addEventListener("click", function() {
      editor.redo();
    });
    $("seClose").addEventListener("click", function() {
      editor.select(null);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pitch]"), function(b) {
      b.addEventListener("click", function() {
        var v = parseInt(b.getAttribute("data-pitch"), 10);
        if (Math.abs(v) === 12) editor.nudgeOctave(v > 0 ? 1 : -1); else editor.nudgePitch(v);
      });
    });
    $("seVel").addEventListener("input", function() {
      editor.setVelocity(+$("seVel").value);
    });
    $("seGate").addEventListener("input", function() {
      editor.setGate(+$("seGate").value / 100);
    });
    $("seShift").addEventListener("input", function() {
      editor.setShift(+$("seShift").value / 100);
    });
    $("seRatchet").addEventListener("input", function() {
      editor.setRatchet(+$("seRatchet").value);
    });
    $("seRest").addEventListener("click", function() {
      editor.toggleRest();
    });
    $("seLock").addEventListener("click", function() {
      editor.toggleLock();
    });
    $("seTie").addEventListener("click", function() {
      editor.toggleTie();
    });
    $("seAddNote").addEventListener("click", function() {
      editor.addNote();
    });
    $("seDelNote").addEventListener("click", function() {
      editor.removeNote();
    });
    document.addEventListener("keydown", function(ev) {
      var t = ev.target.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) editor.redo(); else editor.undo();
        return;
      }
      if (editor.selected() < 0 && ev.key !== "Escape") return;
      switch (ev.key) {
       case "ArrowUp":
        ev.preventDefault();
        ev.shiftKey ? editor.nudgeOctave(1) : editor.nudgePitch(1, ev.altKey);
        break;

       case "ArrowDown":
        ev.preventDefault();
        ev.shiftKey ? editor.nudgeOctave(-1) : editor.nudgePitch(-1, ev.altKey);
        break;

       case "ArrowLeft":
        ev.preventDefault();
        editor.move(-1);
        break;

       case "ArrowRight":
        ev.preventDefault();
        editor.move(1);
        break;

       case "Escape":
        editor.select(null);
        break;

       case "r":
       case "R":
        editor.toggleRest();
        break;

       case "l":
       case "L":
        editor.toggleLock();
        break;

       default:
        break;
      }
    });
  }
  function rerollUnlocked() {
    if (!editor || !current) {
      generate(true);
      return;
    }
    stop();
    var previous = showing;
    var opts = readControls();
    opts.seed = Math.floor(Math.random() * 65536);
    $("seed").value = opts.seed;
    if (developed && showing === developed) {
      opts.steps = undefined;
      var fresh = G.develop(G.generate(opts));
      developed = editor.applyLocks(fresh, previous);
      paint(developed);
    } else {
      current = editor.applyLocks(G.generate(opts), previous);
      developed = null;
      paint(current);
    }
    saveControls();
  }
  function decorateGrid() {
    if (!editor) return;
    var cells = $("grid").children;
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle("sel", i === editor.selected());
      cells[i].classList.toggle("locked", editor.isLocked(i));
    }
  }
  function renderStepEditor() {
    var box = $("stepEditor");
    if (!box || !editor) return;
    var i = editor.selected();
    if (i < 0 || !showing || !showing.steps[i]) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    var s = showing.steps[i];
    $("seTitle").textContent = "Step " + (i + 1) + (s.rest ? " — rest" : "");
    $("sePitchOut").textContent = s.rest ? "—" : s.notes.map(G.noteName).join(" ");
    $("seNotesOut").textContent = s.rest ? "" : s.notes.length + " note" + (s.notes.length === 1 ? "" : "s");
    $("seVel").value = s.rest ? 90 : s.vel;
    $("seVelOut").textContent = s.rest ? "—" : s.vel;
    $("seGate").value = Math.round((s.gate || .5) * 100);
    $("seGateOut").textContent = s.rest ? "—" : (s.gate || .5).toFixed(2);
    $("seShift").value = Math.round((s.shift || 0) * 100);
    $("seShiftOut").textContent = s.rest ? "—" : (s.shift || 0) === 0 ? "on the grid" : (s.shift > 0 ? "+" : "") + Math.round(s.shift * 100) + "%";
    $("seRatchet").value = s.ratchet || 1;
    $("seRatchetOut").textContent = "×" + (s.ratchet || 1);
    $("seRest").setAttribute("aria-pressed", s.rest ? "true" : "false");
    $("seLock").setAttribute("aria-pressed", editor.isLocked(i) ? "true" : "false");
    $("seTie").setAttribute("aria-pressed", s.tie ? "true" : "false");
    [ "seVel", "seGate", "seShift", "seRatchet", "seTie", "seAddNote", "seDelNote" ].forEach(function(id) {
      $(id).disabled = !!s.rest;
    });
  }
  var LIB = window.KSPLibrary;
  function renderLibrary() {
    var host = $("library");
    if (!host || !LIB) return;
    host.innerHTML = "";
    var items = LIB.list();
    var u = LIB.usage();
    $("libUsage").textContent = u.entries ? u.entries + " saved · " + Math.round(u.bytes / 1024) + " KB" : "";
    items.forEach(function(e) {
      var row = document.createElement("div");
      row.className = "lib" + (e.kind === "ensemble" ? " ens" : "");
      var wrap = document.createElement("div");
      var nm = document.createElement("div");
      nm.className = "nm";
      nm.textContent = e.name;
      var sub = document.createElement("div");
      sub.className = "sub";
      var when = new Date(e.savedAt);
      sub.textContent = (e.kind === "ensemble" ? e.tracks.length + " tracks · " + e.lengths.join("/") + " · cycle " + e.cycle : e.meta.onsetCount + " notes · " + e.meta.lowName + "–" + e.meta.highName) + "  ·  " + when.toLocaleDateString() + " " + when.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      wrap.appendChild(nm);
      wrap.appendChild(sub);
      row.appendChild(wrap);
      var acts = document.createElement("div");
      acts.className = "acts";
      function act(label, fn, cls) {
        var b = document.createElement("button");
        b.textContent = label;
        if (cls) b.className = cls;
        b.addEventListener("click", fn);
        acts.appendChild(b);
        return b;
      }
      act("Load", function() {
        if (e.kind === "ensemble") {
          ens = LIB.toEnsemble(e);
          renderEnsemble();
          $("panelPoly").open = true;
        } else {
          current = LIB.toPattern(e);
          developed = null;
          paint(current);
          $("develop").disabled = false;
          $("back").style.display = "none";
          $("panelLib").open = false;
        }
      });
      if (e.kind !== "ensemble") {
        act("Send", function() {
          sendFrom(LIB.toPattern(e), parseInt($("track").value, 10) || 1, e.name, null);
        });
      }
      if (e.recipe) {
        act("More like this", function() {
          Object.keys(e.recipe).forEach(function(k) {
            if ($(k) && k !== "seed") $(k).value = e.recipe[k];
          });
          $("seed").value = Math.floor(Math.random() * 65536);
          syncStyleHint();
          updateReadouts();
          updateGenerateLabel();
          generate(false);
          $("panelLib").open = false;
        });
      }
      act("Rename", function() {
        var next = prompt("Name this pattern", e.name);
        if (next && next.trim()) {
          LIB.rename(e.id, next.trim());
          renderLibrary();
        }
      });
      act("Delete", function() {
        if (confirm("Delete “" + e.name + "”? This cannot be undone.")) {
          LIB.remove(e.id);
          renderLibrary();
        }
      }, "del");
      row.appendChild(acts);
      host.appendChild(row);
    });
  }
  function saveCurrent() {
    if (!showing || !LIB) return;
    var suggested = LIB.autoName(showing.meta);
    var name = prompt("Name this pattern", suggested);
    if (name === null) return;
    var entry = LIB.savePattern(showing, readControlValues(), name.trim() || suggested);
    if (!entry) {
      alert("Could not save — browser storage is full. Export and clear some space.");
      return;
    }
    renderLibrary();
    flash($("save"), "Saved");
  }
  function saveEnsembleNow() {
    if (!ens || !LIB) return;
    var name = prompt("Name this ensemble", "Polyrhythm · " + ens.lengths.join("/") + " · " + ens.tracks.length + " tracks");
    if (name === null) return;
    var entry = LIB.saveEnsemble(ens, readControlValues(), name.trim());
    if (!entry) {
      alert("Could not save — browser storage is full.");
      return;
    }
    renderLibrary();
    flash($("ensSave"), "Saved");
  }
  function readControlValues() {
    var out = {};
    [ "style", "role", "scale", "root", "octave", "density", "range", "seed", "phrasing", "lengthStrategy", "phraseGrid", "tempo", "ensCount", "ensPreset", "ensSpace", "ensSeed" ].forEach(function(k) {
      if ($(k)) out[k] = $(k).value;
    });
    return out;
  }
  function flash(btn, text) {
    var was = btn.textContent;
    btn.textContent = text;
    setTimeout(function() {
      btn.textContent = was;
    }, 1300);
  }
  var ens = null;
  function ensGenerate() {
    stopEns();
    var c = readControls();
    ens = G.ensemble({
      count: parseInt($("ensCount").value, 10),
      preset: $("ensPreset").value,
      space: parseFloat($("ensSpace").value),
      seed: parseInt($("ensSeed").value, 10) || 1,
      style: c.style,
      scale: c.scale,
      root: c.root,
      octave: c.octave,
      range: c.range,
      density: c.density
    });
    renderEnsemble();
    saveControls();
  }
  function renderEnsemble() {
    var host = $("ensemble");
    host.innerHTML = "";
    if (!ens) return;
    var bars = ens.cycleBars;
    $("ensCycle").textContent = "lengths " + ens.lengths.join(" / ") + "   ·   realigns after " + ens.cycle + " steps (" + (bars % 1 === 0 ? bars : bars.toFixed(1)) + " bars of 16)" + "   ·   at most " + ens.maxStack + " part" + (ens.maxStack === 1 ? "" : "s") + " on any step";
    ens.tracks.forEach(function(t) {
      var box = document.createElement("div");
      box.className = "trk";
      var hd = document.createElement("div");
      hd.className = "hd";
      var b = document.createElement("b");
      b.textContent = "Track " + t.index;
      hd.appendChild(b);
      var info = document.createElement("span");
      info.textContent = t.pattern.meta.roleName + "  ·  " + t.length + " steps  ·  " + t.pattern.meta.onsetCount + " notes  ·  " + t.pattern.meta.lowName + "–" + t.pattern.meta.highName;
      hd.appendChild(info);
      var sendBtn = document.createElement("button");
      sendBtn.className = "send";
      sendBtn.textContent = "Send → track " + t.index;
      var st = document.createElement("span");
      st.className = "lanestatus";
      sendBtn.addEventListener("click", function() {
        sendFrom(t.pattern, t.index, "Track " + t.index, st);
      });
      hd.appendChild(sendBtn);
      hd.appendChild(st);
      box.appendChild(hd);
      var lane = document.createElement("div");
      lane.className = "lane";
      t.pattern.steps.forEach(function(s, i) {
        var cell = document.createElement("i");
        if (!s.rest) cell.className = "on";
        if (G.METRIC[i % 16] >= 6) cell.className += " strong";
        cell.textContent = s.rest ? "" : G.noteName(s.notes[0]).replace(/\d/, "");
        cell.title = "step " + (i + 1) + (s.rest ? " — rest" : " — " + G.noteName(s.notes[0]));
        lane.appendChild(cell);
      });
      box.appendChild(lane);
      host.appendChild(box);
    });
  }
  var ensTimer = null, ensStart = 0;
  function ensPlay() {
    if (!ens) return;
    if (ensTimer) {
      stopEns();
      return;
    }
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext);
    if (ac.state === "suspended") ac.resume();
    stop();
    var bpm = parseFloat($("tempo").value) || 120;
    var stepSec = 60 / bpm / 4;
    var voices = ens.tracks.map(function(t) {
      return voiceFor(t.role);
    });
    var scheduled = ens.tracks.map(function() {
      return 0;
    });
    ensStart = ac.currentTime + .1;
    $("ensPlay").textContent = "Stop";
    function pump() {
      var horizon = ac.currentTime + .4;
      ens.tracks.forEach(function(t, ti) {
        while (ensStart + scheduled[ti] * stepSec < horizon) {
          var s = t.pattern.steps[scheduled[ti] % t.length];
          if (s && !s.rest) {
            var when = ensStart + (scheduled[ti] + (s.shift || 0)) * stepSec;
            var reps = s.ratchet || 1;
            var d2 = stepSec * s.gate / reps;
            for (var r = 0; r < reps; r++) {
              (function(w) {
                s.notes.forEach(function(n) {
                  playNote(n, s.vel, d2, w, voices[ti]);
                });
              })(when + r * (stepSec / reps));
            }
          }
          scheduled[ti]++;
        }
      });
      var pos = Math.floor((ac.currentTime - ensStart) / stepSec);
      var lanes = $("ensemble").children;
      for (var li = 0; li < lanes.length; li++) {
        var cells = lanes[li].children[1].children;
        var here = (pos % ens.tracks[li].length + ens.tracks[li].length) % ens.tracks[li].length;
        for (var ci = 0; ci < cells.length; ci++) cells[ci].classList.toggle("now", ci === here);
      }
      ensTimer = setTimeout(pump, 30);
    }
    pump();
  }
  function stopEns() {
    if (ensTimer) {
      clearTimeout(ensTimer);
      ensTimer = null;
    }
    $("ensPlay").textContent = "Audition all tracks";
    var lanes = $("ensemble").children;
    for (var li = 0; li < lanes.length; li++) {
      var cells = lanes[li].children[1].children;
      for (var ci = 0; ci < cells.length; ci++) cells[ci].classList.remove("now");
    }
  }
  var statusSink = null;
  function setSendStatus(text) {
    if ($("sendStatus")) $("sendStatus").textContent = text;
    if (statusSink) statusSink.textContent = text;
  }
  function sendFrom(pattern, trackIndex, what, sink) {
    stop();
    stopEns();
    stopPoly();
    showing = pattern;
    developed = null;
    $("track").value = Math.min(4, Math.max(1, trackIndex));
    paint(showing);
    var blocked = window.KSPInject.preflight(showing, {
      output: currentOutput(),
      mode: mode()
    }).some(function(it) {
      return it.level === "stop";
    });
    if (blocked) {
      $("panelSend").open = true;
      refreshPreflight();
      if ($("panelSend").scrollIntoView) $("panelSend").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      setSendStatus("Cannot send yet — see the checks above.");
      return;
    }
    statusSink = sink || null;
    refreshPreflight();
    setSendStatus(what + " → track " + $("track").value + "…");
    doSend();
  }
  var P = window.KSPPoly;
  var poly = null;
  var prSpecs = [ {
    pulses: 3
  }, {
    pulses: 4
  } ];
  function initPoly() {
    if (!P || !$("panelPolyR")) return;
    Object.keys(P.PRESETS).forEach(function(k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = P.PRESETS[k].name;
      $("prPreset").appendChild(o);
    });
    var custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom — set below";
    $("prPreset").appendChild(custom);
    $("prPreset").value = "3:4";
    Object.keys(P.PITCH_MODES).forEach(function(k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = P.PITCH_MODES[k].name;
      $("prPitch").appendChild(o);
    });
    $("prPreset").addEventListener("change", function() {
      var pre = P.PRESETS[$("prPreset").value];
      if (pre) {
        prSpecs = pre.pulses.map(function(n) {
          return {
            pulses: n
          };
        });
        renderVoiceControls();
      }
    });
    $("prMethod").addEventListener("change", function() {
      renderVoiceControls();
      prBuild();
    });
    $("prCycle").addEventListener("input", function() {
      $("prCycleOut").textContent = $("prCycle").value + " steps";
    });
    $("prGen").addEventListener("click", prBuild);
    $("prPlay").addEventListener("click", prPlay);
    $("prSave").addEventListener("click", prSave);
    $("panelPolyR").addEventListener("toggle", function() {
      if ($("panelPolyR").open && !poly) prBuild();
      if (!$("panelPolyR").open) stopPoly();
    });
    $("prCycleOut").textContent = $("prCycle").value + " steps";
    renderVoiceControls();
  }
  function renderVoiceControls() {
    var host = $("prVoices");
    host.innerHTML = "";
    var division = $("prMethod").value === "division";
    prSpecs.forEach(function(spec, i) {
      var box = document.createElement("div");
      box.className = "pv";
      var lab = document.createElement("label");
      lab.textContent = "Voice " + (i + 1);
      box.appendChild(lab);
      if (division) {
        var sel = document.createElement("select");
        Object.keys(P.DIVISIONS).forEach(function(k) {
          var o = document.createElement("option");
          o.value = k;
          o.textContent = P.DIVISIONS[k].name;
          sel.appendChild(o);
        });
        sel.value = spec.division || [ "e", "et", "s", "q" ][i % 4];
        spec.division = sel.value;
        sel.style.width = "110px";
        sel.addEventListener("change", function() {
          spec.division = sel.value;
          prBuild();
        });
        box.appendChild(sel);
      } else {
        var pulses = document.createElement("input");
        pulses.type = "number";
        pulses.min = 1;
        pulses.max = 32;
        pulses.value = spec.pulses;
        pulses.title = "pulses across the cycle";
        pulses.addEventListener("input", function() {
          spec.pulses = Math.max(1, parseInt(pulses.value, 10) || 1);
          $("prPreset").value = "custom";
          prBuild();
        });
        box.appendChild(pulses);
        var rot = document.createElement("input");
        rot.type = "number";
        rot.min = 0;
        rot.max = 63;
        rot.value = spec.rotation || 0;
        rot.title = "rotation — shift the whole voice later in the cycle";
        rot.addEventListener("input", function() {
          spec.rotation = parseInt(rot.value, 10) || 0;
          prBuild();
        });
        box.appendChild(rot);
      }
      if (prSpecs.length > 2) {
        var kill = document.createElement("button");
        kill.className = "kill";
        kill.textContent = "×";
        kill.title = "remove this voice";
        kill.addEventListener("click", function() {
          prSpecs.splice(i, 1);
          renderVoiceControls();
          prBuild();
        });
        box.appendChild(kill);
      }
      host.appendChild(box);
    });
    if (prSpecs.length < 4) {
      var add = document.createElement("button");
      add.className = "tsl";
      add.textContent = "+ voice";
      add.addEventListener("click", function() {
        prSpecs.push({
          pulses: [ 5, 7, 9 ][prSpecs.length - 2] || 5
        });
        $("prPreset").value = "custom";
        renderVoiceControls();
        prBuild();
      });
      host.appendChild(add);
    }
  }
  function prBuild() {
    stopPoly();
    var c = readControls();
    poly = P.build({
      cycle: parseInt($("prCycle").value, 10),
      method: $("prMethod").value,
      root: c.root,
      scale: c.scale,
      octave: c.octave,
      seed: c.seed,
      voices: prSpecs.map(function(sp) {
        return Object.assign({}, sp, {
          pitchMode: $("prPitch").value
        });
      })
    });
    renderPoly();
  }
  function renderPoly() {
    if (!poly) return;
    $("prRatio").textContent = poly.ratio + (poly.trueRatio ? "  (coprime)" : "");
    var meet = {};
    poly.coincide.forEach(function(c) {
      meet[c.at] = c.voices;
    });
    $("prAnalysis").textContent = poly.note + "  The voices realign every " + poly.period + " pulses" + (poly.method === "division" ? "" : ", which is " + (poly.period / poly.counts[0]).toFixed(2) + " cycles of voice 1") + "." + (poly.coincide.length ? "  They touch at step" + (poly.coincide.length === 1 ? " " : "s ") + poly.coincide.map(function(c) {
      return c.at + 1;
    }).join(", ") + "." : "  Nothing coincides after the downbeat.");
    var host = $("prLanes");
    host.innerHTML = "";
    poly.voices.forEach(function(v) {
      var box = document.createElement("div");
      box.className = "prlane";
      var hd = document.createElement("div");
      hd.className = "hd";
      var b = document.createElement("b");
      b.textContent = "Voice " + v.index;
      hd.appendChild(b);
      var info = document.createElement("span");
      info.textContent = (v.division ? P.DIVISIONS[v.division].name + "  ·  " : "") + v.pattern.meta.onsetCount + " hits over " + v.length + " steps  ·  " + P.PITCH_MODES[v.pitchMode].name;
      hd.appendChild(info);
      var send = document.createElement("button");
      send.className = "send";
      send.textContent = "Send → track " + v.index;
      var vst = document.createElement("span");
      vst.className = "lanestatus";
      send.addEventListener("click", function() {
        sendFrom(v.pattern, v.index, "Voice " + v.index, vst);
      });
      hd.appendChild(send);
      hd.appendChild(vst);
      box.appendChild(hd);
      var lane = document.createElement("div");
      lane.className = "prcells";
      v.pattern.steps.forEach(function(s, i) {
        var c = document.createElement("i");
        if (!s.rest) c.className = i === 0 ? "on first" : "on";
        if (meet[i] && !s.rest) c.className += " meet";
        c.title = "step " + (i + 1) + (s.rest ? "" : " — " + G.noteName(s.notes[0]));
        lane.appendChild(c);
      });
      box.appendChild(lane);
      host.appendChild(box);
    });
    var plan = P.hardwarePlan(poly);
    $("prPlan").innerHTML = "<ol>" + plan.map(function(t) {
      return "<li>Track " + t.track + ": set <code>" + t.division + "</code> and <code>Lst Step " + t.lastStep + "</code>. " + t.note + "</li>";
    }).join("") + "</ol>";
  }
  var prTimer = null;
  function prPlay() {
    if (!poly) return;
    if (prTimer) {
      stopPoly();
      return;
    }
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext);
    if (ac.state === "suspended") ac.resume();
    stop();
    stopEns();
    var bpm = parseFloat($("tempo").value) || 120;
    var stepSec = 60 / bpm / 4;
    var voices = poly.voices.map(function(v, i) {
      return voiceFor([ "bass", "lead", "counter", "pad" ][i % 4]);
    });
    var scheduled = poly.voices.map(function() {
      return 0;
    });
    var start = ac.currentTime + .1;
    $("prPlay").textContent = "Stop";
    function pump() {
      var horizon = ac.currentTime + .4;
      poly.voices.forEach(function(v, vi) {
        while (start + scheduled[vi] * stepSec < horizon) {
          var s = v.pattern.steps[scheduled[vi] % v.length];
          if (s && !s.rest) {
            s.notes.forEach(function(n) {
              playNote(n, s.vel, stepSec * s.gate, start + scheduled[vi] * stepSec, voices[vi]);
            });
          }
          scheduled[vi]++;
        }
      });
      var pos = Math.floor((ac.currentTime - start) / stepSec);
      var lanes = $("prLanes").children;
      for (var li = 0; li < lanes.length; li++) {
        var cells = lanes[li].children[1].children;
        var here = (pos % poly.voices[li].length + poly.voices[li].length) % poly.voices[li].length;
        for (var ci = 0; ci < cells.length; ci++) cells[ci].classList.toggle("now", ci === here);
      }
      prTimer = setTimeout(pump, 30);
    }
    pump();
  }
  function stopPoly() {
    if (prTimer) {
      clearTimeout(prTimer);
      prTimer = null;
    }
    if ($("prPlay")) $("prPlay").textContent = "Audition";
    var lanes = $("prLanes") ? $("prLanes").children : [];
    for (var li = 0; li < lanes.length; li++) {
      var cells = lanes[li].children[1].children;
      for (var ci = 0; ci < cells.length; ci++) cells[ci].classList.remove("now");
    }
  }
  function prSave() {
    if (!poly || !LIB) return;
    var name = prompt("Name this polyrhythm", "Polyrhythm " + poly.ratio + " · " + poly.method);
    if (name === null) return;
    var asEns = {
      tracks: poly.voices.map(function(v) {
        return {
          index: v.index,
          role: "voice",
          length: v.length,
          pattern: v.pattern
        };
      }),
      lengths: poly.voices.map(function(v) {
        return v.length;
      }),
      cycle: poly.period
    };
    if (!LIB.saveEnsemble(asEns, {
      prRatio: poly.ratio,
      prMethod: poly.method
    })) {
      alert("Could not save — browser storage is full.");
      return;
    }
    renderLibrary();
    flash($("prSave"), "Saved");
  }
  var midiAccess = null, injector = null, sendTimer = null;
  function currentInput() {
    if (window.TSDevices && window.TSDevices.state() === "ready") {
      var shared = window.TSDevices.input();
      if (shared) return shared;
    }
    if (!midiAccess) return null;
    var ksp = null, first = null;
    midiAccess.inputs.forEach(function(i) {
      if (!first) first = i;
      if (!ksp && /keystep/i.test(i.name)) ksp = i;
    });
    return ksp || first;
  }
  function currentOutput() {
    if (window.TSDevices && window.TSDevices.state() === "ready") {
      var shared = window.TSDevices.output();
      if (shared) return shared;
    }
    if (!midiAccess) return null;
    var ksp = null, first = null;
    midiAccess.outputs.forEach(function(o) {
      if (!first) first = o;
      if (!ksp && /keystep/i.test(o.name)) ksp = o;
    });
    return ksp || first;
  }
  function mode() {
    return $("mode").value;
  }
  function refreshPreflight() {
    var host = $("preflight");
    host.innerHTML = "";
    if (!showing) return;
    var issues = window.KSPInject.preflight(showing, {
      output: currentOutput(),
      mode: mode()
    });
    var blocked = false;
    issues.forEach(function(it) {
      if (it.level === "stop") blocked = true;
      var d = document.createElement("div");
      d.className = "pf " + it.level;
      var b = document.createElement("b");
      b.textContent = it.level === "stop" ? "Stop" : "Check";
      var t = document.createElement("span");
      t.textContent = it.text;
      d.appendChild(b);
      d.appendChild(t);
      host.appendChild(d);
    });
    $("send").disabled = blocked;
    renderSetupSteps();
  }
  function renderSetupSteps() {
    var host = $("steps");
    var track = $("track").value;
    var bpm = $("tempo").value;
    var len = showing ? showing.steps.length : 16;
    var lines;
    if (mode() === "realtime") {
      lines = [ "Select <code>Track " + track + "</code> and set its input MIDI channel to <code>" + track + "</code>.", "Set <code>Lst Step</code> to <code>" + len + "</code>.", "Set time division to <code>1/16</code> and turn quantise on." ];
      if ($("clockMode").value === "master") {
        lines.push("Set the KeyStep Pro sync source to <code>USB</code> so it follows this tab’s clock.");
        lines.push("Press <code>Record</code> to arm it — no need to press Play. " + "This tab sends the transport: a four-beat count-in of clock, then Start, " + "then the notes, so the device begins writing at step 1.");
      } else {
        lines.push("Set the KeyStep Pro clock output on, so this tab can hear its transport.");
        lines.push("Press <code>Stop</code> on the device first, so the playhead sits at step 1.");
        lines.push("Press Send to arm, <em>then</em> hold <code>Record</code> and press <code>Play</code>. " + "The notes are placed on the device’s own clock pulses, so tempo here does not matter.");
      }
    } else {
      lines = [ "Select <code>Track " + track + "</code> and set its input MIDI channel to <code>" + track + "</code>.", "Set <code>Lst Step</code> to <code>" + len + "</code>.", "Clear the pattern with <code>Shift</code> + step 1.", "Press <code>Record</code> so Step Record arms and the display sits on step 1. Do not press Play.", "Press Send. It takes about " + Math.round(len * parseInt($("period").value, 10) / 100) / 10 + " seconds." ];
    }
    host.innerHTML = "<b>On the hardware, before you press Send</b><ol>" + lines.map(function(l) {
      return "<li>" + l + "</li>";
    }).join("") + "</ol>";
  }
  function doSend() {
    if (!showing) return;
    var outPort = currentOutput();
    if (!outPort) {
      setSendStatus("No MIDI output.");
      return;
    }
    stop();
    injector = window.KSPInject.create(outPort, parseInt($("track").value, 10));
    var plan;
    if (mode() === "realtime" && $("clockMode").value === "follow") {
      var inPort = currentInput();
      if (!inPort) {
        setSendStatus("Follow mode needs the KeyStep Pro MIDI input as well as its output. " + 'Switch to "Drive the KeyStep Pro", or check the device is connected both ways.');
        return;
      }
      $("send").style.display = "none";
      $("abort").style.display = "";
      setSendStatus("Armed. Hold Record and press Play — waiting for the device to start…");
      injector.followRecord(showing, inPort, {
        onStart: function() {
          setSendStatus("Recording…");
        },
        onStep: function(i, total) {
          setSendStatus("Recording… step " + (i + 1) + " of " + total);
          if (i < 16) panel.setStep(i + 1, "cursor");
        },
        onStop: function(n) {
          finishSend({
            stepsWritten: n
          });
        }
      });
      return;
    }
    if (mode() === "realtime") {
      plan = injector.realtime(showing, {
        bpm: parseFloat($("tempo").value) || 120,
        division: 4,
        countInBeats: 4,
        clockMaster: true
      });
    } else {
      plan = injector.stepRecord(showing, {
        periodMs: parseInt($("period").value, 10)
      });
    }
    $("send").style.display = "none";
    $("abort").style.display = "";
    var total = plan.endsAt - performance.now();
    var began = performance.now();
    function tick() {
      var elapsed = performance.now() - began;
      var left = Math.max(0, total - elapsed);
      if (mode() === "realtime" && elapsed < plan.countInMs) {
        var beat = 4 - Math.floor(elapsed / (plan.countInMs / 4));
        setSendStatus("Count-in… " + beat);
      } else {
        setSendStatus("Sending… " + (left / 1e3).toFixed(1) + "s left");
      }
      if (left <= 0) {
        finishSend(plan);
        return;
      }
      sendTimer = setTimeout(tick, 80);
    }
    tick();
  }
  function finishSend(plan) {
    if (sendTimer) {
      clearTimeout(sendTimer);
      sendTimer = null;
    }
    $("send").style.display = "";
    $("abort").style.display = "none";
    if (injector) injector.disarm();
    var msg = "Done. ";
    if (plan && plan.restsDropped) {
      msg += plan.stepsWritten + " steps written, " + plan.restsDropped + " rests dropped — the line is compacted.";
    } else {
      msg += "Stop recording on the device and press Play.";
    }
    setSendStatus(msg);
    statusSink = null;
  }
  function abortSend() {
    if (injector) {
      injector.disarm();
      injector.panic();
    }
    if (sendTimer) {
      clearTimeout(sendTimer);
      sendTimer = null;
    }
    $("send").style.display = "";
    $("abort").style.display = "none";
    setSendStatus("Stopped. Notes released.");
    statusSink = null;
  }
  function initMidi() {
    if (!navigator.requestMIDIAccess) {
      refreshPreflight();
      return;
    }
    function grab() {
      navigator.requestMIDIAccess({
        sysex: false
      }).then(function(a) {
        midiAccess = a;
        a.onstatechange = refreshPreflight;
        refreshPreflight();
      }).catch(refreshPreflight);
    }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({
        name: "midi",
        sysex: false
      }).then(function(st) {
        if (st.state === "granted") grab(); else refreshPreflight();
      }).catch(grab);
    } else grab();
  }
  function init() {
    panel = window.KSPPanel.mount($("panelHolder"));
    initControls();
    [ "style", "role", "scale", "root", "octave", "range", "density", "phrasing", "lengthStrategy", "phraseGrid" ].forEach(function(id) {
      $(id).addEventListener("input", function() {
        if (id === "style") syncStyleHint();
        if (id === "phrasing" || id === "lengthStrategy" || id === "phraseGrid") updateGenerateLabel();
        updateReadouts();
        saveControls();
      });
    });
    $("tempo").addEventListener("input", saveControls);
    $("generate").addEventListener("click", function() {
      generate(true);
    });
    $("reroll").addEventListener("click", function() {
      generate(false);
    });
    $("develop").addEventListener("click", develop);
    $("back").addEventListener("click", function() {
      stop();
      paint(current);
      $("back").style.display = "none";
    });
    $("play").addEventListener("click", function() {
      if ($("play").getAttribute("data-playing")) stop(); else play();
    });
    [ "mode", "track", "clockMode", "period" ].forEach(function(id) {
      $(id).addEventListener("input", function() {
        $("periodOut").textContent = $("period").value + " ms";
        refreshPreflight();
        saveControls();
      });
    });
    Object.keys(G.LENGTH_PRESETS).forEach(function(k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = G.LENGTH_PRESETS[k].name;
      $("ensPreset").appendChild(o);
    });
    $("ensPreset").value = "drifting";
    $("ensSpaceOut").textContent = $("ensSpace").value;
    $("ensGen").addEventListener("click", ensGenerate);
    if ($("panelPoly")) {
      $("panelPoly").addEventListener("toggle", function() {
        if ($("panelPoly").open && !ens) ensGenerate();
      });
    }
    $("ensPlay").addEventListener("click", ensPlay);
    [ "ensCount", "ensPreset", "ensSpace", "ensSeed" ].forEach(function(id) {
      $(id).addEventListener("input", function() {
        $("ensSpaceOut").textContent = $("ensSpace").value;
        saveControls();
      });
    });
    var panels = [ $("panelLib"), $("panelPoly"), $("panelPolyR"), $("panelSend") ];
    panels.forEach(function(p) {
      if (!p) return;
      p.addEventListener("toggle", function() {
        if (p.open) {
          panels.forEach(function(o) {
            if (o !== p && o.open) o.open = false;
          });
        } else if (p.id === "panelPoly") {
          stopEns();
        } else if (p.id === "panelPolyR") {
          stopPoly();
        }
      });
    });
    if (LIB) {
      $("save").addEventListener("click", saveCurrent);
      $("ensSave").addEventListener("click", saveEnsembleNow);
    } else {
      $("save").disabled = true;
      $("ensSave").disabled = true;
    }
    if (LIB) $("libExport").addEventListener("click", function() {
      var blob = new Blob([ LIB.exportAll() ], {
        type: "application/json"
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "keystep-patterns-" + (new Date).toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(function() {
        URL.revokeObjectURL(a.href);
      }, 4e3);
    });
    if (LIB) $("libImport").addEventListener("change", function(ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader;
      reader.onload = function() {
        var res = LIB.importAll(reader.result, "merge");
        if (!res.ok) {
          alert(res.error);
          return;
        }
        renderLibrary();
        alert(res.added + " added" + (res.skipped ? ", " + res.skipped + " already here" : "") + ".");
      };
      reader.readAsText(file);
      ev.target.value = "";
    });
    renderLibrary();
    $("send").addEventListener("click", doSend);
    $("abort").addEventListener("click", abortSend);
    $("tempo").addEventListener("input", renderSetupSteps);
    initMidi();
    panel.on("step", function(d) {
      if (editor && showing && d.step <= showing.steps.length) editor.select(d.step - 1);
      if (!showing) return;
      var s = showing.steps[d.step - 1];
      $("meta").textContent = s && !s.rest ? "Step " + d.step + ": " + s.notes.map(G.noteName).join(" + ") + "   ·   velocity " + s.vel + "   ·   gate " + s.gate.toFixed(2) : "Step " + d.step + ": rest";
    });
    initEditor();
    initPoly();
    generate(true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();