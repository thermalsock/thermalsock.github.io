// audioEngine.js
// Owns getUserMedia, the AudioContext, and the spectral AudioWorkletNode.
// Structurally the same pattern as the Granulator's audio engine — kept
// consistent across Thermalsock Labs apps rather than reinvented per app.

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.stream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.inputGainNode = null;
    this.inputAnalyser = null; // pre-processing tap, for an optional input-level readout
    this.outputAnalyser = null;
    this.sampleRate = 0;
    this.onMeter = null; // (msg) => void — {spectrum: Float32Array, hasFrozenA, hasFrozenB, cpuLoad}
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

    await this.audioCtx.audioWorklet.addModule('js/spectral-processor.js');

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

    this.inputGainNode = this.audioCtx.createGain();
    this.inputGainNode.gain.value = 1;
    this.sourceNode.connect(this.inputGainNode);

    this.inputAnalyser = this.audioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 1024;
    this.inputGainNode.connect(this.inputAnalyser);

    this.workletNode = new AudioWorkletNode(this.audioCtx, 'spectral-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    this.workletNode.port.onmessage = (e) => {
      if (e.data.type === 'meter' && this.onMeter) this.onMeter(e.data);
    };
    this.workletNode.onprocessorerror = (e) => {
      console.error('[spectral-mutation-lab] AudioWorkletProcessor error:', e);
    };

    this.sourceNode.connect(this.workletNode);

    // Sample playback path. Granulator could load a file; this app was live
    // input only, despite sharing the same worklet architecture. A loaded
    // buffer feeds the same input gain node, so every mutation stage works
    // on it identically — and swapping back to live input is just a
    // disconnect.
    this.samplePlayer = null;
    this.usingSample = false;

    this.outputAnalyser = this.audioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 1024;
    this.outputAnalyser.smoothingTimeConstant = 0.6;

    this.workletNode.connect(this.outputAnalyser);
    this.workletNode.connect(this.audioCtx.destination);

    return { sampleRate: this.sampleRate };
  }

  /**
   * Play a decoded AudioBuffer into the mutation chain instead of live input.
   * Loops, because every stage here (freeze, smear, scatter) is about
   * sustained evolution — a one-shot would be over before you'd finished
   * turning a knob.
   */
  playSample(audioBuffer) {
    if (!this.audioCtx) return;
    this.stopSample();
    const src = this.audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = true;
    src.connect(this.inputGainNode);
    src.connect(this.workletNode);
    src.start();
    this.samplePlayer = src;
    this.usingSample = true;
    // Mute live input while the sample plays, otherwise both sum together.
    try { this.sourceNode.disconnect(this.workletNode); } catch (e) { /* already detached */ }
    try { this.sourceNode.disconnect(this.inputGainNode); } catch (e) { /* already detached */ }
  }

  stopSample() {
    if (this.samplePlayer) {
      try { this.samplePlayer.stop(); } catch (e) { /* already stopped */ }
      try { this.samplePlayer.disconnect(); } catch (e) { /* already gone */ }
      this.samplePlayer = null;
    }
    this.usingSample = false;
  }

  /** Return to live input after a sample has been loaded. */
  useLiveInput() {
    this.stopSample();
    if (!this.sourceNode) return;
    try { this.sourceNode.connect(this.inputGainNode); } catch (e) { /* already connected */ }
    try { this.sourceNode.connect(this.workletNode); } catch (e) { /* already connected */ }
  }

  get isRunning() {
    return !!this.audioCtx && this.audioCtx.state === 'running';
  }

  setParam(name, value, rampSeconds = 0.03) {
    if (!this.workletNode) return;
    const param = this.workletNode.parameters.get(name);
    if (!param) return;
    const now = this.audioCtx.currentTime;
    const clamped = Math.max(param.minValue, Math.min(param.maxValue, value));
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(clamped, now + rampSeconds);
    } catch (err) {
      param.value = clamped;
    }
    if (name === 'inputGain' && this.inputGainNode) {
      this.inputGainNode.gain.cancelScheduledValues(now);
      this.inputGainNode.gain.setValueAtTime(this.inputGainNode.gain.value, now);
      this.inputGainNode.gain.linearRampToValueAtTime(clamped, now + rampSeconds);
    }
  }

  setParamImmediate(name, value) {
    if (!this.workletNode) return;
    const param = this.workletNode.parameters.get(name);
    if (!param) return;
    const clamped = Math.max(param.minValue, Math.min(param.maxValue, value));
    param.setValueAtTime(clamped, this.audioCtx.currentTime);
  }

  send(type, value) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type, value });
  }

  getInputWaveform(target) {
    if (!this.inputAnalyser) return;
    this.inputAnalyser.getFloatTimeDomainData(target);
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.workletNode = null;
    this.inputGainNode = null;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
  }
}
