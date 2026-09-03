// theme.js
//
// Ported from Rudiment as-is. Same Ableton-Live-inspired Light/Mid/Dark
// system, same key structure — every other file imports the single
// `theme` object and reads it live at draw time. Only difference from
// Rudiment: laneSwatches here has no special-cased indices (Rudiment's
// 9/10/11 were hand-picked to match its three most-used drum lanes;
// this app's "lanes" are pitches, so lane-identity color assignment
// will be driven by the lesson/scale content once that lands, not
// hardcoded here).

const laneSwatches = [
  "#e0577b", "#e08a2b", "#d6b52b", "#8db52b",
  "#3fae6a", "#2ba89a", "#2f8fc4", "#4f6fd6",
  "#7c5fd6", "#c76bf7", "#6bb5f7", "#f7e26b"
];

const semantics = {
  score:        "#b9760a",
  consistency:  "#2f7fc4",
  streak:       "#3f9e4d",
  streakPro:    "#8a4fc4",
  // A single subdued color for every not-yet-judged falling block.
  // Originally these used laneSwatches (one of ~12 saturated colors
  // per lane), which read as a busy rainbow across 36 columns -- this
  // is deliberately one calm, desaturated tone shared by every pending
  // block regardless of which lane it's in. Judgement colors
  // (hit/partial/miss, drawn from score/streak/playhead below) still
  // differ once a block resolves -- that's meaningful feedback, not
  // decoration, so it's left alone.
  noteBlock:    "#6c8299",
  // A single dark tone for piano black keys, shared across all
  // themes -- unlike most colors here, real piano black keys don't
  // get lighter in a "light" room, so this stays fixed rather than
  // being theme-tinted like everything else.
  // A dark "instrument display" background for the EQ/oscilloscope --
  // shared across all app themes (not tinted per-theme) the same way
  // pianoKeyBlack is, since real scope/analyzer hardware has its own
  // fixed dark screen regardless of the room around it. Modeled on a
  // classic analog CRT scope: near-black background, faint green
  // graticule grid, glowing phosphor-green trace.
  scopeBg: "#050a07",
  scopeGridLine: "rgba(70,255,140,0.14)",
  scopeGridLineBright: "rgba(70,255,140,0.28)", // center row/column of the graticule
  scopeTraceLive: "#4dff8f",   // phosphor green
  scopeTraceFrozen: "#8fd8ff", // icy blue-white -- visually distinct "this is frozen" cue
  pianoKeyBlack: "#232323",
  laneSwatches
};

const light = {
  ...semantics,
  appBg:        "#c6c6c6",
  panelBg:      "#d3d3d3",
  panelBgAlt:   "#c9c9c9",
  gridBgA:      "#f4f4f4",
  gridBgB:      "#eeeeee",
  gridBgInactive: "#e3e3e3",
  moduleBg:     "#e6e6e6",
  fieldBg:      "#ffffff",
  fieldBgActive: "#ffffff",

  border:       "#adadad",
  borderStrong: "#8a8a8a",
  gridLineMinor: "rgba(0,0,0,0.05)",
  gridLineMajor: "rgba(0,0,0,0.14)",
  midLine:      "rgba(0,0,0,0.10)",
  midLineDim:   "rgba(0,0,0,0.04)",

  textPrimary:  "#242424",
  textSecondary:"#5c5c5c",
  textDim:      "#9c9c9c",
  textOnAccent: "#ffffff",

  accent:       "#e0930f",
  accentDeep:   "#a8690a",
  accentBg:     "rgba(224, 147, 15, 0.16)",
  // A much fainter version of accentBg, for marking "this lane is
  // used somewhere in the active lesson" across dozens of columns at
  // once -- accentBg itself is reserved for the single chord actually
  // being previewed right now (see Grid.js), so this needed to be
  // visually distinct from that, not just a lighter copy of the same
  // idea applied everywhere.
  accentBgSubtle: "rgba(224, 147, 15, 0.07)",

  toggleOnBg:   "#3d7fd6",
  toggleOnText: "#ffffff",
  toggleOffBg:  "#c2c2c2",
  toggleOffText:"#4a4a4a",

  playhead:     "#d6393e",

  buttonBg:     "#e2e2e2",
  buttonBorder: "#a8a8a8",
  buttonActiveBg: "rgba(61, 127, 214, 0.18)",
  buttonActiveBorder: "#3d7fd6"
};

const mid = {
  ...semantics,
  appBg:        "#4d4d4d",
  panelBg:      "#494949",
  panelBgAlt:   "#434343",
  gridBgA:      "#3e3e3e",
  gridBgB:      "#3a3a3a",
  gridBgInactive: "#333333",
  moduleBg:     "#454545",
  fieldBg:      "#2e2e2e",
  fieldBgActive: "#333333",

  border:       "#5c5c5c",
  borderStrong: "#7f7f7f",
  gridLineMinor: "rgba(255,255,255,0.04)",
  gridLineMajor: "rgba(255,255,255,0.10)",
  midLine:      "rgba(255,255,255,0.08)",
  midLineDim:   "rgba(255,255,255,0.03)",

  textPrimary:  "#e8e8e8",
  textSecondary:"#b0b0b0",
  textDim:      "#7d7d7d",
  textOnAccent: "#ffffff",

  accent:       "#e8a020",
  accentDeep:   "#f0b243",
  accentBg:     "rgba(232, 160, 32, 0.20)",
  accentBgSubtle: "rgba(232, 160, 32, 0.09)",

  toggleOnBg:   "#4a8fe0",
  toggleOnText: "#ffffff",
  toggleOffBg:  "#5c5c5c",
  toggleOffText:"#d8d8d8",

  playhead:     "#ff5a5f",

  buttonBg:     "#414141",
  buttonBorder: "#666666",
  buttonActiveBg: "rgba(74, 143, 224, 0.28)",
  buttonActiveBorder: "#4a8fe0"
};

const dark = {
  ...semantics,
  appBg:        "#232323",
  panelBg:      "#262626",
  panelBgAlt:   "#202020",
  gridBgA:      "#1e1e1e",
  gridBgB:      "#1a1a1a",
  gridBgInactive: "#151515",
  moduleBg:     "#2a2a2a",
  fieldBg:      "#141414",
  fieldBgActive: "#1a1a1a",

  border:       "#3c3c3c",
  borderStrong: "#5c5c5c",
  gridLineMinor: "rgba(255,255,255,0.035)",
  gridLineMajor: "rgba(255,255,255,0.09)",
  midLine:      "rgba(255,255,255,0.07)",
  midLineDim:   "rgba(255,255,255,0.03)",

  textPrimary:  "#e8e8e8",
  textSecondary:"#9a9a9a",
  textDim:      "#6a6a6a",
  textOnAccent: "#ffffff",

  accent:       "#f0a020",
  accentDeep:   "#f5b545",
  accentBg:     "rgba(240, 160, 32, 0.20)",
  accentBgSubtle: "rgba(240, 160, 32, 0.09)",

  toggleOnBg:   "#4a8fe0",
  toggleOnText: "#ffffff",
  toggleOffBg:  "#3a3a3a",
  toggleOffText:"#c8c8c8",

  playhead:     "#ff5a5f",

  buttonBg:     "#2c2c2c",
  buttonBorder: "#4a4a4a",
  buttonActiveBg: "rgba(74, 143, 224, 0.25)",
  buttonActiveBorder: "#4a8fe0"
};

const fieldNotes = {
  ...semantics,
  appBg:        "#EDE6D6",
  panelBg:      "#E4DBC7",
  panelBgAlt:   "#DED2B4",
  gridBgA:      "#E4DBC7",
  gridBgB:      "#DED2B4",
  gridBgInactive: "#D8CBA8",
  moduleBg:     "#E4DBC7",
  fieldBg:      "#F3ECDD",
  fieldBgActive: "#FBF6EC",

  border:       "#C9BFA0",
  borderStrong: "#8A7A57",
  gridLineMinor: "rgba(43,38,32,0.06)",
  gridLineMajor: "rgba(43,38,32,0.14)",
  midLine:      "rgba(43,38,32,0.10)",
  midLineDim:   "rgba(43,38,32,0.04)",

  textPrimary:  "#2B2620",
  textSecondary:"#5C5346",
  textDim:      "#8A8070",
  textOnAccent: "#FBF6EC",

  accent:       "#8B4A2B",
  accentDeep:   "#6b3a20",
  accentBg:     "rgba(139, 74, 43, 0.16)",
  accentBgSubtle: "rgba(139, 74, 43, 0.07)",

  toggleOnBg:   "#33475C",
  toggleOnText: "#FBF6EC",
  toggleOffBg:  "#C9BFA0",
  toggleOffText:"#5C5346",

  playhead:     "#b8402a",

  buttonBg:     "#DED2B4",
  buttonBorder: "#C9BFA0",
  buttonActiveBg: "rgba(51, 71, 92, 0.18)",
  buttonActiveBorder: "#33475C"
};


// The site theme, as a fifth variant rather than a replacement.
//
// This file already had a working four-way theme system with a cycle button,
// so overwriting fieldNotes would have thrown away a feature to save an edit.
// `console` mirrors the palette the rest of the site now uses, and becomes
// the default; the other four are still one press of the theme button away.
//
// Two families are deliberately NOT tinted, and they were already exempt for
// the same reason: the scope colours (real analyser hardware has its own dark
// screen whatever the room is doing) and pianoKeyBlack (black keys do not get
// lighter in a light room). Those live in `semantics` and are inherited here
// untouched.
const consoleTheme = {
  ...semantics,
  appBg:        "#0B0D12",
  panelBg:      "#0F1118",
  panelBgAlt:   "#141821",
  gridBgA:      "#0F1118",
  gridBgB:      "#12151D",
  gridBgInactive: "#0A0C11",
  moduleBg:     "#101420",
  fieldBg:      "#161A22",
  fieldBgActive: "#1C222C",

  border:       "#242A35",
  borderStrong: "#3A4350",
  gridLineMinor: "rgba(138,160,184,0.06)",
  gridLineMajor: "rgba(138,160,184,0.14)",
  midLine:      "rgba(138,160,184,0.10)",
  midLineDim:   "rgba(138,160,184,0.04)",

  textPrimary:  "#E7F4FF",
  textSecondary:"#8AA0B8",
  textDim:      "#5E6A7A",
  textOnAccent: "#04222C",

  accent:       "#00C8FF",
  accentDeep:   "#6FE0FF",
  accentBg:     "rgba(0, 200, 255, 0.18)",
  accentBgSubtle: "rgba(0, 200, 255, 0.08)",

  toggleOnBg:   "#00C8FF",
  toggleOnText: "#04222C",
  toggleOffBg:  "#242A35",
  toggleOffText:"#8AA0B8",

  playhead:     "#FF5A6E",

  buttonBg:     "#161A22",
  buttonBorder: "#242A35",
  buttonActiveBg: "rgba(0, 200, 255, 0.20)",
  buttonActiveBorder: "#00C8FF"
};

export const themeVariants = { console: consoleTheme, fieldNotes, light, mid, dark };
const THEME_ORDER = ["console", "fieldNotes", "light", "mid", "dark"];

export const theme = { ...consoleTheme };

export let currentThemeName = (() => {
  try {
    const saved = localStorage.getItem("themeName");
    if (saved && themeVariants[saved]) return saved;
  } catch (e) {
    // localStorage unavailable — fall back to default silently
  }
  return "console";
})();

Object.assign(theme, themeVariants[currentThemeName]);

export function setTheme(name) {
  if (!themeVariants[name]) return;
  currentThemeName = name;
  Object.assign(theme, themeVariants[name]);
  try {
    localStorage.setItem("themeName", name);
  } catch (e) {
    // Persistence is best-effort — theme still applies for this session.
  }
}

export function cycleTheme() {
  const i = THEME_ORDER.indexOf(currentThemeName);
  setTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
}
