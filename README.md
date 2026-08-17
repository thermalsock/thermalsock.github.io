# Thermalsock Labs — combined site

Everything lives under one root now:

```
site/
  index.html            ← landing page / hub (start here)
  oscilloscope/          Web Oscilloscope
  sound-design/          Sound Design (Take 5 patch reference — split out from
                          the oscilloscope app, since it's really a different tool)
  transient-lab/         Transient Lab (ear/hand trainer)
  signal-path/           Signal Path (hardware rig map)
```

Rudiment isn't in here as a folder — it's a native Steam/App Store title, so the
hub and Transient Lab's support widget both just link out to it:
- Steam: https://store.steampowered.com/app/5065240/Rudiment/
- App Store: currently in review — the site shows a "coming soon" pill wherever
  it's referenced. Once you have the real App Store URL, search this project
  for `App Store — in review` (landing page) and `App Store — coming soon`
  (Transient Lab's support widget) and swap in the link.

## Running it locally in VS Code

**This has to be served over `http://`, not opened as a `file://` path.**
Both Web Oscilloscope and Transient Lab use ES module scripts
(`<script type="module">`), which browsers block from loading when a page is
opened directly from disk. Signal Path and the landing page would work fine
as `file://`, but for one consistent workflow, always serve the whole
`site/` folder:

**Option A — Live Server extension (easiest)**
1. Install the "Live Server" extension in VS Code if you don't have it.
2. Open the `site/` folder in VS Code.
3. Right-click `index.html` → "Open with Live Server".
4. It opens the hub page in your browser at something like
   `http://127.0.0.1:5500/index.html` — click any card to open a tool.

**Option B — built-in terminal, no extension**
1. Open the `site/` folder in VS Code, open the integrated terminal.
2. Run:
   ```
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser.

Either way, keep the whole `site/` folder together — the tools link to each
other with relative paths (`../index.html`, `oscilloscope/index.html`, etc.),
so nothing should be moved out on its own.

## What's wired up already

- **Landing page** (`index.html`) — cards for all five tools, animated
  oscilloscope-trace hero, Rudiment cross-links, Buy Me a Coffee footer link.
- **Every web tool** has a small "← Thermalsock Labs" link back to the hub,
  placed to avoid each app's own UI (Oscilloscope/Sound Design: existing
  top bar; Signal Path: existing header; Transient Lab: a new thin strip
  above the canvas, same technique the app's own compat-banner already used).
- **Sound Design** is now fully standalone under `sound-design/` — its own
  copy of the shared shell CSS, its own `soundDesign.js`/`synthPresets.js`,
  no dependency on the `oscilloscope/` folder in either direction. The old
  in-app "Oscilloscope / Sound Design" tab switcher is gone from both, since
  they're siblings under the hub now rather than pages of the same app.
- **Transient Lab's support widget** (bottom-right) now has live Steam and
  App Store links instead of the commented-out placeholders.

## Before this goes on a real domain

A few things worth doing that weren't part of "package it up":
- **Trademark disclaimer** — Signal Path references real gear (Moog, Strymon,
  Akai, Allen & Heath, etc.) by name. Worth a line somewhere ("independent,
  fan-made reference tool, not affiliated with...") before this is public and
  monetized — not something I can give you a legal sign-off on, just flagging
  it.
- **Favicon** — everything currently uses a blank `data:,` icon.
- **Analytics / affiliate links** — if you want to track traffic or add gear
  affiliate links (mentioned earlier for Signal Path), neither is wired up
  yet.
- **App Store URL** — swap in once the listing goes live (see above).
