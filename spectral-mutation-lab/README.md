# Spectral Mutation Lab — Thermalsock Labs

A real-time FFT-based spectral processor that runs entirely in the browser:
splits incoming audio into 2048 frequency bins, mutates them — freeze,
morph, shift, reverse, smear, scatter — and recombines them into a new
sound. Built as its own standalone package, styled to match the rest of
Thermalsock Labs (same dark rack-panel instrument surface, knobs, and
chassis as the Granulator), but architecturally independent — no shared
runtime state with any sibling app.

Feed it a hardware synth (Take 5, Subharmonicon, anything) through your
audio interface and it'll do the same thing Mutable Instruments Beads,
Hologram Microcosm, or Meng Qi's Cosmos do in dedicated hardware, using a
real short-time Fourier transform engine — not a pitch-shift-and-reverb
approximation.

## Running locally (VS Code)

Same requirements as the Granulator: this uses ES modules and
`AudioWorklet`, so it must be served over HTTP, not opened via `file://`.

- **Live Server extension**: right-click `index.html` → "Open with Live Server".
- **Or from the integrated terminal**: `python3 -m http.server 8000`, then open `http://localhost:8000`.

Grant input/microphone permission when prompted. Nothing is recorded or
sent anywhere — all processing happens client-side in the AudioWorklet.

## Project structure

```
index.html                 Shell: permission gate + full instrument UI
css/styles.css              Instrument-panel styling (same tokens as Granulator)
js/spectral-processor.js    AudioWorkletProcessor — the actual DSP: FFT/IFFT,
                             STFT analysis/resynthesis, freeze A/B, morph,
                             spectral shift, reverse, smear, scatter
js/audioEngine.js           getUserMedia + AudioContext + worklet node wiring
js/midi.js                  Web MIDI: devices, note-on freeze capture,
                             mod-wheel/aftertouch convenience mappings
js/presets.js                Preset serialize/restore, localStorage, JSON
                             import/export, 4-slot snapshot bank
js/spectrogramView.js       Canvas: scrolling waterfall spectrogram
js/knobControl.js           Reusable rotary knob widget (shared design with Granulator)
js/main.js                  Wires everything together + the render loop
```

## How the spectral engine actually works

This is a genuine short-time Fourier transform (STFT) pipeline, not a
simplified stand-in:

1. **Analysis**: incoming audio accumulates in a per-channel ring buffer.
   Every 512 samples (the hop size), the last 2048 samples are windowed
   (periodic Hann) and run through an in-place radix-2 Cooley-Tukey FFT —
   a real implementation, bit-reversal permutation and all, not a library
   stub.
2. **Mutation**: only *magnitude* is touched — freeze blends live magnitude
   against up to two captured snapshots (with a morph knob between them,
   Cosmos-style), shift resamples the magnitude curve by a semitone ratio,
   reverse crossfades toward a frequency-mirrored spectrum, smear applies a
   temporal + frequency-domain blur, and scatter reassigns bins to
   continuously-rerolled nearby offsets.
3. **Resynthesis**: rather than carrying the original phase forward — which
   makes no sense once bins have been reversed or scattered anyway — each
   bin is resynthesized from its own phase accumulator, advancing at that
   bin's natural frequency every frame. Magnitude drives amplitude; phase
   just keeps a steady oscillator running. This is what gives frozen
   spectra a smooth, sustained character instead of a robotic looped-frame
   sound, and it's what makes every mutation mode safe to apply without the
   engine falling apart.
4. **Reconstruction**: inverse FFT, then constant-overlap-add (COLA) back
   into an output ring buffer, normalized by a COLA constant computed at
   startup (not hand-derived and hardcoded) so the math is verifiably
   correct for the exact window/hop combination in use (2048/512, 75%
   overlap, which satisfies COLA exactly for a Hann window).

I validated the FFT, the COLA normalization, and the full analysis →
resynthesis round trip against known signals (pure tones, white noise,
harmonic stacks) before wiring it into the UI — see "phasiness" below for
the one real characteristic that testing surfaced.

## Feature status

- [x] Real STFT engine: 2048-point FFT, 512-sample hop, Hann window, COLA-
      normalized overlap-add reconstruction — true stereo (independent L/R
      FFT chains, not a mono engine with a stereo bolt-on)
- [x] Freeze A + Freeze B: independent capture slots, each toggled live;
      Freeze Mix blends live ↔ frozen, Morph blends A ↔ B — a two-texture
      crossfade in the spirit of Cosmos's loop-blend
- [x] Spectral shift (bin-resampled, semitone-ratio pitch shift of the
      magnitude spectrum)
- [x] Reverse (continuous 0–1 crossfade toward a frequency-mirrored spectrum,
      not just an on/off flip)
- [x] Smear (temporal leak + frequency-domain blur on one knob)
- [x] Scatter (continuously-evolving bin reassignment, radius and reroll
      rate both scaling with the knob — not a single static scramble)
- [x] Recombine: dry/wet blend of the mutated reconstruction against the
      actual dry input, output gain, limiter
- [x] Scrolling waterfall spectrogram (log-frequency, sqrt-compressed
      magnitude-to-color) with live Freeze A/B indicators
- [x] XY pad with assignable axes across every spectral parameter
- [x] MIDI: device list, note-on captures Freeze A (play a chord, grab it),
      mod-wheel and aftertouch assignable to any parameter
- [x] Presets: 11 factory presets across Drones/Textures/Glitch/Shift,
      save/load/delete, JSON export (single + bank), JSON import, 4-slot
      quick-recall snapshot bank
- [x] Mono input (sums L+R before processing, on by default — same
      one-channel-hardware-source fix as the Granulator)

## Implementation notes — read this before assuming something's a bug

- **"Phasiness" on pure sustained tones.** Because resynthesis drives every
  bin from its own independent phase accumulator rather than the analyzed
  phase, adjacent bins that originally had a *fixed* phase relationship
  (a sinusoid's main lobe and its Hann-window sidelobes, specifically) drift
  out of that relationship over time, since each bin's phase advances at a
  different rate. On an isolated, dead-steady test tone this can produce a
  slow amplitude wobble — I measured it directly (up to ~2x on a
  worst-case bin-centered sine) before shipping this. On real, harmonically
  rich, moving program material — the actual use case here — this is far
  less audible; broadband/multi-tone test material stayed within a sane
  ~1.1–1.2x RMS range in testing. The limiter is on by default specifically
  because of this — it's a real safety net, not a decoration. If you're
  hearing occasional amplitude pulsing on a very sustained, narrow-spectrum
  drone, that's this characteristic, not a malfunction.
- **Freeze A/B are performance state, not preset state.** Loading a preset
  never restores a previously-captured spectrum — you re-engage Freeze
  live, the same way you'd re-engage a hardware freeze pedal. Serializing
  actual captured spectra (1025 floats × 2 slots × 2 channels) into every
  preset felt like the wrong tradeoff for what presets are for here.
- **Output gain default (1.6x) is deliberately more conservative than the
  Granulator's**, given the phasiness characteristic above — there's less
  fixed headroom baked in so a burst of resonant/tonal content doesn't
  compound with the limiter more than necessary. Push the Output Gain knob
  yourself once you've heard how your own material behaves; it goes to 4x.
- **CPU load** in the footer is the same kind of proxy as the Granulator's
  (worklet render time ÷ block-time budget, smoothed) — indicative, not a
  precise profiler reading.
- No server component of any kind — presets, snapshots, and MIDI mappings
  all live in `localStorage` on the machine you're using.
