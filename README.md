# Thermalsock Labs — site

Static site, no build step. Eleven browser tools plus a hub page.

```
index.html                 Hub / landing page (start here)
404.html                   Not-found page
favicon.svg                Site icon
share-card.svg             Open Graph / Twitter share image
robots.txt, sitemap.xml    Crawler files

shared/
  chrome.css               The header, brand lockup, status pill and related-
                           links styling. ONE definition for all 11 apps —
                           there used to be nine drifted copies. Load it
                           before the app's own stylesheet. Per-app identity
                           colour comes from --app-accent, keyed off
                           <html data-app="...">.
  session.js               Site-wide session: the chosen audio input device
                           (so you pick your interface once, not in six
                           separate gates) and the cross-app "Related" links.
  app-switcher.js          Cross-app navigation. Single source of truth for
                           the tool list — add a tool here and it appears in
                           the switcher on every page.
  shortcuts.js             Keyboard-shortcut registry + the "?" help overlay.
  persist.js               Namespaced, try/catch-wrapped localStorage helper.

oscilloscope/              Web Oscilloscope — dual-trace scope, FFT, tuner
granulator/                Granulator — real-time granular processor
spectral-mutation-lab/     Spectral Mutation Lab — FFT bin mutation
loom/                      Loom — modal chord & drone engine
subharmonicon/             Subharmonicon — ratio tuning aid
modulus-studio/            Modulus Studio — LFO & envelope modelling
sound-design/              Sound Design — Take 5 patch reference
illuminated-ear/           The Illuminated Ear — ear-training game
transient-lab/             Transient Lab — MIDI ear & hand trainer
ambient-bloom/             Ambient Bloom — audio-reactive manuscript
signal-path/               Signal Path — hardware rig mapper

legal/
  privacy.html
  disclaimer.html
```

Rudiment isn't a folder here — it's a native Steam title, so the hub and
Transient Lab's support widget link out to it:
<https://store.steampowered.com/app/5065240/Rudiment/>

## Running it locally

**Serve it over `http://`, not `file://`.** Several apps use ES modules
(`<script type="module">`) and `AudioWorklet`, both of which browsers block on
`file://`. Some also need `getUserMedia`, which requires a secure context
(`localhost` counts).

- **VS Code Live Server**: right-click `index.html` → "Open with Live Server".
- **Or from a terminal** at the site root: `python3 -m http.server 8000`,
  then open <http://localhost:8000>.

Always serve the whole site root, not an individual app folder — the apps
reference `../shared/` and `../legal/`.

## Conventions

**Palette and type (the "Field Notes" system).** Paper `#EDE6D6`, deep paper
`#E4DBC7`, ink `#2B2620`, soft ink `#5C5346`, faint ink `#8A8070`, rust accent
`#8B4A2B`. Fraunces for display, Newsreader for body, IBM Plex Mono for labels
and readouts. No hardcoded dark-theme values — several rounds of bugs came from
leftover `rgba(10,13,22,…)`-style literals surviving a token swap.

**Every app page needs:**
- `<html data-app="folder-name">` — this drives `--app-accent`
- `<meta name="description">`, canonical, favicon, and og/twitter tags
- `<link rel="stylesheet" href="../shared/chrome.css">` BEFORE its own CSS
- an app-switcher mount: `<nav data-app-switcher="folder-name" data-base="../"></nav>`
- a related-links mount: `<div data-related data-base="../"></div>`
- `<script src="../shared/persist.js">`, `session.js`, `shortcuts.js`, then
  the app's own scripts, then `app-switcher.js`
- a `#legalBar` and a support widget
- "Start listening" as the permission-gate button label

**Never redefine** `.topbar`, `.brand-lockup`, `.brand-appname`, `.brand-sub`,
`.topbar-right`, `.pill` or `.status-dot` in an app stylesheet. They live in
`shared/chrome.css`. Apps fill the header's right-hand slot; they don't
restyle the bar.

**Never put inline code in a `<script src="...">` tag.** The browser runs the
external file and silently ignores the inline body — no error, no log, the
code simply never executes. This shipped three times before `verify.js` grew
a `DEADJS` check for it.

**Persistence** goes through `shared/persist.js`, which namespaces keys per app
and swallows the exceptions private browsing throws.

**Keyboard shortcuts** are registered through `shared/shortcuts.js`, which also
renders the `?` help overlay — so a shortcut can't exist without being
documented.

**Audio input** should use the shared louder-channel selection, never
`timeData[0]`. Reading a fixed channel means the app sees silence whenever the
interface routes signal to the other one, and averaging the two can phase-cancel
a real signal to near nothing.

## Verifying changes

`tests/` holds Node unit tests for the logic that isn't safe to eyeball —
page/history navigation, lesson accuracy scoring, and the audition engine's
level mappings. They stub `localStorage` where needed and need no browser:

```
for f in tests/*.mjs; do node "$f"; done
```


`verify.js` checks every HTML file for CSS brace balance, tag balance, duplicate
IDs and inline-script syntax, and syntax-checks every `.js` file:

```
node verify.js .
```
