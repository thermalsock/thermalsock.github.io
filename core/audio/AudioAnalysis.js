// AudioAnalysis.js
//
// Captures real audio input (getUserMedia) and exposes it as raw
// waveform (oscilloscope) and frequency (EQ/spectrum) data via a
// standard Web Audio AnalyserNode.
//
// getUserMedia() with no deviceId constraint grabs whatever the OS
// considers the DEFAULT audio input -- which may well be a laptop's
// built-in mic, not an interface like the MiniFuse, with no obvious
// sign anything is wrong (the app just shows silence, which looks
// identical to "not connected"). This is why device selection and
// real error surfacing exist here, not just a single auto-connect
// call: "no audio input" was previously indistinguishable between
// "permission denied", "no signal on the right device", and "signal
// present on the WRONG device" -- all three need different fixes.

export const audioAnalysisState = {
  supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  connected: false,
  deviceLabel: null,
  selectedDeviceId: null,
  error: null,
  frozen: false,
  availableDevices: [], // [{ deviceId, label }], audioinput only
  deviceListOpen: false,
  scopeMaximized: false
};

let audioCtx = null;
let analyser = null;
let timeDomainData = null;
let freqData = null;
let frozenSnapshot = null;
let currentStream = null;

export async function refreshDeviceList() {
  if (!audioAnalysisState.supported || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioAnalysisState.availableDevices = devices
      .filter(d => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Input ${i + 1}` }));
  } catch (e) {
    // Leave the previous list in place rather than clearing it on a
    // transient enumeration failure.
  }
}

// Tears down any existing capture before starting a new one -- needed
// when switching devices, not just on first connect, so a stale
// stream/analyser from a previous device doesn't linger.
function teardown() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  analyser = null;
}

// deviceId: pass a specific device's id to connect to that device
// exactly, or omit/null for the OS default input.
export async function connectAudioInput(deviceId = null) {
  if (!audioAnalysisState.supported) {
    audioAnalysisState.error = "Web Audio input is not supported in this environment.";
    return;
  }

  teardown();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
      }
    });

    currentStream = stream;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    timeDomainData = new Float32Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    const track = stream.getAudioTracks()[0];
    audioAnalysisState.deviceLabel = track ? track.label || "Audio input" : "Audio input";
    audioAnalysisState.selectedDeviceId = deviceId || (track && track.getSettings ? track.getSettings().deviceId : null);
    audioAnalysisState.connected = true;
    audioAnalysisState.error = null;

    // Device labels are only populated by the browser AFTER permission
    // has been granted at least once -- refreshing now (rather than
    // only at page load) means the device picker shows real names
    // instead of blank/generic ones the first time someone opens it.
    await refreshDeviceList();
  } catch (e) {
    audioAnalysisState.connected = false;
    // Surfaced directly in the UI now (see AnalysisBar.js) instead of
    // being silently swallowed -- "NotAllowedError" (permission denied)
    // and "NotFoundError" (no such device / nothing plugged in) need
    // genuinely different fixes from the user, so the raw error name
    // is worth showing rather than a single generic message.
    audioAnalysisState.error = (e && (e.name || e.message)) || String(e);
  }
}

export async function initAudioAnalysis() {
  await refreshDeviceList(); // populate whatever labels/count are visible pre-permission
  await connectAudioInput(null);
}

export function getWaveform() {
  if (!analyser) return null;
  if (audioAnalysisState.frozen && frozenSnapshot) return frozenSnapshot;
  // getFloatTimeDomainData, NOT getByteTimeDomainData: the byte
  // version only has 256 discrete amplitude levels, which is the
  // actual root cause of the "staircase" look on a quiet signal --
  // amplifying a signal that only spans a handful of those 256 levels
  // can't recover detail that was never captured. Float gives full
  // 32-bit precision (range -1.0 to 1.0), so a quiet signal is still
  // captured with its real shape intact, not pre-quantized away.
  analyser.getFloatTimeDomainData(timeDomainData);
  return timeDomainData;
}

export function getSpectrum() {
  if (!analyser) return null;
  analyser.getByteFrequencyData(freqData);
  return freqData;
}

export function getSampleRate() {
  return audioCtx ? audioCtx.sampleRate : 44100;
}

export function toggleSnapshot() {
  if (!analyser) return;
  if (!audioAnalysisState.frozen) {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    frozenSnapshot = buf;
    audioAnalysisState.frozen = true;
  } else {
    audioAnalysisState.frozen = false;
  }
}

export function toggleDeviceList() {
  audioAnalysisState.deviceListOpen = !audioAnalysisState.deviceListOpen;
}

export function closeDeviceList() {
  audioAnalysisState.deviceListOpen = false;
}

export async function selectDevice(deviceId) {
  audioAnalysisState.deviceListOpen = false;
  await connectAudioInput(deviceId);
}

export function toggleScopeMaximized() {
  audioAnalysisState.scopeMaximized = !audioAnalysisState.scopeMaximized;
}

export function closeScopeMaximized() {
  audioAnalysisState.scopeMaximized = false;
}
