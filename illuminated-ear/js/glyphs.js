function seededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = s * 1664525 + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

function drawLoop(ctx, x, y, angle, rx, ry, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.restore();
}

function drawCurl(ctx, x, y, angle, length, color, alpha) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const endX = x + cos * length, endY = y + sin * length;
  const hookAngle = angle + Math.PI * .7;
  const hookR = length * .28;
  const hookCx = endX + Math.cos(hookAngle) * hookR * .6;
  const hookCy = endY + Math.sin(hookAngle) * hookR * .6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + cos * length * .6 - sin * length * .25, y + sin * length * .6 + cos * length * .25, endX, endY);
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hookCx, hookCy, hookR, hookAngle, hookAngle + Math.PI * 1.4);
  ctx.stroke();
}

function drawStemLoop(ctx, x, y, height, color, alpha) {
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x, y + height * .32);
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + height * .16, y + height * .18, height * .19, height * .15, -.3, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPip(ctx, x, y, r, color, alpha) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
}

const GLYPH_BOX = 15;

const VARIANTS_PER_CLASS = 8;

const STROKE_KINDS = [ "loop", "loop", "loop", "curl", "curl", "stem", "pip" ];

export const GLYPH_TEMPLATES = [];

for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
  for (let variant = 0; variant < VARIANTS_PER_CLASS; variant++) {
    const rand = seededRandom(pitchClass * 7919 + variant * 104729 + 13);
    const strokeCount = 1 + Math.floor(rand() * 3);
    const strokes = [];
    for (let i = 0; i < strokeCount; i++) {
      const kind = STROKE_KINDS[Math.floor(rand() * STROKE_KINDS.length)];
      strokes.push({
        kind: kind,
        x: 2 + rand() * (GLYPH_BOX - 4),
        y: 2 + rand() * (GLYPH_BOX - 4),
        angle: rand() * Math.PI * 2,
        length: 5 + rand() * 5,
        rx: 2 + rand() * 2.4,
        ry: 1.4 + rand() * 1.8,
        height: 8 + rand() * 5,
        r: .7 + rand() * .8
      });
    }
    GLYPH_TEMPLATES.push(strokes);
  }
}

export function drawGlyph(ctx, x, y, pitchClass, strength, inkColor, jitterSeed, sizeMult = 1, skew = 0, jitterAmount = 1, variantOverride = null) {
  const pc = (pitchClass % 12 + 12) % 12;
  const variant = variantOverride != null ? (variantOverride % VARIANTS_PER_CLASS + VARIANTS_PER_CLASS) % VARIANTS_PER_CLASS : jitterSeed % VARIANTS_PER_CLASS;
  const template = GLYPH_TEMPLATES[pc * VARIANTS_PER_CLASS + variant];
  const jitter = seededRandom(jitterSeed >>> 0);
  const scale = (.85 + jitter() * .35) * sizeMult;
  const rotJitter = (jitter() - .5) * .22 * jitterAmount;
  const alphaBase = .55 + strength * .35;
  ctx.save();
  ctx.translate(x, y);
  if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.rotate(rotJitter);
  ctx.scale(scale, scale);
  template.forEach(s => {
    const dx = (jitter() - .5) * 1.2 * jitterAmount;
    const dy = (jitter() - .5) * 1.2 * jitterAmount;
    const a = alphaBase * (.7 + jitter() * .3);
    if (s.kind === "loop") drawLoop(ctx, s.x + dx, s.y + dy, s.angle, s.rx, s.ry, inkColor, a); else if (s.kind === "curl") drawCurl(ctx, s.x + dx, s.y + dy, s.angle, s.length, inkColor, a); else if (s.kind === "stem") drawStemLoop(ctx, s.x + dx, s.y + dy - s.height * .5, s.height, inkColor, a); else drawPip(ctx, s.x + dx, s.y + dy, s.r, inkColor, a);
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawSparkle(ctx, x, y, size, inkColor, alpha, jitterSeed) {
  const jitter = seededRandom(jitterSeed >>> 0);
  const rot = jitter() * Math.PI * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = .85;
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const len = size * (.7 + jitter() * .6);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * len * .22, Math.sin(a) * len * .22);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(.4, size * .16), 0, Math.PI * 2);
  ctx.fillStyle = inkColor;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawBlot(ctx, x, y, strength, inkColor, jitterSeed, jitterAmount = 1) {
  const jitter = seededRandom(jitterSeed >>> 0);
  const baseR = 1.8 + strength * 4.5;
  ctx.save();
  ctx.fillStyle = inkColor;
  ctx.globalAlpha = .55 + strength * .35;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.fill();
  const dropletCount = 2 + Math.floor(strength * 5);
  for (let i = 0; i < dropletCount; i++) {
    const a = jitter() * Math.PI * 2;
    const d = baseR * (.8 + jitter() * 1.6 * jitterAmount);
    const r = baseR * (.12 + jitter() * .24);
    ctx.globalAlpha = (.4 + strength * .3) * (.6 + jitter() * .4);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export const GLYPH_ADVANCE = GLYPH_BOX + 6;