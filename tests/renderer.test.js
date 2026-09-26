import { test } from 'node:test';
import assert from 'node:assert';
import { getRenderer } from '../src/render/renderer.js';

test('procedural renderer exposes drawFighter', () => {
  const r = getRenderer('procedural');
  assert.equal(typeof r.drawFighter, 'function');
});

test('unknown art type falls back to procedural', () => {
  const r = getRenderer('does-not-exist');
  assert.equal(typeof r.drawFighter, 'function');
});

test('pixel renderer is registered', () => {
  const r = getRenderer('pixel');
  assert.equal(typeof r.drawFighter, 'function');
});

test('vector renderer is registered', () => {
  const r = getRenderer('vector');
  assert.equal(typeof r.drawFighter, 'function');
});
