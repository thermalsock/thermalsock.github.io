# Sound Design - Thermalsock Labs

A patch-programming reference for the Sequential Take 5: oscillators, mixer,
filter, envelopes, ADSR shape, suggested effects, and modulation notes,
walked through for dozens of patches across analog bass, leads, motion/mod
patches, percussive/plucked sounds, and drones/atmospheres.

This was originally a second page inside the Web Oscilloscope app; it's
split out here as its own self-contained tool since it doesn't share any
actual functionality with the scope - no audio input, no analysis, just a
patch browser and reference panel.

## Running locally

Same as every other tool in this site: serve it over `http://`, don't open
`index.html` directly via `file://` (it uses an ES module script). From this
folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. Or right-click `index.html` in VS Code
and "Open with Live Server" if you have that extension.

## Project structure

```
index.html          Shell: sidebar patch list + panel layout
css/styles.css       Shared shell styles (topbar, brand, cards, panels)
css/synth-panel.css  Panel-specific styles (knobs, ADSR curve, etc.)
js/soundDesign.js    Rendering + interaction logic
js/synthPresets.js   The actual patch data (categories, patches, notes)
```

No build step, no dependencies - plain HTML/CSS/JS, ready to drop onto
GitHub Pages or any static host as-is.
