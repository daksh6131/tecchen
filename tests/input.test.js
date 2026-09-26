import { test } from 'node:test';
import assert from 'node:assert';
import { Input } from '../src/input.js';

test('held and edge tracking', () => {
  const inp = new Input();
  inp._down('ArrowRight');
  let s = inp.snapshot();
  assert.equal(s.right, true);
  assert.equal(s.pressed.right, true);

  s = inp.snapshot();
  assert.equal(s.right, true);          // still held
  assert.equal(s.pressed.right, false); // edge consumed

  inp._up('ArrowRight');
  assert.equal(inp.snapshot().right, false);
});

test('unmapped keys are ignored', () => {
  const inp = new Input();
  inp._down('KeyZ');
  const s = inp.snapshot();
  assert.equal(s.lp, false);
  assert.equal(s.hk, false);
});

test('all four attack buttons are mapped', () => {
  const inp = new Input();
  for (const [code, field] of [['KeyU', 'lp'], ['KeyI', 'hp'], ['KeyJ', 'lk'], ['KeyK', 'hk']]) {
    inp._down(code);
    assert.equal(inp.snapshot()[field], true, `${code} -> ${field}`);
    inp._up(code);
  }
});
