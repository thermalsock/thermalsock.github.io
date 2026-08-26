// visual/land.js
//
// Everything at and below the horizon.
//
// Ridges now carry a real world distance in metres, and everything placed
// on them is scaled by 1/d through the shared camera. That's what fixes
// settlements: previously every village was drawn at the same size whether
// it sat on the near ridge or the furthest one, which made them look stuck
// on rather than in the landscape.
//
// There are no houses any more. Drawing individual buildings meant drawing
// the same little template over and over, and at any believable distance a
// village isn't a set of readable buildings — it's a smudge of light at
// night and a patch of cleared ground by day. So that's what it is now:
// population is indicated, not modelled.

import { skyAt, dayness, goldenness, rgba, mix, clamp, lerp } from './palette.js';
import { makeCamera, project, distanceAt, projectRing, rippleAmplitude, waveSpeed } from './perspective.js';

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

function ridgeHeight(x, w, octaves, seedOff) {
  let y = 0, amp = 1, freq = 1.1;
  for (let o = 0; o < octaves; o++) {
    y += Math.sin((x / w) * freq * TAU + seedOff * (o + 1) * 2.7) * amp;
    y += Math.sin((x / w) * freq * 1.87 * TAU + seedOff * (o + 2) * 1.3) * amp * 0.6;
    amp *= 0.52;
    freq *= 2.03;
  }
  return y;
}

// Ground distance to each ridge, in metres. Real numbers, so aerial haze
// and settlement scale both follow from one consistent world.
const RIDGE_DISTANCE = [7000, 2600, 1100, 420];

export class Land {
  constructor(w, h, seed = 23) {
    this.seed = seed;
    this.build(w, h);
  }

  build(w, h) {
    this.w = w; this.h = h;
    const rand = seeded(this.seed);

    this.ridges = RIDGE_DISTANCE.map((dist, i) => {
      const depth = i / (RIDGE_DISTANCE.length - 1);   // 0 far .. 1 near
      return {
        depth, dist,
        seedOff: rand() * 10,
        amp: (0.045 + depth * 0.085) * h,
        base: -h * (0.075 - depth * 0.085),
        octaves: 3 + i,
        drift: (1 - depth) * 0.4,
      };
    });

    /* --- Settlements ---------------------------------------------------
       A settlement is a cloud of lights with world-space offsets in metres,
       not a row of buildings in pixels. Its apparent size then falls out of
       the camera: a town 7km away is a few sub-pixel glints, the same town
       at 420m is a spread of distinct windows. */
    this.settlements = [];
    const count = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      // Bias toward the middle ridges: the furthest reads as a distant town,
      // the nearest as a hamlet just across the water.
      const ridgeIdx = 1 + Math.floor(rand() * 3);
      const ridge = this.ridges[ridgeIdx];
      // Lateral offset in metres, converted to a screen x through the camera
      // at draw time.
      const spanM = ridge.dist * 1.1;
      const centreX = (rand() - 0.5) * spanM;
      // Bigger settlements sit further away, which is how real geography
      // tends to look from a shoreline — the city is across the bay.
      const population = 14 + Math.floor(rand() * rand() * 90 * (ridge.dist / 1000));
      const lights = [];
      for (let j = 0; j < population; j++) {
        // Cluster tightly at the centre with a long tail — settlements are
        // dense in the middle and scattered at the edges.
        const rr = Math.pow(rand(), 1.9);
        const ang = rand() * TAU;
        lights.push({
          dx: Math.cos(ang) * rr * (60 + ridge.dist * 0.05),   // metres
          dy: Math.sin(ang) * rr * (26 + ridge.dist * 0.02),   // metres, up the slope
          onAt: 0.5 + rand() * 0.42,
          flicker: rand() * TAU,
          warm: 0.62 + rand() * 0.38,
          bright: 0.35 + Math.pow(rand(), 2) * 0.65,
        });
      }
      this.settlements.push({ ridgeIdx, centreX, lights, spreadM: 60 + ridge.dist * 0.05, seedOff: rand() * 10 });
    }

    // Terracing / cleared ground, visible by day as tonal variation only.
    this.clearings = [];
    for (let i = 0; i < 22; i++) {
      this.clearings.push({
        x: rand(), wobble: rand() * TAU, size: 0.02 + rand() * 0.06, ridgeIdx: 2 + Math.floor(rand() * 2),
      });
    }
  }

  ridgeY(r, x, horizonY, swell) {
    const hgt = ridgeHeight(x + r.drift * 40, this.w, r.octaves, r.seedOff);
    const swellFactor = 1 + swell * (0.10 + (1 - r.depth) * 0.30);
    return horizonY + r.base - hgt * r.amp * swellFactor;
  }

  draw(ctx, p, phase, time, horizonY) {
    const sky = skyAt(phase);
    const day = dayness(phase);
    const night = 1 - day;
    const gold = goldenness(phase);
    const swell = p.swell;
    const cam = makeCamera(this.w, this.h, horizonY);

    for (let i = 0; i < this.ridges.length; i++) {
      const r = this.ridges[i];
      // Aerial perspective from the real distance: extinction rises with
      // distance, so the haze factor is derived rather than guessed.
      const haze = 1 - Math.exp(-r.dist / 3000);
      const base = mix(sky.ground, sky.horizon, haze * 0.78);
      const lit = mix(base, sky.light, gold * 0.24 * haze);

      ctx.fillStyle = rgba(lit, 1);
      ctx.beginPath();
      ctx.moveTo(0, this.h);
      const step = Math.max(2, Math.round(this.w / 260));
      for (let x = 0; x <= this.w; x += step) ctx.lineTo(x, this.ridgeY(r, x, horizonY, swell));
      ctx.lineTo(this.w, this.h);
      ctx.closePath();
      ctx.fill();

      // Cleared ground / terracing, daytime only, as a tonal patch rather
      // than any drawn structure.
      if (day > 0.25) {
        for (const c of this.clearings) {
          if (c.ridgeIdx !== i) continue;
          const cxp = c.x * this.w;
          const y0 = this.ridgeY(r, cxp, horizonY, swell);
          const rw = this.w * c.size, rh = (this.h - y0) * 0.22;
          const g = ctx.createRadialGradient(cxp, y0 + rh * 0.4, 0, cxp, y0 + rh * 0.4, rw);
          g.addColorStop(0, rgba(mix(lit, sky.light, 0.30), 0.16 * day));
          g.addColorStop(1, rgba(lit, 0));
          ctx.fillStyle = g;
          ctx.fillRect(cxp - rw, y0, rw * 2, rh * 2);
        }
      }

      if (gold > 0.05 || night > 0.4) {
        ctx.strokeStyle = rgba(sky.light, (gold * 0.34 + night * 0.10) * (1 - haze * 0.6));
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let x = 0; x <= this.w; x += step) {
          const y = this.ridgeY(r, x, horizonY, swell);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Settlements on this ridge, drawn immediately after it so nearer
      // ridges occlude the ones behind.
      this._drawSettlements(ctx, cam, i, p, phase, time, horizonY, swell, day, night, sky);
    }
  }

  _drawSettlements(ctx, cam, ridgeIdx, p, phase, time, horizonY, swell, day, night, sky) {
    for (const s of this.settlements) {
      if (s.ridgeIdx !== ridgeIdx) continue;
      const r = this.ridges[ridgeIdx];

      // Pixels per metre at this ridge's distance. Everything below scales
      // from this one number, which is what makes distance read correctly.
      const ppm = cam.f / r.dist;
      const sx = cam.cx + s.centreX * ppm;
      const spreadPx = s.spreadM * ppm;
      if (sx < -spreadPx * 2 || sx > this.w + spreadPx * 2) continue;

      const groundY = this.ridgeY(r, sx, horizonY, swell);

      /* --- Daytime: a haze of habitation, no buildings ---------------- */
      if (day > 0.25) {
        const g = ctx.createRadialGradient(sx, groundY, 0, sx, groundY, Math.max(4, spreadPx * 1.5));
        g.addColorStop(0, rgba(mix(sky.ground, sky.light, 0.34), 0.20 * day));
        g.addColorStop(1, rgba(sky.ground, 0));
        ctx.fillStyle = g;
        ctx.fillRect(sx - spreadPx * 1.5, groundY - spreadPx * 1.5, spreadPx * 3, spreadPx * 3);

        // A couple of smoke columns — the one legible sign of people at
        // distance, and they drift with the wind.
        ctx.save();
        ctx.globalAlpha = 0.16 * day;
        ctx.strokeStyle = rgba(mix(sky.light, [255, 255, 255], 0.5), 1);
        ctx.lineWidth = Math.max(0.6, ppm * 1.2);
        for (let k = 0; k < 2; k++) {
          const ox = sx + (k - 0.5) * spreadPx * 0.7;
          ctx.beginPath();
          ctx.moveTo(ox, groundY);
          for (let t = 1; t <= 6; t++) {
            const up = t / 6;
            ctx.lineTo(
              ox + Math.sin(time * 0.4 + t * 0.9 + s.seedOff) * up * spreadPx * 0.5 + up * spreadPx * 0.4,
              groundY - up * spreadPx * 1.6);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      /* --- Night: lights ---------------------------------------------- */
      if (night > 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Light pollution: a soft dome over the settlement, brighter and
        // wider for bigger towns, dimmer with distance. This is what makes
        // a far-off town read as a town rather than as three stray pixels.
        const domeR = spreadPx * (2.2 + Math.sqrt(s.lights.length) * 0.25);
        const domeA = clamp(night * 0.10 * Math.sqrt(s.lights.length) / 8, 0, 0.22) * (0.6 + p.energy * 0.5);
        if (domeR > 2 && domeA > 0.004) {
          const dg = ctx.createRadialGradient(sx, groundY, 0, sx, groundY, domeR);
          dg.addColorStop(0, rgba([255, 186, 108], domeA));
          dg.addColorStop(0.45, rgba([255, 160, 90], domeA * 0.35));
          dg.addColorStop(1, rgba([255, 150, 80], 0));
          ctx.fillStyle = dg;
          ctx.fillRect(sx - domeR, groundY - domeR, domeR * 2, domeR * 2);
        }

        for (const L of s.lights) {
          const on = clamp((night - L.onAt) * 6, 0, 1);
          if (on <= 0.01) continue;
          const lx = sx + L.dx * ppm;
          const ly = groundY - Math.abs(L.dy) * ppm * 0.6;
          if (lx < -10 || lx > this.w + 10) continue;

          const flick = 0.88 + 0.12 * Math.sin(time * 1.6 + L.flicker);
          const a = on * flick * L.bright * (0.5 + p.energy * 0.5);
          const col = [255, 190 * L.warm, 112 * L.warm];

          // Apparent size of a window at this distance. Below about a pixel
          // it stops being a shape and becomes a point of light with a
          // halo, which is exactly how distant lights behave.
          const sizePx = clamp(2.2 * ppm, 0.35, 3.2);
          const haloR = sizePx * 3.4;
          const hg = ctx.createRadialGradient(lx, ly, 0, lx, ly, haloR);
          hg.addColorStop(0, rgba(col, a * 0.55));
          hg.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = hg;
          ctx.fillRect(lx - haloR, ly - haloR, haloR * 2, haloR * 2);

          ctx.fillStyle = rgba(col, a);
          ctx.fillRect(lx, ly, sizePx, sizePx);
        }
        ctx.restore();
      }
    }
  }

  /**
   * Water: sky-reflecting surface, a specular path under whatever is
   * lighting it, and ripples from bass hits.
   *
   * `sun` comes from the sky model, so the light column is under the actual
   * light source. It used to be hardcoded to the centre of the frame, which
   * put the reflection behind a mountain — a reflection can only ever be
   * directly below the thing casting it.
   */
  drawWater(ctx, p, phase, time, horizonY, sun, ripples) {
    const sky = skyAt(phase);
    const day = dayness(phase);
    const h = this.h - horizonY;
    if (h <= 0) return;
    const cam = makeCamera(this.w, this.h, horizonY);

    const g = ctx.createLinearGradient(0, horizonY, 0, this.h);
    g.addColorStop(0, rgba(mix(sky.horizon, sky.ground, 0.35), 0.95));
    g.addColorStop(1, rgba(mix(sky.ground, [0, 0, 0], 0.45), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, this.w, h);

    ctx.save();
    // Everything from here is water-surface only. Clipping is what keeps
    // ripples off the sky — they were previously screen-space ellipses
    // centred on the horizon, so they swept across the mountains too.
    ctx.beginPath();
    ctx.rect(0, horizonY, this.w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    // --- Specular path, under the light source ---
    if (sun && sun.y < horizonY + 4) {
      const colX = sun.x;
      // A low light makes a long narrow path; a high one makes a short
      // wide pool. Grazing angles also reflect far more strongly, which is
      // why a sunset path is so much brighter than a midday one.
      const elev = clamp(sun.elev, 0.001, 1);
      const fresnel = clamp(Math.pow(1 - elev, 2.2), 0.06, 1);
      const rows = Math.round(clamp(h / 4, 16, 130));
      for (let i = 0; i < rows; i++) {
        const t = i / rows;
        const y = horizonY + t * h;
        const d = distanceAt(cam, y);
        if (!isFinite(d)) continue;
        // Chop scales with the ripple energy and with how close it is.
        const chop = (2 + p.swell * 22) * (cam.f / d) * 0.25;
        const wobble = Math.sin(time * (0.7 + t * 1.6) + d * 0.05) * chop
                     + Math.sin(time * 2.3 - d * 0.11) * chop * 0.5;
        // The path widens with distance from the observer in screen terms
        // because the surface tilts away — narrow at the horizon, broad in
        // the foreground.
        const width = this.w * (0.012 + t * 0.13) * (0.6 + p.energy * 0.7);
        const a = (1 - t * 0.75) * 0.13 * fresnel * (0.4 + day * 0.5 + p.shimmer * 0.4);
        if (a < 0.002) continue;
        ctx.fillStyle = rgba(sky.light, a);
        ctx.fillRect(colX - width / 2 + wobble, y, width, Math.max(1, h / rows * 0.9));
      }
    }

    // --- Ripples from bass hits ---
    if (ripples && ripples.length) {
      for (const rp of ripples) {
        const age = time - rp.born;
        const radius = rp.speed * age;
        const amp = rippleAmplitude(radius, age) * rp.power;
        if (amp < 0.02) continue;
        // Two crests per hit, a wavelength apart, like a real impact.
        for (let c = 0; c < 2; c++) {
          const rr = radius - c * rp.wavelength * 0.5;
          if (rr <= 0.5) continue;
          const pts = projectRing(cam, rp.X, rp.d, rr, 44);
          ctx.strokeStyle = rgba(sky.light, amp * (c === 0 ? 0.30 : 0.15));
          ctx.lineWidth = clamp((cam.f / rp.d) * 0.5, 0.6, 3);
          ctx.beginPath();
          let started = false;
          for (const pt of pts) {
            if (!pt) { started = false; continue; }
            if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    const hz = ctx.createLinearGradient(0, horizonY - 14, 0, horizonY + 14);
    hz.addColorStop(0, rgba(sky.horizon, 0));
    hz.addColorStop(0.5, rgba(sky.horizon, 0.34));
    hz.addColorStop(1, rgba(sky.horizon, 0));
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizonY - 14, this.w, 28);
  }
}
