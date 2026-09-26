export const REST = {
  torsoAngle: 0,
  headAngle: 0,
  frontArmAngle: 20,
  backArmAngle: -20,
  frontArmBend: 45,
  backArmBend: 45,
  frontLegAngle: 8,
  backLegAngle: -8,
  frontLegBend: 8,
  backLegBend: 8,
  bodyY: 0,
};

export function lerpPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k] ?? REST[k] ?? 0;
    const bv = b[k] ?? REST[k] ?? 0;
    out[k] = av + (bv - av) * t;
  }
  return out;
}
