// visual/palette.js
//
// The day/night model.
//
// A live set is a journey, so the scene runs a slow sun. A full cycle takes
// several minutes by default: you start at dusk, the stars come out, the
// Milky Way rises, and hours later it gets light again. The music doesn't
// control the clock (that would be twitchy and unreadable) — it controls the
// weather *within* whatever hour it currently is.
//
// Keyframed rather than computed from a physical sky model: hand-picked
// colours at seven times of day, interpolated. A physically-correct
// Rayleigh-scattering sky is a lot of maths to arrive somewhere less
// evocative than a painter's palette.

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
export const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
export const rgba = (c, a) =>
  `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${clamp(a, 0, 1)})`;

/* Seven times of day. Each has a zenith colour, a horizon colour, the
   colour of the light itself (used to tint clouds, land and water), and a
   ground tone. */
const KEYS = [
  { at: 0.00, name: 'midnight', zenith: [6, 9, 22],    horizon: [16, 22, 44],   light: [70, 88, 150],   ground: [7, 9, 16] },
  { at: 0.18, name: 'late night', zenith: [9, 13, 30],  horizon: [30, 34, 60],   light: [92, 104, 165],  ground: [9, 11, 20] },
  { at: 0.27, name: 'dawn',     zenith: [40, 52, 96],   horizon: [214, 132, 104], light: [244, 168, 122], ground: [22, 22, 32] },
  { at: 0.36, name: 'morning',  zenith: [86, 132, 196], horizon: [206, 200, 186], light: [255, 232, 198], ground: [46, 52, 48] },
  { at: 0.50, name: 'noon',     zenith: [96, 152, 214], horizon: [186, 208, 224], light: [255, 250, 236], ground: [58, 66, 56] },
  { at: 0.71, name: 'sunset',   zenith: [62, 76, 132],  horizon: [236, 138, 88],  light: [252, 158, 96],  ground: [30, 28, 34] },
  { at: 0.80, name: 'dusk',     zenith: [24, 30, 66],   horizon: [116, 78, 108],  light: [150, 108, 150], ground: [14, 16, 26] },
  { at: 1.00, name: 'midnight', zenith: [6, 9, 22],     horizon: [16, 22, 44],   light: [70, 88, 150],   ground: [7, 9, 16] },
];

/** Interpolated sky colours for a phase in 0..1. */
export function skyAt(phase) {
  const p = ((phase % 1) + 1) % 1;
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (p >= KEYS[i].at && p <= KEYS[i + 1].at) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const span = Math.max(1e-6, b.at - a.at);
  const t = smoothstep((p - a.at) / span);
  return {
    zenith: mix(a.zenith, b.zenith, t),
    horizon: mix(a.horizon, b.horizon, t),
    light: mix(a.light, b.light, t),
    ground: mix(a.ground, b.ground, t),
    name: t < 0.5 ? a.name : b.name,
  };
}

/**
 * Sun elevation, -1 (below) .. 1 (overhead), and its screen position.
 * Phase 0.25 is sunrise, 0.5 noon, 0.75 sunset.
 */
export function sunAt(phase, w, horizonY) {
  const p = ((phase % 1) + 1) % 1;
  const elev = Math.sin((p - 0.25) * TAU);
  // Travels left to right across the sky over the daylight half.
  const x = w * (0.08 + ((p - 0.2 + 1) % 1) * 1.0);
  const y = horizonY - elev * horizonY * 0.92;
  return { elev, x: x % (w * 1.16) - w * 0.08, y, up: elev > -0.12 };
}

/** 0 = full night, 1 = full day. Used to cross-fade stars against birds. */
export function dayness(phase) {
  const { elev } = sunAt(phase, 1, 1);
  return smoothstep(elev * 1.7 + 0.42);
}

/** 0 away from the horizon, 1 at sunrise/sunset — drives warm rim light. */
export function goldenness(phase) {
  const { elev } = sunAt(phase, 1, 1);
  return clamp(1 - Math.abs(elev) * 4.2, 0, 1);
}
