export const canvasWidth = 1920;

export const canvasHeight = 1080;

export const leftPanelWidth = 200;

export const topBarHeight = 50;

export const topMargin = topBarHeight;

export const bottomLabelHeight = 56;

export const GUIDE_ZONE_PERCENT = .2;

export const ANALYSIS_ZONE_PERCENT = .15;

const contentTop = topMargin;

const contentBottom = canvasHeight - bottomLabelHeight;

const contentHeight = contentBottom - contentTop;

export const guideZoneTop = contentTop;

export const guideZoneHeight = contentHeight * GUIDE_ZONE_PERCENT;

export const guideZoneBottom = contentTop + guideZoneHeight;

export const analysisZoneTop = guideZoneBottom;

export const analysisZoneHeight = contentHeight * ANALYSIS_ZONE_PERCENT;

export const analysisZoneBottom = analysisZoneTop + analysisZoneHeight;

export const noteGridTop = analysisZoneBottom;

export const HIT_LINE_PERCENT_FROM_BOTTOM = .15;

export const laneGap = 2;

export const gridStartX = leftPanelWidth + 20;

export const gridEndXPadding = 20;

export const stepHeight = 26;

export const BEATS_VISIBLE = 8;