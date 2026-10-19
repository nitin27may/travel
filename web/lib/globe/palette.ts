import { normaliseColour, pageIsDark } from '@/lib/map/palette';

/**
 * The colours the globe paints with (spec 6.1, 6.3, 6.6). Every one is a foundation token read off the container, so a
 * theme change is a token change; the literals below are only the fall-back when a Light map is shown on a dark page (or the
 * reverse) and the token for that mode is not on screen. `engine.ts` holds no colour of its own.
 */
export type Rgba = [number, number, number, number];

export interface GlobePalette {
  mode: 'light' | 'dark';
  /** The sea, and the style background: an unloaded globe reads as water, never land. */
  ocean: string;
  land: string;
  /** A warmer step of land for woods, parks and landcover: no green anywhere on the canvas. */
  wood: string;
  /** Rivers and the casing-free water lines. */
  river: string;
  high: string;
  shade: string;
  border: string;
  label: string;
  halo: string;
  ink: string;
  surface: string;
  accent: string;
  /** The amber of a selection, lifted on dark water so it reaches 3:1. */
  accentSel: string;
  /** The line under an amber line, so the edge reads on land and on water. */
  casing: string;
  casingSel: string;
  /** The dim over everything outside the open area. */
  dim: string;
  dimAlpha: number;
  sky: string;
  horizon: string;
  fog: string;
  haloGlow: string;
}

const FALLBACK: Record<'light' | 'dark', Record<string, string>> = {
  light: { '--globe-ocean': 'rgb(169 196 211)', '--map-land': 'rgb(238 233 223)', '--map-wood': 'rgb(228 224 212)', '--map-water': 'rgb(127 166 185)', '--map-high': 'rgb(255 255 255)', '--map-shade': 'rgba(23,34,48,0.35)', '--map-border': 'rgb(142 153 166)', '--ink-2': 'rgb(58 70 84)', '--map-halo': 'rgba(255,255,255,0.9)', '--ink': 'rgb(23 34 48)', '--surface': 'rgb(255 255 255)', '--accent': 'rgb(217 150 43)', '--map-casing': 'rgb(23 34 48)', '--globe-dim': 'rgba(243,241,236,0.7)', '--globe-halo': 'rgb(207 224 236)' },
  dark: { '--globe-ocean': 'rgb(15 26 38)', '--map-land': 'rgb(38 50 65)', '--map-wood': 'rgb(43 56 69)', '--map-water': 'rgb(46 90 107)', '--map-high': 'rgb(52 67 79)', '--map-shade': 'rgba(0,0,0,0.55)', '--map-border': 'rgb(150 160 172)', '--ink-2': 'rgb(200 210 220)', '--map-halo': 'rgba(11,17,25,0.9)', '--ink': 'rgb(231 236 241)', '--surface': 'rgb(20 28 40)', '--accent': 'rgb(217 150 43)', '--map-casing': 'rgb(11 17 25)', '--globe-dim': 'rgba(11,17,25,0.6)', '--globe-halo': 'rgb(42 74 102)' },
};

/** Any CSS colour as [r, g, b, a]. Hex and rgb() are read here; anything else (color-mix, names) goes through the canvas parser in the browser. */
export function parseColour(css: string): Rgba {
  const c = css.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((d) => d + d).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (fn) {
    const p = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.every(Number.isFinite)) return [p[0], p[1], p[2], p[3] ?? 1];
  }
  const norm = normaliseColour(c, 'rgb(128 128 128)');
  return norm === c ? [128, 128, 128, 1] : parseColour(norm);
}

export const toCss = ([r, g, b, a]: Rgba): string => (a >= 1 ? `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})` : `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${+a.toFixed(3)})`);

/** `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = parseColour(a), y = parseColour(b);
  return toCss([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, x[3] + (y[3] - x[3]) * t]);
}

/** Relative luminance, for the contrast checks in the tests. */
export function luminance(css: string): number {
  const [r, g, b] = parseColour(css).slice(0, 3).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string): number => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

/** The token values a mode falls back to. Exported for the tests. */
export const FALLBACK_TOKENS = FALLBACK;

/** Reads the palette for a map style's mode. Tokens are read only when that mode is the page's; otherwise the spec values apply. */
export function readGlobePalette(el: Element | null, mode: 'light' | 'dark'): GlobePalette {
  const live = !!el && typeof document !== 'undefined' && pageIsDark() === (mode === 'dark');
  const cs = live ? getComputedStyle(el!) : null;
  return buildPalette((name) => normaliseColour(cs?.getPropertyValue(name).trim() || FALLBACK[mode][name], FALLBACK[mode][name]), mode);
}

/** The palette from a token getter: pure, so the contrast rules can be tested without a browser. */
export function buildPalette(t: (name: string) => string, mode: 'light' | 'dark'): GlobePalette {
  const dark = mode === 'dark';
  const accent = t('--accent');
  const dim = parseColour(t('--globe-dim'));
  const ocean = t('--globe-ocean');
  const haloTok = t('--globe-halo');
  const white = 'rgb(255 255 255)';
  return {
    mode, ocean, land: t('--map-land'), wood: t('--map-wood'), river: t('--map-water'), high: t('--map-high'), shade: t('--map-shade'),
    border: t('--map-border'), label: t('--ink-2'), halo: t('--map-halo'), ink: t('--ink'), surface: t('--surface'), accent,
    // The amber never touches the water: the 1 px casing does, so it is the casing that must reach 3:1 on water and land, and the amber against the casing.
    accentSel: accent,
    casing: t('--map-casing'),
    casingSel: dark ? mix(t('--map-casing'), 'rgb(0 0 0)', 0.5) : t('--map-casing'),
    dim: toCss([dim[0], dim[1], dim[2], 1]), dimAlpha: dim[3],
    sky: dark ? mix(haloTok, ocean, 0.5) : haloTok,
    horizon: dark ? haloTok : mix(haloTok, white, 0.7),
    fog: dark ? ocean : mix(haloTok, white, 0.7),
    haloGlow: haloTok,
  };
}
