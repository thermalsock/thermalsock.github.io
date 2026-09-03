// themes.js
// Each theme is pure data/config consumed by renderer.js. Adding a theme means
// adding an entry here — the renderer never branches on theme name directly.

export const themes = {
  fieldNotes: {
    id: 'fieldNotes',
    label: 'Field Notes',
    background: '#0F1118',
    graticuleColor: 'rgba(43, 38, 32, 0.16)',
    graticuleMinorColor: 'rgba(43, 38, 32, 0.07)',
    textColor: 'rgba(43, 38, 32, 0.82)',
    // Rust for channel A, ink-blue for channel B — the same two-accent pairing
    // used across the rest of the site (cable/link color + a secondary ink).
    traceColors: ['#00C8FF', '#33475C'],
    cursorColor: 'rgba(43, 38, 32, 0.65)',
    glow: false, // no CRT glow — this is ink on paper, not a phosphor tube
    glowStrength: 0,
    traceLineWidth: 1.6,
    scanlines: false,
    vignette: false,
    flicker: false,
    persistence: 0.4, // short, clean trail — legible, not a lingering CRT decay
    curvature: false,
  },
  crtGreen: {
    id: 'crtGreen',
    label: 'CRT — Phosphor Green',
    background: '#02120a',
    graticuleColor: 'rgba(60, 220, 130, 0.25)',
    graticuleMinorColor: 'rgba(60, 220, 130, 0.10)',
    textColor: 'rgba(140, 255, 190, 0.85)',
    traceColors: ['#4dff9e', '#ffd24d'], // channel A, channel B
    cursorColor: 'rgba(255, 255, 255, 0.65)',
    glow: true,
    glowStrength: 14,
    scanlines: true,
    vignette: true,
    flicker: true,
    persistence: 0.82, // higher = longer phosphor decay trail
    curvature: true,
  },
  crtAmber: {
    id: 'crtAmber',
    label: 'CRT — Amber',
    background: '#120a02',
    graticuleColor: 'rgba(220, 150, 60, 0.25)',
    graticuleMinorColor: 'rgba(220, 150, 60, 0.10)',
    textColor: 'rgba(255, 200, 140, 0.85)',
    traceColors: ['#ffb84d', '#4dc9ff'],
    cursorColor: 'rgba(255, 255, 255, 0.65)',
    glow: true,
    glowStrength: 14,
    scanlines: true,
    vignette: true,
    flicker: true,
    persistence: 0.82,
    curvature: true,
  },
  modernLab: {
    id: 'modernLab',
    label: 'Modern Lab',
    background: '#0d1117',
    graticuleColor: 'rgba(148, 163, 184, 0.25)',
    graticuleMinorColor: 'rgba(148, 163, 184, 0.10)',
    textColor: 'rgba(226, 232, 240, 0.9)',
    traceColors: ['#38bdf8', '#f472b6'],
    cursorColor: 'rgba(255, 255, 255, 0.8)',
    glow: false,
    glowStrength: 0,
    scanlines: false,
    vignette: false,
    flicker: false,
    persistence: 0.55,
    curvature: false,
  },
  auroraFlow: {
    id: 'auroraFlow',
    label: 'Aurora Flow (Arty)',
    background: '#080b1f',
    // Near-invisible graticule — this theme is about the flowing trace, not
    // instrument-panel precision, so the grid stays out of the way.
    graticuleColor: 'rgba(150, 165, 255, 0.06)',
    graticuleMinorColor: 'rgba(150, 165, 255, 0.03)',
    textColor: 'rgba(225, 230, 255, 0.85)',
    // Flat fallback colors, used by every other visualization (chromagram
    // bars, harmonic ladder, balance meter, XY, spectrogram colormap) that
    // doesn't support a full gradient trace.
    traceColors: ['#b455e0', '#3fe0a5'],
    // Warm-to-cool gradient used specifically for the time-domain trace —
    // gold through coral, violet, azure, to emerald, evoking the same
    // flowing multi-hue "light ribbon" look without copying any specific
    // artwork.
    traceGradient: ['#ffd66b', '#ff5f6d', '#b455e0', '#4f8ef7', '#3fe0a5'],
    cursorColor: 'rgba(230, 230, 255, 0.7)',
    glow: true,
    glowStrength: 28,
    extraBloom: true, // adds a second, wider/softer glow pass for a richer bloom
    traceLineWidth: 3, // thicker core line — reads more like a ribbon than a scope trace
    scanlines: false, // not a CRT — scanlines would fight the smooth aesthetic
    vignette: true,
    flicker: false,
    persistence: 0.88, // long, lush motion trails
    curvature: false,
  },
  wovenMono: {
    id: 'wovenMono',
    label: 'Woven Mono (Arty)',
    background: '#2c2c30',
    graticuleColor: 'rgba(255, 255, 255, 0.05)',
    graticuleMinorColor: 'rgba(255, 255, 255, 0.02)',
    textColor: 'rgba(235, 235, 235, 0.85)',
    traceColors: ['#f5f5f5', '#cfcfcf'],
    cursorColor: 'rgba(255, 255, 255, 0.7)',
    glow: false, // deliberately no blur — the effect comes from many crisp
    // thin strands overlapping, not from soft light; a glow would just
    // merge everything into a blob instead of a woven mesh.
    glowStrength: 0,
    traceLineWidth: 1, // thin, delicate strands rather than a bold trace
    scanlines: false,
    vignette: false, // flat, poster-like background rather than a CRT tube
    flicker: false,
    // The real trick: a very long persistence keeps dozens of recent frames
    // simultaneously visible, each slightly different as the waveform shifts
    // — that's what builds the dense "many overlapping lines" woven texture,
    // using the same phosphor-decay mechanism as the CRT themes, just tuned
    // far longer and with color/glow stripped out.
    persistence: 0.94,
    curvature: false,
  },
};

export const defaultThemeId = 'fieldNotes';
