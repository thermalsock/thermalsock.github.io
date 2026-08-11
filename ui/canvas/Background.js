import { theme } from "../theme/theme.js";
export function drawBackground(ctx, canvas) {
    ctx.fillStyle = theme.gridBgA;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
