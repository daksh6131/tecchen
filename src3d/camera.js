// Tekken-style side camera: tracks the midpoint, dollies out with separation,
// leans into the action slightly, and orbits the winner on KO.
import * as THREE from 'three';

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 120);
  const pos = new THREE.Vector3(0, 1.9, 8.5);
  const look = new THREE.Vector3(0, 1.0, 0);
  const target = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  let orbit = 0;
  let koFocus = null;
  let idle = false;
  let selectX = null;

  camera.position.copy(pos);
  camera.lookAt(look);

  return {
    camera,
    setKO(focusX) { koFocus = focusX; orbit = 0; },
    clearKO() { koFocus = null; },
    setIdle(v) { idle = v; if (v) orbit = 0.6; },
    setSelect(x) { selectX = x; },
    clearSelect() { selectX = null; },

    update(dt, p1x, p1y, p2x, p2y, shake) {
      const mid = (p1x + p2x) / 2;
      const sep = Math.abs(p1x - p2x);
      const high = Math.max(p1y, p2y);

      if (selectX !== null) {
        // character select: frame the chosen fighter on the left third, slow drift
        orbit += dt * 0.25;
        const sway = Math.sin(orbit) * 0.3;
        const off = 0.42 * camera.aspect;            // keep the fighter on the left third at any aspect
        target.set(selectX + off + 1.0 + sway, 1.45, 3.3);
        targetLook.set(selectX + off, 1.0, 0);
        pos.lerp(target, 1 - Math.pow(0.03, dt));
        look.lerp(targetLook, 1 - Math.pow(0.03, dt));
      } else if (idle) {
        // slow title-screen drift around the two fighters
        orbit += dt * 0.12;
        const r = 7.2;
        target.set(mid + Math.sin(orbit) * r, 1.7 + Math.sin(orbit * 0.5) * 0.3, Math.cos(orbit) * r);
        targetLook.set(mid, 1.05, 0);
        pos.lerp(target, 1 - Math.pow(0.05, dt));
        look.lerp(targetLook, 1 - Math.pow(0.05, dt));
      } else if (koFocus !== null) {
        orbit += dt * 0.55;
        const r = 4.2;
        target.set(koFocus + Math.sin(orbit) * r, 1.4 + Math.sin(orbit * 0.7) * 0.4, Math.cos(orbit) * r);
        targetLook.set(koFocus, 0.9, 0);
        pos.lerp(target, 1 - Math.pow(0.02, dt));
        look.lerp(targetLook, 1 - Math.pow(0.02, dt));
      } else {
        const dist = THREE.MathUtils.clamp(5.6 + sep * 0.62, 6.2, 10.5);
        target.set(mid, 1.55 + high * 0.25 + dist * 0.06, dist);
        targetLook.set(mid, 0.95 + high * 0.35, 0);
        pos.lerp(target, 1 - Math.pow(0.004, dt));
        look.lerp(targetLook, 1 - Math.pow(0.004, dt));
      }

      camera.position.copy(pos);
      if (shake) camera.position.add(shake);
      camera.lookAt(look);
      camera.rotation.z += shake ? shake.x * 0.6 : 0;
    },
  };
}
