// 3D roster: the rigged characters from character-models/ with their Mixamo
// clip sets from character-models 2/anims/. Damage, reach and knockback come
// from the 2D move table; timing is re-derived from the clips so attacks
// play at mocap speed (see buildMoves).
import { CHARACTERS } from '../src/characters.js';
import { PX, BODY_HALF_DEPTH, HURT_HALF_W } from './mapping.js';
import { STRINGS, buildStringMoves } from './strings.js';

const withBase = (base, extra) => ({ ...base, ...extra, stats: base.stats, moves: base.moves, anims: base.anims });

// strings + fallback-timed move tables; rebuilt from the measured clips once they load
export function attachStrings(c) {
  c.strings = STRINGS[c.id];
  c.baseMoves = c.baseMoves || c.moves;
  c.moves = buildStringMoves(c.id, {}, c.baseMoves);
  return c;
}

export const ROSTER = {
  elon: withBase(CHARACTERS.dario, {
    id: 'elon', name: 'Elon', company: 'xAI',
    model: 'character-models/models/elon_musk.glb?v=cinematic-20260924-3', height: 1.92, targetHeight: 1.78,
    clips: 'character-models 2/anims/elon',
    portrait: 'assets/pfp/elon_3d.png?v=cinematic-20260924-3', portraitHud: 'assets/pfp/elon_hud.png',
    accent: '#e8412c', accentHi: '#ffb19f',
  }),
  sam: withBase(CHARACTERS.sam, {
    id: 'sam', name: 'Sam', company: 'OpenAI',
    model: 'character-models/models/sam_altman.glb?v=cinematic-20260924-3', height: 1.80, targetHeight: 1.68,
    clips: 'character-models 2/anims/sam',
    portrait: 'assets/pfp/sam_3d.png?v=cinematic-20260924-3', portraitHud: 'assets/pfp/sam_hud.png',
    accent: '#10A37F', accentHi: '#6af0c8',
  }),
};

// Which clip each attack state plays, and how fast (mocap clips are leisurely;
// a fighting game wants them 1.8x-2.4x).
export const ATTACK_CLIPS = {
  standLP: { clip: 'jab', speed: 2.4 },
  standHP: { clip: 'cross', speed: 2.1 },
  standLK: { clip: 'snap_kick', speed: 2.0 },
  standHK: { clip: 'roundhouse', speed: 1.8 },
  crouchPunch: { clip: 'uppercut', speed: 2.0 },
  crouchKick: { clip: 'sweep', speed: 1.9 },
  jumpPunch: { clip: 'hook', speed: 2.2 },
  jumpKick: { clip: 'flying_kick', speed: 1.1 },
};
// Re-time the 2D frame data to the measured clips: the hitbox opens just
// before the strike visually lands, stays open briefly, then recovery runs
// to the end of the clip.
export function buildMoves(baseMoves, contacts) {
  const out = {};
  for (const [state, m] of Object.entries(baseMoves)) {
    const a = ATTACK_CLIPS[state];
    const c = a && contacts[a.clip];
    if (!c) { out[state] = { ...m, hitstunMs: Math.round(m.hitstunMs * 1.4) }; continue; }
    const total = (c.duration / a.speed) * 1000;
    const contact = (c.contact / a.speed) * 1000;
    const active = Math.max(80, Math.min(130, total * 0.16));
    // hit reach from the clip: the strike registers when the limb's full extension
    // reaches the opponent's front surface (a 0.1 m margin keeps it reliable)
    const reachPx = c.reachM ? Math.round((c.reachM + BODY_HALF_DEPTH + 0.1) / PX - HURT_HALF_W) : m.reach;
    // the hitbox opens on the measured contact frame, so the hit-stop and all
    // feedback land on the visual impact (the sim step lands within 0-16 ms after)
    const startup = Math.max(40, Math.round(contact));
    out[state] = {
      ...m,
      startupMs: startup,
      activeMs: Math.round(active),
      recoveryMs: Math.max(80, Math.round(total - startup - active)),
      hitstunMs: Math.round(m.hitstunMs * 1.4),
      reach: Math.max(m.reach * 0.8, reachPx),
      contactMs: Math.round(contact),
      clip: a.clip,
      clipSpeed: a.speed,
    };
  }
  return out;
}

attachStrings(ROSTER.elon);
attachStrings(ROSTER.sam);
