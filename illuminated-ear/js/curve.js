// curve.js
// Small reusable shaping curves — the whole point of a "reactivity curve"
// is that quiet/loud, soft/hard shouldn't feel like a straight ruler.
// Every audio→visual mapping in this app used to be `base + x*scale`.
// These give it somewhere else to go.

/** Power curve: exponent < 1 makes the low end more sensitive (climbs
 * fast off zero, flattens near the top); exponent > 1 does the opposite
 * (stays low longer, then shoots up near the top). Clamped to [0,1]
 * first so a slightly-over-1 input from an envelope overshoot can't
 * produce a NaN or a wild negative-base power result. */
export function powerCurve(x, exponent) {
  return Math.pow(Math.max(0, Math.min(1, x)), exponent);
}

/** Smoothstep — an S-curve, gentle near 0 and 1, steep in the middle.
 * Good for anything that should feel like it "switches on" around a
 * mid-range value rather than creeping up from the very start. */
export function smoothstep(x, edge0 = 0, edge1 = 1) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Exponential response — near-flat for low input, then rises sharply
 * near the top. Used for burst magnitude specifically: a merely-loud
 * onset and a genuinely hard one should look meaningfully different,
 * not just proportionally different. */
export function expCurve(x, sharpness = 3) {
  const t = Math.max(0, Math.min(1, x));
  return (Math.exp(sharpness * t) - 1) / (Math.exp(sharpness) - 1);
}

/** Linear remap with the input clamped to [inMin, inMax] first. */
export function mapRange(x, inMin, inMax, outMin, outMax) {
  const t = Math.max(0, Math.min(1, (x - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}
