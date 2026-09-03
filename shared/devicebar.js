(function(global) {
  "use strict";
  var CSS = [ ".devbar{position:relative;}", ".devbar-btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);", "font-size:11px;letter-spacing:.02em;color:var(--ink-soft);background:rgba(138,160,184,0.06);", "border:1px solid var(--hairline);border-radius:999px;padding:6px 12px;cursor:pointer;", "max-width:210px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}", ".devbar-btn:hover{color:var(--ink);border-color:var(--rust);}", ".devbar-dot{width:7px;height:7px;border-radius:50%;background:var(--ink-faint);flex:none;}", ".devbar-dot.on{background:var(--rust);box-shadow:0 0 7px var(--rust);}", ".devbar-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:400;width:264px;", "background:var(--paper-deep);border:1px solid var(--hairline);border-radius:11px;", "padding:13px 14px;box-shadow:0 18px 44px rgba(0,0,0,0.55);display:none;}", '.devbar-pop[data-open="1"]{display:block;}', ".devbar-pop h4{margin:0 0 9px;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;", "text-transform:uppercase;color:var(--ink-faint);font-weight:400;}", ".devbar-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;}", ".devbar-row label{font-family:var(--mono);font-size:9.5px;letter-spacing:.07em;", "text-transform:uppercase;color:var(--ink-faint);width:26px;flex:none;}", ".devbar-row select{flex:1;min-width:0;font-family:var(--serif-body);font-size:12px;", "color:var(--ink);background:var(--paper);border:1px solid var(--hairline);", "border-radius:7px;padding:6px 7px;outline:none;}", ".devbar-row select:focus{border-color:var(--rust);}", ".devbar-note{font-family:var(--mono);font-size:9.5px;line-height:1.55;color:var(--ink-faint);margin-top:6px;}", ".devbar-note a{color:var(--rust);}" ].join("");
  function injectCSS() {
    if (document.getElementById("devbar-css")) return;
    var st = document.createElement("style");
    st.id = "devbar-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function shorten(name, n) {
    if (!name) return "";
    return name.length > n ? name.slice(0, n - 1) + "…" : name;
  }
  function mount(host) {
    var D = global.TSDevices;
    if (!D) return;
    host.classList.add("devbar");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "devbar-btn";
    btn.innerHTML = '<span class="devbar-dot"></span><span class="devbar-label">MIDI</span>';
    var pop = document.createElement("div");
    pop.className = "devbar-pop";
    pop.innerHTML = "<h4>Devices — shared across every tool</h4>" + '<div class="devbar-row"><label for="db-mo">Out</label><select id="db-mo"></select></div>' + '<div class="devbar-row"><label for="db-mi">In</label><select id="db-mi"></select></div>' + '<div class="devbar-row"><label for="db-ai">Audio</label><select id="db-ai"></select></div>' + '<div class="devbar-note"></div>';
    host.appendChild(btn);
    host.appendChild(pop);
    var moSel = pop.querySelector("#db-mo");
    var miSel = pop.querySelector("#db-mi");
    var aiSel = pop.querySelector("#db-ai");
    var note = pop.querySelector(".devbar-note");
    function fill(sel, items, chosen, blank) {
      sel.innerHTML = "";
      if (!items.length) {
        var o = document.createElement("option");
        o.textContent = blank;
        sel.appendChild(o);
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      items.forEach(function(it, i) {
        var opt = document.createElement("option");
        opt.value = it.id || it.deviceId;
        opt.textContent = it.name || it.label || "Input " + (i + 1);
        sel.appendChild(opt);
      });
      if (chosen) sel.value = chosen.id || chosen.deviceId;
    }
    function paint() {
      var st = D.state();
      var out = st === "ready" ? D.output() : null;
      btn.querySelector(".devbar-dot").classList.toggle("on", !!out);
      var label;
      if (st === "unsupported") label = "No Web MIDI"; else if (st === "denied") label = "MIDI blocked"; else if (st !== "ready") label = "Connect MIDI"; else label = out ? shorten(out.name, 22) : "No MIDI out";
      btn.querySelector(".devbar-label").textContent = label;
      btn.title = st === "ready" && out ? "Sending to " + out.name + ". Click to change — this is shared by every tool." : "Click to choose your MIDI and audio devices.";
      fill(moSel, D.midiOutputs(), D.output(), st === "ready" ? "No outputs" : "Not connected");
      fill(miSel, D.midiInputs(), D.input(), st === "ready" ? "No inputs" : "Not connected");
      fill(aiSel, D.audioInputs(), D.audioInput(), "None found");
      var msg = "";
      if (st === "unsupported") msg = "Web MIDI needs Chrome or Edge over https or localhost."; else if (st === "denied") msg = "MIDI permission was refused. Reload to try again."; else if (st !== "ready") msg = "Click the pill to connect."; else if (D.audioInputs().length && !D.audioLabelsAvailable()) msg = "Audio inputs stay unnamed until a tool has been given microphone access.";
      note.textContent = msg;
    }
    function open(v) {
      pop.setAttribute("data-open", v ? "1" : "0");
    }
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (D.state() !== "ready" && D.state() !== "unsupported") {
        D.connect();
        open(true);
        return;
      }
      open(pop.getAttribute("data-open") !== "1");
    });
    document.addEventListener("click", function(e) {
      if (!host.contains(e.target)) open(false);
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") open(false);
    });
    moSel.addEventListener("change", function() {
      D.setOutput(this.value);
    });
    miSel.addEventListener("change", function() {
      D.setInput(this.value);
    });
    aiSel.addEventListener("change", function() {
      D.setAudioInput(this.value);
    });
    D.onChange(paint);
    paint();
  }
  function init() {
    if (!global.TSDevices) return;
    injectCSS();
    Array.prototype.forEach.call(document.querySelectorAll("[data-device-bar]"), mount);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);