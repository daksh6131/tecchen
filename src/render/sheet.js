// Sprite-sheet renderer: plays 128x128 frames from the CraftPix gangster
// sheets, edited per character at load time to match their real-life look:
// shirt tint, hair recolor (+ curly flecks), and algorithmic glasses.
// State-driven (uses fighter state + clock, not the pose model).

import { spriteCanvas } from './pixelart.js';

const FRAME = 128;
const SCALE = 2.2;
const ANCHOR_X = 59;   // figure's horizontal center within a frame
const ANCHOR_Y = 128;  // feet row within a frame

// pure frame math — unit tested
export function frameIndexFor(anim, clockMs) {
  if (!anim || anim.n <= 0) return 0;
  if (anim.durMs) {
    const i = Math.floor((clockMs / anim.durMs) * anim.n);
    return Math.max(0, Math.min(anim.n - 1, i));
  }
  const i = Math.floor((clockMs / 1000) * (anim.fps || 10));
  return anim.loop === false ? Math.min(anim.n - 1, i) : i % anim.n;
}

// ——— pixel classifiers (pure, unit tested) ————————————————————————
// Shirt: light and unsaturated. Skin: warm tan. Hair: near-black without
// the blue lean of the trousers/outline darks.
export function recolorPixel(r, g, b, tint) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max > 110 && max - min < 38) {
    const lum = max / 255;
    return [
      Math.round(tint[0] * lum),
      Math.round(tint[1] * lum),
      Math.round(tint[2] * lum),
    ];
  }
  return null;
}

export function isHairPixel(r, g, b) {
  return Math.max(r, g, b) < 30 && b <= r + 2;
}

export function isSkinPixel(r, g, b) {
  return r > 170 && g > 95 && g < 210 && b > 60 && b < 170 && r > g && g >= b;
}

export function isGreenAccent(r, g, b) {
  return g > 45 && g > r + 10 && g > b + 10;
}

// Find the sprite's head: hair pixels within the head band (top 45% of the
// figure — dark shoe/pant outlines share the hair color, so the band is
// load-bearing), plus face skin flood-filled from hair-adjacent seeds (a
// raised fist has no hair contact, so it survives). The final erase region
// is the bounding box of that set, catching hair shading the classifier
// misses. Returns solid pixels in the box + neck anchor. Pure; testable.
export function findHead(px, w, x0, frameW = FRAME, frameH = FRAME) {
  const at = (x, y) => ((y * w) + x0 + x) * 4;
  const inb = (x, y) => x >= 0 && x < frameW && y >= 0 && y < frameH;
  const solid = (x, y) => inb(x, y) && px[at(x, y) + 3] > 10;
  const hairAt = (x, y) => {
    const i = at(x, y);
    return solid(x, y) && isHairPixel(px[i], px[i + 1], px[i + 2]);
  };
  const skinAt = (x, y) => {
    const i = at(x, y);
    return solid(x, y) && isSkinPixel(px[i], px[i + 1], px[i + 2]);
  };

  // figure bbox -> head band
  let top = frameH, bot = 0;
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      if (solid(x, y)) { if (y < top) top = y; if (y > bot) bot = y; }
    }
  }
  if (top >= bot) return null;
  // hair lives in the top ~30% of the figure; the belt/waist shadows share
  // the hair color, so the tight band prevents torso-swallowing bboxes
  const bandBottom = top + Math.max(10, Math.round((bot - top) * 0.3));

  // topmost hair pixel, then flood only ITS connected cluster
  let seed = null;
  for (let y = top; y <= bandBottom && !seed; y++) {
    for (let x = 0; x < frameW; x++) {
      if (hairAt(x, y)) { seed = [x, y]; break; }
    }
  }
  if (!seed) return null;

  const head = new Set();
  const hairQ = [seed];
  while (hairQ.length) {
    const [x, y] = hairQ.pop();
    const k = y * frameW + x;
    if (head.has(k) || y > bandBottom + 4 || !hairAt(x, y)) continue;
    head.add(k);
    hairQ.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
               [x + 1, y + 1], [x - 1, y + 1], [x + 1, y - 1], [x - 1, y - 1]);
  }

  // clamp box: the face always sits directly under the hair. Raised arms
  // (jump/knee frames) touch the hair from the side and would otherwise be
  // flooded in and erased — everything outside this box is off limits.
  let bx0 = frameW, bx1 = 0, by0 = frameH, by1 = 0;
  for (const k of head) {
    const y = Math.floor(k / frameW), x = k % frameW;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const hairH = by1 - by0 + 1;
  const clampX0 = bx0 - 2, clampX1 = bx1 + 2;
  const clampY0 = by0 - 1, clampY1 = by1 + (by1 - by0) + 8;
  const inClamp = (x, y) => x >= clampX0 && x <= clampX1 && y >= clampY0 && y <= clampY1;

  const queue = [];
  for (const k of head) {
    const y = Math.floor(k / frameW), x = k % frameW;
    for (const [dx, dy] of [[0, 1], [0, 2], [1, 0], [-1, 0], [1, 1], [-1, 1]]) {
      if (skinAt(x + dx, y + dy) && inClamp(x + dx, y + dy)) queue.push([x + dx, y + dy]);
    }
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    const k = y * frameW + x;
    if (head.has(k) || !inClamp(x, y) || !skinAt(x, y)) continue;
    head.add(k);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  // erase region = bbox of the head set (+1 margin) — catches shading
  let hx0 = frameW, hx1 = 0, hy0 = frameH, hy1 = 0;
  for (const k of head) {
    const y = Math.floor(k / frameW), x = k % frameW;
    if (x < hx0) hx0 = x; if (x > hx1) hx1 = x;
    if (y < hy0) hy0 = y; if (y > hy1) hy1 = y;
  }
  const solidBottom = hy1; // anchor row before the margin expansion
  hx0 = Math.max(0, hx0 - 1); hx1 = Math.min(frameW - 1, hx1 + 1);
  hy0 = Math.max(0, hy0 - 1); hy1 = Math.min(frameH - 1, hy1 + 1);

  const pixels = new Set();
  for (let y = hy0; y <= hy1; y++) {
    for (let x = hx0; x <= hx1; x++) {
      if (solid(x, y)) pixels.add(y * frameW + x);
    }
  }
  // flying hair strands (hurt/lean frames) detach from the main cluster —
  // sweep the whole band for stray hair pixels and their dark fringes
  for (let y = top; y <= bandBottom + 4; y++) {
    for (let x = 0; x < frameW; x++) {
      if (!hairAt(x, y)) continue;
      pixels.add(y * frameW + x);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!solid(nx, ny)) continue;
        const i = at(nx, ny);
        if (Math.max(px[i], px[i + 1], px[i + 2]) < 60 &&
            !isSkinPixel(px[i], px[i + 1], px[i + 2])) {
          pixels.add(ny * frameW + nx);
        }
      }
    }
  }
  // orphan specks: 1-2px fragments in the band with (almost) no solid
  // neighbours — leftover shading dots that read as floating debris
  for (let y = top; y <= bandBottom + 4; y++) {
    for (let x = 0; x < frameW; x++) {
      if (!solid(x, y) || pixels.has(y * frameW + x)) continue;
      let neighbours = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        if (solid(x + dx, y + dy) && !pixels.has((y + dy) * frameW + (x + dx))) neighbours++;
      }
      if (neighbours <= 1) pixels.add(y * frameW + x);
    }
  }

  // estimate the original head's lean (principal axis vs vertical) so the
  // replacement can rotate with the pose instead of floating upright
  let mx = 0, my = 0, n = 0;
  for (const k of pixels) { mx += k % frameW; my += Math.floor(k / frameW); n++; }
  mx /= n; my /= n;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const k of pixels) {
    const dx = (k % frameW) - mx, dy = Math.floor(k / frameW) - my;
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
  }
  let tilt = 0;
  if (cyy > cxx && Math.abs(cxy) > 2) {
    tilt = 0.5 * Math.atan2(2 * cxy, cxx - cyy) - Math.PI / 2;
    while (tilt < -Math.PI / 2) tilt += Math.PI;
    while (tilt > Math.PI / 2) tilt -= Math.PI;
    tilt = Math.max(-0.7, Math.min(0.7, tilt)) * 0.8;
  }

  return {
    pixels,
    cx: Math.round((hx0 + hx1) / 2),
    bottom: solidBottom,
    tilt,
    cyx: Math.round(mx),
    cyy2: Math.round(my),
    hairH,
    hairCx: Math.round((bx0 + bx1) / 2),
    hairTop: by0,
  };
}

// After the head swap, erase any solid fragment disconnected from the
// figure's main mass (severed arm slivers, impact-star specks): keep only
// the largest connected component. Pure; testable.
export function keepLargestComponent(px, w, x0, frameW = FRAME, frameH = FRAME) {
  const at = (x, y) => ((y * w) + x0 + x) * 4;
  const solid = (x, y) => x >= 0 && x < frameW && y >= 0 && y < frameH && px[at(x, y) + 3] > 10;
  const seen = new Set();
  const components = [];
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      const k0 = y * frameW + x;
      if (!solid(x, y) || seen.has(k0)) continue;
      const comp = [];
      const q = [[x, y]];
      seen.add(k0);
      while (q.length) {
        const [cx, cy] = q.pop();
        comp.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = cx + dx, ny = cy + dy;
          const k = ny * frameW + nx;
          if (solid(nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); }
        }
      }
      components.push(comp);
    }
  }
  if (components.length < 2) return 0;
  components.sort((a, b) => b.length - a.length);
  // only true debris: a severed torso/arm chunk is large and must SURVIVE
  // (deleting it leaves a hole in the fighter — worse than any sliver)
  const cap = Math.min(60, Math.floor(components[0].length * 0.15));
  let erased = 0;
  for (const comp of components.slice(1)) {
    if (comp.length > cap) continue;
    for (const [cx, cy] of comp) { px[at(cx, cy) + 3] = 0; erased++; }
  }
  return erased;
}

// ——— per-frame photo-matching edit pass ———————————————————————————
// Operates on one 128px frame of ImageData. Order matters: detect the face
// with original colors (glasses), then recolor hair, then tint the shirt.
export function editFrame(px, w, x0, style) {
  const at = (x, y) => ((y * w) + x0 + x) * 4;
  const a = (x, y) => px[at(x, y) + 3];

  // figure bbox within the frame
  let top = FRAME, bot = 0;
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      if (a(x, y) > 10) { if (y < top) top = y; if (y > bot) bot = y; }
    }
  }
  if (top >= bot) return;

  // glasses: forehead = topmost skin pixels that sit directly under hair
  if (style.glasses) {
    let foreheadY = -1, minX = FRAME, maxX = 0;
    for (let y = top; y < Math.min(bot, top + 30); y++) {
      for (let x = 0; x < FRAME; x++) {
        const i = at(x, y);
        if (a(x, y) > 10 && isSkinPixel(px[i], px[i + 1], px[i + 2])) {
          const up1 = at(x, y - 1), up2 = at(x, y - 2);
          const hairAbove =
            (y > 0 && a(x, y - 1) > 10 && isHairPixel(px[up1], px[up1 + 1], px[up1 + 2])) ||
            (y > 1 && a(x, y - 2) > 10 && isHairPixel(px[up2], px[up2 + 1], px[up2 + 2]));
          if (hairAbove) {
            if (foreheadY === -1) foreheadY = y;
            if (y <= foreheadY + 1) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
            }
          }
        }
      }
      if (foreheadY !== -1 && y > foreheadY + 1) break;
    }
    if (foreheadY !== -1 && maxX - minX >= 3) {
      const gy = foreheadY + 2; // one thin row at eye height
      for (let gx = minX + 1; gx <= maxX - 1; gx++) {
        if (gx < 0 || gx >= FRAME || gy < 0 || gy >= FRAME) continue;
        const i = at(gx, gy);
        if (a(gx, gy) > 10 && isSkinPixel(px[i], px[i + 1], px[i + 2])) {
          px[i] = 30; px[i + 1] = 38; px[i + 2] = 52;
        }
      }
    }
  }

  // hair recolor within the head band; shirt tint everywhere
  const hairBand = top + Math.round((bot - top) * 0.45);
  for (let y = top; y <= bot; y++) {
    for (let x = 0; x < FRAME; x++) {
      const i = at(x, y);
      if (a(x, y) <= 10) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];

      if (style.hair && y <= hairBand && isHairPixel(r, g, b)) {
        const bright = Math.max(r, g, b) >= 8;
        let tone = style.hair[bright ? 1 : 0];
        if (style.fleck && ((x * 7 + y * 13) % 5 === 0)) tone = style.fleck;
        px[i] = tone[0]; px[i + 1] = tone[1]; px[i + 2] = tone[2];
        continue;
      }

      // harmonize body skin (hands/forearms) toward the head palette:
      // the source sprite's skin is much more saturated orange
      if (style.headPart && isSkinPixel(r, g, b)) {
        px[i] = Math.min(255, Math.round(r * 0.96));
        px[i + 1] = Math.min(255, Math.round(g * 1.12));
        px[i + 2] = Math.min(255, Math.round(b * 1.28));
        continue;
      }

      if (style.tint && isGreenAccent(r, g, b)) {
        px[i] = Math.round(style.tint[0] * 0.5);
        px[i + 1] = Math.round(style.tint[1] * 0.5);
        px[i + 2] = Math.round(style.tint[2] * 0.5);
        continue;
      }

      if (style.tint) {
        const out = recolorPixel(r, g, b, style.tint);
        if (out) { px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2]; }
      }
    }
  }
}

// ——— loading ———————————————————————————————————————————————————————
const sheetCache = new Map();

const NO_SWAP = { 'Dead.png': true };

function loadEdited(src, style, cacheKey, file) {
  if (sheetCache.has(cacheKey)) return sheetCache.get(cacheKey);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const c = cv.getContext('2d');
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height);
      const frames = Math.floor(cv.width / FRAME);
      const anchors = [];
      for (let f = 0; f < frames; f++) {
        const x0 = f * FRAME;
        if (style.headPart && !NO_SWAP[file]) {
          const head = findHead(d.data, cv.width, x0);
          if (head && head.hairH >= 4) {
            // NO erasing — the likeness head is pasted over the original,
            // which stays intact underneath (no holes, ever). The original
            // hair is recolored by editFrame so any peek-through matches.
            anchors.push({ f, hairCx: head.hairCx, hairTop: head.hairTop });
          }
        }
        editFrame(d.data, cv.width, x0, style);
      }
      c.putImageData(d, 0, 0);
      if (style.headPart) {
        const headCv = spriteCanvas(style.headPart, 1);
        for (const { f, hairCx, hairTop } of anchors) {
          c.imageSmoothingEnabled = false;
          c.drawImage(headCv,
            f * FRAME + hairCx - Math.floor(headCv.width / 2),
            hairTop - 2);
        }
      }
      resolve(cv);
    };
    img.onerror = reject;
    img.src = src;
  });
  sheetCache.set(cacheKey, p);
  return p;
}

// Load every sheet for a character art descriptor; resolves when drawable.
export async function loadSheetArt(art) {
  if (art._sheets) return art;
  const entries = await Promise.all(
    Object.entries(art.sheets).map(async ([name, file]) => {
      const cv = await loadEdited(`assets/sprites/g2/${file}`, art.style, `${file}:${art.style.key}`, file);
      return [name, cv];
    }),
  );
  art._sheets = Object.fromEntries(entries);
  return art;
}

export const sheetRenderer = {
  drawFighter(ctx, { art, state, stateClock, x, y, facing, flash }) {
    if (!art._sheets) return; // still loading; skip a frame
    const anim = art.anims[state] || art.anims.idle;
    let sheet, fi;
    if (anim.frames) {
      // cross-sheet sequence: each entry names its own sheet + column
      const step = frameIndexFor({ ...anim, n: anim.frames.length }, stateClock);
      const ref = anim.frames[step];
      sheet = art._sheets[ref.sheet];
      fi = ref.col;
    } else {
      sheet = art._sheets[anim.sheet];
      fi = (anim.start || 0) + frameIndexFor(anim, stateClock);
    }
    if (!sheet) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flash) ctx.filter = 'brightness(1.9) saturate(0.4)';

    // floor shadow
    ctx.translate(x, y);
    ctx.save();
    ctx.scale(1, 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 38, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.scale(facing, 1);
    const yOff = (anim.yOff || 0);
    ctx.drawImage(
      sheet,
      fi * FRAME, 0, FRAME, FRAME,
      -ANCHOR_X * SCALE, -ANCHOR_Y * SCALE + yOff, FRAME * SCALE, FRAME * SCALE,
    );
    ctx.restore();
  },
};
