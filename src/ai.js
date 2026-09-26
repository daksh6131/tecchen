const ATTACKING = {
  standLP: true, standHP: true, standLK: true, standHK: true,
  crouchPunch: true, crouchKick: true,
  jumpPunch: true, jumpKick: true,
};

function blankInput() {
  return {
    left: false, right: false, up: false, down: false,
    lp: false, hp: false, lk: false, hk: false, special: false, pressed: {},
  };
}

// State-driven CPU: senses distance/opponent state, emits the same input
// shape a human produces. Reaction delay + randomness keep it beatable.
// Knows the Tekken toolkit: lows, launchers, jump-ins, dashes, and strings.
export function createAI(self, foe, rng = Math.random) {
  let thinkT = 0;
  let intent = 'approach';
  let attackCd = 0;
  let dashStep = 0;       // emits the double-tap sequence
  let followUp = null;    // queued chain press after a contact

  return {
    nextInput(dt) {
      thinkT -= dt;
      attackCd -= dt;

      const dist = Math.abs(foe.x - self.x);
      const towardRight = foe.x > self.x;
      const inp = blankInput();

      // chain: if our attack touched, mash the queued follow-up
      if (followUp && ATTACKING[self.state] && self._contact) {
        inp[followUp.key] = true;
        inp.pressed[followUp.key] = true;
        if (followUp.low) inp.down = true;
        followUp = null;
        return inp;
      }

      // reflex guard (imperfect on purpose); crouch-guard vs low attacks
      const foeMove = foe.moves[foe.state];
      const foeThreat = ATTACKING[foe.state] && dist < 180;
      if (foeThreat && intent !== 'attack' && rng() < 0.07) {
        intent = foeMove && foeMove.height === 'low' ? 'crouchguard' : 'guard';
        thinkT = 0.22 + rng() * 0.2;
      }

      if (thinkT <= 0) {
        thinkT = 0.15 + rng() * 0.25;
        if (dist > 320 && rng() < 0.3) {
          intent = 'dashin';
          dashStep = 0;
        } else if (dist > 190) {
          const r = rng();
          intent = r < 0.72 ? 'approach' : (r < 0.85 ? 'jumpin' : 'wait');
        } else if (attackCd <= 0) {
          intent = 'attack';
        } else {
          const r = rng();
          intent = r < 0.4 ? 'retreat' : (r < 0.6 ? 'approach' : 'wait');
        }
      }

      switch (intent) {
        case 'approach':
          if (towardRight) inp.right = true; else inp.left = true;
          break;
        case 'retreat':
        case 'guard':
          if (towardRight) inp.left = true; else inp.right = true;
          break;
        case 'crouchguard':
          inp.down = true;
          if (towardRight) inp.left = true; else inp.right = true;
          break;
        case 'dashin': {
          // frames: tap, release, tap  -> double-tap dash
          const key = towardRight ? 'right' : 'left';
          if (dashStep === 0 || dashStep === 2) {
            inp[key] = true;
            inp.pressed[key] = true;
          }
          dashStep++;
          if (dashStep > 2) intent = 'approach';
          break;
        }
        case 'jumpin':
          if (towardRight) inp.right = true; else inp.left = true;
          inp.up = true;
          inp.pressed.up = true;
          intent = 'airattack';
          thinkT = 0.25 + rng() * 0.1;
          break;
        case 'airattack':
          if (!self.grounded) {
            inp.hk = true;
            inp.pressed.hk = true;
            intent = 'wait';
          }
          break;
        case 'attack': {
          const r = rng();
          let key = 'lp';
          let low = false;
          if (r < 0.22 && dist < 130) { key = 'lp'; low = true; }          // launcher
          else if (r < 0.42) { key = 'lk'; low = rng() < 0.45; }           // knee or sweep
          else if (r < 0.62) { key = 'hp'; }
          else if (r < 0.75) { key = 'hk'; }                               // big smash
          inp[key] = true;
          inp.pressed[key] = true;
          if (low) inp.down = true;
          // queue a string follow-up half the time (Tekken strings)
          if (rng() < 0.55) {
            const opts = ['lp', 'hp', 'lk', 'hk'];
            followUp = { key: opts[Math.floor(rng() * 4) % 4], low: rng() < 0.2 };
          }
          attackCd = 0.35 + rng() * 0.55;
          intent = 'wait';
          break;
        }
        default:
          break;
      }
      return inp;
    },
  };
}
