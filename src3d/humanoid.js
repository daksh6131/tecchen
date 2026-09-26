// Skinned humanoid. Two drivers share the same interface:
//  - clip mode (preferred): Mixamo clips from the animation pack play through
//    an AnimationMixer; fight states pick clips, speeds and hold points.
//  - pose mode (fallback while clips stream in): the 2D pose model retargeted
//    onto the bind pose with world-axis rotations, plus procedural mechanics.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { refineCharacterMaterials } from '../character-models/render/character-materials.js';
import { createFacialMotion } from '../character-models/render/facial-motion.js';
import { jointAngles } from './mapping.js';

const loader = new GLTFLoader();
const WORLD_Z = new THREE.Vector3(0, 0, 1);
const WORLD_Y = new THREE.Vector3(0, 1, 0);
const qTwist = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const qDelta = new THREE.Quaternion();
const qTmp = new THREE.Quaternion();
const WHITE = new THREE.Color(0xffffff);

const CHAIN = [
  ['spine_01', 'torso'], ['spine_03', 'chest'], ['neck_01', 'neck'], ['head', 'head'],
  ['clavicle_r', 'clavR'], ['upperarm_r', 'armR'], ['lowerarm_r', 'foreR'],
  ['clavicle_l', 'clavL'], ['upperarm_l', 'armL'], ['lowerarm_l', 'foreL'],
  ['thigh_r', 'legR'], ['calf_r', 'shinR'], ['foot_r', 'footR'],
  ['thigh_l', 'legL'], ['calf_l', 'shinL'], ['foot_l', 'footL'],
];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const CALIB = { fore: -0.35, arm: 0.05 };

// Clips whose pelvis motion the simulation already supplies.
const STRIP_Y = new Set(['jump', 'flying_kick']);
const STRIP_XZ = new Set(['jab', 'cross', 'hook', 'uppercut', 'roundhouse', 'snap_kick', 'sweep', 'flying_kick', 'walk', 'walk_back', 'run', 'head_hit', 'body_hit', 'block',
  'low_kick', 'high_roundhouse', 'body_jab', 'elbow', 'hop_kick', 'spin_back_kick', 'flurry', 'hammer_fist', 'knee', 'stomp', 'haymaker', 'shoulder_tackle', 'ground_pound', 'stagger']);

// Both the pelvis and Mixamo's animated armature root can carry travel.
function stripPelvis(clip, name) {
  for (const track of clip.tracks) {
    if (track.name !== 'pelvis.position' && track.name !== 'Root.position') continue;
    const v = track.values;
    const y = STRIP_Y.has(name), xz = STRIP_XZ.has(name);
    for (let i = 3; i < v.length; i += 3) {
      if (xz) { v[i] = v[0]; v[i + 2] = v[2]; }
      if (y) v[i + 1] = v[1];
    }
  }
}

export async function createHumanoid({ url, height, targetHeight = 1.72, clips = null, attackClips = {} }) {
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(model);
  model.scale.setScalar(targetHeight / height);

  refineCharacterMaterials(model);
  const facialMotion = createFacialMotion(model);
  const bones = {};
  const materials = new Set();
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        materials.add(m);
        if (m.map) m.map.anisotropy = 8;
      }
    }
  });
  const bind = {};
  for (const [n, b] of Object.entries(bones)) bind[n] = b.quaternion.clone();
  const emissiveBase = [...materials].map((m) => ({ c: m.emissive ? m.emissive.clone() : new THREE.Color(0), i: m.emissiveIntensity ?? 1 }));

  // ---------------- pose mode (fallback) ----------------
  for (const side of ['l', 'r']) {
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      for (let k = 1; k <= 3; k++) {
        const b = bones[`${f}_0${k}_${side}`];
        if (!b) continue;
        qTmp.setFromAxisAngle(new THREE.Vector3(1, 0, 0), k === 1 ? 0.9 : 1.1);
        b.quaternion.copy(bind[b.name]).multiply(qTmp);
        bind[b.name] = b.quaternion.clone();
      }
    }
    const t = bones[`thumb_02_${side}`];
    if (t) { qTmp.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5); t.quaternion.copy(bind[t.name]).multiply(qTmp); bind[t.name] = t.quaternion.clone(); }
  }
  function setBone(name, angle, twist = 0) {
    const b = bones[name];
    if (!b) return;
    b.parent.getWorldQuaternion(qParent);
    qDelta.setFromAxisAngle(WORLD_Z, angle);
    if (twist) qDelta.multiply(qTwist.setFromAxisAngle(WORLD_Y, twist));
    b.quaternion.copy(qParent).invert().multiply(qDelta).multiply(qParent).multiply(bind[name]);
  }
  function posePose(pose, f, ctx) {
    const j = jointAngles(pose, f);
    const t = ctx.t || 0;
    const state = ctx.state || 'idle';
    const clock = (ctx.stateClock || 0) / 1000;
    const reachF = clamp01(((pose.frontArmAngle || 0) - 25) / 70) * clamp01(1 - (pose.frontArmBend ?? 45) / 60);
    const reachB = clamp01(((pose.backArmAngle || 0) - 25) / 70) * clamp01(1 - (pose.backArmBend ?? 45) / 60);
    const kickF = clamp01(((pose.frontLegAngle || 0) - 30) / 60);
    const kickB = clamp01(((pose.backLegAngle || 0) - 30) / 60);
    const twist = (reachB * 0.55 + reachF * 0.18 + kickB * 0.35 - kickF * 0.1) * f;
    const clavF = (reachF * 0.32 + Math.max(0, (pose.frontArmAngle || 0)) * 0.0025) * f;
    const clavB = (reachB * 0.38 + Math.max(0, (pose.backArmAngle || 0)) * 0.0025) * f;
    const walking = state === 'walk' || state === 'dash';
    const breathe = Math.sin(t * 1.7) * 0.012;
    const bob = walking ? -0.022 * Math.abs(Math.sin((pose.frontLegAngle || 0) * 0.0349)) : 0;
    const hitSnap = state === 'hitstun' ? Math.exp(-clock / 0.12) * 0.45 : 0;
    const koSnap = state === 'ko' ? Math.exp(-clock / 0.3) * 0.3 : 0;
    const lean = j.torso + (twist * 0.12) - (hitSnap + koSnap) * 0.6 * f;
    const headA = j.head - hitSnap * 1.2 * f + breathe * 0.6;
    const footF = -(j.frontLeg + j.frontShin) * (1 - kickF * 0.7) + kickF * 0.5 * f;
    const footB = -(j.backLeg + j.backShin) * (1 - kickB * 0.7) + kickB * 0.5 * f;
    body.position.y = j.bodyY + bob;
    root.updateMatrixWorld(true);
    const front = f > 0 ? 'R' : 'L';
    const back = f > 0 ? 'L' : 'R';
    const angles = {
      torso: [lean, twist], chest: [breathe, twist * 0.35], neck: [-breathe * 0.5, 0], head: [headA, twist * -0.4],
      [`clav${front}`]: [clavF, 0], [`clav${back}`]: [clavB, 0],
      [`arm${front}`]: [j.frontArm + CALIB.arm * f - clavF, 0], [`fore${front}`]: [j.frontFore + CALIB.fore * f, 0],
      [`arm${back}`]: [j.backArm + CALIB.arm * f - clavB, 0], [`fore${back}`]: [j.backFore + CALIB.fore * f, 0],
      [`leg${front}`]: [j.frontLeg, 0], [`shin${front}`]: [j.frontShin, 0], [`foot${front}`]: [footF, 0],
      [`leg${back}`]: [j.backLeg, 0], [`shin${back}`]: [j.backShin, 0], [`foot${back}`]: [footB, 0],
    };
    for (const [bone, key] of CHAIN) { const a = angles[key] || [0, 0]; setBone(bone, a[0], a[1]); }
  }

  // ---------------- clip mode ----------------
  const mixer = new THREE.AnimationMixer(model);
  const clipCache = new Map();
  let manifest = null;
  let current = null;            // { action, name, key, holdAt }
  let clipsReady = false;

  async function loadClips() {
    if (!clips) return;
    const res = await fetch(`${clips}/manifest.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Animation manifest unavailable: ${res.status}`);
    manifest = await res.json();
    await Promise.all(manifest.clips.map(async (c) => {
      const revision = c.revision ? `?v=${encodeURIComponent(c.revision)}` : '';
      const g = await loader.loadAsync(`${clips}/${c.file}${revision}`);
      const clip = g.animations[0];
      clip.name = c.name;
      stripPelvis(clip, c.name);
      // combo clips carry authored contact frames (1-based, 30 fps)
      const markers = Array.isArray(c.contact_frames) ? c.contact_frames.map((f) => (f - 1) / 30) : null;
      clipCache.set(c.name, { clip, loop: !!c.loop, duration: c.duration, markers });
    }));
    measureContacts();
    clipsReady = true;
  }
  const clipsPromise = loadClips().catch((e) => { console.warn('clips unavailable, keeping pose driver', e); });

  // Find when each attack visually lands: the striking hand/foot's peak
  // forward reach (+Z in model space), sampled through the skeleton. Also the
  // frame where the knockdown clip's pelvis reaches the floor.
  const contacts = {};
  const EFFECTORS = {
    jab: ['hand_l', 'hand_r'], cross: ['hand_l', 'hand_r'], hook: ['hand_l', 'hand_r'], uppercut: ['hand_l', 'hand_r'],
    roundhouse: ['foot_l', 'foot_r'], snap_kick: ['foot_l', 'foot_r'], sweep: ['foot_l', 'foot_r'], flying_kick: ['foot_l', 'foot_r'],
    low_kick: ['foot_l', 'foot_r'], high_roundhouse: ['foot_l', 'foot_r'], hop_kick: ['foot_l', 'foot_r'], spin_back_kick: ['foot_l', 'foot_r'], stomp: ['foot_l', 'foot_r'],
    body_jab: ['hand_l', 'hand_r'], flurry: ['hand_l', 'hand_r'], hammer_fist: ['hand_l', 'hand_r'], haymaker: ['hand_l', 'hand_r'], ground_pound: ['hand_l', 'hand_r'],
    elbow: ['lowerarm_l', 'lowerarm_r'], knee: ['calf_l', 'calf_r'], shoulder_tackle: ['upperarm_l', 'upperarm_r'],
  };
  function measureContacts() {
    const inv = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const saved = root.rotation.y;
    root.rotation.y = 0;
    root.updateMatrixWorld(true);
    inv.copy(root.matrixWorld).invert();
    for (const [name, effectors] of Object.entries(EFFECTORS)) {
      const entry = clipCache.get(name);
      if (!entry) continue;
      const action = mixer.clipAction(entry.clip);
      action.reset().setEffectiveWeight(1).play();
      let best = -Infinity, bestT = entry.duration * 0.4, worst = Infinity;
      const steps = Math.max(12, Math.round(entry.duration * 60));
      const curve = new Float32Array(steps + 1);       // forward reach of the striking limb per sample
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * entry.duration * 0.999;
        action.time = t;
        mixer.update(0);
        root.updateMatrixWorld(true);
        let forward = -Infinity;
        for (const eff of effectors) {
          const b = bones[eff];
          if (!b) continue;
          b.getWorldPosition(pos).applyMatrix4(inv);
          forward = Math.max(forward, pos.z);
          // skip the first 12% (wind-up) so a forward-leaning start frame can't win the contact search
          if (i < steps * 0.12) continue;
          const lift = name === 'uppercut' ? 0.6 : (name === 'flying_kick' ? 0.5 : 0);
          const score = pos.z + lift * pos.y;
          if (score > best) { best = score; bestT = t; }
          if (score < worst) worst = score;
        }
        curve[i] = forward;
      }
      let reachM = 0;
      for (let i = 0; i < curve.length; i++) reachM = Math.max(reachM, curve[i]);
      const markers = entry.markers && entry.markers.length ? entry.markers : null;
      contacts[name] = { duration: entry.duration, contact: markers ? markers[0] : bestT, contactsS: markers || [bestT], peak: best, min: worst, curve, reachM };
      action.stop();
    }
    const kd = clipCache.get('knocked_down');
    if (kd) {
      const action = mixer.clipAction(kd.clip);
      action.reset().setEffectiveWeight(1).play();
      let lowest = Infinity, fallT = kd.duration * 0.5;
      const steps = Math.round(kd.duration * 60);
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * kd.duration * 0.999;
        action.time = t;
        mixer.update(0);
        root.updateMatrixWorld(true);
        bones.pelvis.getWorldPosition(pos).applyMatrix4(inv);
        if (pos.y < lowest - 0.005) { lowest = pos.y; fallT = t; }
      }
      contacts.knocked_down = { duration: kd.duration, fall: fallT };
      action.stop();
    }
    mixer.stopAllAction();
    root.rotation.y = saved;
  }

  function play(name, { key = name, speed = 1, fade = 0.1, loop = null, holdAt = null, startAt = 0, sync = false } = {}) {
    if (current && current.key === key) return;
    const entry = clipCache.get(name);
    if (!entry) return;
    const action = mixer.clipAction(entry.clip);
    const isLoop = loop ?? entry.loop;
    action.reset();
    action.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.paused = false;
    action.time = startAt;
    action.setEffectiveTimeScale(speed).setEffectiveWeight(1);
    if (current && current.action !== action) current.action.crossFadeTo(action, fade, false);
    action.fadeIn(fade).play();
    current = { action, name, key, holdAt, sync, speed, startAt, duration: entry.duration };
  }

  // Pick the clip for a fight state.
  // info: { state, stateSerial, dir, hitHeight, hitstunMs }
  function animate(info) {
    if (!clipsReady) return false;
    const { state, dir = 1, hitHeight = 'high' } = info;
    if (info.clip && clipCache.has(info.clip)) {
      // string moves: the move's own clip at its fitted speed, synced to the sim clock
      play(info.clip, { key: `${state}:${info.stateSerial}`, speed: info.clipSpeed || 1, fade: 0.06, sync: true });
      return true;
    }
    const atk = attackClips[state];
    if (atk) {
      // synced: the clip time is the sim's state clock × speed, so the frame at the hit event is exact
      play(atk.clip, { key: `${state}:${info.stateSerial}`, speed: atk.speed, fade: 0.06, sync: true });
      return true;
    }
    switch (state) {
      case 'idle': play('idle', { fade: 0.18 }); break;
      case 'walk': play(dir >= 0 ? 'walk' : 'walk_back', { fade: 0.14 }); break;
      case 'dash': play('run', { speed: 1.15, fade: 0.1 }); break;
      case 'jump': play('jump', { key: `jump:${info.stateSerial}`, speed: 2.1, startAt: 0.25, fade: 0.06, sync: true }); break;
      case 'crouch': case 'crouchblock': play('crouch', { fade: 0.12 }); break;
      case 'block': play('block', { key: 'block', speed: 1.6, fade: 0.06, holdAt: 0.5 }); break;
      case 'hitstun': {
        const name = hitHeight === 'high' ? 'head_hit' : 'body_hit';
        const d = clipCache.get(name)?.duration || 1;
        const speed = Math.min(3, Math.max(1.2, d / Math.max(0.2, (info.hitstunMs || 300) / 1000)));
        play(name, { key: `hit:${info.stateSerial}`, speed, fade: 0.04, sync: true });
        break;
      }
      case 'ko': play('knocked_down', { key: `ko:${info.stateSerial}`, speed: 1.0, fade: 0.05, sync: true }); break;
      case 'knockdown':
      case 'down': {
        // one fall per knockdown: the clip carries on through the landing and holds its last frame
        const name = clipCache.has(info.fallClip) ? info.fallClip : 'knocked_down';
        play(name, { key: `fall:${info.fallSerial}`, speed: name === 'rage_hit' ? 1.1 : 1.35, fade: 0.05, loop: false });
        break;
      }
      case 'getup': {
        const d = clipCache.get('get_up')?.duration || 2.2;
        play('get_up', { key: `getup:${info.stateSerial}`, speed: d / (info.getupS || 0.97), fade: 0.12, sync: true });
        break;
      }
      case 'stagger': {
        const d = clipCache.get('stagger')?.duration || 1.2;
        play('stagger', { key: `stagger:${info.stateSerial}`, speed: d / (info.staggerS || 0.57), fade: 0.05, sync: true });
        break;
      }
      case 'victory': {
        // round win: the character's signature celebration, holding its final pose;
        // a longer match-win variant is used when the pack provides one
        const name = info.matchWin && clipCache.has('victory_match') ? 'victory_match' : (clipCache.has('victory') ? 'victory' : 'idle');
        play(name, { key: `victory:${info.stateSerial}`, fade: 0.25, loop: name === 'idle' });
        break;
      }
      default: play('idle', { fade: 0.15 });
    }
    return true;
  }

  let flash = 0;

  return {
    object: root,
    model,
    bones,
    clipsPromise,
    contacts,
    get clipsReady() { return clipsReady; },
    // { clip: { duration, contacts: [s] } } for strings.buildStringMoves
    clipInfo() {
      const out = {};
      for (const [name, e] of clipCache) {
        const c = contacts[name];
        out[name] = { duration: e.duration, contacts: e.markers && e.markers.length ? e.markers : (c ? c.contactsS : []), reachM: c ? c.reachM : 0 };
      }
      return out;
    },

    // facing + sim-driven height; in pose mode also writes the bones
    setPose(pose, facing, ctx = {}) {
      const f = facing >= 0 ? 1 : -1;
      root.rotation.y = f * (Math.PI / 2 - 0.16);
      if (clipsReady) { body.position.y = 0; return; }
      posePose(pose, f, ctx);
    },
    animate,
    // dt drives crossfades and loops; stateClockMs drives synced one-shots
    tick(dt, stateClockMs = 0) {
      facialMotion.update(dt);
      if (!clipsReady) return;
      if (current && current.sync) {
        current.action.paused = true;
        current.action.time = Math.min(current.duration - 0.0001, current.startAt + (stateClockMs / 1000) * current.speed);
      }
      mixer.update(dt);
      if (current && current.holdAt !== null && current.action.time >= current.holdAt) current.action.paused = true;
    },
    // forward reach (m, from the body centre) of the striking limb at a clip time
    reachAt(name, timeS) {
      const c = contacts[name];
      if (!c || !c.curve) return 0;
      const n = c.curve.length - 1;
      const x = Math.max(0, Math.min(n, (timeS / c.duration) * n));
      const i = Math.floor(x), f = x - i;
      return c.curve[i] * (1 - f) + c.curve[Math.min(n, i + 1)] * f;
    },
    // clip time (s) of the current one-shot, for debugging
    get clipTime() { return current ? current.action.time : 0; },
    hasClip(name) { return clipCache.has(name); },
    get clipName() { return current ? current.name : null; },

    // Reach of the striking limb at a given clip time, relative to its peak
    // (1 = fully extended). Evaluated offline; restores the live pose after.
    probe(name, timeS) {
      const entry = clipCache.get(name);
      const effs = EFFECTORS[name];
      if (!entry || !effs) return null;
      const inv = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const saved = root.rotation.y;
      root.rotation.y = 0;
      root.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      const live = current ? current.action : null;
      const liveT = live ? live.time : 0;
      const action = mixer.clipAction(entry.clip);
      const score = (t) => {
        action.enabled = true; action.setEffectiveWeight(1); action.play(); action.paused = true; action.time = Math.min(entry.duration - 0.0001, Math.max(0, t));
        if (live && live !== action) live.setEffectiveWeight(0);
        mixer.update(0);
        root.updateMatrixWorld(true);
        let best = -Infinity;
        for (const eff of effs) {
          const b = bones[eff]; if (!b) continue;
          b.getWorldPosition(pos).applyMatrix4(inv);
          const lift = name === 'uppercut' ? 0.6 : (name === 'flying_kick' ? 0.5 : 0);
          best = Math.max(best, pos.z + lift * pos.y);
        }
        return best;
      };
      const at = score(timeS);
      const peak = contacts[name].peak;
      const base = contacts[name].min;
      if (live !== action) { action.stop(); }
      if (live) { live.setEffectiveWeight(1); live.time = liveT; }
      root.rotation.y = saved;
      mixer.update(0);
      return { at, peak, base, fraction: peak - base > 1e-4 ? (at - base) / (peak - base) : 1 };
    },

    setFlash(v) {
      if (v === flash) return;
      flash = v;
      let i = 0;
      for (const m of materials) {
        const b = emissiveBase[i++];
        if (!m.emissive) continue;
        // A brief tint, not a silhouette: strong enough to read as impact,
        // weak enough that skin, cloth and shadows stay visible and bloom
        // does not halo the whole body during hit-stop / KO slow-motion.
        m.emissive.copy(b.c).lerp(WHITE, v * 0.22);
        m.emissiveIntensity = b.i + v * 0.35;
      }
    },
  };
}
