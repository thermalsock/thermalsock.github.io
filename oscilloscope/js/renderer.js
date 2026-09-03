export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.theme = null;
    this._flickerPhase = 0;
    this.persistCanvas = document.createElement("canvas");
    this.persistCtx = this.persistCanvas.getContext("2d");
    this.spectrogramCanvas = document.createElement("canvas");
    this.spectrogramCtx = this.spectrogramCanvas.getContext("2d");
    this.resize();
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.persistCanvas.width = this.canvas.width;
    this.persistCanvas.height = this.canvas.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.persistCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.spectrogramCanvas.width = Math.max(1, Math.round(this.width));
    this.spectrogramCanvas.height = Math.max(1, Math.round(this.height));
    if (this.theme) {
      this.spectrogramCtx.fillStyle = this.theme.background;
      this.spectrogramCtx.fillRect(0, 0, this.spectrogramCanvas.width, this.spectrogramCanvas.height);
    }
  }
  setTheme(theme) {
    this.theme = theme;
  }
  _hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return [ bigint >> 16 & 255, bigint >> 8 & 255, bigint & 255 ];
  }
  _phosphorColor(norm) {
    const [r0, g0, b0] = this._hexToRgb(this.theme.traceColors[0]);
    if (norm <= .5) {
      const t = norm / .5;
      return [ r0 * t, g0 * t, b0 * t ];
    }
    const t = (norm - .5) / .5;
    return [ r0 + (255 - r0) * t, g0 + (255 - g0) * t, b0 + (255 - b0) * t ];
  }
  _drawGraticule() {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    const divsX = 10;
    const divsY = 8;
    const stepX = width / divsX;
    const stepY = height / divsY;
    ctx.save();
    ctx.strokeStyle = theme.graticuleMinorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < divsX; i++) {
      const x = Math.round(i * stepX) + .5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let j = 1; j < divsY; j++) {
      const y = Math.round(j * stepY) + .5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = theme.graticuleColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = Math.round(width / 2) + .5;
    const cy = Math.round(height / 2) + .5;
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.beginPath();
    const tick = 4;
    for (let i = 1; i < divsX; i++) {
      const x = Math.round(i * stepX) + .5;
      ctx.moveTo(x, cy - tick);
      ctx.lineTo(x, cy + tick);
    }
    for (let j = 1; j < divsY; j++) {
      const y = Math.round(j * stepY) + .5;
      ctx.moveTo(cx - tick, y);
      ctx.lineTo(cx + tick, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  _fadePersistence() {
    const {persistCtx: persistCtx, width: width, height: height, theme: theme} = this;
    const fadeAlpha = 1 - theme.persistence;
    persistCtx.save();
    persistCtx.globalCompositeOperation = "destination-out";
    persistCtx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    persistCtx.fillRect(0, 0, width, height);
    persistCtx.restore();
  }
  _makeGradient(ctx, stops) {
    const grad = ctx.createLinearGradient(0, 0, this.width, 0);
    stops.forEach((color, i) => grad.addColorStop(i / (stops.length - 1), color));
    return grad;
  }
  _strokeTrace(ctx, points, colorOrStops, glow) {
    const isGradient = Array.isArray(colorOrStops);
    const strokeStyle = isGradient ? this._makeGradient(ctx, colorOrStops) : colorOrStops;
    const glowColor = isGradient ? colorOrStops[Math.floor(colorOrStops.length / 2)] : colorOrStops;
    const coreWidth = this.theme.traceLineWidth || 1.4;
    if (glow) {
      if (this.theme.extraBloom) {
        ctx.save();
        ctx.globalAlpha = .5;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = this.theme.glowStrength * 2.2;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = coreWidth + .2;
        ctx.beginPath();
        points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = this.theme.glowStrength;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = coreWidth + .2;
      ctx.beginPath();
      points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = coreWidth;
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();
    ctx.restore();
  }
  drawTimeDomain(channelBuffers, {verticalScale: verticalScale = 1, overlayBlend: overlayBlend = false} = {}) {
    const {persistCtx: persistCtx, width: width, height: height, theme: theme} = this;
    this._fadePersistence();
    channelBuffers.forEach((buf, chIdx) => {
      if (!buf) return;
      const color = chIdx === 0 && theme.traceGradient ? theme.traceGradient : theme.traceColors[chIdx % theme.traceColors.length];
      const points = [];
      const midY = height / 2;
      const ampScale = height / 2 * .9 * verticalScale;
      const n = buf.length;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * width;
        const y = midY - buf[i] * ampScale;
        points.push([ x, y ]);
      }
      if (overlayBlend && chIdx > 0) {
        persistCtx.save();
        persistCtx.globalAlpha = .55;
        persistCtx.globalCompositeOperation = "lighter";
        this._strokeTrace(persistCtx, points, color, theme.glow);
        persistCtx.restore();
      } else {
        this._strokeTrace(persistCtx, points, color, theme.glow);
      }
    });
    this._composite();
  }
  drawSpectrum(freqData, {sampleRate: sampleRate, fftSize: fftSize, minDb: minDb = -100, maxDb: maxDb = -30, maxFreqHz: maxFreqHz = 2e4} = {}) {
    const {persistCtx: persistCtx, width: width, height: height, theme: theme} = this;
    this._fadePersistence();
    if (freqData && sampleRate && fftSize) {
      const binHz = sampleRate / fftSize;
      const maxBin = Math.min(freqData.length, Math.floor(maxFreqHz / binHz));
      const points = [];
      for (let i = 0; i < maxBin; i++) {
        const x = i / (maxBin - 1) * width;
        const db = freqData[i];
        const norm = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));
        const y = height - norm * height;
        points.push([ x, y ]);
      }
      this._strokeTrace(persistCtx, points, theme.traceColors[0], theme.glow);
    }
    this._composite();
    this._drawSpectrumAxisLabels(sampleRate, fftSize, minDb, maxDb, maxFreqHz);
  }
  _drawSpectrumAxisLabels(sampleRate, fftSize, minDb, maxDb, maxFreqHz) {
    if (!sampleRate || !fftSize) return;
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.fillStyle = theme.textColor;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const freqSteps = 5;
    for (let i = 0; i <= freqSteps; i++) {
      const freq = maxFreqHz / freqSteps * i;
      const x = i / freqSteps * width;
      const label = freq >= 1e3 ? `${(freq / 1e3).toFixed(1)}k` : `${Math.round(freq)}`;
      ctx.fillText(label, Math.min(x + 2, width - 30), height - 4);
    }
    ctx.textBaseline = "top";
    const dbSteps = 4;
    for (let i = 0; i <= dbSteps; i++) {
      const db = maxDb - (maxDb - minDb) / dbSteps * i;
      const y = i / dbSteps * height;
      ctx.fillText(`${Math.round(db)}dB`, 4, Math.min(y + 2, height - 14));
    }
    ctx.restore();
  }
  drawSpectrogramColumn(freqData, {sampleRate: sampleRate, fftSize: fftSize, minDb: minDb = -100, maxDb: maxDb = -30, maxFreqHz: maxFreqHz = 2e4} = {}) {
    const sctx = this.spectrogramCtx;
    const w = this.spectrogramCanvas.width;
    const h = this.spectrogramCanvas.height;
    if (w < 2 || h < 1) return;
    sctx.drawImage(this.spectrogramCanvas, 1, 0, w - 1, h, 0, 0, w - 1, h);
    if (freqData && sampleRate && fftSize) {
      const binHz = sampleRate / fftSize;
      const col = sctx.createImageData(1, h);
      for (let y = 0; y < h; y++) {
        const freq = (h - 1 - y) / (h - 1) * maxFreqHz;
        const bin = Math.min(freqData.length - 1, Math.round(freq / binHz));
        const db = freqData[bin];
        const norm = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));
        const [r, g, b] = this._phosphorColor(norm);
        const idx = y * 4;
        col.data[idx] = r;
        col.data[idx + 1] = g;
        col.data[idx + 2] = b;
        col.data[idx + 3] = 255;
      }
      sctx.putImageData(col, w - 1, 0);
    }
    this.ctx.save();
    this.ctx.drawImage(this.spectrogramCanvas, 0, 0, this.width, this.height);
    this.ctx.restore();
    this._drawSpectrogramFreqLabels(maxFreqHz);
  }
  _drawSpectrogramFreqLabels(maxFreqHz) {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.fillStyle = theme.textColor;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const freq = maxFreqHz * (1 - i / steps);
      const y = i / steps * height;
      const label = freq >= 1e3 ? `${(freq / 1e3).toFixed(0)}k` : `${Math.round(freq)}`;
      ctx.fillText(label, 4, Math.min(y + 2, height - 14));
    }
    ctx.textAlign = "right";
    ctx.fillText("time →", width - 6, height - 16);
    ctx.restore();
  }
  drawChromagram(chromaValues, labels) {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    this._drawGraticule();
    const n = chromaValues.length;
    const gap = Math.max(4, width * .012);
    const barWidth = (width - gap * (n + 1)) / n;
    const maxBarHeight = height * .7;
    const baseline = height - 34;
    const color = theme.traceColors[0];
    for (let i = 0; i < n; i++) {
      const v = chromaValues[i];
      const barH = Math.max(1, v * maxBarHeight);
      const x = gap + i * (barWidth + gap);
      const y = baseline - barH;
      ctx.save();
      if (theme.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = theme.glowStrength;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barH);
      ctx.restore();
      ctx.fillStyle = theme.textColor;
      ctx.font = `${Math.max(11, Math.min(14, barWidth * .35))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(labels[i], x + barWidth / 2, baseline + 10);
    }
    if (theme.scanlines) this._drawScanlines();
    if (theme.vignette) this._drawVignette();
    ctx.restore();
  }
  _logFreqToY(freq, minFreq, maxFreq, height) {
    const clamped = Math.min(maxFreq, Math.max(minFreq, freq));
    const t = Math.log2(clamped / minFreq) / Math.log2(maxFreq / minFreq);
    return height - t * height;
  }
  drawHarmonicLadder(peaks, {minFreq: minFreq = 20, maxFreq: maxFreq = 4e3} = {}) {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = theme.graticuleMinorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let f = minFreq; f <= maxFreq; f *= 2) {
      const y = this._logFreqToY(f, minFreq, maxFreq, height);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    if (theme.scanlines) this._drawScanlines();
    if (theme.vignette) this._drawVignette();
    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = theme.textColor;
      ctx.font = "13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Listening for pitches…", width / 2, height / 2);
      ctx.restore();
      return;
    }
    const barX = Math.max(80, width * .08);
    const barWidth = Math.max(60, width * .22);
    const bracketX = Math.max(30, barX - 45);
    const rootColor = theme.traceColors[0];
    const ys = peaks.map(p => this._logFreqToY(p.freq, minFreq, maxFreq, height));
    const yByFreq = new Map(peaks.map((p, i) => [ p.freq, ys[i] ]));
    ctx.strokeStyle = theme.cursorColor;
    ctx.font = "11px ui-monospace, monospace";
    peaks.forEach((p, i) => {
      if (p.harmonicOf == null) return;
      const rootY = yByFreq.get(p.harmonicOf);
      if (rootY == null) return;
      const y = ys[i];
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.setLineDash([ 4, 3 ]);
      ctx.beginPath();
      ctx.moveTo(bracketX, rootY);
      ctx.lineTo(bracketX, y);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = theme.cursorColor;
      ctx.globalAlpha = .7;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`h${p.harmonicNumber}`, bracketX - 6, y);
      ctx.globalAlpha = 1;
    });
    peaks.forEach((p, i) => {
      const y = ys[i];
      const isRoot = p.harmonicOf == null;
      ctx.save();
      if (isRoot) {
        if (theme.glow) {
          ctx.shadowColor = rootColor;
          ctx.shadowBlur = theme.glowStrength;
        }
        ctx.strokeStyle = rootColor;
        ctx.lineWidth = 3;
      } else {
        ctx.globalAlpha = .45;
        ctx.strokeStyle = rootColor;
        ctx.lineWidth = 1.5;
      }
      ctx.beginPath();
      ctx.moveTo(barX, y);
      ctx.lineTo(barX + barWidth, y);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = isRoot ? 1 : .6;
      ctx.fillStyle = theme.textColor;
      ctx.font = "13px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, barX + barWidth + 10, y);
      ctx.restore();
    });
    ctx.restore();
  }
  drawHarmonicBalance(fundamentalLabel, oddRatio, thdPercent, reliable = true) {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    if (fundamentalLabel == null) {
      ctx.fillStyle = theme.textColor;
      ctx.font = "13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Listening for a fundamental…", width / 2, height / 2);
      ctx.restore();
      return;
    }
    const midY = height / 2;
    const trackX = width * .12;
    const trackWidth = width * .76;
    const trackY = midY;
    ctx.strokeStyle = theme.graticuleColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackX, trackY);
    ctx.lineTo(trackX + trackWidth, trackY);
    ctx.stroke();
    ctx.strokeStyle = theme.graticuleMinorColor;
    ctx.beginPath();
    ctx.moveTo(trackX + trackWidth / 2, trackY - 14);
    ctx.lineTo(trackX + trackWidth / 2, trackY + 14);
    ctx.stroke();
    ctx.fillStyle = theme.textColor;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("EVEN (sawtooth-like)", trackX, trackY - 28);
    ctx.textAlign = "right";
    ctx.fillText("ODD (square/triangle-like)", trackX + trackWidth, trackY - 28);
    const markerX = trackX + oddRatio * trackWidth;
    const color = theme.traceColors[0];
    ctx.save();
    if (reliable) {
      if (theme.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = theme.glowStrength;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(markerX, trackY, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = .5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(markerX, trackY, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = theme.textColor;
    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Fundamental: ${fundamentalLabel}`, width / 2, trackY + 50);
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillText(`THD: ${thdPercent.toFixed(1)}%`, width / 2, trackY + 82);
    if (!reliable) {
      ctx.save();
      ctx.globalAlpha = .7;
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText("Tone is near-pure — odd/even position not meaningful below ~2% THD", width / 2, trackY + 110);
      ctx.restore();
    }
    if (theme.scanlines) this._drawScanlines();
    if (theme.vignette) this._drawVignette();
    ctx.restore();
  }
  drawXY(chA, chB, {scale: scale = 1, stereoMetrics: stereoMetrics = null} = {}) {
    const {persistCtx: persistCtx, ctx: ctx, width: width, height: height, theme: theme} = this;
    this._fadePersistence();
    if (!chA || !chB) {
      this._composite();
      return;
    }
    const n = Math.min(chA.length, chB.length);
    const cx = width / 2;
    const cy = height / 2;
    const ampScale = Math.min(width, height) / 2 * .9 * scale;
    const points = [];
    for (let i = 0; i < n; i++) {
      points.push([ cx + chA[i] * ampScale, cy - chB[i] * ampScale ]);
    }
    this._strokeTrace(persistCtx, points, theme.traceColors[0], theme.glow);
    this._composite();
    if (stereoMetrics && stereoMetrics.correlation != null) {
      const angleRad = stereoMetrics.phaseAngleDeg * Math.PI / 180;
      const dx = Math.cos(angleRad) * ampScale * .95;
      const dy = -Math.sin(angleRad) * ampScale * .95;
      ctx.save();
      ctx.strokeStyle = theme.cursorColor;
      ctx.globalAlpha = .8;
      ctx.setLineDash([ 2, 4 ]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = theme.textColor;
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Phase angle: ${stereoMetrics.phaseAngleDeg.toFixed(1)}°`, 8, 8);
      ctx.fillText(`Correlation: ${stereoMetrics.correlation.toFixed(2)}`, 8, 24);
      ctx.restore();
    }
  }
  _composite() {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
    this._drawGraticule();
    let flickerAlpha = 1;
    if (theme.flicker) {
      this._flickerPhase += .001;
      flickerAlpha = .94 + Math.sin(this._flickerPhase * 37) * .03 + (Math.random() - .5) * .02;
    }
    ctx.globalAlpha = flickerAlpha;
    ctx.drawImage(this.persistCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
    if (theme.scanlines) this._drawScanlines();
    if (theme.vignette) this._drawVignette();
    ctx.restore();
  }
  _drawScanlines() {
    const {ctx: ctx, width: width, height: height} = this;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.restore();
  }
  _drawVignette() {
    const {ctx: ctx, width: width, height: height} = this;
    const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .35, width / 2, height / 2, Math.max(width, height) * .7);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  drawTriggerLevel(level, color = "#fbbf24") {
    const {ctx: ctx, width: width, height: height} = this;
    const midY = height / 2;
    const ampScale = height / 2 * .9;
    const y = midY - level * ampScale;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = .7;
    ctx.setLineDash([ 6, 5 ]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y - 5);
    ctx.lineTo(10, y);
    ctx.lineTo(0, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  pixelToAmplitude(y) {
    const midY = this.height / 2;
    const ampScale = this.height / 2 * .9;
    return (midY - y) / ampScale;
  }
  drawCursors(cursors) {
    const {ctx: ctx, width: width, height: height, theme: theme} = this;
    ctx.save();
    ctx.strokeStyle = theme.cursorColor;
    ctx.setLineDash([ 5, 4 ]);
    ctx.lineWidth = 1;
    if (cursors.vA != null) {
      ctx.beginPath();
      ctx.moveTo(cursors.vA, 0);
      ctx.lineTo(cursors.vA, height);
      ctx.stroke();
    }
    if (cursors.vB != null) {
      ctx.beginPath();
      ctx.moveTo(cursors.vB, 0);
      ctx.lineTo(cursors.vB, height);
      ctx.stroke();
    }
    if (cursors.hA != null) {
      ctx.beginPath();
      ctx.moveTo(0, cursors.hA);
      ctx.lineTo(width, cursors.hA);
      ctx.stroke();
    }
    if (cursors.hB != null) {
      ctx.beginPath();
      ctx.moveTo(0, cursors.hB);
      ctx.lineTo(width, cursors.hB);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = theme.cursorColor;
    const hs = 4;
    if (cursors.vA != null) ctx.fillRect(cursors.vA - hs, 6 - hs, hs * 2, hs * 2);
    if (cursors.vB != null) ctx.fillRect(cursors.vB - hs, 6 - hs, hs * 2, hs * 2);
    if (cursors.hA != null) ctx.fillRect(6 - hs, cursors.hA - hs, hs * 2, hs * 2);
    if (cursors.hB != null) ctx.fillRect(6 - hs, cursors.hB - hs, hs * 2, hs * 2);
    ctx.restore();
  }
}