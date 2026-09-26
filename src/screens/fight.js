import { config } from '../config.js';
import { Fighter } from '../fighter.js';
import { CHARACTERS } from '../characters.js';
import { getRenderer } from '../render/renderer.js';
import { nextStage } from '../render/stages.js';
import { resolve } from '../combat.js';
import { drawHud } from '../hud.js';
import { createAI } from '../ai.js';
import { sfxHit, sfxBlock, sfxKO, sfxWhiff, sfxLaunch, sfxLand, announce } from '../audio.js';

const EMPTY_INPUT = {
  left: false, right: false, up: false, down: false,
  lp: false, hp: false, lk: false, hk: false, special: false, pressed: {},
};

const PUSHBOX_W = 52;

export function roundOutcome(p1, p2) {
  if (p1.health <= 0 && p2.health <= 0) return 'draw';
  if (p2.health <= 0) return 'p1';
  if (p1.health <= 0) return 'p2';
  return null;
}

// opponent attack imminent/active and in range -> holding back guards
function threat(defender, attacker) {
  const m = attacker.moves[attacker.state];
  if (!m) return false;
  if (attacker.stateClock >= m.startupMs + m.activeMs) return false;
  return Math.abs(attacker.x - defender.x) < m.reach + 80;
}

export function createFightScreen({ p1Id, p2Id, input }) {
  const c1 = CHARACTERS[p1Id];
  const c2 = CHARACTERS[p2Id];
  const p1 = new Fighter({ characterId: p1Id, x: 320, facing: 1, stats: c1.stats, moves: c1.moves });
  const p2 = new Fighter({ characterId: p2Id, x: 640, facing: -1, stats: c2.stats, moves: c2.moves });
  const cpu = createAI(p2, p1);
  const stage = nextStage();
  let elapsed = 0;
  announce('Fight!');

  let outcome = null;
  let banner = 'FIGHT!';
  let bannerT = 1.4;
  let freezeT = 0;
  let shakeT = 0;
  let shakeMag = 0;
  let koT = 0;
  const sparks = [];

  // combo bookkeeping per attacker side
  const combos = {
    p1: { hits: 0, t: 0 },
    p2: { hits: 0, t: 0 },
  };

  function clampToStage(f) {
    const minX = 60, maxX = config.canvas.w - 60;
    if (f.x < minX) f.x = minX;
    if (f.x > maxX) f.x = maxX;
  }

  function separate() {
    if (!p1.grounded || !p2.grounded) return;
    const dx = p2.x - p1.x;
    const pen = PUSHBOX_W - Math.abs(dx);
    if (pen > 0) {
      const s = dx >= 0 ? 1 : -1;
      p1.x -= s * pen / 2;
      p2.x += s * pen / 2;
      clampToStage(p1);
      clampToStage(p2);
    }
  }

  function spawnSparks(x, y, blocked) {
    const n = blocked ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.22 + Math.random() * 0.15,
        size: blocked ? 2.5 : 3.5,
        color: blocked ? '#7fd4f0' : (Math.random() < 0.5 ? '#FFD43B' : '#fff3c4'),
      });
    }
  }

  function onContact(r, key, attacker, defender, defenderWasVulnerable) {
    if (!r.hit) return;
    const combo = combos[key];
    const ix = (attacker.x + defender.x) / 2;
    const iy = defender.y - (r.height === 'low' ? 30 : 92);
    spawnSparks(ix, iy, r.blocked);

    if (r.blocked) {
      combo.hits = 0;
      freezeT = Math.max(freezeT, 0.045);
      shakeT = 0.1; shakeMag = 3;
      sfxBlock();
      return;
    }

    combo.hits = defenderWasVulnerable ? combo.hits + 1 : 1;
    combo.t = 1.1;

    const heavy = r.damage >= 9;
    freezeT = Math.max(freezeT, heavy ? 0.095 : 0.06);
    shakeT = heavy ? 0.22 : 0.13;
    shakeMag = heavy ? 9 : 5;
    if (r.launched) sfxLaunch(); else sfxHit(heavy);
  }

  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 900 * dt;
    }
  }

  function consumeFlags(f) {
    if (f._whiffed) { f._whiffed = false; sfxWhiff(); }
    if (f._landed) { f._landed = false; sfxLand(); }
  }

  return {
    get state() { return outcome; },
    get koSettled() { return outcome !== null && koT <= 0; },

    update(dt) {
      elapsed += dt;
      if (bannerT > 0) bannerT -= dt;
      if (shakeT > 0) shakeT -= dt;
      for (const c of Object.values(combos)) if (c.t > 0) c.t -= dt;
      stepSparks(dt);

      if (freezeT > 0) { freezeT -= dt; return; }

      if (outcome) {
        if (koT > 0) {
          koT -= dt;
          const s = dt * 0.35;
          p1.step(s, EMPTY_INPUT, p2.x);
          p2.step(s, EMPTY_INPUT, p1.x);
          clampToStage(p1); clampToStage(p2);
        }
        return;
      }

      const i = input ? input.snapshot() : EMPTY_INPUT;
      const t1 = threat(p1, p2);
      const t2 = threat(p2, p1);
      // is the target still reeling? (continues a combo, scales its damage)
      const p2InCombo = p2.state === 'hitstun' || (!p2.grounded && p2.state !== 'jump');
      const p1InCombo = p1.state === 'hitstun' || (!p1.grounded && p1.state !== 'jump');

      p1.step(dt, i, p2.x, t1);
      p2.step(dt, cpu.nextInput(dt), p1.x, t2);
      clampToStage(p1);
      clampToStage(p2);
      separate();
      consumeFlags(p1);
      consumeFlags(p2);

      onContact(resolve(p1, p2, p2InCombo ? combos.p1.hits + 1 : 1), 'p1', p1, p2, p2InCombo);
      onContact(resolve(p2, p1, p1InCombo ? combos.p2.hits + 1 : 1), 'p2', p2, p1, p1InCombo);

      outcome = roundOutcome(p1, p2);
      if (outcome) {
        banner = outcome === 'p1' ? 'K.O.' : (outcome === 'p2' ? 'YOU LOSE' : 'DRAW');
        bannerT = 999;
        koT = 1.2;
        shakeT = 0.35; shakeMag = 12;
        sfxKO();
        announce(outcome === 'draw' ? 'Draw!' : 'K O!');
      }
    },

    render(ctx) {
      const cam = (p1.x + p2.x) / 2 - config.canvas.w / 2;

      ctx.save();
      if (shakeT > 0) {
        ctx.translate((Math.random() - 0.5) * 2 * shakeMag * shakeT * 4,
                      (Math.random() - 0.5) * 2 * shakeMag * shakeT * 4);
      }

      stage.draw(ctx, cam, elapsed);

      const order = p1.y <= p2.y ? [[p2, c2], [p1, c1]] : [[p1, c1], [p2, c2]];
      for (const [f, c] of order) {
        const anim = c.anims[f.state] || c.anims.idle;
        const pose = anim.poseAt(f.stateClock);
        getRenderer(c.art.type).drawFighter(ctx, {
          art: c.art, palette: c.palette, pose, x: f.x, y: f.y, facing: f.facing,
          state: f.state, stateClock: f.stateClock,
          flash: f.flashT > 0,
        });
      }

      for (const s of sparks) {
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.restore();

      drawHud(ctx, {
        p1: { health: p1.health, max: c1.stats.health, name: c1.name, company: c1.company, art: c1.art, pfp: c1.pfp },
        p2: { health: p2.health, max: c2.stats.health, name: c2.name, company: c2.company, art: c2.art, pfp: c2.pfp },
      });

      drawCombo(ctx, combos.p1, 150, false);
      drawCombo(ctx, combos.p2, config.canvas.w - 150, true);

      ctx.fillStyle = 'rgba(127,168,208,0.75)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        '←→ MOVE (×2 DASH)  ↑ JUMP  ↓ CROUCH  U·LP  I·HP  J·LK  K·HK  ↓+PUNCH UPPERCUT  ↓+KICK SWEEP  BACK=BLOCK (↓+BACK VS LOWS)',
        config.canvas.w / 2, config.canvas.h - 12,
      );

      if (bannerT > 0 && !outcome) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, bannerT * 2);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#F0EEE6';
        ctx.fillText(stage.name, config.canvas.w / 2, config.canvas.h / 2 + 4);
        ctx.restore();
      }
      if (bannerT > 0) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 72px monospace';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#3a0d0d';
        ctx.fillStyle = '#FFD43B';
        ctx.strokeText(banner, config.canvas.w / 2, config.canvas.h / 2 - 40);
        ctx.fillText(banner, config.canvas.w / 2, config.canvas.h / 2 - 40);
        if (outcome && koT <= 0) {
          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = '#F0EEE6';
          ctx.fillText('PRESS ENTER TO REMATCH', config.canvas.w / 2, config.canvas.h / 2 + 10);
        }
        ctx.restore();
      }
    },
  };
}

function drawCombo(ctx, combo, x, rightSide) {
  if (combo.hits < 2 || combo.t <= 0) return;
  ctx.save();
  const pop = 1 + Math.min(0.35, combo.t - 0.75 > 0 ? (combo.t - 0.75) * 1.4 : 0);
  ctx.translate(x, 120);
  ctx.scale(pop, pop);
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px monospace';
  ctx.globalAlpha = Math.min(1, combo.t * 2.5);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3a0d0d';
  ctx.fillStyle = rightSide ? '#7fd4f0' : '#FFD43B';
  ctx.strokeText(`${combo.hits} HITS!`, 0, 0);
  ctx.fillText(`${combo.hits} HITS!`, 0, 0);
  ctx.restore();
}
