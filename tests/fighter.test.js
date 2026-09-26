import { test } from 'node:test';
import assert from 'node:assert';
import { Fighter } from '../src/fighter.js';
import { MOVES } from '../src/moves.js';

const spec = () => ({
  characterId: 'dario', x: 100, facing: 1,
  stats: { walkSpeed: 220, jumpVelocity: -1050, health: 100 },
  moves: MOVES.dario,
});
const noInput = { left: false, right: false, up: false, down: false, lp: false, hp: false, lk: false, hk: false, special: false, pressed: {} };

test('walks toward opponent', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, right: true }, 900);
  assert.ok(f.x > 100);
  assert.equal(f.state, 'walk');
});

test('holding back with no threat walks backward (spacing)', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, left: true }, 900);
  assert.equal(f.state, 'walk');
  assert.ok(f.x < 100);
});

test('holding back under threat auto-guards standing', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, left: true }, 900, true);
  assert.equal(f.state, 'block');
});

test('down+back under threat crouch-guards', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, left: true, down: true }, 900, true);
  assert.equal(f.state, 'crouchblock');
});

test('4 buttons select 4 standing attacks; stance overrides', () => {
  for (const [btn, want] of [['lp', 'standLP'], ['hp', 'standHP'], ['lk', 'standLK'], ['hk', 'standHK']]) {
    const f = new Fighter(spec());
    f.step(1 / 60, { ...noInput, [btn]: true, pressed: { [btn]: true } }, 900);
    assert.equal(f.state, want);
  }

  const crouch = new Fighter(spec());
  crouch.step(1 / 60, { ...noInput, down: true, hk: true, pressed: { hk: true } }, 900);
  assert.equal(crouch.state, 'crouchKick');

  const launcher = new Fighter(spec());
  launcher.step(1 / 60, { ...noInput, down: true, lp: true, pressed: { lp: true } }, 900);
  assert.equal(launcher.state, 'crouchPunch');

  const air = new Fighter(spec());
  air.step(1 / 60, { ...noInput, up: true, pressed: { up: true } }, 900);
  assert.equal(air.state, 'jump');
  air.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  assert.equal(air.state, 'jumpPunch');
});

test('jump leaves the ground then lands back to idle', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, up: true, pressed: { up: true } }, 900);
  assert.ok(f.vy < 0);
  for (let i = 0; i < 200; i++) f.step(1 / 60, noInput, 900);
  assert.equal(f.state, 'idle');
});

test('attack is frame-gated (does not restart on re-press)', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  assert.equal(f.state, 'standLP');
  const afterFirst = f.stateClock;
  f.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  assert.equal(f.state, 'standLP');
  assert.ok(f.stateClock > afterFirst);
});

test('on-contact chain cancels recovery into the follow-up (LP -> HK string)', () => {
  const f = new Fighter(spec());
  const m = MOVES.dario.standLP;
  f.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  assert.equal(f.state, 'standLP');
  f._contact = true; // combat reported a touch
  f.step(1 / 60, { ...noInput, hk: true, pressed: { hk: true } }, 900);
  let guard = 0;
  while (f.state === 'standLP' && guard++ < 60) f.step(1 / 60, noInput, 900);
  assert.equal(f.state, 'standHK'); // canceled before full recovery
  assert.ok(f.stateClock < m.recoveryMs);
});

test('strings can go 4 moves deep (Tekken-style)', () => {
  const f = new Fighter(spec());
  const seq = ['lp', 'lp', 'lk', 'hk'];
  const expect = ['standLP', 'standLP', 'standLK', 'standHK'];
  f.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  assert.equal(f.state, expect[0]);
  for (let i = 1; i < seq.length; i++) {
    f._contact = true; // combat reported a touch on the current move
    f.step(1 / 60, { ...noInput, [seq[i]]: true, pressed: { [seq[i]]: true } }, 900);
    const prevChain = f._chain;
    let guard = 0;
    // chain fires when _chain increments (state name may repeat, e.g. LP,LP)
    while (f._chain === prevChain && f.state !== 'idle' && guard++ < 80) {
      f.step(1 / 60, noInput, 900);
    }
    assert.equal(f._chain, prevChain + 1, `chain step ${i} fired`);
    assert.equal(f.state, expect[i]);
  }
  assert.equal(f._chain, 3); // starter + 3 follow-ups
});

test('no chain without contact (whiffed attacks are punishable)', () => {
  const f = new Fighter(spec());
  const m = MOVES.dario.standLP;
  f.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  f.step(1 / 60, { ...noInput, hk: true, pressed: { hk: true } }, 900);
  // no contact: must remain in standLP through its full duration
  while (f.stateClock < m.startupMs + m.activeMs + m.recoveryMs - 20) {
    assert.equal(f.state, 'standLP');
    f.step(1 / 60, noInput, 900);
  }
});

test('whiff flag set when active window ends with no contact', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, lp: true, pressed: { lp: true } }, 900);
  const m = MOVES.dario.standLP;
  while (f.stateClock < m.startupMs + m.activeMs + 10) f.step(1 / 60, noInput, 900);
  assert.equal(f._whiffed, true);
});

test('double-tap forward dashes', () => {
  const f = new Fighter(spec());
  f.step(1 / 60, { ...noInput, right: true, pressed: { right: true } }, 900);
  f.step(1 / 60, noInput, 900);
  f.step(1 / 60, { ...noInput, right: true, pressed: { right: true } }, 900);
  f.step(1 / 60, { ...noInput, right: true }, 900);
  assert.ok(Math.abs(f.vx) > f.stats.walkSpeed * 1.5, `vx=${f.vx}`);
});

test('launcher pops the victim airborne and juggle keeps them up', () => {
  const f = new Fighter(spec());
  f.applyHit({ damage: 9, knockback: 120, hitstunMs: 420, launch: 640 }, 50);
  assert.equal(f.state, 'hitstun');
  assert.ok(f.vy < -500);
  // airborne: hitstun persists past its clock until landing
  for (let i = 0; i < 10; i++) f.step(1 / 60, noInput, 900);
  assert.equal(f.state, 'hitstun');
  assert.ok(f.y < 460);
  // juggle hit while airborne re-floats
  f.applyHit({ damage: 5, knockback: 150, hitstunMs: 200 }, 50);
  assert.ok(f.vy <= -280);
});

test('damage flash timer set on hit', () => {
  const f = new Fighter(spec());
  f.applyHit({ damage: 5, knockback: 100, hitstunMs: 200 }, 50);
  assert.ok(f.flashT > 0);
});

test('KO launches harder than a normal hit', () => {
  const f = new Fighter(spec());
  f.health = 5;
  f.applyHit({ damage: 20, knockback: 200, hitstunMs: 250 }, 50);
  assert.equal(f.state, 'ko');
  assert.ok(f.vx >= 320);
  assert.ok(f.vy < -300);
});
