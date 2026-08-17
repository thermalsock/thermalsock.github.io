import { AudioEngine } from './audioEngine.js';
import { formatHz } from './measurements.js';
import { detectPitch, levelDb, PitchLock } from './pitchDetect.js';
import { buildDivideTable, intervalFromRatio, nearestDivisorForTarget, parseManualRoot, TARGET_INTERVALS } from './ratioEngine.js';
import { RATIO_CATEGORIES, RATIO_PRESETS } from './ratioLibrary.js';

const els = {
  gate: document.getElementById('gate'),
  app: document.getElementById('app'),
  deviceSelect: document.getElementById('deviceSelect'),
  startBtn: document.getElementById('startBtn'),
  skipBtn: document.getElementById('skipBtn'),
  gateError: document.getElementById('gateError'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  librarySidebar: document.getElementById('librarySidebar'),
  libraryDetail: document.getElementById('libraryDetail'),
  combinedIntervalSelect: document.getElementById('combinedIntervalSelect'),
  combinedOsc2Freq: document.getElementById('combinedOsc2Freq'),
  chordList: document.getElementById('chordList'),
  ladderSvg: document.getElementById('ladderSvg'),
};

// fftSize 8192 for accuracy on low sub-oscillator content generally; pitch
// detection itself works fine on a shorter recent window of that buffer.
const audioEngine = new AudioEngine({ fftSize: 8192 });
let captureRunning = false;

// ---------------- Oscillator state ----------------
// Each oscillator is tuned entirely independently until the Combined tab.
function makeOscState() {
  return { rootFreq: null, sub1N: 2, sub2N: 3 };
}
const osc = { 1: makeOscState(), 2: makeOscState() };
let combinedSemitoneOffset = 7; // Osc2 relative to Osc1 root; default a fifth above

// ---------------- Permission gate ----------------

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
    console.warn('Could not enumerate devices yet:', e);
  }
}
populateDevices();

function showError(message) {
  els.gateError.textContent = message;
  els.gateError.hidden = false;
}
function friendlyErrorMessage(err) {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Microphone/input access was denied. Check your browser\u2019s site permissions and try again.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No audio input device was found. Plug in an interface or microphone and try again, or use manual entry instead.';
  }
  if (err.name === 'NotReadableError') {
    return 'The selected input is already in use by another application.';
  }
  return `Could not start capture: ${err.message || err.name || 'unknown error'}`;
}

function enterApp() {
  els.gate.hidden = true;
  els.app.hidden = false;
  buildOscView(1);
  buildOscView(2);
  buildCombinedIntervalSelect();
  renderLibrarySidebar();
  renderLibraryDetail();
  renderCombined();
}

els.startBtn.addEventListener('click', async () => {
  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Requesting permission\u2026';
  els.gateError.hidden = true;
  try {
    const deviceId = els.deviceSelect.value || null;
    const { sampleRate, channelCount } = await audioEngine.start(deviceId);
    captureRunning = true;
    els.statusDot.classList.add('live');
    els.statusText.textContent = `Running \u2014 ${sampleRate} Hz, ${channelCount} ch`;
    els.startBtn.disabled = false;
    els.startBtn.textContent = 'Start capture';
    enterApp();
  } catch (err) {
    console.error('[subharmonicon] Failed to start capture:', err);
    els.startBtn.disabled = false;
    els.startBtn.textContent = 'Start capture';
    showError(friendlyErrorMessage(err));
  }
});

els.skipBtn.addEventListener('click', () => {
  captureRunning = false;
  els.statusText.textContent = 'Manual entry';
  enterApp();
});

// ---------------- View tabs ----------------

document.querySelectorAll('.view-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
    if (tab.dataset.view === 'combined') renderCombined();
  });
});

// ---------------- Oscillator tab (built once per oscillator, reused) ----------------

function buildOscView(n) {
  const root = document.getElementById(`view-osc${n}`);
  root.innerHTML = `
    <div class="osc-grid">
      <div class="osc-main">
        <section class="card">
          <h2 class="section-title">Osc ${n} Root</h2>
          <div class="root-value"><span id="osc${n}RootNum">--</span><span class="unit" id="osc${n}RootUnit"></span></div>
          <div class="root-sub" id="osc${n}RootSub">Detect from input, or type a note/frequency below.</div>
          <div class="root-controls">
            <div class="root-control-row">
              <button class="btn-inline" id="osc${n}DetectBtn" ${captureRunning ? '' : 'disabled title="Start capture on the previous screen, or type a note below"'}>Detect from input</button>
              <div style="flex:1">
                <div class="level-meter"><div class="level-meter-fill" id="osc${n}LevelFill"></div></div>
                <div class="level-label" id="osc${n}LevelLabel">${captureRunning ? 'input level' : 'capture not running'}</div>
              </div>
            </div>
            <div class="root-control-row">
              <input type="text" id="osc${n}ManualInput" placeholder="e.g. A2 or 110" />
              <button class="btn-inline" id="osc${n}ManualBtn">Set</button>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="section-title">Divide Table</h2>
          <p class="hint">Every possible sub setting for this VCO's root, calculated directly &mdash; no listening needed. Sub 1 and Sub 2 rows are highlighted below.</p>
          <table class="divide-table">
            <thead><tr><th>&divide;N</th><th>Freq</th><th>Note</th><th>Interval from root</th><th></th></tr></thead>
            <tbody id="osc${n}DivideTableBody"></tbody>
          </table>
        </section>
      </div>

      <aside class="osc-side">
        <section class="card">
          <h2 class="section-title">Sub 1</h2>
          <div class="target-picker">
            <select id="osc${n}Sub1Target"></select>
          </div>
          <div class="target-result" id="osc${n}Sub1TargetResult">&nbsp;</div>
          <div class="sub-assign sub1">
            <div class="sub-assign-label">Divide setting</div>
            <select id="osc${n}Sub1Select"></select>
          </div>
        </section>

        <section class="card">
          <h2 class="section-title">Sub 2</h2>
          <div class="target-picker">
            <select id="osc${n}Sub2Target"></select>
          </div>
          <div class="target-result" id="osc${n}Sub2TargetResult">&nbsp;</div>
          <div class="sub-assign sub2">
            <div class="sub-assign-label">Divide setting</div>
            <select id="osc${n}Sub2Select"></select>
          </div>
        </section>
      </aside>
    </div>
  `;

  const local = {
    rootNum: document.getElementById(`osc${n}RootNum`),
    rootUnit: document.getElementById(`osc${n}RootUnit`),
    rootSub: document.getElementById(`osc${n}RootSub`),
    detectBtn: document.getElementById(`osc${n}DetectBtn`),
    levelFill: document.getElementById(`osc${n}LevelFill`),
    levelLabel: document.getElementById(`osc${n}LevelLabel`),
    manualInput: document.getElementById(`osc${n}ManualInput`),
    manualBtn: document.getElementById(`osc${n}ManualBtn`),
    tableBody: document.getElementById(`osc${n}DivideTableBody`),
    sub1Select: document.getElementById(`osc${n}Sub1Select`),
    sub2Select: document.getElementById(`osc${n}Sub2Select`),
    sub1Target: document.getElementById(`osc${n}Sub1Target`),
    sub2Target: document.getElementById(`osc${n}Sub2Target`),
    sub1TargetResult: document.getElementById(`osc${n}Sub1TargetResult`),
    sub2TargetResult: document.getElementById(`osc${n}Sub2TargetResult`),
  };

  // Sub divisor selects (1-8)
  [local.sub1Select, local.sub2Select].forEach((sel) => {
    for (let d = 1; d <= 8; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `\u00f7${d}`;
      sel.appendChild(opt);
    }
  });
  local.sub1Select.value = osc[n].sub1N;
  local.sub2Select.value = osc[n].sub2N;
  local.sub1Select.addEventListener('change', () => {
    osc[n].sub1N = Number(local.sub1Select.value);
    renderOscTable(n);
  });
  local.sub2Select.addEventListener('change', () => {
    osc[n].sub2N = Number(local.sub2Select.value);
    renderOscTable(n);
  });

  // Target quick-pick selects
  [local.sub1Target, local.sub2Target].forEach((sel) => {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Jump to a target interval\u2026';
    sel.appendChild(placeholder);
    TARGET_INTERVALS.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = t.label;
      sel.appendChild(opt);
    });
  });
  local.sub1Target.addEventListener('change', () => applyTarget(n, 1, local));
  local.sub2Target.addEventListener('change', () => applyTarget(n, 2, local));

  // Manual root entry
  local.manualBtn.addEventListener('click', () => {
    const freq = parseManualRoot(local.manualInput.value);
    if (freq == null) {
      local.rootSub.textContent = 'Couldn\u2019t parse that \u2014 try a note like "A2" or a number like "110".';
      return;
    }
    osc[n].rootFreq = freq;
    pitchLocks[n].reset();
    renderOscRoot(n);
    renderOscTable(n);
  });
  local.manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') local.manualBtn.click();
  });

  // Detect button toggles a per-oscillator detection loop
  local.detectBtn.addEventListener('click', () => {
    if (detectingOsc === n) {
      stopDetecting();
    } else {
      startDetecting(n);
    }
  });

  oscEls[n] = local;
  renderOscRoot(n);
  renderOscTable(n);
}

const oscEls = { 1: null, 2: null };
const pitchLocks = { 1: new PitchLock(), 2: new PitchLock() };
let detectingOsc = null;
let detectTimer = null;

function startDetecting(n) {
  stopDetecting();
  detectingOsc = n;
  pitchLocks[n].reset();
  const local = oscEls[n];
  local.detectBtn.textContent = 'Listening\u2026 play a steady note';
  local.detectBtn.classList.add('detecting');
  detectTimer = setInterval(() => tickDetect(n), 90);
}

function stopDetecting() {
  if (detectTimer) clearInterval(detectTimer);
  detectTimer = null;
  if (detectingOsc != null && oscEls[detectingOsc]) {
    oscEls[detectingOsc].detectBtn.textContent = 'Detect from input';
    oscEls[detectingOsc].detectBtn.classList.remove('detecting');
  }
  detectingOsc = null;
}

function tickDetect(n) {
  if (!captureRunning || !audioEngine.isRunning) {
    stopDetecting();
    return;
  }
  const timeData = audioEngine.getTimeDomainData();
  const buf = timeData[0];
  const db = levelDb(buf);
  const local = oscEls[n];

  // Level meter: -60dB (silent) to -6dB (hot) mapped to 0-100%.
  const pct = Math.max(0, Math.min(100, ((db + 60) / 54) * 100));
  local.levelFill.style.width = `${pct}%`;
  local.levelLabel.textContent = isFinite(db) ? `input level: ${db.toFixed(0)} dB` : 'input level: silent';

  if (db < -50) {
    local.rootSub.textContent = 'Signal too quiet to detect \u2014 check your input device/gain, or type the note in manually.';
    pitchLocks[n].reset();
    return;
  }

  const result = detectPitch(buf, audioEngine.sampleRate);
  const locked = pitchLocks[n].update(result ? result.freq : null);
  if (locked) {
    osc[n].rootFreq = locked;
    renderOscRoot(n);
    renderOscTable(n);
    stopDetecting();
    local.rootSub.textContent += ' \u2014 locked.';
  } else if (result) {
    local.rootSub.textContent = `Hearing ${formatHz(result.freq)}, confirming\u2026`;
  } else {
    local.rootSub.textContent = 'Listening\u2026 play a steady, single note.';
  }
}

function applyTarget(n, subNum, local) {
  const sel = subNum === 1 ? local.sub1Target : local.sub2Target;
  const resultEl = subNum === 1 ? local.sub1TargetResult : local.sub2TargetResult;
  if (sel.value === '') { resultEl.innerHTML = '&nbsp;'; return; }
  const target = TARGET_INTERVALS[Number(sel.value)];
  const best = nearestDivisorForTarget(target.semitonesBelow);
  osc[n][subNum === 1 ? 'sub1N' : 'sub2N'] = best.n;
  (subNum === 1 ? local.sub1Select : local.sub2Select).value = best.n;
  resultEl.innerHTML = `Closest available: <strong>\u00f7${best.n}</strong> (${best.cents > 0 ? '+' : ''}${best.cents.toFixed(0)}\u00a2 from exact)`;
  renderOscTable(n);
}

function renderOscRoot(n) {
  const local = oscEls[n];
  const freq = osc[n].rootFreq;
  if (freq == null) {
    local.rootNum.textContent = '--';
    local.rootUnit.textContent = '';
    return;
  }
  const formatted = formatHz(freq);
  const m = formatted.match(/^([\d.]+) (Hz|kHz)$/);
  local.rootNum.textContent = m ? m[1] : formatted;
  local.rootUnit.textContent = m ? m[2] : '';
}

function renderOscTable(n) {
  const local = oscEls[n];
  const freq = osc[n].rootFreq;
  local.tableBody.innerHTML = '';
  if (freq == null) {
    local.tableBody.innerHTML = '<tr><td colspan="5" style="color:var(--text-dim);font-family:var(--sans)">Set a root above to see the divide table.</td></tr>';
    return;
  }
  const rows = buildDivideTable(freq);
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const isSub1 = row.n === osc[n].sub1N;
    const isSub2 = row.n === osc[n].sub2N;
    if (isSub1) tr.classList.add('is-sub1');
    if (isSub2) tr.classList.add('is-sub2');

    const badges = [];
    if (isSub1) badges.push('<span class="assign-badge sub1">Sub 1</span>');
    if (isSub2) badges.push('<span class="assign-badge sub2">Sub 2</span>');

    tr.innerHTML = `
      <td class="n-col">\u00f7${row.n}</td>
      <td>${formatHz(row.freq)}</td>
      <td class="note-col">${row.note ? row.note.name + row.note.octave : '\u2014'}</td>
      <td class="interval-col">${row.interval.name}${row.n > 1 ? ` (${row.interval.cents > 0 ? '+' : ''}${row.interval.cents.toFixed(0)}\u00a2 from equal temperament)` : ''}</td>
      <td class="assign-col">${badges.join(' ')}</td>
    `;
    local.tableBody.appendChild(tr);
  });
}

// ---------------- Combined ----------------

function buildCombinedIntervalSelect() {
  els.combinedIntervalSelect.innerHTML = '';
  for (let st = -24; st <= 24; st++) {
    const interval = intervalFromRatio(Math.pow(2, st / 12));
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = `${st > 0 ? '+' : ''}${st} semitones (${interval.name})`;
    if (st === combinedSemitoneOffset) opt.selected = true;
    els.combinedIntervalSelect.appendChild(opt);
  }
  els.combinedIntervalSelect.addEventListener('change', () => {
    combinedSemitoneOffset = Number(els.combinedIntervalSelect.value);
    renderCombined();
  });
}

function renderCombined() {
  const root1 = osc[1].rootFreq;
  if (!root1) {
    els.combinedOsc2Freq.textContent = 'Set Osc 1\u2019s root first';
    els.chordList.innerHTML = '<div class="hint">Set Osc 1 and Osc 2\u2019s roots on their tabs to see the combined chord.</div>';
    els.ladderSvg.innerHTML = '';
    return;
  }
  const osc2Freq = root1 * Math.pow(2, combinedSemitoneOffset / 12);
  els.combinedOsc2Freq.textContent = `Osc 2 \u2192 ${formatHz(osc2Freq)}`;

  const voices = [
    { label: 'Osc 1', cls: 'osc1', freq: root1 },
    { label: 'Osc 1 Sub 1', cls: 'osc1', freq: root1 / osc[1].sub1N },
    { label: 'Osc 1 Sub 2', cls: 'osc1', freq: root1 / osc[1].sub2N },
    { label: 'Osc 2', cls: 'osc2', freq: osc2Freq },
    { label: 'Osc 2 Sub 1', cls: 'osc2', freq: osc2Freq / osc[2].sub1N },
    { label: 'Osc 2 Sub 2', cls: 'osc2', freq: osc2Freq / osc[2].sub2N },
  ];
  voices.sort((a, b) => a.freq - b.freq);

  els.chordList.innerHTML = '';
  voices.forEach((v) => {
    const note = v.freq > 0 ? Math.round(69 + 12 * Math.log2(v.freq / 440)) : null;
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = note != null ? `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}` : '\u2014';
    const interval = intervalFromRatio(v.freq / root1);

    const row = document.createElement('div');
    row.className = 'chord-row';
    row.innerHTML = `
      <span class="chord-voice-label ${v.cls}">${v.label}</span>
      <span class="chord-freq">${formatHz(v.freq)}</span>
      <span class="chord-note">${noteName}</span>
      <span class="chord-interval">${interval.name} from Osc 1 root</span>
    `;
    els.chordList.appendChild(row);
  });

  renderLadder(root1, voices);
}

function renderLadder(root1, voices) {
  const svg = els.ladderSvg;
  svg.innerHTML = '';
  const W = 900, H = 320, midY = H / 2;
  const maxN = 8;
  const halfSpan = Math.log2(maxN) + 0.3;
  const xForRatio = (ratio) => W / 2 + (Math.log2(ratio) / halfSpan) * (W / 2 - 40);

  const ns = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  svg.appendChild(el('line', { x1: 0, y1: midY, x2: W, y2: midY, stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 1 }));
  for (let n = 1; n <= maxN; n++) {
    [1, -1].forEach((sign) => {
      if (n === 1 && sign === -1) return;
      const ratio = sign > 0 ? n : 1 / n;
      const x = xForRatio(ratio);
      svg.appendChild(el('line', { x1: x, y1: midY - 12, x2: x, y2: midY + 12, stroke: n === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.25)', 'stroke-width': n === 1 ? 2 : 1 }));
      const label = el('text', { x, y: midY + 28, fill: n === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.5)', 'font-size': 11, 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
      label.textContent = n === 1 ? 'Osc1' : (sign > 0 ? `\u00d7${n}` : `\u00f7${n}`);
      svg.appendChild(label);
    });
  }

  voices.forEach((v) => {
    if (!v.freq || v.freq <= 0) return;
    const ratio = v.freq / root1;
    const x = xForRatio(ratio);
    if (x < 0 || x > W) return;
    const color = v.cls === 'osc1' ? 'var(--accent)' : 'var(--violet)';
    const dot = el('circle', { cx: x, cy: midY, r: 7, fill: color });
    dot.style.filter = `drop-shadow(0 0 4px ${color})`;
    svg.appendChild(dot);
  });
}

// ---------------- Ratio Library (unchanged from v1) ----------------

let activePresetId = RATIO_PRESETS[0].id;

function renderLibrarySidebar() {
  els.librarySidebar.innerHTML = '';
  RATIO_CATEGORIES.forEach((cat) => {
    const items = RATIO_PRESETS.filter((p) => p.category === cat);
    if (items.length === 0) return;
    const label = document.createElement('div');
    label.className = 'library-cat-label';
    label.textContent = cat;
    els.librarySidebar.appendChild(label);
    items.forEach((preset) => {
      const btn = document.createElement('button');
      btn.className = `library-item${preset.id === activePresetId ? ' active' : ''}`;
      btn.textContent = preset.name;
      btn.addEventListener('click', () => {
        activePresetId = preset.id;
        renderLibrarySidebar();
        renderLibraryDetail();
      });
      els.librarySidebar.appendChild(btn);
    });
  });
}

function renderLibraryDetail() {
  const preset = RATIO_PRESETS.find((p) => p.id === activePresetId);
  if (!preset) return;
  const vco2Symbol = preset.vco2Ratio.direction === 'above' ? `\u00d7${preset.vco2Ratio.n}` : `\u00f7${preset.vco2Ratio.n}`;
  els.libraryDetail.innerHTML = `
    <div class="library-detail-cat">${preset.category}</div>
    <h2 class="library-detail-title">${preset.name}</h2>
    <p class="library-detail-blurb">${preset.blurb}</p>
    <div class="divider-grid">
      <div class="divider-osc">
        <h3>VCO1</h3>
        <div class="divider-row"><span>Sub1</span><span>\u00f7${preset.vco1.sub1}</span></div>
        <div class="divider-row"><span>Sub2</span><span>\u00f7${preset.vco1.sub2}</span></div>
      </div>
      <div class="divider-osc">
        <h3>VCO2 (relative to VCO1)</h3>
        <div class="divider-row"><span>Tuning</span><span>${vco2Symbol}</span></div>
        <div class="divider-row"><span>Sub1</span><span>\u00f7${preset.vco2.sub1} of VCO2</span></div>
        <div class="divider-row"><span>Sub2</span><span>\u00f7${preset.vco2.sub2} of VCO2</span></div>
      </div>
    </div>
  `;
}
