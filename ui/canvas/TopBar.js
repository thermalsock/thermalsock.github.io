import { leftPanelWidth, topBarHeight } from "../../core/state/Layout.js";
import { theme, currentThemeName } from "../theme/theme.js";
import { bpm } from "../../core/state/UIState.js";
import { getActiveLesson } from "../../core/state/ContentState.js";
import { findCurrentEventIndex } from "../../core/engine/Timeline.js";
function getFullscreenButtonBox(canvas) {
    const size = 26;
    return { x: canvas.width - size - 14, y: 8, w: size, h: size };
}
function getThemeButtonBox(canvas) {
    const fs = getFullscreenButtonBox(canvas);
    const size = 26;
    return { x: fs.x - 10 - size, y: fs.y, w: size, h: size };
}
export function hitTestFullscreenButton(x, y, canvas) {
    const b = getFullscreenButtonBox(canvas);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
export function hitTestThemeButton(x, y, canvas) {
    const b = getThemeButtonBox(canvas);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
function drawThemeButton(ctx, canvas) {
    const b = getThemeButtonBox(canvas);
    ctx.fillStyle = theme.buttonBg;
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.stroke();
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fillStyle = theme.textSecondary;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = theme.textSecondary;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineWidth = 1;
}
function drawFullscreenButton(ctx, canvas) {
    const b = getFullscreenButtonBox(canvas);
    ctx.fillStyle = theme.buttonBg;
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.stroke();
    const pad = 6;
    const armLen = 5;
    const x0 = b.x + pad, y0 = b.y + pad;
    const x1 = b.x + b.w - pad, y1 = b.y + b.h - pad;
    ctx.strokeStyle = theme.textSecondary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + armLen);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + armLen, y0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 - armLen, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y0 + armLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y1 - armLen);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x0 + armLen, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 - armLen, y1);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, y1 - armLen);
    ctx.stroke();
    ctx.lineWidth = 1;
}
function findCurrentAndNext(timeline, currentBeat) {
    const events = timeline.events;
    const currentIndex = findCurrentEventIndex(timeline, currentBeat);
    const current = currentIndex >= 0 ? events[currentIndex] : null;
    const next = events.length
        ? events[(currentIndex + 1) % events.length]
        : null;
    return { current, next };
}
export function drawTopBar(ctx, canvas, timeline, currentBeat) {
    const x = leftPanelWidth;
    const w = canvas.width - leftPanelWidth;
    ctx.fillStyle = theme.panelBgAlt;
    ctx.fillRect(x, 0, w, topBarHeight);
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(x, topBarHeight);
    ctx.lineTo(x + w, topBarHeight);
    ctx.stroke();
    const lesson = getActiveLesson();
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(lesson.title, x + 20, topBarHeight / 2 - 6);
    const { current, next } = findCurrentAndNext(timeline, currentBeat);
    let cursorX = x + 20;
    const baseY = topBarHeight / 2 + 12;
    ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.fillText("NOW", cursorX, baseY);
    cursorX += ctx.measureText("NOW").width + 6;
    ctx.font = "bold 13px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.accentDeep;
    const nowText = current ? current.label : "—";
    ctx.fillText(nowText, cursorX, baseY);
    cursorX += ctx.measureText(nowText).width + 22;
    ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textDim;
    ctx.fillText("NEXT", cursorX, baseY);
    cursorX += ctx.measureText("NEXT").width + 6;
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textSecondary;
    const nextText = next ? next.label : "—";
    ctx.fillText(nextText, cursorX, baseY);
    ctx.textAlign = "right";
    ctx.font = "11px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(`${bpm} BPM  ·  ${currentThemeName}  ·  space play/pause, ←/→ chord, ↑/↓ lesson, p pack, f fullscreen`, x + w - 90, topBarHeight / 2 + 4);
    ctx.textAlign = "left";
    drawThemeButton(ctx, canvas);
    drawFullscreenButton(ctx, canvas);
}
