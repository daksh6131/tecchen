// Hit effects: additive spark particles, shockwave rings, landing dust,
// contact-shadow blobs, camera shake and the post-grade hit pulse.
import * as THREE from 'three';

const MAX_SPARKS = 600;

const sparkVert = /* glsl */`
  attribute float aLife;
  attribute float aSize;
  attribute vec3 aColor;
  varying float vLife;
  varying vec3 vColor;
  void main() {
    vLife = aLife;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (220.0 / -mv.z) * (0.4 + 0.6 * aLife);
    gl_Position = projectionMatrix * mv;
  }
`;
const sparkFrag = /* glsl */`
  varying float vLife;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float core = smoothstep(0.5, 0.0, r);
    float hot = smoothstep(0.22, 0.0, r);
    vec3 c = mix(vColor, vec3(1.0), hot * 0.85) * (core * 2.4);
    gl_FragColor = vec4(c * vLife, core * vLife);
  }
`;

function makeSparks(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_SPARKS * 3);
  const life = new Float32Array(MAX_SPARKS);
  const size = new Float32Array(MAX_SPARKS);
  const col = new Float32Array(MAX_SPARKS * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: sparkVert, fragmentShader: sparkFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const vel = new Float32Array(MAX_SPARKS * 3);
  const maxLife = new Float32Array(MAX_SPARKS);
  let cursor = 0;
  return {
    emit(x, y, z, n, color, speed, up = 0.5) {
      const c = new THREE.Color(color);
      for (let k = 0; k < n; k++) {
        const i = cursor++ % MAX_SPARKS;
        const a = Math.random() * Math.PI * 2;
        const el = (Math.random() - 0.3) * Math.PI * 0.8;
        const sp = speed * (0.4 + Math.random());
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel[i * 3] = Math.cos(a) * Math.cos(el) * sp;
        vel[i * 3 + 1] = Math.sin(el) * sp + up;
        vel[i * 3 + 2] = Math.sin(a) * Math.cos(el) * sp * 0.6;
        maxLife[i] = 0.25 + Math.random() * 0.35;
        life[i] = 1;
        size[i] = 0.5 + Math.random() * 1.2;
        const tint = c.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.25);
        col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b;
      }
    },
    update(dt) {
      for (let i = 0; i < MAX_SPARKS; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt / maxLife[i];
        if (life[i] < 0) { life[i] = 0; pos[i * 3 + 1] = -10; continue; }
        vel[i * 3 + 1] -= 14 * dt;
        vel[i * 3] *= 0.97; vel[i * 3 + 2] *= 0.97;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.01) { pos[i * 3 + 1] = 0.01; vel[i * 3 + 1] *= -0.45; }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
    },
  };
}

const ringFrag = /* glsl */`
  uniform vec3 color; uniform float life;
  varying vec2 vUv;
  void main() {
    float d = abs(vUv.y - 0.5) * 2.0;
    float edge = smoothstep(1.0, 0.2, d);
    gl_FragColor = vec4(color * 3.0 * edge * life, edge * life);
  }
`;
const ringVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function makeRings(scene) {
  const pool = [];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xffffff) }, life: { value: 0 } },
      vertexShader: ringVert, fragmentShader: ringFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 64), mat);
    m.visible = false;
    scene.add(m);
    pool.push({ m, t: 0, dur: 0.4, flat: false, size: 1 });
  }
  let cursor = 0;
  return {
    burst(x, y, z, color, { size = 1.2, dur = 0.38, flat = false } = {}) {
      const r = pool[cursor++ % pool.length];
      r.m.visible = true;
      r.m.position.set(x, y, z);
      r.m.rotation.set(flat ? Math.PI / 2 : 0, 0, 0);
      r.m.material.uniforms.color.value.set(color);
      r.t = 0; r.dur = dur; r.size = size;
    },
    update(dt) {
      for (const r of pool) {
        if (!r.m.visible) continue;
        r.t += dt;
        const k = r.t / r.dur;
        if (k >= 1) { r.m.visible = false; continue; }
        const e = 1 - Math.pow(1 - k, 3);
        r.m.scale.setScalar(0.15 + e * r.size);
        r.m.material.uniforms.life.value = 1 - k;
      }
    },
  };
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(200,205,220,0.6)');
  grd.addColorStop(1, 'rgba(200,205,220,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createFX(scene) {
  const group = new THREE.Group();
  group.name = 'fx';
  scene.add(group);
  const sparks = makeSparks(group);
  const rings = makeRings(group);

  const blobTex = blobTexture();
  const blobs = [0, 1].map(() => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.0),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.45 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.renderOrder = 1;
    group.add(m);
    return m;
  });

  const dustTex = dustTexture();
  const dust = [];
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    group.add(s);
    dust.push({ s, t: 0, vx: 0, vy: 0 });
  }
  let dustCursor = 0;

  let shakeT = 0, shakeMag = 0;
  let pulse = 0;      // post-grade hit pulse 0..1
  let flash = 0;      // screen flash 0..1

  return {
    sparks, rings, group,

    hit(x, y, z, { heavy, blocked, launched, color }) {
      if (blocked) {
        sparks.emit(x, y, z, 14, 0x7fd4f0, 3.2, 0.8);
        rings.burst(x, y, z, 0x7fd4f0, { size: 0.5, dur: 0.22 });
        shakeT = 0.1; shakeMag = 0.02;
        pulse = Math.max(pulse, 0.25);
        return;
      }
      sparks.emit(x, y, z, heavy ? 60 : 30, color, heavy ? 6.5 : 4.2, 1.2);
      sparks.emit(x, y, z, heavy ? 22 : 10, 0xffffff, heavy ? 3 : 2, 0.5);
      rings.burst(x, y, z, color, { size: heavy ? 1.3 : 0.8, dur: heavy ? 0.36 : 0.26 });
      if (launched) rings.burst(x, 0.02, z, color, { size: 1.6, dur: 0.4, flat: true });
      shakeT = heavy ? 0.26 : 0.14;
      shakeMag = heavy ? 0.09 : 0.045;
      pulse = Math.max(pulse, heavy ? 1 : 0.55);
      flash = Math.max(flash, heavy ? 0.35 : 0.12);
    },

    land(x, z) {
      for (let k = 0; k < 7; k++) {
        const d = dust[dustCursor++ % dust.length];
        d.s.visible = true;
        d.s.position.set(x + (Math.random() - 0.5) * 0.5, 0.08, z + (Math.random() - 0.5) * 0.4);
        d.s.scale.setScalar(0.25);
        d.t = 0;
        d.vx = (Math.random() - 0.5) * 2.2;
        d.vy = 0.6 + Math.random() * 0.6;
        d.s.material.opacity = 0.55;
      }
      shakeT = Math.max(shakeT, 0.08); shakeMag = Math.max(shakeMag, 0.02);
    },

    ko(x, y, z, color) {
      sparks.emit(x, y, z, 160, color, 9, 2.5);
      sparks.emit(x, y, z, 80, 0xffffff, 5, 1.5);
      rings.burst(x, y, z, 0xffffff, { size: 2.4, dur: 0.6 });
      rings.burst(x, 0.02, z, color, { size: 2.8, dur: 0.7, flat: true });
      shakeT = 0.5; shakeMag = 0.16;
      pulse = 1; flash = 0.7;
    },

    setBlob(i, x, y, z) {
      const b = blobs[i];
      b.position.x = x; b.position.z = z;
      const k = Math.max(0, 1 - y / 3);
      b.material.opacity = 0.45 * k;
      b.scale.setScalar(0.8 + 0.5 * (1 - k));
    },

    get pulse() { return pulse; },
    get flash() { return flash; },

    // returns the camera offset for this frame
    update(dt) {
      sparks.update(dt);
      rings.update(dt);
      for (const d of dust) {
        if (!d.s.visible) continue;
        d.t += dt;
        if (d.t > 0.7) { d.s.visible = false; continue; }
        d.s.position.x += d.vx * dt;
        d.s.position.y += d.vy * dt;
        d.vy -= 1.2 * dt;
        d.s.scale.addScalar(dt * 1.6);
        d.s.material.opacity = 0.55 * (1 - d.t / 0.7);
      }
      pulse = Math.max(0, pulse - dt * 3.2);
      flash = Math.max(0, flash - dt * 4.5);
      if (shakeT > 0) {
        shakeT -= dt;
        const m = shakeMag * Math.min(1, shakeT * 6);
        return new THREE.Vector3((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * m);
      }
      return null;
    },
  };
}
