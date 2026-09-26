// Studio portrait renderer for the HUD and character select: loads a rigged
// character, frames the head and shoulders in a three-quarter turn, lights it
// with a key / rim / fill rig plus a neutral room environment, and renders a
// transparent 1024px PNG. Run from the browser (portrait.html) and saved to
// assets/pfp/<id>_hud.png through the dev server's POST drop.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { refineCharacterMaterials } from '../character-models/render/character-materials.js';

export async function renderPortrait({ url, height, accent = '#ffffff', size = 1024, turn = 0.42, tilt = 0.06, zoom = 1.0, gaze = 0.0, look = -0.10, exposure = 0.82 }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  refineCharacterMaterials(model);
  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
  });
  const s = 1.75 / height;
  model.scale.setScalar(s);
  model.rotation.y = turn;
  scene.add(model);

  // head landmark for framing
  const head = new THREE.Vector3();
  let headBone = null;
  model.traverse((o) => { if (o.isBone && o.name === 'head') headBone = o; });
  model.updateMatrixWorld(true);
  if (headBone) headBone.getWorldPosition(head); else head.set(0, 1.62, 0);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  const dist = 1.25 / zoom;
  camera.position.set(head.x + Math.sin(0.18) * dist, head.y + 0.08 + tilt, head.z + Math.cos(0.18) * dist);
  camera.lookAt(head.x + gaze, head.y + look, head.z);

  const key = new THREE.SpotLight(0xffe9d2, 34, 12, Math.PI / 5, 0.5, 1.4);
  key.position.set(head.x + 1.6, head.y + 1.6, head.z + 1.4);
  key.target.position.copy(head);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.01;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight(0xcfe0ff, 9, 12, Math.PI / 4, 0.7, 1.4);
  fill.position.set(head.x - 1.8, head.y + 0.4, head.z + 1.6);
  fill.target.position.copy(head);
  scene.add(fill, fill.target);
  const rim = new THREE.SpotLight(new THREE.Color(accent), 55, 12, Math.PI / 5, 0.6, 1.4);
  rim.position.set(head.x - 1.2, head.y + 1.2, head.z - 1.8);
  rim.target.position.copy(head);
  scene.add(rim, rim.target);
  const rim2 = new THREE.SpotLight(0xffffff, 22, 12, Math.PI / 5, 0.6, 1.4);
  rim2.position.set(head.x + 1.5, head.y + 1.4, head.z - 1.6);
  rim2.target.position.copy(head);
  scene.add(rim2, rim2.target);

  renderer.render(scene, camera);
  const blob = await new Promise((res) => renderer.domElement.toBlob(res, 'image/png'));
  renderer.dispose();
  pmrem.dispose();
  return blob;
}

export async function saveBlob(path, blob) {
  const r = await fetch(`/${path}`, { method: 'POST', body: blob });
  if (!r.ok) throw new Error(`save failed: ${r.status}`);
  return r.text();
}
