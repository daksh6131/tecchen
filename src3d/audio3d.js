// Sample-based sound design: real recorded impacts, screams, grunts, groans,
// body falls, crowd and gong (CC0, see SOUND_CREDITS.md) layered per event,
// with random pool selection, pitch variation, per-fighter voice colouring,
// and a synthesised sub layer under the heavy hits. Falls back to synth-only
// if the network is unavailable.
import { BANK } from './soundbank.js';

let ctx = null;
let master = null;
let voiceBus = null;
let crowdBus = null;
const buffers = new Map();     // url -> AudioBuffer | null (failed)
let loadedCount = 0;

function ac() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(comp).connect(ctx.destination);
    voiceBus = ctx.createGain();
    voiceBus.gain.value = 0.9;
    voiceBus.connect(master);
    crowdBus = ctx.createGain();
    crowdBus.gain.value = 0.55;
    crowdBus.connect(master);
  }
  return ctx;
}

export function unlock() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume();
}

// ---- loading ------------------------------------------------------------------
async function load(url) {
  if (buffers.has(url)) return buffers.get(url);
  buffers.set(url, null);
  try {
    const c = ac();
    const res = await fetch(url, { mode: 'cors' });
    const data = await res.arrayBuffer();
    const buf = await c.decodeAudioData(data);
    buffers.set(url, buf);
    loadedCount += 1;
    return buf;
  } catch (e) {
    console.warn('sfx load failed', url, e);
    return null;
  }
}

export function preload() {
  const all = Object.values(BANK).flat().map((s) => s.url);
  return Promise.all(all.map(load));
}
export function loaded() { return loadedCount; }

// ---- playback -----------------------------------------------------------------
const lastPick = new Map();
function pick(pool) {
  const list = BANK[pool] || [];
  if (!list.length) return null;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick.get(pool)) i = (i + 1) % list.length;
  lastPick.set(pool, i);
  return list[i];
}

// Play one clip: gain, playback rate (pitch), delay, optional trim, bus.
function play(pool, { gain = 1, rate = 1, jitter = 0.08, delay = 0, maxDur = 0, bus = null, lowpass = 0, fadeOut = 0.05 } = {}) {
  const c = ac(); if (!c) return null;
  const s = pick(pool);
  if (!s) return null;
  const buf = buffers.get(s.url);
  if (!buf) { load(s.url); return null; }
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  const dur = maxDur > 0 ? Math.min(maxDur, buf.duration) : buf.duration;
  if (maxDur > 0 && maxDur < buf.duration) {
    g.gain.setValueAtTime(gain, t + dur - fadeOut);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
  let node = src;
  if (lowpass > 0) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    src.connect(lp);
    node = lp;
  }
  node.connect(g).connect(bus || master);
  src.start(t, 0, dur + 0.02);
  return { src, g };
}

// synthesised sub-bass thump that sits under the recorded impacts
function subThump(freq, drop, dur, gain, delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(drop, t + dur * 0.7);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

// Each fighter gets a voice colour: P1 slightly lower, P2 slightly higher.
const VOICE = [{ rate: 0.93, gain: 1.0 }, { rate: 1.06, gain: 0.95 }];
const voice = (i) => VOICE[i] || VOICE[0];
let lastVoiceT = [0, 0];

// The stock pools are plain recorded grunts and groans; no screams.
const FALLBACK = { scream: 'hurtHeavy' };
export function setVoices() { /* voice packs removed: stock grunts only */ }
export function hasVoice() { return false; }

function speak(pool, who, opts = {}) {
  const c = ac(); if (!c) return;
  // never stack two vocalisations from the same fighter within 120 ms
  if (c.currentTime - lastVoiceT[who] < 0.12) return;
  lastVoiceT[who] = c.currentTime + (opts.delay || 0);
  const v = voice(who);
  const { kind, ...rest } = opts;
  play(FALLBACK[pool] || pool, { ...rest, rate: v.rate * (opts.rate || 1), gain: v.gain * (opts.gain ?? 0.9), bus: voiceBus });
}

// ---- gameplay events ----------------------------------------------------------
export function hit(heavy, victim = 1) {
  if (heavy) {
    play('punchHeavy', { gain: 1.0, jitter: 0.06 });
    subThump(110, 40, 0.35, 0.7);
    if (Math.random() < 0.35) play('bone', { gain: 0.55, delay: 0.02, rate: 1.1 });
    if (Math.random() < 0.55) speak('scream', victim, { gain: 0.85, delay: 0.04, maxDur: 1.1 });
    else speak('hurtHeavy', victim, { gain: 0.95, delay: 0.03, maxDur: 1.0 });
  } else {
    play('punchLight', { gain: 0.85, jitter: 0.1 });
    subThump(150, 60, 0.18, 0.35);
    speak('hurtLight', victim, { gain: 0.85, delay: 0.02, maxDur: 0.7 });
  }
}

export function launch(victim = 1) {
  play('punchHeavy', { gain: 1.0, rate: 0.9 });
  subThump(95, 32, 0.5, 0.9);
  play('bone', { gain: 0.7, delay: 0.01 });
  play('whoosh', { gain: 0.5, rate: 0.8, delay: 0.05 });
  speak('scream', victim, { gain: 0.95, delay: 0.05, maxDur: 1.4 });
}

export function block(defender = 1) {
  play('block', { gain: 0.8 });
  subThump(140, 70, 0.12, 0.25);
  if (Math.random() < 0.35) speak('effort', defender, { gain: 0.5, maxDur: 0.4, rate: 1.1 });
}

// attacker swings: air whoosh plus an occasional kiai
export function attack(attacker = 0, heavy = false) {
  play('whoosh', { gain: heavy ? 0.6 : 0.42, rate: heavy ? 0.85 : 1.1 });
  if (Math.random() < (heavy ? 0.6 : 0.3)) speak('effort', attacker, { gain: 0.7, maxDur: 0.6 });
}

export function whoosh() {
  play('whoosh', { gain: 0.35, rate: 1.15 });
}

export function land() {
  play('thud', { gain: 0.5, rate: 0.9 });
  subThump(100, 45, 0.15, 0.3);
}

// the finishing blow: impact, scream, boom and the crowd
export function ko(loser = 1) {
  play('punchHeavy', { gain: 1.0, rate: 0.8 });
  play('bone', { gain: 0.8, delay: 0.02, rate: 0.9 });
  subThump(90, 24, 1.4, 1.1);
  play('boom', { gain: 0.8, delay: 0.05, maxDur: 2.6 });
  speak('scream', loser, { gain: 1.0, delay: 0.07, maxDur: 1.6, kind: 'ko' });
  play('crowdRoar', { gain: 0.9, delay: 0.25, maxDur: 5.5, bus: crowdBus, fadeOut: 1.5 });
}
// the body hitting the floor, timed to the knockdown clip
export function koFall(loser = 1) {
  play('fall', { gain: 0.95 });
  subThump(70, 30, 0.5, 0.7);
  speak('groan', loser, { gain: 0.85, delay: 0.35, maxDur: 2.4, jitter: 0.05 });
}

// low-health wheeze, called every few seconds by the game loop
export function breath(who = 0) {
  speak('breath', who, { gain: 0.35, maxDur: 1.6, jitter: 0.04 });
}

// ---- moments ------------------------------------------------------------------
export function stinger(kind) {
  switch (kind) {
    case 'round':
      play('crowdBell', { gain: 0.8, maxDur: 3.2, bus: crowdBus, fadeOut: 0.8 });
      play('gong', { gain: 0.45, delay: 0.3, maxDur: 3.0, fadeOut: 1.0 });
      break;
    case 'fight':
      play('boom', { gain: 0.9, maxDur: 1.4, fadeOut: 0.4 });
      subThump(120, 35, 0.6, 0.9);
      play('crowdCheer', { gain: 0.7, maxDur: 3.0, bus: crowdBus, fadeOut: 1.2 });
      break;
    case 'ko':
      play('subDrop', { gain: 0.8, maxDur: 3.0, fadeOut: 0.6 });
      break;
    case 'win':
      play('gong', { gain: 0.5, maxDur: 4.0, fadeOut: 1.5 });
      play('crowdCheer', { gain: 1.0, maxDur: 7.0, bus: crowdBus, fadeOut: 2.0 });
      play('boom', { gain: 0.6, delay: 0.1, maxDur: 2.5, fadeOut: 0.6 });
      break;
    default: break;
  }
}

// ---- title ambience -------------------------------------------------------------
let drone = null;
export function droneStart() {
  const c = ac(); if (!c || drone) return;
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 1.5);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  lp.Q.value = 1.5;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start(t);
  const nodes = [lfo];
  for (const [f, type] of [[55, 'sawtooth'], [55.4, 'sawtooth'], [82.4, 'sawtooth'], [27.5, 'sine']]) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    nodes.push(o);
  }
  lp.connect(g).connect(master);
  drone = { g, nodes };
}
export function droneStop() {
  const c = ac(); if (!c || !drone) return;
  const t = c.currentTime;
  drone.g.gain.cancelScheduledValues(t);
  drone.g.gain.setValueAtTime(drone.g.gain.value, t);
  drone.g.gain.linearRampToValueAtTime(0, t + 0.6);
  for (const o of drone.nodes) o.stop(t + 0.7);
  drone = null;
}
