import { spriteCanvas } from './render/pixelart.js';

export function drawHud(ctx, { p1, p2 }) {
  portrait(ctx, p1.art, 24, 8, false, p1.pfp);
  portrait(ctx, p2.art, 936, 8, true, p2.pfp);
  bar(ctx, 96, 24, 320, p1.health / p1.max, '#CC785C', false, p1.name, p1.company);
  bar(ctx, 544, 24, 320, p2.health / p2.max, '#10A37F', true, p2.name, p2.company);
}

function portrait(ctx, art, x, y, flip, pfp) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(-2, -2, 64, 66);
  ctx.strokeStyle = '#1D9BF0';
  ctx.lineWidth = 2;
  ctx.strokeRect(-2, -2, 64, 66);
  if (pfp && pfp.complete && pfp.naturalWidth > 0) {
    // real photo portrait; unflip so faces are never mirrored oddly
    if (flip) { ctx.scale(-1, 1); ctx.translate(-60, 0); }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pfp, 0, 0, 60, 63);
  } else if (art && art.parts) {
    ctx.imageSmoothingEnabled = false;
    const head = spriteCanvas(art.parts.head, 3);
    ctx.drawImage(head, 0, 0, 60, 63);
  }
  ctx.restore();
}

function bar(ctx, x, y, w, frac, color, rightAlign, name, company) {
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(x, y, w, 22);
  ctx.strokeStyle = '#1D9BF0';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 22);

  ctx.fillStyle = color;
  const fw = Math.max(0, w - 4) * frac;
  ctx.fillRect(rightAlign ? x + (w - 2) - fw : x + 2, y + 2, fw, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(rightAlign ? x + (w - 2) - fw : x + 2, y + 2, fw, 6);

  ctx.fillStyle = '#F0EEE6';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = rightAlign ? 'right' : 'left';
  ctx.fillText(name, rightAlign ? x + w : x, y + 42);
  ctx.fillStyle = '#6a7f95';
  ctx.font = '12px monospace';
  ctx.fillText(company, rightAlign ? x + w : x, y + 58);
}
