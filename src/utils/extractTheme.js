// src/utils/extractTheme.js

import * as ColorThiefModule from 'colorthief';
import {
  rgbToHex,
  adjustLightness,
  ensureReadableContrast,
} from './colorTheory.js';

export const DEFAULT_THEME_HEX = {
  primary: '#1A2FA0',
  primaryLight: '#2E45C7',
  primaryDark: '#101D6B',
  accent: '#F2A93B',
  accentLight: '#F5C168',
  accentDark: '#D48C1F',
  leaf: '#1E5C29',
  leafLight: '#2E7D3A',
  leafDark: '#123D1A',
};

function extractRgb(item) {
  if (!item) return null;
  if (Array.isArray(item)) {
    return { r: item[0], g: item[1], b: item[2] };
  }
  if (typeof item.rgb === 'function') {
    return item.rgb();
  }
  if (typeof item.array === 'function') {
    const arr = item.array();
    return { r: arr[0], g: arr[1], b: arr[2] };
  }
  if (typeof item.r === 'number') {
    return { r: item.r, g: item.g, b: item.b };
  }
  return null;
}

async function getRawPalette(imageElement, colorCount = 6) {
  try {
    if (typeof ColorThiefModule?.getPalette === 'function') {
      const res = await ColorThiefModule.getPalette(imageElement, { colorCount });
      if (Array.isArray(res)) return res;
    }
    const DefaultExport = ColorThiefModule?.default;
    if (typeof DefaultExport === 'function') {
      const thief = new DefaultExport();
      if (typeof thief?.getPalette === 'function') {
        const res = thief.getPalette(imageElement, colorCount);
        if (Array.isArray(res)) return res;
      }
    }
  } catch (err) {
    console.warn('ColorThief palette extraction failed, falling back to defaults:', err);
  }
  return [];
}

/**
 * Extracts a brand theme from an HTMLImageElement.
 * Filters near-white and near-black artifacts, selects primary/accent/leaf candidates,
 * ensures readable contrast, and generates light/dark variants.
 */
export async function extractThemeFromImage(imageElement) {
  const rawPalette = await getRawPalette(imageElement, 6);

  const isNearWhite = (r, g, b) => r > 235 && g > 235 && b > 235;
  const isNearBlack = (r, g, b) => r < 20 && g < 20 && b < 20;

  const usableColors = rawPalette
    .map(extractRgb)
    .filter(Boolean)
    .filter(({ r, g, b }) => !isNearWhite(r, g, b) && !isNearBlack(r, g, b))
    .map(({ r, g, b }) => rgbToHex(r, g, b));

  const candidatePrimary = usableColors[0] || DEFAULT_THEME_HEX.primary;
  const candidateAccent = usableColors[1] || DEFAULT_THEME_HEX.accent;
  const candidateLeaf = usableColors[2] || DEFAULT_THEME_HEX.leaf;

  const primary = ensureReadableContrast(candidatePrimary);
  const accent = ensureReadableContrast(candidateAccent);
  const leaf = ensureReadableContrast(candidateLeaf);

  return {
    primary,
    primaryLight: adjustLightness(primary, 15),
    primaryDark: adjustLightness(primary, -15),
    accent,
    accentLight: adjustLightness(accent, 15),
    accentDark: adjustLightness(accent, -15),
    leaf,
    leafLight: adjustLightness(leaf, 15),
    leafDark: adjustLightness(leaf, -15),
  };
}
