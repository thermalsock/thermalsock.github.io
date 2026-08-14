# Web Oscilloscope - Thermalsock Labs

A professional-grade oscilloscope that runs entirely in the browser via the
Web Audio API. No build step, no dependencies - plain HTML/CSS/JS, ready to
drop onto GitHub Pages as-is.

## Running locally (VS Code)

Because this uses ES modules (`<script type="module">`) and `getUserMedia`,
it **must be served over HTTP** - opening `index.html` directly via
`file://` will fail (module imports get blocked, and some browsers refuse
mic access on `file://` entirely).

Easiest options in VS Code:

- **Live Server extension**: right-click `index.html` → "Open with Live Server".
- **Or from the integrated terminal**, no extension needed:
  ```
  python3 -m http.server 8000
  ```
  then open `http://localhost:8000` in your browser.

Grant microphone/input permission when prompted - that's your audio
interface or mic being captured. Nothing is recorded or sent anywhere;
all analysis happens client-side.

## Project structure

```
index.html          Shell: permission gate + main scope UI
css/styles.css       Instrument-panel styling
js/audioEngine.js    getUserMedia + AudioContext + per-channel AnalyserNodes
js/triggerEngine.js  Edge trigger, Auto/Normal/Single modes
js/measurements.js   Vpp, RMS, frequency, period calculations
js/themes.js         Theme definitions (CRT green, CRT amber, Modern Lab)
js/renderer.js       Canvas drawing: time-domain, XY/Lissajous, CRT effects
js/main.js           Wires it all together + the render loop
```

## v1 feature status

- [x] Dual-channel (stereo) acquisition
- [x] Edge trigger, Auto / Normal / Single-shot modes, adjustable level & slope
- [x] Time-domain dual trace
- [x] XY / Lissajous mode
- [x] Phosphor persistence / decay
- [x] CRT theme (green + amber) with glow, scanlines, vignette, flicker
- [x] Modern Lab theme
- [x] Vertical gain control
- [x] Automatic measurements: Vpp, RMS, frequency, period (on channel A)
- [x] Device picker + friendly permission-denied/no-device error states
- [ ] Draggable cursors with live readout (cursor lines render; drag-to-position
      and delta readout are not wired up yet)
- [ ] FFT / spectrum view (planned post-v1)

## Known rough edges to revisit

- Frequency/period measurement uses zero-crossing detection - solid on clean
  periodic signals, will get noisy on complex/noisy waveforms (FFT-based
  measurement is the planned fix, ties into the spectrum view feature).
- Cursors are currently fixed-position placeholders, not yet draggable.
- No persisted settings (theme/trigger config resets on reload) - worth a
  localStorage-backed preset save/load pass later.
