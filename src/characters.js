import { MOVES } from './moves.js';
import { Animation } from './anim/animation.js';
import { DARIO_PARTS } from './render/sprites_dario.js';
import { SAM_PARTS } from './render/sprites_sam.js';

const PARTS = { dario: DARIO_PARTS, sam: SAM_PARTS };

const total = (m) => m.startupMs + m.activeMs + m.recoveryMs;

// fighting stance: guard up (bent elbows), feet split, gentle bob
const STANCE = {
  frontArmAngle: 30, backArmAngle: 22, frontArmBend: 58, backArmBend: 52,
  frontLegAngle: 14, backLegAngle: -14, frontLegBend: 12, backLegBend: 12,
};

// rear-arm cross: full torso rotation, far arm drives through
function crossAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE } },
      { tMs: m.startupMs * 0.8,        pose: { ...STANCE, backArmAngle: -35, backArmBend: 85, torsoAngle: -10, bodyY: 2 } },
      { tMs: m.startupMs,              pose: { ...STANCE, backArmAngle: 98, backArmBend: 2, frontArmAngle: 18, frontArmBend: 70, torsoAngle: 14 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, backArmAngle: 102, backArmBend: 2, frontArmAngle: 18, frontArmBend: 70, torsoAngle: 14 } },
      { tMs: total(m),                 pose: { ...STANCE, torsoAngle: 0 } },
    ],
  });
}

// rear-leg roundhouse: lean back, far leg swings high through the target
function roundhouseAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE } },
      { tMs: m.startupMs * 0.7,        pose: { ...STANCE, backLegAngle: -45, backLegBend: 80, torsoAngle: -10, bodyY: 4, frontLegBend: 30 } },
      { tMs: m.startupMs,              pose: { ...STANCE, backLegAngle: 105, backLegBend: 4, torsoAngle: -16, bodyY: 2, frontLegBend: 25, frontArmAngle: 40, frontArmBend: 70 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, backLegAngle: 110, backLegBend: 4, torsoAngle: -16, bodyY: 2, frontLegBend: 25, frontArmAngle: 40, frontArmBend: 70 } },
      { tMs: total(m),                 pose: { ...STANCE, torsoAngle: 0 } },
    ],
  });
}

// snap knee: front knee drives up then extends into a mid kick
function kneeAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE } },
      { tMs: m.startupMs * 0.7,        pose: { ...STANCE, frontLegAngle: 55, frontLegBend: 95, torsoAngle: -6, bodyY: 2 } },
      { tMs: m.startupMs,              pose: { ...STANCE, frontLegAngle: 88, frontLegBend: 8, torsoAngle: 8, backLegBend: 20 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, frontLegAngle: 92, frontLegBend: 8, torsoAngle: 8, backLegBend: 20 } },
      { tMs: total(m),                 pose: { ...STANCE, torsoAngle: 0 } },
    ],
  });
}

function punchAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE } },
      { tMs: m.startupMs * 0.8,        pose: { ...STANCE, frontArmAngle: -25, frontArmBend: 80, torsoAngle: -6 } },
      { tMs: m.startupMs,              pose: { ...STANCE, frontArmAngle: 96, frontArmBend: 2, torsoAngle: 9 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, frontArmAngle: 100, frontArmBend: 2, torsoAngle: 9 } },
      { tMs: total(m),                 pose: { ...STANCE, torsoAngle: 0 } },
    ],
  });
}

function kickAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE } },
      { tMs: m.startupMs * 0.8,        pose: { ...STANCE, frontLegAngle: 40, frontLegBend: 85, torsoAngle: -8, bodyY: 2 } },
      { tMs: m.startupMs,              pose: { ...STANCE, frontLegAngle: 95, frontLegBend: 2, torsoAngle: 10, backLegAngle: -20, backLegBend: 20 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, frontLegAngle: 100, frontLegBend: 2, torsoAngle: 10, backLegAngle: -20, backLegBend: 20 } },
      { tMs: total(m),                 pose: { ...STANCE, torsoAngle: 0 } },
    ],
  });
}

// rising uppercut from crouch (launcher)
function uppercutAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE, bodyY: 26, frontArmAngle: -30, frontArmBend: 75, torsoAngle: -10, frontLegBend: 70, backLegBend: 75, frontLegAngle: 26, backLegAngle: -20 } },
      { tMs: m.startupMs * 0.8,        pose: { ...STANCE, bodyY: 28, frontArmAngle: -40, frontArmBend: 85, torsoAngle: -14, frontLegBend: 75, backLegBend: 80, frontLegAngle: 26, backLegAngle: -20 } },
      { tMs: m.startupMs,              pose: { ...STANCE, bodyY: 4,  frontArmAngle: 118, frontArmBend: 4, torsoAngle: 10, frontLegBend: 20, backLegBend: 30 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, bodyY: 0,  frontArmAngle: 125, frontArmBend: 4, torsoAngle: 10, frontLegBend: 15, backLegBend: 25 } },
      { tMs: total(m),                 pose: { ...STANCE, bodyY: 14, frontLegBend: 40, backLegBend: 45 } },
    ],
  });
}

// low sweep kick from crouch
function sweepAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE, bodyY: 26, frontLegAngle: 24, frontLegBend: 78, backLegAngle: -18, backLegBend: 88 } },
      { tMs: m.startupMs * 0.8,        pose: { ...STANCE, bodyY: 30, frontLegAngle: -15, frontLegBend: 70, backLegAngle: -18, backLegBend: 92, torsoAngle: -6 } },
      { tMs: m.startupMs,              pose: { ...STANCE, bodyY: 30, frontLegAngle: 88, frontLegBend: 2, backLegAngle: -18, backLegBend: 92, torsoAngle: 6 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, bodyY: 30, frontLegAngle: 92, frontLegBend: 2, backLegAngle: -18, backLegBend: 92, torsoAngle: 6 } },
      { tMs: total(m),                 pose: { ...STANCE, bodyY: 26, frontLegAngle: 24, frontLegBend: 78, backLegAngle: -18, backLegBend: 88 } },
    ],
  });
}

function jumpPunchAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE, frontLegAngle: 40, frontLegBend: 60, backLegAngle: 14, backLegBend: 50, frontArmAngle: 30, frontArmBend: 60 } },
      { tMs: m.startupMs,              pose: { ...STANCE, frontLegAngle: 40, frontLegBend: 60, backLegAngle: 14, backLegBend: 50, frontArmAngle: 88, frontArmBend: 4, torsoAngle: 8 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, frontLegAngle: 40, frontLegBend: 60, backLegAngle: 14, backLegBend: 50, frontArmAngle: 92, frontArmBend: 4, torsoAngle: 8 } },
      { tMs: total(m),                 pose: { ...STANCE, frontLegAngle: 40, frontLegBend: 60, backLegAngle: 14, backLegBend: 50 } },
    ],
  });
}

function jumpKickAnim(m) {
  return new Animation({
    durationMs: total(m),
    loop: false,
    keyframes: [
      { tMs: 0,                        pose: { ...STANCE, frontLegAngle: 24, frontLegBend: 70, backLegAngle: 26, backLegBend: 55, torsoAngle: -4 } },
      { tMs: m.startupMs,              pose: { ...STANCE, frontLegAngle: 85, frontLegBend: 2, backLegAngle: 36, backLegBend: 65, torsoAngle: 12 } },
      { tMs: m.startupMs + m.activeMs, pose: { ...STANCE, frontLegAngle: 90, frontLegBend: 2, backLegAngle: 38, backLegBend: 65, torsoAngle: 12 } },
      { tMs: total(m),                 pose: { ...STANCE, frontLegAngle: 40, frontLegBend: 55, backLegAngle: 20, backLegBend: 45 } },
    ],
  });
}

const loopIdle = () => new Animation({
  durationMs: 1200, loop: true,
  keyframes: [
    { tMs: 0, pose: { ...STANCE, bodyY: 0 } },
    { tMs: 600, pose: { ...STANCE, bodyY: -4, frontArmAngle: 34, frontArmBend: 63 } },
    { tMs: 1200, pose: { ...STANCE, bodyY: 0 } },
  ],
});

const loopWalk = () => new Animation({
  durationMs: 400, loop: true,
  keyframes: [
    { tMs: 0, pose: { ...STANCE, frontLegAngle: 28, frontLegBend: 6, backLegAngle: -28, backLegBend: 38 } },
    { tMs: 200, pose: { ...STANCE, frontLegAngle: -28, frontLegBend: 38, backLegAngle: 28, backLegBend: 6 } },
    { tMs: 400, pose: { ...STANCE, frontLegAngle: 28, frontLegBend: 6, backLegAngle: -28, backLegBend: 38 } },
  ],
});

const still = (pose) => new Animation({ durationMs: 200, loop: false, keyframes: [{ tMs: 0, pose }] });

const SHEET_FILES = {
  Idle: 'Idle.png', Walk: 'Walk.png', Run: 'Run.png', Jump: 'Jump.png',
  Attack_1: 'Attack_1.png', Attack_2: 'Attack_2.png', Attack_3: 'Attack_3.png',
  Hurt: 'Hurt.png', Dead: 'Dead.png',
};

const total2 = (m) => m.startupMs + m.activeMs + m.recoveryMs;

// Map fighter states to sheet frame ranges. Attack playback is stretched
// to the move's exact frame data so visuals match the hitboxes.
// Frame mapping verified against the sheets: Jump 0-1 = crouch prep,
// 2-7 = airborne arc, 6 = high knee; Run 2-4 = low lunge; Dead ends flat.
function sheetAnims(m) {
  return {
    idle:        { sheet: 'Idle', n: 7, fps: 9, loop: true },
    walk:        { sheet: 'Walk', n: 10, fps: 14, loop: true },
    dash:        { sheet: 'Run', n: 10, fps: 18, loop: true },
    jump:        { sheet: 'Jump', start: 2, n: 5, durMs: 560 },
    crouch:      { sheet: 'Jump', start: 1, n: 1, yOff: 16 },
    crouchblock: { sheet: 'Jump', start: 1, n: 1, yOff: 16 },
    block:       { sheet: 'Hurt', n: 1 },
    standLP:     { sheet: 'Attack_2', n: 4, durMs: total2(m.standLP) },
    standHP:     { sheet: 'Attack_1', n: 6, durMs: total2(m.standHP) },
    standLK:     { sheet: 'Jump', start: 5, n: 2, durMs: total2(m.standLK) },
    standHK:     { frames: [
      { sheet: 'Jump', col: 1 },   // chamber (crouched load)
      { sheet: 'Jump', col: 6 },   // knee rises
      { sheet: 'Run', col: 3 },    // full leg extension (thrust kick)
      { sheet: 'Run', col: 3 },
      { sheet: 'Idle', col: 0 },   // recover
    ], durMs: total2(m.standHK) },
    crouchPunch: { sheet: 'Attack_3', n: 6, durMs: total2(m.crouchPunch) },
    crouchKick:  { sheet: 'Run', start: 2, n: 3, durMs: total2(m.crouchKick), yOff: 40 },
    jumpPunch:   { sheet: 'Attack_2', n: 4, durMs: total2(m.jumpPunch) },
    jumpKick:    { sheet: 'Jump', start: 5, n: 2, durMs: total2(m.jumpKick) },
    hitstun:     { sheet: 'Hurt', n: 4, fps: 14, loop: false },
    ko:          { sheet: 'Dead', n: 5, fps: 8, loop: false },
  };
}

// Photo-matching edit styles (see sheet.js editFrame):
// Dario — navy shirt, curly grey-brown hair with lighter flecks, glasses.
// Sam — taupe sweater (like his photo, not brand teal), brown hair.
// The body sheets are used as a base; the generic head is erased per frame
// and replaced with our hand-authored likeness heads (same art as the HUD
// portraits): Dario = grey curls + glasses + grin, Sam = brown wavy + calm.
const STYLES = {
  dario: {
    key: 'dario-headswap3',
    tint: [86, 110, 160],
    headPart: DARIO_PARTS.smallHead,
    hair: [[104, 86, 66], [134, 112, 88]],   // fallback frames keep own head
  },
  sam: {
    key: 'sam-headswap3',
    tint: [150, 124, 110],
    headPart: SAM_PARTS.smallHead,
    hair: [[70, 54, 40], [94, 74, 54]],
  },
};

// vector looks — photo-matched styling per character
const LOOKS = {
  dario: {
    skin: '#f0c8a4', skinShade: '#d2a37c',
    hair: '#8a7460', hairLight: '#b0a494', hairStyle: 'curly',
    glasses: true, grin: true,
    style: 'blazer', top: '#35496b', topShade: '#283a58', topLight: '#4a6288',
    shirt: '#23364f', collar: '#23364f',
    pants: '#34343f', pantsShade: '#26262e',
    shoe: '#3a2c1e', shoeShade: '#2a2118', sole: null,
    bareForearms: false,
  },
  sam: {
    skin: '#eec8a6', skinShade: '#cfa07e',
    hair: '#6a5340', hairLight: '#85684f', hairStyle: 'swept',
    glasses: false, grin: false,
    style: 'sweater', top: '#9c7e70', topShade: '#7f6355', topLight: '#b09384',
    shirt: '#322c28', collar: '#322c28',
    pants: '#46505a', pantsShade: '#363d49',
    shoe: '#e2e4e6', shoeShade: '#c8ccd0', sole: '#f6f6f4',
    bareForearms: true,
  },
};

function make(id, name, company, stats, palette, taunt) {
  const m = MOVES[id];
  return {
    id, name, company, stats, moves: m, palette, taunt,
    art: { type: 'vector', look: LOOKS[id], parts: PARTS[id], palette },
    anims: {
      idle: loopIdle(),
      walk: loopWalk(),
      dash: loopWalk(),
      jump: still({ ...STANCE, frontLegAngle: 40, frontLegBend: 62, backLegAngle: 14, backLegBend: 48, bodyY: -6 }),
      crouch: still({ ...STANCE, bodyY: 26, frontLegAngle: 30, frontLegBend: 82, backLegAngle: -22, backLegBend: 88 }),
      block: still({ frontArmAngle: 38, backArmAngle: 30, frontArmBend: 88, backArmBend: 82, torsoAngle: -8, frontLegAngle: 14, backLegAngle: -14 }),
      crouchblock: still({ bodyY: 26, frontLegAngle: 30, frontLegBend: 82, backLegAngle: -22, backLegBend: 88, frontArmAngle: 30, backArmAngle: 24, frontArmBend: 92, backArmBend: 86, torsoAngle: -10 }),
      standLP: punchAnim(m.standLP),   // lead jab
      standHP: crossAnim(m.standHP),   // rear cross
      standLK: kneeAnim(m.standLK),    // snap knee
      standHK: roundhouseAnim(m.standHK), // rear roundhouse
      crouchPunch: uppercutAnim(m.crouchPunch),
      crouchKick: sweepAnim(m.crouchKick),
      jumpPunch: jumpPunchAnim(m.jumpPunch),
      jumpKick: jumpKickAnim(m.jumpKick),
      hitstun: still({ torsoAngle: -20, headAngle: -18, frontArmAngle: -25, backArmAngle: -35, frontArmBend: 15, backArmBend: 10, frontLegAngle: 20, frontLegBend: 30, backLegAngle: -12, backLegBend: 20 }),
      ko: still({ torsoAngle: -80, bodyY: 60, headAngle: -40, frontArmAngle: -30, backArmAngle: -40, frontArmBend: 5, backArmBend: 5, frontLegAngle: 30, frontLegBend: 25, backLegAngle: 10, backLegBend: 15 }),
    },
  };
}

export const CHARACTERS = {
  dario: make('dario', 'Dario', 'Claude',
    { walkSpeed: 220, jumpVelocity: -1050, health: 100 },
    { skin: '#E8B89B', hair: '#5a3d2e', main: '#CC785C', mainShade: '#8a4a32', trim: '#F0EEE6', pants: '#2A2320' },
    "Let's align on this."),
  sam: make('sam', 'Sam', 'OpenAI',
    { walkSpeed: 300, jumpVelocity: -1000, health: 92 },
    { skin: '#E8C4A0', hair: '#4a4038', main: '#10A37F', mainShade: '#0b6f57', trim: '#FFFFFF', pants: '#22262b' },
    'Scaling up.'),
};
