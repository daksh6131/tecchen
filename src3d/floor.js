// Rain-slicked arena floor: a true planar reflection (Reflector render target)
// sampled with a blur kernel and mixed into a procedural wet-tile surface that
// is lit by the scene's spot lights, receives their shadow maps, and fades
// into the scene fog. Puddles reflect sharply, tiles blur the reflection,
// fresnel fades it out when looking straight down.
import * as THREE from 'three';
import { graphics } from './graphics.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const vertexShader = /* glsl */`
  #include <common>
  #include <shadowmap_pars_vertex>
  #include <fog_pars_vertex>
  uniform mat4 textureMatrix;
  varying vec4 vUv4;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vNormalView;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 transformedNormal = normalMatrix * normal;
    vWorldPos = worldPosition.xyz;
    vViewPos = mvPosition.xyz;
    vNormalView = normalize(transformedNormal);
    vUv4 = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <shadowmap_vertex>
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  #include <common>
  #include <packing>
  #include <bsdfs>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <fog_pars_fragment>
  uniform sampler2D tDiffuse;
  uniform vec3 color;
  uniform float time;
  uniform vec3 accentA;
  uniform vec3 accentB;
  uniform float wet;
  uniform float puddleLevel;
  uniform vec3 tint;
  uniform float useMaps;
  uniform sampler2D map;
  uniform sampler2D normalMap;
  uniform sampler2D roughnessMap;
  uniform float uvScale;
  uniform float reflBase;
  uniform float fadeStart;
  uniform float fadeEnd;
  varying vec4 vUv4;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vNormalView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; }
    return v;
  }

  uniform float reflLodMax;
  uniform vec2 reflSize;
  vec3 sampleReflection(vec2 offset, float lod) {
    vec4 uv = vUv4;
    uv.xy += offset * uv.w;
    return texture2DProjLodEXT(tDiffuse, uv, lod).rgb;
  }

  void main() {
    vec2 p = vWorldPos.xz;

    // tiles: 1.2 m slabs with dark grout, subtle per-tile tone variation
    vec2 tileId = floor(p / 1.2);
    vec2 tileUv = fract(p / 1.2);
    float grout = smoothstep(0.0, 0.03, tileUv.x) * smoothstep(0.0, 0.03, tileUv.y)
                * smoothstep(0.0, 0.03, 1.0 - tileUv.x) * smoothstep(0.0, 0.03, 1.0 - tileUv.y);
    float tone = 0.85 + 0.3 * hash(tileId);
    float grain = fbm(p * 6.0) * 0.25;

    // puddle mask: large-scale fbm, drifting slowly
    float pud = fbm(p * 0.55 + vec2(0.0, time * 0.02));
    float puddle = smoothstep(puddleLevel, puddleLevel + 0.14, pud) * (0.35 + 0.65 * wet);
    // ripples inside puddles
    float ripple = sin(dot(p, vec2(23.0, 17.0)) + time * 4.0) * sin(dot(p, vec2(-13.0, 29.0)) - time * 3.0);
    vec2 distort = vec2(ripple) * 0.0025 * puddle;

    // roughness: tiles blurry, puddles mirror, grout rough
    float rough = mix(0.5, 0.02, puddle);
    rough = mix(0.9, rough, grout);
    rough = mix(rough, rough * 0.4, wet);

    // textured mode: real PBR maps replace the procedural slab look
    vec2 tuv = p * uvScale;
    vec3 mapAlbedo = vec3(0.0);
    vec3 mapNormalW = vec3(0.0, 1.0, 0.0);
    float mapRough = 0.8;
    if (useMaps > 0.5) {
      mapAlbedo = texture2D(map, tuv).rgb;
      vec3 nm = texture2D(normalMap, tuv).xyz * 2.0 - 1.0;
      // gentle normal map: at the fight camera's grazing angle a full-strength
      // per-tile tilt flips whole tiles bright/dark in stepped blocks
      mapNormalW = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(vec3(nm.x, nm.z * 1.6, -nm.y)), 0.25));
      mapRough = texture2D(roughnessMap, tuv).r;
      rough = mapRough;
      puddle = 0.0;
      grout = 1.0;
    }

    // blurred projective reflection: roughness picks a mip of the reflection
    // (a wide, smooth pre-filtered blur) and a per-pixel-rotated 8-tap disc
    // softens the mip interpolation so neither a tap grid nor a texel grid
    // shows through at grazing angles.
    // one mip finer than the roughness asks for, with the disc spanning about
    // two of that mip's texels: the taps blend across the texel grid instead
    // of magnifying it, so no blocks appear at grazing angles.
    float lod = max(0.0, sqrt(rough) * reflLodMax - 1.0);
    float r = 2.0 * exp2(lod) / reflSize.x;
    float ang = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
    vec3 refl = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float rad = sqrt((fi + 0.5) / 8.0);
      float a = fi * 2.399963;
      vec2 o = rot * (vec2(cos(a), sin(a)) * rad * r) + distort;
      refl += sampleReflection(o, lod);
    }
    refl /= 8.0;

    // view-space shading vectors
    vec3 nView = normalize(vNormalView + vec3(distort.x * 6.0, 0.0, distort.y * 6.0));
    if (useMaps > 0.5) nView = normalize(mat3(viewMatrix) * mapNormalW);
    vec3 viewDir = normalize(-vViewPos);
    // The reflection is a planar mirror of the whole floor, so its fresnel
    // uses the flat geometric normal: per-tile normal-map tilt would otherwise
    // switch the reflection on and off tile by tile at grazing angles.
    float ndv = clamp(dot(normalize(vNormalView), viewDir), 0.0, 1.0);
    float f0 = mix(0.04, 0.09, puddle);
    float fres = f0 + (1.0 - f0) * pow(1.0 - ndv, 4.0);
    float reflStrength = mix(mix(0.12, 0.35, wet), 1.0, puddle) * (0.55 + 0.45 * fres) * grout;
    if (useMaps > 0.5) reflStrength = reflBase * (1.0 - rough) * (1.0 - rough) * (0.35 + 0.65 * fres);

    // base albedo: charcoal slate with warm/cool accent bleed from the neon
    vec3 albedo = tint * tone * (1.0 + grain);
    float bleed = smoothstep(2.5, 9.0, abs(p.x));
    vec3 neon = p.x < 0.0 ? accentA : accentB;
    albedo += neon * 0.04 * bleed * grout;
    albedo = mix(vec3(0.015), albedo, grout);
    albedo *= mix(1.0, 0.55, puddle);     // wet darkening
    if (useMaps > 0.5) albedo = mapAlbedo;

    // direct lighting from the scene's spot lights, with their shadow maps
    vec3 direct = vec3(0.0);
    vec3 spec = vec3(0.0);
    float specPow = mix(24.0, 320.0, puddle) * grout + 8.0;
    #if NUM_SPOT_LIGHTS > 0
      SpotLight spotLight;
      IncidentLight directLight;
      float ndl;
      vec3 h;
      #if defined(USE_SHADOWMAP) && NUM_SPOT_LIGHT_SHADOWS > 0
        SpotLightShadow spotLightShadow;
      #endif
      #pragma unroll_loop_start
      for (int i = 0; i < NUM_SPOT_LIGHTS; i++) {
        spotLight = spotLights[ i ];
        getSpotLightInfo(spotLight, vViewPos, directLight);
        #if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS)
          spotLightShadow = spotLightShadows[ i ];
          directLight.color *= directLight.visible ? getShadow(spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ]) : 1.0;
        #endif
        ndl = max(dot(nView, directLight.direction), 0.0);
        direct += directLight.color * ndl;
        h = normalize(directLight.direction + viewDir);
        spec += directLight.color * pow(max(dot(nView, h), 0.0), specPow) * ndl;
      }
      #pragma unroll_loop_end
    #endif
    vec3 ambient = vec3(0.0);
    #if NUM_HEMI_LIGHTS > 0
      #pragma unroll_loop_start
      for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
        ambient += getHemisphereLightIrradiance(hemisphereLights[ i ], nView);
      }
      #pragma unroll_loop_end
    #endif

    vec3 lit = albedo * (direct + ambient + vec3(0.12)) * RECIPROCAL_PI;
    // textured mats (rubber, sand, carpet) are rough: their highlight scales
    // with gloss like the reflection does, instead of the wet-tile sheen that
    // washed the Octagon's foreground white at the camera's grazing angle
    float specK = mix(0.05, 0.6, puddle) * fres * 4.0;
    if (useMaps > 0.5) specK = (1.0 - rough) * (1.0 - rough) * 0.15 * fres;
    vec3 col = lit
             + refl * reflStrength * mix(0.9, 1.35, fres)
             + spec * specK;

    // spec sparkle from rain hitting the puddles
    float sparkle = pow(noise(p * 40.0 + time * 6.0), 16.0) * puddle * 0.8;
    col += vec3(sparkle);

    // guard the HDR target: a NaN or extreme value here is smeared by bloom
    // into flickering rectangular bands across the mat
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    col = clamp(col, 0.0, 1.1);   // below the bloom threshold: the mat never blooms

    // fade into the photographic ground of the panorama at distance
    float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, length(p));
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

export function createFloor({ width = 60, depth = 40, accentA, accentB }) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const reflector = new Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: Math.min(graphics.reflectionSize, Math.floor(window.innerWidth * Math.min(window.devicePixelRatio, graphics.pixelRatio))),
    textureHeight: Math.min(graphics.reflectionSize, Math.floor(window.innerHeight * Math.min(window.devicePixelRatio, graphics.pixelRatio))),
    color: 0xffffff,
    multisample: graphics.samples,
  });
  // Mipmapped reflection target: the floor shader blurs by sampling a mip
  // level chosen from surface roughness instead of spreading a tap grid.
  const target = reflector.getRenderTarget();
  target.texture.generateMipmaps = true;
  target.texture.minFilter = THREE.LinearMipmapLinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  // full roughness lands on a ~64 px-tall mip: broad but still recognisable
  const reflLodMax = Math.max(0, Math.log2(target.height) - 6);
  // AO's normal/depth prepass must not redraw or overwrite the colour reflection.
  // The panorama backdrop sits at infinity, so its bleachers and roof would
  // mirror at the wrong scale as hard stepped bands in front of the camera:
  // the reflection pass sees the backdrop at a quarter of its brightness.
  const updateReflection = reflector.onBeforeRender;
  reflector.onBeforeRender = function (renderer, scene, camera, ...rest) {
    if (scene.overrideMaterial) return;
    const bgI = scene.backgroundIntensity;
    scene.backgroundIntensity = bgI * 0.25;
    updateReflection.call(this, renderer, scene, camera, ...rest);
    scene.backgroundIntensity = bgI;
  };
  // Swap the Reflector's default material for a lit, shadow-receiving one.
  // The render target texture and the projection matrix are shared objects,
  // so onBeforeRender keeps updating them.
  const stock = reflector.material;
  const material = new THREE.ShaderMaterial({
    name: 'WetFloor',
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      THREE.UniformsLib.fog,
      {
        color: { value: new THREE.Color(0xffffff) },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        time: { value: 0 },
        accentA: { value: new THREE.Color(accentA) },
        accentB: { value: new THREE.Color(accentB) },
        wet: { value: 1.0 },
        puddleLevel: { value: 0.52 },
        tint: { value: new THREE.Color(0x0f1016) },
        useMaps: { value: 0 },
        map: { value: null },
        normalMap: { value: null },
        roughnessMap: { value: null },
        uvScale: { value: 0.5 },
        reflBase: { value: 0.2 },
        reflLodMax: { value: reflLodMax },
        reflSize: { value: new THREE.Vector2(target.width, target.height) },
        fadeStart: { value: 1000 },
        fadeEnd: { value: 1001 },
      },
    ]),
    vertexShader,
    fragmentShader,
    lights: true,
    fog: true,
    transparent: true,
  });
  material.uniforms.tDiffuse.value = stock.uniforms.tDiffuse.value;
  material.uniforms.textureMatrix.value = stock.uniforms.textureMatrix.value;
  reflector.material = material;
  stock.dispose();

  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0;
  reflector.receiveShadow = true;

  return {
    object: reflector,
    update(t) { material.uniforms.time.value = t; },
    setParams({ wet, puddle, tint, accentA: a, accentB: b, maps, uvScale, reflBase, fade }) {
      const u = material.uniforms;
      u.useMaps.value = maps ? 1 : 0;
      u.map.value = maps ? maps.map : null;
      u.normalMap.value = maps ? maps.normalMap : null;
      u.roughnessMap.value = maps ? maps.roughnessMap : null;
      if (uvScale !== undefined) u.uvScale.value = uvScale;
      if (reflBase !== undefined) u.reflBase.value = reflBase;
      u.fadeStart.value = fade ? fade[0] : 1000;
      u.fadeEnd.value = fade ? fade[1] : 1001;
      if (wet !== undefined) u.wet.value = wet;
      if (puddle !== undefined) u.puddleLevel.value = puddle;
      if (tint) u.tint.value.set(tint);
      if (a) u.accentA.value.set(a);
      if (b) u.accentB.value.set(b);
    },
  };
}
