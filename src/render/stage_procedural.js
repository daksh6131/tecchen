import { config } from '../config.js';

export const proceduralStage = {
  draw(ctx, cameraX = 0) {
    const { w, h } = config.canvas;
    const fy = config.floorY;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1e33');
    sky.addColorStop(0.55, '#123a52');
    sky.addColorStop(1, '#1d5a6b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // moon
    ctx.fillStyle = 'rgba(150,230,225,0.30)';
    ctx.beginPath(); ctx.arc(w * 0.52, h * 0.32, 74, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(150,230,225,0.15)';
    ctx.beginPath(); ctx.arc(w * 0.52, h * 0.32, 96, 0, Math.PI * 2); ctx.fill();

    // far skyline
    ctx.fillStyle = '#0a1622';
    for (let i = 0; i < 12; i++) {
      const bx = (((i * 140 - cameraX * 0.2) % (w + 300)) + (w + 300)) % (w + 300) - 150;
      ctx.fillRect(bx, fy - 230, 92, 230);
      ctx.fillRect(bx + 30, fy - 268, 30, 40);
    }
    // near buildings
    ctx.fillStyle = '#0d1b2a';
    for (let i = 0; i < 9; i++) {
      const bx = (((i * 190 - cameraX * 0.45) % (w + 360)) + (w + 360)) % (w + 360) - 180;
      ctx.fillRect(bx, fy - 170, 132, 170);
      ctx.fillStyle = 'rgba(255,205,110,0.5)';
      for (let wy = fy - 150; wy < fy - 20; wy += 34) {
        for (let wx = bx + 16; wx < bx + 116; wx += 34) ctx.fillRect(wx, wy, 12, 16);
      }
      ctx.fillStyle = '#0d1b2a';
    }

    // floor
    ctx.fillStyle = '#1c2c1e';
    ctx.fillRect(0, fy, w, h - fy);
    ctx.strokeStyle = 'rgba(255,210,120,0.12)';
    ctx.lineWidth = 1;
    const off = ((cameraX * 0.9) % 48 + 48) % 48;
    for (let x = -off; x < w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x + 60, h); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,200,90,0.9)';
    ctx.fillRect(0, fy - 2, w, 3);

    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  },
};
