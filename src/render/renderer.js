import { proceduralRenderer } from './procedural.js';
import { pixelRenderer } from './pixel.js';
import { sheetRenderer } from './sheet.js';
import { vectorRenderer } from './vector.js';

const REGISTRY = {
  procedural: proceduralRenderer, pixel: pixelRenderer,
  sheet: sheetRenderer, vector: vectorRenderer,
};

export function getRenderer(artType) {
  return REGISTRY[artType] || proceduralRenderer;
}

export function registerRenderer(type, renderer) {
  REGISTRY[type] = renderer;
}
