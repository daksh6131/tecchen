// Hit resolution for string moves: per-hit windows of multi-hit moves,
// counter hits (the victim was in an attack's startup), height bands vs
// standing / crouching / downed hurtboxes, unblockable Rage Arts, and the
// property upgrades a counter hit grants (launch, knockdown, stagger).
import { comboScale, resolve as resolveShared } from '../src/combat.js';
import { F, CH_BONUS_F, LAUNCH_VY } from './strings.js';

const BANDS = {
  high: [-110, 32],
  mid: [-92, 42],
  low: [-34, 28],
};
const CROUCHED = { crouch: true, crouchblock: true };

export function hurtbox3d(f) {
  const v = f.vulnerability ?? 'up';
  if (v === 'none') return null;
  if (v === 'down') return { x: f.x - 50, y: f.y - 28, w: 100, h: 28, down: true };
  const m = f.moves[f.state];
  const crouched = f.grounded && (CROUCHED[f.state] || (m && m.hits && m.hits[0].height === 'low'));
  const h = crouched ? 78 : 120;
  return { x: f.x - 22, y: f.y - h, w: 44, h };
}

export function hitbox3d(f) {
  const m = f.moves[f.state];
  if (!m || !m.hitTimes) return null;
  const idx = f._hitIdx;
  if (idx < 0) return null;
  const t = f.stateClock;
  const at = m.hitTimes[idx];
  if (t < at || t > at + m.activeMs) return null;
  const hit = m.hits[idx];
  const [top, h] = hit.ground ? [-40, 40] : (BANDS[hit.height] || BANDS.mid);
  const w = m.reach;
  const x = f.facing > 0 ? f.x - (hit.wide ? w * 0.5 : 0) : f.x - w * (hit.wide ? 0.5 : 1);
  return { x, y: f.y + top, w: hit.wide ? w * 1.5 : w, h, hit, idx };
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const MISS = Object.freeze({ hit: false, blocked: false, damage: 0 });

// Was the defender caught in the startup of their own attack?
export function isCounterHit(defender) {
  const m = defender.moves?.[defender.state];
  if (!m || m.air) return false;
  return defender.stateClock < m.startupMs;
}

export function resolve3d(attacker, defender, comboHits = 0) {
  const m = attacker.moves[attacker.state];
  if (!m) return MISS;
  // jump-ins keep the shared single-window rules
  if (!m.hitTimes) return resolveShared(attacker, defender, comboHits);
  const hb = hitbox3d(attacker);
  if (!hb) return MISS;
  if (attacker._consumedWindow === attacker._windowId) return MISS;
  const hurt = hurtbox3d(defender);
  if (!hurt || !overlap(hb, hurt)) return MISS;
  // only ground attacks reach a body lying on the floor; highs whiff over crouchers
  if (hurt.down && !hb.hit.ground) return MISS;
  if (!hurt.down && hb.hit.ground && defender.grounded) return MISS;

  attacker._consumedWindow = attacker._windowId;
  attacker._contact = true;
  const hit = hb.hit;
  const counter = isCounterHit(defender);
  // Rage Arts deal their full listed damage; everything else scales in combos
  const scale = m.rage ? 1 : comboScale(comboHits);
  const damage = Math.max(1, Math.round(hit.damage * scale * (counter && !m.rage ? 1.1 : 1)));
  const facingAttacker = Math.sign(attacker.x - defender.x) === defender.facing;

  const guarded = !m.unblockable && facingAttacker && defender.grounded && (
    (defender.state === 'block' && hit.height !== 'low') ||
    (defender.state === 'crouchblock' && hit.height === 'low')
  );
  if (guarded) {
    const chip = Math.ceil(damage * 0.25);
    defender.health = Math.max(0, defender.health - chip);
    defender.flashT = 0.06;
    defender.vx = Math.sign(defender.x - attacker.x || 1) * hit.knockback * 0.45;
    attacker.meter = Math.min(100, attacker.meter + Math.round(m.meterGain / 2));
    return { hit: true, blocked: true, damage: chip, height: hit.height, stopF: 3 };
  }

  const props = {
    damage,
    knockback: hit.knockback,
    hitstunMs: hit.hitstunMs + (counter ? CH_BONUS_F * F : 0),
    launch: hit.launch || (counter && hit.chLaunch ? LAUNCH_VY : 0),
    knockdown: hit.knockdown || (counter && hit.chKnockdown),
    stagger: counter && hit.chStagger,
    bound: hit.bound,
    rageFinish: hit.rageFinish,
    lock: hit.lock,
  };
  defender.applyHit3d(props, attacker.x);
  attacker.meter = Math.min(100, attacker.meter + m.meterGain);
  return {
    hit: true, blocked: false, damage, height: hit.ground ? 'low' : hit.height,
    launched: !!props.launch, knockdown: !!props.knockdown, bound: !!props.bound && defender._bounded,
    stagger: !!props.stagger, counter, rage: !!m.rage, rageFinish: !!props.rageFinish,
    stopF: counter && (props.launch || props.knockdown || props.stagger) ? 8 : hit.stopF,
    string: m.name, ender: !!(props.launch || props.knockdown || props.bound || hit.rageFinish),
  };
}
