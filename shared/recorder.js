/* Thermalsock Labs — shared output recorder.
 *
 * Neither Granulator nor Spectral Mutation Lab could capture their own
 * output. Both are live processors you can spend twenty minutes finding a
 * sound on, and the only way to keep it was to have had a DAW recording the
 * whole time.
 *
 * This taps any AudioNode and writes a 16-bit WAV. WAV rather than
 * MediaRecorder's webm/opus on purpose: the output of these tools is meant to
 * go back into a DAW, and lossy-compressing a grain cloud or a frozen
 * spectrum before it gets there defeats the point.
 *
 * Capture uses an AudioWorklet where available, registered from a Blob URL so
 * there's no extra file to ship, and falls back to ScriptProcessor (deprecated
 * but universally supported) where it isn't.
 */
(function (global) {
  'use strict';

  var WORKLET_SOURCE = [
    'class TapProcessor extends AudioWorkletProcessor {',
    '  process(inputs) {',
    '    const input = inputs[0];',
    '    if (input && input.length) {',
    '      // Copy: the render quantum buffers are reused between calls.',
    '      const chans = [];',
    '      for (let c = 0; c < input.length; c++) chans.push(new Float32Array(input[c]));',
    '      this.port.postMessage(chans);',
    '    }',
    '    return true;',
    '  }',
    '}',
    'registerProcessor("ts-tap", TapProcessor);'
  ].join('\n');

  function Recorder(audioContext, sourceNode) {
    this.ctx = audioContext;
    this.source = sourceNode;
    this.recording = false;
    this.channels = [[], []];
    this.frames = 0;
    this.node = null;
    this.startedAt = 0;
  }

  Recorder.prototype._collect = function (chanData) {
    if (!this.recording) return;
    var left = chanData[0];
    var right = chanData.length > 1 ? chanData[1] : chanData[0];
    if (!left || !left.length) return;
    this.channels[0].push(left);
    this.channels[1].push(right);
    this.frames += left.length;
  };

  Recorder.prototype.start = function () {
    var self = this;
    if (this.recording) return Promise.resolve();

    this.channels = [[], []];
    this.frames = 0;
    this.recording = true;
    this.startedAt = (global.performance || Date).now();

    function useScriptProcessor() {
      var node = self.ctx.createScriptProcessor(4096, 2, 2);
      node.onaudioprocess = function (e) {
        self._collect([
          new Float32Array(e.inputBuffer.getChannelData(0)),
          new Float32Array(e.inputBuffer.getChannelData(e.inputBuffer.numberOfChannels > 1 ? 1 : 0))
        ]);
      };
      self.source.connect(node);
      // A ScriptProcessor only pulls audio if it's connected to something.
      // Zero-gain sink so the tap doesn't double the signal at the speakers.
      var sink = self.ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink);
      sink.connect(self.ctx.destination);
      self.node = node;
      self._sink = sink;
    }

    if (self.ctx.audioWorklet) {
      var url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      return self.ctx.audioWorklet.addModule(url).then(function () {
        URL.revokeObjectURL(url);
        var node = new AudioWorkletNode(self.ctx, 'ts-tap', { numberOfOutputs: 0 });
        node.port.onmessage = function (e) { self._collect(e.data); };
        self.source.connect(node);
        self.node = node;
      }).catch(function () {
        URL.revokeObjectURL(url);
        useScriptProcessor();
      });
    }

    useScriptProcessor();
    return Promise.resolve();
  };

  Recorder.prototype.stop = function () {
    this.recording = false;
    if (this.node) {
      try { this.source.disconnect(this.node); } catch (e) { /* already gone */ }
      if (this.node.port) this.node.port.onmessage = null;
      if (this.node.onaudioprocess) this.node.onaudioprocess = null;
      try { this.node.disconnect(); } catch (e) { /* already gone */ }
      this.node = null;
    }
    if (this._sink) {
      try { this._sink.disconnect(); } catch (e) { /* already gone */ }
      this._sink = null;
    }
  };

  Recorder.prototype.durationSeconds = function () {
    return this.ctx.sampleRate ? this.frames / this.ctx.sampleRate : 0;
  };

  function flatten(chunks, total) {
    var out = new Float32Array(total);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      out.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    return out;
  }

  // Interleaved 16-bit PCM in a standard 44-byte RIFF header.
  Recorder.prototype.toWavBlob = function () {
    var sampleRate = this.ctx.sampleRate;
    var left = flatten(this.channels[0], this.frames);
    var right = flatten(this.channels[1], this.frames);
    var frames = this.frames;
    if (!frames) return null;

    var bytesPerSample = 2;
    var blockAlign = 2 * bytesPerSample;
    var dataBytes = frames * blockAlign;
    var buffer = new ArrayBuffer(44 + dataBytes);
    var view = new DataView(buffer);

    function writeString(offset, str) {
      for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);          // PCM chunk size
    view.setUint16(20, 1, true);           // format = PCM
    view.setUint16(22, 2, true);           // channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);          // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataBytes, true);

    var offset = 44;
    for (var i = 0; i < frames; i++) {
      // Clamp before scaling — a grain cloud can overshoot 1.0 and wrapping
      // would turn that into loud digital noise rather than a soft clip.
      var l = Math.max(-1, Math.min(1, left[i]));
      var r = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7FFF, true);
      view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7FFF, true);
      offset += 4;
    }
    return new Blob([view], { type: 'audio/wav' });
  };

  Recorder.prototype.download = function (basename) {
    var blob = this.toWavBlob();
    if (!blob) return false;
    var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (basename || 'thermalsock') + '-' + stamp + '.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  };

  global.TSRecorder = {
    create: function (ctx, sourceNode) { return new Recorder(ctx, sourceNode); }
  };
})(window);
