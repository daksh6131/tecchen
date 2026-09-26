// Pixel-space (2D sim) <-> world-space (3D scene) conversion and the
// pose-degrees -> joint-radians mapping shared by the rig and the FX layer.
import { config } from '../src/config.js';

export const PX = 1 / 75;                 // metres per sim pixel
export const BODY_HALF_DEPTH = 0.22;      // metres from a fighter's centre to the front of the torso (plus a knuckle)
export const HURT_HALF_W = 22;            // px: half-width of the sim hurtbox
const D2R = Math.PI / 180;

export function toWorldX(px) {
  return (px - config.canvas.w / 2) * PX;
}

export function toWorldY(py) {
  return (config.floorY - py) * PX;
}

// Skeleton landmarks in sim pixels, y up from the feet.
export const SKELETON = {
  headY: 146, shoulderY: 126, hipY: 76,
  shoulderX: 14, hipX: 8,
  armUpper: 26, armFore: 22,
  legThigh: 38, legShin: 34,
};

// The 2D pose model: angle 0 = limb hanging straight down, +90 = pointing
// toward the facing direction. Arm bend folds forward (angle + bend); knees
// fold backward (angle - bend). Torso/head angles lean forward when positive.
// In 3D the fighter faces +x when facing = 1, so every rotation about z is
// multiplied by facing.
export function jointAngles(pose, facing = 1) {
  const f = facing >= 0 ? 1 : -1;
  return {
    torso: -(pose.torsoAngle || 0) * D2R * f,
    head: -(pose.headAngle || 0) * D2R * f,
    frontArm: (pose.frontArmAngle || 0) * D2R * f,
    frontFore: (pose.frontArmBend ?? 45) * D2R * f,
    backArm: (pose.backArmAngle || 0) * D2R * f,
    backFore: (pose.backArmBend ?? 45) * D2R * f,
    frontLeg: (pose.frontLegAngle || 0) * D2R * f,
    frontShin: -(pose.frontLegBend ?? 8) * D2R * f,
    backLeg: (pose.backLegAngle || 0) * D2R * f,
    backShin: -(pose.backLegBend ?? 8) * D2R * f,
    bodyY: -(pose.bodyY || 0) * PX,   // canvas bodyY is positive downwards
  };
}
