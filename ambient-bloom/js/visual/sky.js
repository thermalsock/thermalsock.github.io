import { skyAt, sunAt, dayness, goldenness, rgba, mix, clamp, lerp, smoothstep } from "./palette.js";

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

export class Sky {
  constructor(w, h, seed = 11) {
    this.rand = seeded(seed);
    this.seed = seed;
    this.build(w, h);
  }
  build(w, h) {
    this.w = w;
    this.h = h;
    this._buildStars();
    this._buildMilkyWay();
    this._buildClouds();
  }
  _buildStars() {
    const rand = seeded(this.seed * 31 + 7);
    const n = Math.round(clamp(this.w * this.h / 1500, 300, 1600));
    this.stars = [];
    for (let i = 0; i < n; i++) {
      const mag = Math.pow(rand(), 2.6);
      const warm = rand() < .22;
      this.stars.push({
        x: rand() * this.w,
        y: rand() * this.h * .92,
        r: .35 + mag * 1.9,
        base: .16 + mag * .84,
        colour: warm ? [ 255, 214, 176 ] : [ 214, 226, 255 ],
        twinkleSpeed: .4 + rand() * 2.4,
        twinklePhase: rand() * TAU
      });
    }
  }
  _buildMilkyWay() {
    const rand = seeded(this.seed * 97 + 3);
    const c = document.createElement("canvas");
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext("2d");
    const angle = -.42;
    const cx = this.w * .55, cy = this.h * .3;
    const bandHalf = this.h * .19;
    for (let i = 0; i < 260; i++) {
      const t = rand() * 2 - 1;
      const along = t * this.w * 1.1;
      const across = (rand() + rand() + rand() - 1.5) * bandHalf;
      const x = cx + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = cy + Math.sin(angle) * along + Math.cos(angle) * across;
      const r = 40 + rand() * 130;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(190,200,240,${.02 + rand() * .026})`);
      grd.addColorStop(1, "rgba(190,200,240,0)");
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 5200; i++) {
      const t = rand() * 2 - 1;
      const along = t * this.w * 1.1;
      const across = (rand() + rand() + rand() - 1.5) * bandHalf;
      const x = cx + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = cy + Math.sin(angle) * along + Math.cos(angle) * across;
      if (x < -20 || x > this.w + 20 || y < -20 || y > this.h + 20) continue;
      const falloff = 1 - Math.min(1, Math.abs(across) / bandHalf);
      const a = .1 + rand() * .5 * falloff;
      g.fillStyle = `rgba(226,232,255,${a})`;
      const s = rand() < .9 ? .7 : 1.3;
      g.fillRect(x, y, s, s);
    }
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 26; i++) {
      const t = rand() * 2 - 1;
      const along = t * this.w * 1.05;
      const across = (rand() - .5) * bandHalf * 1.2;
      const x = cx + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = cy + Math.sin(angle) * along + Math.cos(angle) * across;
      const rx = 60 + rand() * 200, ry = 12 + rand() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      grd.addColorStop(0, `rgba(0,0,0,${.4 + rand() * .5})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.save();
      g.translate(x, y);
      g.rotate(angle + (rand() - .5) * .5);
      g.scale(1, ry / rx);
      g.translate(-x, -y);
      g.fillStyle = grd;
      g.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      g.restore();
    }
    g.globalCompositeOperation = "source-over";
    this.milkyWay = c;
  }
  _buildClouds() {
    const rand = seeded(this.seed * 53 + 19);
    this.cloudSprites = [];
    for (let s = 0; s < 5; s++) {
      const cw = 260 + Math.floor(rand() * 260);
      const ch = 90 + Math.floor(rand() * 70);
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const g = c.getContext("2d");
      const puffs = 9 + Math.floor(rand() * 9);
      for (let i = 0; i < puffs; i++) {
        const px = cw * (.12 + rand() * .76);
        const py = ch * (.42 + rand() * .42);
        const pr = ch * (.2 + rand() * .36);
        const grd = g.createRadialGradient(px, py - pr * .35, pr * .1, px, py, pr);
        grd.addColorStop(0, "rgba(255,255,255,0.55)");
        grd.addColorStop(.55, "rgba(255,255,255,0.26)");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(px, py, pr, 0, TAU);
        g.fill();
      }
      this.cloudSprites.push(c);
    }
    this.clouds = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        sprite: Math.floor(rand() * this.cloudSprites.length),
        x: rand() * this.w * 1.4 - this.w * .2,
        y: this.h * (.06 + rand() * .42),
        scale: .6 + rand() * 1.5,
        depth: .25 + rand() * .9,
        drift: .4 + rand() * 1.4
      });
    }
  }
  update(p, dtMs, phase, wind) {
    const dt = dtMs / 1e3;
    for (const c of this.clouds) {
      c.x += c.drift * (4 + wind * 26) * dt * c.depth;
      if (c.x > this.w + 400) c.x = -400;
    }
  }
  draw(ctx, p, phase, time, horizonY) {
    const sky = skyAt(phase);
    const day = dayness(phase);
    const gold = goldenness(phase);
    const sun = sunAt(phase, this.w, horizonY);
    const lift = p.energy * 26;
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgba(mix(sky.zenith, [ lift, lift, lift * 1.2 ], .22), 1));
    g.addColorStop(.55, rgba(mix(sky.zenith, sky.horizon, .55), 1));
    g.addColorStop(1, rgba(sky.horizon, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, horizonY + 2);
    const night = 1 - day;
    if (night > .02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const mwAlpha = night * (.32 + p.coherence * .42) * (.55 + p.shimmer * .5);
      ctx.globalAlpha = clamp(mwAlpha, 0, .95);
      ctx.drawImage(this.milkyWay, Math.sin(time * .006) * 12, 0);
      ctx.globalAlpha = 1;
      for (const st of this.stars) {
        const tw = .72 + .28 * Math.sin(time * st.twinkleSpeed * (.5 + p.shimmer * 2.2) + st.twinklePhase);
        const a = st.base * night * tw * (.6 + p.shimmer * .6);
        if (a < .02) continue;
        ctx.fillStyle = rgba(st.colour, a);
        if (st.r < .8) {
          ctx.fillRect(st.x, st.y, 1, 1);
        } else {
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, TAU);
          ctx.fill();
          if (st.base > .75) {
            ctx.strokeStyle = rgba(st.colour, a * .4);
            ctx.lineWidth = .6;
            ctx.beginPath();
            ctx.moveTo(st.x - st.r * 3, st.y);
            ctx.lineTo(st.x + st.r * 3, st.y);
            ctx.moveTo(st.x, st.y - st.r * 3);
            ctx.lineTo(st.x, st.y + st.r * 3);
            ctx.stroke();
          }
        }
      }
      const auroraStrength = night * clamp(p.coherence - .35, 0, 1) * clamp(p.turbulence * 1.6, 0, 1);
      if (auroraStrength > .05) this._drawAurora(ctx, time, horizonY, auroraStrength, p);
      ctx.restore();
    }
    this._drawCelestial(ctx, sun, sky, day, gold, p, horizonY, phase);
    for (const c of this.clouds) {
      const sprite = this.cloudSprites[c.sprite];
      const cw = sprite.width * c.scale, ch = sprite.height * c.scale;
      if (c.y > horizonY) continue;
      const tint = day > .15 ? sky.light : mix(sky.light, [ 120, 140, 200 ], .7);
      const a = (.1 + c.depth * .3) * (.35 + day * .75) * (.6 + p.energy * .5);
      const tc = this._tintCanvas(sprite.width, sprite.height);
      const tg = tc.getContext("2d");
      tg.clearRect(0, 0, tc.width, tc.height);
      tg.drawImage(sprite, 0, 0);
      tg.globalCompositeOperation = "source-in";
      tg.fillStyle = rgba(mix(tint, [ 255, 255, 255 ], .35 - gold * .3), 1);
      tg.fillRect(0, 0, tc.width, tc.height);
      tg.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(a, 0, .85);
      ctx.drawImage(tc, 0, 0, sprite.width, sprite.height, c.x, c.y, cw, ch);
      ctx.restore();
    }
  }
  _tintCanvas(w, h) {
    if (!this._tc || this._tc.width < w || this._tc.height < h) {
      this._tc = document.createElement("canvas");
      this._tc.width = Math.max(w, this._tc ? this._tc.width : 0);
      this._tc.height = Math.max(h, this._tc ? this._tc.height : 0);
    }
    return this._tc;
  }
  _drawCelestial(ctx, sun, sky, day, gold, p, horizonY, phase) {
    if (sun.y > horizonY + 60) return;
    const isSun = day > .35;
    const r = isSun ? 26 + p.energy * 10 : 20;
    const body = isSun ? mix([ 255, 246, 214 ], sky.light, .4) : [ 226, 230, 244 ];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glowR = r * (isSun ? 7 + gold * 12 : 5);
    const grd = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, glowR);
    grd.addColorStop(0, rgba(body, .5 * (.5 + p.energy * .6)));
    grd.addColorStop(.25, rgba(mix(body, sky.horizon, .5), .16));
    grd.addColorStop(1, rgba(sky.horizon, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(sun.x - glowR, sun.y - glowR, glowR * 2, glowR * 2);
    ctx.fillStyle = rgba(body, isSun ? .95 : .9);
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r, 0, TAU);
    ctx.fill();
    if (!isSun) {
      ctx.globalCompositeOperation = "source-over";
      const rand = seeded(99);
      ctx.fillStyle = "rgba(178,186,206,0.55)";
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU, d = rand() * r * .62;
        ctx.beginPath();
        ctx.arc(sun.x + Math.cos(a) * d, sun.y + Math.sin(a) * d, r * (.1 + rand() * .2), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  _drawAurora(ctx, time, horizonY, strength, p) {
    const bands = 3;
    for (let b = 0; b < bands; b++) {
      const yBase = horizonY * (.18 + b * .1);
      const hue = b % 2 === 0 ? [ 110, 240, 180 ] : [ 150, 190, 255 ];
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const x = t * this.w;
        const y = yBase + Math.sin(t * 5.5 + time * .35 + b) * horizonY * .06 + Math.sin(t * 2.1 - time * .22 + b * 2) * horizonY * .05;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const grd = ctx.createLinearGradient(0, yBase - horizonY * .1, 0, yBase + horizonY * .34);
      grd.addColorStop(0, rgba(hue, 0));
      grd.addColorStop(.35, rgba(hue, .16 * strength));
      grd.addColorStop(1, rgba(hue, 0));
      ctx.strokeStyle = grd;
      ctx.lineWidth = horizonY * .2;
      ctx.stroke();
    }
  }
}