import { drawBackground } from "./Background.js";
import { drawTopBar } from "./TopBar.js";
import { drawSynthGuide } from "./SynthGuide.js";
import { drawAnalysisBar, drawMaximizedScope } from "./AnalysisBar.js";
import { drawGrid } from "./Grid.js";
import { drawBlocks } from "./Blocks.js";
import { drawBottomLabels } from "./BottomLabels.js";
import { drawLeftPanel } from "./LeftPanel.js";
import { controlsState } from "../../core/state/ControlsState.js";
export function render(ctx, canvas, timeline) {
    drawBackground(ctx, canvas);
    drawTopBar(ctx, canvas, timeline, controlsState.currentBeat);
    drawSynthGuide(ctx, canvas);
    drawAnalysisBar(ctx, canvas, timeline, controlsState.currentBeat);
    const gridGeometry = drawGrid(ctx, canvas);
    drawBlocks(ctx, gridGeometry, timeline, controlsState.currentBeat);
    drawBottomLabels(ctx, gridGeometry);
    drawLeftPanel(ctx, canvas);
    drawMaximizedScope(ctx, canvas);
}
