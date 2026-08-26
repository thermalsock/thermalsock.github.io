// Can the analysis actually tell techno from a pad from white noise?
//
// The complaint was that the visual looked the same whatever was played.
// The old feature set (low/mid/high energy + centroid + ZCR) genuinely
// could not separate a soft pad from pink noise. These tests build
// synthetic spectra for real material and assert the derived scene
// parameters differ in the right direction.
import { Analysis, sceneParams, spectralFlatness, dbToAmp, PulseTracker } from '../ambient-bloom/js/analysis.js';

let fails = 0;
const check = (label, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
};

const SR = 44100, BINS = 1024, MIN_DB = -100, MAX_DB = -30;
const binHz = SR / (2 * BINS);

// Build a dB spectrum from a function of frequency returning linear amp.
function spectrum(ampAt) {
  const a = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++) {
    const hz = i * binHz;
    const amp = Math.max(1e-6, ampAt(hz, i));
    a[i] = Math.max(MIN_DB, 20 * Math.log10(amp));
  }
  return a;
}
const timeBuf = (amp) => Float32Array.from({ length: 2048 }, (_, i) => amp * Math.sin(i * 0.05));

// --- Material ------------------------------------------------------------
const harmonicsOf = (f0, n, rolloff) => (hz) => {
  let a = 1e-6;
  for (let k = 1; k <= n; k++) {
    const fk = f0 * k;
    if (Math.abs(hz - fk) < binHz * 1.5) a = Math.max(a, Math.pow(rolloff, k - 1));
  }
  return a;
};

const MATERIAL = {
  // Solar Fields / Floyd territory: a soft sustained pad, strongly harmonic
  softPad:   spectrum(harmonicsOf(110, 14, 0.68)),
  // Eat Static / techno: kick fundamental plus harmonics, lots of sub
  // Real kick: strong sub, steep rolloff, plus a short broadband click.
  technoKick: spectrum((hz) => Math.max(1e-6, Math.exp(-hz / 90)) + (hz < 4000 ? 0.02 * Math.exp(-hz / 1800) : 1e-6)),
  // Bass-heavy: strong low content, little top
  bassDrone: spectrum((hz) => (hz < 50 ? 0.2 : hz < 130 ? 1 : hz < 400 ? 0.3 : 4e-5)),
  // White noise: flat across the spectrum
  whiteNoise: spectrum(() => 0.35 + Math.random() * 0.02),
  // Pink noise: -3dB/octave, still noisy but darker
  pinkNoise: spectrum((hz) => (hz < 20 ? 1e-6 : 0.9 / Math.sqrt(hz / 40)) * (0.95 + Math.random() * 0.1)),
  // Bright lead
  brightLead: spectrum(harmonicsOf(880, 10, 0.75)),
};

// --- Flatness is the key discriminator -----------------------------------
const flat = (name) => spectralFlatness(MATERIAL[name], SR, MIN_DB);
check('white noise reads as noisy', flat('whiteNoise') > 0.5, flat('whiteNoise').toFixed(3));
check('pink noise reads as noisy', flat('pinkNoise') > 0.25, flat('pinkNoise').toFixed(3));
check('a pad reads as tonal', flat('softPad') < 0.15, flat('softPad').toFixed(3));
check('a kick is not read as pure noise', flat('technoKick') < 0.6, flat('technoKick').toFixed(3));
check('noise and pad are clearly separated',
      flat('whiteNoise') - flat('softPad') > 0.4,
      `${flat('whiteNoise').toFixed(2)} vs ${flat('softPad').toFixed(2)}`);

// --- Run each material through the full analysis -------------------------
function settle(name, frames = 120, amp = 0.35) {
  const a = new Analysis();
  let st;
  for (let i = 0; i < frames; i++) {
    st = a.update(MATERIAL[name], timeBuf(amp), SR, MIN_DB, MAX_DB, 16, i * 16);
  }
  return sceneParams(st);
}

const pad = settle('softPad');
const noise = settle('whiteNoise');
const bass = settle('bassDrone');
const lead = settle('brightLead');

check('pad is coherent', pad.coherence > 0.7, pad.coherence.toFixed(2));
check('white noise is not coherent', noise.coherence < 0.35, noise.coherence.toFixed(2));
check('white noise is grainy', noise.grain > 0.6, noise.grain.toFixed(2));
check('pad is not grainy', pad.grain < 0.25, pad.grain.toFixed(2));
check('coherence separates pad from noise', pad.coherence - noise.coherence > 0.45,
      `${pad.coherence.toFixed(2)} vs ${noise.coherence.toFixed(2)}`);

check('bass drone swells more than a bright lead', bass.swell > lead.swell,
      `${bass.swell.toFixed(2)} vs ${lead.swell.toFixed(2)}`);
check('bright lead is brighter than bass drone', lead.brightness > bass.brightness,
      `${lead.brightness.toFixed(2)} vs ${bass.brightness.toFixed(2)}`);
check('bass drone is warmer than bright lead', bass.warmth > lead.warmth,
      `${bass.warmth.toFixed(2)} vs ${lead.warmth.toFixed(2)}`);
check('bright lead shimmers more than bass drone', lead.shimmer > bass.shimmer,
      `${lead.shimmer.toFixed(2)} vs ${bass.shimmer.toFixed(2)}`);

// --- A bass hit must actually register as an impact ----------------------
{
  const a = new Analysis();
  const silence = spectrum(() => 1e-6);
  let st;
  for (let i = 0; i < 40; i++) st = a.update(silence, timeBuf(0.01), SR, MIN_DB, MAX_DB, 16, i * 16);
  const quietImpact = sceneParams(st).impact;
  // Now hit it.
  st = a.update(MATERIAL.technoKick, timeBuf(0.9), SR, MIN_DB, MAX_DB, 16, 40 * 16);
  const hitImpact = sceneParams(st).impact;
  check('a bass hit produces an impact spike', hitImpact > quietImpact + 0.15,
        `${quietImpact.toFixed(2)} -> ${hitImpact.toFixed(2)}`);

  // ...and it must decay, not latch on.
  let decayed = hitImpact;
  for (let i = 0; i < 60; i++) decayed = sceneParams(a.update(silence, timeBuf(0.01), SR, MIN_DB, MAX_DB, 16, (41 + i) * 16)).impact;
  check('impact decays back down', decayed < hitImpact * 0.2,
        `${hitImpact.toFixed(2)} -> ${decayed.toFixed(3)}`);
}

// --- Techno should lock; ambient should not ------------------------------
{
  const steady = new PulseTracker();
  for (let i = 0; i < 10; i++) steady.hit(i * 500);      // a clean 120bpm
  steady.update(5000);
  check('a steady beat gives high pulse confidence', steady.confidence > 0.8, steady.confidence.toFixed(2));
  check('bpm is recovered correctly', Math.abs(steady.bpm - 120) < 1, steady.bpm.toFixed(1));

  const scattered = new PulseTracker();
  const gaps = [300, 900, 420, 1300, 610, 1100, 350, 800, 1400, 500];
  let t = 0;
  for (const g of gaps) { t += g; scattered.hit(t); }
  scattered.update(t);
  check('scattered hits give low pulse confidence', scattered.confidence < 0.6, scattered.confidence.toFixed(2));
  check('a beat and ambient drift are separated',
        steady.confidence - scattered.confidence > 0.3,
        `${steady.confidence.toFixed(2)} vs ${scattered.confidence.toFixed(2)}`);
}

// --- Every material must produce a distinguishable parameter set ---------
const sets = { pad, noise, bass, lead };
const names = Object.keys(sets);
const KEYS = ['swell', 'coherence', 'grain', 'brightness', 'warmth', 'shimmer'];
let allDistinct = true;
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = sets[names[i]], b = sets[names[j]];
    const dist = KEYS.reduce((acc, k) => acc + Math.abs(a[k] - b[k]), 0);
    if (dist < 0.35) { allDistinct = false; console.log(`   ${names[i]} vs ${names[j]} distance ${dist.toFixed(2)}`); }
  }
}
check('all four materials are visually distinguishable', allDistinct);

console.log(fails === 0 ? '\n✓ all analysis tests passed' : `\n✗ ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
