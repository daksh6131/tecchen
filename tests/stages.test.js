import { test } from 'node:test';
import assert from 'node:assert';
import { STAGES, nextStage } from '../src/render/stages.js';

test('there are at least two stages with names and draw functions', () => {
  assert.ok(STAGES.length >= 2);
  const ids = new Set();
  for (const s of STAGES) {
    assert.ok(s.id && s.name);
    assert.equal(typeof s.draw, 'function');
    ids.add(s.id);
  }
  assert.equal(ids.size, STAGES.length); // unique ids
});

test('nextStage cycles through all stages', () => {
  const seen = [];
  for (let i = 0; i < STAGES.length * 2; i++) seen.push(nextStage().id);
  for (const s of STAGES) assert.ok(seen.includes(s.id));
  assert.notEqual(seen[0], seen[1]); // actually alternates
});
