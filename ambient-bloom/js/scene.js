// scene.js
//
// The one visual: a living landscape under a moving sky, repainted
// continuously by whatever is coming in the input.
//
// Composition order matters and is the whole illusion of depth:
//   sky gradient -> Milky Way -> stars -> sun/moon -> aurora -> clouds
//   -> painterly stroke field (the "weather")
//   -> parallax ridges + settlements
//   -> water + reflections
//   -> birds / insects / planes / bats / meteors
//   -> shock rings + sparks
//
// A slow day/night cycle runs underneath all of it, so a long set moves
// from dusk through night to dawn. The music doesn't set the clock — it
// sets the weather within the hour.

import { Sky } from './visual/sky.js';
import { Land } from './visual/land.js';
import { Life } from './visual/life.js';
import { skyAt, sunAt, dayness, goldenness, rgba, mix, clamp, lerp } from './visual/palette.js';
import { makeCamera, distanceAt, waveSpeed } from './visual/perspective.js';

const TAU = Math.PI * 2;

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

class Stroke {
  constructor(w, h, rand) { this.rand = rand; this.reset(w, h, rand()); }
  reset(w, h, life = 0) {
    this.x = this.rand() * w;
    this.y = this.rand() * h;
    this.life = life * 3;
    this.maxLife = 2.5 + this.rand() * 5;
    this.width = 0.5 + this.rand() * 2.0;
    this.tint = this.rand();
    this.px = this.x; this.py = this.y;
  }
}

/** Full day/night cycle length, in seconds. About eight minutes: long
 *  enough that it isn't a strobing gimmick, short enough that a set
 *  actually travels through it. */
const CYCLE_SECONDS = 480;

export class Scene {
  constructor(width, height, seed = 1) {
    this.rand = seeded(seed);
    this.seedVal = seed;
    this.time = 0;
    this.fieldSeed = this.rand() * 100;

    // Start just before dusk — the lights come on early in the set, which
    // is the best-looking part and the thing worth seeing first.
    this.dayPhase = 0.68;

    this.ripples = [];
    this.blooms = [];
    this.sparks = [];

    this.sm = { swell: 0, turbulence: 0, coherence: 0.6, grain: 0.2,
                brightness: 0.3, warmth: 0.4, drive: 0, shimmer: 0, energy: 0 };

    this.resize(width, height);
  }

  resize(w, h) {
    this.w = w; this.h = h;
    const target = Math.round(clamp((w * h) / 2200, 300, 1700));
    this.strokes = [];
    for (let i = 0; i < target; i++) this.strokes.push(new Stroke(w, h, this.rand));

    if (!this.sky) this.sky = new Sky(w, h, this.seedVal * 7 + 11);
    else this.sky.build(w, h);
    if (!this.land) this.land = new Land(w, h, this.seedVal * 13 + 23);
    else this.land.build(w, h);
    if (!this.life) this.life = new Life(w, h, this.seedVal * 17 + 41);
    else this.life.resize(w, h);
  }

  get horizonY() {
    return this.h * (0.66 - this.sm.swell * 0.045);
  }

  _flow(x, y) {
    const s = 0.0016 + this.sm.turbulence * 0.0042;
    const t = this.time * (0.05 + this.sm.turbulence * 0.35);
    const n1 = valueNoise(x * s + t, y * s, this.fieldSeed);
    const n2 = valueNoise(x * s, y * s - t * 0.7, this.fieldSeed + 31);
    let a = (n1 - 0.5) * TAU * (0.35 + this.sm.turbulence * 1.5) + (n2 - 0.5) * 0.6;
    a += Math.sin(y * 0.004 + this.time * 0.2) * 0.4;
    return a;
  }

  /** Nudge the clock — a VJ control, so you can put it where you want it. */
  nudgeTime(delta) { this.dayPhase = ((this.dayPhase + delta) % 1 + 1) % 1; }
  setCycleScale(mult) { this.cycleScale = mult; }

  update(p, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000);
    this.time += dt;
    this.dayPhase = (this.dayPhase + dt / (CYCLE_SECONDS * (this.cycleScale || 1))) % 1;

    const ease = (key, target, tau) => {
      const k = 1 - Math.exp(-dtMs / tau);
      this.sm[key] += (target - this.sm[key]) * k;
    };
    ease('swell', p.swell, 420);
    ease('turbulence', p.turbulence, 260);
    ease('coherence', p.coherence, 500);
    ease('grain', p.grain, 400);
    ease('brightness', p.brightness, 700);
    ease('warmth', p.warmth, 900);
    ease('drive', p.drive, 800);
    ease('shimmer', p.shimmer, 180);
    ease('energy', p.energy, 300);

    const horizonY = this.horizonY;

    // A bass hit drops a ripple onto the water, at a real place on the
    // water plane rather than at a screen coordinate. Sub content makes a
    // longer wave, which by deep-water dispersion travels faster and
    // spreads further — so a 40Hz hit visibly outruns a 140Hz one.
    if (p.impact > 0.45 && (!this._lastShock || this.time - this._lastShock > 0.12)) {
      this._lastShock = this.time;
      const cam = makeCamera(this.w, this.h, horizonY);
      // Somewhere in the mid-field: close enough to read, far enough to
      // have room to spread.
      const d = 70 + this.rand() * 190;
      const X = (this.rand() - 0.5) * d * 1.3;
      const wavelength = lerp(6, 34, clamp(p.swell, 0, 1));
      this.ripples.push({
        X, d, born: this.time, power: clamp(p.impact, 0, 1),
        wavelength, speed: waveSpeed(wavelength),
      });
      if (this.ripples.length > 10) this.ripples.shift();
    }

    if (this.sm.coherence > 0.45 && this.sm.energy > 0.18 && this.rand() < 0.02 + this.sm.energy * 0.06) {
      this.blooms.push({
        x: this.rand() * this.w, y: horizonY * (0.15 + this.rand() * 0.7),
        r: 0, maxR: (60 + this.rand() * 200) * (0.5 + this.sm.energy),
        born: this.time, life: 3 + this.rand() * 5, tint: this.rand(),
      });
      if (this.blooms.length > 22) this.blooms.shift();
    }

    if (this.rand() < this.sm.shimmer * 34 * dt) {
      this.sparks.push({
        x: this.rand() * this.w, y: this.rand() * horizonY,
        born: this.time, life: 0.3 + this.rand() * 0.8,
        size: 1 + this.rand() * 2.4 * (0.4 + this.sm.shimmer),
      });
      if (this.sparks.length > 200) this.sparks.shift();
    }

    // Strokes drift in the sky only — below the horizon is land and water.
    const speed = (14 + this.sm.energy * 90 + this.sm.turbulence * 60) * dt;
    for (const st of this.strokes) {
      const a = this._flow(st.x, st.y);
      st.px = st.x; st.py = st.y;
      st.x += Math.cos(a) * speed;
      st.y += Math.sin(a) * speed * 0.65;

      // A hit gusts the whole sky upward and outward from centre, rather
      // than the old screen-space ring that swept through the mountains.
      if (p.impact > 0.2) {
        const dx = st.x - this.w * 0.5;
        const f = p.impact * 34 * dt;
        st.x += Math.sign(dx) * f * 0.5;
        st.y -= f;
      }

      st.life += dt;
      if (st.life > st.maxLife || st.x < -40 || st.x > this.w + 40 ||
          st.y < -40 || st.y > horizonY + 30) {
        st.reset(this.w, horizonY);
      }
    }

    const age = (o) => this.time - o.born;
    // Ripples live until they've damped out; radius follows from wave
    // speed and age, so nothing needs integrating per frame.
    this.ripples = this.ripples.filter(r => age(r) < 9);
    for (const b of this.blooms) b.r = b.maxR * Math.min(1, age(b) / (b.life * 0.55));
    this.blooms = this.blooms.filter(b => age(b) < b.life);
    this.sparks = this.sparks.filter(s => age(s) < s.life);

    const wind = this.sm.turbulence;
    this.sky.update(p, dtMs, this.dayPhase, wind);
    this.life.update(p, dtMs, this.dayPhase, this.time, horizonY);
  }

  draw(ctx, p) {
    const { w, h } = this;
    const horizonY = this.horizonY;
    const phase = this.dayPhase;
    const sky = skyAt(phase);
    const day = dayness(phase);

    // The sky is fully repainted each frame (it's a gradient, it's cheap),
    // which also clears the previous frame. The stroke trails that used to
    // come from partial clearing are now produced by the strokes' own alpha
    // and lifetime instead — a proper sky can't be a translucent overlay.
    this.sky.draw(ctx, p, phase, this.time, horizonY);

    // --- Blooms: soft washes in the sky ---
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.blooms) {
      const a = Math.max(0, 1 - (this.time - b.born) / b.life);
      const c = b.tint > 0.5 ? sky.light : mix(sky.horizon, sky.light, 0.4);
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(1, b.r));
      rg.addColorStop(0, rgba(c, 0.055 * a * (0.4 + this.sm.energy)));
      rg.addColorStop(0.6, rgba(c, 0.02 * a));
      rg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    // --- Stroke field: the weather in the sky ---
    const coh = this.sm.coherence;
    const len = lerp(2, 15, coh) * (0.5 + this.sm.energy);
    const strokeCol = mix(sky.light, sky.horizon, 0.35);
    ctx.lineCap = 'round';
    for (const st of this.strokes) {
      if (st.y > horizonY) continue;
      const fade = 1 - st.life / st.maxLife;
      const tint = st.tint < 0.5 ? strokeCol : sky.light;
      // Much softer by day: against a bright sky these read as scratches
      // rather than as wind, so daylight damps them instead of boosting them.
      const alpha = (0.02 + this.sm.energy * 0.13) * fade * (0.85 - day * 0.45);
      if (alpha < 0.003) continue;

      if (coh > 0.35) {
        const a = this._flow(st.x, st.y);
        ctx.strokeStyle = rgba(tint, alpha);
        ctx.lineWidth = st.width * (0.5 + this.sm.energy * 1.4);
        ctx.beginPath();
        ctx.moveTo(st.px, st.py);
        ctx.lineTo(st.x + Math.cos(a) * len, st.y + Math.sin(a) * len * 0.65);
        ctx.stroke();
      } else {
        const spread = 3 + this.sm.grain * 14;
        ctx.fillStyle = rgba(tint, alpha * 0.9);
        const n = 1 + Math.floor(this.sm.grain * 2);
        for (let i = 0; i < n; i++) {
          ctx.fillRect(
            st.x + (hash2(st.x + i, st.y, this.fieldSeed) - 0.5) * spread,
            st.y + (hash2(st.y, st.x + i, this.fieldSeed) - 0.5) * spread,
            st.width, st.width);
        }
      }
    }
    ctx.restore();

    // --- Land, then water ---
    this.land.draw(ctx, p, phase, this.time, horizonY);
    const sun = sunAt(phase, w, horizonY);
    this.land.drawWater(ctx, p, phase, this.time, horizonY, sun, this.ripples);

    // --- Inhabitants ---
    this.life.draw(ctx, p, phase, this.time, horizonY);

    // Ripples are drawn by the water layer, clipped to the surface.

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // --- Sparks ---
    for (const s of this.sparks) {
      const t = (this.time - s.born) / s.life;
      const a = Math.sin(t * Math.PI) * 0.6;
      ctx.fillStyle = rgba(mix([255, 246, 214], sky.light, 0.4), a);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // --- Vignette, to seat everything in the frame ---
    const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.30,
                                        w / 2, h * 0.55, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  setPhase(phase) { this._phase = phase; }
  /** Human-readable time of day, for the HUD. */
  get timeOfDay() { return skyAt(this.dayPhase).name; }
}
