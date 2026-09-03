import { skyAt, dayness, goldenness, rgba, mix, clamp, lerp } from "./palette.js";

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

export class Life {
  constructor(w, h, seed = 41) {
    this.rand = seeded(seed);
    this.w = w;
    this.h = h;
    this.flocks = [];
    this.insects = [];
    this.planes = [];
    this.bats = [];
    this.meteors = [];
    this.satellites = [];
    this._sinceSat = 0;
  }
  resize(w, h) {
    this.w = w;
    this.h = h;
  }
  update(p, dtMs, phase, time, horizonY) {
    const dt = Math.min(.05, dtMs / 1e3);
    const rand = this.rand;
    const day = dayness(phase);
    const night = 1 - day;
    const gold = goldenness(phase);
    if (day > .35 && this.flocks.length < 3 && rand() < (.06 + p.turbulence * .5) * dt * 4) {
      const n = 5 + Math.floor(rand() * 14);
      const dir = rand() < .5 ? 1 : -1;
      const y = horizonY * (.18 + rand() * .52);
      const birds = [];
      for (let i = 0; i < n; i++) {
        birds.push({
          lag: i * (.06 + rand() * .05),
          off: (rand() - .5) * 40,
          flap: rand() * TAU,
          size: 3 + rand() * 3.5
        });
      }
      this.flocks.push({
        x: dir > 0 ? -80 : this.w + 80,
        y: y,
        dir: dir,
        birds: birds,
        speed: 26 + rand() * 40,
        wobble: rand() * TAU,
        born: time
      });
    }
    for (const f of this.flocks) {
      f.x += f.dir * f.speed * (.6 + p.energy * 1.1) * dt;
      f.y += Math.sin(time * .7 + f.wobble) * 9 * dt * (1 + p.turbulence * 3);
      if (p.impact > .5) f.y -= p.impact * 26 * dt;
    }
    this.flocks = this.flocks.filter(f => f.x > -220 && f.x < this.w + 220);
    const wantInsects = day > .3 ? Math.round(p.shimmer * 40 + 8) : 0;
    while (this.insects.length < wantInsects) {
      this.insects.push({
        x: rand() * this.w,
        y: horizonY + rand() * (this.h - horizonY) * .5 - rand() * 60,
        vx: (rand() - .5) * 30,
        vy: (rand() - .5) * 20,
        phase: rand() * TAU,
        size: .8 + rand() * 1.4
      });
    }
    while (this.insects.length > wantInsects) this.insects.pop();
    for (const b of this.insects) {
      b.vx += (rand() - .5) * 220 * dt;
      b.vy += (rand() - .5) * 180 * dt;
      b.vx *= .92;
      b.vy *= .92;
      b.x += b.vx * dt * (1 + p.shimmer * 2);
      b.y += b.vy * dt * (1 + p.shimmer * 2);
      if (b.x < 0) b.x += this.w;
      if (b.x > this.w) b.x -= this.w;
    }
    if (day > .45 && this.planes.length < 2 && rand() < .02 * dt * 4) {
      const dir = rand() < .5 ? 1 : -1;
      this.planes.push({
        x: dir > 0 ? -60 : this.w + 60,
        y: horizonY * (.1 + rand() * .28),
        dir: dir,
        speed: 34 + rand() * 26,
        trail: []
      });
    }
    for (const pl of this.planes) {
      pl.x += pl.dir * pl.speed * dt;
      pl.trail.push({
        x: pl.x,
        y: pl.y,
        born: time
      });
      if (pl.trail.length > 190) pl.trail.shift();
    }
    this.planes = this.planes.filter(pl => pl.x > -400 && pl.x < this.w + 400);
    const duskness = clamp(1 - Math.abs(day - .35) * 5, 0, 1);
    const wantBats = duskness > .2 ? Math.round(duskness * 7) : 0;
    while (this.bats.length < wantBats) {
      this.bats.push({
        x: rand() * this.w,
        y: horizonY * (.35 + rand() * .4),
        vx: (rand() - .5) * 90,
        vy: (rand() - .5) * 60,
        flap: rand() * TAU,
        size: 3 + rand() * 3
      });
    }
    while (this.bats.length > wantBats) this.bats.pop();
    for (const b of this.bats) {
      if (rand() < 2.2 * dt) {
        b.vx = (rand() - .5) * 170;
        b.vy = (rand() - .5) * 120;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20) b.x = this.w + 20;
      if (b.x > this.w + 20) b.x = -20;
      b.y = clamp(b.y, horizonY * .2, horizonY * .95);
    }
    if (night > .5 && p.impact > .55 && rand() < .35) {
      const x = rand() * this.w, y = rand() * horizonY * .5;
      const a = .5 + rand() * .8;
      this.meteors.push({
        x: x,
        y: y,
        vx: Math.cos(a) * (420 + rand() * 380),
        vy: Math.sin(a) * (300 + rand() * 260),
        born: time,
        life: .55 + rand() * .6
      });
      if (this.meteors.length > 8) this.meteors.shift();
    }
    for (const m of this.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    this.meteors = this.meteors.filter(m => time - m.born < m.life);
    this._sinceSat += dt;
    if (night > .6 && this.satellites.length === 0 && this._sinceSat > 40 && rand() < .02) {
      this._sinceSat = 0;
      this.satellites.push({
        x: -20,
        y: horizonY * (.1 + rand() * .4),
        vx: 26 + rand() * 14,
        vy: (rand() - .5) * 8,
        blink: rand() * TAU
      });
    }
    for (const s of this.satellites) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.satellites = this.satellites.filter(s => s.x < this.w + 40);
  }
  draw(ctx, p, phase, time, horizonY) {
    const sky = skyAt(phase);
    const day = dayness(phase);
    const night = 1 - day;
    const gold = goldenness(phase);
    for (const pl of this.planes) {
      ctx.save();
      ctx.strokeStyle = rgba(mix([ 255, 255, 255 ], sky.light, .4), .13 * day);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < pl.trail.length; i++) {
        const t = pl.trail[i];
        const age = time - t.born;
        const spread = Math.min(3, age * .5);
        i === 0 ? ctx.moveTo(t.x, t.y + spread) : ctx.lineTo(t.x, t.y + spread);
      }
      ctx.stroke();
      ctx.fillStyle = rgba([ 255, 255, 255 ], .55 * day);
      ctx.fillRect(pl.x - 2, pl.y - 1, 4, 2);
      ctx.restore();
    }
    for (const f of this.flocks) {
      const col = mix(sky.ground, [ 0, 0, 0 ], .35);
      for (const b of f.birds) {
        const bx = f.x - f.dir * b.lag * 90;
        const by = f.y + b.off + Math.sin(time * 1.4 + b.flap) * 5;
        if (bx < -30 || bx > this.w + 30) continue;
        const beat = Math.sin(time * 9 + b.flap) * .5 + .5;
        const spread = b.size * (.55 + beat * .75);
        ctx.strokeStyle = rgba(col, .55 * day);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(bx - spread, by - spread * .45);
        ctx.quadraticCurveTo(bx, by + 1.2, bx + spread, by - spread * .45);
        ctx.stroke();
      }
    }
    for (const b of this.bats) {
      const beat = Math.sin(time * 15 + b.flap) * .5 + .5;
      const s = b.size * (.5 + beat * .9);
      ctx.strokeStyle = rgba([ 12, 10, 18 ], .6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(b.x - s, b.y - s * .2);
      ctx.lineTo(b.x - s * .35, b.y + s * .35);
      ctx.lineTo(b.x, b.y - s * .15);
      ctx.lineTo(b.x + s * .35, b.y + s * .35);
      ctx.lineTo(b.x + s, b.y - s * .2);
      ctx.stroke();
    }
    if (this.insects.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const col = mix([ 255, 236, 190 ], sky.light, .4);
      for (const b of this.insects) {
        const a = (.18 + gold * .5) * day;
        ctx.fillStyle = rgba(col, a);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of this.meteors) {
      const t = (time - m.born) / m.life;
      const a = Math.sin((1 - t) * Math.PI * .85) * night;
      const tailX = m.x - m.vx * .09, tailY = m.y - m.vy * .09;
      const grd = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      grd.addColorStop(0, rgba([ 200, 214, 255 ], 0));
      grd.addColorStop(1, rgba([ 255, 250, 230 ], a));
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }
    for (const s of this.satellites) {
      const a = night * (.5 + .5 * Math.sin(time * 2.4 + s.blink)) * .7;
      ctx.fillStyle = rgba([ 230, 236, 255 ], a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}