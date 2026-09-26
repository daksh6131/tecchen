import { test } from 'node:test';
import assert from 'node:assert';
import { frameIndexFor, recolorPixel } from '../src/render/sheet.js';

test('durMs anims spread frames across the duration and clamp', () => {
  const anim = { n: 6, durMs: 300 };
  assert.equal(frameIndexFor(anim, 0), 0);
  assert.equal(frameIndexFor(anim, 149), 2);
  assert.equal(frameIndexFor(anim, 299), 5);
  assert.equal(frameIndexFor(anim, 9999), 5); // clamps on the last frame
});

test('fps anims loop; loop:false holds the last frame', () => {
  const loop = { n: 4, fps: 10, loop: true };
  assert.equal(frameIndexFor(loop, 0), 0);
  assert.equal(frameIndexFor(loop, 450), 0); // wrapped
  const once = { n: 4, fps: 10, loop: false };
  assert.equal(frameIndexFor(once, 9999), 3);
});

test('recolor targets the light unsaturated shirt, not skin or pants', () => {
  const tint = [86, 110, 160];
  assert.ok(recolorPixel(220, 220, 225, tint), 'white shirt gets tinted');
  assert.equal(recolorPixel(224, 164, 126, tint), null, 'skin untouched');
  assert.equal(recolorPixel(40, 44, 60, tint), null, 'dark pants untouched');
  const [r, g, b] = recolorPixel(255, 255, 255, tint);
  assert.deepEqual([r, g, b], tint); // full-bright maps to the tint itself
});

import { findHead } from '../src/render/sheet.js';

test('findHead grabs hair + connected face but spares a raised fist', () => {
  // synthetic 16x16 frame: hair rows 2-3, face rows 4-6 under it,
  // and a separate fist blob at (12..13, 2..3) not touching the head.
  const W = 16, H = 16;
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x, y, r, g, b) => {
    const i = (y * W + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  for (let x = 4; x <= 8; x++) for (let y = 2; y <= 3; y++) put(x, y, 5, 4, 3);        // hair
  for (let x = 4; x <= 8; x++) for (let y = 4; y <= 6; y++) put(x, y, 252, 165, 112);  // face
  for (let x = 12; x <= 13; x++) for (let y = 2; y <= 3; y++) put(x, y, 252, 165, 112); // fist

  const head = findHead(px, W, 0, W, H);
  assert.ok(head, 'head found');
  assert.ok(head.pixels.has(2 * W + 5), 'hair in head set');
  assert.ok(head.pixels.has(5 * W + 6), 'face in head set');
  assert.ok(!head.pixels.has(2 * W + 12), 'fist NOT erased');
  assert.equal(head.bottom, 6);
  assert.ok(head.cx >= 5 && head.cx <= 7, `anchor centered on face, got ${head.cx}`);
});

import { keepLargestComponent } from '../src/render/sheet.js';

test('keepLargestComponent erases debris but keeps the figure', () => {
  const W = 16, H = 16;
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x, y) => { px[(y * W + x) * 4 + 3] = 255; };
  // main body blob
  for (let x = 4; x <= 9; x++) for (let y = 6; y <= 14; y++) put(x, y);
  // floating debris: severed arm sliver + speck
  for (let x = 13; x <= 14; x++) for (let y = 3; y <= 5; y++) put(x, y);
  put(1, 2);
  const erased = keepLargestComponent(px, W, 0, W, H);
  assert.equal(erased, 7); // 6 sliver px + 1 speck
  assert.equal(px[((7 * W) + 5) * 4 + 3], 255, 'body intact');
  assert.equal(px[((3 * W) + 13) * 4 + 3], 0, 'sliver gone');
  assert.equal(px[((2 * W) + 1) * 4 + 3], 0, 'speck gone');
});

test('keepLargestComponent spares large severed chunks (no missing torsos)', () => {
  const W = 32, H = 32;
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x, y) => { px[(y * W + x) * 4 + 3] = 255; };
  // main mass ~200px
  for (let x = 2; x <= 15; x++) for (let y = 16; y <= 30; y++) put(x, y);
  // severed torso chunk ~80px (disconnected but big)
  for (let x = 2; x <= 11; x++) for (let y = 4; y <= 11; y++) put(x, y);
  // tiny speck
  put(28, 2);
  keepLargestComponent(px, W, 0, W, H);
  assert.equal(px[((6 * W) + 5) * 4 + 3], 255, 'severed torso chunk kept');
  assert.equal(px[((2 * W) + 28) * 4 + 3], 0, 'speck still erased');
});
