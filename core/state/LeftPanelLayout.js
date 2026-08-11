// LeftPanelLayout.js
//
// Same discipline as Rudiment: every box computed here, drawing code
// reads box.x/y/w/h and never hand-increments its own separate y —
// one source of truth.
//
// The layout now reflows based on contentState.contentCategory: when
// "Scales" is active there's a Scale Type selector (Major/Minor/
// Modes/Pentatonic/Blues -- pick the kind of scale before picking the
// specific one) sitting above the Pack selector; when "Genres" is
// active that box doesn't exist at all and the Pack selector sits
// where it otherwise would. Every box below reflows off of whichever
// boxes actually exist above it, so nothing needs a second hardcoded
// "genres version" vs "scales version" of the whole layout.

import { contentState } from "./ContentState.js";

export function getLeftPanelLayout() {
  const colX = 20;
  const colW = 160;

  const midiStatusBox = { x: colX, y: 70, w: colW, h: 42 };

  const scalesHalf = { x: colX, y: 126, w: 78, h: 32 };
  const genresHalf = { x: colX + 82, y: 126, w: 78, h: 32 };

  const inScales = contentState.contentCategory === "scales";

  // Gap between stacked boxes -- each box's label sits ABOVE it
  // (box.y - 7, see LeftPanel.js's labelY) and needs real clearance
  // from the PREVIOUS box's bottom edge for its own font ascent (~9px
  // for the 12px labels here). The old 14px gap only left 14-7=7px,
  // less than that 9px ascent -- an actual 2px overlap, confirmed
  // arithmetically before this fix, not just eyeballed from a
  // screenshot.
  const boxGap = 20;

  let cursorY = 172;
  let scaleTypeBox = null;
  if (inScales) {
    scaleTypeBox = { x: colX, y: cursorY, w: colW, h: 36 };
    cursorY = scaleTypeBox.y + scaleTypeBox.h + boxGap;
  }

  const packBox = { x: colX, y: cursorY, w: colW, h: 36 };
  cursorY = packBox.y + packBox.h + boxGap;

  const bpmBox = { x: colX, y: cursorY, w: 70, h: 30 };
  const tapTempoBox = { x: colX + 90, y: cursorY, w: 70, h: 30 };
  cursorY += 30 + boxGap;

  const nowLearningBox = { x: colX, y: cursorY, w: colW, h: 46 };

  const transportButtonSize = 34;
  const transportGap = 10;
  const transportY = 900;
  const transport = {
    y: transportY,
    size: transportButtonSize,
    start: { x: colX, y: transportY, w: transportButtonSize, h: transportButtonSize },
    stop: { x: colX + (transportButtonSize + transportGap), y: transportY, w: transportButtonSize, h: transportButtonSize },
    pause: { x: colX + (transportButtonSize + transportGap) * 2, y: transportY, w: transportButtonSize, h: transportButtonSize },
    reset: { x: colX + (transportButtonSize + transportGap) * 3, y: transportY, w: transportButtonSize, h: transportButtonSize }
  };

  const watermarkZone = {
    x: colX,
    top: nowLearningBox.y + nowLearningBox.h + 20,
    bottom: transport.y - 30
  };

  return {
    midiStatusBox,
    scalesHalf,
    genresHalf,
    scaleTypeBox,
    packBox,
    bpmBox,
    tapTempoBox,
    nowLearningBox,
    transport,
    watermarkZone
  };
}
