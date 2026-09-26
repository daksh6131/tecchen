// Ultra is the default. Lower presets remain available for slower GPUs through
// ?quality=high or ?quality=performance without changing gameplay timing.
export const GRAPHICS_PRESETS = Object.freeze({
  cinematic: { pixelRatio: 2, shadowSize: 4096, samples: 4, aoSamples: 32, aoScale: 1, textureSize: '4k', hdrSize: '4k', reflectionSize: 2048, softShadows: true },
  ultra: { pixelRatio: 2, shadowSize: 4096, samples: 4, aoSamples: 24, aoScale: 0.75, textureSize: '2k', hdrSize: '2k', reflectionSize: 2048, softShadows: true },
  high: { pixelRatio: 1.5, shadowSize: 2048, samples: 2, aoSamples: 16, aoScale: 0.5, textureSize: '2k', hdrSize: '1k', reflectionSize: 1536, softShadows: true },
  performance: { pixelRatio: 1, shadowSize: 1024, samples: 0, aoSamples: 8, aoScale: 0.5, textureSize: '1k', hdrSize: '1k', reflectionSize: 1024, softShadows: false },
});
const requested = new URLSearchParams(globalThis.location?.search ?? '').get('quality');
export const qualityName = Object.hasOwn(GRAPHICS_PRESETS, requested) ? requested : 'ultra';
export const graphics = GRAPHICS_PRESETS[qualityName];
