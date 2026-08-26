// visual/perspective.js
//
// A real (if simple) pinhole camera looking out over a flat water plane,
// plus the wave physics for ripples on it.
//
// Three of the visual's problems were the same problem: things were being
// positioned in screen space with hand-picked constants instead of being
// projected from a world. The specular reflection sat at the middle of the
// frame regardless of where the sun actually was, ripples expanded as
// screen-space circles across the sky, and distant villages were drawn the
// same size as near ones. All of that goes away once there's a camera.
//
// Model: the camera sits at height `eye` above a flat plane, looking at the
// horizon. A point on the plane at ground distance d and lateral offset X
// projects to:
//
//     yScreen = horizonY + (f * eye) / d
//     xScreen = cx + (f * X) / d
//
// so d -> infinity puts the point on the horizon line, and things get
// larger and further apart as they approach the camera. That's all the
// perspective this scene needs, and it's correct rather than approximated.

export function makeCamera(w, h, horizonY) {
  // Focal length in pixels. Chosen so the near edge of the frame lands at a
  // sensible ground distance rather than being an arbitrary constant.
  const f = w * 0.9;
  const eye = 14;                       // metres above the water
  const nearD = (f * eye) / Math.max(1, h - horizonY);
  return { w, h, horizonY, cx: w / 2, f, eye, nearD };
}

/** World (lateral X metres, ground distance d metres) -> screen. */
export function project(cam, X, d) {
  const dd = Math.max(0.5, d);
  return {
    x: cam.cx + (cam.f * X) / dd,
    y: cam.horizonY + (cam.f * cam.eye) / dd,
    scale: cam.f / dd,                  // pixels per metre at that distance
  };
}

/** Screen y on the water -> ground distance. Inverse of the above. */
export function distanceAt(cam, yScreen) {
  const dy = yScreen - cam.horizonY;
  if (dy <= 0.5) return Infinity;
  return (cam.f * cam.eye) / dy;
}

/**
 * Project a circular ripple of radius r (metres) centred at (X0, d0) into
 * screen space, as a list of points.
 *
 * A circle on the plane is not an ellipse on screen — the far side of the
 * ring is compressed much more than the near side, because compression goes
 * with 1/d and the two sides are at different distances. Sampling the ring
 * and projecting each point gets that right; drawing an ellipse does not,
 * which is why the old rings looked like they were floating in the air.
 */
export function projectRing(cam, X0, d0, r, samples = 48) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const X = X0 + Math.cos(a) * r;
    const d = d0 + Math.sin(a) * r;
    // Anything at or behind the camera plane can't be drawn.
    if (d <= cam.nearD * 0.25) { pts.push(null); continue; }
    pts.push(project(cam, X, d));
  }
  return pts;
}

/**
 * Ripple amplitude at radius r.
 *
 * Surface waves spreading in a circle conserve energy around a growing
 * circumference, so amplitude falls as 1/sqrt(r) — not linearly, and not
 * as a fixed fade. Plus a viscous decay term so rings die out rather than
 * travelling forever.
 */
export function rippleAmplitude(r, age, r0 = 1.5) {
  const spread = Math.sqrt(r0 / Math.max(r0, r));
  const damping = Math.exp(-age * 0.55);
  return spread * damping;
}

/** Deep-water gravity waves: longer wavelengths travel faster. Used so a
 *  sub-bass hit spreads visibly faster than a mid-bass one. */
export function waveSpeed(wavelengthM) {
  const g = 9.81;
  return Math.sqrt((g * Math.max(0.4, wavelengthM)) / (2 * Math.PI));
}
