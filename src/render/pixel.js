import { spriteCanvas } from './pixelart.js';

const D2R = Math.PI / 180;
const SCALE = 2;

// Limb convention: sprites are authored pointing DOWN (pivot at top).
// rotate(-angle): angle 0 = hanging down, +angle swings FORWARD (toward
// the direction the fighter faces), e.g. punch at ~100° = arm horizontal.
function limb(ctx, part, ox, oy, angleDeg, dim) {
  const cv = spriteCanvas(part, SCALE, dim);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(-angleDeg * D2R);
  ctx.drawImage(cv, -cv.width / 2, -2);
  ctx.restore();
}

// Two-segment arm with an elbow: the sprite's top half is the upper arm,
// bottom half the forearm+hand. `bend` swings the forearm further forward.
function armLimb(ctx, part, ox, oy, angleDeg, bendDeg, dim) {
  const cv = spriteCanvas(part, SCALE, dim);
  const split = Math.floor(cv.height / 2);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(-angleDeg * D2R);
  ctx.drawImage(cv, 0, 0, cv.width, split, -cv.width / 2, -2, cv.width, split);
  ctx.translate(0, split - 5);
  ctx.rotate(-bendDeg * D2R);
  ctx.drawImage(cv, 0, split, cv.width, cv.height - split, -cv.width / 2, 0, cv.width, cv.height - split);
  ctx.restore();
}

// Two-segment leg with a knee: top ~54% is the thigh, the rest shin+shoe.
// Knees bend the opposite way to elbows (shin swings backward).
function legLimb(ctx, part, ox, oy, angleDeg, bendDeg, dim) {
  const cv = spriteCanvas(part, SCALE, dim);
  const split = Math.floor(cv.height * 0.54);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(-angleDeg * D2R);
  ctx.drawImage(cv, 0, 0, cv.width, split, -cv.width / 2, -2, cv.width, split);
  ctx.translate(0, split - 5);
  ctx.rotate(bendDeg * D2R);
  ctx.drawImage(cv, 0, split, cv.width, cv.height - split, -cv.width / 2, 0, cv.width, cv.height - split);
  ctx.restore();
}

export const pixelRenderer = {
  drawFighter(ctx, { art, pose, x, y, facing, flash }) {
    const parts = art.parts;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flash) ctx.filter = 'brightness(1.9) saturate(0.4)'; // damage flash
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.translate(0, pose.bodyY || 0);

    const hipY = -70;
    const shoulderY = -108;
    const headY = -122;

    // floor shadow
    ctx.save();
    ctx.scale(1, 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, (-(pose.bodyY || 0) + 6) / 0.35, 40, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // back limbs (dimmed for depth)
    legLimb(ctx, parts.leg, 10, hipY, pose.backLegAngle || 0, pose.backLegBend ?? 8, true);
    armLimb(ctx, parts.arm, 13, shoulderY, pose.backArmAngle || 0, pose.backArmBend ?? 45, true);

    // torso
    const torso = spriteCanvas(parts.torso, SCALE, false);
    ctx.save();
    ctx.translate(0, shoulderY);
    ctx.rotate((pose.torsoAngle || 0) * D2R);
    ctx.drawImage(torso, -torso.width / 2, -2);
    ctx.restore();

    // front limbs
    legLimb(ctx, parts.leg, -10, hipY, pose.frontLegAngle || 0, pose.frontLegBend ?? 8, false);
    armLimb(ctx, parts.arm, -13, shoulderY, pose.frontArmAngle || 0, pose.frontArmBend ?? 45, false);

    // head
    const head = spriteCanvas(parts.head, SCALE, false);
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate((pose.headAngle || 0) * D2R);
    ctx.drawImage(head, -head.width / 2, -16);
    ctx.restore();

    ctx.restore();
  },
};
