import { contentState } from "./ContentState.js";

export function getLeftPanelLayout() {
  const colX = 20;
  const colW = 160;
  const midiStatusBox = {
    x: colX,
    y: 70,
    w: colW,
    h: 42
  };
  const scalesHalf = {
    x: colX,
    y: 126,
    w: 78,
    h: 32
  };
  const genresHalf = {
    x: colX + 82,
    y: 126,
    w: 78,
    h: 32
  };
  const inScales = contentState.contentCategory === "scales";
  const boxGap = 20;
  let cursorY = 172;
  let scaleTypeBox = null;
  if (inScales) {
    scaleTypeBox = {
      x: colX,
      y: cursorY,
      w: colW,
      h: 36
    };
    cursorY = scaleTypeBox.y + scaleTypeBox.h + boxGap;
  }
  const packBox = {
    x: colX,
    y: cursorY,
    w: colW,
    h: 36
  };
  cursorY = packBox.y + packBox.h + boxGap;
  const bpmBox = {
    x: colX,
    y: cursorY,
    w: 70,
    h: 30
  };
  const tapTempoBox = {
    x: colX + 90,
    y: cursorY,
    w: 70,
    h: 30
  };
  cursorY += 30 + boxGap;
  const nowLearningBox = {
    x: colX,
    y: cursorY,
    w: colW,
    h: 46
  };
  const transportButtonSize = 34;
  const transportGap = 10;
  const transportY = 900;
  const transport = {
    y: transportY,
    size: transportButtonSize,
    start: {
      x: colX,
      y: transportY,
      w: transportButtonSize,
      h: transportButtonSize
    },
    stop: {
      x: colX + (transportButtonSize + transportGap),
      y: transportY,
      w: transportButtonSize,
      h: transportButtonSize
    },
    pause: {
      x: colX + (transportButtonSize + transportGap) * 2,
      y: transportY,
      w: transportButtonSize,
      h: transportButtonSize
    },
    reset: {
      x: colX + (transportButtonSize + transportGap) * 3,
      y: transportY,
      w: transportButtonSize,
      h: transportButtonSize
    }
  };
  const watermarkZone = {
    x: colX,
    top: nowLearningBox.y + nowLearningBox.h + 20,
    bottom: transport.y - 30
  };
  return {
    midiStatusBox: midiStatusBox,
    scalesHalf: scalesHalf,
    genresHalf: genresHalf,
    scaleTypeBox: scaleTypeBox,
    packBox: packBox,
    bpmBox: bpmBox,
    tapTempoBox: tapTempoBox,
    nowLearningBox: nowLearningBox,
    transport: transport,
    watermarkZone: watermarkZone
  };
}