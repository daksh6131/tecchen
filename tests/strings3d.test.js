import { test } from 'node:test';
import assert from 'node:assert';
import { ROSTER } from '../src3d/roster.js';
import { createRound, EMPTY_INPUT } from '../src3d/sim.js';
import { buildStringMoves, STRINGS, F, DOWN_MS, GETUP_MS } from '../src3d/strings.js';
import { isCounterHit } from '../src3d/combat3d.js';

const DT = 1 / 60;
const idle = () => EMPTY_INPUT;
const BTN = { 1: 'lp', 2: 'hp', 3: 'lk', 4: 'hk', L: 'special' };

// an input frame for a token, p1 facing right
function tok(token) {
  const [dir, n] = token.includes('+') ? token.split('+') : ['', token];
  const i = { ...EMPTY_INPUT, pressed: {} };
  if (dir === 'd') i.down = true;
  if (dir === 'f' || dir === 'f,f') i.right = true;
  if (dir === 'b') i.left = true;
  if (dir === 'u/f') { i.up = true; i.right = true; }
  i[BTN[n]] = true;
  i.pressed[BTN[n]] = true;
  return i;
}

// elon (p1) vs sam (p2), CPU never acts
function round(order = ['elon', 'sam']) {
  const r = createRound({ chars: [ROSTER[order[0]], ROSTER[order[1]]], rng: () => 0.999 });
  r.p2.x = r.p1.x + 75;
  return r;
}

// run until pred or n frames; p1 inputs by frame index
function run(r, n, p1At = () => idle(), stop = () => false) {
  const events = [];
  for (let i = 0; i < n; i++) {
    events.push(...r.step(DT, p1At(i), idle()));
    if (stop(events)) break;
  }
  return events;
}

test('every string node has timing fitted to its clip', () => {
  for (const id of ['elon', 'sam']) {
    const moves = buildStringMoves(id, {}, ROSTER[id].baseMoves);
    for (const [k, n] of Object.entries(STRINGS[id].nodes)) {
      const m = moves[k];
      assert.ok(m, `${id}.${k} built`);
      assert.ok(Math.abs(m.startupMs - n.startupF * F) < 0.01, `${k}: startup matches the spec`);
      assert.ok(Math.abs(m.hitTimes[0] - m.startupMs) < 0.5, `${k}: first contact frame lands on startup`);
      assert.ok(m.totalMs > m.activeEndMs, `${k}: has recovery`);
    }
  }
});

test('natural combo: Sam 1,2 lands both hits once the jab connects', () => {
  const r = round(['sam', 'elon']);
  const ev = run(r, 90, (i) => (i === 0 ? tok('1') : i === 8 ? tok('2') : idle()));
  const hits = ev.filter((e) => e.type === 'hit' && e.attacker === 'p1');
  assert.equal(hits.length, 2, 'jab and cross both hit');
  assert.equal(hits[1].combo, 2, 'the cross counts as the second hit of one combo');
  assert.equal(hits[0].string, 'ONE-TWO');
});

test('follow-up pressed after the cancel window closes does not chain', () => {
  const r = round(['sam', 'elon']);
  const m = r.p1.moves.s_jab;
  const late = Math.ceil((m.activeEndMs + 12 * F) / F) + 6;   // after the NC window
  const states = [];
  run(r, late + 30, (i) => { states.push(r.p1.state); return i === 0 ? tok('1') : i === late ? tok('2') : idle(); });
  assert.ok(!states.includes('s_cross_12'), 'late press must not continue the string');
});

test('direction inputs pick the right starters', () => {
  const cases = [['sam', 'f+2', 's_elbow'], ['sam', 'b+2', 's_counter_hook'], ['sam', 'u/f+3', 's_hop_kick'],
    ['sam', 'd+3', 's_sweep'], ['elon', 'f+3', 'e_knee'], ['elon', 'd+4', 'e_sweep'], ['elon', 'b+2', 'e_haymaker']];
  for (const [who, token, expect] of cases) {
    const r = round([who, who === 'sam' ? 'elon' : 'sam']);
    r.p2.x = r.p1.x + 300;
    r.step(DT, tok(token), idle());
    assert.equal(r.p1.state, expect, `${who} ${token}`);
  }
});

test('Elon f,f+2 dashes into the shoulder ram', () => {
  const r = round();
  r.p2.x = r.p1.x + 300;
  const right = () => ({ ...EMPTY_INPUT, right: true, pressed: { right: true } });
  const frames = [right(), idle(), right(), tok('f,f+2')];
  let seen = false;
  for (let i = 0; i < frames.length + 2; i++) { r.step(DT, frames[i] || idle(), idle()); if (r.p1.state === 'e_ram') seen = true; }
  assert.ok(seen, 'double-tap forward then 2 starts the ram');
});

test('counter hit: Elon knee into Sam\'s startup launches', () => {
  const r = round();
  // Sam starts his 17 f hook 8 frames before Elon's 16 f knee lands: the knee
  // connects while the hook is still in startup
  const ev = run(r, 40, (i) => {
    if (i === 8) { r.p2.state = 's_counter_hook'; r.p2.stateClock = 0; r.p2._hitIdx = -1; assert.ok(isCounterHit(r.p2)); }
    return i === 0 ? tok('f+3') : idle();
  }, (e) => e.some((x) => x.type === 'hit'));
  const h = ev.find((e) => e.type === 'hit');
  assert.ok(h, 'knee hit');
  assert.ok(h.counter, 'flagged as counter hit');
  assert.ok(h.launched, 'counter-hit knee launches');
});

test('launcher: victim is juggled, lands into a knockdown, then gets up', () => {
  const r = round();
  const ev = run(r, 40, (i) => (i === 0 ? tok('d+1') : idle()), (e) => e.some((x) => x.type === 'hit'));
  assert.ok(ev.find((e) => e.type === 'hit' && e.launched));
  let sawDown = false, sawGetup = false;
  for (let i = 0; i < Math.ceil((DOWN_MS + GETUP_MS) / F) + 120; i++) {
    r.step(DT, idle(), idle());
    if (r.p2.state === 'down') sawDown = true;
    if (r.p2.state === 'getup') sawGetup = true;
  }
  assert.ok(sawDown, 'lands on the floor');
  assert.ok(sawGetup, 'gets up');
  assert.equal(r.p2.state, 'idle');
});

test('rage art needs a full meter, empties it and emits a rage event', () => {
  const r = round();
  r.step(DT, tok('L'), idle());
  assert.notEqual(r.p1.state, 'e_rage', 'no rage without meter');
  run(r, 5);
  r.p1.meter = 100;
  const ev = r.step(DT, tok('L'), idle());
  assert.equal(r.p1.state, 'e_rage');
  assert.equal(r.p1.meter, 0);
  assert.ok(ev.find((e) => e.type === 'rage' && e.who === 'p1'));
});

test('Sam\'s rage flurry connects several times', () => {
  const r = round(['sam', 'elon']);
  r.p1.meter = 100;
  const ev = run(r, 160, (i) => (i === 0 ? tok('L') : idle()));
  const hits = ev.filter((e) => e.type === 'hit' && e.attacker === 'p1');
  assert.ok(hits.length >= 6, `flurry landed ${hits.length} hits`);
  assert.ok(hits.some((h) => h.rageFinish), 'last hit is the rage finisher');
  if (hits.length === 8) assert.equal(hits.reduce((s, h) => s + h.damage, 0), 30, 'Rage Art deals its full 30 damage');
});

test('only ground attacks reach a downed opponent', () => {
  const r = round();
  r.p2.state = 'down'; r.p2.stateClock = 0; r.p2.x = r.p1.x + 70;
  const jab = run(r, 30, (i) => (i === 0 ? tok('1') : idle()));
  assert.ok(!jab.some((e) => e.type === 'hit'), 'a standing jab whiffs over a downed body');
  const r2 = round();
  r2.p2.x = r2.p1.x + 70;
  r2.p1.state = 'e_stomp'; r2.p1.stateClock = 0; r2.p1._hitIdx = -1;
  r2.p2.state = 'down'; r2.p2.stateClock = 0;
  const stomp = run(r2, 40);
  assert.ok(stomp.some((e) => e.type === 'hit' && e.attacker === 'p1'), 'the stomp hits');
});

test('every multi-hit string lands all its hits on a standing opponent', () => {
  const strings = {
    elon: [['1', '1', '2'], ['2', '2'], ['4', '4']],
    sam: [['1', '2'], ['1', '2', 'd+3'], ['3', '3'], ['2', '1', '2'], ['4', '4']],
  };
  for (const [who, list] of Object.entries(strings)) {
    for (const seq of list) {
      const other = who === 'sam' ? 'elon' : 'sam';
      // like the game: while a limb extends, the bodies stay a limb's length apart
      const r = createRound({ chars: [ROSTER[who], ROSTER[other]], rng: () => 0.999,
        minGap: (a) => (a.moves[a.state] && a.stateClock < a.moves[a.state].activeEndMs ? 95 : 0) });
      r.p2.x = r.p1.x + 80;
      let i = 0;
      let pressedIn = null;             // node the last token was pressed from
      const hits = [];
      for (let f = 0; f < 240; f++) {
        const m = r.p1.moves[r.p1.state];
        let inp = idle();
        if (i === 0) { inp = tok(seq[0]); i = 1; }
        else if (i < seq.length && m && m.hitTimes && r.p1.state !== pressedIn && r.p1.stateClock >= m.hitTimes[0]) {
          inp = tok(seq[i]); i += 1; pressedIn = r.p1.state;
        }
        hits.push(...r.step(DT, inp, idle()).filter((e) => e.type === 'hit' && e.attacker === 'p1'));
      }
      assert.equal(hits.length, seq.length, `${who} ${seq.join(',')}: ${hits.length}/${seq.length} hits`);
    }
  }
});
