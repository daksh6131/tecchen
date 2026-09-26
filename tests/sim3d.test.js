import { test } from 'node:test';
import assert from 'node:assert';
import { createRound, roundOutcome, EMPTY_INPUT } from '../src3d/sim.js';
import { toWorldX, toWorldY, jointAngles, PX } from '../src3d/mapping.js';
import { config } from '../src/config.js';

const DT = 1 / 60;
const press = (key, extra = {}) => ({ ...EMPTY_INPUT, [key]: true, ...extra, pressed: { [key]: true } });
const idle = () => EMPTY_INPUT;

test('round outcome mirrors the 2D rules', () => {
  assert.equal(roundOutcome({ health: 30 }, { health: 0 }), 'p1');
  assert.equal(roundOutcome({ health: 0 }, { health: 30 }), 'p2');
  assert.equal(roundOutcome({ health: 0 }, { health: 0 }), 'draw');
  assert.equal(roundOutcome({ health: 30 }, { health: 30 }), null);
});

test('a jab at point blank emits a hit event and freezes the sim', () => {
  const r = createRound({ rng: () => 0.99 });      // CPU never attacks or guards
  r.p2.x = r.p1.x + 60;                            // inside jab reach
  const p2Idle = () => idle();
  let hit = null;
  let frozeAfter = false;
  for (let i = 0; i < 40 && !hit; i++) {
    const ev = r.step(DT, i === 0 ? press('lp') : idle(), p2Idle());
    hit = ev.find((e) => e.type === 'hit');
    if (hit) frozeAfter = r.frozen;
  }
  assert.ok(hit, 'expected a hit event');
  assert.equal(hit.attacker, 'p1');
  assert.ok(hit.damage > 0);
  assert.ok(frozeAfter, 'hit should start a hit-freeze');
  assert.ok(r.p2.health < r.c2.stats.health);
});

test('holding back blocks the jab and reports a block event', () => {
  const r = createRound({ rng: () => 0.99 });
  r.p2.x = r.p1.x + 60;
  // p2 stands to the right, so "back" for p2 is right
  const guard = () => ({ ...EMPTY_INPUT, right: true, pressed: {} });
  let ev = null;
  for (let i = 0; i < 40 && !ev; i++) {
    const out = r.step(DT, i === 0 ? press('lp') : idle(), guard());
    ev = out.find((e) => e.type === 'block' || e.type === 'hit');
  }
  assert.ok(ev, 'expected contact');
  assert.equal(ev.type, 'block');
});

test('KO produces a ko event and settles after the slow-motion window', () => {
  const r = createRound({ rng: () => 0.99 });
  r.p2.health = 1;
  r.p2.x = r.p1.x + 60;
  let ko = null;
  for (let i = 0; i < 60 && !ko; i++) {
    ko = r.step(DT, i === 0 ? press('hp') : idle(), idle()).find((e) => e.type === 'ko');
  }
  assert.ok(ko);
  assert.equal(ko.outcome, 'p1');
  assert.equal(r.koSettled, false);
  for (let i = 0; i < 120; i++) r.step(DT, idle(), idle());
  assert.equal(r.koSettled, true);
});

test('pixel to world mapping centres the stage and puts the floor at y=0', () => {
  assert.equal(toWorldX(config.canvas.w / 2), 0);
  assert.equal(toWorldY(config.floorY), 0);
  assert.ok(Math.abs(toWorldY(config.floorY - 120) - 120 * PX) < 1e-9);
});

test('joint angles mirror exactly when facing flips', () => {
  const pose = { torsoAngle: 10, frontArmAngle: 90, frontArmBend: 20, frontLegAngle: 30, frontLegBend: 15, bodyY: 26 };
  const a = jointAngles(pose, 1);
  const b = jointAngles(pose, -1);
  for (const k of ['torso', 'frontArm', 'frontFore', 'frontLeg', 'frontShin']) {
    assert.ok(Math.abs(a[k] + b[k]) < 1e-12, `${k} should mirror`);
  }
  assert.equal(a.bodyY, b.bodyY);
  assert.ok(a.bodyY < 0, 'canvas bodyY down -> world down');
  assert.ok(a.frontArm > 0 && a.torso < 0);
});
