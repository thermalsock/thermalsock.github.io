// The camera model. These are the properties the visual depends on being
// true — if any of them break, things sit in the wrong place on screen.
import { makeCamera, project, distanceAt, projectRing, rippleAmplitude, waveSpeed } from '../ambient-bloom/js/visual/perspective.js';

let fails = 0;
const check = (l, c, e = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`); };
const near = (l, got, want, tol) => check(l, Math.abs(got - want) <= tol, `${got.toFixed(2)} vs ${want}`);

const W = 1000, H = 600, HY = 380;
const cam = makeCamera(W, H, HY);

// --- Projection basics ---
check('far distance lands on the horizon', project(cam, 0, 1e7).y - HY < 0.5,
      (project(cam, 0, 1e7).y - HY).toFixed(4));
check('nearer is lower on screen', project(cam, 0, 50).y > project(cam, 0, 500).y);
check('centre stays centred', Math.abs(project(cam, 0, 100).x - W / 2) < 1e-9);
check('lateral offset moves right', project(cam, 30, 100).x > W / 2);
check('same offset shifts less when further away',
      project(cam, 30, 400).x - W / 2 < project(cam, 30, 100).x - W / 2);

// --- Apparent size falls off as 1/d: this is what fixes distant villages ---
const s100 = project(cam, 0, 100).scale, s400 = project(cam, 0, 400).scale;
near('apparent size quarters at 4x distance', s100 / s400, 4, 0.001);
check('scale is always positive', project(cam, 0, 1e6).scale > 0);

// --- Round trip ---
for (const d of [20, 60, 250, 900]) {
  const y = project(cam, 0, d).y;
  near(`distance round-trips at d=${d}`, distanceAt(cam, y), d, d * 0.001);
}
check('above the horizon is infinitely far', distanceAt(cam, HY - 10) === Infinity);
check('the horizon itself is infinitely far', distanceAt(cam, HY) === Infinity);

// --- Ripple projection ---
{
  const pts = projectRing(cam, 0, 120, 40).filter(Boolean);
  check('ring projects to points', pts.length > 40, `${pts.length}`);
  check('every ring point is below the horizon', pts.every(p => p.y >= HY),
        `min y ${Math.min(...pts.map(p => p.y)).toFixed(1)} vs horizon ${HY}`);

  // The near side of a ring must be more spread out than the far side —
  // this is the thing a plain ellipse gets wrong.
  const ys = pts.map(p => p.y);
  const centreY = project(cam, 0, 120).y;
  const nearExtent = Math.max(...ys) - centreY;
  const farExtent = centreY - Math.min(...ys);
  check('near side of the ring is more extended than the far side',
        nearExtent > farExtent * 1.15, `near ${nearExtent.toFixed(1)} far ${farExtent.toFixed(1)}`);

  // A ring that would wrap behind the camera drops those points instead of
  // projecting them to nonsense.
  const behind = projectRing(cam, 0, 5, 200);
  check('points behind the camera are dropped', behind.some(p => p === null));
  check('surviving points are all finite',
        behind.filter(Boolean).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
}

// --- Wave physics ---
check('amplitude decays with radius', rippleAmplitude(40, 0) < rippleAmplitude(4, 0));
near('amplitude follows 1/sqrt(r)', rippleAmplitude(16, 0) / rippleAmplitude(64, 0), 2, 0.01);
check('amplitude decays with age', rippleAmplitude(10, 3) < rippleAmplitude(10, 0));
check('amplitude never negative', rippleAmplitude(1000, 100) >= 0);
check('longer waves travel faster', waveSpeed(40) > waveSpeed(4));
near('deep-water speed for a 40m wave', waveSpeed(40), Math.sqrt(9.81 * 40 / (2 * Math.PI)), 0.01);

console.log(fails === 0 ? '\n✓ all perspective tests passed' : `\n✗ ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
