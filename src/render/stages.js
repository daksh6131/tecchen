import { config } from '../config.js';

// ——— Stage 1: Golden Gate at sunset ———————————————————————————————
const goldenGate = {
  id: 'golden-gate',
  name: 'GOLDEN GATE — SAN FRANCISCO',
  draw(ctx, cameraX = 0, t = 0) {
    const { w, h } = config.canvas;
    const fy = config.floorY;

    // sunset sky
    const sky = ctx.createLinearGradient(0, 0, 0, fy);
    sky.addColorStop(0, '#2c2a55');
    sky.addColorStop(0.45, '#7a4a6e');
    sky.addColorStop(0.75, '#c96a4e');
    sky.addColorStop(1, '#f0a05a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, fy);

    // sun + glow
    const sunX = w * 0.62, sunY = fy - 130;
    ctx.fillStyle = 'rgba(255,214,140,0.25)';
    ctx.beginPath(); ctx.arc(sunX, sunY, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,222,160,0.5)';
    ctx.beginPath(); ctx.arc(sunX, sunY, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9b8';
    ctx.beginPath(); ctx.arc(sunX, sunY, 36, 0, Math.PI * 2); ctx.fill();

    // Marin headlands
    ctx.fillStyle = '#3a2f45';
    ctx.beginPath();
    ctx.moveTo(0, fy - 96);
    ctx.quadraticCurveTo(w * 0.18 - cameraX * 0.08, fy - 152, w * 0.4, fy - 100);
    ctx.quadraticCurveTo(w * 0.55, fy - 82, w * 0.75, fy - 106);
    ctx.quadraticCurveTo(w * 0.9, fy - 124, w, fy - 92);
    ctx.lineTo(w, fy - 40); ctx.lineTo(0, fy - 40);
    ctx.closePath(); ctx.fill();

    // bay water with sun shimmer
    ctx.fillStyle = '#7a5570';
    ctx.fillRect(0, fy - 40, w, 40);
    ctx.fillStyle = 'rgba(255,214,150,0.35)';
    for (let i = 0; i < 14; i++) {
      const ly = fy - 36 + i * 2.6;
      const lw = 60 - i * 3 + Math.sin(t * 2 + i) * 10;
      ctx.fillRect(sunX - lw / 2 + Math.sin(t + i * 1.7) * 6, ly, lw, 1.4);
    }

    // the bridge: deck, two towers, cables
    const deckY = fy - 118;
    const px = -cameraX * 0.25;
    const T1 = w * 0.24 + px, T2 = w * 0.78 + px;
    const RED = '#b64a32', RED_D = '#8c3624', RED_L = '#d05f41';

    // main cables (catenary curves between tower tops)
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(T1 - 300, deckY - 6);
    ctx.quadraticCurveTo((T1 - 300 + T1) / 2, deckY - 130, T1, deckY - 150);
    ctx.quadraticCurveTo((T1 + T2) / 2, deckY + 46, T2, deckY - 150);
    ctx.quadraticCurveTo((T2 + T2 + 300) / 2, deckY - 130, T2 + 300, deckY - 6);
    ctx.stroke();
    // hangers drop from the sagging main cable to the deck
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(182,74,50,0.8)';
    for (let hx = T1 + 24; hx < T2; hx += 34) {
      const f = (hx - T1) / (T2 - T1);
      const sag = deckY + 46 - 196 * Math.pow(Math.abs(f - 0.5) * 2, 2);
      ctx.beginPath();
      ctx.moveTo(hx, Math.min(sag, deckY - 2));
      ctx.lineTo(hx, deckY - 2);
      ctx.stroke();
    }
    // towers (art deco: two columns + cross braces)
    for (const tx of [T1, T2]) {
      ctx.fillStyle = RED;
      ctx.fillRect(tx - 12, deckY - 150, 9, 150);
      ctx.fillRect(tx + 3, deckY - 150, 9, 150);
      ctx.fillStyle = RED_L;
      ctx.fillRect(tx - 12, deckY - 150, 3, 150);
      ctx.fillStyle = RED_D;
      for (const by of [deckY - 140, deckY - 104, deckY - 66, deckY - 28]) {
        ctx.fillRect(tx - 12, by, 24, 7);
      }
      ctx.fillStyle = RED;
      ctx.fillRect(tx - 14, deckY - 156, 28, 6);
    }
    // deck
    ctx.fillStyle = RED_D;
    ctx.fillRect(0, deckY - 2, w, 7);
    ctx.fillStyle = RED;
    ctx.fillRect(0, deckY + 5, w, 3);

    // drifting fog
    ctx.fillStyle = 'rgba(240,238,230,0.10)';
    for (let i = 0; i < 4; i++) {
      const fx = ((i * 300 + t * 12 - cameraX * 0.15) % (w + 400)) - 200;
      ctx.beginPath();
      ctx.ellipse(fx, deckY + 26 + i * 8, 170, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // overlook plaza floor
    const fl = ctx.createLinearGradient(0, fy, 0, h);
    fl.addColorStop(0, '#5a4a4a');
    fl.addColorStop(1, '#332a2c');
    ctx.fillStyle = fl;
    ctx.fillRect(0, fy, w, h - fy);
    ctx.strokeStyle = 'rgba(240,200,150,0.14)';
    ctx.lineWidth = 1;
    const off = ((cameraX * 0.9) % 64 + 64) % 64;
    for (let x = -off; x < w; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x + 40, h); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,190,120,0.85)';
    ctx.fillRect(0, fy - 2, w, 3);

    vignette(ctx, w, h, 0.45);
  },
};

// ——— Stage 2: AI headquarters at night ————————————————————————————
const aiOffice = {
  id: 'ai-office',
  name: 'AI HQ — NIGHT SHIFT',
  draw(ctx, cameraX = 0, t = 0) {
    const { w, h } = config.canvas;
    const fy = config.floorY;

    // room
    ctx.fillStyle = '#101318';
    ctx.fillRect(0, 0, w, fy);

    // window wall with night skyline
    const winTop = 60, winBot = fy - 44;
    const wsky = ctx.createLinearGradient(0, winTop, 0, winBot);
    wsky.addColorStop(0, '#0a1226');
    wsky.addColorStop(1, '#14233f');
    ctx.fillStyle = wsky;
    ctx.fillRect(0, winTop, w, winBot - winTop);
    // stars
    ctx.fillStyle = 'rgba(230,240,255,0.7)';
    for (let i = 0; i < 24; i++) {
      const sx = (i * 137.5) % w, sy = winTop + ((i * 61.7) % 90);
      if (Math.sin(t * 1.5 + i) > -0.6) ctx.fillRect(sx, sy, 2, 2);
    }
    // skyline through glass (parallax)
    ctx.fillStyle = '#1b2a44';
    for (let i = 0; i < 11; i++) {
      const bx = (((i * 150 - cameraX * 0.12) % (w + 300)) + (w + 300)) % (w + 300) - 150;
      const bh = 70 + ((i * 53) % 90);
      ctx.fillRect(bx, winBot - bh, 84, bh);
      ctx.fillStyle = 'rgba(255,205,110,0.35)';
      for (let wy = winBot - bh + 8; wy < winBot - 8; wy += 16) {
        for (let wx = bx + 8; wx < bx + 72; wx += 20) {
          if (((wx + wy + i) % 3) !== 0) ctx.fillRect(wx, wy, 5, 7);
        }
      }
      ctx.fillStyle = '#1b2a44';
    }
    // mullions
    ctx.fillStyle = '#20262e';
    for (let x = -(((cameraX * 0.3) % 160 + 160) % 160); x < w; x += 160) {
      ctx.fillRect(x, winTop, 8, winBot - winTop);
    }
    ctx.fillRect(0, winTop - 6, w, 8);
    ctx.fillRect(0, winBot, w, 6);

    // ceiling + light strips
    ctx.fillStyle = '#171b21';
    ctx.fillRect(0, 0, w, winTop - 6);
    for (let x = 40; x < w; x += 220) {
      ctx.fillStyle = 'rgba(200,225,255,0.9)';
      ctx.fillRect(x - cameraX * 0.05, 22, 120, 5);
      ctx.fillStyle = 'rgba(200,225,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(x - cameraX * 0.05 - 14, 27);
      ctx.lineTo(x - cameraX * 0.05 + 134, 27);
      ctx.lineTo(x - cameraX * 0.05 + 170, winTop + 60);
      ctx.lineTo(x - cameraX * 0.05 - 50, winTop + 60);
      ctx.closePath(); ctx.fill();
    }

    // desk row with glowing monitors (behind fighters)
    const deskY = fy - 44;
    for (let i = 0; i < 7; i++) {
      const dx = (((i * 190 - cameraX * 0.5) % (w + 380)) + (w + 380)) % (w + 380) - 190;
      ctx.fillStyle = '#232830';
      ctx.fillRect(dx, deskY + 10, 130, 8);          // desktop
      ctx.fillRect(dx + 12, deskY + 18, 8, 26);      // legs
      ctx.fillRect(dx + 110, deskY + 18, 8, 26);
      // monitor with animated glow
      const flick = 0.75 + 0.25 * Math.sin(t * 3 + i * 2.1);
      ctx.fillStyle = '#0d0f13';
      ctx.fillRect(dx + 38, deskY - 22, 52, 32);
      ctx.fillStyle = `rgba(120,210,240,${0.55 * flick})`;
      ctx.fillRect(dx + 41, deskY - 19, 46, 26);
      ctx.fillStyle = `rgba(160,235,255,${0.5 * flick})`;
      ctx.fillRect(dx + 44, deskY - 15, 26, 3);
      ctx.fillRect(dx + 44, deskY - 9, 34, 3);
      ctx.fillStyle = '#232830';
      ctx.fillRect(dx + 60, deskY + 6, 8, 8);        // stand
      // potted plant every other desk
      if (i % 2 === 0) {
        ctx.fillStyle = '#3d4a35';
        ctx.beginPath(); ctx.arc(dx + 152, deskY + 2, 10, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#2f5238';
        ctx.fillRect(dx + 145, deskY - 12, 4, 14);
        ctx.fillRect(dx + 153, deskY - 16, 4, 18);
        ctx.fillRect(dx + 160, deskY - 10, 4, 12);
        ctx.fillStyle = '#4a3a2c';
        ctx.fillRect(dx + 144, deskY + 2, 22, 12);
      }
    }

    // hex "lab" emblem on the back wall
    ctx.save();
    ctx.translate(w / 2 - cameraX * 0.2, 40);
    ctx.strokeStyle = 'rgba(120,210,240,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px2 = Math.cos(a) * 14, py2 = Math.sin(a) * 14;
      if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();

    // polished floor with monitor reflections
    const fl = ctx.createLinearGradient(0, fy, 0, h);
    fl.addColorStop(0, '#262b33');
    fl.addColorStop(1, '#14171c');
    ctx.fillStyle = fl;
    ctx.fillRect(0, fy, w, h - fy);
    for (let i = 0; i < 7; i++) {
      const dx = (((i * 190 - cameraX * 0.5) % (w + 380)) + (w + 380)) % (w + 380) - 190;
      ctx.fillStyle = 'rgba(120,210,240,0.06)';
      ctx.fillRect(dx + 38, fy + 4, 52, 26);
    }
    ctx.fillStyle = 'rgba(170,200,230,0.5)';
    ctx.fillRect(0, fy - 2, w, 2);

    vignette(ctx, w, h, 0.5);
  },
};

function vignette(ctx, w, h, strength) {
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

export const STAGES = [goldenGate, aiOffice];

let stageCursor = 0;
export function nextStage() {
  const s = STAGES[stageCursor % STAGES.length];
  stageCursor += 1;
  return s;
}
