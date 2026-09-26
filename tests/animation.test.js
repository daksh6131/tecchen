import { test } from 'node:test';
import assert from 'node:assert';
import { Animation } from '../src/anim/animation.js';

const anim = new Animation({
  durationMs: 100, loop: false,
  keyframes: [
    { tMs: 0, pose: { frontArmAngle: 0 } },
    { tMs: 100, pose: { frontArmAngle: 90 } },
  ],
});

test('interpolates between keyframes', () => {
  assert.equal(Math.round(anim.poseAt(0).frontArmAngle), 0);
  assert.equal(Math.round(anim.poseAt(100).frontArmAngle), 90);
  const mid = anim.poseAt(50).frontArmAngle;
  assert.ok(mid > 20 && mid < 70);
});

test('clamps past duration when not looping', () => {
  assert.equal(Math.round(anim.poseAt(9999).frontArmAngle), 90);
});

test('looping wraps around', () => {
  const loop = new Animation({
    durationMs: 100, loop: true,
    keyframes: [
      { tMs: 0, pose: { bodyY: 0 } },
      { tMs: 100, pose: { bodyY: 10 } },
    ],
  });
  assert.equal(Math.round(loop.poseAt(0).bodyY), Math.round(loop.poseAt(100).bodyY));
});
