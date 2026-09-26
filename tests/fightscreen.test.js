import { test } from 'node:test';
import assert from 'node:assert';
import { createFightScreen } from '../src/screens/fight.js';

const noInput = {
  left: false, right: false, up: false, down: false,
  punch: false, kick: false, special: false, pressed: {},
};
const idleController = { snapshot: () => ({ ...noInput, pressed: {} }) };

test('fight runs headless and reaches a KO outcome eventually', () => {
  const screen = createFightScreen({ p1Id: 'dario', p2Id: 'sam', input: idleController });
  // idle player vs CPU: the CPU should win well within 90 simulated seconds
  for (let i = 0; i < 60 * 90 && !screen.state; i++) screen.update(1 / 60);
  assert.equal(screen.state, 'p2');
  assert.equal(screen.koSettled, false); // slow-mo still settling
  for (let i = 0; i < 60 * 5; i++) screen.update(1 / 60);
  assert.equal(screen.koSettled, true); // now rematch is allowed
});
