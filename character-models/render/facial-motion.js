// Facial life for the MakeHuman rigs, which have no eyelid bones or morph
// targets: the eyes get saccades (the iris texture darts a little on the
// eyeball, with natural random dwell times) and the whole head gets a faint
// breathing sway that survives the animation mixer because it is applied to
// the eyes' material rather than to bones.
import * as THREE from 'three';

export function createFacialMotion(model) {
  const eyes = [];
  model.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (/eye/i.test(o.name) && !/brow|lash|lid/i.test(o.name) && m.map) {
        m.map = m.map.clone();          // own copy: the offset must not leak to the other fighter
        m.map.needsUpdate = true;
        eyes.push(m.map);
      }
    }
  });
  const target = new THREE.Vector2();
  const cur = new THREE.Vector2();
  let dwell = 0.6 + Math.random();
  let t = 0;
  return {
    update(dt) {
      if (!eyes.length || !(dt > 0)) return;
      t += dt;
      dwell -= dt;
      if (dwell <= 0) {
        // 70 % of saccades return near centre, the rest glance aside
        const wide = Math.random() < 0.3;
        target.set((Math.random() - 0.5) * (wide ? 0.05 : 0.018), (Math.random() - 0.5) * (wide ? 0.03 : 0.012));
        dwell = 0.4 + Math.random() * 2.4;
      }
      // saccades are fast (~40 ms); the lerp below reaches 95 % in ~50 ms
      cur.lerp(target, 1 - Math.exp(-dt * 60));
      const drift = Math.sin(t * 1.3) * 0.002;
      for (const map of eyes) map.offset.set(cur.x + drift, cur.y);
    },
    // a flinch: eyes snap shut-ward (upward roll) for a moment on a heavy hit
    flinch() { target.set(0, 0.04); dwell = 0.18; },
  };
}
