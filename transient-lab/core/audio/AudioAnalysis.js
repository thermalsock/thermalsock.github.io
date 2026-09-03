export const audioAnalysisState = {
  supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  connected: false,
  deviceLabel: null,
  selectedDeviceId: null,
  error: null,
  frozen: false,
  availableDevices: [],
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
    audioAnalysisState.availableDevices = devices.filter(d => d.kind === "audioinput").map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Input ${i + 1}`
    }));
  } catch (e) {}
}

function teardown() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  analyser = null;
}

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
        ...deviceId ? {
          deviceId: {
            exact: deviceId
          }
        } : {}
      }
    });
    currentStream = stream;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext);
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = .75;
    source.connect(analyser);
    timeDomainData = new Float32Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    const track = stream.getAudioTracks()[0];
    audioAnalysisState.deviceLabel = track ? track.label || "Audio input" : "Audio input";
    audioAnalysisState.selectedDeviceId = deviceId || (track && track.getSettings ? track.getSettings().deviceId : null);
    audioAnalysisState.connected = true;
    audioAnalysisState.error = null;
    await refreshDeviceList();
  } catch (e) {
    audioAnalysisState.connected = false;
    audioAnalysisState.error = e && (e.name || e.message) || String(e);
  }
}

export async function initAudioAnalysis() {
  await refreshDeviceList();
  await connectAudioInput(null);
}

export function getWaveform() {
  if (!analyser) return null;
  if (audioAnalysisState.frozen && frozenSnapshot) return frozenSnapshot;
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