# Subharmonicon — Thermalsock Labs

A live tuning aid and ratio reference for the Moog Subharmonicon. Runs
entirely in the browser via the Web Audio API — no build step, no
dependencies. Reuses `audioEngine.js` and `measurements.js` verbatim from
the Web Oscilloscope app.

## Running locally

Same as Oscilloscope — must be served over HTTP (ES modules + getUserMedia
won't work over `file://`):

```
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## Project structure

```
index.html            Shell: permission gate + 3-tab app UI
css/styles.css         Shared chrome (copied from Oscilloscope, cyan accent)
css/ratio.css           Subharmonicon-specific: tabs, meters, ladder, library
js/audioEngine.js       Copied verbatim from Oscilloscope
js/measurements.js      Copied verbatim from Oscilloscope (findSpectralPeaks,
                         freqToNote, describeRatio, formatHz)
js/ratioEngine.js       New: root tracking, nearest-clean-ratio, target-slot
                         cents deviation — verified against synthetic data
                         in Node before shipping (10 assertions, all pass)
js/ratioLibrary.js      New: curated divider-combination reference data
js/main.js              Wires it all together
```

## The three views

- **Ratio Lock** — live list of every detected voice; click one to set it
  as Root (VCO1). Everything else is shown as a ratio + cents-off-clean
  relative to Root. Four configurable Target Slots let you dial in the
  divide switches you *intend* to set and see a live cents meter for how
  close the actual pot position is getting you.
- **Series Map** — a log-frequency ladder showing every clean ratio 1–8
  above/below Root, with detected voices plotted as color-coded dots.
- **Ratio Library** — browse curated VCO1/VCO2 divider combinations by
  character (Open & Stable, Rich & Consonant, Cluster & Dissonant, Drone).

## Known simplifications (v1)

- Root tracking follows by frequency continuity (closest peak to the last
  known root, in log-frequency terms), not persistent peak identity — if
  the root voice drops out and a different voice happens to land close by,
  tracking can jump to it. A "Tap Root" re-lock is one click away in the
  Voice List if that happens.
- Target Slots find the *nearest* detected peak to an expected frequency,
  not necessarily the "correct" physical oscillator — fine for typical
  patches where each divider settles into a distinct frequency, but can
  mismatch if two intended voices land very close together.
- Uses channel A only (no stereo-specific ratio logic).
