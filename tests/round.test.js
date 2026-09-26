import { test } from 'node:test';
import assert from 'node:assert';
import { roundOutcome } from '../src/screens/fight.js';

test('round ends when a fighter is KO', () => {
  assert.equal(roundOutcome({ health: 30 }, { health: 0 }), 'p1');
  assert.equal(roundOutcome({ health: 0 }, { health: 30 }), 'p2');
  assert.equal(roundOutcome({ health: 30 }, { health: 30 }), null);
});

test('double KO is a draw', () => {
  assert.equal(roundOutcome({ health: 0 }, { health: 0 }), 'draw');
});
