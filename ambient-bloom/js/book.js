// book.js
// Owns the writing surface: where the next glyph goes, when a line wraps,
// when a page is full and needs to turn. Pure layout/state logic —
// rendering the actual page image happens elsewhere (via an offscreen
// canvas per page, drawn into incrementally so we never have to replay
// history), but the *decision* of where things go lives here, separately,
// so it can be tested without a real canvas.

import { GLYPH_ADVANCE } from './glyphs.js';

export class PageLayout {
  constructor({ width, height, marginX = 24, marginTop = 34, marginBottom = 28, lineHeight = 30 }) {
    this.width = width;
    this.height = height;
    this.marginX = marginX;
    this.marginTop = marginTop;
    this.marginBottom = marginBottom;
    this.lineHeight = lineHeight;
    this.colsPerLine = Math.floor((width - marginX * 2) / GLYPH_ADVANCE);
    this.lineCount = Math.floor((height - marginTop - marginBottom) / lineHeight);
    this.col = 0;
    this.line = 0;
  }

  get isFull() {
    return this.line >= this.lineCount;
  }

  /** Returns the pixel position for the next glyph, then advances the cursor. */
  nextSlot() {
    if (this.isFull) return null;
    const x = this.marginX + this.col * GLYPH_ADVANCE + GLYPH_ADVANCE / 2;
    const y = this.marginTop + this.line * this.lineHeight;
    this.col++;
    if (this.col >= this.colsPerLine) {
      this.col = 0;
      this.line++;
    }
    return { x, y };
  }

  /** Fraction of the page filled, 0..1 — used for the fill-progress readout. */
  get fillFraction() {
    const totalSlots = this.colsPerLine * this.lineCount;
    const filledSlots = this.line * this.colsPerLine + this.col;
    return totalSlots > 0 ? Math.min(1, filledSlots / totalSlots) : 1;
  }

  get baselineYs() {
    const ys = [];
    for (let i = 0; i < this.lineCount; i++) ys.push(this.marginTop + i * this.lineHeight);
    return ys;
  }
}

/**
 * Book state machine: two-page spread (left, right), fills left completely
 * then right, then signals a page turn is needed. Deliberately has no
 * rendering/canvas dependency — placeGlyph() just returns where the mark
 * goes and whether that triggered a page turn, so the placement logic can
 * be unit tested directly.
 */
export class Book {
  constructor(pageOptions) {
    this.pageOptions = pageOptions;
    this.left = new PageLayout(pageOptions);
    this.right = new PageLayout(pageOptions);
    this.pageNumber = 1; // spread number, increments each turn
  }

  get activePage() {
    return this.left.isFull ? this.right : this.left;
  }

  get spreadFillFraction() {
    return (this.left.fillFraction + this.right.fillFraction) / 2;
  }

  get isSpreadFull() {
    return this.left.isFull && this.right.isFull;
  }

  /**
   * Places the next glyph. Returns { side, x, y, turnedPage } — turnedPage
   * is true if this call caused the spread to complete (caller should
   * start a page-turn animation and then call startNewSpread()).
   */
  placeGlyph() {
    if (this.isSpreadFull) return null;
    const page = this.activePage;
    const side = page === this.left ? 'left' : 'right';
    const slot = page.nextSlot();
    if (!slot) return null;
    const turnedPage = this.isSpreadFull;
    return { side, x: slot.x, y: slot.y, turnedPage };
  }

  /**
   * Advances the cursor by one slot without drawing anything — used to
   * represent a pause in the music as a space on the page. Mirrors
   * placeGlyph's turn-detection so a pause landing exactly on the last
   * slot of a spread still turns the page correctly.
   */
  skipSlot() {
    if (this.isSpreadFull) return null;
    const page = this.activePage;
    page.nextSlot();
    return { turnedPage: this.isSpreadFull };
  }

  startNewSpread() {
    this.left = new PageLayout(this.pageOptions);
    this.right = new PageLayout(this.pageOptions);
    this.pageNumber += 1;
  }
}
