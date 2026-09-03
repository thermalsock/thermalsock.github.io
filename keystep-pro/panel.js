(function() {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var L = window.KSPLayout;
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, opts) {
    opts = opts || {};
    var t = el("text", {
      x: x,
      y: y,
      "text-anchor": opts.anchor || "middle",
      "font-size": opts.size || 15,
      "font-weight": opts.weight || 400,
      "letter-spacing": opts.tracking || 0,
      fill: opts.fill || L.colours.ink,
      "font-family": opts.family || "var(--ksp-face)",
      opacity: opts.opacity,
      textLength: opts.w,
      lengthAdjust: opts.w ? "spacingAndGlyphs" : null,
      "data-maxw": opts.maxw
    }, parent);
    t.textContent = s;
    if (opts.cls) t.setAttribute("class", opts.cls);
    return t;
  }
  function button(parent, x, y, w, h, opts) {
    opts = opts || {};
    var g = el("g", {
      class: "ksp-btn" + (opts.cls ? " " + opts.cls : "")
    }, parent);
    var r = opts.r === undefined ? 6 : opts.r;
    el("rect", {
      x: x,
      y: y + 2,
      width: w,
      height: h,
      rx: r,
      fill: "rgba(20,24,26,0.22)"
    }, g);
    el("rect", {
      x: x,
      y: y,
      width: w,
      height: h,
      rx: r,
      fill: opts.fill || "url(#ksp-btn-face)",
      stroke: opts.stroke || L.colours.btnEdge,
      "stroke-width": opts.sw || 2.4
    }, g);
    el("rect", {
      x: x + 2.4,
      y: y + 2.4,
      width: w - 4.8,
      height: Math.max(h * .42, 4),
      rx: Math.max(r - 2, 1),
      fill: "rgba(255,255,255,0.5)",
      "pointer-events": "none"
    }, g);
    return g;
  }
  function knob(parent, cx, cy, r, id) {
    var g = el("g", {
      class: "ksp-knob",
      "data-knob": id || ""
    }, parent);
    el("ellipse", {
      cx: cx,
      cy: cy + r * .12,
      rx: r * 1.03,
      ry: r * 1,
      fill: "rgba(0,0,0,0.35)"
    }, g);
    el("circle", {
      cx: cx,
      cy: cy,
      r: r,
      fill: "url(#ksp-knob)"
    }, g);
    var pts = [], i, a;
    for (i = 0; i < 9; i++) {
      a = i / 9 * Math.PI * 2 - Math.PI / 2;
      pts.push((cx + Math.cos(a) * r * .66).toFixed(2) + "," + (cy + Math.sin(a) * r * .66).toFixed(2));
    }
    el("polygon", {
      points: pts.join(" "),
      fill: "none",
      stroke: "rgba(255,255,255,0.10)",
      "stroke-width": 2
    }, g);
    el("circle", {
      cx: cx,
      cy: cy,
      r: r * .55,
      fill: "url(#ksp-knob-top)"
    }, g);
    return g;
  }
  function ledColour(state) {
    var C = L.colours;
    if (state === "red") return C.red;
    if (state === "green") return C.green;
    if (state === "cyan") return C.cyan;
    if (state === "white") return "#FFFFFF";
    return C.ledOff;
  }
  function build(root, opts) {
    opts = opts || {};
    var C = L.colours;
    var svg = el("svg", {
      viewBox: "0 0 " + L.view.w + " " + L.view.h,
      xmlns: NS,
      class: "ksp-svg",
      "shape-rendering": "geometricPrecision",
      role: "img",
      "aria-label": "Arturia KeyStep Pro front panel"
    });
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    var defs = el("defs", null, svg);
    function lg(id, stops, vertical) {
      var g = el("linearGradient", {
        id: id,
        x1: 0,
        y1: 0,
        x2: vertical === false ? 1 : 0,
        y2: vertical === false ? 0 : 1
      }, defs);
      stops.forEach(function(s) {
        el("stop", {
          offset: s[0],
          "stop-color": s[1],
          "stop-opacity": s[2]
        }, g);
      });
    }
    lg("ksp-body", [ [ 0, "#FAFCFC" ], [ .35, C.body ], [ 1, "#E9ECEE" ] ]);
    lg("ksp-grey", [ [ 0, "#D6D9D9" ], [ 1, "#C2C5C5" ] ]);
    lg("ksp-bar", [ [ 0, "#31363A" ], [ .5, C.bar ], [ 1, "#202427" ] ]);
    lg("ksp-btn-face", [ [ 0, "#EDEFEF" ], [ .5, C.btnFace ], [ 1, C.btnFaceLo ] ]);
    lg("ksp-btn-grey", [ [ 0, "#D9DCDC" ], [ .5, "#C8CBCB" ], [ 1, "#B2B5B5" ] ]);
    lg("ksp-key-white", [ [ 0, "#FDFEFE" ], [ .7, C.keyWhite ], [ 1, C.keyWhiteLo ] ]);
    lg("ksp-key-black", [ [ 0, "#4A4A4A" ], [ .55, C.keyBlack ], [ 1, C.keyBlackLo ] ]);
    lg("ksp-strip", [ [ 0, "#F6FAFA" ], [ 1, "#E7ECEC" ] ]);
    lg("ksp-display", [ [ 0, "#101214" ], [ 1, "#05070A" ] ]);
    var rg = el("radialGradient", {
      id: "ksp-knob",
      cx: "0.38",
      cy: "0.30",
      r: "0.85"
    }, defs);
    el("stop", {
      offset: 0,
      "stop-color": "#63686E"
    }, rg);
    el("stop", {
      offset: .55,
      "stop-color": C.knobMid
    }, rg);
    el("stop", {
      offset: 1,
      "stop-color": C.knobLow
    }, rg);
    var rg2 = el("radialGradient", {
      id: "ksp-knob-top",
      cx: "0.4",
      cy: "0.32",
      r: "0.8"
    }, defs);
    el("stop", {
      offset: 0,
      "stop-color": "#5C6167"
    }, rg2);
    el("stop", {
      offset: 1,
      "stop-color": "#34383D"
    }, rg2);
    var glow = el("filter", {
      id: "ksp-glow",
      x: "-120%",
      y: "-120%",
      width: "340%",
      height: "340%"
    }, defs);
    el("feGaussianBlur", {
      stdDeviation: 3.2,
      result: "b"
    }, glow);
    var fm = el("feMerge", null, glow);
    el("feMergeNode", {
      in: "b"
    }, fm);
    el("feMergeNode", {
      in: "SourceGraphic"
    }, fm);
    var B = L.body;
    el("rect", {
      x: B.x,
      y: B.y,
      width: B.w,
      height: B.h,
      rx: B.r,
      fill: "url(#ksp-body)",
      stroke: C.bodyEdge,
      "stroke-width": 2
    }, svg);
    var rear = el("g", {
      class: "ksp-rear"
    }, svg);
    L.rear.nubs.forEach(function(n) {
      el("rect", {
        x: n.x,
        y: n.y,
        width: n.w,
        height: n.h,
        rx: n.r,
        fill: "#3A3E42"
      }, rear);
    });
    L.rear.icons.forEach(function(ic) {
      if (ic.type === "power") {
        el("circle", {
          cx: ic.cx,
          cy: ic.cy,
          r: 8,
          fill: "none",
          stroke: C.ink,
          "stroke-width": 1.8
        }, rear);
        el("line", {
          x1: ic.cx,
          y1: ic.cy - 11,
          x2: ic.cx,
          y2: ic.cy - 1,
          stroke: C.ink,
          "stroke-width": 1.8
        }, rear);
      } else {
        el("line", {
          x1: ic.cx - 11,
          y1: ic.cy,
          x2: ic.cx + 10,
          y2: ic.cy,
          stroke: C.ink,
          "stroke-width": 1.6
        }, rear);
        el("circle", {
          cx: ic.cx - 12,
          cy: ic.cy,
          r: 2.6,
          fill: C.ink
        }, rear);
        el("path", {
          d: "M" + (ic.cx + 10) + " " + ic.cy + " l-6 -4 l0 8 z",
          fill: C.ink
        }, rear);
        el("line", {
          x1: ic.cx - 4,
          y1: ic.cy,
          x2: ic.cx + 1,
          y2: ic.cy - 7,
          stroke: C.ink,
          "stroke-width": 1.6
        }, rear);
        el("rect", {
          x: ic.cx,
          y: ic.cy - 10,
          width: 6,
          height: 6,
          fill: C.ink
        }, rear);
      }
    });
    L.rear.singles.forEach(function(s) {
      txt(rear, s.cx, L.rear.labelY, s.label, {
        size: 14,
        fill: C.ink
      });
    });
    L.rear.groups.forEach(function(grp) {
      var n = grp.items.length, span = grp.x1 - grp.x0, i, cx;
      for (i = 0; i < n; i++) {
        cx = grp.x0 + span * ((i + .5) / n);
        txt(rear, cx, L.rear.labelY, grp.items[i], {
          size: 14,
          fill: C.ink,
          maxw: Math.floor(span / n) - 6
        });
      }
      el("line", {
        x1: grp.x0,
        y1: L.rear.ruleY,
        x2: grp.x1,
        y2: L.rear.ruleY,
        stroke: C.ink,
        "stroke-width": 1.4
      }, rear);
      txt(rear, (grp.x0 + grp.x1) / 2, L.rear.groupY + 2, grp.group, {
        size: 12,
        weight: 600,
        tracking: .4,
        fill: C.ink
      });
    });
    el("rect", {
      x: L.grey.x,
      y: L.grey.y,
      width: L.grey.w,
      height: L.grey.h,
      fill: "url(#ksp-grey)"
    }, svg);
    el("line", {
      x1: L.grey.divider,
      y1: L.grey.y + 4,
      x2: L.grey.divider,
      y2: L.grey.y + L.grey.h - 4,
      stroke: "rgba(40,44,46,0.55)",
      "stroke-width": 2
    }, svg);
    el("path", {
      d: L.bar.path,
      fill: "url(#ksp-bar)"
    }, svg);
    var logo = el("g", null, svg);
    var lt = el("text", {
      x: L.logo.x,
      y: L.logo.baseline,
      "font-size": L.logo.size,
      "font-family": "var(--ksp-face)",
      "font-weight": 700,
      "letter-spacing": .5,
      fill: "#FFFFFF",
      "text-anchor": "start",
      textLength: L.logo.width,
      lengthAdjust: "spacingAndGlyphs"
    }, logo);
    var t1 = el("tspan", {
      fill: "#FFFFFF"
    }, lt);
    t1.textContent = "KEY";
    var t2 = el("tspan", {
      fill: "#B9BEC2"
    }, lt);
    t2.textContent = "STEP ";
    var t3 = el("tspan", {
      fill: "#FFFFFF",
      "font-weight": 800
    }, lt);
    t3.textContent = "PRO";
    txt(logo, L.logo.x + 2, L.logo.subBaseline, "Controller & Sequencer", {
      size: L.logo.subSize,
      fill: "#C6CBCF",
      anchor: "start",
      w: L.logo.subWidth
    });
    L.barKnobs.forEach(function(k) {
      knob(svg, k.cx, k.cy, k.r, k.id);
      var t = el("text", {
        x: k.cx,
        y: 244,
        "text-anchor": "middle",
        "font-size": 15,
        "font-family": "var(--ksp-face)",
        fill: "#FFFFFF",
        textLength: 78,
        lengthAdjust: "spacingAndGlyphs"
      }, svg);
      var a = el("tspan", null, t);
      a.textContent = k.label + " ";
      var b = el("tspan", {
        fill: C.blue
      }, t);
      b.textContent = k.alt;
    });
    var tapG = button(svg, L.tap.x, L.tap.y, L.tap.w, L.tap.h, {
      r: L.tap.r,
      cls: "ksp-hit",
      fill: "url(#ksp-btn-face)"
    });
    tapG.setAttribute("data-id", "tap-tempo");
    txt(svg, L.tap.x + L.tap.w / 2, L.tap.lineY[0], L.tap.lines[0], {
      size: 14,
      w: 22
    });
    txt(svg, L.tap.x + L.tap.w / 2, L.tap.lineY[1], L.tap.lines[1], {
      size: 14,
      w: 32
    });
    txt(svg, L.tap.x + L.tap.w / 2, 244, L.tap.alt, {
      size: 15,
      fill: C.blue,
      w: 53
    });
    knob(svg, L.selector.cx, L.selector.cy, L.selector.r, L.selector.id);
    var sb = L.seqBox;
    el("rect", {
      x: sb.x,
      y: sb.y,
      width: sb.w,
      height: sb.h,
      rx: 3,
      fill: "#12161A"
    }, svg);
    var seqTitle = txt(svg, sb.x + sb.w / 2, sb.y + 16, "SEQ 1", {
      size: 16,
      weight: 600,
      fill: "#FFFFFF"
    });
    el("line", {
      x1: sb.x + 3,
      y1: sb.y + 22,
      x2: sb.x + sb.w - 3,
      y2: sb.y + 22,
      stroke: "#5A6066",
      "stroke-width": 1.3
    }, svg);
    txt(svg, sb.x + 6, sb.y + 37, "PORT :", {
      size: 11,
      weight: 600,
      fill: "#FFFFFF",
      anchor: "start",
      w: 34
    });
    el("rect", {
      x: sb.x + 46,
      y: sb.y + 26,
      width: 31,
      height: 14,
      fill: "none",
      stroke: "#FFFFFF",
      "stroke-width": 1.1
    }, svg);
    var portTxt = txt(svg, sb.x + 61.5, sb.y + 37, "USB", {
      size: 11,
      weight: 600,
      fill: "#FFFFFF",
      w: 24
    });
    txt(svg, sb.x + 6, sb.y + 52, "CHAN:", {
      size: 11,
      weight: 600,
      fill: "#FFFFFF",
      anchor: "start",
      w: 34
    });
    var chanTxt = txt(svg, sb.x + 50, sb.y + 52, "3", {
      size: 11,
      weight: 600,
      fill: "#FFFFFF",
      anchor: "start"
    });
    var blocks = [], displaysTxt = [];
    L.tracks.forEach(function(tr, i) {
      var bx = L.block.x0 + i * L.block.pitch;
      var g = el("g", {
        class: "ksp-track",
        "data-track": tr.id
      }, svg);
      el("rect", {
        x: bx,
        y: L.block.tabY,
        width: L.block.w,
        height: L.block.tabH,
        fill: tr.colour
      }, g);
      el("rect", {
        x: bx,
        y: L.block.y,
        width: L.block.w,
        height: L.block.h,
        fill: tr.colour
      }, g);
      function tb(cx, cy, w, h, label, id) {
        var b = button(g, bx + cx, cy, w, h, {
          r: 5,
          cls: "ksp-hit"
        });
        b.setAttribute("data-id", id);
        if (label) txt(g, bx + cx + w / 2, cy + h / 2 + 4, label, {
          size: 12
        });
        return b;
      }
      [ 0, 1 ].forEach(function(c) {
        var b = tb(L.block.colX[c], L.block.rowY.arrows, L.block.btnW, L.block.btnH, "", "track" + tr.id + "-" + (c ? "next" : "prev"));
        var mx = bx + L.block.colX[c] + L.block.btnW / 2, my = L.block.rowY.arrows + L.block.btnH / 2;
        var d = c ? "M" + (mx - 11) + " " + my + " H" + (mx + 9) + " M" + (mx + 3) + " " + (my - 6) + " L" + (mx + 10) + " " + my + " L" + (mx + 3) + " " + (my + 6) : "M" + (mx + 11) + " " + my + " H" + (mx - 9) + " M" + (mx - 3) + " " + (my - 6) + " L" + (mx - 10) + " " + my + " L" + (mx - 3) + " " + (my + 6);
        el("path", {
          d: d,
          fill: "none",
          stroke: C.ink,
          "stroke-width": 2.2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }, b);
      });
      L.block.modes[i].forEach(function(m, c) {
        tb(L.block.colX[c], L.block.rowY.mode, L.block.btnW, L.block.btnH, m, "track" + tr.id + "-" + m.toLowerCase());
      });
      var nl = el("rect", {
        x: bx + L.block.noteLed.dx,
        y: L.block.noteLed.y,
        width: L.block.noteLed.w,
        height: L.block.noteLed.h,
        rx: 3,
        fill: i % 2 === 0 ? C.red : C.ledOff,
        class: "ksp-noteled",
        "data-note-led": tr.id
      }, g);
      txt(g, bx + L.block.noteLabel.dx, L.block.noteLabel.y, "Note", {
        size: 12,
        weight: 700,
        fill: tr.ink,
        w: 26
      });
      tb(L.block.colX[1], L.block.rowY.mute, L.block.btnW, 25, "Mute", "track" + tr.id + "-mute");
      var tbn = button(g, bx + L.block.trackBtn.dx, L.block.trackBtn.y, L.block.trackBtn.w, L.block.trackBtn.h, {
        r: 5,
        cls: "ksp-hit"
      });
      tbn.setAttribute("data-id", "track" + tr.id);
      txt(g, bx + L.block.trackBtn.dx + L.block.trackBtn.w / 2, L.block.trackBtn.y + 20, tr.name, {
        size: 13,
        w: 46
      });
      blocks.push(g);
    });
    L.displays.items.forEach(function(d) {
      el("rect", {
        x: d.cx - L.displays.w / 2,
        y: L.displays.y,
        width: L.displays.w,
        height: L.displays.h,
        rx: 2,
        fill: "url(#ksp-display)"
      }, svg);
      var t = txt(svg, d.cx, L.displays.baseline, d.value, {
        size: L.displays.size,
        weight: 500,
        fill: "#FDFDFD",
        family: "var(--ksp-seg)"
      });
      t.setAttribute("font-style", "italic");
      t.setAttribute("data-display", d.track);
      displaysTxt.push(t);
    });
    L.utility.rows.forEach(function(row) {
      row.labels.forEach(function(label, c) {
        var b = button(svg, L.utility.cols[c], row.y, L.utility.w, L.utility.h, {
          r: 5,
          cls: "ksp-hit",
          fill: "url(#ksp-btn-grey)"
        });
        b.setAttribute("data-id", label.toLowerCase());
        txt(svg, L.utility.cols[c] + L.utility.w / 2, row.y + 21, label, {
          size: 13
        });
        if (row.alts) txt(svg, L.utility.cols[c] + L.utility.w / 2, row.altY, row.alts[c], {
          size: 14,
          fill: C.blue
        });
      });
    });
    var ctl = button(svg, L.utility.control.x, L.utility.control.y, L.utility.control.w, L.utility.control.h, {
      r: 5,
      cls: "ksp-hit",
      fill: "url(#ksp-btn-grey)"
    });
    ctl.setAttribute("data-id", "control");
    txt(svg, L.utility.control.x + L.utility.control.w / 2, L.utility.control.y + 20, "Control", {
      size: 14
    });
    L.transport.items.forEach(function(it) {
      var y = L.transport.y, h = L.transport.h, cx = it.x + it.w / 2, cy = y + h / 2, g;
      if (it.kind === "play") {
        g = el("g", {
          class: "ksp-btn ksp-hit",
          "data-id": it.id
        }, svg);
        var d = "M" + it.x + " " + (y + 6) + " q0 -6 6 -6 H" + (it.x + it.w - 26) + " L" + (it.x + it.w) + " " + cy + " L" + (it.x + it.w - 26) + " " + (y + h) + " H" + (it.x + 6) + " q-6 0 -6 -6 Z";
        el("path", {
          d: d,
          transform: "translate(0,2)",
          fill: "rgba(20,24,26,0.22)"
        }, g);
        el("path", {
          d: d,
          fill: "url(#ksp-btn-grey)",
          stroke: C.btnEdge,
          "stroke-width": 2.4
        }, g);
      } else {
        g = button(svg, it.x, y, it.w, h, {
          r: 7,
          cls: "ksp-hit",
          fill: "url(#ksp-btn-grey)"
        });
        g.setAttribute("data-id", it.id);
      }
      if (it.kind === "shift") {
        el("rect", {
          x: it.x + 7,
          y: y + 7,
          width: it.w - 14,
          height: h - 14,
          rx: 3,
          fill: "#1E2226"
        }, g);
        txt(g, cx, cy + 5, "Shift", {
          size: 15,
          weight: 600,
          fill: C.blue
        });
      } else if (it.kind === "circle") {
        el("circle", {
          cx: cx,
          cy: cy,
          r: 12,
          fill: C.ink
        }, g);
      } else if (it.kind === "square") {
        el("rect", {
          x: cx - 10,
          y: cy - 10,
          width: 20,
          height: 20,
          fill: C.ink
        }, g);
      } else if (it.kind === "play") {
        el("rect", {
          x: cx - 16,
          y: cy - 13,
          width: 5,
          height: 26,
          fill: C.ink
        }, g);
        el("path", {
          d: "M" + (cx - 5) + " " + (cy - 14) + " L" + (cx + 17) + " " + cy + " L" + (cx - 5) + " " + (cy + 14) + " Z",
          fill: C.ink
        }, g);
      }
      if (it.alt) txt(svg, cx, L.transport.altY, it.alt, {
        size: 15,
        fill: C.blue
      });
    });
    L.scp.items.forEach(function(it) {
      var b = button(svg, L.scp.x, it.y, L.scp.w, L.scp.h, {
        r: 5,
        cls: "ksp-hit"
      });
      b.setAttribute("data-id", it.id);
      txt(svg, L.scp.x + L.scp.w / 2, it.y + 20, it.label, {
        size: 14
      });
    });
    var se = button(svg, L.stepEdit.x, L.stepEdit.y, L.stepEdit.w, L.stepEdit.h, {
      r: 5,
      cls: "ksp-hit"
    });
    se.setAttribute("data-id", "step-edit");
    txt(svg, L.stepEdit.x + L.stepEdit.w / 2, L.stepEdit.y + 20, L.stepEdit.label, {
      size: 13
    });
    var E = L.encoders, ringLeds = {};
    E.items.forEach(function(enc) {
      var g = el("g", {
        class: "ksp-enc",
        "data-enc": enc.id
      }, svg);
      var arr = [];
      for (var i = 0; i < E.count; i++) {
        var a = (E.startAngle + i * E.stepAngle) * Math.PI / 180;
        var lx = enc.cx + Math.cos(a) * E.ringR, ly = E.cy + Math.sin(a) * E.ringR;
        arr.push(el("circle", {
          cx: lx,
          cy: ly,
          r: E.ledR,
          fill: C.ledOff,
          class: "ksp-ringled"
        }, g));
      }
      ringLeds[enc.id] = arr;
      knob(g, enc.cx, E.cy, E.r, enc.id);
      txt(svg, enc.cx, E.labelY, enc.label, {
        size: E.labelSize,
        maxw: 130
      });
    });
    L.lastStep.items.forEach(function(it) {
      var b = button(svg, it.x, L.lastStep.y, L.lastStep.w, L.lastStep.h, {
        r: 5,
        cls: "ksp-hit"
      });
      b.setAttribute("data-id", it.id);
      txt(svg, it.x + L.lastStep.w / 2, L.lastStep.y + 19, it.label, {
        size: 13
      });
      if (it.alt) txt(svg, it.x + L.lastStep.w / 2, L.lastStep.altY, it.alt, {
        size: 14,
        fill: C.blue
      });
    });
    (function() {
      var ex = L.lastStep.extend, my = L.lastStep.altY - 5, tw = 34;
      var mid = (ex.x0 + ex.x1) / 2;
      el("line", {
        x1: ex.x0,
        y1: my,
        x2: mid - tw,
        y2: my,
        stroke: C.blue,
        "stroke-width": 1.6
      }, svg);
      el("line", {
        x1: mid + tw,
        y1: my,
        x2: ex.x1,
        y2: my,
        stroke: C.blue,
        "stroke-width": 1.6
      }, svg);
      txt(svg, mid, L.lastStep.altY, ex.label, {
        size: 14,
        fill: C.blue
      });
    })();
    (function() {
      var A = L.arturia;
      txt(svg, A.cx, A.baseline, "ARTURIA", {
        size: A.size,
        weight: 400,
        fill: C.ink,
        w: A.width
      });
      txt(svg, A.subCx, A.subBaseline, "YOUR EXPERIENCE • YOUR SOUND", {
        size: A.subSize,
        fill: C.ink,
        w: A.subWidth
      });
      txt(svg, A.cx + A.regDx, A.baseline - A.regDy, "®", {
        size: 12,
        fill: C.ink
      });
    })();
    var S = L.steps, stepEls = [];
    for (var si = 0; si < 16; si++) {
      var sx = S.x0 + si * S.pitch;
      var g = button(svg, sx, S.y, S.w, S.h, {
        r: S.r,
        cls: "ksp-hit ksp-step"
      });
      g.setAttribute("data-id", "step-" + (si + 1));
      g.setAttribute("data-step", si + 1);
      txt(g, sx + S.w / 2, S.numY, String(si + 1), {
        size: S.numSize
      });
      if (S.underlined.indexOf(si + 1) !== -1) {
        el("line", {
          x1: sx + 10,
          y1: S.ruleY,
          x2: sx + S.w - 10,
          y2: S.ruleY,
          stroke: C.ink,
          "stroke-width": 2.2
        }, g);
      }
      txt(svg, sx + S.w / 2, S.labelY, S.labels[si], {
        size: S.labelSize,
        fill: C.blue,
        maxw: 67
      });
      stepEls.push(g);
    }
    var O = L.octave, octLeds = [];
    O.leds.forEach(function(le, i) {
      txt(svg, le.x + O.ledW / 2, O.labelY, le.label, {
        size: 13
      });
      octLeds.push(el("rect", {
        x: le.x,
        y: O.ledY,
        width: O.ledW,
        height: O.ledH,
        rx: 3,
        fill: i === O.active ? "#FFFFFF" : C.ledOff,
        class: "ksp-octled"
      }, svg));
    });
    txt(svg, (O.leds[0].x + O.leds[4].x + O.ledW) / 2, O.captionY, "Octave", {
      size: 15
    });
    O.arrows.forEach(function(ar) {
      var b = button(svg, ar.x, ar.y, ar.w, ar.h, {
        r: 6,
        cls: "ksp-hit",
        fill: "url(#ksp-btn-grey)"
      });
      b.setAttribute("data-id", ar.id);
      var mx = ar.x + ar.w / 2, my = ar.y + ar.h / 2;
      var d = ar.dir === "left" ? "M" + (mx + 14) + " " + my + " H" + (mx - 12) + " M" + (mx - 5) + " " + (my - 8) + " L" + (mx - 13) + " " + my + " L" + (mx - 5) + " " + (my + 8) : "M" + (mx - 14) + " " + my + " H" + (mx + 12) + " M" + (mx + 5) + " " + (my - 8) + " L" + (mx + 13) + " " + my + " L" + (mx + 5) + " " + (my + 8);
      el("path", {
        d: d,
        fill: "none",
        stroke: C.ink,
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }, b);
    });
    (function() {
      var a = O.arrows[0], b = O.arrows[1], y = O.resetY;
      el("path", {
        d: "M" + (a.x + a.w / 2) + " " + (a.y + a.h) + " V" + y + " H" + (a.x + a.w / 2 + 66),
        fill: "none",
        stroke: C.ink,
        "stroke-width": 1.8
      }, svg);
      el("path", {
        d: "M" + (b.x + b.w / 2) + " " + (b.y + b.h) + " V" + y + " H" + (b.x + b.w / 2 - 66),
        fill: "none",
        stroke: C.ink,
        "stroke-width": 1.8
      }, svg);
      txt(svg, (a.x + a.w / 2 + b.x + b.w / 2) / 2, y + 6, "Reset", {
        size: 15
      });
    })();
    L.strips.items.forEach(function(st) {
      el("rect", {
        x: st.x,
        y: L.strips.y,
        width: st.w,
        height: L.strips.h,
        rx: L.strips.r,
        fill: "url(#ksp-strip)",
        stroke: C.stripEdge,
        "stroke-width": 2,
        class: "ksp-hit",
        "data-id": st.id
      }, svg);
      var cx = st.x + st.w / 2;
      if (st.glyph === "updown") {
        el("path", {
          d: "M" + cx + " 610 v40 M" + (cx - 8) + " 618 l8 -9 l8 9",
          fill: "none",
          stroke: C.ink,
          "stroke-width": 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }, svg);
        el("line", {
          x1: cx - 20,
          y1: 698,
          x2: cx + 20,
          y2: 698,
          stroke: C.ink,
          "stroke-width": 3
        }, svg);
        el("path", {
          d: "M" + cx + " 745 v40 M" + (cx - 8) + " 777 l8 9 l8 -9",
          fill: "none",
          stroke: C.ink,
          "stroke-width": 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }, svg);
      } else {
        el("path", {
          d: "M" + cx + " 745 v40 M" + (cx - 8) + " 753 l8 -9 l8 9",
          fill: "none",
          stroke: C.ink,
          "stroke-width": 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }, svg);
        el("line", {
          x1: cx - 22,
          y1: 796,
          x2: cx + 22,
          y2: 796,
          stroke: C.ink,
          "stroke-width": 3
        }, svg);
      }
    });
    var stripLeds = [ [], [] ];
    L.strips.ledCols.forEach(function(col, ci) {
      for (var i = 0; i < col.n; i++) {
        var state = col.lit && col.lit.indexOf(i) !== -1 ? "red" : col.green && col.green.indexOf(i) !== -1 ? "green" : "off";
        stripLeds[ci].push(el("circle", {
          cx: col.x + col.w / 2,
          cy: col.y0 + i * col.pitch + col.w / 2,
          r: col.w / 2,
          fill: ledColour(state),
          class: "ksp-stripled",
          filter: state === "red" ? "url(#ksp-glow)" : null
        }, svg));
      }
    });
    L.sideBtns.items.forEach(function(it) {
      var b = button(svg, L.sideBtns.x, it.y, L.sideBtns.w, L.sideBtns.h, {
        r: 5,
        cls: "ksp-hit",
        fill: "url(#ksp-btn-grey)"
      });
      b.setAttribute("data-id", it.id);
      txt(svg, L.sideBtns.x + L.sideBtns.w / 2, it.y + 20, it.label, {
        size: 13
      });
      if (it.alt) txt(svg, L.sideBtns.x + L.sideBtns.w / 2, it.y + L.sideBtns.altDy, it.alt, {
        size: 14,
        fill: C.blue
      });
    });
    el("rect", {
      x: L.ghost.tray.x,
      y: L.ghost.tray.y,
      width: L.ghost.tray.w,
      height: L.ghost.tray.h,
      rx: L.ghost.tray.r,
      fill: "#F1F4F5"
    }, svg);
    L.ghost.pads.forEach(function(p) {
      el("rect", {
        x: p.x,
        y: L.ghost.padY,
        width: L.ghost.padW,
        height: L.ghost.padH,
        rx: 7,
        fill: "#F7FAFA",
        stroke: "#E6EAEB",
        "stroke-width": 1.5
      }, svg);
      txt(svg, p.x + L.ghost.padW / 2, L.ghost.padY + 34, p.label, {
        size: 20,
        fill: "#E2E7E8"
      });
    });
    for (var mr = 0; mr < L.matrix.rows; mr++) {
      for (var mc = 0; mc < L.matrix.cols; mc++) {
        el("circle", {
          cx: L.matrix.x0 + mc * L.matrix.dx + L.matrix.r,
          cy: L.matrix.y0 + mr * L.matrix.dy + L.matrix.r,
          r: L.matrix.r,
          fill: "#8A8F92"
        }, svg);
      }
    }
    var LS = L.labelStrip, stripLedEls = [];
    el("path", {
      d: "M" + (LS.arrowL.cx + 7) + " " + (LS.arrowL.cy - 8) + " L" + (LS.arrowL.cx - 7) + " " + LS.arrowL.cy + " L" + (LS.arrowL.cx + 7) + " " + (LS.arrowL.cy + 8) + " Z",
      fill: "#6E7376"
    }, svg);
    el("path", {
      d: "M" + (LS.arrowR.cx - 7) + " " + (LS.arrowR.cy - 8) + " L" + (LS.arrowR.cx + 7) + " " + LS.arrowR.cy + " L" + (LS.arrowR.cx - 7) + " " + (LS.arrowR.cy + 8) + " Z",
      fill: "#6E7376"
    }, svg);
    LS.groups.forEach(function(grp, gi) {
      var next = LS.groups[gi + 1];
      var room = (next ? next.tick : LS.arrowR.cx) - grp.tick - 12;
      el("line", {
        x1: grp.tick,
        y1: LS.tickTop,
        x2: grp.tick,
        y2: LS.tickTop + LS.tickH,
        stroke: C.blue,
        "stroke-width": 2
      }, svg);
      txt(svg, grp.tick + LS.headerDx, LS.headerY, grp.title, {
        size: 13,
        weight: 600,
        fill: C.blue,
        anchor: "start",
        maxw: Math.max(40, Math.min(room, 130))
      });
    });
    LS.x.forEach(function(x, i) {
      var state = LS.lit[i] || "off";
      stripLedEls.push(el("circle", {
        cx: x,
        cy: LS.ledY,
        r: LS.ledR,
        fill: ledColour(state),
        class: "ksp-stripfn",
        filter: state !== "off" ? "url(#ksp-glow)" : null
      }, svg));
      if (LS.labels[i]) txt(svg, x, LS.labelY, LS.labels[i], {
        size: 14,
        fill: C.blue,
        maxw: 50
      });
    });
    var K = L.keys, whiteEls = [], blackEls = [];
    el("rect", {
      x: K.x,
      y: K.y,
      width: K.w,
      height: K.h,
      rx: 3,
      fill: "#2A2C2D"
    }, svg);
    var innerX = K.x + K.frame, innerW = K.w - K.frame * 2;
    var edges = [ innerX ].concat(K.seps).concat([ K.x + K.w - K.frame ]);
    var WHITE_PC = [ 0, 2, 4, 5, 7, 9, 11 ];
    var wi;
    for (wi = 0; wi < edges.length - 1; wi++) {
      var wx = edges[wi], ww = edges[wi + 1] - edges[wi];
      var oct = Math.floor(wi / 7), pc = WHITE_PC[wi % 7];
      var note = K.lowNote + oct * 12 + pc;
      var g = el("g", {
        class: "ksp-key ksp-key-white ksp-hit",
        "data-note": note,
        "data-id": "key-" + note
      }, svg);
      el("rect", {
        x: wx + .5,
        y: K.whiteTop,
        width: ww - 1,
        height: K.whiteBottom - K.whiteTop,
        fill: "url(#ksp-key-white)",
        stroke: "#B9BDBF",
        "stroke-width": 1
      }, g);
      el("rect", {
        x: wx + .5,
        y: K.whiteBottom - 16,
        width: ww - 1,
        height: 16,
        fill: "rgba(60,66,70,0.10)"
      }, g);
      whiteEls.push(g);
    }
    var BLACK_PC = [ 1, 3, 6, 8, 10 ];
    for (var bi = 0; bi < K.blackX.length; bi++) {
      var oct2 = Math.floor(bi / 5), pc2 = BLACK_PC[bi % 5];
      var note2 = K.lowNote + oct2 * 12 + pc2;
      var gb = el("g", {
        class: "ksp-key ksp-key-black ksp-hit",
        "data-note": note2,
        "data-id": "key-" + note2
      }, svg);
      el("rect", {
        x: K.blackX[bi],
        y: K.blackTop,
        width: K.blackW,
        height: K.blackBottom - K.blackTop,
        rx: 3,
        fill: "url(#ksp-key-black)"
      }, gb);
      el("rect", {
        x: K.blackX[bi] + 5,
        y: K.blackBottom - 30,
        width: K.blackW - 10,
        height: 22,
        rx: 2,
        fill: "rgba(255,255,255,0.07)"
      }, gb);
      blackEls.push(gb);
    }
    root.appendChild(svg);
    function fitLabels() {
      var nodes = svg.querySelectorAll ? svg.querySelectorAll("[data-maxw]") : [];
      Array.prototype.forEach.call(nodes, function(n) {
        var max = +n.getAttribute("data-maxw");
        var len;
        try {
          len = n.getComputedTextLength();
        } catch (e) {
          return;
        }
        if (len > max) {
          n.setAttribute("textLength", max);
          n.setAttribute("lengthAdjust", "spacingAndGlyphs");
        } else {
          n.removeAttribute("textLength");
        }
      });
    }
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(fitLabels);
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitLabels);
    }
    var listeners = {};
    function emit(name, detail) {
      (listeners[name] || []).forEach(function(fn) {
        fn(detail);
      });
    }
    svg.addEventListener("click", function(ev) {
      var hit = ev.target.closest(".ksp-hit");
      if (!hit) return;
      var id = hit.getAttribute("data-id");
      if (hit.classList.contains("ksp-key")) {
        emit("key", {
          note: +hit.getAttribute("data-note"),
          el: hit
        });
      } else if (hit.hasAttribute("data-step")) {
        emit("step", {
          step: +hit.getAttribute("data-step"),
          el: hit
        });
      }
      emit("control", {
        id: id,
        el: hit
      });
    });
    var api = {
      svg: svg,
      on: function(name, fn) {
        (listeners[name] = listeners[name] || []).push(fn);
        return api;
      },
      setStep: function(n, state) {
        var g = stepEls[n - 1];
        if (!g) return api;
        g.setAttribute("data-state", state || "off");
        return api;
      },
      clearSteps: function() {
        stepEls.forEach(function(g) {
          g.setAttribute("data-state", "off");
        });
        return api;
      },
      setKeys: function(notes, state) {
        var set = {};
        (notes || []).forEach(function(n) {
          set[n] = 1;
        });
        whiteEls.concat(blackEls).forEach(function(g) {
          var on = set[+g.getAttribute("data-note")];
          if (on) g.setAttribute("data-lit", state || "on"); else g.removeAttribute("data-lit");
        });
        return api;
      },
      setStripLed: function(i, state) {
        var c = stripLedEls[i];
        if (!c) return api;
        c.setAttribute("fill", ledColour(state));
        if (state && state !== "off") c.setAttribute("filter", "url(#ksp-glow)"); else c.removeAttribute("filter");
        return api;
      },
      clearStripLeds: function() {
        stripLedEls.forEach(function(c) {
          c.setAttribute("fill", ledColour("off"));
          c.removeAttribute("filter");
        });
        return api;
      },
      setEncoder: function(id, value) {
        var arr = ringLeds[id];
        if (!arr) return api;
        var n = value === null || value === undefined ? -1 : Math.round(value * (arr.length - 1));
        arr.forEach(function(c, i) {
          var on = i <= n;
          c.setAttribute("fill", on ? C.red : C.ledOff);
          if (on) c.setAttribute("filter", "url(#ksp-glow)"); else c.removeAttribute("filter");
        });
        return api;
      },
      setDisplay: function(track, value) {
        var t = displaysTxt[track - 1];
        if (t) t.textContent = String(value);
        return api;
      },
      setSeqBox: function(title, port, chan) {
        if (title !== undefined) seqTitle.textContent = title;
        if (port !== undefined) portTxt.textContent = port;
        if (chan !== undefined) chanTxt.textContent = String(chan);
        return api;
      },
      setOctave: function(n) {
        octLeds.forEach(function(r, i) {
          r.setAttribute("fill", i === n + 2 ? "#FFFFFF" : C.ledOff);
        });
        return api;
      },
      focusTrack: function(n) {
        blocks.forEach(function(g, i) {
          if (!n) g.removeAttribute("data-dim"); else g.setAttribute("data-dim", i === n - 1 ? "no" : "yes");
        });
        return api;
      }
    };
    return api;
  }
  window.KSPPanel = {
    mount: build
  };
})();