export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.stream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.sampleRate = 0;
    this.onMeter = null;
    this.onGrains = null;
  }
  static async listInputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === "audioinput");
  }
  async start(deviceId = null) {
    const constraints = {
      audio: {
        deviceId: deviceId ? {
          exact: deviceId
        } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: {
          ideal: 2
        }
      },
      video: false
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext);
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
    this.sampleRate = this.audioCtx.sampleRate;
    await this.audioCtx.audioWorklet.addModule("js/granular-processor.js");
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.inputGainNode = this.audioCtx.createGain();
    this.inputGainNode.gain.value = 1;
    this.sourceNode.connect(this.inputGainNode);
    this.inputAnalyser = this.audioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 2048;
    this.inputAnalyser.smoothingTimeConstant = 0;
    this.inputGainNode.connect(this.inputAnalyser);
    this.workletNode = new AudioWorkletNode(this.audioCtx, "granular-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [ 2 ]
    });
    this.workletNode.port.onmessage = e => {
      const msg = e.data;
      if (msg.type === "meter" && this.onMeter) this.onMeter(msg);
      if (msg.type === "grains" && this.onGrains) this.onGrains(msg.list);
    };
    this.workletNode.onprocessorerror = e => {
      console.error("[granulator] AudioWorkletProcessor error:", e);
    };
    this.sourceNode.connect(this.workletNode);
    this.outputAnalyser = this.audioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 1024;
    this.outputAnalyser.smoothingTimeConstant = .6;
    this.workletNode.connect(this.outputAnalyser);
    this.workletNode.connect(this.audioCtx.destination);
    return {
      sampleRate: this.sampleRate
    };
  }
  get isRunning() {
    return !!this.audioCtx && this.audioCtx.state === "running";
  }
  setParam(name, value, rampSeconds = .03) {
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
    if (name === "inputGain" && this.inputGainNode) {
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
  getParamRange(name) {
    if (!this.workletNode) return {
      min: 0,
      max: 1
    };
    const param = this.workletNode.parameters.get(name);
    return param ? {
      min: param.minValue,
      max: param.maxValue
    } : {
      min: 0,
      max: 1
    };
  }
  send(type, value) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({
      type: type,
      value: value
    });
  }
  loadSample(dataL, dataR, numSamples) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({
      type: "loadSample",
      dataL: dataL,
      dataR: dataR || null,
      numSamples: numSamples
    });
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
      this.stream.getTracks().forEach(t => t.stop());
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