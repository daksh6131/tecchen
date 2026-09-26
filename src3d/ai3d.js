// CPU for string fighters. Same senses as the shared CPU (distance, the
// opponent's state, reaction delay, randomness) but it attacks with its
// character's real strings: it presses the starter with the right direction,
// then feeds each follow-up inside the cancel window. It punishes downed
// opponents with ground attacks, juggles after launchers and spends a full
// meter on the Rage Art at close range.
import { F } from './strings.js';

const BTN = { 1: 'lp', 2: 'hp', 3: 'lk', 4: 'hk', L: 'special' };

// strings each CPU knows: token sequence, weight, and the range it is used at
const PLAYBOOK = {
  sam: [
    { seq: ['1', '2'], w: 4, max: 120 },
    { seq: ['1', '2', 'd+3'], w: 3, max: 120 },
    { seq: ['3', '3'], w: 3, max: 130 },
    { seq: ['2', '1', '2'], w: 3, max: 120 },
    { seq: ['f+2'], w: 2, max: 150 },
    { seq: ['b+2'], w: 1, max: 120 },
    { seq: ['u/f+3'], w: 2, max: 140 },
    { seq: ['4', '4'], w: 2, max: 150 },
    { seq: ['d+3'], w: 1, max: 140 },
  ],
  elon: [
    { seq: ['1', '1', '2'], w: 4, max: 120 },
    { seq: ['2', '2'], w: 3, max: 120 },
    { seq: ['f+3'], w: 2, max: 140 },
    { seq: ['d+4', '4'], w: 2, max: 140 },
    { seq: ['b+2'], w: 1, max: 130 },
    { seq: ['f,f+2'], w: 2, min: 150, max: 330 },
    { seq: ['4', '4'], w: 2, max: 150 },
    { seq: ['d+1'], w: 2, max: 110 },
  ],
};
const JUGGLE = { sam: ['1', '2'], elon: ['2', '2'] };

function blank() {
  return {
    left: false, right: false, up: false, down: false,
    lp: false, hp: false, lk: false, hk: false, special: false, pressed: {},
  };
}

// write one input token into an input frame (directions relative to facing)
function applyToken(inp, token, towardRight) {
  const fwdKey = towardRight ? 'right' : 'left';
  const backKey = towardRight ? 'left' : 'right';
  const [dir, n] = token.includes('+') ? token.split('+') : ['', token];
  if (dir === 'd') inp.down = true;
  if (dir === 'f') inp[fwdKey] = true;
  if (dir === 'b') inp[backKey] = true;
  if (dir === 'u/f') { inp.up = true; inp[fwdKey] = true; }
  if (dir === 'f,f') inp[fwdKey] = true;
  const b = BTN[n];
  inp[b] = true;
  inp.pressed[b] = true;
}

function pick(list, rng) {
  const total = list.reduce((s, e) => s + e.w, 0);
  let r = rng() * total;
  for (const e of list) { r -= e.w; if (r <= 0) return e; }
  return list[list.length - 1];
}

export function createAI3d(self, foe, charId, rng = Math.random) {
  const book = PLAYBOOK[charId] || PLAYBOOK.sam;
  let thinkT = 0;
  let intent = 'approach';
  let attackCd = 0;
  let plan = null;          // { seq, i, dash }
  let dashStep = 0;

  const moveOf = (f) => f.moves[f.state];

  return {
    nextInput(dt) {
      thinkT -= dt;
      attackCd -= dt;
      const dist = Math.abs(foe.x - self.x);
      const towardRight = foe.x > self.x;
      const inp = blank();

      // --- continue a string: press the next token once the current move is in its window
      if (plan && plan.i < plan.seq.length) {
        const m = moveOf(self);
        if (plan.i === 0) {
          if (plan.dash !== undefined && plan.dash < 3) {
            const key = towardRight ? 'right' : 'left';
            if (plan.dash === 0 || plan.dash === 2) { inp[key] = true; inp.pressed[key] = true; }
            plan.dash += 1;
            return inp;
          }
          applyToken(inp, plan.seq[0], towardRight);
          plan.i = 1;
          return inp;
        }
        if (m && m.hitTimes && self.stateClock >= m.hitTimes[0] - 6 * F) {
          applyToken(inp, plan.seq[plan.i], towardRight);
          plan.i += 1;
          return inp;
        }
        if (!m && self.grounded) plan = null;       // string ended (knocked out of it)
        return inp;
      }
      if (plan && !moveOf(self)) plan = null;

      // --- Rage Art at close range with a full meter
      if (self.meter >= 100 && dist < 150 && self.grounded && !moveOf(self) && rng() < 0.03) {
        plan = { seq: ['L'], i: 0 };
        return this.nextInput(0);
      }
      // --- juggle a launched opponent
      if (foe._juggled && !foe.grounded && dist < 150 && !moveOf(self) && rng() < 0.5) {
        plan = { seq: JUGGLE[charId] || ['1', '2'], i: 0 };
        return this.nextInput(0);
      }
      // --- stomp / low on a downed opponent
      if (foe.state === 'down' && dist < 130 && !moveOf(self) && charId === 'elon' && rng() < 0.08) {
        plan = { seq: ['d+4', '4'], i: 0 };
        return this.nextInput(0);
      }

      // --- reflex guard (imperfect on purpose)
      const fm = moveOf(foe);
      if (fm && dist < 180 && intent !== 'attack' && rng() < 0.07) {
        intent = fm.height === 'low' ? 'crouchguard' : 'guard';
        thinkT = 0.22 + rng() * 0.2;
      }

      if (thinkT <= 0) {
        thinkT = 0.15 + rng() * 0.25;
        if (dist > 320 && rng() < 0.3) { intent = 'dashin'; dashStep = 0; }
        else if (dist > 170) { const r = rng(); intent = r < 0.75 ? 'approach' : (r < 0.87 ? 'jumpin' : 'wait'); }
        else if (attackCd <= 0) intent = 'attack';
        else { const r = rng(); intent = r < 0.4 ? 'retreat' : (r < 0.6 ? 'approach' : 'wait'); }
      }

      switch (intent) {
        case 'approach': inp[towardRight ? 'right' : 'left'] = true; break;
        case 'retreat':
        case 'guard': inp[towardRight ? 'left' : 'right'] = true; break;
        case 'crouchguard': inp.down = true; inp[towardRight ? 'left' : 'right'] = true; break;
        case 'dashin': {
          const key = towardRight ? 'right' : 'left';
          if (dashStep === 0 || dashStep === 2) { inp[key] = true; inp.pressed[key] = true; }
          dashStep++;
          if (dashStep > 2) intent = 'approach';
          break;
        }
        case 'jumpin':
          inp[towardRight ? 'right' : 'left'] = true;
          inp.up = true;
          inp.pressed.up = true;
          intent = 'airattack';
          thinkT = 0.25 + rng() * 0.1;
          break;
        case 'airattack':
          if (!self.grounded) { inp.hk = true; inp.pressed.hk = true; intent = 'wait'; }
          break;
        case 'attack': {
          const options = book.filter((e) => dist <= e.max && dist >= (e.min || 0));
          if (!options.length) { intent = 'approach'; break; }
          const s = pick(options, rng);
          // difficulty lives in the sim's handicap; here: sometimes drop the tail of a string
          const len = rng() < 0.25 ? 1 : s.seq.length;
          plan = { seq: s.seq.slice(0, len), i: 0 };
          if (s.seq[0].startsWith('f,f')) plan.dash = 0;
          attackCd = 0.4 + rng() * 0.6;
          intent = 'wait';
          return this.nextInput(0);
        }
        default: break;
      }
      return inp;
    },
  };
}
