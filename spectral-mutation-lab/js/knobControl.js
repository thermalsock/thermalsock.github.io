const START_DEG = -135;

const SWEEP_DEG = 270;

function polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad)
  };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  if (endDeg - startDeg <= 1e-4) return "";
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

const knobRegistry = new Map;

export class Knob {
  constructor(mount, opts) {
    this.id = opts.id;
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step ?? (this.max - this.min) / 200;
    this.value = opts.value ?? (this.min + this.max) / 2;
    this.defaultValue = opts.defaultValue ?? this.value;
    this.format = opts.format || (v => v.toFixed(2));
    this.onChange = opts.onChange || (() => {});
    this.size = opts.size || 52;
    this._build(mount, opts.label, opts.unit);
    this._renderAngle();
    this._renderValueText();
    if (this.id) knobRegistry.set(this.id, this);
  }
  _build(mount, label, unit) {
    const size = this.size;
    const cx = size / 2, cy = size / 2, r = size / 2 - 6;
    this.wrap = document.createElement("div");
    this.wrap.className = "knob-wrap";
    if (label) {
      const labelEl = document.createElement("div");
      labelEl.className = "knob-label";
      labelEl.textContent = label;
      this.wrap.appendChild(labelEl);
    }
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.classList.add("knob-svg");
    svg.tabIndex = 0;
    const track = document.createElementNS(svgNS, "path");
    track.setAttribute("d", arcPath(cx, cy, r, START_DEG, START_DEG + SWEEP_DEG));
    track.setAttribute("class", "knob-track");
    svg.appendChild(track);
    const fill = document.createElementNS(svgNS, "path");
    fill.setAttribute("class", "knob-fill");
    svg.appendChild(fill);
    const face = document.createElementNS(svgNS, "circle");
    face.setAttribute("cx", cx);
    face.setAttribute("cy", cy);
    face.setAttribute("r", r - 7);
    face.setAttribute("class", "knob-face");
    svg.appendChild(face);
    const pointer = document.createElementNS(svgNS, "line");
    pointer.setAttribute("class", "knob-pointer");
    svg.appendChild(pointer);
    this.svg = svg;
    this.fillPath = fill;
    this.pointer = pointer;
    this._cx = cx;
    this._cy = cy;
    this._r = r;
    this.wrap.appendChild(svg);
    const valueEl = document.createElement("div");
    valueEl.className = "knob-value";
    this.valueEl = valueEl;
    this.wrap.appendChild(valueEl);
    if (unit) {
      const unitEl = document.createElement("div");
      unitEl.className = "knob-unit";
      unitEl.textContent = unit;
      this.wrap.appendChild(unitEl);
    }
    mount.appendChild(this.wrap);
    this._bindInteraction();
  }
  _bindInteraction() {
    let dragging = false;
    let startY = 0;
    let startValue = 0;
    const onPointerMove = e => {
      if (!dragging) return;
      const dy = startY - e.clientY;
      const range = this.max - this.min;
      const sensitivity = e.shiftKey ? range / 900 : range / 180;
      this.setValue(startValue + dy * sensitivity, true);
    };
    const onPointerUp = () => {
      dragging = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    this.svg.addEventListener("pointerdown", e => {
      dragging = true;
      startY = e.clientY;
      startValue = this.value;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      e.preventDefault();
    });
    this.svg.addEventListener("dblclick", () => this.setValue(this.defaultValue, true));
    this.svg.addEventListener("wheel", e => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const nudge = (e.shiftKey ? this.step / 5 : this.step) * dir;
      this.setValue(this.value + nudge, true);
    }, {
      passive: false
    });
    this.svg.addEventListener("keydown", e => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        this.setValue(this.value + this.step, true);
        e.preventDefault();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        this.setValue(this.value - this.step, true);
        e.preventDefault();
      }
    });
    this.valueEl.addEventListener("click", () => this._startTypeEntry());
  }
  _startTypeEntry() {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "knob-value-input";
    input.value = this.value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    input.step = this.step;
    this.valueEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const v = parseFloat(input.value);
      input.replaceWith(this.valueEl);
      if (!Number.isNaN(v)) this.setValue(v, true);
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.value = this.value;
        input.blur();
      }
    });
  }
  setValue(v, fromUser = false) {
    const clamped = Math.max(this.min, Math.min(this.max, v));
    this.value = clamped;
    this._renderAngle();
    this._renderValueText();
    if (fromUser) this.onChange(clamped);
  }
  getValue() {
    return this.value;
  }
  _renderAngle() {
    const t = (this.value - this.min) / (this.max - this.min);
    const angle = START_DEG + t * SWEEP_DEG;
    this.fillPath.setAttribute("d", arcPath(this._cx, this._cy, this._r, START_DEG, angle));
    const p = polar(this._cx, this._cy, this._r - 10, angle);
    const inner = polar(this._cx, this._cy, (this._r - 10) * .35, angle);
    this.pointer.setAttribute("x1", inner.x);
    this.pointer.setAttribute("y1", inner.y);
    this.pointer.setAttribute("x2", p.x);
    this.pointer.setAttribute("y2", p.y);
  }
  _renderValueText() {
    this.valueEl.textContent = this.format(this.value);
  }
}

export function getKnob(id) {
  return knobRegistry.get(id) || null;
}

export function getKnobValue(id) {
  const k = knobRegistry.get(id);
  return k ? k.value : undefined;
}

export function setKnobValue(id, v) {
  const k = knobRegistry.get(id);
  if (k) k.setValue(v, false);
}