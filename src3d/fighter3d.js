// Fighter with Tekken-style strings for the 3D game. Extends the shared
// fighter (walking, dashing, jumping, guarding, juggle physics) and replaces
// its attack layer: direction-qualified inputs, per-character string graphs
// with cancel windows, multi-hit moves, counter hits, launchers, bounds,
// knockdowns with get-up, staggers and the Rage Art.
import { config } from '../src/config.js';
import { Fighter } from '../src/fighter.js';
import { F, CANCEL_OPEN_F, CANCEL_CLOSE_F, DOWN_MS, GETUP_MS, STAGGER_MS } from './strings.js';

const BUTTONS = ['lp', 'hp', 'lk', 'hk'];
const DIGIT = { lp: '1', hp: '2', lk: '3', hk: '4' };
const BACKWALK_FACTOR = 0.62;
const REACTION = new Set(['hitstun', 'stagger', 'knockdown', 'down', 'getup', 'ko']);
const BUFFER_MS = 12 * F;

export class Fighter3D extends Fighter {
  constructor(spec) {
    super(spec);
    this.strings = spec.strings;          // { starters, nodes } from strings.js
    this._queued = null;                  // follow-up node id accepted inside the cancel window
    this._queuedAt = 0;
    this._hitIdx = -1;                    // current hit window of a multi-hit move
    this._juggled = false;                // airborne from a launch / juggle: lands into a knockdown
    this._bounded = false;                // one bound per juggle
    this._rageStarted = false;            // one-shot for the sim's rage event
    this._fallClip = 'knocked_down';
    this._fallSerial = 0;
    this._startBuffer = null;             // { token, t } pressed during recovery
  }

  get attacking() {
    return !!this.moves[this.state];
  }

  get move() {
    return this.moves[this.state] || null;
  }

  // Can this fighter be hit right now, and with what hurtbox profile?
  get vulnerability() {
    if (this.state === 'getup') return 'none';
    if (this.state === 'down') return 'down';
    return 'up';
  }

  // Input tokens for a button press, most specific first.
  tokens(button, input) {
    const n = button === 'special' ? 'L' : DIGIT[button];
    if (n === 'L') return ['L'];
    const fwd = this.facing > 0 ? input.right : input.left;
    const back = this.facing > 0 ? input.left : input.right;
    const out = [];
    if ((this.state === 'dash' || this._dashT > 0) && this._dashDir === this.facing) out.push(`f,f+${n}`);
    if (input.down) out.push(`d+${n}`);
    if (input.up && fwd) out.push(`u/f+${n}`);
    if (fwd) out.push(`f+${n}`);
    if (back) out.push(`b+${n}`);
    out.push(n);
    return out;
  }

  _pressedButtons(pressed) {
    const out = BUTTONS.filter((b) => pressed[b]);
    if (pressed.special) out.push('special');
    return out;
  }

  _starterFor(button, input) {
    for (const t of this.tokens(button, input)) {
      const id = this.strings.starters[t];
      if (!id || !this.moves[id]) continue;
      if (this.moves[id].rage && this.meter < 100) continue;
      return id;
    }
    return null;
  }

  step(dt, input, opponentX, threat = false) {
    const ms = dt * 1000;
    this.stateClock += ms;
    this._t += ms;
    if (this.flashT > 0) this.flashT -= dt;
    if (this._dashT > 0) this._dashT -= dt;
    if (this._startBuffer) {
      this._startBuffer.t -= ms;
      if (this._startBuffer.t <= 0) this._startBuffer = null;
    }

    const pressed = input.pressed || {};
    this._detectDash(pressed);
    this._oppX = opponentX;

    if (this.grounded && !this.attacking && !REACTION.has(this.state)) {
      this.facing = Math.sign(opponentX - this.x) || this.facing;
    }

    const m = this.move;
    if (m) this._stepAttack(m, input, pressed);
    else if (this.state === 'hitstun') {
      if (this.grounded) this.vx *= 0.86;
      if (this.stateClock >= this.hitstunMs && this.grounded) this._enter('idle');
    } else if (this.state === 'stagger') {
      this.vx *= 0.85;
      if (this.stateClock >= STAGGER_MS) this._enter('idle');
    } else if (this.state === 'down') {
      this.vx *= 0.8;
      if (this.stateClock >= DOWN_MS) this._enter('getup');
    } else if (this.state === 'getup') {
      this.vx = 0;
      if (this.stateClock >= GETUP_MS) this._enter('idle');
    } else if (this.state === 'knockdown') {
      // airborne until the landing below turns it into 'down'
    } else if (this.state !== 'ko') {
      this._control(input, opponentX, threat);
    }

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
      if (this.state === 'jump' || (m && m.air)) this._enter('idle');
      else if (this.state === 'knockdown' || (this.state === 'hitstun' && this._juggled)) this._enter('down');
    }
  }

  _stepAttack(m, input, pressed) {
    const k = this.stateClock;

    // air attacks keep the shared single-window behaviour
    if (m.air) {
      const activeEnd = m.startupMs + m.activeMs;
      if (!this._contact && !this._whiffedOnce && k >= activeEnd) { this._whiffed = true; this._whiffedOnce = true; }
      if (k >= activeEnd + m.recoveryMs) this._enter('jump');
      return;
    }

    // which hit window is open (multi-hit moves open one per contact)
    let idx = -1;
    for (let i = 0; i < m.hitTimes.length; i++) {
      if (k >= m.hitTimes[i] && k <= m.hitTimes[i] + m.activeMs) { idx = i; break; }
    }
    if (idx !== -1 && idx !== this._hitIdx) {
      this._hitIdx = idx;
      if (idx > 0) this._windowId += 1;          // a fresh window: the next hit can connect
    }

    if (!this._contact && !this._whiffedOnce && k >= m.activeEndMs) {
      this._whiffed = true;
      this._whiffedOnce = true;
    }

    // forward travel during the wind-up and strike, plus a string follow-up's
    // tracking step that closes whatever gap the last hit opened
    const track = k < m.startupMs && this._closeIn > 0 ? this._closeIn / (m.startupMs / 1000) : 0;
    this.vx = k < m.activeEndMs ? this.facing * ((m.lunge || 0) * (k < m.startupMs ? 1 : 0.4) + track) : 0;

    // string follow-ups: accepted from just before the last contact until the
    // window closes (longer for delayable links), whether or not it hit
    const lastHit = m.hitTimes[m.hitTimes.length - 1];
    const open = m.hitTimes[0] - CANCEL_OPEN_F * F;
    const close = lastHit + (m.delay ? CANCEL_CLOSE_F.delay : CANCEL_CLOSE_F.nc) * F + m.activeMs;
    for (const b of this._pressedButtons(pressed)) {
      if (m.next && !this._queued && k >= open && k <= close) {
        for (const t of this.tokens(b, input)) {
          if (m.next[t] && this.moves[m.next[t]]) { this._queued = m.next[t]; this._queuedAt = k; break; }
        }
        if (this._queued) continue;
      }
      // anything else pressed in recovery starts fresh once the move ends
      if (k >= open) this._startBuffer = { button: b, input: { ...input }, t: BUFFER_MS };
    }

    if (this._queued && k >= Math.max(m.activeEndMs, this._queuedAt)) {
      const next = this._queued;
      this._queued = null;
      this._chain += 1;
      this._enter(next, true);
      const nm = this.moves[next];
      const gap = Math.abs((this._oppX ?? this.x) - this.x);
      this._closeIn = Math.max(0, gap - (nm.reach - 20));
      return;
    }
    if (k >= m.totalMs) this._enter('idle');
  }

  _control(input, opponentX, threat) {
    if (!this.grounded) return;
    const towardRight = opponentX > this.x;
    const fwd = towardRight ? input.right : input.left;
    const back = towardRight ? input.left : input.right;
    const pressed = input.pressed || {};

    // a buffered press from the last move's recovery, then fresh presses
    const candidates = [];
    if (this._startBuffer) { candidates.push([this._startBuffer.button, this._startBuffer.input]); this._startBuffer = null; }
    for (const b of this._pressedButtons(pressed)) candidates.push([b, input]);
    for (const [b, inp] of candidates) {
      const id = this._starterFor(b, inp);
      if (!id) continue;
      this.vx = 0;
      if (this.moves[id].rage) { this.meter = 0; this._rageStarted = true; }
      this._enter(id);
      return;
    }

    if (pressed.up) { this.vy = this.stats.jumpVelocity; this._enter('jump'); return; }
    if (input.down && back && threat) { this.vx = 0; this._enter('crouchblock'); return; }
    if (back && !input.down && threat) { this.vx = 0; this._enter('block'); return; }
    if (input.down) { this.vx = 0; this._enter('crouch'); return; }
    if (this._dashT > 0) {
      this.vx = this._dashDir * this.stats.walkSpeed * 2.3;
      this._enter('dash');
      return;
    }
    if (fwd) { this.vx = (towardRight ? 1 : -1) * this.stats.walkSpeed; this._enter('walk'); return; }
    if (back) { this.vx = (towardRight ? -1 : 1) * this.stats.walkSpeed * BACKWALK_FACTOR; this._enter('walk'); return; }
    this.vx = 0;
    this._enter('idle');
  }

  _enter(state, force = false) {
    if (!force && this.state === state) return;
    this.state = state;
    this.stateClock = 0;
    if (this.moves[state]) {
      this._closeIn = 0;
      this._windowId += 1;
      this._contact = false;
      this._whiffedOnce = false;
      this._hitIdx = -1;
      this._queued = null;
    } else {
      this._queued = null;
      if (state === 'idle' || state === 'walk' || state === 'dash' || state === 'crouch') this._chain = 0;
      if (state === 'down' || state === 'idle') { this._juggled = false; this._bounded = false; }
    }
  }

  // Apply a hit resolved by combat3d. props carries the hit's properties
  // after counter-hit upgrades.
  applyHit3d(props, fromX) {
    const { damage, knockback, hitstunMs } = props;
    this.health = Math.max(0, this.health - damage);
    const away = Math.sign(this.x - fromX || 1);
    this.flashT = 0.14;
    this.hitstunMs = hitstunMs;
    this.meter = Math.min(100, this.meter + 8);
    const airborne = !this.grounded;

    if (this.health <= 0) {
      this.vx = away * Math.max(320, knockback * 1.6);
      this.vy = -420;
      this._enter('ko');
      return;
    }

    if (props.rageFinish) {
      this._fallClip = 'rage_hit';
      this._fallSerial += 1;
      this.vx = away * 300;
      this.vy = -520;
      this._enter('knockdown');
      return;
    }
    if (props.lock) {                              // multi-hit: pinned in place for the next punch
      this.vx = away * knockback;
      if (!airborne) this.vy = 0;
      this._enter('hitstun', true);
      return;
    }
    if (props.launch) {
      this.vy = -props.launch;
      this.vx = away * knockback * 0.5;
      this._juggled = true;
      this._enter('hitstun', true);
      return;
    }
    if (props.bound && airborne && !this._bounded) {
      this._bounded = true;
      this.vy = -250;
      this.vx = away * knockback * 0.3;
      this._juggled = true;
      this._enter('hitstun', true);
      return;
    }
    if (airborne) {
      // juggle float: every airborne hit re-floats and carries
      this.vy = -300;
      this.vx = away * knockback * 0.7;
      this._juggled = true;
      if (this.state !== 'knockdown') this._enter('hitstun', true);
      return;
    }
    if (props.knockdown) {
      this._fallClip = 'knocked_down';
      this._fallSerial += 1;
      this.vx = away * Math.max(260, knockback);
      this.vy = -380;
      this._enter('knockdown');
      return;
    }
    if (props.stagger) {
      this.vx = away * knockback * 0.6;
      this._enter('stagger', true);
      return;
    }
    if (this.state === 'down') {                   // ground hit on a downed body
      this.vx = away * 60;
      this._enter('down', true);
      return;
    }
    // grounded hit: slide back, feet stay planted (a hop here would turn the
    // next string hit into a juggle)
    this.vx = away * knockback;
    this._enter('hitstun', true);
  }
}
