import { AudioEngine } from './audioEngine.js';
import { TriggerEngine, TriggerMode } from './triggerEngine.js';
import { Renderer } from './renderer.js';
import { themes, defaultThemeId } from './themes.js';
import { measureVpp, measureRms, measureFrequency, formatHz, formatMs, computeChroma, NOTE_NAMES, findSpectralPeaks, freqToNote, tagHarmonics, computeHarmonicBalance } from './measurements.js';

const els = {
  gate: document.getElementById('gate'),
  app: document.getElementById('app'),
  deviceSelect: document.getElementById('deviceSelect'),
  startBtn: document.getElementById('startBtn'),
  gateError: document.getElementById('gateError'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  canvas: document.getElementById('scopeCanvas'),
  scopeWrap: document.getElementById('scopeWrap'),
  displayMode: document.getElementById('displayMode'),
  themeSelect: document.getElementById('themeSelect'),
  chBToggle: document.getElementById('chBToggle'),
  triggerMode: document.getElementById('triggerMode'),
  triggerSlope: document.getElementById('triggerSlope'),
  triggerLevel: document.getElementById('triggerLevel'),
  singleShotBtn: document.getElementById('singleShotBtn'),
  vScale: document.getElementById('vScale'),
  cursorsToggle: document.getElementById('cursorsToggle'),
  cursorDeltaT: document.getElementById('cursorDeltaT'),
  cursorFreq: document.getElementById('cursorFreq'),
  cursorDeltaV: document.getElementById('cursorDeltaV'),
  triggerStatus: document.getElementById('triggerStatus'),
  measVpp: document.getElementById('measVpp'),
  measRms: document.getElementById('measRms'),
  measFreq: document.getElementById('measFreq'),
  measPeriod: document.getElementById('measPeriod'),
  measPeakFreq: document.getElementById('measPeakFreq'),
  modePill: document.getElementById('modePill'),
  heroLabel: document.getElementById('heroLabel'),
  heroValueNum: document.getElementById('heroValueNum'),
  heroUnit: document.getElementById('heroUnit'),
  heroSub: document.getElementById('heroSub'),
};

const MODE_LABELS = {
  time: 'Time Domain',
  xy: 'XY / Lissajous',
  spectrum: 'FFT / Spectrum',
  spectrogram: 'Spectrogram',
  chromagram: 'Chromagram',
  harmonics: 'Harmonics / Tuner',
  balance: 'Harmonic Balance',
};

// fftSize 4096 (not the earlier 2048) gives finer native frequency resolution,
// which matters for the Harmonics/Tuner view reading precise cents deviation
// at low subharmonic frequencies — combined with the peak interpolation in
// measurements.js this gets sub-bin accuracy even on bass-range oscillators.
const audioEngine = new AudioEngine({ fftSize: 4096 });
const triggerEngine = new TriggerEngine();
const renderer = new Renderer(els.canvas);

let displayMode = 'time';
let showChannelB = true;
let showCursors = false;
let lastFrameA = null; // held frame for NORMAL/SINGLE modes
let lastFrameB = null;
let rafId = null;
const chromaSmooth = new Float32Array(12); // exponential smoothing so bars don't flicker frame to frame
let balanceSmooth = { oddRatio: 0.5, thdPercent: 0 }; // exponential smoothing for the balance meter

// Cursor state: null until first shown, then persists across toggles/mode switches.
const cursors = { vA: null, vB: null, hA: null, hB: null };
let draggingCursor = null;
const CURSOR_HIT_RADIUS = 8; // px

// --- Theme setup ---------------------------------------------------------

function populateThemes() {
  els.themeSelect.innerHTML = '';
  Object.values(themes).forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    els.themeSelect.appendChild(opt);
  });
  els.themeSelect.value = defaultThemeId;
  renderer.setTheme(themes[defaultThemeId]);
}
populateThemes();

els.themeSelect.addEventListener('change', () => {
  renderer.setTheme(themes[els.themeSelect.value]);
});

// --- Device enumeration ---------------------------------------------------

async function populateDevices() {
  try {
    const devices = await AudioEngine.listInputDevices();
    els.deviceSelect.innerHTML = '<option value="">Default input</option>';
    devices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Input ${i + 1}`;
      els.deviceSelect.appendChild(opt);
    });
  } catch (e) {
    // enumerateDevices can fail before permission is granted in some browsers;
    // that's fine, the "Default input" option still lets capture start.
    console.warn('Could not enumerate devices yet:', e);
  }
}
populateDevices();

// --- Permission gate / start capture --------------------------------------

function showError(message) {
  els.gateError.textContent = message;
  els.gateError.hidden = false;
}

function friendlyErrorMessage(err) {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Microphone/input access was denied. Check your browser\u2019s site permissions and try again.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No audio input device was found. Plug in an interface or microphone and try again.';
  }
  if (err.name === 'NotReadableError') {
    return 'The selected input is already in use by another application.';
  }
  return `Could not start capture: ${err.message || err.name || 'unknown error'}`;
}

els.startBtn.addEventListener('click', async () => {
  console.log('[oscilloscope] Start capture clicked');
  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Requesting permission\u2026';
  els.gateError.hidden = true;
  try {
    const deviceId = els.deviceSelect.value || null;
    console.log('[oscilloscope] Calling getUserMedia, deviceId =', deviceId || '(default)');
    const { channelCount } = await audioEngine.start(deviceId);
    console.log('[oscilloscope] Capture started:', { channelCount, sampleRate: audioEngine.sampleRate });
    els.chBToggle.disabled = channelCount < 2;
    if (channelCount < 2) {
      els.chBToggle.checked = false;
      showChannelB = false;
    }

    els.gate.hidden = true;
    els.app.hidden = false;
    els.startBtn.disabled = false;
    els.startBtn.textContent = 'Start capture';
    els.statusDot.classList.add('live');
    els.statusText.textContent = `Running \u2014 ${audioEngine.sampleRate} Hz, ${channelCount} ch`;

    renderer.resize();
    window.addEventListener('resize', () => renderer.resize());
    startLoop();

    // One-shot diagnostic: is channel B actually carrying different data
    // from channel A, or are we looking at a duplicated mono signal?
    setTimeout(() => {
      const cmp = audioEngine.compareChannels();
      if (!cmp) return;
      if (cmp.likelyIdentical) {
        console.warn(
          '[oscilloscope] Channels A and B look identical (max sample diff:',
          cmp.maxDiff.toFixed(6), ', correlation:', cmp.correlation?.toFixed(4),
          '). This usually means the OS/interface is sending the same mono ' +
          'signal to both channels, not a bug in this app\u2019s channel splitting. ' +
          'Check: (1) the correct stereo input device is selected above, not ' +
          '"Default input"; (2) your audio interface doesn\u2019t have a MONO/LINK ' +
          'switch enabled; (3) each oscillator is physically patched into a ' +
          'separate input (1/L and 2/R) on the interface.'
        );
      } else {
        console.log(
          '[oscilloscope] Channels A and B carry distinct signals (correlation:',
          cmp.correlation?.toFixed(4), ') \u2014 stereo separation looks correct.'
        );
      }
    }, 1500);
  } catch (err) {
    console.error('[oscilloscope] Failed to start capture:', err.name, err.message, err);
    showError(friendlyErrorMessage(err));
    els.startBtn.disabled = false;
    els.startBtn.textContent = 'Start capture';
  }
});

// --- Control wiring --------------------------------------------------------

els.displayMode.addEventListener('change', () => {
  displayMode = els.displayMode.value;
  els.modePill.textContent = MODE_LABELS[displayMode] || displayMode;
});
els.chBToggle.addEventListener('change', () => { showChannelB = els.chBToggle.checked; });
els.vScale.addEventListener('input', () => {
  audioEngine.setGain(parseFloat(els.vScale.value));
});
els.cursorsToggle.addEventListener('change', () => {
  showCursors = els.cursorsToggle.checked;
  if (showCursors && cursors.vA == null) {
    // First time shown: seed sensible default positions.
    cursors.vA = renderer.width * 0.35;
    cursors.vB = renderer.width * 0.65;
    cursors.hA = renderer.height * 0.3;
    cursors.hB = renderer.height * 0.7;
  }
});

function canvasPos(evt) {
  const rect = els.canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

els.canvas.addEventListener('mousedown', (evt) => {
  if (!showCursors || displayMode !== 'time' || cursors.vA == null) return;
  const { x, y } = canvasPos(evt);
  const candidates = [
    { key: 'vA', dist: Math.abs(x - cursors.vA) },
    { key: 'vB', dist: Math.abs(x - cursors.vB) },
    { key: 'hA', dist: Math.abs(y - cursors.hA) },
    { key: 'hB', dist: Math.abs(y - cursors.hB) },
  ];
  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates[0].dist <= CURSOR_HIT_RADIUS) {
    draggingCursor = candidates[0].key;
    evt.preventDefault();
  }
});

window.addEventListener('mousemove', (evt) => {
  if (!draggingCursor) return;
  const { x, y } = canvasPos(evt);
  if (draggingCursor === 'vA' || draggingCursor === 'vB') {
    cursors[draggingCursor] = Math.max(0, Math.min(renderer.width, x));
  } else {
    cursors[draggingCursor] = Math.max(0, Math.min(renderer.height, y));
  }
});

window.addEventListener('mouseup', () => {
  draggingCursor = null;
});

els.triggerMode.addEventListener('change', () => {
  triggerEngine.setMode(els.triggerMode.value);
});
els.triggerSlope.addEventListener('change', () => {
  triggerEngine.slope = els.triggerSlope.value;
});
els.triggerLevel.addEventListener('input', () => {
  triggerEngine.level = parseFloat(els.triggerLevel.value);
});
els.singleShotBtn.addEventListener('click', () => {
  // Force a capture regardless of whatever mode is currently selected —
  // switches to Single under the hood so the button always does something
  // visible when pressed, rather than requiring the dropdown to be set first.
  els.triggerMode.value = TriggerMode.SINGLE;
  triggerEngine.setMode(TriggerMode.SINGLE);
  triggerEngine.rearm();
});

// --- Render loop -------------------------------------------------------

const WINDOW_SIZE = 1024; // samples drawn per frame, independent of fftSize

function updateMeasurements(frameA) {
  if (!frameA) return;
  const vpp = measureVpp(frameA);
  const rms = measureRms(frameA);
  const freqResult = measureFrequency(frameA, audioEngine.sampleRate);

  els.measVpp.textContent = vpp.toFixed(3);
  els.measRms.textContent = rms.toFixed(3);
  els.measFreq.textContent = freqResult ? formatHz(freqResult.frequencyHz) : '--';
  els.measPeriod.textContent = freqResult ? formatMs(freqResult.periodMs) : '--';
}

function updateTriggerStatus(resultA) {
  els.triggerStatus.classList.remove('trig', 'hold', 'armed');
  if (triggerEngine.mode === TriggerMode.SINGLE) {
    if (!triggerEngine.armed) {
      els.triggerStatus.textContent = 'HELD';
      els.triggerStatus.classList.add('hold');
    } else {
      els.triggerStatus.textContent = 'ARMED';
      els.triggerStatus.classList.add('armed');
    }
    return;
  }
  if (resultA.triggered) {
    els.triggerStatus.textContent = "TRIG'D";
    els.triggerStatus.classList.add('trig');
  } else if (resultA.data) {
    els.triggerStatus.textContent = 'AUTO (free-run)';
  } else {
    els.triggerStatus.textContent = 'HOLD (no trigger)';
    els.triggerStatus.classList.add('hold');
  }
}

function updatePeakFrequency(freqDataA) {
  if (!freqDataA || !audioEngine.sampleRate) {
    els.measPeakFreq.textContent = '--';
    return;
  }
  let peakIdx = 0;
  let peakDb = -Infinity;
  for (let i = 0; i < freqDataA.length; i++) {
    if (freqDataA[i] > peakDb) {
      peakDb = freqDataA[i];
      peakIdx = i;
    }
  }
  const binHz = audioEngine.sampleRate / audioEngine.fftSize;
  els.measPeakFreq.textContent = formatHz(peakIdx * binHz);
}

function updateCursorReadout() {
  if (!showCursors || displayMode !== 'time' || cursors.vA == null || !audioEngine.sampleRate) {
    els.cursorDeltaT.textContent = '--';
    els.cursorFreq.textContent = '--';
    els.cursorDeltaV.textContent = '--';
    return;
  }
  const msPerPixel = (WINDOW_SIZE / audioEngine.sampleRate) * 1000 / renderer.width;
  const deltaTms = Math.abs(cursors.vB - cursors.vA) * msPerPixel;
  els.cursorDeltaT.textContent = formatMs(deltaTms);
  els.cursorFreq.textContent = deltaTms > 0 ? formatHz(1000 / deltaTms) : '--';

  const deltaV = Math.abs(renderer.pixelToAmplitude(cursors.hA) - renderer.pixelToAmplitude(cursors.hB));
  els.cursorDeltaV.textContent = deltaV.toFixed(3);
}

function updateHeroCard(state) {
  els.heroLabel.textContent = state.label;
  els.heroValueNum.textContent = state.value;
  els.heroUnit.textContent = state.unit || '';
  els.heroSub.innerHTML = state.sub || '&nbsp;';
}

function frame() {
  const buffers = audioEngine.getTimeDomainData();
  const bufA = buffers[0];
  const bufB = buffers[1];

  // Trigger always runs on channel A. Channel B is sliced at the exact same
  // sample index so both traces stay time-aligned relative to the trigger
  // point, the way a real 2-channel scope triggers off one input.
  const resultA = triggerEngine.process(bufA, WINDOW_SIZE);
  if (resultA.data) {
    lastFrameA = resultA.data;
    if (bufB && resultA.index >= 0) {
      const end = Math.min(resultA.index + WINDOW_SIZE, bufB.length);
      lastFrameB = bufB.slice(resultA.index, end);
    }
  }

  if (displayMode === 'time') {
    const framesToShow = [lastFrameA, showChannelB ? lastFrameB : null];
    renderer.drawTimeDomain(framesToShow);
    renderer.drawTriggerLevel(triggerEngine.level);
    if (showCursors && cursors.vA != null) {
      renderer.drawCursors(cursors);
    }
    els.measPeakFreq.textContent = '--';
    const freqResult = lastFrameA ? measureFrequency(lastFrameA, audioEngine.sampleRate) : null;
    updateHeroCard({
      label: 'Frequency',
      value: freqResult ? freqResult.frequencyHz.toFixed(1) : '--',
      unit: freqResult ? 'Hz' : '',
      sub: freqResult ? `Period ${formatMs(freqResult.periodMs)}` : '',
    });
  } else if (displayMode === 'xy') {
    // XY mode needs same-length, time-aligned A/B slices — already guaranteed
    // since both were cut from the same trigger index above.
    renderer.drawXY(lastFrameA, lastFrameB);
    els.measPeakFreq.textContent = '--';
    const freqResult = lastFrameA ? measureFrequency(lastFrameA, audioEngine.sampleRate) : null;
    updateHeroCard({
      label: 'Frequency (Ch A)',
      value: freqResult ? freqResult.frequencyHz.toFixed(1) : '--',
      unit: freqResult ? 'Hz' : '',
      sub: showChannelB ? 'Plotted against Ch B' : 'Enable Ch B for a real Lissajous',
    });
  } else if (displayMode === 'spectrum') {
    // Spectrum free-runs continuously; edge triggering isn't meaningful here.
    const freqBuffers = audioEngine.getFrequencyData();
    renderer.drawSpectrum(freqBuffers[0], {
      sampleRate: audioEngine.sampleRate,
      fftSize: audioEngine.fftSize,
      minDb: audioEngine.minDecibels,
      maxDb: audioEngine.maxDecibels,
    });
    updatePeakFrequency(freqBuffers[0]);
    updateHeroCard({ label: 'Peak (FFT)', value: els.measPeakFreq.textContent, unit: '', sub: 'Dominant frequency bin' });
  } else if (displayMode === 'spectrogram') {
    const freqBuffers = audioEngine.getFrequencyData();
    renderer.drawSpectrogramColumn(freqBuffers[0], {
      sampleRate: audioEngine.sampleRate,
      fftSize: audioEngine.fftSize,
      minDb: audioEngine.minDecibels,
      maxDb: audioEngine.maxDecibels,
    });
    updatePeakFrequency(freqBuffers[0]);
    updateHeroCard({ label: 'Peak (FFT)', value: els.measPeakFreq.textContent, unit: '', sub: 'Dominant frequency bin' });
  } else if (displayMode === 'chromagram') {
    const freqBuffers = audioEngine.getFrequencyData();
    const chroma = computeChroma(freqBuffers[0], audioEngine.sampleRate, audioEngine.fftSize);
    for (let i = 0; i < 12; i++) {
      chromaSmooth[i] = chromaSmooth[i] * 0.75 + chroma[i] * 0.25;
    }
    renderer.drawChromagram(chromaSmooth, NOTE_NAMES);
    els.measPeakFreq.textContent = '--';
    let maxIdx = 0;
    for (let i = 1; i < 12; i++) if (chromaSmooth[i] > chromaSmooth[maxIdx]) maxIdx = i;
    updateHeroCard({
      label: 'Dominant pitch class',
      value: chromaSmooth[maxIdx] > 0.05 ? NOTE_NAMES[maxIdx] : '--',
      unit: '',
      sub: 'Octave-collapsed across 80Hz\u20135kHz',
    });
  } else if (displayMode === 'harmonics') {
    // Multi-pitch "tuner" view: detects several simultaneous pitches (e.g. a
    // VCO plus its subharmonics), labels each with its note name + cents
    // deviation, and tags which peaks are genuinely independent pitches vs.
    // which are just harmonics of an already-shown root — the distinction
    // that actually explains a busy-looking ladder.
    const freqBuffers = audioEngine.getFrequencyData();
    const rawPeaks = findSpectralPeaks(freqBuffers[0], audioEngine.sampleRate, audioEngine.fftSize, {
      minDb: audioEngine.minDecibels + 30,
      maxPeaks: 6,
    });
    const tagged = tagHarmonics(rawPeaks);
    const peaks = tagged.map((p) => {
      const note = freqToNote(p.freq);
      const label = note
        ? `${note.name}${note.octave}  ${p.freq.toFixed(1)}Hz  ${note.cents >= 0 ? '+' : ''}${note.cents.toFixed(0)}\u00a2`
        : `${p.freq.toFixed(1)}Hz`;
      return { freq: p.freq, label, harmonicOf: p.harmonicOf, harmonicNumber: p.harmonicNumber };
    });
    renderer.drawHarmonicLadder(peaks);
    els.measPeakFreq.textContent = '--';
    if (peaks.length > 0) {
      const rootPeak = peaks[0]; // ascending order — index 0 is always the lowest, always a root
      const note = freqToNote(rootPeak.freq);
      updateHeroCard({
        label: 'Fundamental',
        value: rootPeak.freq.toFixed(1),
        unit: 'Hz',
        sub: note ? `${note.name}${note.octave} \u00b7 ${note.cents >= 0 ? '+' : ''}${note.cents.toFixed(0)}\u00a2 \u00b7 ${peaks.length} peaks` : '',
      });
    } else {
      updateHeroCard({ label: 'Fundamental', value: '--', unit: '', sub: 'Listening\u2026' });
    }
  } else if (displayMode === 'balance') {
    // Harmonic balance meter: anchors on the lowest detected peak as "the"
    // fundamental (same assumption the ladder makes for its root), then
    // samples exact harmonic multiples directly rather than peak-searching.
    const freqBuffers = audioEngine.getFrequencyData();
    const rawPeaks = findSpectralPeaks(freqBuffers[0], audioEngine.sampleRate, audioEngine.fftSize, {
      minDb: audioEngine.minDecibels + 30,
      maxPeaks: 1,
    });
    if (rawPeaks.length > 0) {
      const fundamentalHz = rawPeaks[0].freq;
      const { oddRatio, thdPercent } = computeHarmonicBalance(
        freqBuffers[0], fundamentalHz, audioEngine.sampleRate, audioEngine.fftSize
      );
      balanceSmooth.oddRatio = balanceSmooth.oddRatio * 0.8 + oddRatio * 0.2;
      balanceSmooth.thdPercent = balanceSmooth.thdPercent * 0.8 + thdPercent * 0.2;
      // Base the displayed reliability on the smoothed THD (matching the same
      // ~2% threshold computeHarmonicBalance uses internally) so the marker's
      // solid/hollow state doesn't flicker frame to frame near the boundary.
      const reliable = balanceSmooth.thdPercent >= 2;
      const note = freqToNote(fundamentalHz);
      const label = note
        ? `${note.name}${note.octave}  ${fundamentalHz.toFixed(1)}Hz`
        : `${fundamentalHz.toFixed(1)}Hz`;
      renderer.drawHarmonicBalance(label, balanceSmooth.oddRatio, balanceSmooth.thdPercent, reliable);
      updateHeroCard({
        label: 'THD',
        value: balanceSmooth.thdPercent.toFixed(1),
        unit: '%',
        sub: note ? `${note.name}${note.octave} fundamental \u00b7 ${reliable ? (balanceSmooth.oddRatio > 0.5 ? 'odd-dominant' : 'even-dominant') : 'near-pure tone'}` : '',
      });
    } else {
      renderer.drawHarmonicBalance(null, 0.5, 0);
      updateHeroCard({ label: 'THD', value: '--', unit: '', sub: 'Listening\u2026' });
    }
    els.measPeakFreq.textContent = '--';
  }

  updateMeasurements(lastFrameA);
  updateTriggerStatus(resultA);
  updateCursorReadout();

  rafId = requestAnimationFrame(frame);
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  frame();
}
