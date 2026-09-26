// Volumetric vector fighter renderer — Tekken-3-style 3D-lit look on the
// 2D canvas: every limb is a tapered capsule shaded with a cylindrical
// light gradient (lit side -> core -> shadow), muscles taper, the torso is
// gradient-modeled with clothing folds, and a warm rim light picks out the
// sun side. Driven by the shared pose model: all per-action animations
// (jab/cross/knee/roundhouse/sweep/uppercut) carry over unchanged.

const D2R = Math.PI / 180;

// skeleton (y from feet at 0; drawn with facing flip + bodyY offset)
const HEAD_Y = -146;
const SHOULDER_Y = -126;
const HIP_Y = -76;
const SHOULDER_X = 14;
const HIP_X = 8;
const ARM_UPPER = 26, ARM_FORE = 22, HAND_R = 5.5;
const LEG_THIGH = 38, LEG_SHIN = 34;
const RIM = 'rgba(255,196,130,0.55)'; // sunset rim light

function dirOf(angleDeg) {
  const a = angleDeg * D2R;
  return [Math.sin(a), Math.cos(a)];
}

// color helpers: derive lit/shadow tones from a base hex
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = ch(((n >> 16) & 255) * f), g = ch(((n >> 8) & 255) * f), b = ch((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
export function lighten(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * f)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

// Tapered capsule with cylindrical lighting across its axis.
function volumeLimb(ctx, x1, y1, x2, y2, w1, w2, base, dim) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const w = Math.max(w1, w2);
  const g = ctx.createLinearGradient(mx - nx * w * 0.6, my - ny * w * 0.6,
    mx + nx * w * 0.6, my + ny * w * 0.6);
  const k = dim ? 0.72 : 1;
  g.addColorStop(0, lighten(base, dim ? 0.08 : 0.28));
  g.addColorStop(0.45, shade(base, k));
  g.addColorStop(1, shade(base, 0.55 * k));

  const a1 = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  ctx.arc(x2, y2, w2 / 2, a1 + Math.PI / 2, a1 - Math.PI / 2, true);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a1 - Math.PI / 2, a1 + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,12,20,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawArm(ctx, sx, sy, angle, bend, look, dim, bare) {
  const [dx1, dy1] = dirOf(angle);
  const ex = sx + dx1 * ARM_UPPER, ey = sy + dy1 * ARM_UPPER;
  const [dx2, dy2] = dirOf(angle + bend);
  const wx = ex + dx2 * ARM_FORE, wy = ey + dy2 * ARM_FORE;

  // deltoid cap
  const dg = ctx.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, 9);
  dg.addColorStop(0, lighten(look.top, dim ? 0.05 : 0.3));
  dg.addColorStop(1, shade(look.top, dim ? 0.55 : 0.7));
  ctx.beginPath();
  ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.fillStyle = dg;
  ctx.fill();

  // biceps taper 12->9, forearm 9->6.5 (muscle reads in the taper)
  volumeLimb(ctx, sx, sy, ex, ey, 12, 9, look.top, dim);
  volumeLimb(ctx, ex, ey, wx, wy, 9.5, 6.5, bare ? look.skin : look.topLight, dim);

  // fist: shaded sphere
  const fx = wx + dx2 * 3, fy = wy + dy2 * 3;
  const fg = ctx.createRadialGradient(fx - 2, fy - 2, 1, fx, fy, HAND_R + 1);
  fg.addColorStop(0, lighten(look.skin, dim ? 0.05 : 0.3));
  fg.addColorStop(1, shade(look.skin, dim ? 0.5 : 0.62));
  ctx.beginPath();
  ctx.arc(fx, fy, HAND_R, 0, Math.PI * 2);
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,12,20,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawLeg(ctx, hx, hy, angle, bend, look, dim) {
  const [dx1, dy1] = dirOf(angle);
  const kx = hx + dx1 * LEG_THIGH, ky = hy + dy1 * LEG_THIGH;
  const [dx2, dy2] = dirOf(angle - bend); // knees fold backward
  const ax = kx + dx2 * LEG_SHIN, ay = ky + dy2 * LEG_SHIN;

  // thigh 17->13, shin with calf: upper shin wider (calf) then ankle taper
  volumeLimb(ctx, hx, hy, kx, ky, 17, 13, look.pants, dim);
  const cx = kx + dx2 * LEG_SHIN * 0.4, cy = ky + dy2 * LEG_SHIN * 0.4;
  volumeLimb(ctx, kx, ky, cx, cy, 13, 12, look.pants, dim);
  volumeLimb(ctx, cx, cy, ax, ay, 12, 7.5, look.pants, dim);

  // jeans crease highlight down the thigh
  if (!dim) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - dx1 * 2, hy + 4);
    ctx.lineTo(kx - dx1 * 2, ky - 2);
    ctx.stroke();
  }

  // shoe: shaped last with toe spring + heel
  const footAngle = (angle - bend) * D2R;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(-footAngle * 0.25);
  const sg = ctx.createLinearGradient(0, -5, 0, 6);
  sg.addColorStop(0, lighten(look.shoe, dim ? 0.05 : 0.25));
  sg.addColorStop(1, shade(look.shoe, dim ? 0.55 : 0.7));
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.quadraticCurveTo(-8, 4, -3, 5);
  ctx.lineTo(11, 5);
  ctx.quadraticCurveTo(16, 4.5, 15, 1);
  ctx.quadraticCurveTo(13, -3.5, 6, -4);
  ctx.closePath();
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,12,20,0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (look.sole) {
    ctx.fillStyle = look.sole;
    ctx.fillRect(-7, 4, 22, 2.4);
  }
  ctx.restore();
}

function drawTorso(ctx, look, torsoAngle) {
  ctx.save();
  ctx.translate(0, SHOULDER_Y);
  ctx.rotate(torsoAngle * D2R);

  // gradient-modeled trunk: lit chest -> core -> shadow flank
  const tg = ctx.createLinearGradient(-18, 0, 18, 10);
  tg.addColorStop(0, lighten(look.top, 0.24));
  tg.addColorStop(0.5, look.top);
  tg.addColorStop(1, shade(look.top, 0.55));

  ctx.beginPath();
  ctx.moveTo(-17, -4);
  ctx.quadraticCurveTo(-19, 14, -13, 30);
  ctx.quadraticCurveTo(-12, 44, -11, 50);
  ctx.lineTo(11, 50);
  ctx.quadraticCurveTo(12, 44, 13, 30);
  ctx.quadraticCurveTo(19, 14, 17, -4);
  ctx.quadraticCurveTo(0, -10, -17, -4);
  ctx.closePath();
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,12,20,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // rim light on the lit edge
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16.5, -3);
  ctx.quadraticCurveTo(-18.5, 14, -12.5, 30);
  ctx.stroke();

  // chest definition
  ctx.strokeStyle = 'rgba(16,12,20,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-6, 8, 7, Math.PI * 0.15, Math.PI * 0.85);
  ctx.arc(7, 8, 7, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // clothing folds
  ctx.strokeStyle = 'rgba(16,12,20,0.22)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9, 34);
  ctx.quadraticCurveTo(-3, 37, 2, 34);
  ctx.moveTo(-7, 42);
  ctx.quadraticCurveTo(0, 45, 6, 42);
  ctx.stroke();

  if (look.style === 'blazer') {
    // open blazer: shaded shirt V + lapels catching light
    const sh = ctx.createLinearGradient(-6, -6, 6, 24);
    sh.addColorStop(0, lighten(look.shirt, 0.18));
    sh.addColorStop(1, shade(look.shirt, 0.7));
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(6, -6);
    ctx.lineTo(2, 26);
    ctx.lineTo(-2, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lighten(look.top, 0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(-1, 24);
    ctx.stroke();
    ctx.strokeStyle = shade(look.top, 0.7);
    ctx.beginPath();
    ctx.moveTo(7, -5);
    ctx.lineTo(1, 24);
    ctx.stroke();
  } else {
    // crew-neck band + ribbed hem
    ctx.strokeStyle = shade(look.collar, 0.9);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -4, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = shade(look.top, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-11, 47);
    ctx.lineTo(11, 47);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx, look, headAngle) {
  ctx.save();
  ctx.translate(0, HEAD_Y);
  ctx.rotate(headAngle * D2R);

  // neck (lit cylinder)
  volumeLimb(ctx, 0, 10, 0, 22, 9, 10, look.skin, false);

  // skull: radial-lit sphere
  const hg = ctx.createRadialGradient(-3, -4, 2, 1, 0, 14);
  hg.addColorStop(0, lighten(look.skin, 0.32));
  hg.addColorStop(0.7, look.skin);
  hg.addColorStop(1, shade(look.skin, 0.62));
  ctx.beginPath();
  ctx.ellipse(1, 0, 11, 12.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,12,20,0.8)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // rim light on the lit side of the face
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(1, 0, 11, 12.5, 0, Math.PI * 0.75, Math.PI * 1.25);
  ctx.stroke();

  // hair with gradient volume
  const hairG = ctx.createLinearGradient(-10, -14, 8, -2);
  hairG.addColorStop(0, lighten(look.hair, 0.22));
  hairG.addColorStop(1, shade(look.hair, 0.6));
  ctx.fillStyle = hairG;
  ctx.strokeStyle = 'rgba(16,12,20,0.7)';
  ctx.lineWidth = 1.3;
  if (look.hairStyle === 'curly') {
    ctx.beginPath();
    ctx.arc(-4, -8, 7, 0, Math.PI * 2);
    ctx.arc(3, -10, 6.5, 0, Math.PI * 2);
    ctx.arc(9, -6, 5, 0, Math.PI * 2);
    ctx.arc(-9, -3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-4, -8, 7, Math.PI * 0.7, Math.PI * 1.9);
    ctx.arc(3, -10, 6.5, Math.PI * 1.2, Math.PI * 2.2);
    ctx.stroke();
    ctx.fillStyle = look.hairLight;
    ctx.beginPath();
    ctx.arc(-7, -9, 2, 0, Math.PI * 2);
    ctx.arc(2, -13, 2, 0, Math.PI * 2);
    ctx.arc(8, -8, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.quadraticCurveTo(-12, -13, 0, -13.5);
    ctx.quadraticCurveTo(12, -13, 12, -3);
    ctx.quadraticCurveTo(6, -8, -2, -7);
    ctx.quadraticCurveTo(-9, -6, -11, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // face (facing +x)
  if (look.glasses) {
    ctx.strokeStyle = '#2b3546';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(3, -1, 3.4, 0, Math.PI * 2);
    ctx.moveTo(12.4, -1);
    ctx.arc(9.5, -1, 2.6, 0, Math.PI * 2);
    ctx.moveTo(6.4, -1.5);
    ctx.lineTo(6.9, -1.5);
    ctx.stroke();
    ctx.fillStyle = '#241d16';
    ctx.fillRect(2.4, -1.8, 1.8, 2.4);
    ctx.fillRect(9, -1.8, 1.6, 2.4);
  } else {
    ctx.fillStyle = '#241d16';
    ctx.fillRect(2.5, -2.2, 2, 2.6);
    ctx.fillRect(8.5, -2.2, 1.8, 2.6);
    ctx.strokeStyle = shade(look.hair, 0.8);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(1.8, -5);
    ctx.lineTo(5, -5.4);
    ctx.moveTo(8, -5.4);
    ctx.lineTo(10.8, -5);
    ctx.stroke();
  }
  ctx.strokeStyle = shade(look.skin, 0.7);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(11.5, 1);
  ctx.lineTo(12.5, 3.2);
  ctx.stroke();
  if (look.grin) {
    ctx.fillStyle = '#fbf7ef';
    ctx.strokeStyle = '#7c3f34';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(7.5, 6.4, 3.6, 2, 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#a06a58';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(5.5, 6.4);
    ctx.lineTo(10, 6.4);
    ctx.stroke();
  }
  ctx.restore();
}

export const vectorRenderer = {
  drawFighter(ctx, { art, pose, x, y, facing, flash }) {
    const look = art.look;
    ctx.save();
    if (flash) ctx.filter = 'brightness(1.9) saturate(0.4)';
    ctx.translate(x, y);

    // soft contact shadow
    ctx.save();
    ctx.scale(1, 0.35);
    const shg = ctx.createRadialGradient(0, 10, 4, 0, 10, 38);
    shg.addColorStop(0, 'rgba(0,0,0,0.4)');
    shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.beginPath();
    ctx.ellipse(0, 10, 38, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.scale(facing, 1);
    ctx.translate(0, pose.bodyY || 0);

    drawArm(ctx, SHOULDER_X * 0.6, SHOULDER_Y + 4, pose.backArmAngle || 0, pose.backArmBend ?? 45, look, true, look.bareForearms);
    drawLeg(ctx, HIP_X, HIP_Y, pose.backLegAngle || 0, pose.backLegBend ?? 8, look, true);
    drawTorso(ctx, look, pose.torsoAngle || 0);
    drawLeg(ctx, -HIP_X, HIP_Y, pose.frontLegAngle || 0, pose.frontLegBend ?? 8, look, false);
    drawHead(ctx, look, pose.headAngle || 0);
    drawArm(ctx, -SHOULDER_X * 0.6, SHOULDER_Y + 4, pose.frontArmAngle || 0, pose.frontArmBend ?? 45, look, false, look.bareForearms);

    ctx.restore();
  },
};
