let ctx = null;

function ac() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume();
}

function blip(freq, dur, type, gain, slideTo) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

function thud(dur, gain) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.buffer = buf;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

function sub(freq, dur, gain) {
  // Tekken-style body: a sine sub-thump under every impact
  blip(freq, dur, 'sine', gain, Math.max(28, freq * 0.4));
}

export function sfxHit(heavy = false) {
  blip(heavy ? 150 : 220, 0.09, 'square', 0.3, heavy ? 60 : 90);
  thud(heavy ? 0.16 : 0.1, heavy ? 0.65 : 0.45);
  sub(heavy ? 62 : 88, heavy ? 0.22 : 0.13, heavy ? 0.55 : 0.35);
  // hurt grunt: short falling tone, deeper when the hit is heavy
  blip(heavy ? 130 : 190, heavy ? 0.16 : 0.1, 'sawtooth', 0.14, heavy ? 55 : 95);
}

export function sfxBlock() {
  blip(600, 0.05, 'triangle', 0.25, 300);
}

export function sfxWhiff() {
  thud(0.05, 0.12);
  blip(900, 0.05, 'sine', 0.08, 300);
}

export function sfxLaunch() {
  blip(180, 0.22, 'square', 0.3, 520); // rising sweep
  thud(0.1, 0.4);
}

export function sfxLand() {
  thud(0.05, 0.2);
}

export function sfxKO() {
  blip(200, 0.5, 'sawtooth', 0.4, 40);
  thud(0.4, 0.8);
  sub(50, 0.6, 0.7);
}

// Arcade announcer (Tekken-style). No audio files: speech synthesis,
// pitched down. Safe no-op outside the browser or if unsupported.
export function announce(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 0.45;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* no announcer available */ }
}
