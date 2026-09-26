const D2R = Math.PI / 180;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function capsule(ctx, len, w, fill, shade) {
  ctx.fillStyle = shade;
  roundRect(ctx, -w / 2 + 3, 0, w, len, w / 2); ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, -w / 2, 0, w - 3, len, w / 2); ctx.fill();
}

function limb(ctx, ox, oy, angleDeg, len, w, fill, shade) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angleDeg * D2R);
  capsule(ctx, len, w, fill, shade);
  ctx.restore();
}

export const proceduralRenderer = {
  drawFighter(ctx, { palette: p, pose, x, y, facing }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.translate(0, pose.bodyY || 0);

    const hipY = -70;
    const shoulderY = -108;
    const headY = -122;

    // soft shadow on floor
    ctx.save();
    ctx.scale(1, 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, (-(pose.bodyY || 0) + 6) / 0.35, 40, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // back limbs (depth)
    limb(ctx, 6, hipY, -(pose.backLegAngle || 0), 72, 20, shade(p.pants), '#000');
    limb(ctx, 8, shoulderY, -(pose.backArmAngle || 0), 60, 15, p.mainShade, '#000');

    // torso
    ctx.save();
    ctx.translate(0, shoulderY);
    ctx.rotate((pose.torsoAngle || 0) * D2R);
    ctx.fillStyle = p.mainShade; roundRect(ctx, -25, 0, 50, 56, 13); ctx.fill();
    ctx.fillStyle = p.main; roundRect(ctx, -23, 0, 40, 56, 12); ctx.fill();
    ctx.fillStyle = p.trim; ctx.fillRect(-23, 46, 46, 6);
    ctx.restore();

    // front limbs
    limb(ctx, -6, hipY, -(pose.frontLegAngle || 0), 74, 21, p.pants, shade(p.pants));
    limb(ctx, -8, shoulderY, -(pose.frontArmAngle || 0), 62, 16, p.main, p.mainShade);

    // head
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate((pose.headAngle || 0) * D2R);
    ctx.fillStyle = p.skin; roundRect(ctx, -17, -2, 34, 36, 11); ctx.fill();
    ctx.fillStyle = shade(p.skin); roundRect(ctx, 7, -2, 10, 36, 8); ctx.fill();
    ctx.fillStyle = p.hair; roundRect(ctx, -19, -8, 40, 18, 9); ctx.fill();
    ctx.fillStyle = '#241d18'; ctx.fillRect(6, 14, 5, 5); // eye
    ctx.restore();

    ctx.restore();
  },
};

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 40);
  const g = Math.max(0, ((n >> 8) & 255) - 40);
  const b = Math.max(0, (n & 255) - 40);
  return `rgb(${r},${g},${b})`;
}
