// audioEngine.js
// Owns getUserMedia, the AudioContext, the granular AudioWorkletNode, and the
// output/analysis graph. Talks to the DSP running in js/granular-processor.js.

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.stream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.inputAnalyser = null; // taps the live input, for the waveform view
    this.outputAnalyser = null; // taps the wet/dry mix, drives level metering
    this.sampleRate = 0;
    this.onMeter = null; // (msg) => void, called with {writeHeadNorm, readHeadNorm, activeGrainCount}
    this.onGrains = null; // (list) => void
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

    await this.audioCtx.audioWorklet.addModule('js/granular-processor.js');

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

    // A real gain stage ahead of the display analyser — mirrors the "Input
    // gain" control, so cranking it actually makes a quiet source visible on
    // the waveform view, not just louder in the mix.
    this.inputGainNode = this.audioCtx.createGain();
    this.inputGainNode.gain.value = 1;
    this.sourceNode.connect(this.inputGainNode);

    this.inputAnalyser = this.audioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 2048;
    this.inputAnalyser.smoothingTimeConstant = 0;
    this.inputGainNode.connect(this.inputAnalyser);

    this.workletNode = new AudioWorkletNode(this.audioCtx, 'granular-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    this.workletNode.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'meter' && this.onMeter) this.onMeter(msg);
      if (msg.type === 'grains' && this.onGrains) this.onGrains(msg.list);
    };
    this.workletNode.onprocessorerror = (e) => {
      console.error('[granulator] AudioWorkletProcessor error:', e);
    };

    this.sourceNode.connect(this.workletNode);

    this.outputAnalyser = this.audioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 1024;
    this.outputAnalyser.smoothingTimeConstant = 0.6;

    this.workletNode.connect(this.outputAnalyser);
    this.workletNode.connect(this.audioCtx.destination);

    return { sampleRate: this.sampleRate };
  }

  get isRunning() {
    return !!this.audioCtx && this.audioCtx.state === 'running';
  }

  /** Set an AudioParam smoothly (short linear ramp avoids zipper noise on knob drags). */
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
    // Input gain also drives the pre-analyser display gain, so the waveform
    // view visibly reflects it instead of always showing the raw mic level.
    if (name === 'inputGain' && this.inputGainNode) {
      this.inputGainNode.gain.cancelScheduledValues(now);
      this.inputGainNode.gain.setValueAtTime(this.inputGainNode.gain.value, now);
      this.inputGainNode.gain.linearRampToValueAtTime(clamped, now + rampSeconds);
    }
  }

  /** Immediate, unramped set — used by the modulation engine (called every animation frame). */
  setParamImmediate(name, value) {
    if (!this.workletNode) return;
    const param = this.workletNode.parameters.get(name);
    if (!param) return;
    const clamped = Math.max(param.minValue, Math.min(param.maxValue, value));
    param.setValueAtTime(clamped, this.audioCtx.currentTime);
  }

  getParamRange(name) {
    if (!this.workletNode) return { min: 0, max: 1 };
    const param = this.workletNode.parameters.get(name);
    return param ? { min: param.minValue, max: param.maxValue } : { min: 0, max: 1 };
  }

  send(type, value) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type, value });
  }

  /**
   * Injects decoded PCM directly into the worklet's active record buffer —
   * writes it straight in rather than "playing" it into the buffer in real
   * time, so a 10-second file loads instantly. dataL/dataR are
   * Float32Arrays; dataR may be omitted for mono material (the worklet
   * duplicates dataL). Uses a regular (cloning) postMessage rather than a
   * Transferable — the caller typically still needs dataL afterward (e.g.
   * to draw the static waveform), and at these sizes (a few MB at most for
   * a 10s stereo clip) the clone cost is negligible next to the convenience
   * of not having to worry about use-after-transfer.
   */
  loadSample(dataL, dataR, numSamples) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type: 'loadSample', dataL, dataR: dataR || null, numSamples });
  }

  getInputWaveform(target) {
    if (!this.inputAnalyser) return;
    this.inputAnalyser.getFloatTimeDomainData(target);
  }

  getOutputLevel() {
    if (!this.outputAnalyser) return 0;
    const buf = new Float32Array(this.outputAnalyser.fftSize);
    this.outputAnalyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
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
