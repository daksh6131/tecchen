// Bootstrap: renderer, world, characters, FX, post, HUD, audio and the
// fixed-step loop. Flow: title -> select (fighter, difficulty, stage) ->
// best-of-3 match -> winner -> rematch or back to select.
import * as THREE from 'three';
import { graphics, qualityName } from './graphics.js';
import { config } from '../src/config.js';
import { Input } from '../src/input.js';
import { CHARACTERS } from '../src/characters.js';
import { lerpPose } from '../src/anim/pose.js';
import { createRound } from './sim.js';
import { toWorldX, toWorldY, PX, BODY_HALF_DEPTH } from './mapping.js';
import { createWorld } from './world.js';
import { createRig } from './rig.js';
import { createHumanoid } from './humanoid.js';
import { ROSTER, ATTACK_CLIPS, buildMoves } from './roster.js';
import { createFX } from './fx.js';
import { createPost } from './post.js';
import { createCamera } from './camera.js';
import { createHud, DIFFICULTIES } from './hud.js';
import { STAGES } from './stages.js';
import * as sfx from './audio3d.js';

const STEP = config.dt;
const ROUNDS_TO_WIN = 2;
const P2_KEYMAP = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyF: 'lp', KeyG: 'hp', KeyV: 'lk', KeyB: 'hk' };
const ATTACK_STATES = new Set(['standLP', 'standHP', 'standLK', 'standHK', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick']);
const BLEND_S = 0.09;

export function startGame({ canvas, hudRoot }) {
  const chars = Object.values(ROSTER);          // selectable fighters, in grid order

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, graphics.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const world = createWorld(renderer, { accentA: chars[0].accent, accentB: chars[1].accent });
  const cam = createCamera(window.innerWidth / window.innerHeight);
  const fx = createFX(world.scene);
  const post = createPost(renderer, world.scene, cam.camera);
  // transparent effect planes must not feed the AO depth pass, or they cast dark rectangles on the floor
  {
    const gtao = post.gtao;
    const render = gtao.render.bind(gtao);
    gtao.render = (...args) => { fx.group.visible = false; render(...args); fx.group.visible = true; };
  }
  const hud = createHud(hudRoot, { roster: ROSTER, stages: STAGES });

  // ---- fighters: placeholder capsule rigs until the skinned characters stream in
  const bodies = {};                            // character id -> rig/humanoid
  chars.forEach((c, i) => {
    bodies[c.id] = createRig(i === 0 ? CHARACTERS.dario : CHARACTERS.sam, c.accent);
    world.scene.add(bodies[c.id].object);
  });
  Promise.all(chars.map((c) => createHumanoid({ url: c.model, height: c.height, targetHeight: c.targetHeight, clips: c.clips, attackClips: ATTACK_CLIPS })
    .then((h) => {
      world.scene.remove(bodies[c.id].object); bodies[c.id] = h; world.scene.add(h.object);
      // once the clips are measured, re-time this fighter's frame data to where each strike really lands
      h.clipsPromise.then(() => { if (h.clipsReady) c.moves = buildMoves(c.moves, h.contacts); });
    })))
    .catch((err) => console.error('character load failed, keeping placeholder rigs', err));

  const input = new Input();
  input.attach(window);
  const input2 = new Input(P2_KEYMAP);
  input2.attach(window);
  let p2Human = false;

  // ---- selections
  let selChar = 0;                 // index into chars for P1; P2 takes the next fighter
  let selDiff = 2;                 // MEDIUM
  let stageIdx = 0;
  let stageLoading = false;
  const pick = () => [chars[selChar], chars[(selChar + 1) % chars.length]];
  // While an attack clip extends a limb, keep the opponent at reach + torso depth
  // so fists and feet stop at the body instead of passing through it.
  const minGap = (attacker, defender) => {
    const c = attacker === round.p1 ? pair[0] : pair[1];
    const rig = bodies[c.id];
    const m = attacker.moves[attacker.state];
    if (!m || !m.clip || !rig.reachAt) return 0;
    const reach = rig.reachAt(m.clip, (attacker.stateClock / 1000) * m.clipSpeed);
    return reach > 0.3 ? (reach + BODY_HALF_DEPTH) / PX : 0;
  };
  const tags = () => ['P1', p2Human ? 'P2' : `CPU · ${DIFFICULTIES[selDiff].label}`];

  // ---- match state
  let mode = 'title';              // 'boot' | 'title' | 'select' | 'stage' | 'fight'
  let stageSel = 0;                // -1 = random on the stage screen
  let streak = 0;                  // P1 consecutive match wins
  let pair = pick();
  const wins = [0, 0];
  let round = createRound({ chars: pair });
  let roundNo = 0;
  let matchOver = false;
  let roundEndT = 0;
  let roundStartHealth = [0, 0];
  let breathT = 2;
  const prevState = ['idle', 'idle'];
  const stateSerial = [0, 0];          // bumps on every state entry so repeated attacks restart their clip
  const lastHitHeight = ['high', 'high'];
  const blend = [{ from: null, t: 1, state: 'idle' }, { from: null, t: 1, state: 'idle' }];
  const lastPose = [null, null];
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()); };

  async function loadStage(idx) {
    stageIdx = idx;
    const def = STAGES[idx];
    stageLoading = true;
    hud.setLoading(`LOADING · ${def.name}`);
    try {
      await world.loadStage(def, (phase) => hud.setLoading(`LOADING · ${def.name} · ${phase.toUpperCase()}`));
    } catch (err) {
      console.error(err);
      hud.splash('ASSETS OFFLINE', 'stage needs an internet connection', 2.5, 'info');
      if (def.kind === 'hdri') await world.loadStage(STAGES.find((s) => s.kind === 'procedural'));
    }
    if (world.stage === def) hud.setLoading(null);
    stageLoading = false;
  }

  function newRound() {
    pair = pick();
    round = createRound({ chars: pair, cpuHandicap: p2Human ? 0 : DIFFICULTIES[selDiff].handicap, minGap });
    roundNo += 1;
    roundEndT = 0;
    cam.clearKO();
    hud.hideSplash();
    hud.setRound(roundNo);
    roundStartHealth = [round.p1.health, round.p2.health];
    clearTimers();
    hud.splash(`ROUND ${roundNo}`, '', 1.05, 'round');
    sfx.stinger('round');
    later(() => { hud.splash('FIGHT', '', 0.95, 'fight'); sfx.stinger('fight'); }, 1050);
  }

  function newMatch() {
    wins[0] = wins[1] = 0;
    roundNo = 0;
    matchOver = false;
    hud.setRounds(0, 0); hud.setRounds(1, 0);
    hud.setFighters(pair[0], pair[1], tags());
    sfx.setVoices([pair[0].id, pair[1].id]);
    newRound();
  }

  // TECCHEN splash on boot: holds ~3 s, any key skips
  function enterBoot() {
    mode = 'boot';
    clearTimers();
    pair = pick();
    round = createRound({ chars: pair });
    hud.hideSplash();
    hud.show('boot');
    cam.clearKO(); cam.clearSelect(); cam.setIdle(true);
    later(() => { if (mode === 'boot') enterTitle(); }, 3400);
  }

  function enterTitle() {
    mode = 'title';
    matchOver = false;
    clearTimers();
    pair = pick();
    round = createRound({ chars: pair });
    hud.hideSplash();
    hud.show('title');
    cam.clearKO(); cam.clearSelect(); cam.setIdle(true);
    sfx.droneStart();
  }

  function enterSelect() {
    mode = 'select';
    matchOver = false;
    clearTimers();
    pair = pick();
    round = createRound({ chars: pair });
    hud.hideSplash();
    hud.show('select');
    hud.setSelectChar(selChar);
    hud.setDifficulty(selDiff);
    cam.clearKO(); cam.setIdle(false);
    cam.setSelect(toWorldX(round.p1.x));
    sfx.droneStart();
  }

  function enterStageSelect() {
    mode = 'stage';
    hud.show('stage');
    hud.setStageSel(stageSel);
  }

  async function confirmStage() {
    if (stageLoading) return;
    const idx = stageSel < 0 ? Math.floor(Math.random() * STAGES.length) : stageSel;
    if (world.stage !== STAGES[idx]) await loadStage(idx);
    if (mode === 'stage') enterFight();
  }

  function enterFight() {
    if (stageLoading) return;
    mode = 'fight';
    hud.show('fight');
    hud.setStreak(streak);
    cam.clearSelect(); cam.setIdle(false);
    sfx.droneStop();
    newMatch();
  }

  window.addEventListener('keydown', (e) => {
    sfx.unlock();
    if (mode === 'boot') { enterTitle(); return; }
    if (mode === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') { enterSelect(); sfx.stinger('fight'); }
      return;
    }
    if (mode === 'select') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { selChar = (selChar + chars.length - 1) % chars.length; enterSelect(); sfx.block(0); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { selChar = (selChar + 1) % chars.length; enterSelect(); sfx.block(0); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { selDiff = (selDiff + DIFFICULTIES.length - 1) % DIFFICULTIES.length; hud.setDifficulty(selDiff); sfx.whoosh(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { selDiff = (selDiff + 1) % DIFFICULTIES.length; hud.setDifficulty(selDiff); sfx.whoosh(); }
      else if (e.code === 'Enter' || e.code === 'Space') { enterStageSelect(); sfx.block(0); }
      else if (e.code === 'Escape' || e.code === 'Backspace') enterTitle();
      return;
    }
    if (mode === 'stage') {
      const n = STAGES.length;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { stageSel = stageSel <= -1 ? n - 1 : stageSel - 1; hud.setStageSel(stageSel); sfx.whoosh(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { stageSel = stageSel >= n - 1 ? -1 : stageSel + 1; hud.setStageSel(stageSel); sfx.whoosh(); }
      else if (e.code === 'Enter' || e.code === 'Space') { confirmStage(); sfx.block(0); }
      else if (e.code === 'Escape' || e.code === 'Backspace') enterSelect();
      return;
    }
    if (e.code === 'Digit2') { p2Human = !p2Human; hud.splash(p2Human ? 'P2 HUMAN' : 'P2 CPU', '', 0.9, 'info'); hud.setFighters(pair[0], pair[1], tags()); }
    if (e.code === 'Enter' && matchOver) newMatch();
    if (e.code === 'Escape' || e.code === 'Backspace') enterSelect();
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    cam.camera.aspect = window.innerWidth / window.innerHeight;
    cam.camera.updateProjectionMatrix();
    post.resize(window.innerWidth, window.innerHeight);
  });

  // ---- timing cross-check --------------------------------------------------
  let debugOn = false;
  const lastHit = [null, null];
  function noteHit(i, blocked) {
    const f = i ? round.p2 : round.p1;
    const c = pair[i];
    const m = f.moves[f.state];
    const rig = bodies[c.id];
    if (!m || !rig.contacts) return;
    const clipT = (f.stateClock / 1000) * m.clipSpeed;      // exact clip time at this sim step
    const contactS = rig.contacts[m.clip]?.contact ?? 0;
    lastHit[i] = {
      who: c.name, move: f.state, clip: m.clip, blocked,
      simMs: Math.round(f.stateClock), contactMs: m.contactMs,
      clipFrame: Math.round(clipT * 30), contactFrame: Math.round(contactS * 30),
      reach: rig.probe(m.clip, clipT)?.fraction ?? null,
    };
  }
  // Offline check: for every character and attack, when does the hitbox open
  // versus the clip's measured contact, and how extended is the limb then.
  function crosscheck() {
    const rows = [];
    for (const c of chars) {
      const rig = bodies[c.id];
      if (!rig.contacts) continue;
      for (const [state, m] of Object.entries(c.moves)) {
        if (!m.clip) continue;
        const openClipS = (m.startupMs / 1000) * m.clipSpeed;
        const midClipS = ((m.startupMs + m.activeMs * 0.5) / 1000) * m.clipSpeed;
        const p = rig.probe(m.clip, openClipS);
        const pm = rig.probe(m.clip, midClipS);
        rows.push({
          fighter: c.name, move: state, clip: m.clip,
          startupMs: m.startupMs, activeMs: m.activeMs, contactMs: m.contactMs,
          openVsContactFrames: +(((m.startupMs - m.contactMs) / 1000) * 60).toFixed(1),
          reachAtOpen: p ? +p.fraction.toFixed(2) : null,
          reachMidActive: pm ? +pm.fraction.toFixed(2) : null,
        });
      }
    }
    console.table(rows);
    return rows;
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyH') { debugOn = !debugOn; hud.setDebug(debugOn ? 'timing debug on' : null); } });

  function handleEvents(events) {
    for (const e of events) {
      const wx = toWorldX(e.x ?? 0);
      const wy = toWorldY(e.y ?? config.floorY);
      switch (e.type) {
        case 'hit': {
          const color = e.attacker === 'p1' ? pair[0].accent : pair[1].accent;
          const victim = e.attacker === 'p1' ? 1 : 0;
          noteHit(e.attacker === 'p1' ? 0 : 1, false);
          lastHitHeight[victim] = e.height === 'high' ? 'high' : 'body';
          fx.hit(wx, wy, 0, { heavy: e.heavy, launched: e.launched, color });
          if (e.launched) sfx.launch(victim); else sfx.hit(e.heavy, victim);
          break;
        }
        case 'block':
          noteHit(e.attacker === 'p1' ? 0 : 1, true);
          fx.hit(wx, wy, 0, { blocked: true });
          sfx.block(e.attacker === 'p1' ? 1 : 0);
          break;
        case 'whiff': sfx.whoosh(); break;
        case 'land': fx.land(toWorldX(e.x), 0); sfx.land(); break;
        case 'ko': {
          const loserIdx = e.outcome === 'p1' ? 1 : 0;
          const loser = loserIdx ? round.p2 : round.p1;
          fx.ko(toWorldX(loser.x), toWorldY(loser.y) + 1.0, 0, pair[loserIdx].accent);
          sfx.ko(loserIdx);
          {
            const kd = bodies[pair[loserIdx].id].contacts?.knocked_down;
            const fallMs = kd ? (kd.fall / 0.35) * 1000 + 100 : 900;   // knockdown plays in K.O. slow-motion
            later(() => sfx.koFall(loserIdx), fallMs);
          }
          cam.setKO(toWorldX(e.outcome === 'p1' ? round.p1.x : round.p2.x));
          if (e.outcome === 'p1') wins[0] += 1;
          else if (e.outcome === 'p2') wins[1] += 1;
          hud.setRounds(0, wins[0]); hud.setRounds(1, wins[1]);
          const winner = e.outcome === 'p1' ? pair[0] : (e.outcome === 'p2' ? pair[1] : null);
          const winnerF = e.outcome === 'p1' ? round.p1 : round.p2;
          const perfect = winner && winnerF.health >= roundStartHealth[e.outcome === 'p1' ? 0 : 1];
          clearTimers();
          if (wins[0] >= ROUNDS_TO_WIN || wins[1] >= ROUNDS_TO_WIN) {
            matchOver = true;
            streak = wins[0] >= ROUNDS_TO_WIN ? streak + 1 : 0;
            hud.setStreak(streak);
            hud.splash('K.O.', perfect ? 'PERFECT' : '', 1.6, 'ko');
            later(() => hud.splash(winner ? `${winner.name} WINS` : 'DRAW', 'ENTER · REMATCH   ESC · SELECT', 999, 'win'), 1700);
            later(() => sfx.stinger('win'), 1700);
          } else {
            hud.splash(e.outcome === 'draw' ? 'DRAW' : 'K.O.', perfect ? 'PERFECT' : (winner ? `${winner.name} takes the round` : ''), 3, 'ko');
            later(() => sfx.stinger('ko'), 150);
          }
          break;
        }
        default: break;
      }
    }
  }

  function simStep(dt) {
    if (mode !== 'fight') return;
    const i1 = input.snapshot();
    const i2 = p2Human ? input2.snapshot() : null;
    handleEvents(round.step(dt, i1, i2));

    [round.p1, round.p2].forEach((f, i) => {
      if (f.state !== prevState[i]) {
        stateSerial[i] += 1;
        if (ATTACK_STATES.has(f.state)) {
          const heavy = f.state === 'standHK' || f.state === 'standHP' || f.state === 'crouchPunch';
          const m = f.moves[f.state];
          const serial = stateSerial[i];
          const state = f.state;
          // the swing and the attacker's grunt sit just before the blow lands, not at the wind-up
          later(() => { if (f.state === state && stateSerial[i] === serial) sfx.attack(i, heavy); }, Math.max(0, (m?.startupMs || 120) - 90));
        }
        prevState[i] = f.state;
      }
    });
    breathT -= dt;
    if (breathT <= 0 && !round.outcome) {
      breathT = 3.5 + Math.random() * 2.5;
      [round.p1, round.p2].forEach((f, i) => { if (f.health <= f.stats.health * 0.25) sfx.breath(i); });
    }
    if (round.outcome && round.koSettled && !matchOver) {
      roundEndT += dt;
      const winner = round.outcome === 'p1' ? 0 : 1;
      const hasClip = bodies[pair[winner].id].hasClip?.('victory');
      if (roundEndT > (hasClip ? 3.6 : 2.2)) newRound();
    }
  }

  function present(t, dt) {
    const { p1, p2 } = round;
    const fighters = [[p1, pair[0]], [p2, pair[1]]];
    for (const c of chars) bodies[c.id].object.visible = c === pair[0] || c === pair[1];
    fighters.forEach(([f, c], i) => {
      const rig = bodies[c.id];
      const anim = c.anims[f.state] || c.anims.idle;
      let pose = anim.poseAt(mode === 'fight' ? f.stateClock : t * 1000);
      const b = blend[i];
      if (f.state !== b.state) { b.from = lastPose[i]; b.t = 0; b.state = f.state; }
      if (b.from && b.t < 1) {
        b.t = Math.min(1, b.t + dt / BLEND_S);
        const k = b.t * b.t * (3 - 2 * b.t);
        pose = lerpPose(b.from, pose, k);
      }
      lastPose[i] = pose;
      rig.setPose(pose, f.facing, { t, state: f.state, stateClock: f.stateClock });
      if (rig.animate) {
        const m = f.moves[f.state];
        const winnerIdx = round.outcome === 'p1' ? 0 : (round.outcome === 'p2' ? 1 : -1);
        const celebrating = mode === 'fight' && round.koSettled && winnerIdx === i && f.state !== 'ko';
        rig.animate({
          state: celebrating ? 'victory' : (mode === 'fight' ? f.state : 'idle'),
          matchWin: matchOver,
          stateSerial: celebrating ? `win${roundNo}` : stateSerial[i],
          dir: Math.sign(f.vx || 0) * f.facing || 1,
          hitHeight: lastHitHeight[i],
          hitstunMs: f.hitstunMs || (m && m.hitstunMs) || 300,
        });
        const frozen = mode === 'fight' && round.frozen;
        const slow = mode === 'fight' && round.outcome && !round.koSettled ? 0.35 : 1;
        rig.tick(frozen ? 0 : dt * slow, mode === 'fight' ? f.stateClock : t * 1000);
      }
      const wx = toWorldX(f.x), wy = toWorldY(f.y);
      rig.object.position.set(wx, wy, 0);
      rig.setFlash(f.flashT > 0 ? Math.min(1, f.flashT / 0.14) : 0);
      fx.setBlob(i, wx, wy, 0);
      hud.setHealth(i, f.health / c.stats.health);
      hud.setMeter(i, f.meter / 100);
    });
    if (debugOn) {
      const line = (i) => {
        const f = i ? round.p2 : round.p1;
        const rig = bodies[pair[i].id];
        const h = lastHit[i];
        const cur = rig.clipName ? `${rig.clipName} ${(rig.clipTime * 30).toFixed(0)}f` : '';
        const hit = h ? ` · last ${h.blocked ? 'block' : 'hit'}: ${h.clip} sim ${h.simMs}ms/contact ${h.contactMs}ms · frame ${h.clipFrame}/${h.contactFrame} · reach ${(h.reach * 100).toFixed(0)}%` : '';
        return `${pair[i].name}: ${f.state} ${Math.round(f.stateClock)}ms ${cur}${hit}`;
      };
      hud.setDebug(`${line(0)}\n${line(1)}`);
    }
    hud.setCombo(0, round.combos.p1.hits, round.combos.p1.t, round.combos.p1.damage);
    hud.setCombo(1, round.combos.p2.hits, round.combos.p2.t, round.combos.p2.damage);
    hud.update(dt, [p1.health / pair[0].stats.health, p2.health / pair[1].stats.health]);

    const mid = (toWorldX(p1.x) + toWorldX(p2.x)) / 2;
    world.update(dt, t, mid);
    const shake = fx.update(dt);
    cam.update(dt, toWorldX(p1.x), toWorldY(p1.y), toWorldX(p2.x), toWorldY(p2.y), shake);
    post.render(t, fx.pulse, fx.flash);
  }

  // boot
  enterBoot();
  loadStage(0);
  hud.setStreak(0);
  sfx.preload();

  let acc = 0;
  let last = performance.now();
  let t = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += elapsed;
    t += elapsed;
    let steps = 0;
    while (acc >= STEP && steps < 5) { simStep(STEP); acc -= STEP; steps++; }
    present(t, elapsed);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { renderer, world, post, bodies, crosscheck, graphics: qualityName, get round() { return round; }, loadStage, get mode() { return mode; }, enterSelect, enterFight };
}
