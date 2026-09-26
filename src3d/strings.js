// Character-specific Tekken-style strings (docs/superpowers/specs/2026-09-24-combos-design.md).
//
// Each character has a move graph. A node is one move: the clip it plays,
// its target startup in 60 fps sim frames, its hits (damage + height), its
// properties, and the follow-ups it accepts (`next`, keyed by input token).
// `STARTERS` maps an input token pressed from neutral to a node.
//
// Input tokens: 1 = LP (U), 2 = HP (I), 3 = LK (J), 4 = HK (K), L = Rage Art.
// Directions are relative to facing: f+2, b+2, d+1, u/f+3, f,f+2 (dash).
//
// Timing is fitted to the real clips by buildStringMoves: playback speed is
// chosen so the clip's first contact frame lands exactly on the target
// startup, and every later contact (multi-hit clips) follows at that speed.

import { PX, BODY_HALF_DEPTH, HURT_HALF_W } from './mapping.js';

export const F = 1000 / 60;                     // one sim frame in ms

// hitstun / hit-stop classes (frames), from the spec's timing table
export const HITSTUN_F = { light: 18, mid: 24, heavy: 30 };
export const HITSTOP_F = { light: 4, heavy: 6, ender: 8 };
export const CH_BONUS_F = 8;
export const CANCEL_OPEN_F = 16;                // input accepted from contact - 4 f, plus the 12 f buffer
export const CANCEL_CLOSE_F = { nc: 12, delay: 18 };
export const LAUNCH_VY = 640;
export const DOWN_MS = 60 * F;
export const GETUP_MS = 58 * F;
export const STAGGER_MS = 34 * F;

// Fallback clip timing (seconds) used until the real clips are measured.
// New combo clips carry authored contact frames in their manifests; the
// original clips are measured from the striking limb when they load.
const FALLBACK_CLIPS = {
  jab: { duration: 1.37, contacts: [0.43] }, cross: { duration: 1.4, contacts: [0.5] },
  hook: { duration: 1.4, contacts: [0.55] }, uppercut: { duration: 1.5, contacts: [0.55] },
  roundhouse: { duration: 1.8, contacts: [0.7] }, snap_kick: { duration: 1.4, contacts: [0.45] },
  sweep: { duration: 1.5, contacts: [0.6] }, flying_kick: { duration: 1.6, contacts: [0.6] },
  low_kick: { duration: 1.1, contacts: [0.333] }, high_roundhouse: { duration: 1.3, contacts: [0.4] },
  body_jab: { duration: 1.033, contacts: [0.3] }, elbow: { duration: 1.233, contacts: [0.4] },
  hop_kick: { duration: 1.433, contacts: [0.4] }, spin_back_kick: { duration: 1.5, contacts: [0.533] },
  flurry: { duration: 2.633, contacts: [0.433, 0.633, 0.833, 1.033, 1.233, 1.433, 1.633, 1.833] },
  hammer_fist: { duration: 1.433, contacts: [0.467] }, knee: { duration: 1.233, contacts: [0.4] },
  stomp: { duration: 1.3, contacts: [0.467] }, haymaker: { duration: 1.833, contacts: [0.7] },
  shoulder_tackle: { duration: 1.567, contacts: [0.533] }, ground_pound: { duration: 2.167, contacts: [0.833] },
  get_up: { duration: 2.2, contacts: [] }, stagger: { duration: 1.2, contacts: [] },
};

const hit = (damage, height, extra = {}) => ({ damage, height, ...extra });

// ---------------------------------------------------------------- Sam: Precision
const SAM = {
  nodes: {
    s_jab:        { clip: 'jab', startupF: 10, hits: [hit(5, 'high')], name: 'ONE-TWO', next: { 2: 's_cross_12' }, lunge: 60 },
    s_cross_12:   { clip: 'cross', startupF: 13, hits: [hit(8, 'high')], next: { 'd+3': 's_low_kick' }, lunge: 90, delay: true },
    s_low_kick:   { clip: 'low_kick', startupF: 16, hits: [hit(9, 'low', { chKnockdown: true })], name: 'TWO-STEP LOW', ender: true },
    s_cross:      { clip: 'cross', startupF: 13, hits: [hit(8, 'high')], name: 'BODY BREAKER', next: { 1: 's_body_jab' }, lunge: 90 },
    s_body_jab:   { clip: 'body_jab', startupF: 11, hits: [hit(6, 'mid')], next: { 2: 's_breaker' }, lunge: 40 },
    s_breaker:    { clip: 'uppercut', startupF: 16, hits: [hit(14, 'mid', { launch: LAUNCH_VY })], ender: true },
    s_snap:       { clip: 'snap_kick', startupF: 12, hits: [hit(8, 'mid')], name: 'SNAP SERIES', next: { 3: 's_high_round' }, lunge: 70 },
    s_high_round: { clip: 'high_roundhouse', startupF: 14, hits: [hit(12, 'high', { chKnockdown: true })], ender: true },
    s_round:      { clip: 'roundhouse', startupF: 14, hits: [hit(12, 'high')], name: 'SPIN ENDER', next: { 4: 's_spin_back' }, lunge: 110 },
    s_spin_back:  { clip: 'spin_back_kick', startupF: 17, hits: [hit(18, 'mid', { bound: true, knockdown: true })], ender: true },
    s_elbow:      { clip: 'elbow', startupF: 15, hits: [hit(14, 'mid', { chStagger: true })], name: 'STEP-IN ELBOW', lunge: 200 },
    s_counter_hook: { clip: 'hook', startupF: 17, hits: [hit(16, 'high', { chLaunch: true })], name: 'COUNTER HOOK', lunge: 60 },
    s_hop_kick:   { clip: 'hop_kick', startupF: 15, hits: [hit(15, 'mid', { launch: LAUNCH_VY })], name: 'HOP KICK', lunge: 120, ender: true },
    s_uppercut:   { clip: 'uppercut', startupF: 16, hits: [hit(10, 'mid', { launch: LAUNCH_VY })], name: 'UPPERCUT', lunge: 50, ender: true },
    s_sweep:      { clip: 'sweep', startupF: 16, hits: [hit(9, 'low', { knockdown: true })], name: 'SWEEP', lunge: 60, ender: true },
    s_rage:       {
      clip: 'flurry', startupF: 20, rage: true, unblockable: true, name: 'OVERCLOCK RUSH', lunge: 120,
      // every punch but the last holds the victim in place so all eight land
      hits: [4, 4, 4, 4, 3, 3, 4, 4].map((d, i, a) => hit(d, 'mid', i === a.length - 1 ? { knockdown: true, rageFinish: true } : { lock: true })),
    },
  },
  starters: {
    1: 's_jab', 2: 's_cross', 3: 's_snap', 4: 's_round',
    'f+2': 's_elbow', 'b+2': 's_counter_hook', 'u/f+3': 's_hop_kick',
    'd+1': 's_uppercut', 'd+2': 's_uppercut', 'd+3': 's_sweep', 'd+4': 's_sweep',
    L: 's_rage',
  },
  list: [
    ['ONE-TWO', '1, 2', 'high, high', 'Natural combo'],
    ['TWO-STEP LOW', '1, 2, d+3', 'high, high, low', 'Low ender, knockdown on counter hit'],
    ['SNAP SERIES', '3, 3', 'mid, high', 'Second hit knocks down on counter hit'],
    ['BODY BREAKER', '2, 1, 2', 'high, mid, mid', 'Ender launches'],
    ['STEP-IN ELBOW', 'f+2', 'mid', 'Staggers on counter hit'],
    ['COUNTER HOOK', 'b+2', 'high', 'Launches on counter hit'],
    ['HOP KICK', 'u/f+3', 'mid', 'Launcher'],
    ['SPIN ENDER', '4, 4', 'high, mid', 'Second hit bounds'],
    ['UPPERCUT', 'd+1', 'mid', 'Launcher'],
    ['SWEEP', 'd+3', 'low', 'Knockdown'],
    ['JUGGLE', 'u/f+3 or 2,1,2  then 1, 2  then f+2', '', 'Launch, then float them'],
    ['OVERCLOCK RUSH', 'L at full meter', '8 hits', 'Rage Art: unblockable'],
  ],
};

// ---------------------------------------------------------------- Elon: Power
const ELON = {
  nodes: {
    e_jab:        { clip: 'jab', startupF: 12, hits: [hit(6, 'high')], name: 'BULLDOZER', next: { 1: 'e_jab_2' }, lunge: 50 },
    e_jab_2:      { clip: 'jab', startupF: 10, hits: [hit(6, 'high')], next: { 2: 'e_bulldozer' }, lunge: 50 },
    e_bulldozer:  { clip: 'cross', startupF: 15, hits: [hit(14, 'mid', { pushback: true })], ender: true, lunge: 120 },
    e_cross:      { clip: 'cross', startupF: 14, hits: [hit(10, 'high')], name: 'HAMMER', next: { 2: 'e_hammer' }, lunge: 80 },
    e_hammer:     { clip: 'hammer_fist', startupF: 18, hits: [hit(16, 'mid', { knockdown: true })], ender: true, lunge: 60 },
    e_knee:       { clip: 'knee', startupF: 16, hits: [hit(15, 'mid', { chLaunch: true })], name: 'KNEE BREAK', lunge: 160 },
    e_sweep:      { clip: 'sweep', startupF: 18, hits: [hit(12, 'low', { knockdown: true })], name: 'SWEEP & STOMP', next: { 4: 'e_stomp' }, lunge: 60, delay: true },
    e_stomp:      { clip: 'stomp', startupF: 20, hits: [hit(10, 'low', { ground: true })], ender: true, lunge: 70 },
    e_haymaker:   { clip: 'haymaker', startupF: 25, hits: [hit(22, 'high', { knockdown: true })], name: 'HAYMAKER', lunge: 90, ender: true },
    e_ram:        { clip: 'shoulder_tackle', startupF: 19, hits: [hit(18, 'mid', { knockdown: true })], name: 'SHOULDER RAM', lunge: 460, ender: true },
    e_round:      { clip: 'roundhouse', startupF: 16, hits: [hit(14, 'high')], name: 'TWIN KICK', next: { 4: 'e_spin_back' }, lunge: 100 },
    e_spin_back:  { clip: 'spin_back_kick', startupF: 19, hits: [hit(18, 'mid', { bound: true, knockdown: true })], ender: true },
    e_uppercut:   { clip: 'uppercut', startupF: 17, hits: [hit(12, 'mid', { launch: LAUNCH_VY })], name: 'UPPERCUT LAUNCH', lunge: 50, ender: true },
    e_snap:       { clip: 'snap_kick', startupF: 14, hits: [hit(9, 'mid')], name: 'SNAP KICK', lunge: 70 },
    e_rage:       {
      clip: 'ground_pound', startupF: 20, rage: true, unblockable: true, name: 'GROUND POUND',
      hits: [hit(30, 'mid', { knockdown: true, rageFinish: true, wide: true })],
    },
  },
  starters: {
    1: 'e_jab', 2: 'e_cross', 3: 'e_snap', 4: 'e_round',
    'f+3': 'e_knee', 'b+2': 'e_haymaker', 'f,f+2': 'e_ram',
    'd+1': 'e_uppercut', 'd+2': 'e_uppercut', 'd+3': 'e_sweep', 'd+4': 'e_sweep',
    L: 'e_rage',
  },
  list: [
    ['BULLDOZER', '1, 1, 2', 'high, high, mid', 'Natural combo, pushes back'],
    ['HAMMER', '2, 2', 'high, mid', 'Second hit knocks down'],
    ['KNEE BREAK', 'f+3', 'mid', 'Launches on counter hit'],
    ['SWEEP & STOMP', 'd+4, 4', 'low, ground', 'Stomp hits a downed opponent'],
    ['HAYMAKER', 'b+2', 'high', 'Knockdown, slow'],
    ['SHOULDER RAM', 'f, f+2', 'mid', 'Travels forward, knockdown'],
    ['TWIN KICK', '4, 4', 'high, mid', 'Second hit bounds'],
    ['UPPERCUT LAUNCH', 'd+1', 'mid', 'Launcher'],
    ['JUGGLE', 'd+1 or f+3 counter  then 2, 2  then f, f+2', '', 'Launch, then carry them'],
    ['GROUND POUND', 'L at full meter', '1 hit', 'Rage Art: unblockable'],
  ],
};

export const STRINGS = { sam: SAM, elon: ELON };

const cls = (damage) => (damage >= 14 ? 'heavy' : damage >= 8 ? 'mid' : 'light');

// Build the runtime move table for a character: every string node becomes a
// sim state with ms timing fitted to its clip. `clipInfo` maps clip name to
// { duration, contacts: [seconds] }; missing clips use the fallback table.
export function buildStringMoves(charId, clipInfo = {}, baseMoves = {}) {
  const def = STRINGS[charId];
  if (!def) return { ...baseMoves };
  const out = {};
  // air attacks keep the shared frame data (jump-ins are not part of strings)
  for (const k of ['jumpPunch', 'jumpKick']) if (baseMoves[k]) out[k] = { ...baseMoves[k] };

  for (const [id, n] of Object.entries(def.nodes)) {
    const info = clipInfo[n.clip] && clipInfo[n.clip].contacts?.length ? clipInfo[n.clip] : FALLBACK_CLIPS[n.clip];
    const startupMs = n.startupF * F;
    const contacts = info.contacts.length ? info.contacts : [info.duration * 0.4];
    // speed so the first contact frame lands on the target startup
    const speed = Math.min(3.2, Math.max(0.8, (contacts[0] * 1000) / startupMs));
    const hitTimes = n.hits.map((_, i) => (contacts[Math.min(i, contacts.length - 1)] * 1000) / speed);
    const gap = hitTimes.length > 1 ? hitTimes[1] - hitTimes[0] : Infinity;
    const activeMs = Math.min(5 * F, gap * 0.6);
    const last = hitTimes[hitTimes.length - 1];
    const totalMs = Math.max(last + activeMs + 6 * F, (info.duration * 1000) / speed);
    const hits = n.hits.map((h, i) => {
      const c = cls(h.damage);
      return {
        ...h,
        atMs: hitTimes[i],
        hitstunMs: HITSTUN_F[c] * F,
        // hits that lead into a follow-up only nudge; enders and single moves push
        knockback: h.pushback ? 560 : (h.lock || n.next) ? 50 : { light: 130, mid: 230, heavy: 320 }[c],
        stopF: h.launch || h.knockdown || h.bound || h.rageFinish ? HITSTOP_F.ender : (c === 'heavy' ? HITSTOP_F.heavy : HITSTOP_F.light),
      };
    });
    out[id] = {
      id, clip: n.clip, clipSpeed: speed, name: n.name || null, rage: !!n.rage, unblockable: !!n.unblockable,
      startupMs, activeMs, hitTimes, hits, totalMs,
      recoveryMs: Math.max(0, totalMs - last - activeMs),
      activeEndMs: last + activeMs,
      // hit reach from the clip's measured limb extension, the same measurement
      // the spacing code uses, so a full extension always reaches the body
      reach: n.hits.some((h) => h.wide) ? 170
        : (info.reachM ? Math.max(96, Math.round((info.reachM + BODY_HALF_DEPTH + 0.1) / PX - HURT_HALF_W)) : 96),
      height: n.hits[0].height, damage: n.hits[0].damage, hitstunMs: hits[0].hitstunMs,
      knockback: hits[0].knockback, lunge: n.lunge || 0, meterGain: n.rage ? 0 : 6 + Math.round(n.hits[0].damage / 3),
      heavy: n.hits.reduce((s, h) => s + h.damage, 0) >= 14,
      next: n.next ? { ...n.next } : null, delay: !!n.delay, ender: !!n.ender,
      contactMs: hitTimes[0],
    };
  }
  // Natural-combo guarantee: a hit that leads into a follow-up leaves the
  // victim in hitstun until that follow-up's first hit has landed.
  for (const m of Object.values(out)) {
    if (!m.next) continue;
    for (const nextId of Object.values(m.next)) {
      const nx = out[nextId];
      if (!nx) continue;
      const cancelAt = m.activeEndMs;                  // earliest follow-up start
      const need = cancelAt - m.hitTimes[m.hitTimes.length - 1] + nx.hitTimes[0] + 4 * F;
      const lastHit = m.hits[m.hits.length - 1];
      lastHit.hitstunMs = Math.max(lastHit.hitstunMs, need);
    }
    m.hitstunMs = m.hits[0].hitstunMs;
  }
  return out;
}

export function moveList(charId) {
  return STRINGS[charId]?.list || [];
}
