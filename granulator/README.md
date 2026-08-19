# Granulator — Thermalsock Labs

A real-time granular audio processor that runs entirely in the browser via
the Web Audio API and an `AudioWorkletProcessor`. No build step, no
dependencies — plain HTML/CSS/JS, ready to drop onto GitHub Pages as-is,
sitting alongside the other Thermalsock Labs instruments.

Feed it a hardware synth through your audio interface (a Take 5, a mixer
send, anything), granulate it live, and route the result back into your
studio mixer or DAW input.

## Running locally (VS Code)

This uses ES modules (`<script type="module">`), `AudioWorklet`, and
`getUserMedia`, so it **must be served over HTTP** — opening `index.html`
directly via `file://` will fail (module imports and worklet loading get
blocked, and some browsers refuse mic access on `file://` entirely).

- **Live Server extension**: right-click `index.html` → "Open with Live Server".
- **Or from the integrated terminal**:
  ```
  python3 -m http.server 8000
  ```
  then open `http://localhost:8000` in your browser.

Grant input/microphone permission when prompted — that's your audio
interface being captured. Nothing is recorded or sent anywhere; all
processing happens client-side inside the AudioWorklet.

## Visual language

The instrument panel is laid out to actually match a hardware granular
unit's composition (Tasty Chips GR-1, specifically — not copied, but the
same structural idea, reskinned entirely in the site's own Field Notes
palette rather than the hardware's own colors): the waveform/grain-cloud
screen sits top-left at roughly half width, a "Master" knob and two fader
clusters ("Range": Scan Start/End/Buffer Length, "Shape": Duration/Density/
Jitter/Spread) sit to its right at the same height, a horizontal scrub
fader for Position runs under the screen, and a knob row (Orbit, Pitch,
Scan Speed, Crossfade) sits below that. No tabs — every control is visible
at once, the way a physical panel actually works, rather than switching
between pages. A small live curve preview next to the Envelope select
shows the actual grain shape math rather than just a dropdown label.

Two widget types, both real custom controls (no library, plain SVG/DOM +
pointer events): rotary knobs (`js/knobControl.js`) for performance
parameters, and vertical/horizontal faders (`js/faderControl.js`) for the
"define the area/shape" parameters that read better as a slider bank. Both
share the same interaction conventions — drag to set, scroll to nudge,
double-click to reset to default, click the numeric readout to type an
exact value.

## Project structure

```
index.html                Shell: permission gate + full instrument UI
css/styles.css             Instrument-panel styling (shared Thermalsock Labs tokens)
js/granular-processor.js   AudioWorkletProcessor — the actual DSP: circular
                            buffers, grain scheduler, envelopes, pitch shift,
                            jitter, spread, freeze, orbit/spray/scan modes
js/audioEngine.js          getUserMedia + AudioContext + worklet node wiring
js/modulation.js           LFOs, envelope, step sequencer, random sources,
                            macros, MIDI-CC/aftertouch sources, routing matrix
js/midi.js                 Web MIDI: devices, CC learn, notes, clock sync
js/presets.js               Preset serialize/restore, localStorage, JSON
                            import/export, 4-slot snapshot bank
js/waveformView.js         Canvas: scrolling waveform, freeze state, read head
js/grainCloudView.js       Canvas: live grain particles (position/pitch/env/size)
js/modMatrixView.js        Canvas: animated per-source traces + macro bars
js/knobControl.js          Reusable rotary knob widget (SVG + pointer drag)
js/faderControl.js         Vertical + horizontal fader widgets, same interaction API as the knob
js/main.js                 Wires everything together + the render loop
```

## Feature status

- [x] getUserMedia input → AudioWorklet, sample-accurate granular engine
- [x] Circular buffer, 1–10s adjustable length, freeze mode, manual scan-by-drag
- [x] **Load your own sample**: the "Load Sample" button (or drag & drop
      straight onto the waveform) decodes any audio file your browser
      supports and writes it directly into the buffer — instantly, not
      "played in" over real time. Buffer length auto-adjusts to fit (files
      longer than 10s load the first 10s), and the engine freezes
      automatically so live input doesn't immediately start overwriting
      what you just loaded.
- [x] **Live tracking (on by default)**: the grain read head follows the live
      write head at a small, adjustable lag, so playing your synth is
      granulated in real time rather than reading a static, stale point in
      the buffer's history. Turning "Live tracking" off (or freezing) hands
      the Position knob back to you as an absolute scrub point.
- [x] Grain scheduling with density, jitter (timing + position), spray mode
- [x] Envelopes: Hann, Gaussian, Tukey, Exponential
- [x] Pitch shift (semitone or ratio display), pitch-lock (semitone quantize),
      reverse grains, formant-preserve approximation (see note below)
- [x] Stereo spread (equal-power per-grain panning)
- [x] Orbit mode (LFO'd read position) and Scan speed for deliberate time-stretch
      (nudging Scan speed away from 1x switches from write-head-locked live
      tracking to a free-running scan through the buffer, forward, slower/
      faster, or reversed, independent of what's currently being recorded)
- [x] Scan Range (Start/End): bounds the free-running scan head to a custom
      region of the buffer instead of the whole thing — Ping-pong (bounce,
      no jump) or Loop (wrap) modes, "Set start/end here" quick-capture from
      the current read-head position, and a live visual overlay on the
      waveform showing the region
- [x] Dual buffers (A/B) with crossfade, independent record-buffer selection
- [x] Modulation: unlimited LFOs/envelopes/step-sequencers/random sources,
      4 macros, MIDI CC sources, aftertouch — all through one routing matrix
- [x] MIDI: device list, note-triggered grains + envelope retrigger, CC
      learn, mod-wheel→density and aftertouch→jitter default routes, MPE-lite
      pitch bend, MIDI clock sync (real BPM derived from 24ppqn ticks)
- [x] Waveform view (scrolling, freeze indicator, read-head marker, shaded
      scan-region band sized by Jitter) with the grain cloud overlaid
      directly on top as a transparent layer — one combined display rather
      than two separate scopes, particles: position/pitch/envelope colour/
      duration size
- [x] Modulation view (animated per-source traces, macro level bars)
- [x] Presets: 13 factory presets across all 5 categories (Textures,
      Drones, Percussive, Glitch, plus an Init Patch under User),
      save/load/delete, JSON export (single + full bank), JSON import,
      4-slot quick-recall snapshot bank
- [x] Performance controls: 4 macro knobs, assignable XY pad, dry/wet, gains
- [x] Footer/status readouts: worklet state, buffer length, live grain count,
      sample rate, an indicative CPU-load estimate

## Implementation notes & known simplifications

- **Loaded samples longer than 10 seconds are truncated to the first 10s**
  (the buffer's hard ceiling — see `MAX_BUFFER_SECONDS` in
  `granular-processor.js`), not time-compressed or resampled down to fit.
  The buffer length knob auto-adjusts to the sample's actual duration (or
  10s, whichever is shorter) so you're not stuck scanning through mostly
  silence after loading something short.
- **A loaded sample isn't part of preset state**, the same way Freeze A/B
  captures aren't in the Spectral Mutation Lab — it's performance/session
  state, not a saved patch parameter. Loading a preset doesn't touch
  whatever sample is currently in the buffer; hitting Reset Buffers clears
  it and returns the waveform view to live scrolling input.
- **Auto-freeze on load** is deliberate, not a side effect: without it, the
  very next live-input audio block would start overwriting the sample you
  just loaded, which would be a genuinely confusing thing to have happen
  silently. Un-freeze whenever you're ready to go back to live capture.

- **Scan Range only governs the free-running scan head** (frozen scanning,
  or live time-stretch scanning with Scan Speed away from 1x). While Live
  Tracking is actively locked to your input (Scan Speed ~1x, not frozen),
  Position means "how far behind what you're playing," and the region
  doesn't apply — turn off Live Tracking, or freeze, to actually confine
  scanning to the region you've set.
- **Ping-pong vs. Loop**: ping-pong reflects at the edges (the accumulator's
  direction flips, so there's no jump — the natural choice for a smoothly
  breathing scan through a phrase). Loop wraps straight from End back to
  Start, which is useful when End and Start are actually a matched loop
  point in the material and you want that seam rather than a bounce.
- **Position vs. Live lag**: the same knob and the same `position` AudioParam
  serve two roles depending on mode. With Live tracking on and not frozen,
  it's the lag (in fraction of buffer length) behind the live write head —
  0 is tightest/most immediate, higher values granulate audio from further
  back in time. With Live tracking off, or while frozen, it's an absolute
  scrub position in the buffer, same as before. The row label switches
  between "Live lag" and "Position" to match. This is also why it's a
  meaningful modulation target either way: routing an LFO to it wobbles the
  lag amount while tracking live, or scans the frozen buffer when it's not.
- The dry/wet mix and the final stereo/mono downmix are combined in a single
  pass at the very end of `process()`, deliberately — an earlier revision
  downmixed the wet grain signal before blending in dry, which meant at low
  Dry/Wet settings you'd mostly hear the raw, un-downmixed dry input
  (including any hardware-side channel imbalance from your interface)
  dominating the output regardless of the Output mode.
- Each grain's gain is compensated by roughly `1/sqrt(density × duration)`
  (clamped) so perceived loudness stays much more consistent as you sweep
  Density — without it, sparse/low-density settings are dramatically quieter
  than dense ones purely because fewer grains are summing together.
- **Mono input (on by default)**: sums L+R before anything else touches the
  signal — recording, dry pass-through, all of it. This exists because a lot
  of one-instrument-into-an-interface setups only feed one physical input
  channel, leaving the other silent; no amount of downstream panning or
  stereo processing can fix that, since it's spatializing already-imbalanced
  source material rather than a balanced signal. If your source is
  genuinely stereo and you want to keep it that way, turn this off.
- A fixed ~+15.5dB makeup gain stage (grain output ×6.0) plus a louder default
  Output gain knob (1.6 instead of unity) compensates for granular
  synthesis's inherent quietness (independently-phased grains partially
  cancel rather than summing coherently, equal-power panning costs ~3dB at
  center, tapered envelopes spend most of a grain's life below full
  amplitude) — the goal is a default level that reads as present in a full
  mix rather than getting buried. Output gain's range now goes to 4x for
  further headroom if you need it; the limiter remains the safety net
  against clipping, not the primary loudness control.

- **Formant preserve** is a lightweight real-time heuristic (grain-duration
  compensation inversely tied to pitch ratio) rather than a true LPC/cepstral
  formant corrector running in WebAssembly. It measurably reduces the
  "chipmunk" spectral smear at extreme pitch shifts but isn't a full
  formant-locked vocoder. A WASM-based corrector is a reasonable follow-up if
  you need broadcast-grade formant accuracy.
- **Ableton Link** is listed as a clock-sync option for workflow parity, but
  genuine Link sync needs an OS-level daemon a browser tab can't reach on its
  own — selecting it currently behaves like Internal clock. Internal and real
  MIDI clock (24ppqn, BPM derived from incoming ticks) both work for real.
- **CPU load** in the footer is a proxy (worklet render time ÷ block-time
  budget, smoothed), not a true OS-level CPU reading — `performance.now()`
  resolution is intentionally coarsened by browsers for privacy, so treat it
  as indicative rather than exact.
- **Grain pool** is capped at 96 simultaneous grains (voice-stealing the
  oldest grain past that) to keep `process()` bounded and realtime-safe at
  high density + long duration settings.
- **Preset load bug fix**: `applyState()` previously only restored parameters
  that live in the modulation matrix's routable target list, which silently
  dropped `orbitRate` (already present in several factory presets, but never
  actually applied on load) and would have hit Scan Start/End the same way.
  Fixed generally — any "direct knob" param not in the modulation target
  list now round-trips through save/load correctly.
- Vertical macro-knob sliders use the CSS `writing-mode` trick plus Firefox's
  `orient="vertical"` attribute; they render correctly in Chrome, Edge, and
  Firefox. Safari falls back to a horizontal slider — still fully functional,
  just not vertical.
- No server component of any kind — presets, snapshots, and MIDI mappings
  all live in `localStorage` on the machine you're using.
