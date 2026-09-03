export class AudioEngine {
  constructor({fftSize: fftSize = 2048} = {}) {
    this.fftSize = fftSize;
    this.audioCtx = null;
    this.stream = null;
    this.sourceNode = null;
    this.splitter = null;
    this.gainNodes = [];
    this.analysers = [];
    this.channelCount = 0;
    this.sampleRate = 0;
    this._timeBuffers = [];
    this._freqBuffers = [];
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
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
    this.sampleRate = this.audioCtx.sampleRate;
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    const trackSettings = this.stream.getAudioTracks()[0]?.getSettings?.() || {};
    console.log("[oscilloscope] Track settings:", trackSettings);
    console.log("[oscilloscope] Track label:", this.stream.getAudioTracks()[0]?.label);
    this.channelCount = trackSettings.channelCount || 2;
    this.splitter = this.audioCtx.createChannelSplitter(2);
    this.sourceNode.connect(this.splitter);
    this.analysers = [];
    this.gainNodes = [];
    this._timeBuffers = [];
    this._freqBuffers = [];
    const channelsToUse = Math.min(this.channelCount, 2) || 1;
    for (let ch = 0; ch < channelsToUse; ch++) {
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = 1;
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = this.fftSize;
      analyser.smoothingTimeConstant = 0;
      this.splitter.connect(gainNode, ch);
      gainNode.connect(analyser);
      this.gainNodes.push(gainNode);
      this.analysers.push(analyser);
      this._timeBuffers.push(new Float32Array(analyser.fftSize));
      this._freqBuffers.push(new Float32Array(analyser.frequencyBinCount));
    }
    return {
      sampleRate: this.sampleRate,
      channelCount: this.analysers.length
    };
  }
  compareChannels() {
    if (this.analysers.length < 2) return null;
    const bufs = this.getTimeDomainData();
    const [a, b] = bufs;
    let maxDiff = 0;
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(a[i] - b[i]);
      if (diff > maxDiff) maxDiff = diff;
      sumA += a[i];
      sumB += b[i];
      sumAB += a[i] * b[i];
      sumA2 += a[i] * a[i];
      sumB2 += b[i] * b[i];
    }
    const meanA = sumA / n, meanB = sumB / n;
    const cov = sumAB / n - meanA * meanB;
    const stdA = Math.sqrt(sumA2 / n - meanA * meanA);
    const stdB = Math.sqrt(sumB2 / n - meanB * meanB);
    const correlation = stdA > 0 && stdB > 0 ? cov / (stdA * stdB) : null;
    return {
      maxDiff: maxDiff,
      correlation: correlation,
      likelyIdentical: maxDiff < 5e-4
    };
  }
  static computeStereoMetrics(a, b) {
    const n = Math.min(a.length, b.length);
    if (n === 0) return null;
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0, sumMid2 = 0, sumSide2 = 0;
    for (let i = 0; i < n; i++) {
      const av = a[i], bv = b[i];
      sumA += av;
      sumB += bv;
      sumAB += av * bv;
      sumA2 += av * av;
      sumB2 += bv * bv;
      const mid = (av + bv) * .5, side = (av - bv) * .5;
      sumMid2 += mid * mid;
      sumSide2 += side * side;
    }
    const meanA = sumA / n, meanB = sumB / n;
    const cov = sumAB / n - meanA * meanB;
    const stdA = Math.sqrt(Math.max(0, sumA2 / n - meanA * meanA));
    const stdB = Math.sqrt(Math.max(0, sumB2 / n - meanB * meanB));
    const correlation = stdA > 1e-9 && stdB > 1e-9 ? Math.max(-1, Math.min(1, cov / (stdA * stdB))) : null;
    const midRms = Math.sqrt(sumMid2 / n);
    const sideRms = Math.sqrt(sumSide2 / n);
    const widthPercent = midRms + sideRms > 1e-9 ? 100 * sideRms / (midRms + sideRms) : 0;
    const varA = stdA * stdA, varB = stdB * stdB;
    const phaseAngleDeg = .5 * Math.atan2(2 * cov, varA - varB) * (180 / Math.PI);
    return {
      correlation: correlation,
      widthPercent: widthPercent,
      phaseAngleDeg: phaseAngleDeg,
      midRms: midRms,
      sideRms: sideRms
    };
  }
  setGain(value) {
    this.gainNodes.forEach(g => {
      g.gain.value = value;
    });
  }
  getTimeDomainData() {
    for (let ch = 0; ch < this.analysers.length; ch++) {
      this.analysers[ch].getFloatTimeDomainData(this._timeBuffers[ch]);
    }
    return this._timeBuffers;
  }
  getFrequencyData() {
    for (let ch = 0; ch < this.analysers.length; ch++) {
      this.analysers[ch].getFloatFrequencyData(this._freqBuffers[ch]);
    }
    return this._freqBuffers;
  }
  get minDecibels() {
    return this.analysers[0]?.minDecibels ?? -100;
  }
  get maxDecibels() {
    return this.analysers[0]?.maxDecibels ?? -30;
  }
  get frequencyBinCount() {
    return this.analysers[0]?.frequencyBinCount ?? 0;
  }
  get isRunning() {
    return !!this.audioCtx && this.audioCtx.state === "running";
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
    this.analysers = [];
    this.gainNodes = [];
    this._timeBuffers = [];
    this._freqBuffers = [];
  }
}