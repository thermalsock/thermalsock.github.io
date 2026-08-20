// audioEngine.js
// Owns getUserMedia, AudioContext, and per-channel AnalyserNodes. Same
// pattern as the rest of the site's apps (Ambient Bloom, Granulator) —
// exposes raw time-domain sample buffers, picking whichever channel is
// louder each frame rather than averaging (averaging can partially cancel
// a real signal if the two channels aren't in phase).

export class AudioEngine {
  constructor({ fftSize = 2048 } = {}) {
    this.fftSize = fftSize;
    this.audioCtx = null;
    this.stream = null;
    this.sourceNode = null;
    this.splitter = null;
    this.analysers = [];
    this.channelCount = 0;
    this.sampleRate = 0;
    this._timeBuffers = [];
  }

  static async listInputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  async start(deviceId = null) {
    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
      },
      video: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    this.sampleRate = this.audioCtx.sampleRate;
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

    const trackSettings = this.stream.getAudioTracks()[0]?.getSettings?.() || {};
    const trackLabel = this.stream.getAudioTracks()[0]?.label || '';
    this.channelCount = trackSettings.channelCount || 2;

    this.splitter = this.audioCtx.createChannelSplitter(2);
    this.sourceNode.connect(this.splitter);

    this.analysers = [];
    this._timeBuffers = [];
    const channelsToUse = Math.min(this.channelCount, 2) || 1;
    for (let ch = 0; ch < channelsToUse; ch++) {
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = this.fftSize;
      analyser.smoothingTimeConstant = 0;
      this.splitter.connect(analyser, ch);
      this.analysers.push(analyser);
      this._timeBuffers.push(new Float32Array(analyser.fftSize));
    }

    return { sampleRate: this.sampleRate, channelCount: this.analysers.length, deviceLabel: trackLabel };
  }

  getTimeDomainData() {
    for (let ch = 0; ch < this.analysers.length; ch++) {
      this.analysers[ch].getFloatTimeDomainData(this._timeBuffers[ch]);
    }
    return this._timeBuffers;
  }

  get isRunning() {
    return !!this.audioCtx && this.audioCtx.state === 'running';
  }

  stop() {
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; }
    this.analysers = [];
    this._timeBuffers = [];
  }
}

/** Picks whichever channel is louder this frame — see header note. */
export function pickLouderChannel(timeData) {
  if (timeData.length === 1) return timeData[0];
  let sumA = 0, sumB = 0;
  const a = timeData[0], b = timeData[1];
  for (let i = 0; i < a.length; i++) { sumA += a[i] * a[i]; sumB += b[i] * b[i]; }
  return sumB > sumA ? b : a;
}
