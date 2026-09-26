import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export function createStudioPost(renderer, scene, camera) {
  renderer.shadowMap.autoUpdate = false;
  const size = renderer.getSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, size.x * dpr, size.y * dpr);
  ao.blendIntensity = .48;
  ao.updateGtaoMaterial({radius:.10, thickness:.3, scale:1, samples:16, screenSpaceRadius:false});
  ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:16});
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  return {
    resize(w,h) { composer.setSize(w,h); },
    render() { renderer.shadowMap.needsUpdate = true; composer.render(); },
  };
}
