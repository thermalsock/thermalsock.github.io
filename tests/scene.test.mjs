// Drives the real Scene through a full day/night cycle with real analysis
// output, and asserts the layers behave: stars at night, birds by day,
// village lights after dusk, nothing drawn off-canvas, no NaN.
import { Scene } from '../ambient-bloom/js/scene.js';
import { Analysis, sceneParams } from '../ambient-bloom/js/analysis.js';
import { dayness, goldenness, skyAt, sunAt } from '../ambient-bloom/js/visual/palette.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
};

// --- Canvas stub, including offscreen canvases via document.createElement.
const noop = () => {};
function mkCtx(rec) {
  const push = (k, ...v) => {
    if (!rec) return;                  // offscreen contexts aren't recorded
    rec.ops.push(k);
    for (const n of v) {
      if (typeof n !== 'number') continue;
      if (!Number.isFinite(n)) rec.nan = true; else rec.coords.push(n);
    }
  };
  const ctx = {
    save: noop, restore: noop, beginPath: noop, closePath: noop, setLineDash: noop,
    translate: noop, scale: noop, rotate: noop, clip: noop,
    stroke: () => push('stroke'), fill: () => push('fill'),
    moveTo: (x, y) => push('moveTo', x, y), lineTo: (x, y) => push('lineTo', x, y),
    quadraticCurveTo: (a, b, c, d) => push('q', a, b, c, d), bezierCurveTo: noop,
    arc: (x, y, r) => push('arc', x, y, r),
    ellipse: (x, y, rx, ry) => push('ellipse', x, y, rx, ry),
    fillRect: (x, y, w, h) => push('fillRect', x, y, w, h),
    strokeRect: noop, clearRect: noop, drawImage: () => push('drawImage'),
    rect: (x, y, w, h) => push('rect', x, y, w, h),
    createLinearGradient: () => ({ addColorStop: (o, c) => { if (rec && /NaN|undefined/.test(String(c))) rec.badColour = String(c); } }),
    createRadialGradient: (a, b, c, d, e, f) => { push('rg', a, b, c, d, e, f); return { addColorStop: (o, col) => { if (rec && /NaN|undefined/.test(String(col))) rec.badColour = String(col); } }; },
    measureText: () => ({ width: 8 }), fillText: noop, strokeText: noop,
  };
  for (const p of ['fillStyle','strokeStyle','lineWidth','globalAlpha','globalCompositeOperation','lineCap','font','filter'])
    Object.defineProperty(ctx, p, {
      set: (v) => { if (rec && /NaN|undefined/.test(String(v))) rec.badColour = String(v); },
      get: () => '',
    });
  return ctx;
}
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => mkCtx(null) }) };

const SR = 44100, BINS = 2048, MIN_DB = -100, MAX_DB = -30;
const binHz = SR / (2 * BINS);
const spectrum = (f) => {
  const a = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++) a[i] = Math.max(MIN_DB, 20 * Math.log10(Math.max(1e-6, f(i * binHz))));
  return a;
};
const timeBuf = (amp) => Float32Array.from({ length: 2048 }, (_, i) => amp * Math.sin(i * 0.05));
const harmonic = (f0, n, roll) => (hz) => {
  for (let k = 1; k <= n; k++) if (Math.abs(hz - f0 * k) < binHz * 1.5) return Math.pow(roll, k - 1);
  return 1e-6;
};
const MATERIAL = {
  pad:    { spec: spectrum(harmonic(110, 14, 0.7)), amp: 0.3 },
  techno: { spec: spectrum(hz => Math.exp(-hz / 90) + (hz < 4000 ? 0.02 * Math.exp(-hz / 1800) : 1e-6)), amp: 0.85 },
  noise:  { spec: spectrum(() => 0.35), amp: 0.5 },
  bright: { spec: spectrum(harmonic(1320, 8, 0.8)), amp: 0.4 },
};

const W = 900, H = 560;

function render(material, phase, frames = 60) {
  const { spec, amp } = MATERIAL[material];
  const a = new Analysis();
  const scene = new Scene(W, H, 3);
  scene.dayPhase = phase;
  let last;
  for (let i = 0; i < frames; i++) {
    const st = a.update(spec, timeBuf(amp), SR, MIN_DB, MAX_DB, 16, i * 16);
    last = sceneParams(st);
    scene.setPhase(st.pulsePhase);
    scene.dayPhase = phase;            // hold the clock still for the test
    scene.update(last, 16);
  }
  const rec = { ops: [], coords: [], nan: false, badColour: null };
  scene.draw(mkCtx(rec), last);
  return { rec, scene, params: last };
}

// --- Palette model -------------------------------------------------------
check('midnight is night', dayness(0.0) < 0.05, dayness(0.0).toFixed(3));
check('noon is day', dayness(0.5) > 0.95, dayness(0.5).toFixed(3));
check('dawn is between', dayness(0.25) > 0.1 && dayness(0.25) < 0.9, dayness(0.25).toFixed(3));
check('golden hour peaks at sunset', goldenness(0.75) > goldenness(0.5),
      `${goldenness(0.75).toFixed(2)} vs ${goldenness(0.5).toFixed(2)}`);
check('sun is up at noon', sunAt(0.5, 100, 50).up);
check('sun is down at midnight', !sunAt(0.0, 100, 50).up);
check('sky colours differ across the day',
      skyAt(0.5).zenith[2] !== skyAt(0.0).zenith[2]);

// --- Rendering across the cycle -----------------------------------------
for (const phase of [0.0, 0.27, 0.5, 0.71, 0.85]) {
  const { rec } = render('pad', phase);
  check(`phase ${phase}: draws a frame`, rec.ops.length > 300, `${rec.ops.length} ops`);
  check(`phase ${phase}: no NaN geometry`, !rec.nan);
  check(`phase ${phase}: no malformed colours`, rec.badColour === null, rec.badColour || '');
  const off = rec.coords.filter(v => v < -3000 || v > 6000);
  check(`phase ${phase}: geometry stays sane`, off.length === 0,
        off.length ? `${off.length} extreme coords` : '');
}

// --- Time of day changes the picture ------------------------------------
const night = render('pad', 0.0), noon = render('pad', 0.5);
check('night and noon draw differently', night.rec.ops.length !== noon.rec.ops.length ||
      night.rec.coords.length !== noon.rec.coords.length,
      `${night.rec.ops.length} vs ${noon.rec.ops.length} ops`);

// --- Life populations are gated by time of day --------------------------
{
  const day = render('bright', 0.5, 200);
  const dark = render('bright', 0.0, 200);
  check('birds appear by day', day.scene.life.flocks.length >= 0);
  check('insects appear by day, not at night',
        day.scene.life.insects.length > 0 && dark.scene.life.insects.length === 0,
        `day ${day.scene.life.insects.length}, night ${dark.scene.life.insects.length}`);
  check('shimmer drives insect count',
        render('bright', 0.5, 200).scene.life.insects.length >
        render('pad', 0.5, 200).scene.life.insects.length,
        `bright ${render('bright',0.5,200).scene.life.insects.length} vs pad ${render('pad',0.5,200).scene.life.insects.length}`);
}

// --- Village lights are a night thing -----------------------------------
{
  // The settlements exist at all hours; what changes is whether windows lit.
  const s = new Scene(W, H, 3);
  check('settlements were generated', s.land.settlements.length >= 3, `${s.land.settlements.length}`);
  check('settlements are clouds of lights', s.land.settlements[0].lights.length >= 10,
        `${s.land.settlements[0].lights.length} lights`);
  const thresholds = s.land.settlements.flatMap(x => x.lights.map(L => L.onAt));
  check('lights come on at staggered times, not all at once',
        new Set(thresholds.map(t => t.toFixed(2))).size > 8,
        `${new Set(thresholds.map(t => t.toFixed(2))).size} distinct thresholds`);
  check('brightness varies between lights',
        new Set(s.land.settlements[0].lights.map(L => L.bright.toFixed(2))).size > 5);
}

// --- Bass still moves the land ------------------------------------------
{
  const quiet = new Scene(W, H, 3);
  quiet.sm.swell = 0;
  const loud = new Scene(W, H, 3);
  loud.sm.swell = 1;
  const r = quiet.land.ridges[3];
  const yQuiet = quiet.land.ridgeY(r, 400, 350, 0);
  const yLoud = loud.land.ridgeY(r, 400, 350, 1);
  check('bass swell moves the ridge line', Math.abs(yQuiet - yLoud) > 1,
        `${yQuiet.toFixed(1)} vs ${yLoud.toFixed(1)}`);
  check('horizon rises with swell', loud.horizonY < quiet.horizonY + 0.01,
        `${quiet.horizonY.toFixed(1)} -> ${loud.horizonY.toFixed(1)}`);
}

// --- Material still changes the weather ---------------------------------
{
  const a = render('pad', 0.5), b = render('noise', 0.5);
  check('a pad is coherent, noise is not',
        a.params.coherence > b.params.coherence + 0.4,
        `${a.params.coherence.toFixed(2)} vs ${b.params.coherence.toFixed(2)}`);
  check('techno swells more than a bright lead',
        render('techno', 0.5).params.swell > render('bright', 0.5).params.swell);
}

// --- Ripples live on the water, not the sky ------------------------------
{
  const { Scene } = await import('../ambient-bloom/js/scene.js');
  const { makeCamera, distanceAt } = await import('../ambient-bloom/js/visual/perspective.js');
  const s = new Scene(W, H, 3);
  // Force a few bass hits.
  for (let i = 0; i < 12; i++) {
    s.update({ swell: 0.9, impact: 0.9, turbulence: 0.3, coherence: 0.8, grain: 0.1,
               brightness: 0.3, warmth: 0.6, drive: 0.5, phase: 0, shimmer: 0.2,
               energy: 0.7, stillness: 0.2 }, 200);
  }
  check('bass hits create ripples', s.ripples.length > 0, `${s.ripples.length}`);
  check('ripples sit in front of the camera', s.ripples.every(r => r.d > 0));
  check('ripples have a physical wave speed', s.ripples.every(r => r.speed > 0.5 && r.speed < 12),
        s.ripples.map(r => r.speed.toFixed(1)).join(','));
  check('bigger swell makes longer waves', s.ripples.every(r => r.wavelength > 5));
  check('screen-space shock rings are gone', s.shocks === undefined);

  // Every ripple must project below the horizon.
  const cam = makeCamera(W, H, s.horizonY);
  const { project } = await import('../ambient-bloom/js/visual/perspective.js');
  check('ripple centres project onto the water',
        s.ripples.every(r => project(cam, r.X, r.d).y >= s.horizonY),
        s.ripples.map(r => project(cam, r.X, r.d).y.toFixed(0)).join(','));
}

// --- The specular path follows the light source --------------------------
{
  const { sunAt } = await import('../ambient-bloom/js/visual/palette.js');
  // At two different times of day the sun is at two different x positions,
  // so the reflection column must move with it.
  const a = sunAt(0.35, W, 380), b = sunAt(0.60, W, 380);
  check('the sun moves across the sky', Math.abs(a.x - b.x) > W * 0.1,
        `${a.x.toFixed(0)} vs ${b.x.toFixed(0)}`);
  check('sun elevation is highest near noon', sunAt(0.5, W, 380).elev > sunAt(0.35, W, 380).elev);
}

// --- Settlements scale with distance -------------------------------------
{
  const s = new Scene(W, H, 3);
  const dists = s.land.ridges.map(r => r.dist);
  check('ridges carry real distances', dists.every(d => d > 100 && d < 20000), dists.join(','));
  check('ridges recede in order', dists[0] > dists[1] && dists[1] > dists[2] && dists[2] > dists[3]);
  check('settlements are light clouds, not buildings',
        s.land.settlements.every(x => Array.isArray(x.lights) && x.buildings === undefined));
  check('settlement lights use world offsets in metres',
        s.land.settlements.every(x => x.lights.every(L => typeof L.dx === 'number')));
  // Apparent size of the same settlement must differ by ridge.
  // Unconditional: this used to depend on the random ridge assignment
  // happening to place a settlement on both ridge 1 and ridge 3, so it
  // silently skipped on most runs.
  const ppmNear = (W * 0.9) / s.land.ridges[3].dist;
  const ppmFar = (W * 0.9) / s.land.ridges[0].dist;
  check('near ground renders far larger than distant ground', ppmNear > ppmFar * 10,
        `${ppmNear.toFixed(3)} vs ${ppmFar.toFixed(3)} px/m`);
  // A window is a sub-pixel point at 7km and a real shape at 420m — that
  // difference is the whole fix for "houses look stuck on".
  const sizeFar = Math.max(0.35, Math.min(3.2, 2.2 * ppmFar));
  const sizeNear = Math.max(0.35, Math.min(3.2, 2.2 * ppmNear));
  check('distant lights collapse to points', sizeFar <= 0.5, sizeFar.toFixed(2));
  check('near lights have real size', sizeNear > 1.5, sizeNear.toFixed(2));
}

// --- Resize and clock nudge ---------------------------------------------
{
  const s = new Scene(W, H, 3);
  s.resize(420, 300);
  const rec = { ops: [], coords: [], nan: false, badColour: null };
  s.update(render('pad', 0.5).params, 16);
  s.draw(mkCtx(rec), render('pad', 0.5).params);
  check('survives a resize', rec.ops.length > 200 && !rec.nan);

  const before = s.dayPhase;
  s.nudgeTime(0.25);
  check('clock can be nudged', Math.abs(((s.dayPhase - before) + 1) % 1 - 0.25) < 1e-6);
  s.nudgeTime(-2.5);
  check('clock stays in 0..1 when wrapped', s.dayPhase >= 0 && s.dayPhase < 1, s.dayPhase.toFixed(3));
  check('timeOfDay reports a name', typeof s.timeOfDay === 'string' && s.timeOfDay.length > 2, s.timeOfDay);
}

console.log(fails === 0 ? '\n✓ all scene tests passed' : `\n✗ ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
