import { config } from './config.js';
import { Input } from './input.js';
import { createFightScreen } from './screens/fight.js';
import { unlockAudio } from './audio.js';
import { CHARACTERS } from './characters.js';

const STEP_MS = 1000 / config.fps;

export function stepCount(elapsedMs, carryMs = 0) {
  return Math.floor((elapsedMs + carryMs) / STEP_MS);
}

export function startGame(canvas) {
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0, 0, config.canvas.w, config.canvas.h);
  ctx.fillStyle = '#FFD43B';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOADING…', config.canvas.w / 2, config.canvas.h / 2);

  const input = new Input();
  input.attach(window);

  let screen = null;
  const loadPfp = (c) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { c.pfp = img; resolve(); };
    img.onerror = () => resolve(); // fall back to the pixel portrait
    img.src = `assets/pfp/${c.id}_face.png`;
  });
  Promise.all(
    Object.values(CHARACTERS).map(loadPfp),
  ).then(() => {
    screen = createFightScreen({ p1Id: 'dario', p2Id: 'sam', input });
  });

  window.addEventListener('keydown', (e) => {
    unlockAudio(); // browsers require a user gesture before audio plays
    if (e.code === 'Enter' && screen && screen.koSettled) {
      screen = createFightScreen({ p1Id: 'dario', p2Id: 'sam', input });
    }
  });

  let acc = 0;
  let last = performance.now();

  function frame(now) {
    acc += now - last;
    last = now;
    if (!screen) { requestAnimationFrame(frame); return; }
    let steps = 0;
    while (acc >= STEP_MS && steps < 5) {
      screen.update(config.dt);
      acc -= STEP_MS;
      steps++;
    }
    screen.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
