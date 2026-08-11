// WaveformMath.js
//
// Pure functions only -- no canvas, no Web Audio -- so this can be
// exercised with plain synthetic arrays and verified before it's ever
// wired into real rendering.

// Finds the first RISING zero-crossing in a time-domain buffer
// (silence/center = 0.0 -- this operates on FLOAT data now, see
// AudioAnalysis.js's getFloatTimeDomainData). Standard oscilloscope
// trigger trick: without this, a live (non-snapshot) waveform visibly
// jitters side-to-side every frame because each new buffer starts at a
// different, essentially random phase of the signal. Starting the
// draw from a consistent trigger point instead makes even the LIVE
// view read as a stable, non-jittering waveform for anything roughly
// periodic -- the actual "stable waveform" ask, achieved without
// needing to freeze anything.
//
// Returns 0 (draw from the start, unstabilized) if no rising crossing
// is found in the first searchLimit samples -- e.g. near-silence, a
// pure DC signal, or a signal that only ever falls.
export function findTriggerOffset(data, searchLimit = null) {
  const limit = searchLimit ? Math.min(searchLimit, data.length - 1) : data.length - 1;
  for (let i = 1; i < limit; i++) {
    if (data[i - 1] < 0 && data[i] >= 0) return i;
  }
  return 0;
}

// Auto-gain for the oscilloscope display: finds the peak absolute
// value across the samples actually being drawn, and returns a
// multiplier that scales that peak up to nearly fill the display
// range. Without this, a quiet signal (relative to the full -1.0..1.0
// float range Web Audio can return) reads as a barely-visible flat
// wiggle even though it's a perfectly real, correctly-captured signal
// -- the gain problem is in the DISPLAY, not the capture.
//
// Deliberately does NOT amplify near-silence into visual noise: below
// a small floor, gain is fixed at 1 (flat line), since dividing a
// near-zero peak into a big multiplier would blow tiny noise-floor
// jitter up into something that looks like a fake signal.
export function computeAutoGain(waveform, startOffset, sampleCount, maxGain = 20, targetPeak = 0.92) {
  let maxDev = 0;
  const end = Math.min(startOffset + sampleCount, waveform.length);
  for (let i = startOffset; i < end; i++) {
    const dev = Math.abs(waveform[i]);
    if (dev > maxDev) maxDev = dev;
  }
  if (maxDev < 0.006) return 1; // treat as silence/noise-floor -- don't amplify
  return Math.min(targetPeak / maxDev, maxGain);
}

// Smooths a Float32Array via a simple centered moving average. With
// full float-precision capture (see AudioAnalysis.js), this is no
// longer compensating for 8-bit quantization -- that problem is gone
// at the source now -- it's just light noise reduction on the real
// signal, so the window is intentionally small (real signal detail,
// including genuine high-frequency content, should mostly survive).
//
// Returns a new array of the same length (not run in place, so
// callers can still access the original raw samples if needed).
export function smoothSamples(data, windowSize = 3) {
  const half = Math.floor(windowSize / 2);
  const out = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let sum = 0, count = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j >= 0 && j < data.length) { sum += data[j]; count++; }
    }
    out[i] = sum / count;
  }
  return out;
}

// Buckets a Web Audio frequency-domain buffer (linear bin spacing)
// into numBars LOG-spaced bands spanning minHz..maxHz -- matches how
// real EQ/spectrum analyzers display frequency (equal visual width per
// octave, not per Hz), rather than a raw linear FFT plot where the
// entire midrange and treble get compressed into a sliver on the right
// and the display is dominated by sub-bass detail nobody's reading an
// EQ display for.
//
// Returns an array of numBars values in the same 0-255 range as the
// source data (each bucket's average magnitude across the bin range
// that falls within it).
export function bucketSpectrumLog(freqData, sampleRate, fftSize, numBars, minHz = 30, maxHz = null) {
  const nyquist = sampleRate / 2;
  const maxFreq = maxHz ? Math.min(maxHz, nyquist) : nyquist;
  const binCount = freqData.length; // == fftSize/2
  const hzPerBin = nyquist / binCount;

  const logMin = Math.log10(minHz);
  const logMax = Math.log10(maxFreq);
  const bars = new Array(numBars).fill(0);

  for (let b = 0; b < numBars; b++) {
    const loFreq = Math.pow(10, logMin + (logMax - logMin) * (b / numBars));
    const hiFreq = Math.pow(10, logMin + (logMax - logMin) * ((b + 1) / numBars));

    let loBin = Math.max(0, Math.floor(loFreq / hzPerBin));
    let hiBin = Math.min(binCount - 1, Math.ceil(hiFreq / hzPerBin));
    if (hiBin < loBin) hiBin = loBin; // degenerate band narrower than one bin -- still sample the one bin it falls in

    let sum = 0, count = 0;
    for (let i = loBin; i <= hiBin; i++) { sum += freqData[i]; count++; }
    bars[b] = count > 0 ? sum / count : 0;
  }

  return bars;
}
