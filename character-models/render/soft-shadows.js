// Percentage-closer soft shadows (PCSS): shadows harden where the occluder
// touches the receiver and widen with distance, like a real area light.
// Installed by patching three's shadow chunk before any material compiles,
// so every lit material, including the custom floor shader, gets it.
import * as THREE from 'three';

const PCSS = /* glsl */`
#define PCSS_SAMPLES 16
#define PCSS_RINGS 7
#define PCSS_SEARCH 0.0045
#define PCSS_MIN_RADIUS 0.0006
#define PCSS_MAX_RADIUS 0.0085
#define PCSS_SCALE 90.0

vec2 pcssDisk[PCSS_SAMPLES];
void pcssInitDisk( const in vec2 seed ) {
  float step = PI2 * float( PCSS_RINGS ) / float( PCSS_SAMPLES );
  float angle = rand( seed ) * PI2;
  float radius = 1.0 / float( PCSS_SAMPLES );
  float radiusStep = radius;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
    pcssDisk[ i ] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
    radius += radiusStep;
    angle += step;
  }
}
float pcssDepth( sampler2D shadowMap, vec2 uv ) {
  return unpackRGBAToDepth( texture2D( shadowMap, uv ) );
}
float pcssShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowRadius, vec4 coords ) {
  vec2 uv = coords.xy;
  float z = coords.z;
  pcssInitDisk( uv );
  // blocker search: average depth of occluders around the receiver
  float sum = 0.0;
  int n = 0;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
    float d = pcssDepth( shadowMap, uv + pcssDisk[ i ] * PCSS_SEARCH );
    if ( d < z ) { sum += d; n ++; }
  }
  if ( n == 0 ) return 1.0;
  float penumbra = clamp( ( z - sum / float( n ) ) * PCSS_SCALE, 0.0, 1.0 );
  float radius = mix( PCSS_MIN_RADIUS, PCSS_MAX_RADIUS, penumbra ) * max( 1.0, shadowRadius * 0.5 );
  // filter: two rotated poisson passes
  float lit = 0.0;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
    if ( z <= pcssDepth( shadowMap, uv + pcssDisk[ i ] * radius ) ) lit += 1.0;
    if ( z <= pcssDepth( shadowMap, uv - pcssDisk[ i ].yx * radius ) ) lit += 1.0;
  }
  return lit / ( 2.0 * float( PCSS_SAMPLES ) );
}
`;

let installed = false;
export function installSoftShadows() {
  if (installed) return;
  installed = true;
  let chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  chunk = chunk.replace('#ifdef USE_SHADOWMAP', '#ifdef USE_SHADOWMAP' + PCSS);
  chunk = chunk.replace(
    '#if defined( SHADOWMAP_TYPE_PCF )',
    'return mix( 1.0, pcssShadow( shadowMap, shadowMapSize, shadowRadius, shadowCoord ), shadowIntensity );\n\t\t#if defined( SHADOWMAP_TYPE_PCF )',
  );
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk;
}
