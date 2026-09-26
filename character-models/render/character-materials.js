// Shared by the game and both asset previews. GLB files retain their portable
// PBR maps; this small lighting extension adds a restrained skin diffusion lobe.
import * as THREE from 'three';

export function refineCharacterMaterials(root, renderer) {
  const seen = new Set();
  const anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 8;
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'alphaMap']) {
        if (material[key]) material[key].anisotropy = Math.min(16, anisotropy);
      }
      if (material.isMeshStandardMaterial) material.envMapIntensity = 0.8;
      if (/hair|eyebrow/i.test(material.name)) {
        material.transparent = false;
        material.alphaTest = material.map ? 0.35 : 0;
        material.alphaToCoverage = true;
        material.depthWrite = true;
        material.side = THREE.DoubleSide;
        material.envMapIntensity = 0.65;
      }
      if (/eyebrow/i.test(material.name)) {
        // The legacy FBX material's scalar bump image is not a tangent normal map.
        material.normalMap = null;
        material.alphaTest = 0.12;
        material.roughness = 0.88;
      }
      if (/_skin$/.test(material.name)) {
        material.onBeforeCompile = (shader) => {
          const chunk = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
            'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
            `// Normalized, wavelength-dependent diffuse wrap: approximation of
             // shallow skin scattering. Shadows still multiply directLight.color.
             vec3 skinWrap = vec3(0.38, 0.17, 0.09);
             vec3 skinDiffuse = max(vec3(dot(geometryNormal, directLight.direction)) + skinWrap, 0.0)
               / ((1.0 + skinWrap) * (1.0 + skinWrap));
             reflectedLight.directDiffuse += mix(irradiance, directLight.color * skinDiffuse, 0.22)
               * BRDF_Lambert(material.diffuseColor);`
          );
          shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
        };
        material.customProgramCacheKey = () => 'skin-diffusion-r170-v1';
      }
      if (/_eyes$/.test(material.name)) {
        material.roughness = 0.16;
        material.envMapIntensity = 1.0;
        material.alphaToCoverage = true;
        material.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
            '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.58);');
        };
        material.customProgramCacheKey = () => 'natural-iris-v1';
      }
      material.needsUpdate = true;
    }
  });
  return seen;
}
