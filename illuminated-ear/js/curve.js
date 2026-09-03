export function powerCurve(x, exponent) {
  return Math.pow(Math.max(0, Math.min(1, x)), exponent);
}

export function smoothstep(x, edge0 = 0, edge1 = 1) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function expCurve(x, sharpness = 3) {
  const t = Math.max(0, Math.min(1, x));
  return (Math.exp(sharpness * t) - 1) / (Math.exp(sharpness) - 1);
}

export function mapRange(x, inMin, inMax, outMin, outMax) {
  const t = Math.max(0, Math.min(1, (x - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}