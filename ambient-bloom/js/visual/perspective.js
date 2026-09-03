export function makeCamera(w, h, horizonY) {
  const f = w * .9;
  const eye = 14;
  const nearD = f * eye / Math.max(1, h - horizonY);
  return {
    w: w,
    h: h,
    horizonY: horizonY,
    cx: w / 2,
    f: f,
    eye: eye,
    nearD: nearD
  };
}

export function project(cam, X, d) {
  const dd = Math.max(.5, d);
  return {
    x: cam.cx + cam.f * X / dd,
    y: cam.horizonY + cam.f * cam.eye / dd,
    scale: cam.f / dd
  };
}

export function distanceAt(cam, yScreen) {
  const dy = yScreen - cam.horizonY;
  if (dy <= .5) return Infinity;
  return cam.f * cam.eye / dy;
}

export function projectRing(cam, X0, d0, r, samples = 48) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const a = i / samples * Math.PI * 2;
    const X = X0 + Math.cos(a) * r;
    const d = d0 + Math.sin(a) * r;
    if (d <= cam.nearD * .25) {
      pts.push(null);
      continue;
    }
    pts.push(project(cam, X, d));
  }
  return pts;
}

export function rippleAmplitude(r, age, r0 = 1.5) {
  const spread = Math.sqrt(r0 / Math.max(r0, r));
  const damping = Math.exp(-age * .55);
  return spread * damping;
}

export function waveSpeed(wavelengthM) {
  const g = 9.81;
  return Math.sqrt(g * Math.max(.4, wavelengthM) / (2 * Math.PI));
}