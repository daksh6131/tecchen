import { REST, lerpPose } from './pose.js';

const ease = (t) => t * t * (3 - 2 * t); // smoothstep

export class Animation {
  constructor({ keyframes, durationMs, loop = false }) {
    this.keyframes = (keyframes && keyframes.length) ? keyframes : [{ tMs: 0, pose: REST }];
    this.durationMs = durationMs;
    this.loop = loop;
  }

  poseAt(clockMs) {
    const t = this.loop
      ? ((clockMs % this.durationMs) + this.durationMs) % this.durationMs
      : Math.max(0, Math.min(clockMs, this.durationMs));
    const kf = this.keyframes;
    let i = 0;
    while (i < kf.length - 1 && kf[i + 1].tMs <= t) i++;
    const a = kf[i];
    const b = kf[Math.min(i + 1, kf.length - 1)];
    if (a === b || b.tMs === a.tMs) return { ...REST, ...a.pose };
    const f = ease((t - a.tMs) / (b.tMs - a.tMs));
    return lerpPose({ ...REST, ...a.pose }, { ...REST, ...b.pose }, f);
  }
}
