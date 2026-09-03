export const MATH_OPS = [ {
  id: "chB",
  label: "Channel B"
}, {
  id: "diff",
  label: "A − B (difference)"
}, {
  id: "sum",
  label: "A + B (sum)"
}, {
  id: "product",
  label: "A × B (ring mod)"
}, {
  id: "mid",
  label: "Mid (A+B)/2"
}, {
  id: "side",
  label: "Side (A−B)/2"
}, {
  id: "envelope",
  label: "Envelope of A"
}, {
  id: "rectify",
  label: "Rectified A"
}, {
  id: "integrate",
  label: "Integral of A"
}, {
  id: "differentiate",
  label: "Derivative of A"
} ];

export function computeMathChannel(a, b, op) {
  const n = a.length;
  const out = new Float32Array(n);
  const hasB = b && b.length > 0;
  const bLen = hasB ? b.length : 0;
  switch (op) {
   case "diff":
    for (let i = 0; i < n; i++) out[i] = a[i] - (i < bLen ? b[i] : 0);
    return out;

   case "sum":
    for (let i = 0; i < n; i++) out[i] = a[i] + (i < bLen ? b[i] : 0);
    return out;

   case "product":
    for (let i = 0; i < n; i++) out[i] = a[i] * (i < bLen ? b[i] : 0);
    return out;

   case "mid":
    for (let i = 0; i < n; i++) out[i] = (a[i] + (i < bLen ? b[i] : 0)) * .5;
    return out;

   case "side":
    for (let i = 0; i < n; i++) out[i] = (a[i] - (i < bLen ? b[i] : 0)) * .5;
    return out;

   case "rectify":
    for (let i = 0; i < n; i++) out[i] = Math.abs(a[i]);
    return out;

   case "envelope":
    {
      const attack = .35, release = .02;
      let env = 0;
      for (let i = 0; i < n; i++) {
        const rect = Math.abs(a[i]);
        const coeff = rect > env ? attack : release;
        env += (rect - env) * coeff;
        out[i] = env;
      }
      return out;
    }

   case "integrate":
    {
      const leak = .999;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc = acc * leak + a[i];
        out[i] = acc * .02;
      }
      return out;
    }

   case "differentiate":
    out[0] = 0;
    for (let i = 1; i < n; i++) out[i] = (a[i] - a[i - 1]) * 8;
    return out;

   case "chB":
   default:
    for (let i = 0; i < n; i++) out[i] = i < bLen ? b[i] : 0;
    return out;
  }
}

export function opNeedsChannelB(op) {
  return op === "diff" || op === "sum" || op === "product" || op === "mid" || op === "side" || op === "chB";
}

function fftInPlace(re, im, invert) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (;j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
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
        re[i + j] = ur + tr;
        im[i + j] = ui + ti;
        re[i + j + half] = ur - tr;
        im[i + j + half] = ui - ti;
        const nwr = curWr * wr - curWi * wi, nwi = curWr * wi + curWi * wr;
        curWr = nwr;
        curWi = nwi;
      }
    }
  }
  if (invert) for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] /= n;
  }
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function computeMagnitudeSpectrumDb(buffer) {
  const n = nextPow2(buffer.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < buffer.length; i++) {
    const w = .5 - .5 * Math.cos(2 * Math.PI * i / buffer.length);
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