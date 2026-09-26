// Runtime asset loading from Poly Haven (CC0): HDRI panoramas for lighting,
// tonemapped 8k JPGs for the visible backdrop, PBR texture sets for floors
// and glTF props. Everything is cached by URL.
import * as THREE from 'three';
import { graphics } from './graphics.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PH = 'https://dl.polyhaven.org/file/ph-assets';
export const urls = {
  hdr: (id, res = '1k') => `${PH}/HDRIs/hdr/${res}/${id}_${res}.hdr`,
  tonemapped: (id) => `${PH}/HDRIs/extra/Tonemapped%20JPG/${id}.jpg`,
  tex: (id, kind, res = '1k') => `${PH}/Textures/jpg/${res}/${id}/${id}_${kind}_${res}.jpg`,
  model: (id, res = '1k') => `${PH}/Models/gltf/${res}/${id}/${id}_${res}.gltf`,
};

const cache = new Map();
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
const rgbeLoader = new RGBELoader();
rgbeLoader.setCrossOrigin('anonymous');
// Poly Haven keeps a model's textures under Models/jpg/<res>/<id>/, not next
// to the glTF, so rewrite the glTF's relative texture URIs to that location.
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  const m = url.match(/\/Models\/gltf\/(\w+)\/([^/]+)\/textures\/([^/?]+)$/);
  return m ? `${PH}/Models/jpg/${m[1]}/${m[2]}/${m[3]}` : url;
});
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setCrossOrigin('anonymous');

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
}

export function loadTexture(url, { srgb = false, repeat = 1, anisotropy = 8 } = {}) {
  return cached(url, () => texLoader.loadAsync(url).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = anisotropy;
    return t;
  }));
}

export function loadEquirect(url, { srgb = true } = {}) {
  return cached(`eq:${url}`, () => texLoader.loadAsync(url).then((t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    return t;
  }));
}

export function loadHDR(url) {
  return cached(url, () => rgbeLoader.loadAsync(url).then((t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }));
}

export function loadPBR(id, { anisotropy = 16, resolution = graphics.textureSize } = {}) {
  return cached(`pbr:${id}:${resolution}`, () => Promise.all([
    loadTexture(urls.tex(id, 'diff', resolution), { srgb: true, anisotropy }),
    loadTexture(urls.tex(id, 'nor_gl', resolution), { anisotropy }),
    loadTexture(urls.tex(id, 'rough', resolution), { anisotropy }),
  ]).then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap })));
}

export function loadModel(id) {
  return cached(`gltf:${id}`, () => gltfLoader.loadAsync(urls.model(id)).then((g) => {
    g.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material && o.material.map) o.material.map.anisotropy = 8;
      }
    });
    return g.scene;
  }));
}

// Deep clone that keeps materials shared (props repeat a lot).
export function instance(scene) {
  return scene.clone(true);
}
