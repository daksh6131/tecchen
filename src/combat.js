// Hit bands relative to the fighter's feet (y): [top offset, height].
// Highs pass clean over a crouching hurtbox — the whiff falls out of geometry.
const BANDS = {
  high: [-110, 32],
  mid: [-92, 42],
  low: [-34, 28],
};

const CROUCHED = { crouch: true, crouchblock: true, crouchPunch: true, crouchKick: true };

export function hurtbox(f) {
  const h = (CROUCHED[f.state] && f.grounded) ? 78 : 120;
  return { x: f.x - 22, y: f.y - h, w: 44, h };
}

export function activeHitbox(f) {
  const m = f.moves[f.state];
  if (!m) return null;
  const t = f.stateClock;
  if (t < m.startupMs || t > m.startupMs + m.activeMs) return null;
  const [top, h] = BANDS[m.height] || BANDS.mid;
  const w = m.reach;
  const x = f.facing > 0 ? f.x : f.x - w;
  return { x, y: f.y + top, w, h };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Combo scaling: each extra hit in a string deals less.
export function comboScale(comboHits) {
  if (comboHits <= 1) return 1;
  return Math.max(0.45, Math.pow(0.85, comboHits - 1));
}

export function resolve(attacker, defender, comboHits = 0) {
  const hb = activeHitbox(attacker);
  if (!hb) return { hit: false, blocked: false, damage: 0 };
  if (attacker._consumedWindow === attacker._windowId) return { hit: false, blocked: false, damage: 0 };
  if (!overlap(hb, hurtbox(defender))) return { hit: false, blocked: false, damage: 0 };

  attacker._consumedWindow = attacker._windowId;
  attacker._contact = true;
  const m = attacker.moves[attacker.state];
  const damage = Math.max(1, Math.round(m.damage * comboScale(comboHits)));
  const facingAttacker = Math.sign(attacker.x - defender.x) === defender.facing;

  // Tekken guard rules: standing block stops high+mid but loses to lows;
  // crouch block stops lows (mids beat it; highs already whiffed by geometry).
  const guarded = facingAttacker && defender.grounded && (
    (defender.state === 'block' && m.height !== 'low') ||
    (defender.state === 'crouchblock' && m.height === 'low')
  );

  if (guarded) {
    const chip = Math.ceil(damage * 0.25);
    defender.health = Math.max(0, defender.health - chip);
    defender.flashT = 0.06;
    attacker.meter = Math.min(100, attacker.meter + m.meterGain);
    return { hit: true, blocked: true, damage: chip, height: m.height };
  }

  defender.applyHit(
    { damage, knockback: m.knockback, hitstunMs: m.hitstunMs, launch: m.launch },
    attacker.x,
  );
  attacker.meter = Math.min(100, attacker.meter + m.meterGain);
  return { hit: true, blocked: false, damage, height: m.height, launched: !!m.launch };
}
