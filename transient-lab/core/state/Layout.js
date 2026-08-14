// Layout.js
//
// Rudiment's grid was horizontal: fixed lanes (rows) scrolling past a
// fixed vertical playhead. This app rotates that 90° — fixed pitch
// columns, content falling top-to-bottom past a fixed horizontal hit
// line near the bottom of the grid (piano-roll / falling-note
// convention, matches how a MIDI keyboard sits below the screen).
//
// Colors still live only in theme.js, same discipline as Rudiment —
// nothing here is a color.

export const canvasWidth = 1920;
export const canvasHeight = 1080;

export const leftPanelWidth = 200;
export const topBarHeight = 50;   // score / lesson-name bar
export const topMargin = topBarHeight;

// Gives the falling-note grid enough real space below it for actual
// piano-key visuals (BottomLabels.js), not just single-line text
// labels -- bumped up from the original 40px.
export const bottomLabelHeight = 56;

// The content area below the top bar is split THREE ways: the
// synth-patch guide (SynthGuide.js), the audio-analysis bar
// (AnalysisBar.js — EQ, oscilloscope, live chord info), and the
// falling-note grid gets the rest. Both the guide and analysis zones
// were bumped up from their original 0.16/0.13 -- their contents
// (knobs, EQ/scope, chord readout) were reading too small at the
// tighter sizing. The grid still keeps the clear majority of the
// space (~62% of the content area) even after this increase.
export const GUIDE_ZONE_PERCENT = 0.20;
export const ANALYSIS_ZONE_PERCENT = 0.15;

const contentTop = topMargin;
const contentBottom = canvasHeight - bottomLabelHeight;
const contentHeight = contentBottom - contentTop;

export const guideZoneTop = contentTop;
export const guideZoneHeight = contentHeight * GUIDE_ZONE_PERCENT;
export const guideZoneBottom = contentTop + guideZoneHeight;

export const analysisZoneTop = guideZoneBottom;
export const analysisZoneHeight = contentHeight * ANALYSIS_ZONE_PERCENT;
export const analysisZoneBottom = analysisZoneTop + analysisZoneHeight;

// The falling-note grid now starts right after the analysis bar.
export const noteGridTop = analysisZoneBottom;

// The hit line sits HIT_LINE_PERCENT_FROM_BOTTOM of the way up from
// the grid's bottom edge, not jammed right at the edge — leaves a
// visible "linger zone" below the line where a just-played block is
// still on screen for a moment after crossing it, instead of vanishing
// the instant it arrives. Computed as a percentage (not a fixed pixel
// value) in Grid.js, from the grid's own real height, so it stays
// correct regardless of canvas size.
export const HIT_LINE_PERCENT_FROM_BOTTOM = 0.15;

// Column geometry. laneCount/laneWidth are placeholders for the shell —
// once lessons exist, the active lane set (how many pitches are visible
// and which ones) will come from lesson content, not a fixed constant.
export const laneGap = 2;
export const gridStartX = leftPanelWidth + 20;
export const gridEndXPadding = 20;

// Vertical fall speed, in pixels per beat-subdivision — the rotated
// equivalent of Rudiment's stepWidth. Keeping the same name pattern
// (stepHeight not stepWidth) so it's immediately obvious this is the
// axis that changed.
export const stepHeight = 26;

// How many beats of "lead time" are visible in the APPROACH zone
// (above the hit line) at once — a block spawns BEATS_VISIBLE beats
// before its hitBeat and reaches the hit line exactly on time. Higher
// = more warning/reaction time. Pixels-per-beat is derived from this
// and the approach zone's real height (see Blocks.js), not hardcoded.
//
// Set higher than a typical chord's own duration (4 beats) on purpose:
// this is the actual root cause of the original bug. Block LENGTH is
// (once again) the chord's real held duration, same as Guitar Hero/
// Synthesia/Clone Hero-style sustain bars — but with BEATS_VISIBLE
// equal to a typical chord's duration, pixelsPerBeat worked out so
// that a 4-beat chord's rendered length exactly equaled the whole
// approach zone, filling the entire grid the instant it appeared.
// Decoupling this from typical chord length (8 beats of runway shown,
// vs ~4 beats of typical hold) means a held chord now visibly occupies
// roughly half the approach zone — long enough to clearly read as "hold
// this", with room above it to see the next one already queued up.
export const BEATS_VISIBLE = 8;
