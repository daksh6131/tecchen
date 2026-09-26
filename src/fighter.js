import { config } from './config.js';

const ATTACKS = {
  standLP: true, standHP: true, standLK: true, standHK: true,
  crouchPunch: true, crouchKick: true,
  jumpPunch: true, jumpKick: true,
};
const BUTTONS = ['lp', 'hp', 'lk', 'hk'];
const BACKWALK_FACTOR = 0.62;
const BUFFER_MS = 200;
const DOUBLE_TAP_MS = 280;
const MAX_CHAIN = 3; // string length, Tekken-style (starter + 3)

export class Fighter {
  constructor(spec) {
    this.id = spec.characterId;
    this.x = spec.x;
    this.y = config.floorY;
    this.vx = 0;
    this.vy = 0;
    this.facing = spec.facing ?? 1;
    this.stats = spec.stats;
    this.moves = spec.moves;
    this.health = spec.stats.health;
    this.meter = 0;
    this.state = 'idle';
    this.stateClock = 0;
    this.hitstunMs = 0;
    this.flashT = 0;       // white damage flash
    this._t = 0;
    this._windowId = 0;
    this._consumedWindow = -1;
    this._buffer = null;
    this._contact = false; // this attack touched (hit or block)
    this._whiffed = false; // one-shot: attack finished active frames clean
    this._landed = false;  // one-shot: touched down this frame
    this._chain = 0;
    this._lastTapDir = 0;
    this._lastTapT = -9999;
    this._dashT = 0;
    this._dashDir = 0;
  }

  get grounded() {
    return this.y >= config.floorY && this.vy >= 0;
  }

  get attacking() {
    return !!ATTACKS[this.state];
  }

  step(dt, input, opponentX, threat = false) {
    this.stateClock += dt * 1000;
    this._t += dt * 1000;
    if (this.flashT > 0) this.flashT -= dt;
    if (this._dashT > 0) this._dashT -= dt;

    if (this._buffer) {
      this._buffer.t -= dt * 1000;
      if (this._buffer.t <= 0) this._buffer = null;
    }

    const pressed = input.pressed || {};
    this._detectDash(pressed);

    if (this.grounded && !this.attacking && this.state !== 'hitstun' && this.state !== 'ko') {
      this.facing = Math.sign(opponentX - this.x) || this.facing;
    }

    if (this.attacking) {
      const m = this.moves[this.state];
      for (const b of BUTTONS) {
        if (pressed[b]) { this._buffer = { move: b, t: BUFFER_MS }; break; }
      }

      const activeEnd = m.startupMs + m.activeMs;
      if (!this._contact && !this._whiffedOnce && this.stateClock >= activeEnd) {
        this._whiffed = true;
        this._whiffedOnce = true;
      }

      if (!m.air) {
        const inMotion = this.stateClock < activeEnd;
        this.vx = inMotion ? this.facing * (m.lunge || 0) : 0;
      }

      // chain cancel: on contact, recovery cancels into a buffered follow-up
      // (force re-enter so LP,LP strings restart the same move)
      if (this._contact && this._buffer && this._chain < MAX_CHAIN &&
          this.stateClock >= activeEnd && this.grounded && !m.air) {
        const move = this._pickGroundAttack(this._buffer.move, input);
        this._buffer = null;
        this._chain += 1;
        this._enter(move, true);
      } else if (this.stateClock >= activeEnd + m.recoveryMs) {
        this._enter(m.air ? 'jump' : 'idle');
      }
    } else if (this.state === 'hitstun') {
      if (this.grounded) this.vx *= 0.86;
      // airborne victims stay juggle-able until they land
      if (this.stateClock >= this.hitstunMs && this.grounded) this._enter('idle');
    } else if (this.state !== 'ko') {
      this._control(input, opponentX, threat);
    }

    // air attacks from jump state
    if (!this.grounded && this.state === 'jump') {
      if (pressed.lp || pressed.hp) this._enter('jumpPunch');
      else if (pressed.lk || pressed.hk) this._enter('jumpKick');
    }

    this.vy += config.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y >= config.floorY) {
      if (this.vy > 200) this._landed = true;
      this.y = config.floorY;
      this.vy = 0;
      if (this.state === 'jump' || (this.attacking && this.moves[this.state].air)) {
        this._enter('idle');
      }
    }
  }

  _detectDash(pressed) {
    const dir = pressed.right ? 1 : (pressed.left ? -1 : 0);
    if (!dir) return;
    if (dir === this._lastTapDir && this._t - this._lastTapT < DOUBLE_TAP_MS) {
      this._dashT = 0.16;
      this._dashDir = dir;
      this._lastTapT = -9999;
    } else {
      this._lastTapDir = dir;
      this._lastTapT = this._t;
    }
  }

  _pickGroundAttack(kind, input) {
    if (input.down) {
      return (kind === 'lp' || kind === 'hp') ? 'crouchPunch' : 'crouchKick';
    }
    return { lp: 'standLP', hp: 'standHP', lk: 'standLK', hk: 'standHK' }[kind];
  }

  _control(input, opponentX, threat) {
    if (!this.grounded) return;

    if (this._buffer) {
      const b = this._buffer;
      this._buffer = null;
      this.vx = 0;
      this._enter(this._pickGroundAttack(b.move, input));
      return;
    }

    const towardRight = opponentX > this.x;
    const fwd = towardRight ? input.right : input.left;
    const back = towardRight ? input.left : input.right;
    const pressed = input.pressed || {};

    if (pressed.up)    { this.vy = this.stats.jumpVelocity; this._enter('jump'); return; }
    for (const b of BUTTONS) {
      if (pressed[b]) { this.vx = 0; this._enter(this._pickGroundAttack(b, input)); return; }
    }
    if (input.down && back && threat) { this.vx = 0; this._enter('crouchblock'); return; }
    if (back && !input.down && threat) { this.vx = 0; this._enter('block'); return; }
    if (input.down)    { this.vx = 0; this._enter('crouch'); return; }
    if (this._dashT > 0) {
      this.vx = this._dashDir * this.stats.walkSpeed * 2.3;
      this._enter('dash');
      return;
    }
    if (fwd)  { this.vx = (towardRight ? 1 : -1) * this.stats.walkSpeed; this._enter('walk'); return; }
    if (back) { this.vx = (towardRight ? -1 : 1) * this.stats.walkSpeed * BACKWALK_FACTOR; this._enter('walk'); return; }
    this.vx = 0;
    this._enter('idle');
  }

  _enter(state, force = false) {
    if (!force && this.state === state) return;
    this.state = state;
    this.stateClock = 0;
    if (ATTACKS[state]) {
      this._windowId += 1;
      this._contact = false;
      this._whiffedOnce = false;
    } else if (state === 'idle' || state === 'walk' || state === 'dash' || state === 'crouch') {
      this._chain = 0;
    }
  }

  applyHit({ damage, knockback, hitstunMs, launch }, fromX) {
    this.health = Math.max(0, this.health - damage);
    const away = Math.sign(this.x - fromX || 1);
    this.flashT = 0.14;
    this.hitstunMs = hitstunMs;
    this.meter = Math.min(100, this.meter + 8);

    if (launch) {
      this.vy = -launch;               // launcher: pop them up
      this.vx = away * knockback * 0.5;
    } else if (!this.grounded) {
      this.vy = -300;                  // juggle: keep them floating
      this.vx = away * knockback * 0.7;
    } else {
      this.vx = away * knockback;
      this.vy = -180;
    }

    if (this.health <= 0) {
      this.vx = away * Math.max(320, knockback * 1.6);
      this.vy = -420;
      this._enter('ko');
    } else {
      this._enter('hitstun');
    }
  }
}
