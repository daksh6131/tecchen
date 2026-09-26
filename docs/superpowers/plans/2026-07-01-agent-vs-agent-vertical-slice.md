# Agent vs Agent — Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One playable fight — Dario (Claude) vs Sam (OpenAI) — in a desktop browser: move, jump, punch, kick, block, health, one round to KO, rendered with detailed procedural fighters on a procedural stage, smooth tweened animation.

**Architecture:** Plain ES modules loaded directly by the browser (no bundler). A fixed-timestep game loop drives a screen state machine; for the slice the only screen is the fight. Game logic (input, physics, state machine, combat, animation math, round flow) is pure and unit-tested headlessly with `node:test`; rendering is a thin layer behind a renderer interface with two backends (procedural now, sprite-sheet later). Player 1 is keyboard-controlled; the opponent is a stationary training dummy for this slice (real CPU AI arrives in a later phase).

**Tech Stack:** HTML5 Canvas 2D, vanilla ES modules, Node's built-in `node:test` for tests, `http-server`-style static serving for local play (via `npx serve` or Python's `http.server`).

## Global Constraints

- Platform: desktop browser (Chrome/Safari/Firefox), keyboard only. No mobile/touch.
- No bundler; browser loads `src/**/*.js` as native ES modules (`<script type="module">`).
- No external runtime dependencies in the shipped game; no audio files. Dev-only deps allowed (test runner, static server).
- All characters and logo are original parody creations — never copy JoJo (or any other game's) art, names, or trademarks.
- Single-player vs CPU only; no networking, no local 2P.
- Combat scope: move, jump, crouch, punch, kick, block; signature special + meter is a LATER phase (not in this slice).
- Block = holding *back* (direction away from opponent); crouch (down) is a separate stance and does not block.
- Round rules: best-of-3 and timer are a LATER phase; this slice does a single round ending on KO.
- Fixed timestep: simulate at 60 Hz (dt = 1/60 s). All frame-data in milliseconds.
- Naming: camelCase for JS identifiers; files kebab/lowercase as in the spec's tree.

---

### Task 1: Project scaffold + running game loop

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/config.js`
- Create: `src/main.js`
- Create: `tests/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `config.js` exports `const config = { fps: 60, dt: 1/60, gravity: 2400, canvas: { w: 960, h: 540 }, floorY: 460 }`.
  - `main.js` exports `startGame(canvas)` and an internal `class Loop { constructor(update, render); start(); stop(); }` using `requestAnimationFrame` with a fixed-timestep accumulator.

- [ ] **Step 1: Write the failing test** — accumulator produces integer 60Hz steps.

```js
// tests/smoke.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { stepCount } from '../src/main.js';

test('stepCount yields one 60Hz step per ~16.67ms', () => {
  assert.equal(stepCount(1000 / 60), 1);
  assert.equal(stepCount(1000 / 30), 2);
  assert.equal(stepCount(5), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `stepCount` is not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// src/config.js
export const config = {
  fps: 60,
  dt: 1 / 60,
  gravity: 2400,
  canvas: { w: 960, h: 540 },
  floorY: 460,
};
```

```js
// src/main.js
import { config } from './config.js';

const STEP_MS = 1000 / config.fps;

export function stepCount(elapsedMs, carryMs = 0) {
  return Math.floor((elapsedMs + carryMs) / STEP_MS);
}

export function startGame(canvas) {
  const ctx = canvas.getContext('2d');
  let acc = 0;
  let last = performance.now();
  let screen = makePlaceholderScreen();

  function frame(now) {
    acc += now - last;
    last = now;
    let steps = 0;
    while (acc >= STEP_MS && steps < 5) {
      screen.update(config.dt);
      acc -= STEP_MS;
      steps++;
    }
    screen.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function makePlaceholderScreen() {
  let t = 0;
  return {
    update(dt) { t += dt; },
    render(ctx) {
      ctx.fillStyle = '#0d1b2a';
      ctx.fillRect(0, 0, config.canvas.w, config.canvas.h);
      ctx.fillStyle = '#CC785C';
      ctx.fillRect(80 + Math.sin(t) * 40, 300, 60, 120);
    },
  };
}
```

```html
<!-- index.html -->
<!doctype html>
<meta charset="utf-8">
<title>Agent vs Agent</title>
<style>html,body{margin:0;background:#07101c;display:grid;place-items:center;height:100vh}
canvas{image-rendering:pixelated;box-shadow:0 0 40px #000;max-width:100vw}</style>
<canvas id="game" width="960" height="540"></canvas>
<script type="module">
  import { startGame } from './src/main.js';
  startGame(document.getElementById('game'));
</script>
```

```json
{
  "name": "agent-vs-agent",
  "version": "0.0.1",
  "type": "module",
  "scripts": { "test": "node --test", "serve": "npx --yes serve -l 5173 ." }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Manual check** — `npm run serve`, open `http://localhost:5173`, confirm a clay rectangle sways on a dark background.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: project scaffold + fixed-timestep loop"
```

---

### Task 2: Input module

**Files:**
- Create: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class Input { constructor(keymap); attach(target); detach(); snapshot(): InputState; }`
  - `InputState` = `{ left, right, up, down, punch, kick, special }` (held booleans) plus `pressed` (same keys, true only on the frame the key went down). `snapshot()` returns the current state and clears edges for next frame.
  - Default `keymap`: `{ ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', KeyJ:'punch', KeyK:'kick', KeyL:'special' }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/input.test.js
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
  assert.equal(s.right, true);        // still held
  assert.equal(s.pressed.right, false); // edge consumed
  inp._up('ArrowRight');
  assert.equal(inp.snapshot().right, false);
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `node --test tests/input.test.js` → FAIL (no module).

- [ ] **Step 3: Implement**

```js
// src/input.js
const DEFAULT_KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyJ: 'punch', KeyK: 'kick', KeyL: 'special',
};

export class Input {
  constructor(keymap = DEFAULT_KEYMAP) {
    this.keymap = keymap;
    this.held = blank();
    this.edges = blank();
  }
  _down(code) {
    const a = this.keymap[code];
    if (a && !this.held[a]) this.edges[a] = true;
    if (a) this.held[a] = true;
  }
  _up(code) {
    const a = this.keymap[code];
    if (a) this.held[a] = false;
  }
  attach(target) {
    this._d = (e) => this._down(e.code);
    this._u = (e) => this._up(e.code);
    target.addEventListener('keydown', this._d);
    target.addEventListener('keyup', this._u);
  }
  detach(target) {
    target.removeEventListener('keydown', this._d);
    target.removeEventListener('keyup', this._u);
  }
  snapshot() {
    const s = { ...this.held, pressed: { ...this.edges } };
    this.edges = blank();
    return s;
  }
}
function blank() {
  return { left:false, right:false, up:false, down:false, punch:false, kick:false, special:false };
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/input.test.js` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: keyboard input with edge detection"`

---

### Task 3: Fighter physics + state machine

**Files:**
- Create: `src/fighter.js`
- Test: `tests/fighter.test.js`

**Interfaces:**
- Consumes: `config` (gravity, floorY, dt).
- Produces:
  - `class Fighter { constructor(spec); step(dt, inputState, opponentX); }`
  - `spec` = `{ characterId, x, facing, stats:{ walkSpeed, jumpVelocity, health }, moves }` (moves from Task 4).
  - Runtime fields: `x, y, vx, vy, facing (1|-1), health, meter, state, stateClock`.
  - States: `'idle'|'walk'|'jump'|'crouch'|'block'|'punch'|'kick'|'hitstun'|'ko'`.
  - Rules: gravity integrates vy while airborne; landing at `floorY` sets `state='idle'`; facing = sign(opponentX - x) when grounded and not mid-attack; attacks are frame-gated (can't re-enter until recovery ends); block only when holding back and grounded and not attacking.

- [ ] **Step 1: Write the failing test**

```js
// tests/fighter.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { Fighter } from '../src/fighter.js';
import { MOVES } from '../src/moves.js';

const spec = () => ({
  characterId: 'dario', x: 100, facing: 1,
  stats: { walkSpeed: 220, jumpVelocity: -900, health: 100 },
  moves: MOVES.dario,
});
const noInput = { left:false,right:false,up:false,down:false,punch:false,kick:false,special:false, pressed:{} };

test('walks right toward speed', () => {
  const f = new Fighter(spec());
  f.step(1/60, { ...noInput, right:true }, 900);
  assert.ok(f.x > 100);
  assert.equal(f.state, 'walk');
});

test('jump leaves the ground then lands', () => {
  const f = new Fighter(spec());
  f.step(1/60, { ...noInput, up:true, pressed:{ up:true } }, 900);
  assert.ok(f.vy < 0);
  for (let i=0;i<200;i++) f.step(1/60, noInput, 900);
  assert.equal(f.state, 'idle'); // back on floor
});

test('holding back grounded = block', () => {
  const f = new Fighter(spec()); // faces right (opponent at 900)
  f.step(1/60, { ...noInput, left:true }, 900); // left == away from opponent
  assert.equal(f.state, 'block');
});

test('punch is frame-gated', () => {
  const f = new Fighter(spec());
  f.step(1/60, { ...noInput, punch:true, pressed:{ punch:true } }, 900);
  assert.equal(f.state, 'punch');
  const clockAfterFirst = f.stateClock;
  f.step(1/60, { ...noInput, punch:true, pressed:{ punch:true } }, 900);
  assert.ok(f.stateClock > clockAfterFirst); // stayed in same punch, didn't restart
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/fighter.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/fighter.js
import { config } from './config.js';

const ATTACKS = { punch: true, kick: true };

export class Fighter {
  constructor(spec) {
    this.id = spec.characterId;
    this.x = spec.x; this.y = config.floorY;
    this.vx = 0; this.vy = 0;
    this.facing = spec.facing ?? 1;
    this.stats = spec.stats;
    this.moves = spec.moves;
    this.health = spec.stats.health;
    this.meter = 0;
    this.state = 'idle';
    this.stateClock = 0;
  }

  get grounded() { return this.y >= config.floorY && this.vy >= 0; }

  step(dt, input, opponentX) {
    this.stateClock += dt * 1000;

    if (this.grounded && !ATTACKS[this.state] && this.state !== 'hitstun' && this.state !== 'ko') {
      this.facing = Math.sign(opponentX - this.x) || this.facing;
    }

    if (ATTACKS[this.state]) {
      const m = this.moves[this.state];
      this.vx = 0;
      if (this.stateClock >= m.startupMs + m.activeMs + m.recoveryMs) this._enter('idle');
    } else if (this.state === 'hitstun') {
      if (this.stateClock >= this.hitstunMs) this._enter('idle');
    } else if (this.state !== 'ko') {
      this._control(input, opponentX);
    }

    this.vy += config.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= config.floorY) {
      this.y = config.floorY; this.vy = 0;
      if (this.state === 'jump') this._enter('idle');
    }
  }

  _control(input, opponentX) {
    const back = (opponentX > this.x) ? input.left : input.right;
    const fwd  = (opponentX > this.x) ? input.right : input.left;
    if (this.grounded) {
      if (input.pressed?.up)      { this.vy = this.stats.jumpVelocity; this._enter('jump'); return; }
      if (input.pressed?.punch)   { this._enter('punch'); return; }
      if (input.pressed?.kick)    { this._enter('kick'); return; }
      if (back)                   { this.vx = 0; this._enter('block'); return; }
      if (input.down)             { this.vx = 0; this._enter('crouch'); return; }
      if (fwd)                    { this.vx = this.facing * this.stats.walkSpeed * (input.right? (input.right&&opponentX>this.x?1:1):1); this.vx = (input.right?1:-1)*this.stats.walkSpeed; this._enter('walk'); return; }
      this.vx = 0; this._enter('idle');
    }
  }

  _enter(state) {
    if (this.state === state) return;
    this.state = state; this.stateClock = 0;
  }

  applyHit({ damage, knockback, hitstunMs }, fromX) {
    this.health = Math.max(0, this.health - damage);
    this.vx = Math.sign(this.x - fromX) * knockback;
    this.vy = -150;
    this.hitstunMs = hitstunMs;
    this.meter = Math.min(100, this.meter + 8);
    this._enter(this.health <= 0 ? 'ko' : 'hitstun');
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/fighter.test.js` → PASS. (If the walk-velocity line reads awkwardly, simplify to `this.vx = (input.right ? 1 : -1) * this.stats.walkSpeed;` — keep the clear version.)

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: fighter physics + state machine"`

---

### Task 4: Move / frame data

**Files:**
- Create: `src/moves.js`
- Test: `tests/moves.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const MOVES = { dario: {...}, sam: {...} }` where each move is
  `{ startupMs, activeMs, recoveryMs, damage, knockback, hitstunMs, reach, meterGain }`.
  Each character has `punch` and `kick`. Sam's are faster/weaker, Dario's balanced.

- [ ] **Step 1: Write the failing test**

```js
// tests/moves.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { MOVES } from '../src/moves.js';

test('every fighter has punch and kick with positive timing', () => {
  for (const id of ['dario', 'sam']) {
    for (const mv of ['punch', 'kick']) {
      const m = MOVES[id][mv];
      assert.ok(m.startupMs > 0 && m.activeMs > 0 && m.recoveryMs > 0);
      assert.ok(m.damage > 0 && m.reach > 0);
    }
  }
});

test('kick hits harder than punch', () => {
  assert.ok(MOVES.dario.kick.damage > MOVES.dario.punch.damage);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

```js
// src/moves.js
export const MOVES = {
  dario: {
    punch: { startupMs: 70,  activeMs: 60,  recoveryMs: 120, damage: 7,  knockback: 180, hitstunMs: 220, reach: 74, meterGain: 6 },
    kick:  { startupMs: 120, activeMs: 80,  recoveryMs: 200, damage: 12, knockback: 300, hitstunMs: 300, reach: 96, meterGain: 8 },
  },
  sam: {
    punch: { startupMs: 50,  activeMs: 50,  recoveryMs: 90,  damage: 5,  knockback: 150, hitstunMs: 180, reach: 70, meterGain: 7 },
    kick:  { startupMs: 90,  activeMs: 70,  recoveryMs: 150, damage: 9,  knockback: 260, hitstunMs: 250, reach: 92, meterGain: 9 },
  },
};
```

- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: move frame data for Dario and Sam"`

---

### Task 5: Combat resolution

**Files:**
- Create: `src/combat.js`
- Test: `tests/combat.test.js`

**Interfaces:**
- Consumes: `Fighter`, `MOVES`.
- Produces:
  - `activeHitbox(fighter): {x, y, w, h} | null` — non-null only during a move's active window; positioned in front of the fighter using the move's `reach`.
  - `hurtbox(fighter): {x, y, w, h}` — the body box.
  - `resolve(attacker, defender): { hit, blocked, damage }` — if attacker's active hitbox overlaps defender's hurtbox and not already applied this active window: compute damage; if defender is blocking and facing the attacker, reduce to chip (25%, no hitstun) else full `applyHit`. Marks the attacker's active window consumed so it hits once.

- [ ] **Step 1: Write the failing test**

```js
// tests/combat.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { Fighter } from '../src/fighter.js';
import { MOVES } from '../src/moves.js';
import { activeHitbox, resolve } from '../src/combat.js';

const mk = (x, facing) => new Fighter({ characterId:'dario', x, facing, stats:{ walkSpeed:220, jumpVelocity:-900, health:100 }, moves: MOVES.dario });

test('no hitbox when idle', () => {
  assert.equal(activeHitbox(mk(100,1)), null);
});

test('punch in range deals full damage; consumed once', () => {
  const a = mk(100, 1), d = mk(150, -1);
  a.state = 'punch'; a.stateClock = MOVES.dario.punch.startupMs + 5; // in active window
  const r1 = resolve(a, d);
  assert.equal(r1.hit, true);
  assert.equal(d.health, 93);
  const r2 = resolve(a, d);       // same active window
  assert.equal(r2.hit, false);    // no double hit
});

test('blocking reduces to chip', () => {
  const a = mk(100, 1), d = mk(150, -1);
  d.state = 'block';
  a.state = 'punch'; a.stateClock = MOVES.dario.punch.startupMs + 5;
  const r = resolve(a, d);
  assert.equal(r.blocked, true);
  assert.ok(d.health > 96 && d.health < 100); // chip only
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

```js
// src/combat.js
export function hurtbox(f) {
  return { x: f.x - 22, y: f.y - 120, w: 44, h: 120 };
}

export function activeHitbox(f) {
  const m = f.moves[f.state];
  if (!m) return null;
  const t = f.stateClock;
  if (t < m.startupMs || t > m.startupMs + m.activeMs) return null;
  const w = m.reach, h = 40;
  const x = f.facing > 0 ? f.x : f.x - w;
  return { x, y: f.y - 96, w, h };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function resolve(attacker, defender) {
  const hb = activeHitbox(attacker);
  if (!hb) return { hit: false, blocked: false, damage: 0 };
  if (attacker._consumed === attacker.stateClockWindowId()) return { hit: false, blocked: false, damage: 0 };
  if (!overlap(hb, hurtbox(defender))) return { hit: false, blocked: false, damage: 0 };

  attacker._consumed = attacker.stateClockWindowId();
  const m = attacker.moves[attacker.state];
  const facingAttacker = Math.sign(attacker.x - defender.x) === defender.facing;
  if (defender.state === 'block' && facingAttacker) {
    const chip = Math.ceil(m.damage * 0.25);
    defender.health = Math.max(0, defender.health - chip);
    attacker.meter = Math.min(100, attacker.meter + m.meterGain);
    return { hit: true, blocked: true, damage: chip };
  }
  defender.applyHit({ damage: m.damage, knockback: m.knockback, hitstunMs: m.hitstunMs }, attacker.x);
  attacker.meter = Math.min(100, attacker.meter + m.meterGain);
  return { hit: true, blocked: false, damage: m.damage };
}
```

Add to `Fighter` (Task 3 file) a helper so each active window is consumed once:
```js
// add method to Fighter
stateClockWindowId() { return `${this.state}:${Math.floor(this.stateClock)}<${this.health}`.split('<')[0].split(':').slice(0,1).join(); }
```
Simpler and clearer — replace the above with an id that changes per move entry: track `this._windowId` incremented in `_enter` for attack states:
```js
// in _enter(), after setting state/clock:
if (state === 'punch' || state === 'kick') this._windowId = (this._windowId ?? 0) + 1;
// and expose:
stateClockWindowId() { return this._windowId; }
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/combat.test.js` → PASS. (Use the `_windowId` version.)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: combat hit resolution with block/chip"`

---

### Task 6: Animation timeline + pose interpolation

**Files:**
- Create: `src/anim/pose.js`
- Create: `src/anim/animation.js`
- Test: `tests/animation.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pose.js`: `const REST` (a neutral pose) and `lerpPose(a, b, t)` interpolating each numeric field. A pose = flat map of part transforms, e.g. `{ torsoAngle, headAngle, frontArmAngle, backArmAngle, frontLegAngle, backLegAngle, bodyY }` (degrees / px).
  - `animation.js`: `class Animation { constructor({ keyframes, durationMs, loop }); poseAt(clockMs): Pose; }` where `keyframes = [{ tMs, pose }]`; `poseAt` finds the bracketing keyframes and returns `lerpPose` with eased fraction.

- [ ] **Step 1: Write the failing test**

```js
// tests/animation.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { Animation } from '../src/anim/animation.js';

const anim = new Animation({
  durationMs: 100, loop: false,
  keyframes: [
    { tMs: 0,   pose: { frontArmAngle: 0 } },
    { tMs: 100, pose: { frontArmAngle: 90 } },
  ],
});

test('interpolates between keyframes', () => {
  assert.equal(Math.round(anim.poseAt(0).frontArmAngle), 0);
  assert.equal(Math.round(anim.poseAt(100).frontArmAngle), 90);
  const mid = anim.poseAt(50).frontArmAngle;
  assert.ok(mid > 20 && mid < 70); // eased, roughly middle
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

```js
// src/anim/pose.js
export const REST = {
  torsoAngle: 0, headAngle: 0, frontArmAngle: 20, backArmAngle: -20,
  frontLegAngle: 8, backLegAngle: -8, bodyY: 0,
};
export function lerpPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k] ?? REST[k] ?? 0;
    const bv = b[k] ?? REST[k] ?? 0;
    out[k] = av + (bv - av) * t;
  }
  return out;
}
```

```js
// src/anim/animation.js
import { REST, lerpPose } from './pose.js';

const ease = (t) => t * t * (3 - 2 * t); // smoothstep

export class Animation {
  constructor({ keyframes, durationMs, loop = false }) {
    this.keyframes = keyframes.length ? keyframes : [{ tMs: 0, pose: REST }];
    this.durationMs = durationMs;
    this.loop = loop;
  }
  poseAt(clockMs) {
    let t = this.loop ? clockMs % this.durationMs : Math.min(clockMs, this.durationMs);
    const kf = this.keyframes;
    let i = 0;
    while (i < kf.length - 1 && kf[i + 1].tMs <= t) i++;
    const a = kf[i], b = kf[Math.min(i + 1, kf.length - 1)];
    if (a === b || b.tMs === a.tMs) return { ...REST, ...a.pose };
    const f = ease((t - a.tMs) / (b.tMs - a.tMs));
    return lerpPose({ ...REST, ...a.pose }, { ...REST, ...b.pose }, f);
  }
}
```

- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: keyframe animation with pose tweening"`

---

### Task 7: Character definitions (Dario, Sam) + per-state animations

**Files:**
- Create: `src/characters.js`
- Test: `tests/characters.test.js`

**Interfaces:**
- Consumes: `MOVES`, `Animation`.
- Produces: `export const CHARACTERS = { dario, sam }`. Each: `{ id, name, company, stats, moves, palette, art:{ type:'procedural', palette }, taunt, anims: { idle, walk, jump, crouch, block, punch, kick, hitstun, ko } }` where each `anims[state]` is an `Animation` (idle/walk loop; attacks match their move total duration with 4–6 keyframes).

- [ ] **Step 1: Write the failing test**

```js
// tests/characters.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { CHARACTERS } from '../src/characters.js';

test('each character has all required animation states', () => {
  const need = ['idle','walk','jump','crouch','block','punch','kick','hitstun','ko'];
  for (const id of ['dario','sam']) {
    for (const st of need) assert.ok(CHARACTERS[id].anims[st], `${id} missing ${st}`);
  }
});

test('punch animation duration matches its move total', () => {
  const m = CHARACTERS.dario.moves.punch;
  assert.equal(CHARACTERS.dario.anims.punch.durationMs, m.startupMs + m.activeMs + m.recoveryMs);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement** — build the data. Keyframe poses use the `pose.js` fields; give attacks a wind-up → extend → retract arc (4–6 keyframes). Palettes per spec §4.

```js
// src/characters.js
import { MOVES } from './moves.js';
import { Animation } from './anim/animation.js';

const total = (m) => m.startupMs + m.activeMs + m.recoveryMs;

function attackAnim(m, armField) {
  return new Animation({
    durationMs: total(m), loop: false,
    keyframes: [
      { tMs: 0,                         pose: { [armField]: 10 } },
      { tMs: m.startupMs * 0.8,         pose: { [armField]: -40, torsoAngle: -6 } },
      { tMs: m.startupMs,               pose: { [armField]: 100, torsoAngle: 8 } },
      { tMs: m.startupMs + m.activeMs,  pose: { [armField]: 105, torsoAngle: 8 } },
      { tMs: total(m),                  pose: { [armField]: 10, torsoAngle: 0 } },
    ],
  });
}
const loopIdle = () => new Animation({ durationMs: 1200, loop: true, keyframes: [
  { tMs: 0, pose: { bodyY: 0 } }, { tMs: 600, pose: { bodyY: -4 } }, { tMs: 1200, pose: { bodyY: 0 } } ] });
const loopWalk = () => new Animation({ durationMs: 400, loop: true, keyframes: [
  { tMs: 0, pose: { frontLegAngle: 30, backLegAngle: -30 } },
  { tMs: 200, pose: { frontLegAngle: -30, backLegAngle: 30 } },
  { tMs: 400, pose: { frontLegAngle: 30, backLegAngle: -30 } } ] });
const still = (pose) => new Animation({ durationMs: 200, loop: false, keyframes: [{ tMs: 0, pose }] });

function make(id, name, company, stats, palette, taunt) {
  const m = MOVES[id];
  return {
    id, name, company, stats, moves: m, palette, taunt,
    art: { type: 'procedural', palette },
    anims: {
      idle: loopIdle(), walk: loopWalk(),
      jump: still({ frontLegAngle: 40, backLegAngle: 20, bodyY: -6 }),
      crouch: still({ bodyY: 26, frontLegAngle: 60, backLegAngle: -60 }),
      block: still({ frontArmAngle: 80, backArmAngle: 70, torsoAngle: -8 }),
      punch: attackAnim(m.punch, 'frontArmAngle'),
      kick: attackAnim(m.kick, 'frontLegAngle'),
      hitstun: still({ torsoAngle: -20, headAngle: -18 }),
      ko: still({ torsoAngle: -80, bodyY: 60, headAngle: -40 }),
    },
  };
}

export const CHARACTERS = {
  dario: make('dario', 'Dario', 'Claude',
    { walkSpeed: 220, jumpVelocity: -900, health: 100 },
    { skin:'#E8B89B', hair:'#5a3d2e', main:'#CC785C', mainShade:'#8a4a32', trim:'#F0EEE6', pants:'#2A2320' },
    "Let's align on this."),
  sam: make('sam', 'Sam', 'OpenAI',
    { walkSpeed: 300, jumpVelocity: -880, health: 92 },
    { skin:'#E8C4A0', hair:'#4a4038', main:'#10A37F', mainShade:'#0b6f57', trim:'#FFFFFF', pants:'#22262b' },
    'Scaling up.'),
};
```

- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Dario and Sam character definitions + animations"`

---

### Task 8: Procedural renderer (detailed fighter drawing)

**Files:**
- Create: `src/render/renderer.js`
- Create: `src/render/procedural.js`
- (No unit test — canvas drawing; verified manually. Add a tiny guard test that the module exports the interface.)
- Test: `tests/renderer.test.js`

**Interfaces:**
- Consumes: pose (from `Animation.poseAt`), character palette.
- Produces:
  - `renderer.js`: `export function getRenderer(artType)` returning an object with `drawFighter(ctx, { palette, pose, x, y, facing })`.
  - `procedural.js`: `export const proceduralRenderer` implementing `drawFighter` — draws a cel-shaded humanoid from layered limbs positioned/rotated by pose fields. Uses two-tone shading per region (`main`/`mainShade`). Draws relative to `(x, y)` with `y` at the feet; applies `facing` via horizontal flip; applies `bodyY` offset.

- [ ] **Step 1: Write the failing guard test**

```js
// tests/renderer.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { getRenderer } from '../src/render/renderer.js';

test('procedural renderer exposes drawFighter', () => {
  const r = getRenderer('procedural');
  assert.equal(typeof r.drawFighter, 'function');
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement** — a limb-based drawer. Each limb is a rounded capsule; head has face; torso is the outfit; apply cel shading by drawing a darker back-half. Rotations use `ctx.save/rotate/restore` around joint anchors. Keep it readable and tunable.

```js
// src/render/renderer.js
import { proceduralRenderer } from './procedural.js';
const REGISTRY = { procedural: proceduralRenderer };
export function getRenderer(artType) {
  return REGISTRY[artType] || proceduralRenderer;
}
export function registerRenderer(type, r) { REGISTRY[type] = r; }
```

```js
// src/render/procedural.js
const D2R = Math.PI / 180;

function capsule(ctx, len, w, fill, shade) {
  ctx.fillStyle = shade;
  roundRect(ctx, -w/2 + 2, 0, w, len, w/2); ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, -w/2, 0, w - 3, len, w/2); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function limb(ctx, ox, oy, angleDeg, len, w, fill, shade) {
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(angleDeg * D2R);
  capsule(ctx, len, w, fill, shade); ctx.restore();
}

export const proceduralRenderer = {
  drawFighter(ctx, { palette: p, pose, x, y, facing }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.translate(0, pose.bodyY || 0);

    const hipY = -70, shoulderY = -108, headY = -120;
    // back leg, back arm first (depth)
    limb(ctx, 6, hipY, 180 + (pose.backLegAngle||0), 72, 20, p.pants, '#000');
    limb(ctx, 6, shoulderY, 180 + (pose.backArmAngle||0), 60, 16, p.mainShade, '#000');
    // torso
    ctx.save(); ctx.translate(0, shoulderY); ctx.rotate((pose.torsoAngle||0)*D2R);
    ctx.fillStyle = p.mainShade; roundRect(ctx, -24, 0, 48, 54, 12); ctx.fill();
    ctx.fillStyle = p.main; roundRect(ctx, -22, 0, 40, 54, 12); ctx.fill();
    ctx.fillStyle = p.trim; ctx.fillRect(-22, 44, 44, 6);
    ctx.restore();
    // front leg, front arm
    limb(ctx, -6, hipY, 180 + (pose.frontLegAngle||0), 74, 20, p.pants, '#000');
    limb(ctx, -6, shoulderY, 180 + (pose.frontArmAngle||0), 62, 16, p.main, p.mainShade);
    // head
    ctx.save(); ctx.translate(0, headY); ctx.rotate((pose.headAngle||0)*D2R);
    ctx.fillStyle = p.skin; roundRect(ctx, -18, -4, 36, 36, 10); ctx.fill();
    ctx.fillStyle = p.hair; roundRect(ctx, -20, -8, 40, 16, 8); ctx.fill();
    ctx.fillStyle = '#2a2320'; ctx.fillRect(8, 12, 4, 4); // eye
    ctx.restore();
    ctx.restore();
  },
};
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/renderer.test.js` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: procedural cel-shaded fighter renderer"`

---

### Task 9: Procedural stage

**Files:**
- Create: `src/render/stage_procedural.js`
- Test: none (visual). Fold a one-line export guard into Task 10's manual check.

**Interfaces:**
- Consumes: `config`.
- Produces: `export const proceduralStage = { draw(ctx, cameraX) }` — sky gradient, silhouetted skyline (parallax by `cameraX`), mid buildings, tiled foreground floor at `config.floorY`, vignette. Draws original art (no JoJo references).

- [ ] **Step 1: Implement**

```js
// src/render/stage_procedural.js
import { config } from '../config.js';
export const proceduralStage = {
  draw(ctx, cameraX = 0) {
    const { w, h } = config.canvas, fy = config.floorY;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1e33'); sky.addColorStop(0.6, '#123a52'); sky.addColorStop(1, '#1d5a6b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,220,220,0.35)';
    ctx.beginPath(); ctx.arc(w*0.5, h*0.35, 70, 0, Math.PI*2); ctx.fill();
    // skyline silhouettes (parallax)
    ctx.fillStyle = '#0a1622';
    for (let i=0;i<10;i++){ const bx=((i*140 - cameraX*0.2)%(w+200))-100; ctx.fillRect(bx, fy-220, 90, 220); }
    ctx.fillStyle = '#0d1b2a';
    for (let i=0;i<8;i++){ const bx=((i*180 - cameraX*0.4)%(w+240))-120; ctx.fillRect(bx, fy-160, 130, 160); }
    // floor
    ctx.fillStyle = '#1c2c1e'; ctx.fillRect(0, fy, w, h-fy);
    ctx.strokeStyle = 'rgba(255,210,120,0.15)';
    for (let x=0;x<w;x+=48){ ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,200,90,0.9)'; ctx.fillRect(0, fy-2, w, 3);
    // vignette
    const vg = ctx.createRadialGradient(w/2, h/2, h*0.4, w/2, h/2, h*0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0,0,w,h);
  },
};
```

- [ ] **Step 2: Commit** — `git add -A && git commit -m "feat: procedural parallax stage"`

---

### Task 10: Fight screen — wire it together + HUD + single round

**Files:**
- Create: `src/hud.js`
- Create: `src/screens/fight.js`
- Modify: `src/main.js` (replace placeholder screen with the fight screen; pass an `Input` attached to `window`).
- Test: `tests/round.test.js` (headless round-end logic extracted as a pure function).

**Interfaces:**
- Consumes: `Fighter`, `CHARACTERS`, `getRenderer`, `proceduralStage`, `resolve`, `Input`, `Animation`.
- Produces:
  - `hud.js`: `export function drawHud(ctx, { p1, p2 })` — two health bars, names.
  - `fight.js`: `export function createFightScreen({ p1Id, p2Id, input })` returning `{ update(dt), render(ctx), state }`. P1 controlled by `input`; P2 is a stationary dummy (empty input) for this slice. Each `update`: snapshot input, step both fighters, run `resolve(p1,p2)` and `resolve(p2,p1)`, advance the correct animation clock per state, check round end.
  - `roundOutcome(p1, p2): 'p1'|'p2'|null` (pure) — returns winner when a fighter's health hits 0.

- [ ] **Step 1: Write the failing test**

```js
// tests/round.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { roundOutcome } from '../src/screens/fight.js';

test('round ends when a fighter is KO', () => {
  assert.equal(roundOutcome({ health: 30 }, { health: 0 }), 'p1');
  assert.equal(roundOutcome({ health: 0 }, { health: 30 }), 'p2');
  assert.equal(roundOutcome({ health: 30 }, { health: 30 }), null);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

```js
// src/hud.js
export function drawHud(ctx, { p1, p2 }) {
  bar(ctx, 30, 24, 380, p1.health / p1.max, '#CC785C', false, p1.name);
  bar(ctx, 550, 24, 380, p2.health / p2.max, '#10A37F', true, p2.name);
}
function bar(ctx, x, y, w, frac, color, rightAlign, name) {
  ctx.fillStyle = '#0a0f1a'; ctx.strokeStyle = '#1D9BF0'; ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, 22); ctx.strokeRect(x, y, w, 22);
  ctx.fillStyle = color;
  const fw = Math.max(0, w - 4) * frac;
  ctx.fillRect(rightAlign ? x + (w - 2) - fw : x + 2, y + 2, fw, 18);
  ctx.fillStyle = '#F0EEE6'; ctx.font = '16px monospace';
  ctx.textAlign = rightAlign ? 'right' : 'left';
  ctx.fillText(name, rightAlign ? x + w : x, y + 40);
}
```

```js
// src/screens/fight.js
import { config } from '../config.js';
import { Fighter } from '../fighter.js';
import { CHARACTERS } from '../characters.js';
import { getRenderer } from '../render/renderer.js';
import { proceduralStage } from '../render/stage_procedural.js';
import { resolve } from '../combat.js';

export function roundOutcome(p1, p2) {
  if (p2.health <= 0 && p1.health > 0) return 'p1';
  if (p1.health <= 0 && p2.health > 0) return 'p2';
  if (p1.health <= 0 && p2.health <= 0) return 'draw';
  return null;
}

export function createFightScreen({ p1Id, p2Id, input }) {
  const c1 = CHARACTERS[p1Id], c2 = CHARACTERS[p2Id];
  const p1 = new Fighter({ characterId: p1Id, x: 300, facing: 1, stats: c1.stats, moves: c1.moves });
  const p2 = new Fighter({ characterId: p2Id, x: 660, facing: -1, stats: c2.stats, moves: c2.moves });
  const clocks = { p1: 0, p2: 0 }; let lastState = { p1: 'idle', p2: 'idle' };
  const empty = { left:false,right:false,up:false,down:false,punch:false,kick:false,special:false, pressed:{} };
  let outcome = null, banner = 'FIGHT!', bannerT = 1.2;

  function stepClocks(dt) {
    for (const [k, f] of [['p1', p1], ['p2', p2]]) {
      if (f.state !== lastState[k]) { clocks[k] = 0; lastState[k] = f.state; }
      else clocks[k] += dt * 1000;
    }
  }

  return {
    get state() { return outcome; },
    update(dt) {
      if (outcome) { return; }
      const i = input.snapshot();
      p1.step(dt, i, p2.x);
      p2.step(dt, empty, p1.x);   // stationary dummy this slice
      resolve(p1, p2); resolve(p2, p1);
      stepClocks(dt);
      if (bannerT > 0) bannerT -= dt;
      outcome = roundOutcome(p1, p2);
      if (outcome) banner = outcome === 'p1' ? 'K.O.' : 'YOU LOSE';
    },
    render(ctx) {
      const cam = (p1.x + p2.x) / 2 - config.canvas.w / 2;
      proceduralStage.draw(ctx, cam);
      for (const [k, f, c] of [['p1', p1, c1], ['p2', p2, c2]]) {
        const anim = c.anims[f.state] || c.anims.idle;
        const pose = anim.poseAt(clocks[k]);
        getRenderer(c.art.type).drawFighter(ctx, { palette: c.palette, pose, x: f.x, y: f.y, facing: f.facing });
      }
      drawHud(ctx, {
        p1: { health: p1.health, max: c1.stats.health, name: c1.name },
        p2: { health: p2.health, max: c2.stats.health, name: c2.name },
      });
      if (bannerT > 0 || outcome) {
        ctx.fillStyle = '#FFD43B'; ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center';
        ctx.fillText(banner, config.canvas.w/2, config.canvas.h/2 - 60);
      }
    },
  };
}
import { drawHud } from '../hud.js';
```
Move the `import { drawHud }` to the top of the file with the other imports.

Modify `src/main.js`: replace `makePlaceholderScreen()` with:
```js
import { Input } from './input.js';
import { createFightScreen } from './screens/fight.js';
// inside startGame, before the loop:
const input = new Input(); input.attach(window);
let screen = createFightScreen({ p1Id: 'dario', p2Id: 'sam', input });
```

- [ ] **Step 4: Run tests** — `node --test` → all PASS.
- [ ] **Step 5: Manual UAT** — `npm run serve`, open the page: Dario and Sam stand on the stage; arrow keys move/jump Dario; holding away from Sam blocks; J/K attack; hitting Sam drains his health bar; reducing him to 0 shows "K.O.". Confirm animation tweens smoothly.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: playable Dario vs Sam vertical slice"`

---

## Self-Review

**Spec coverage (slice scope):** loop ✓(T1), input ✓(T2), physics/state machine ✓(T3), frame data ✓(T4), combat+block/chip ✓(T5), smooth tween animation ✓(T6), characters+palettes ✓(T7), swappable procedural renderer ✓(T8, interface ready for `sheet` later), procedural parallax stage ✓(T9), HUD+single round+wiring ✓(T10). Deferred to later phases (correctly out of slice): best-of-3, timer, round pips, CPU AI, specials+meter, third fighter, select/versus/result screens, audio, title/logo.

**Placeholder scan:** No TBD/TODO. Task 3's `stateClockWindowId` had two variants — the plan directs using the `_windowId` version; the executor must delete the first sketch. Flag kept intentionally with explicit instruction.

**Type consistency:** `InputState` shape identical across T2/T3/T10; `MOVES[id][move]` fields used consistently in T3/T4/T5; `Animation.poseAt` consumed in T10 as defined in T6; `getRenderer(art.type).drawFighter({palette,pose,x,y,facing})` signature matches T8 and T10; pose fields from T6 `REST` used in T7 keyframes and T8 drawing.

**Note for executor:** the `_windowId`-based `resolve` consumption in Task 5 is the canonical version — implement that and ignore the earlier `stateClockWindowId` string sketch.
