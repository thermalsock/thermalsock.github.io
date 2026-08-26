// visual/sky.js
//
// Everything above the horizon.
//
// The expensive, static parts (the Milky Way band, cloud sprites) are
// pre-rendered once to offscreen canvases and then composited each frame.
// Drawing ten thousand Milky Way dots per frame would be the single biggest
// cost in the app; drawing one bitmap is nearly free, and the band doesn't
// need to change shape — only its brightness and position do.

import { skyAt, sunAt, dayness, goldenness, rgba, mix, clamp, lerp, smoothstep } from './palette.js';

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

export class Sky {
  constructor(w, h, seed = 11) {
    this.rand = seeded(seed);
    this.seed = seed;
    this.build(w, h);
  }

  build(w, h) {
    this.w = w; this.h = h;
    this._buildStars();
    this._buildMilkyWay();
    this._buildClouds();
  }

  /* --- Stars -----------------------------------------------------------
     Real star fields are dominated by faint stars with a handful of bright
     ones. A uniform random brightness looks like static; a power
     distribution looks like a sky. */
  _buildStars() {
    const rand = seeded(this.seed * 31 + 7);
    const n = Math.round(clamp((this.w * this.h) / 1500, 300, 1600));
    this.stars = [];
    for (let i = 0; i < n; i++) {
      const mag = Math.pow(rand(), 2.6); // few bright, many faint
      // Colour temperature: most stars read white-blue, some warm.
      const warm = rand() < 0.22;
      this.stars.push({
        x: rand() * this.w,
        y: rand() * this.h * 0.92,
        r: 0.35 + mag * 1.9,
        base: 0.16 + mag * 0.84,
        colour: warm ? [255, 214, 176] : [214, 226, 255],
        twinkleSpeed: 0.4 + rand() * 2.4,
        twinklePhase: rand() * TAU,
      });
    }
  }

  /* --- Milky Way -------------------------------------------------------
     A diagonal band of dense faint stars plus dust lanes. Pre-rendered
     once; per frame it's a single drawImage with a global alpha. */
  _buildMilkyWay() {
    const rand = seeded(this.seed * 97 + 3);
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');

    const angle = -0.42;                 // band tilt
    const cx = this.w * 0.55, cy = this.h * 0.30;
    const bandHalf = this.h * 0.19;

    // Diffuse glow first.
    for (let i = 0; i < 260; i++) {
      const t = rand() * 2 - 1;
      const along = t * this.w * 1.1;
      const across = (rand() + rand() + rand() - 1.5) * bandHalf; // ~gaussian
      const x = cx + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = cy + Math.sin(angle) * along + Math.cos(angle) * across;
      const r = 40 + rand() * 130;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(190,200,240,${0.020 + rand() * 0.026})`);
      grd.addColorStop(1, 'rgba(190,200,240,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Dense faint stars concentrated in the band.
    for (let i = 0; i < 5200; i++) {
      const t = rand() * 2 - 1;
      const along = t * this.w * 1.1;
      const across = (rand() + rand() + rand() - 1.5) * bandHalf;
      const x = cx + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = cy + Math.sin(angle) * along + Math.cos(angle) * across;
      if (x < -20 || x > this.w + 20 || y < -20 || y > this.h + 20) continue;
      const falloff = 1 - Math.min(1, Math.abs(across) / bandHalf);
      const a = 0.10 + rand() * 0.5 * falloff;
      g.fillStyle = `rgba(226,232,255,${a})`;
      const s = rand() < 0.9 ? 0.7 : 1.3;
      g.fillRect(x, y, s, s);
    }

    // Dust lanes — dark rifts are what make it read as the Milky Way
    // rather than as a smear of stars.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) {
      const t = rand() * 2 - 1;
      const along = t * this.w * 1.05;
      const across = (rand() - 0.5) * bandHalf * 1.2;
      const x = cx + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = cy + Math.sin(angle) * along + Math.cos(angle) * across;
      const rx = 60 + rand() * 200, ry = 12 + rand() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      grd.addColorStop(0, `rgba(0,0,0,${0.4 + rand() * 0.5})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.translate(x, y); g.rotate(angle + (rand() - 0.5) * 0.5); g.scale(1, ry / rx);
      g.translate(-x, -y);
      g.fillStyle = grd;
      g.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';

    this.milkyWay = c;
  }

  /* --- Clouds ----------------------------------------------------------
     Each cloud is a pre-rendered sprite of overlapping blobs with a lighter
     top edge, so it has a lit side. Drawn tinted by the current light
     colour, which is what sells dawn and sunset. */
  _buildClouds() {
    const rand = seeded(this.seed * 53 + 19);
    this.cloudSprites = [];
    for (let s = 0; s < 5; s++) {
      const cw = 260 + Math.floor(rand() * 260);
      const ch = 90 + Math.floor(rand() * 70);
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const g = c.getContext('2d');
      const puffs = 9 + Math.floor(rand() * 9);
      for (let i = 0; i < puffs; i++) {
        const px = cw * (0.12 + rand() * 0.76);
        const py = ch * (0.42 + rand() * 0.42);
        const pr = ch * (0.20 + rand() * 0.36);
        const grd = g.createRadialGradient(px, py - pr * 0.35, pr * 0.1, px, py, pr);
        grd.addColorStop(0, 'rgba(255,255,255,0.55)');
        grd.addColorStop(0.55, 'rgba(255,255,255,0.26)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
      }
      this.cloudSprites.push(c);
    }

    this.clouds = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        sprite: Math.floor(rand() * this.cloudSprites.length),
        x: rand() * this.w * 1.4 - this.w * 0.2,
        y: this.h * (0.06 + rand() * 0.42),
        scale: 0.6 + rand() * 1.5,
        depth: 0.25 + rand() * 0.9,   // parallax + haze
        drift: 0.4 + rand() * 1.4,
      });
    }
  }

  update(p, dtMs, phase, wind) {
    const dt = dtMs / 1000;
    for (const c of this.clouds) {
      c.x += c.drift * (4 + wind * 26) * dt * c.depth;
      if (c.x > this.w + 400) c.x = -400;
    }
  }

  /** Paint sky, stars, celestial body, aurora and clouds. */
  draw(ctx, p, phase, time, horizonY) {
    const sky = skyAt(phase);
    const day = dayness(phase);
    const gold = goldenness(phase);
    const sun = sunAt(phase, this.w, horizonY);

    // --- Gradient. Energy lifts the whole sky slightly; that's the music
    //     "breathing" without changing the time of day.
    const lift = p.energy * 26;
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgba(mix(sky.zenith, [lift, lift, lift * 1.2], 0.22), 1));
    g.addColorStop(0.55, rgba(mix(sky.zenith, sky.horizon, 0.55), 1));
    g.addColorStop(1, rgba(sky.horizon, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, horizonY + 2);

    // --- Night sky ---
    const night = 1 - day;
    if (night > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Milky Way, brighter when the music is tonal and calm — it belongs
      // to the quiet parts of a set.
      const mwAlpha = night * (0.32 + p.coherence * 0.42) * (0.55 + p.shimmer * 0.5);
      ctx.globalAlpha = clamp(mwAlpha, 0, 0.95);
      ctx.drawImage(this.milkyWay, Math.sin(time * 0.006) * 12, 0);
      ctx.globalAlpha = 1;

      // Stars. Twinkle rate rises with the top end, so hats and shimmer
      // make the sky sparkle.
      for (const st of this.stars) {
        const tw = 0.72 + 0.28 * Math.sin(time * st.twinkleSpeed * (0.5 + p.shimmer * 2.2) + st.twinklePhase);
        const a = st.base * night * tw * (0.6 + p.shimmer * 0.6);
        if (a < 0.02) continue;
        ctx.fillStyle = rgba(st.colour, a);
        if (st.r < 0.8) {
          ctx.fillRect(st.x, st.y, 1, 1);
        } else {
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill();
          if (st.base > 0.75) {
            // Diffraction spike on the brightest stars.
            ctx.strokeStyle = rgba(st.colour, a * 0.4);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(st.x - st.r * 3, st.y); ctx.lineTo(st.x + st.r * 3, st.y);
            ctx.moveTo(st.x, st.y - st.r * 3); ctx.lineTo(st.x, st.y + st.r * 3);
            ctx.stroke();
          }
        }
      }

      // Aurora: only at night, only when the material is tonal and moving.
      // Deliberately rare — it should feel like a moment, not wallpaper.
      const auroraStrength = night * clamp(p.coherence - 0.35, 0, 1) * clamp(p.turbulence * 1.6, 0, 1);
      if (auroraStrength > 0.05) this._drawAurora(ctx, time, horizonY, auroraStrength, p);
      ctx.restore();
    }

    // --- Sun / moon ---
    this._drawCelestial(ctx, sun, sky, day, gold, p, horizonY, phase);

    // --- Clouds, tinted by the light colour of the hour ---
    // Tinting used to be a fillRect over the sprite's bounding box, which
    // drew a literal visible rectangle around every cloud. A sprite has to
    // be tinted through its own alpha, not painted over: composite the
    // colour into a scratch canvas with 'source-in' so it only lands where
    // the cloud actually is.
    for (const c of this.clouds) {
      const sprite = this.cloudSprites[c.sprite];
      const cw = sprite.width * c.scale, ch = sprite.height * c.scale;
      if (c.y > horizonY) continue;

      const tint = day > 0.15 ? sky.light : mix(sky.light, [120, 140, 200], 0.7);
      const a = (0.10 + c.depth * 0.30) * (0.35 + day * 0.75) * (0.6 + p.energy * 0.5);

      const tc = this._tintCanvas(sprite.width, sprite.height);
      const tg = tc.getContext('2d');
      tg.clearRect(0, 0, tc.width, tc.height);
      tg.drawImage(sprite, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      // Warmer and stronger at golden hour, cool and flat at midday.
      tg.fillStyle = rgba(mix(tint, [255, 255, 255], 0.35 - gold * 0.3), 1);
      tg.fillRect(0, 0, tc.width, tc.height);
      tg.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(a, 0, 0.85);
      ctx.drawImage(tc, 0, 0, sprite.width, sprite.height, c.x, c.y, cw, ch);
      ctx.restore();
    }
  }

  /** Scratch canvas for per-cloud tinting, reused rather than reallocated
   *  every frame. */
  _tintCanvas(w, h) {
    if (!this._tc || this._tc.width < w || this._tc.height < h) {
      this._tc = document.createElement('canvas');
      this._tc.width = Math.max(w, this._tc ? this._tc.width : 0);
      this._tc.height = Math.max(h, this._tc ? this._tc.height : 0);
    }
    return this._tc;
  }

  _drawCelestial(ctx, sun, sky, day, gold, p, horizonY, phase) {
    if (sun.y > horizonY + 60) return;
    const isSun = day > 0.35;
    const r = isSun ? 26 + p.energy * 10 : 20;
    const body = isSun ? mix([255, 246, 214], sky.light, 0.4) : [226, 230, 244];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Atmospheric glow, much wider at golden hour.
    const glowR = r * (isSun ? 7 + gold * 12 : 5);
    const grd = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, glowR);
    grd.addColorStop(0, rgba(body, 0.5 * (0.5 + p.energy * 0.6)));
    grd.addColorStop(0.25, rgba(mix(body, sky.horizon, 0.5), 0.16));
    grd.addColorStop(1, rgba(sky.horizon, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(sun.x - glowR, sun.y - glowR, glowR * 2, glowR * 2);

    ctx.fillStyle = rgba(body, isSun ? 0.95 : 0.9);
    ctx.beginPath(); ctx.arc(sun.x, sun.y, r, 0, TAU); ctx.fill();

    // The moon gets maria, so it isn't a featureless disc.
    if (!isSun) {
      ctx.globalCompositeOperation = 'source-over';
      const rand = seeded(99);
      ctx.fillStyle = 'rgba(178,186,206,0.55)';
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU, d = rand() * r * 0.62;
        ctx.beginPath();
        ctx.arc(sun.x + Math.cos(a) * d, sun.y + Math.sin(a) * d, r * (0.10 + rand() * 0.2), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawAurora(ctx, time, horizonY, strength, p) {
    const bands = 3;
    for (let b = 0; b < bands; b++) {
      const yBase = horizonY * (0.18 + b * 0.10);
      const hue = b % 2 === 0 ? [110, 240, 180] : [150, 190, 255];
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const x = t * this.w;
        const y = yBase
          + Math.sin(t * 5.5 + time * 0.35 + b) * horizonY * 0.06
          + Math.sin(t * 2.1 - time * 0.22 + b * 2) * horizonY * 0.05;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      // Draw as a vertical gradient curtain hanging from the ribbon.
      const grd = ctx.createLinearGradient(0, yBase - horizonY * 0.1, 0, yBase + horizonY * 0.34);
      grd.addColorStop(0, rgba(hue, 0));
      grd.addColorStop(0.35, rgba(hue, 0.16 * strength));
      grd.addColorStop(1, rgba(hue, 0));
      ctx.strokeStyle = grd;
      ctx.lineWidth = horizonY * 0.20;
      ctx.stroke();
    }
  }
}
