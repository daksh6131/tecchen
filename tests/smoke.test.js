import { test } from 'node:test';
import assert from 'node:assert';
import { stepCount } from '../src/main.js';

test('stepCount yields one 60Hz step per ~16.67ms', () => {
  assert.equal(stepCount(1000 / 60), 1);
  assert.equal(stepCount(1000 / 30), 2);
  assert.equal(stepCount(5), 0);
});
