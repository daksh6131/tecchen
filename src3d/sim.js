// One round of the fight, presentation-agnostic. Reuses the tested 2D combat
// core (fighter state machine, frame data, hit resolution, CPU) and emits
// events the 3D layer turns into sparks, shake, freeze and sound.
import { config } from '../src/config.js';
import { Fighter } from '../src/fighter.js';
import { CHARACTERS } from '../src/characters.js';
import { resolve } from '../src/combat.js';
import { createAI } from '../src/ai.js';
import { Fighter3D } from './fighter3d.js';
import { resolve3d } from './combat3d.js';
import { createAI3d } from './ai3d.js';
import { F } from './strings.js';

export const EMPTY_INPUT = Object.freeze({
  left: false, right: false, up: false, down: false,
  lp: false, hp: false, lk: false, hk: false, special: false, pressed: {},
});

const PUSHBOX_W = 60;          // standing bodies: 0.8 m between centres
const MIN_X = 60;
const MAX_X = config.canvas.w - 60;

export function roundOutcome(p1, p2) {
  if (p1.health <= 0 && p2.health <= 0) return 'draw';
  if (p2.health <= 0) return 'p1';
  if (p1.health <= 0) return 'p2';
  return null;
}

// opponent attack imminent/active and in range -> holding back guards
export function threat(defender, attacker) {
  const m = attacker.moves[attacker.state];
  if (!m) return false;
  if (attacker.stateClock >= (m.activeEndMs ?? m.startupMs + m.activeMs)) return false;
  return Math.abs(attacker.x - defender.x) < m.reach + 80;
}

function clampToStage(f) {
  if (f.x < MIN_X) f.x = MIN_X;
  if (f.x > MAX_X) f.x = MAX_X;
}

// minGap(attacker, defender) may return a larger required centre distance (px)
// while a strike is extending, so limbs stop at the opponent's surface.
export function createRound({ p1Id = 'dario', p2Id = 'sam', chars = null, cpuHandicap = 0, minGap = null, rng = Math.random } = {}) {
  const c1 = chars ? chars[0] : CHARACTERS[p1Id];
  const c2 = chars ? chars[1] : CHARACTERS[p2Id];
  // roster characters with string tables get the string fighter, resolver and CPU
  const strings = !!(c1.strings && c2.strings);
  const make = (c, id, x, facing) => (strings
    ? new Fighter3D({ characterId: c.id || id, x, facing, stats: c.stats, moves: c.moves, strings: c.strings })
    : new Fighter({ characterId: id, x, facing, stats: c.stats, moves: c.moves }));
  const p1 = make(c1, p1Id, 320, 1);
  const p2 = make(c2, p2Id, 640, -1);
  const cpu = strings ? createAI3d(p2, p1, c2.id, rng) : createAI(p2, p1, rng);
  const resolveHit = strings ? resolve3d : resolve;

  const combos = { p1: { hits: 0, t: 0, damage: 0, name: null, counter: false }, p2: { hits: 0, t: 0, damage: 0, name: null, counter: false } };
  let outcome = null;
  let freezeT = 0;
  // button presses made during hit-stop are delivered on the first free frame,
  // so a follow-up pressed as the hit connects is not lost
  // (with the directions held at the moment of the press, so d+3 stays d+3)
  const DIRS = ['left', 'right', 'up', 'down'];
  const held = { p1: null, p2: null };
  const keep = (k, inp) => {
    if (!inp || !inp.pressed) return;
    const btns = Object.keys(inp.pressed).filter((b) => inp.pressed[b] && !DIRS.includes(b));
    if (!btns.length) return;
    const h = held[k] || (held[k] = { pressed: {}, dirs: {} });
    for (const b of btns) h.pressed[b] = true;
    for (const d of DIRS) if (inp[d]) h.dirs[d] = true;
  };
  const release = (k, inp) => {
    const h = held[k];
    if (!h || !inp) return inp;
    held[k] = null;
    const out = { ...inp, ...h.dirs, pressed: { ...(inp.pressed || {}), ...h.pressed } };
    for (const b of Object.keys(h.pressed)) out[b] = true;
    return out;
  };
  let koT = 0;
  let elapsed = 0;

  function separate() {
    if (!p1.grounded || !p2.grounded) return;
    const dx = p2.x - p1.x;
    let need = PUSHBOX_W;
    if (minGap) need = Math.max(need, minGap(p1, p2) || 0, minGap(p2, p1) || 0);
    const pen = need - Math.abs(dx);
    if (pen > 0) {
      const s = dx >= 0 ? 1 : -1;
      p1.x -= s * pen / 2;
      p2.x += s * pen / 2;
      clampToStage(p1);
      clampToStage(p2);
    }
  }

  function contact(events, r, key, attacker, defender, wasVulnerable) {
    if (!r.hit) return;
    const combo = combos[key];
    const ix = (attacker.x + defender.x) / 2;
    const iy = defender.y - (r.height === 'low' ? 30 : 92);
    if (r.blocked) {
      combo.hits = 0;
      freezeT = Math.max(freezeT, r.stopF ? r.stopF * F / 1000 : 0.045);
      events.push({ type: 'block', x: ix, y: iy, attacker: key, damage: r.damage });
      return;
    }
    const fresh = !wasVulnerable || combo.hits === 0;
    combo.hits = fresh ? 1 : combo.hits + 1;
    combo.damage = fresh ? r.damage : combo.damage + r.damage;
    if (fresh) { combo.name = r.string || null; combo.counter = !!r.counter; }
    combo.t = 1.1;
    const heavy = r.damage >= 9 || !!r.ender;
    freezeT = Math.max(freezeT, r.stopF ? r.stopF * F / 1000 : (heavy ? 0.095 : 0.06));
    events.push({
      type: 'hit', x: ix, y: iy, attacker: key, damage: r.damage,
      heavy, launched: !!r.launched, combo: combo.hits, height: r.height,
      counter: !!r.counter, knockdown: !!r.knockdown, bound: !!r.bound, stagger: !!r.stagger,
      ender: !!r.ender, rageFinish: !!r.rageFinish, string: r.string || null,
    });
  }

  function flags(events, f, key) {
    if (f._whiffed) { f._whiffed = false; events.push({ type: 'whiff', who: key }); }
    if (f._landed) { f._landed = false; events.push({ type: 'land', who: key, x: f.x }); }
    if (f._rageStarted) { f._rageStarted = false; events.push({ type: 'rage', who: key, x: f.x }); }
  }

  return {
    p1, p2, c1, c2, combos,
    get outcome() { return outcome; },
    get koSettled() { return outcome !== null && koT <= 0; },
    get frozen() { return freezeT > 0; },
    get elapsed() { return elapsed; },

    // Returns the events produced this step.
    step(dt, p1Input = EMPTY_INPUT, p2Input = null) {
      const events = [];
      elapsed += dt;
      for (const c of Object.values(combos)) if (c.t > 0) c.t -= dt;

      if (freezeT > 0) {
        freezeT -= dt;
        keep('p1', p1Input);
        if (p2Input) keep('p2', p2Input);
        return events;
      }
      p1Input = release('p1', p1Input);
      if (p2Input) p2Input = release('p2', p2Input);

      if (outcome) {
        if (koT > 0) {
          koT -= dt;
          const s = dt * 0.35;                 // slow-motion settle
          p1.step(s, EMPTY_INPUT, p2.x);
          p2.step(s, EMPTY_INPUT, p1.x);
          clampToStage(p1); clampToStage(p2);
          flags(events, p1, 'p1'); flags(events, p2, 'p2');
        }
        return events;
      }

      const t1 = threat(p1, p2);
      const t2 = threat(p2, p1);
      const hurt = (f) => f.state === 'hitstun' || f.state === 'stagger' || f.state === 'knockdown' || f.state === 'down' || (!f.grounded && f.state !== 'jump' && !f.moves[f.state]);
      const p2InCombo = hurt(p2);
      const p1InCombo = hurt(p1);

      p1.step(dt, p1Input, p2.x, t1);
      let cpuIn = p2Input;
      if (!cpuIn) {
        cpuIn = cpu.nextInput(dt);
        // difficulty handicap: the CPU fumbles a share of its attack presses
        if (cpuHandicap > 0 && rng() < cpuHandicap) {
          cpuIn = { ...cpuIn, lp: false, hp: false, lk: false, hk: false, special: false, pressed: { ...cpuIn.pressed, lp: false, hp: false, lk: false, hk: false, special: false } };
        }
      }
      p2.step(dt, cpuIn, p1.x, t2);
      clampToStage(p1);
      clampToStage(p2);
      separate();
      flags(events, p1, 'p1');
      flags(events, p2, 'p2');

      contact(events, resolveHit(p1, p2, p2InCombo ? combos.p1.hits + 1 : 1), 'p1', p1, p2, p2InCombo);
      contact(events, resolveHit(p2, p1, p1InCombo ? combos.p2.hits + 1 : 1), 'p2', p2, p1, p1InCombo);

      outcome = roundOutcome(p1, p2);
      if (outcome) {
        koT = 1.4;
        events.push({ type: 'ko', outcome });
      }
      return events;
    },
  };
}
