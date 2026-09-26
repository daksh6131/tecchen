// Post stack: GTAO -> bloom -> AgX output -> grade (chromatic aberration,
// vignette, grain, flash, subtle barrel) -> SMAA.
import * as THREE from 'three';
import { graphics } from './graphics.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  name: 'Grade',
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    pulse: { value: 0 },
    flash: { value: 0 },
    vignette: { value: 0.16 },
    grain: { value: 0.003 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, pulse, flash, vignette, grain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      // subtle barrel + hit-driven zoom punch
      uv = 0.5 + c * (1.0 + 0.008 * r2 - pulse * 0.02);
      // chromatic aberration grows from the centre and with the hit pulse
      float ab = (pulse * 0.004) * (0.35 + r2 * 2.0);
      vec2 dir = normalize(c + 1e-5);
      float rr = texture2D(tDiffuse, uv + dir * ab).r;
      float gg = texture2D(tDiffuse, uv).g;
      float bb = texture2D(tDiffuse, uv - dir * ab).b;
      vec3 col = vec3(rr, gg, bb);
      // vignette
      float v = 1.0 - smoothstep(0.25, 0.85, r2 * (1.0 + vignette));
      col *= mix(1.0 - vignette * 0.9, 1.0, v);
      // filmic lift in the toe so blacks aren't crushed
      col = col * 0.992 + 0.002;
      // grain
      float g = (hash(uv * vec2(1920.0, 1080.0) + fract(time)) - 0.5) * grain;
      col += g * (0.6 + 0.4 * (1.0 - v));
      // hit flash
      col = mix(col, vec3(1.0), flash * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  renderer.shadowMap.autoUpdate = false;
  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: Math.min(graphics.samples, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.55;
  gtao.updateGtaoMaterial({
    radius: 0.18, distanceExponent: 1.5, thickness: 0.35, scale: 1.0,
    samples: graphics.aoSamples, distanceFallOff: 1.0, screenSpaceRadius: false,
  });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.14, 0.4, 1.25);
  composer.addPass(bloom);

  const output = new OutputPass();
  composer.addPass(output);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
  composer.addPass(smaa);

  gtao.setSize(Math.round(size.x * ratio * graphics.aoScale), Math.round(size.y * ratio * graphics.aoScale));

  return {
    composer, bloom, gtao, grade,
    resize(w, h) {
      composer.setSize(w, h);
      gtao.setSize(Math.round(w * renderer.getPixelRatio() * graphics.aoScale), Math.round(h * renderer.getPixelRatio() * graphics.aoScale));
      bloom.setSize(w, h);
      smaa.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    },
    render(t, pulse, flash) {
      grade.uniforms.time.value = t;
      grade.uniforms.pulse.value = pulse;
      grade.uniforms.flash.value = flash;
      renderer.shadowMap.needsUpdate = true;
      composer.render();
    },
  };
}
