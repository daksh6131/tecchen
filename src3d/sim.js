// One round of the fight, presentation-agnostic. Reuses the tested 2D combat
// core (fighter state machine, frame data, hit resolution, CPU) and emits
// events the 3D layer turns into sparks, shake, freeze and sound.
import { config } from '../src/config.js';
import { Fighter } from '../src/fighter.js';
import { CHARACTERS } from '../src/characters.js';
import { resolve } from '../src/combat.js';
import { createAI } from '../src/ai.js';

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
  if (attacker.stateClock >= m.startupMs + m.activeMs) return false;
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
  const p1 = new Fighter({ characterId: p1Id, x: 320, facing: 1, stats: c1.stats, moves: c1.moves });
  const p2 = new Fighter({ characterId: p2Id, x: 640, facing: -1, stats: c2.stats, moves: c2.moves });
  const cpu = createAI(p2, p1, rng);

  const combos = { p1: { hits: 0, t: 0, damage: 0 }, p2: { hits: 0, t: 0, damage: 0 } };
  let outcome = null;
  let freezeT = 0;
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
      freezeT = Math.max(freezeT, 0.045);
      events.push({ type: 'block', x: ix, y: iy, attacker: key, damage: r.damage });
      return;
    }
    combo.hits = wasVulnerable ? combo.hits + 1 : 1;
    combo.damage = wasVulnerable ? combo.damage + r.damage : r.damage;
    combo.t = 1.1;
    const heavy = r.damage >= 9;
    freezeT = Math.max(freezeT, heavy ? 0.095 : 0.06);
    events.push({
      type: 'hit', x: ix, y: iy, attacker: key, damage: r.damage,
      heavy, launched: !!r.launched, combo: combo.hits, height: r.height,
    });
  }

  function flags(events, f, key) {
    if (f._whiffed) { f._whiffed = false; events.push({ type: 'whiff', who: key }); }
    if (f._landed) { f._landed = false; events.push({ type: 'land', who: key, x: f.x }); }
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

      if (freezeT > 0) { freezeT -= dt; return events; }

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
      const p2InCombo = p2.state === 'hitstun' || (!p2.grounded && p2.state !== 'jump');
      const p1InCombo = p1.state === 'hitstun' || (!p1.grounded && p1.state !== 'jump');

      p1.step(dt, p1Input, p2.x, t1);
      let cpuIn = p2Input;
      if (!cpuIn) {
        cpuIn = cpu.nextInput(dt);
        // difficulty handicap: the CPU fumbles a share of its attack presses
        if (cpuHandicap > 0 && rng() < cpuHandicap) {
          cpuIn = { ...cpuIn, lp: false, hp: false, lk: false, hk: false, pressed: { ...cpuIn.pressed, lp: false, hp: false, lk: false, hk: false } };
        }
      }
      p2.step(dt, cpuIn, p1.x, t2);
      clampToStage(p1);
      clampToStage(p2);
      separate();
      flags(events, p1, 'p1');
      flags(events, p2, 'p2');

      contact(events, resolve(p1, p2, p2InCombo ? combos.p1.hits + 1 : 1), 'p1', p1, p2, p2InCombo);
      contact(events, resolve(p2, p1, p1InCombo ? combos.p2.hits + 1 : 1), 'p2', p2, p1, p1InCombo);

      outcome = roundOutcome(p1, p2);
      if (outcome) {
        koT = 1.4;
        events.push({ type: 'ko', outcome });
      }
      return events;
    },
  };
}
