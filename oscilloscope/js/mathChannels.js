// mathChannels.js
// Everything needed to turn "Channel A" and "Channel B" into a proper scope
// MATH trace, the way a real 2-channel bench scope does: arithmetic between
// channels, plus a small signal-processing chain (rectify / envelope /
// integrate / differentiate) that can run on either a raw channel or the
// result of that arithmetic. Also includes a compact real FFT so a math
// trace — which doesn't physically exist anywhere in the WebAudio graph —
// can still be spectrum-analyzed on demand ("FFT of difference" etc.),
// since AnalyserNode can only ever see real graph signals.

export const MATH_OPS = [
  { id: 'chB', label: 'Channel B' },
  { id: 'diff', label: 'A \u2212 B (difference)' },
  { id: 'sum', label: 'A + B (sum)' },
  { id: 'product', label: 'A \u00d7 B (ring mod)' },
  { id: 'mid', label: 'Mid (A+B)/2' },
  { id: 'side', label: 'Side (A\u2212B)/2' },
  { id: 'envelope', label: 'Envelope of A' },
  { id: 'rectify', label: 'Rectified A' },
  { id: 'integrate', label: 'Integral of A' },
  { id: 'differentiate', label: 'Derivative of A' },
];

/**
 * Computes the selected math/processing op. `a` and `b` are same-length (or
 * near-enough) Float32Arrays already sliced from the trigger point. Always
 * returns a Float32Array the same length as `a`. Ops that only use one
 * channel (envelope/rectify/integrate/differentiate) still accept `b` for a
 * uniform call signature but ignore it.
 */
export function computeMathChannel(a, b, op) {
  const n = a.length;
  const out = new Float32Array(n);
  const hasB = b && b.length > 0;
  const bLen = hasB ? b.length : 0;

  switch (op) {
    case 'diff':
      for (let i = 0; i < n; i++) out[i] = a[i] - (i < bLen ? b[i] : 0);
      return out;
    case 'sum':
      for (let i = 0; i < n; i++) out[i] = a[i] + (i < bLen ? b[i] : 0);
      return out;
    case 'product':
      // Two audio-rate signals multiplied together is literally ring
      // modulation — useful both as a math tool and as a reminder of what
      // ring mod actually does to a waveform.
      for (let i = 0; i < n; i++) out[i] = a[i] * (i < bLen ? b[i] : 0);
      return out;
    case 'mid':
      for (let i = 0; i < n; i++) out[i] = (a[i] + (i < bLen ? b[i] : 0)) * 0.5;
      return out;
    case 'side':
      for (let i = 0; i < n; i++) out[i] = (a[i] - (i < bLen ? b[i] : 0)) * 0.5;
      return out;
    case 'rectify':
      for (let i = 0; i < n; i++) out[i] = Math.abs(a[i]);
      return out;
    case 'envelope': {
      // Full-wave rectify, then an asymmetric one-pole follower (fast
      // attack, slower release) — the standard "envelope follower" shape,
      // run once down the buffer so it's a real causal filter, not a
      // lookahead/symmetric smoother that would flatten transients.
      const attack = 0.35, release = 0.02;
      let env = 0;
      for (let i = 0; i < n; i++) {
        const rect = Math.abs(a[i]);
        const coeff = rect > env ? attack : release;
        env += (rect - env) * coeff;
        out[i] = env;
      }
      return out;
    }
    case 'integrate': {
      // Running sum with a slight leak (multiply the accumulator by <1 each
      // sample) so DC/offset doesn't make the trace drift off-screen over a
      // long capture — a leaky integrator, the practical version of this
      // that's actually usable as a scope trace rather than a mathematical
      // curiosity.
      const leak = 0.999;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc = acc * leak + a[i];
        out[i] = acc * 0.02; // scale down so it doesn't dominate the display
      }
      return out;
    }
    case 'differentiate':
      out[0] = 0;
      for (let i = 1; i < n; i++) out[i] = (a[i] - a[i - 1]) * 8; // scaled up — raw sample deltas are tiny
      return out;
    case 'chB':
    default:
      for (let i = 0; i < n; i++) out[i] = i < bLen ? b[i] : 0;
      return out;
  }
}

export function opNeedsChannelB(op) {
  return op === 'diff' || op === 'sum' || op === 'product' || op === 'mid' || op === 'side' || op === 'chB';
}

// --- Compact real FFT, for spectrum-analyzing a math trace -----------------
// AnalyserNode can only report the spectrum of a signal that's actually
// wired into the WebAudio graph. A math trace is computed in JS after the
// fact, so if you want "FFT of A-B" there's no way around running a real
// transform on it ourselves. Kept small and self-contained (radix-2,
// power-of-two sizes only) — this only ever runs on the same WINDOW_SIZE
// buffer the time-domain trace already uses, once per frame, which is cheap.

function fftInPlace(re, im, invert) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (invert ? 1 : -1) * (2 * Math.PI / len);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curWr = 1, curWi = 0;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j], ui = im[i + j];
        const tr = re[i + j + half] * curWr - im[i + j + half] * curWi;
        const ti = re[i + j + half] * curWi + im[i + j + half] * curWr;
        re[i + j] = ur + tr; im[i + j] = ui + ti;
        re[i + j + half] = ur - tr; im[i + j + half] = ui - ti;
        const nwr = curWr * wr - curWi * wi, nwi = curWr * wi + curWi * wr;
        curWr = nwr; curWi = nwi;
      }
    }
  }
  if (invert) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Computes a magnitude spectrum (in dB, same convention AnalyserNode uses —
 * 20*log10 of the size-normalized magnitude) for an arbitrary buffer, so a
 * math trace can be plotted through the exact same drawSpectrum() renderer
 * path as a real channel. Approximate parity with AnalyserNode's own dB
 * scaling (which uses an internal Blackman window, not Hann) rather than
 * exact — close enough for reading relative shape and peaks, which is what
 * "FFT of the difference channel" is actually for.
 */
export function computeMagnitudeSpectrumDb(buffer) {
  const n = nextPow2(buffer.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < buffer.length; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / buffer.length); // periodic Hann
    re[i] = buffer[i] * w;
  }
  fftInPlace(re, im, false);
  const bins = n / 2;
  const out = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / n;
    out[k] = 20 * Math.log10(mag + 1e-12);
  }
  return out;
}
