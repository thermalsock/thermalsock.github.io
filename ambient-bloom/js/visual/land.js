import { skyAt, dayness, goldenness, rgba, mix, clamp, lerp } from "./palette.js";

import { makeCamera, project, distanceAt, projectRing, rippleAmplitude, waveSpeed } from "./perspective.js";

const TAU = Math.PI * 2;

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 1831565813;
    let x = Math.imul(t ^ t >>> 15, 1 | t);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function ridgeHeight(x, w, octaves, seedOff) {
  let y = 0, amp = 1, freq = 1.1;
  for (let o = 0; o < octaves; o++) {
    y += Math.sin(x / w * freq * TAU + seedOff * (o + 1) * 2.7) * amp;
    y += Math.sin(x / w * freq * 1.87 * TAU + seedOff * (o + 2) * 1.3) * amp * .6;
    amp *= .52;
    freq *= 2.03;
  }
  return y;
}

const RIDGE_DISTANCE = [ 7e3, 2600, 1100, 420 ];

export class Land {
  constructor(w, h, seed = 23) {
    this.seed = seed;
    this.build(w, h);
  }
  build(w, h) {
    this.w = w;
    this.h = h;
    const rand = seeded(this.seed);
    this.ridges = RIDGE_DISTANCE.map((dist, i) => {
      const depth = i / (RIDGE_DISTANCE.length - 1);
      return {
        depth: depth,
        dist: dist,
        seedOff: rand() * 10,
        amp: (.045 + depth * .085) * h,
        base: -h * (.075 - depth * .085),
        octaves: 3 + i,
        drift: (1 - depth) * .4
      };
    });
    this.settlements = [];
    const count = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const ridgeIdx = 1 + Math.floor(rand() * 3);
      const ridge = this.ridges[ridgeIdx];
      const spanM = ridge.dist * 1.1;
      const centreX = (rand() - .5) * spanM;
      const population = 14 + Math.floor(rand() * rand() * 90 * (ridge.dist / 1e3));
      const lights = [];
      for (let j = 0; j < population; j++) {
        const rr = Math.pow(rand(), 1.9);
        const ang = rand() * TAU;
        lights.push({
          dx: Math.cos(ang) * rr * (60 + ridge.dist * .05),
          dy: Math.sin(ang) * rr * (26 + ridge.dist * .02),
          onAt: .5 + rand() * .42,
          flicker: rand() * TAU,
          warm: .62 + rand() * .38,
          bright: .35 + Math.pow(rand(), 2) * .65
        });
      }
      this.settlements.push({
        ridgeIdx: ridgeIdx,
        centreX: centreX,
        lights: lights,
        spreadM: 60 + ridge.dist * .05,
        seedOff: rand() * 10
      });
    }
    this.clearings = [];
    for (let i = 0; i < 22; i++) {
      this.clearings.push({
        x: rand(),
        wobble: rand() * TAU,
        size: .02 + rand() * .06,
        ridgeIdx: 2 + Math.floor(rand() * 2)
      });
    }
  }
  ridgeY(r, x, horizonY, swell) {
    const hgt = ridgeHeight(x + r.drift * 40, this.w, r.octaves, r.seedOff);
    const swellFactor = 1 + swell * (.1 + (1 - r.depth) * .3);
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
      const haze = 1 - Math.exp(-r.dist / 3e3);
      const base = mix(sky.ground, sky.horizon, haze * .78);
      const lit = mix(base, sky.light, gold * .24 * haze);
      ctx.fillStyle = rgba(lit, 1);
      ctx.beginPath();
      ctx.moveTo(0, this.h);
      const step = Math.max(2, Math.round(this.w / 260));
      for (let x = 0; x <= this.w; x += step) ctx.lineTo(x, this.ridgeY(r, x, horizonY, swell));
      ctx.lineTo(this.w, this.h);
      ctx.closePath();
      ctx.fill();
      if (day > .25) {
        for (const c of this.clearings) {
          if (c.ridgeIdx !== i) continue;
          const cxp = c.x * this.w;
          const y0 = this.ridgeY(r, cxp, horizonY, swell);
          const rw = this.w * c.size, rh = (this.h - y0) * .22;
          const g = ctx.createRadialGradient(cxp, y0 + rh * .4, 0, cxp, y0 + rh * .4, rw);
          g.addColorStop(0, rgba(mix(lit, sky.light, .3), .16 * day));
          g.addColorStop(1, rgba(lit, 0));
          ctx.fillStyle = g;
          ctx.fillRect(cxp - rw, y0, rw * 2, rh * 2);
        }
      }
      if (gold > .05 || night > .4) {
        ctx.strokeStyle = rgba(sky.light, (gold * .34 + night * .1) * (1 - haze * .6));
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let x = 0; x <= this.w; x += step) {
          const y = this.ridgeY(r, x, horizonY, swell);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      this._drawSettlements(ctx, cam, i, p, phase, time, horizonY, swell, day, night, sky);
    }
  }
  _drawSettlements(ctx, cam, ridgeIdx, p, phase, time, horizonY, swell, day, night, sky) {
    for (const s of this.settlements) {
      if (s.ridgeIdx !== ridgeIdx) continue;
      const r = this.ridges[ridgeIdx];
      const ppm = cam.f / r.dist;
      const sx = cam.cx + s.centreX * ppm;
      const spreadPx = s.spreadM * ppm;
      if (sx < -spreadPx * 2 || sx > this.w + spreadPx * 2) continue;
      const groundY = this.ridgeY(r, sx, horizonY, swell);
      if (day > .25) {
        const g = ctx.createRadialGradient(sx, groundY, 0, sx, groundY, Math.max(4, spreadPx * 1.5));
        g.addColorStop(0, rgba(mix(sky.ground, sky.light, .34), .2 * day));
        g.addColorStop(1, rgba(sky.ground, 0));
        ctx.fillStyle = g;
        ctx.fillRect(sx - spreadPx * 1.5, groundY - spreadPx * 1.5, spreadPx * 3, spreadPx * 3);
        ctx.save();
        ctx.globalAlpha = .16 * day;
        ctx.strokeStyle = rgba(mix(sky.light, [ 255, 255, 255 ], .5), 1);
        ctx.lineWidth = Math.max(.6, ppm * 1.2);
        for (let k = 0; k < 2; k++) {
          const ox = sx + (k - .5) * spreadPx * .7;
          ctx.beginPath();
          ctx.moveTo(ox, groundY);
          for (let t = 1; t <= 6; t++) {
            const up = t / 6;
            ctx.lineTo(ox + Math.sin(time * .4 + t * .9 + s.seedOff) * up * spreadPx * .5 + up * spreadPx * .4, groundY - up * spreadPx * 1.6);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      if (night > .4) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const domeR = spreadPx * (2.2 + Math.sqrt(s.lights.length) * .25);
        const domeA = clamp(night * .1 * Math.sqrt(s.lights.length) / 8, 0, .22) * (.6 + p.energy * .5);
        if (domeR > 2 && domeA > .004) {
          const dg = ctx.createRadialGradient(sx, groundY, 0, sx, groundY, domeR);
          dg.addColorStop(0, rgba([ 255, 186, 108 ], domeA));
          dg.addColorStop(.45, rgba([ 255, 160, 90 ], domeA * .35));
          dg.addColorStop(1, rgba([ 255, 150, 80 ], 0));
          ctx.fillStyle = dg;
          ctx.fillRect(sx - domeR, groundY - domeR, domeR * 2, domeR * 2);
        }
        for (const L of s.lights) {
          const on = clamp((night - L.onAt) * 6, 0, 1);
          if (on <= .01) continue;
          const lx = sx + L.dx * ppm;
          const ly = groundY - Math.abs(L.dy) * ppm * .6;
          if (lx < -10 || lx > this.w + 10) continue;
          const flick = .88 + .12 * Math.sin(time * 1.6 + L.flicker);
          const a = on * flick * L.bright * (.5 + p.energy * .5);
          const col = [ 255, 190 * L.warm, 112 * L.warm ];
          const sizePx = clamp(2.2 * ppm, .35, 3.2);
          const haloR = sizePx * 3.4;
          const hg = ctx.createRadialGradient(lx, ly, 0, lx, ly, haloR);
          hg.addColorStop(0, rgba(col, a * .55));
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
  drawWater(ctx, p, phase, time, horizonY, sun, ripples) {
    const sky = skyAt(phase);
    const day = dayness(phase);
    const h = this.h - horizonY;
    if (h <= 0) return;
    const cam = makeCamera(this.w, this.h, horizonY);
    const g = ctx.createLinearGradient(0, horizonY, 0, this.h);
    g.addColorStop(0, rgba(mix(sky.horizon, sky.ground, .35), .95));
    g.addColorStop(1, rgba(mix(sky.ground, [ 0, 0, 0 ], .45), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, this.w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, this.w, h);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    if (sun && sun.y < horizonY + 4) {
      const colX = sun.x;
      const elev = clamp(sun.elev, .001, 1);
      const fresnel = clamp(Math.pow(1 - elev, 2.2), .06, 1);
      const rows = Math.round(clamp(h / 4, 16, 130));
      for (let i = 0; i < rows; i++) {
        const t = i / rows;
        const y = horizonY + t * h;
        const d = distanceAt(cam, y);
        if (!isFinite(d)) continue;
        const chop = (2 + p.swell * 22) * (cam.f / d) * .25;
        const wobble = Math.sin(time * (.7 + t * 1.6) + d * .05) * chop + Math.sin(time * 2.3 - d * .11) * chop * .5;
        const width = this.w * (.012 + t * .13) * (.6 + p.energy * .7);
        const a = (1 - t * .75) * .13 * fresnel * (.4 + day * .5 + p.shimmer * .4);
        if (a < .002) continue;
        ctx.fillStyle = rgba(sky.light, a);
        ctx.fillRect(colX - width / 2 + wobble, y, width, Math.max(1, h / rows * .9));
      }
    }
    if (ripples && ripples.length) {
      for (const rp of ripples) {
        const age = time - rp.born;
        const radius = rp.speed * age;
        const amp = rippleAmplitude(radius, age) * rp.power;
        if (amp < .02) continue;
        for (let c = 0; c < 2; c++) {
          const rr = radius - c * rp.wavelength * .5;
          if (rr <= .5) continue;
          const pts = projectRing(cam, rp.X, rp.d, rr, 44);
          ctx.strokeStyle = rgba(sky.light, amp * (c === 0 ? .3 : .15));
          ctx.lineWidth = clamp(cam.f / rp.d * .5, .6, 3);
          ctx.beginPath();
          let started = false;
          for (const pt of pts) {
            if (!pt) {
              started = false;
              continue;
            }
            if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    const hz = ctx.createLinearGradient(0, horizonY - 14, 0, horizonY + 14);
    hz.addColorStop(0, rgba(sky.horizon, 0));
    hz.addColorStop(.5, rgba(sky.horizon, .34));
    hz.addColorStop(1, rgba(sky.horizon, 0));
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizonY - 14, this.w, 28);
  }
}