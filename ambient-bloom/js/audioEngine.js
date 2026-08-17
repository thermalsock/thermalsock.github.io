// audioEngine.js
// Owns getUserMedia, AudioContext, and per-channel AnalyserNodes.
// Exposes raw time-domain + frequency-domain sample buffers for two channels (L/R).

export class AudioEngine {
  constructor({ fftSize = 2048 } = {}) {
    this.fftSize = fftSize;
    this.audioCtx = null;
    this.stream = null;
    this.sourceNode = null;
    this.splitter = null;
    this.gainNodes = []; // [chA, chB] — real pre-analysis amplification, not cosmetic
    this.analysers = []; // [chA, chB]
    this.channelCount = 0;
    this.sampleRate = 0;

    // Reusable buffers, allocated once analysers exist.
    this._timeBuffers = [];
    this._freqBuffers = [];
  }

  static async listInputDevices() {
    // Device labels are only populated after permission has been granted at least once.
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  async start(deviceId = null) {
    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        // We want the raw signal, not the browser "helpfully" cleaning it up.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
      },
      video: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Safari requires the AudioContext to be created/resumed inside a user-gesture
    // handler; caller is expected to invoke start() from a click handler.
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.sampleRate = this.audioCtx.sampleRate;
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

    const trackSettings = this.stream.getAudioTracks()[0]?.getSettings?.() || {};
    console.log('[oscilloscope] Track settings:', trackSettings);
    console.log('[oscilloscope] Track label:', this.stream.getAudioTracks()[0]?.label);
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
      analyser.smoothingTimeConstant = 0; // we want raw samples, not the built-in smoothing

      // splitter -> gain -> analyser, so "gain" genuinely amplifies the signal
      // that triggering and measurements see, not just what gets drawn.
      this.splitter.connect(gainNode, ch);
      gainNode.connect(analyser);

      this.gainNodes.push(gainNode);
      this.analysers.push(analyser);
      this._timeBuffers.push(new Float32Array(analyser.fftSize));
      this._freqBuffers.push(new Float32Array(analyser.frequencyBinCount));
    }

    return {
      sampleRate: this.sampleRate,
      channelCount: this.analysers.length,
    };
  }

  /**
   * Diagnostic: compares the two channels' current time-domain buffers to
   * determine whether they're carrying genuinely different signals or an
   * identical/near-identical one — useful for telling a code bug apart from
   * a device/OS routing issue (e.g. a "stereo" stream that's actually a mono
   * signal duplicated to both channels upstream of the browser).
   * Returns null if fewer than 2 channels are active.
   */
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
      sumA += a[i]; sumB += b[i];
      sumAB += a[i] * b[i];
      sumA2 += a[i] * a[i]; sumB2 += b[i] * b[i];
    }
    const meanA = sumA / n, meanB = sumB / n;
    const cov = sumAB / n - meanA * meanB;
    const stdA = Math.sqrt(sumA2 / n - meanA * meanA);
    const stdB = Math.sqrt(sumB2 / n - meanB * meanB);
    const correlation = stdA > 0 && stdB > 0 ? cov / (stdA * stdB) : null;
    return { maxDiff, correlation, likelyIdentical: maxDiff < 0.0005 };
  }

  /** Set input gain (applied to the actual signal, before trigger/measurement/draw). */
  setGain(value) {
    this.gainNodes.forEach((g) => {
      g.gain.value = value;
    });
  }

  // Returns an array of Float32Array, one per channel, each fftSize samples long.
  // Values are in [-1, 1] (Web Audio's normalized float format).
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

  /** dB range the analyser's frequency data is scaled to (used to map to pixel Y). */
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
    return !!this.audioCtx && this.audioCtx.state === 'running';
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
    this.analysers = [];
    this.gainNodes = [];
    this._timeBuffers = [];
    this._freqBuffers = [];
  }
}
