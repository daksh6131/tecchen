// Arena world: one persistent scene whose dressing (sky, fog, lights, IBL,
// props, rain, floor look) is rebuilt from a stage definition.
import * as THREE from 'three';
import { graphics } from './graphics.js';
import { installSoftShadows } from '../character-models/render/soft-shadows.js';
import { createFloor } from './floor.js';
import { loadHDR, loadEquirect, loadPBR, loadModel, instance, urls } from './assets.js';

// ---------- image-based lighting ------------------------------------------
// A light-box baked into a PMREM so PBR surfaces pick up coloured specular
// highlights: accent strips on the sides, a white-ish strip behind, softbox up.
function buildEnvironment(renderer, env, accentA, accentB) {
  const scene = new THREE.Scene();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(30, 14, 30),
    new THREE.MeshStandardMaterial({ color: env.wall, roughness: 1, side: THREE.BackSide }),
  );
  box.position.y = 6;
  scene.add(box);
  const strip = (color, intensity, x, z, ry, w = 2, h = 9) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
    );
    m.position.set(x, 5, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  strip(accentA, env.a, -14.5, 0, Math.PI / 2, 3, 10);
  strip(accentB, env.b, 14.5, 0, -Math.PI / 2, 3, 10);
  strip(env.back, env.backI, 0, -14.5, 0, 12, 1.5);
  strip(env.front, env.frontI, 0, 14.5, Math.PI, 12, 1.5);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(env.top).multiplyScalar(env.topI) }),
  );
  top.position.set(0, 12.9, 0);
  top.rotation.x = Math.PI / 2;
  scene.add(top);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return tex;
}

// ---------- sky dome --------------------------------------------------------
const skyVert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.99999; // always at the far plane
  }
`;
const skyFrag = /* glsl */`
  uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
  uniform vec3 sunColor; uniform vec3 sunDir; uniform float sunSize; uniform float hasSun;
  uniform float time;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.6));
    if (hasSun > 0.5) {
      float c = max(dot(d, normalize(sunDir)), 0.0);
      float disc = smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, c);
      float glow = pow(c, 18.0) * 0.55 + pow(c, 3.0) * 0.18;
      col += sunColor * (disc * 3.0 + glow);
    } else {
      vec2 g = floor(d.xz / max(d.y, 0.05) * 60.0);
      float s = hash(g);
      float star = step(0.995, s) * smoothstep(0.1, 0.4, h) * (0.6 + 0.4 * sin(time * 2.0 + s * 60.0));
      col += vec3(star * 0.9);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function createSky(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunSize: { value: 0.05 },
      hasSun: { value: 0 }, time: { value: 0 },
    },
    vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);
  return {
    mesh,
    set(sky) {
      const u = mat.uniforms;
      u.top.value.set(sky.top); u.horizon.value.set(sky.horizon); u.bottom.value.set(sky.bottom);
      u.hasSun.value = sky.sun ? 1 : 0;
      if (sky.sun) { u.sunColor.value.set(sky.sun.color); u.sunDir.value.fromArray(sky.sun.dir); u.sunSize.value = sky.sun.size; }
    },
    update(t) { mat.uniforms.time.value = t; },
  };
}

// ---------- shared prop helpers --------------------------------------------
function neonMaterial(hex, intensity = 1.6) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) });
}
const metal = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.32, metalness: 0.7, clearcoat: 0.9, clearcoatRoughness: 0.18, ...extra,
});
const concrete = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });

function box(group, w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  group.add(m);
  return m;
}

function arenaRing(group, neonA, neonB, white) {
  const edgeMat = metal(0x101218);
  for (const z of [7.5, -7.5]) {
    box(group, 24, 0.25, 0.5, edgeMat, 0, 0.125, z);
    box(group, 23.6, 0.04, 0.08, white, 0, 0.26, z + (z > 0 ? -0.2 : 0.2), false);
  }
  for (const [x, mat] of [[-12, neonA], [12, neonB]]) {
    box(group, 0.5, 0.25, 15, edgeMat, x, 0.125, 0);
    box(group, 0.08, 0.04, 14.6, mat, x + (x < 0 ? 0.2 : -0.2), 0.26, 0, false);
  }
}

function skyline(group, { windowColor = 0xffd9a0, windowI = 1.1, count = 160, windows = 900, near = 28 } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, concrete(0x090a10), count);
  const dummy = new THREE.Object3D();
  for (let k = 0; k < count; k++) {
    const h = 4 + Math.random() * 22;
    const w = 2 + Math.random() * 5;
    dummy.position.set((Math.random() - 0.5) * 120, h / 2, -near - Math.random() * 40);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    inst.setMatrixAt(k, dummy.matrix);
  }
  group.add(inst);
  const wmat = new THREE.MeshBasicMaterial({ color: new THREE.Color(windowColor).multiplyScalar(windowI) });
  const win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.5), wmat, windows);
  for (let k = 0; k < windows; k++) {
    dummy.position.set((Math.random() - 0.5) * 120, 1 + Math.random() * 22, -near + 0.1 - Math.random() * 40);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    win.setMatrixAt(k, dummy.matrix);
  }
  group.add(win);
}

// ---------- stage props -----------------------------------------------------
function column(group, x, z, h, accentMat) {
  box(group, 0.9, h, 0.9, metal(0x14161c), x, h / 2, z);
  box(group, 0.06, h * 0.86, 0.06, accentMat, x + (x < 0 ? 0.48 : -0.48), h / 2, z + 0.48, false);
  box(group, 1.3, 0.16, 1.3, accentMat, x, h + 0.08, z, false);
}

function buildDojo(group, { neonA, neonB, white }) {
  arenaRing(group, neonA, neonB, white);
  for (let i = -3; i <= 3; i++) {
    const x = i * 4.2;
    column(group, x, -9.5, 6.5 + (Math.abs(i) % 2) * 1.2, x < 0 ? neonA : (x > 0 ? neonB : white));
  }
  for (let i = -2; i <= 2; i++) column(group, i * 6.5 + 3.2, -15.5, 9, i < 0 ? neonA : neonB);
  box(group, 18, 0.8, 1.2, metal(0x0d0f15), 0, 8.2, -12);
  box(group, 8.6, 0.12, 0.12, neonA, -4.5, 7.75, -11.4, false);
  box(group, 8.6, 0.12, 0.12, neonB, 4.5, 7.75, -11.4, false);
  for (const [r, t] of [[2.4, 0.09], [1.6, 0.05]]) {
    const seal = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 80), white);
    seal.position.set(0, 4.6, -12.3);
    group.add(seal);
  }
  for (const [x, mat] of [[-13.5, neonA], [13.5, neonB]]) {
    for (let k = 0; k < 3; k++) {
      box(group, 0.1, 5, 0.1, mat, x + k * (x < 0 ? -0.6 : 0.6), 3.5 + k * 0.4, -4 - k * 1.5, false);
    }
  }
  skyline(group);
}



// ---------- prop placement helpers -----------------------------------------
const bbox = (o) => new THREE.Box3().setFromObject(o);
// scale so the largest dimension equals `size` metres
function fit(o, size) {
  const d = bbox(o).getSize(new THREE.Vector3());
  const m = Math.max(d.x, d.y, d.z) || 1;
  o.scale.multiplyScalar(size / m);
}
// rest the object on y = base
function ground(o, base = 0) {
  o.updateMatrixWorld(true);
  o.position.y += base - bbox(o).min.y;
}
function placer(group, models) {
  return (id, x, z, ry = 0, { size, s = 1, y = 0, sit = true, rx = 0, rz = 0 } = {}) => {
    if (!models[id]) return null;
    const o = instance(models[id]);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.scale.setScalar(s);
    if (size) fit(o, size);
    group.add(o);
    if (sit) ground(o, y);
    return o;
  };
}
function topOf(o) { return o ? bbox(o).max.y : 0.75; }

// ---------- photographic stages -------------------------------------------
// Chain-link fence texture drawn once on a canvas: alpha mask + light wire.
function chainLinkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(210,215,225,1)';
  g.lineWidth = 5;
  g.lineCap = 'round';
  const cell = 64;
  for (let y = -cell; y <= 256 + cell; y += cell) {
    for (let x = -cell; x <= 256 + cell; x += cell) {
      g.beginPath();
      g.moveTo(x, y + cell / 2); g.lineTo(x + cell / 2, y); g.lineTo(x + cell, y + cell / 2); g.lineTo(x + cell / 2, y + cell); g.closePath();
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

async function buildColosseum(group, { models, textures }) {
  const place = placer(group, models);
  const stone = new THREE.MeshStandardMaterial({
    map: textures.stone.map, normalMap: textures.stone.normalMap, roughnessMap: textures.stone.roughnessMap,
    roughness: 1, metalness: 0,
  });
  // fallen travertine blocks like the ones in the piazza
  const blocks = [[-8.5, -5.5, 1.4, 0.9, 1.2, 0.3], [-10.2, -3.8, 1.1, 0.7, 1.0, -0.4], [9.3, -6, 1.6, 1.0, 1.3, 0.2],
    [10.8, -4.2, 1.2, 0.8, 0.9, 0.9], [-9.6, 5.2, 1.3, 0.8, 1.1, 0.5], [9.8, 5.6, 1.5, 0.9, 1.2, -0.6]];
  for (const [x, z, w, h, d, ry] of blocks) {
    const m = box(group, w, h, d, stone, x, h / 2 - 0.04, z);
    m.rotation.y = ry;
  }
  // low stone kerb ring marking the fighting ground
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = 9.2;
    const m = box(group, 1.9, 0.28, 0.55, stone, Math.cos(a) * r, 0.14, Math.sin(a) * r * 0.85);
    m.rotation.y = -a;
  }
  // monuments: busts on pedestals flanking a central statue
  for (const x of [-4.2, 4.2]) {
    box(group, 0.7, 1.3, 0.7, stone, x, 0.65, -7.6);
    place('marble_bust_01', x, -7.6, x < 0 ? 0.35 : -0.35, { y: 1.3, size: 0.9 });
  }
  box(group, 1.4, 1.5, 1.4, stone, 0, 0.75, -9.2);
  place('gothic_statue', 0, -9.2, 0, { y: 1.5, size: 2.4 });
  for (const x of [-6.6, 6.6]) place('ceramic_vase_03', x, -8.1, Math.random() * 3, { size: 0.9 });
  // fire pits with live flame light
  for (const x of [-8.2, 8.2]) {
    place('stone_fire_pit', x, -3.6, Math.random() * 3, { size: 1.5 });
    const flame = new THREE.PointLight(0xff7a2a, 40, 12, 2);
    flame.position.set(x, 0.9, -3.6);
    flame.userData.flicker = Math.random() * 10;
    group.add(flame);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), neonMaterial(0xff9a3a, 2.5));
    ember.position.set(x, 0.55, -3.6);
    ember.scale.y = 1.7;
    group.add(ember);
  }
  // boulders, crates, buckets and greenery around the edge
  place('boulder_01', -11.5, 1.8, 0.4, { size: 2.2 });
  place('rock_07', 10.8, 2.9, 1.1, { size: 1.6 });
  place('namaqualand_boulder_02', -9.8, -1.2, 2.0, { size: 1.4 });
  place('wooden_crate_01', -8.9, 4.0, 0.3);
  place('wooden_crate_01', -8.3, 4.9, -0.5, { s: 0.85 });
  place('wooden_military_crate', 9.1, 4.6, 0.9);
  place('wooden_bucket_01', 7.7, 5.1, 0);
  place('kite_shield', -8.1, 3.3, 2.6, { rx: 0.35 });
  for (const [x, z] of [[-12.5, -6], [12.2, -5.2], [-13.2, 4.2], [13, 6.2], [-6.5, -11]]) place('shrub_02', x, z, Math.random() * 6, { size: 1.3 });
  place('dead_tree_trunk_02', 12.6, -9.5, 0.6, { size: 4.5 });
}

async function buildOctagon(group, { models }) {
  const N = 8;
  const R = 6.6;                   // circumradius: fighters are clamped to |x| <= 5.6
  const H = 1.95;
  const pad = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.55, metalness: 0.0, clearcoat: 0.4, clearcoatRoughness: 0.5 });
  const padRed = new THREE.MeshPhysicalMaterial({ color: 0x8b0f14, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.4 });
  const chrome = metal(0x9aa0a8, { roughness: 0.25, metalness: 1 });
  const link = chainLinkTexture();
  const fence = new THREE.MeshStandardMaterial({
    map: link, alphaMap: link, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    color: 0x6e737c, roughness: 0.45, metalness: 0.8,
  });
  const verts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.PI / N;
    verts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
  }
  for (let i = 0; i < N; i++) {
    const a = verts[i], b = verts[(i + 1) % N];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    const front = mid.z > 2.0;   // the broadcast side: open so the camera sees in
    // chain-link panel
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 0.45), fence);
    panel.material.map.repeat.set(len / 0.3, (H - 0.45) / 0.3);
    panel.position.set(mid.x, 0.45 + (H - 0.45) / 2, mid.z);
    panel.rotation.y = -ang;
    panel.castShadow = true;
    if (!front) group.add(panel);
    // padded top rail and bottom skirt
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 12), pad);
    rail.rotation.z = Math.PI / 2; rail.rotation.y = -ang;
    rail.position.set(mid.x, H, mid.z);
    rail.castShadow = true;
    if (!front) group.add(rail);
    const skirt = box(group, len, 0.45, 0.08, i % 2 ? pad : padRed, mid.x, 0.225, mid.z);
    skirt.rotation.y = -ang;
    skirt.visible = !front;
    // post with padding; the camera-side posts are left out so nothing stands between the lens and the mat
    if (a.z < 2.0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H + 0.1, 10), chrome);
      post.position.set(a.x, (H + 0.1) / 2, a.z);
      group.add(post);
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, H - 0.3, 14), pad);
      cover.position.set(a.x, H / 2 + 0.1, a.z);
      cover.castShadow = true;
      group.add(cover);
    }
  }
  // octagon outline on the mat + logo ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.55, R - 0.2, N, 1, Math.PI / N), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
  group.add(ring);
  const inner = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.55, 64), new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.6 }));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.006;
  group.add(inner);
  // raised platform edge under the mat
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.9, R + 1.1, 0.5, N, 1, false, Math.PI / N), new THREE.MeshPhysicalMaterial({ color: 0x0d0d10, roughness: 0.4, clearcoat: 0.6 }));
  plat.position.y = -0.25;
  plat.receiveShadow = true;
  group.add(plat);
  // corner spot rigs above the cage
  const rig = metal(0x1a1c20);
  for (let i = 2; i < 4; i++) {          // rear corners only; the front pair would cross the camera
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 9, z = Math.sin(a) * 9;
    box(group, 0.12, 7.5, 0.12, rig, x, 3.75, z, false);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.5, 14), rig);
    head.position.set(x * 0.92, 7.4, z * 0.92);
    head.lookAt(0, 1, 0);
    head.rotateX(Math.PI / 2);
    group.add(head);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), neonMaterial(0xffffff, 6));
    lens.position.set(x * 0.9, 7.2, z * 0.9);
    lens.lookAt(0, 1, 0);
    group.add(lens);
  }

  // cageside: stools, buckets, water, camera crews, barriers, and seating
  const place = placer(group, models);
  place('metal_stool_03', -7.35, 1.3, 0.4);
  place('metal_stool_03', 7.35, -1.3, 3.5);
  place('wooden_bucket_02', -7.7, 1.9, 0);
  place('wooden_bucket_02', 7.8, -2.0, 0);
  place('plastic_bottle_gallon', -8.0, 1.0, 0.3);
  place('plastic_bottle_gallon', 8.1, -0.6, 1.2);
  place('WetFloorSign_01', 8.6, 3.4, -0.6);
  place('plastic_crate_01', -10.2, -3.0, 0.2);
  place('plastic_crate_01', -10.2, -3.0, 0.2, { y: 0.32 });
  place('Megaphone_01', -9.4, -4.2, 1.0, { y: 0.9 });
  // camera operators' tripods
  const tripodMat = metal(0x1a1a1c, { roughness: 0.5 });
  for (const [x, z] of [[-10.2, -5.6], [10.2, -5.6]]) {
    for (let k = 0; k < 3; k++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), tripodMat);
      const a = k * 2.094;
      leg.position.set(x + Math.cos(a) * 0.3, 0.8, z + Math.sin(a) * 0.3);
      leg.rotation.set(Math.sin(a) * 0.37, 0, -Math.cos(a) * 0.37);
      group.add(leg);
    }
    place('vintage_video_camera', x, z, Math.atan2(x, -z) + Math.PI, { y: 1.55, size: 0.5, sit: false });
  }
  // crowd barriers between the cage and the seats
  // barriers and seating sit behind the cage (−Z), never on the camera side
  for (let i = -3; i <= 3; i++) {
    const a = Math.PI * 1.5 + (i / 7) * Math.PI * 1.1;
    const r = 9.4;
    place('concrete_road_barrier_02', Math.cos(a) * r, Math.sin(a) * r, -a + Math.PI / 2);
  }
  // rows of cageside seats behind the barriers
  for (let row = 0; row < 3; row++) {
    const r = 10.8 + row * 1.15;
    const n = 12 + row * 3;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 1.5 + ((i + 0.5) / n - 0.5) * Math.PI * 1.15;
      const c = place('plastic_monobloc_chair_01', Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2, { y: row * 0.28 });
      if (c && Math.random() < 0.15) c.rotation.y += (Math.random() - 0.5) * 0.6;
    }
    box(group, 20, 0.28, 1.2, new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.8 }), 0, row * 0.28 - 0.14, -r, false).visible = false;
  }
  // security cameras on the lighting rig posts
  for (let i = 2; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    place('security_camera_01', Math.cos(a) * 9, Math.sin(a) * 9, -a + Math.PI, { y: 5.2, sit: false });
  }
  // white plastic and bare concrete blow out under the show lights: pull them down once
  group.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color || o.material.userData.dimmed) return;
    const c = o.material.color;
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    if (lum > 0.45 && !o.material.emissive?.getHex?.()) {
      c.multiplyScalar(0.42 / lum);
      if ('envMapIntensity' in o.material) o.material.envMapIntensity = 0.35;
    }
    o.material.userData.dimmed = true;
  });
}

async function buildOffice(group, { models }) {
  const place = placer(group, models);
  const deskTop = topOf(models.metal_office_desk ? instance(models.metal_office_desk) : null);
  // cubicle partitions: fabric panels, some knocked over
  const fabric = new THREE.MeshStandardMaterial({ color: 0x6d6f6a, roughness: 0.95 });
  const frame = metal(0x3a3d42, { roughness: 0.6, metalness: 0.5 });
  const panel = (x, z, ry, len = 1.8, h = 1.5, tilt = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.set(tilt, ry, 0);
    box(g, len, h, 0.06, fabric, 0, h / 2, 0);
    box(g, len + 0.04, 0.05, 0.1, frame, 0, h + 0.02, 0);
    box(g, 0.05, h, 0.1, frame, -len / 2, h / 2, 0);
    box(g, 0.05, h, 0.1, frame, len / 2, h / 2, 0);
    group.add(g);
  };
  const rows = [-4.2, -6.4];
  let k = 0;
  for (const z of rows) {
    for (let i = -3; i <= 3; i++) {
      const x = i * 2.4;
      panel(x, z - 1.0, 0);
      if (i < 3) panel(x + 1.2, z - 0.1, Math.PI / 2);
      place('metal_office_desk', x, z, 0);
      place('SchoolChair_01', x + (Math.random() - 0.5) * 0.6, z + 0.9, Math.PI + (Math.random() - 0.5) * 1.2);
      k++;
      if (k % 3 === 0) {
        place('classic_laptop', x + 0.1, z - 0.1, (Math.random() - 0.5) * 0.5, { y: deskTop, sit: false });
      } else {
        // CRT-era monitor: dark slab with a dim terminal glow
        box(group, 0.55, 0.36, 0.04, metal(0x111214, { roughness: 0.4 }), x, deskTop + 0.28, z - 0.25);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), neonMaterial(Math.random() < 0.6 ? 0x1c2a1e : 0x3aff7a, Math.random() < 0.6 ? 0.6 : 1.4));
        screen.position.set(x, deskTop + 0.28, z - 0.225);
        screen.userData.blink = Math.random() * 6;
        group.add(screen);
        box(group, 0.16, 0.2, 0.16, metal(0x111214), x, deskTop + 0.1, z - 0.25);
      }
      if (k % 2 === 0) place('office_notepads', x - 0.5, z + 0.15, Math.random(), { y: deskTop, sit: false });
      else place('stationery_supplies', x + 0.5, z + 0.1, Math.random(), { y: deskTop, sit: false });
    }
  }
  // the wreckage near the fighting floor
  panel(-8.2, 2.5, 0.3, 1.8, 1.5, -Math.PI / 2 + 0.15);
  panel(8.6, -1.5, 1.2);
  for (const [x, z, ry, s] of [[-7.8, -1.6, 0.4, 1], [-7.2, -1.9, -0.3, 0.8], [7.9, 2.4, 0.9, 1], [8.4, 1.6, 0.2, 0.7], [-8.9, 4.4, 1.4, 0.9]]) {
    place('cardboard_box_01', x, z, ry, { s });
  }
  place('plastic_crate_02', -11, -1.2, 0.3);
  place('plastic_crate_02', -11, -1.2, 0.1, { y: 0.34 });
  place('metal_trash_can', -9.6, -0.2, 0.4);
  place('metal_trash_can', 9.4, 4.6, 1.9);
  for (const [x, z] of [[-8.3, 1.4], [-8.9, 2.2], [8.6, -0.9], [9.3, 5.4]]) place('trashbag', x, z, Math.random() * 6);
  place('modular_electric_cables', -3.5, -2.8, 0.2);
  place('modular_electric_cables', 4.5, -3.1, 2.9);
  place('WetFloorSign_01', 6.2, 2.2, -0.4);
  place('korean_fire_extinguisher_01', -7.6, -3.2, 0.6);
  place('potted_plant_02', -7.1, -2.4, 0.4);
  place('potted_plant_02', 7.6, -3.1, 2.1);
  place('wooden_bookshelf_worn', -11.2, -5.5, Math.PI / 2);
  place('worn_metal_rack', 11.2, -5.2, -Math.PI / 2);
  place('drawer_cabinet', -1.2, -3.2, 0);
  place('drawer_cabinet', 5.4, -5.3, 0);
  place('ladder_sectioned_01', 10.4, -8.6, 0.5, { rz: 0.28 });
  place('wheelchair_01', -10.6, 1.6, 2.4);
  place('modern_arm_chair_01', 9.2, 0.6, 1.9, { rz: Math.PI / 2, y: 0.4 });
  // fluorescent fixtures hanging from a broken drop ceiling; some flicker
  const ceil = new THREE.MeshStandardMaterial({ color: 0x9a9c98, roughness: 0.9 });
  box(group, 34, 0.12, 26, ceil, 0, 3.6, -2, false);
  const gridMat = metal(0x5c5f63, { roughness: 0.7 });
  for (let i = -8; i <= 8; i++) box(group, 0.04, 0.04, 26, gridMat, i * 2, 3.53, -2, false);
  for (let j = -6; j <= 6; j++) box(group, 34, 0.04, 0.04, gridMat, 0, 3.53, j * 2 - 2, false);
  for (let i = -2; i <= 2; i++) {
    for (const z of [1.5, -3.5, -8]) {
      const fx = place('mounted_fluorescent_lights', i * 5.5, z, 0, { y: 3.45, sit: false, rz: Math.PI + (Math.random() < 0.25 ? 0.35 : 0) });
      const tube = new THREE.PointLight(0xd9f2df, Math.random() < 0.3 ? 0 : 3.5, 9, 2);
      tube.position.set(i * 5.5, 3.2, z);
      if (Math.random() < 0.35) tube.userData.flicker = Math.random() * 10;
      group.add(tube);
      if (fx) fx.castShadow = false;
    }
  }
  for (const [x, z] of [[-12, -2], [12, -2]]) place('security_camera_01', x, z, x < 0 ? -1.2 : 1.2, { y: 3.3, sit: false });
  // water stains on the ceiling
  const stain = new THREE.MeshStandardMaterial({ color: 0x5a5245, roughness: 1, transparent: true, opacity: 0.6 });
  for (const [x, z, r] of [[-5, -4, 2.2], [6, 0, 1.6], [2, -7, 2.8]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 24), stain);
    d.rotation.x = Math.PI / 2; d.position.set(x, 3.53, z);
    group.add(d);
  }
}

const BUILDERS = { dojo: buildDojo, colosseum: buildColosseum, octagon: buildOctagon, office: buildOffice };

// ---------- rain ------------------------------------------------------------
function createRain(scene) {
  const N = 1600;
  const pos = new Float32Array(N * 6);
  const vel = new Float32Array(N);
  const box = { x: 26, y: 14, z: 18 };
  for (let i = 0; i < N; i++) {
    pos[i * 6] = (Math.random() - 0.5) * box.x;
    pos[i * 6 + 1] = Math.random() * box.y;
    pos[i * 6 + 2] = (Math.random() - 0.5) * box.z;
    vel[i] = 9 + Math.random() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x9fc8ff).multiplyScalar(1.4),
    transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  return {
    object: lines,
    update(dt, cx) {
      if (!lines.visible) return;
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const k = i * 6;
        a[k + 1] -= vel[i] * dt;
        if (a[k + 1] < 0) {
          a[k + 1] = box.y;
          a[k] = cx + (Math.random() - 0.5) * box.x;
          a[k + 2] = (Math.random() - 0.5) * box.z;
        }
        a[k + 3] = a[k] + 0.02;
        a[k + 4] = a[k + 1] + vel[i] * 0.028;
        a[k + 5] = a[k + 2];
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- world -----------------------------------------------------------
export function createWorld(renderer, { accentA = '#CC785C', accentB = '#10A37F' } = {}) {
  if (graphics.softShadows) installSoftShadows();
  // ACES keeps the arena lights punchy; AgX flattened the Octagon into a hazy pink wash.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const sky = createSky(scene);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.2);
  scene.add(hemi);

  const spot = (shadow) => {
    const l = new THREE.SpotLight(0xffffff, 100, 40, Math.PI / 4.5, 0.6, 1.6);
    if (shadow) {
      l.castShadow = true;
      l.shadow.mapSize.set(graphics.shadowSize, graphics.shadowSize);
      l.shadow.bias = -0.000025;
      l.shadow.normalBias = 0.0015;
      l.shadow.camera.near = 1;
      l.shadow.camera.far = 40;
      l.shadow.radius = 4;
    }
    scene.add(l, l.target);
    return l;
  };
  const lights = { key: spot(true), fill: spot(false), rim: spot(false), back: spot(false) };

  const floor = createFloor({ accentA, accentB });
  scene.add(floor.object);
  const rain = createRain(scene);

  const coneMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xfff1dc).multiplyScalar(0.06), transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9.5, 32, 1, true), coneMat);
  scene.add(cone);

  let props = new THREE.Group();
  scene.add(props);
  let stage = null;
  let envTex = null;
  const neonA = neonMaterial(accentA);
  const neonB = neonMaterial(accentB);
  const white = neonMaterial(0xf4f6ff, 1.1);
  const blinkers = [];
  const resolveColor = (c) => (c === 'accentA' ? accentA : (c === 'accentB' ? accentB : c));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const flickers = [];
  let loadToken = 0;

  async function loadStage(def, onProgress = () => {}) {
    const token = ++loadToken;
    stage = def;

    // fetch photographic assets first so the swap is atomic
    let assets = null;
    if (def.kind === 'hdri') {
      onProgress('panorama');
      const [hdr, bg, floorMaps, stoneMaps] = await Promise.all([
        loadHDR(urls.hdr(def.hdri, graphics.hdrSize)),
        loadEquirect(urls.tonemapped(def.hdri)),
        loadPBR(def.floor.texture),
        def.props === 'colosseum' ? loadPBR('large_sandstone_blocks_01') : null,
      ]);
      onProgress('props');
      const models = {};
      await Promise.all((def.models || []).map((id) => loadModel(id).then((m) => { models[id] = m; }).catch((e) => console.warn('model failed', id, e))));
      if (token !== loadToken) return;   // a newer stage load superseded this one
      assets = { hdr, bg, floorMaps, models, textures: { stone: stoneMaps } };
    }

    scene.remove(props);
    props.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    props = new THREE.Group();
    scene.add(props);
    blinkers.length = 0;
    flickers.length = 0;
    if (envTex) envTex.dispose();

    if (def.kind === 'hdri') {
      await BUILDERS[def.props](props, { models: assets.models, textures: assets.textures });
      sky.mesh.visible = false;
      scene.background = assets.bg;
      scene.backgroundIntensity = def.bgIntensity ?? 1.2;
      scene.backgroundRotation.set(0, def.rotation || 0, 0);
      envTex = pmrem.fromEquirectangular(assets.hdr).texture;
      scene.environment = envTex;
      scene.environmentIntensity = def.envIntensity ?? 1.0;
      scene.environmentRotation.set(0, def.rotation || 0, 0);
      scene.fog = null;
      hemi.intensity = 0;
      floor.setParams({ maps: assets.floorMaps, uvScale: def.floor.uvScale, reflBase: def.floor.reflBase, fade: def.floor.fade, wet: 0, puddle: 1 });
      rain.object.visible = false;
      cone.visible = false;
    } else {
      BUILDERS[def.props](props, { neonA, neonB, white });
      sky.mesh.visible = true;
      sky.set(def.sky);
      scene.background = null;
      scene.fog = new THREE.FogExp2(new THREE.Color(def.fog.color), def.fog.density);
      hemi.color.set(def.hemi.sky);
      hemi.groundColor.set(def.hemi.ground);
      hemi.intensity = def.hemi.intensity;
      envTex = buildEnvironment(renderer, def.env, accentA, accentB);
      scene.environment = envTex;
      scene.environmentIntensity = 0.55;
      scene.environmentRotation.set(0, 0, 0);
      floor.setParams({ ...def.floor, maps: null, fade: null });
      rain.object.visible = !!def.rain;
      cone.visible = true;
    }
    props.traverse((o) => {
      if (o.userData.blink !== undefined) blinkers.push(o);
      if (o.userData.flicker !== undefined) flickers.push({ l: o, base: o.intensity, seed: o.userData.flicker });
    });

    for (const k of Object.keys(lights)) {
      const l = lights[k];
      const d = def.lights[k];
      l.color.set(resolveColor(d.color));
      l.intensity = d.intensity;
      l.position.fromArray(d.pos);
      l.visible = d.intensity > 0;
      l.angle = d.angle ?? Math.PI / 4.5;
      l.penumbra = d.penumbra ?? 0.6;
    }
    cone.position.copy(lights.key.position).add(new THREE.Vector3(0, -4.75, 0));
    cone.lookAt(0, 0, 0);
    cone.rotateX(-Math.PI / 2);
    coneMat.color.set(resolveColor(def.lights.key.color)).multiplyScalar(0.06);
    renderer.toneMappingExposure = def.exposure ?? 0.9;
  }

  return {
    scene, floor, rain, lights,
    get stage() { return stage; },
    loadStage,
    update(dt, t, centerX) {
      floor.update(t);
      sky.update(t);
      rain.update(dt, centerX);
      for (const l of Object.values(lights)) l.target.position.set(centerX, 1, 0);
      const b = 1.5 + Math.sin(t * 2.1) * 0.12;
      neonA.color.set(accentA).multiplyScalar(b);
      neonB.color.set(accentB).multiplyScalar(b);
      for (const o of blinkers) o.visible = Math.sin(t * 3.0 + o.userData.blink) > -0.6;
      for (const f of flickers) {
        const n = Math.sin(t * 37 + f.seed) * Math.sin(t * 11.3 + f.seed * 2) * Math.sin(t * 3.1 + f.seed);
        f.l.intensity = f.base * (n > 0.15 ? 1 : (n > -0.6 ? 0.85 : 0.1));
      }
    },
  };
}
