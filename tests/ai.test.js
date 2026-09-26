import { test } from 'node:test';
import assert from 'node:assert';
import { createAI } from '../src/ai.js';
import { Fighter } from '../src/fighter.js';
import { MOVES } from '../src/moves.js';

const mk = (x) => new Fighter({
  characterId: 'sam', x, facing: 1,
  stats: { walkSpeed: 300, jumpVelocity: -1000, health: 92 },
  moves: MOVES.sam,
});

test('emits a valid input shape every frame without crashing', () => {
  const self = mk(700), foe = mk(200);
  const ai = createAI(self, foe);
  for (let i = 0; i < 600; i++) {
    const inp = ai.nextInput(1 / 60);
    assert.equal(typeof inp.left, 'boolean');
    assert.equal(typeof inp.lp, 'boolean');
    assert.ok(inp.pressed);
    assert.ok(!(inp.left && inp.right), 'never holds both directions');
  }
});

test('approaches when far away', () => {
  const self = mk(700), foe = mk(100);
  const ai = createAI(self, foe, () => 0.5); // deterministic rng
  let leftFrames = 0;
  for (let i = 0; i < 120; i++) {
    if (ai.nextInput(1 / 60).left) leftFrames++;
  }
  assert.ok(leftFrames > 60, `expected mostly approach, got ${leftFrames}`);
});

test('attacks when in range and off cooldown', () => {
  const self = mk(400), foe = mk(320);
  const ai = createAI(self, foe, () => 0.5);
  let attacked = false;
  for (let i = 0; i < 120; i++) {
    const inp = ai.nextInput(1 / 60);
    if (inp.pressed.lp || inp.pressed.hp || inp.pressed.lk || inp.pressed.hk) { attacked = true; break; }
  }
  assert.ok(attacked, 'AI should attack within 2 seconds at close range');
});
