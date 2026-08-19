// faderControl.js
// A vertical fader widget with the same interaction conventions as
// knobControl.js's Knob (drag to set, scroll to nudge, double-click to
// reset, click the readout to type an exact value) but rendered as a real
// slider track + handle rather than a rotary — for the parameters that read
// better as a fader bank (Tasty Chips GR-1's Sides/Tilt/Curve + A/D/S/R
// sliders were the reference for this).

const faderRegistry = new Map(); // id -> Fader instance, mirrors knobControl's registry

export class Fader {
  constructor(mount, opts) {
    this.id = opts.id;
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step ?? (this.max - this.min) / 200;
    this.value = opts.value ?? (this.min + this.max) / 2;
    this.defaultValue = opts.defaultValue ?? this.value;
    this.format = opts.format || ((v) => v.toFixed(2));
    this.onChange = opts.onChange || (() => {});
    this.trackHeight = opts.trackHeight || 84;

    this._build(mount, opts.label);
    this._render();

    if (this.id) faderRegistry.set(this.id, this);
  }

  _build(mount, label) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'fader-wrap';

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'fader-label';
      labelEl.textContent = label;
      this.wrap.appendChild(labelEl);
    }

    const track = document.createElement('div');
    track.className = 'fader-track';
    track.style.height = `${this.trackHeight}px`;
    track.tabIndex = 0;

    const fill = document.createElement('div');
    fill.className = 'fader-fill';
    const handle = document.createElement('div');
    handle.className = 'fader-handle';
    track.appendChild(fill);
    track.appendChild(handle);

    this.track = track;
    this.fill = fill;
    this.handle = handle;
    this.wrap.appendChild(track);

    const valueEl = document.createElement('div');
    valueEl.className = 'fader-value';
    this.valueEl = valueEl;
    this.wrap.appendChild(valueEl);

    mount.appendChild(this.wrap);
    this._bindInteraction();
  }

  _bindInteraction() {
    let dragging = false;
    let startY = 0;
    let startValue = 0;

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dy = startY - e.clientY;
      const range = this.max - this.min;
      const sensitivity = e.shiftKey ? range / (this.trackHeight * 5) : range / this.trackHeight;
      this.setValue(startValue + dy * sensitivity, true);
    };
    const onPointerUp = () => {
      dragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    this.track.addEventListener('pointerdown', (e) => {
      dragging = true;
      startY = e.clientY;
      startValue = this.value;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
    });

    this.track.addEventListener('dblclick', () => this.setValue(this.defaultValue, true));

    this.track.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const nudge = (e.shiftKey ? this.step / 5 : this.step) * dir;
      this.setValue(this.value + nudge, true);
    }, { passive: false });

    this.track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { this.setValue(this.value + this.step, true); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { this.setValue(this.value - this.step, true); e.preventDefault(); }
    });

    this.valueEl.addEventListener('click', () => this._startTypeEntry());
  }

  _startTypeEntry() {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'fader-value-input';
    input.value = this.value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    input.step = this.step;
    this.valueEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const v = parseFloat(input.value);
      input.replaceWith(this.valueEl);
      if (!Number.isNaN(v)) this.setValue(v, true);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = this.value; input.blur(); }
    });
  }

  setValue(v, fromUser = false) {
    const clamped = Math.max(this.min, Math.min(this.max, v));
    this.value = clamped;
    this._render();
    if (fromUser) this.onChange(clamped);
  }

  getValue() { return this.value; }

  _render() {
    const t = (this.value - this.min) / (this.max - this.min);
    this.fill.style.height = `${t * 100}%`;
    this.handle.style.bottom = `${t * 100}%`;
    this.valueEl.textContent = this.format(this.value);
  }
}

export function getFader(id) { return faderRegistry.get(id) || null; }
export function getFaderValue(id) { const f = faderRegistry.get(id); return f ? f.value : undefined; }
export function setFaderValue(id, v) { const f = faderRegistry.get(id); if (f) f.setValue(v, false); }

// --- Horizontal variant, for the big scrub slider under the screen --------

const hFaderRegistry = new Map();

export class HFader {
  constructor(mount, opts) {
    this.id = opts.id;
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step ?? (this.max - this.min) / 400;
    this.value = opts.value ?? (this.min + this.max) / 2;
    this.defaultValue = opts.defaultValue ?? this.value;
    this.format = opts.format || ((v) => v.toFixed(2));
    this.onChange = opts.onChange || (() => {});

    this._build(mount, opts.label);
    this._render();
    if (this.id) hFaderRegistry.set(this.id, this);
  }

  _build(mount, label) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'hfader-wrap';

    if (label) {
      const row = document.createElement('div');
      row.className = 'hfader-label-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'hfader-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.className = 'hfader-value';
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      this.wrap.appendChild(row);
      this.valueEl = valueEl;
      this.labelEl = labelEl;
    } else {
      const valueEl = document.createElement('span');
      valueEl.className = 'hfader-value';
      this.valueEl = valueEl;
    }

    const track = document.createElement('div');
    track.className = 'hfader-track';
    track.tabIndex = 0;
    const fill = document.createElement('div');
    fill.className = 'hfader-fill';
    const handle = document.createElement('div');
    handle.className = 'hfader-handle';
    track.appendChild(fill);
    track.appendChild(handle);
    this.track = track;
    this.fill = fill;
    this.handle = handle;
    this.wrap.appendChild(track);

    if (!label) this.wrap.appendChild(this.valueEl);

    mount.appendChild(this.wrap);
    this._bindInteraction();
  }

  _bindInteraction() {
    let dragging = false;
    const setFromClientX = (clientX) => {
      const rect = this.track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      this.setValue(this.min + t * (this.max - this.min), true);
    };
    this.track.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.track.setPointerCapture(e.pointerId);
      setFromClientX(e.clientX);
    });
    this.track.addEventListener('pointermove', (e) => { if (dragging) setFromClientX(e.clientX); });
    this.track.addEventListener('pointerup', () => { dragging = false; });
    this.track.addEventListener('dblclick', () => this.setValue(this.defaultValue, true));
    this.track.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      this.setValue(this.value + this.step * dir, true);
    }, { passive: false });
    this.track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { this.setValue(this.value + this.step, true); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { this.setValue(this.value - this.step, true); e.preventDefault(); }
    });
  }

  setValue(v, fromUser = false) {
    const clamped = Math.max(this.min, Math.min(this.max, v));
    this.value = clamped;
    this._render();
    if (fromUser) this.onChange(clamped);
  }

  getValue() { return this.value; }

  _render() {
    const t = (this.value - this.min) / (this.max - this.min);
    this.fill.style.width = `${t * 100}%`;
    this.handle.style.left = `${t * 100}%`;
    this.valueEl.textContent = this.format(this.value);
  }
}

export function getHFaderValue(id) { const f = hFaderRegistry.get(id); return f ? f.value : undefined; }
export function setHFaderValue(id, v) { const f = hFaderRegistry.get(id); if (f) f.setValue(v, false); }
export function setHFaderLabel(id, text) { const f = hFaderRegistry.get(id); if (f && f.labelEl) f.labelEl.textContent = text; }
