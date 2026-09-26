import { test } from 'node:test';
import assert from 'node:assert';
import { MOVES } from '../src/moves.js';

const ALL = ['standLP', 'standHP', 'standLK', 'standHK', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick'];

test('every fighter has the Tekken 4-button move set with sane data', () => {
  for (const id of ['dario', 'sam']) {
    for (const mv of ALL) {
      const m = MOVES[id][mv];
      assert.ok(m, `${id}.${mv} missing`);
      assert.ok(m.startupMs > 0 && m.activeMs > 0 && m.recoveryMs > 0);
      assert.ok(m.damage > 0 && m.reach > 0);
      assert.ok(['high', 'mid', 'low'].includes(m.height), `${id}.${mv} height`);
    }
  }
});

test('light attacks are faster, heavies hit harder', () => {
  for (const id of ['dario', 'sam']) {
    const m = MOVES[id];
    assert.ok(m.standLP.startupMs < m.standHP.startupMs);
    assert.ok(m.standLK.startupMs < m.standHK.startupMs);
    assert.ok(m.standHP.damage > m.standLP.damage);
    assert.ok(m.standHK.damage > m.standLK.damage);
    assert.ok(m.standHK.damage >= m.standHP.damage); // HK is the big one
  }
});

test('height design: jab is high, sweep is low, launcher launches', () => {
  for (const id of ['dario', 'sam']) {
    assert.equal(MOVES[id].standLP.height, 'high');
    assert.equal(MOVES[id].crouchKick.height, 'low');
    assert.equal(MOVES[id].jumpKick.air, true);
    assert.ok(MOVES[id].crouchPunch.launch > 0, 'crouch punch is the launcher');
  }
});
