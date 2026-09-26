import { test } from 'node:test';
import assert from 'node:assert';
import { Fighter } from '../src/fighter.js';
import { MOVES } from '../src/moves.js';
import { activeHitbox, resolve, comboScale, hurtbox } from '../src/combat.js';

const mk = (x, facing) => new Fighter({
  characterId: 'dario', x, facing,
  stats: { walkSpeed: 220, jumpVelocity: -1050, health: 100 },
  moves: MOVES.dario,
});

function arm(f, move) {
  f.state = move;
  f.stateClock = MOVES.dario[move].startupMs + 5;
  f._windowId += 1;
}

test('no hitbox when idle', () => {
  assert.equal(activeHitbox(mk(100, 1)), null);
});

test('stand jab in range deals full damage once', () => {
  const a = mk(100, 1), d = mk(150, -1);
  arm(a, 'standLP');
  const r1 = resolve(a, d);
  assert.equal(r1.hit, true);
  assert.equal(d.health, 95);
  assert.equal(resolve(a, d).hit, false); // window consumed
});

test('standing block stops mids but LOSES to a low sweep', () => {
  const a = mk(100, 1), d = mk(150, -1);
  d.state = 'block';
  arm(a, 'standHK'); // mid
  const rMid = resolve(a, d);
  assert.equal(rMid.blocked, true);

  const a2 = mk(100, 1), d2 = mk(150, -1);
  d2.state = 'block';
  arm(a2, 'crouchKick'); // low
  const rLow = resolve(a2, d2);
  assert.equal(rLow.hit, true);
  assert.equal(rLow.blocked, false); // clean hit through standing guard
});

test('crouch block stops lows', () => {
  const a = mk(100, 1), d = mk(150, -1);
  d.state = 'crouchblock';
  arm(a, 'crouchKick');
  const r = resolve(a, d);
  assert.equal(r.blocked, true);
});

test('high attacks whiff entirely over crouchers', () => {
  const a = mk(100, 1), d = mk(150, -1);
  d.state = 'crouch';
  arm(a, 'standLP'); // high
  const r = resolve(a, d);
  assert.equal(r.hit, false); // geometry: sails over the ducked hurtbox
  assert.equal(d.health, 100);
});

test('mids still hit crouchers', () => {
  const a = mk(100, 1), d = mk(150, -1);
  d.state = 'crouch';
  arm(a, 'standHK'); // mid
  assert.equal(resolve(a, d).hit, true);
});

test('crouch hurtbox is shorter than standing', () => {
  const stand = mk(100, 1);
  const crouch = mk(100, 1);
  crouch.state = 'crouch';
  assert.ok(hurtbox(crouch).h < hurtbox(stand).h);
});

test('combo scaling reduces damage on later hits', () => {
  assert.equal(comboScale(1), 1);
  assert.ok(comboScale(3) < 1);
  assert.ok(comboScale(8) >= 0.45); // floor

  const a = mk(100, 1), d = mk(150, -1);
  arm(a, 'standLP');
  const scaled = resolve(a, d, 4);
  assert.ok(scaled.damage < MOVES.dario.standLP.damage);
});

test('launcher reports launched and victim goes airborne', () => {
  const a = mk(100, 1), d = mk(150, -1);
  arm(a, 'crouchPunch');
  const r = resolve(a, d);
  assert.equal(r.hit, true);
  assert.equal(r.launched, true);
  assert.ok(d.vy < -500);
});

test('airborne victims cannot block (juggle hits connect)', () => {
  const a = mk(100, 1), d = mk(150, -1);
  d.y = 380; // airborne
  d.vy = -100;
  d.state = 'hitstun';
  arm(a, 'standHK');
  const r = resolve(a, d);
  assert.equal(r.hit, true);
  assert.equal(r.blocked, false);
});

test('out of range does not hit', () => {
  const a = mk(100, 1), d = mk(400, -1);
  arm(a, 'standLP');
  assert.equal(resolve(a, d).hit, false);
});
