/**
 * Map colours from the foundation tokens (tokens.md section 5), read from CSS custom properties on the map
 * container so the adapter follows the theme. Fallbacks are the tokens.md values written as rgb() (the repo
 * keeps hex literals in app/themes.css only); they apply when a token is not defined yet.
 */
export type Mode = 'light' | 'dark';

export interface MapPalette {
  land: string; high: string; shade: string; contour: string; water: string; border: string;
  label: string; halo: string; route: string; routeDim: string; routePick: string;
  ink: string; surface: string; accent: string; accentInk: string; well: string; line: string; muted: string;
}

const FALLBACK: Record<Mode, MapPalette> = {
  light: {
    land: 'rgb(238 236 230)', high: 'rgb(255 255 255)', shade: 'rgb(23 34 48 / 0.35)', contour: 'rgb(185 177 164)',
    water: 'rgb(111 159 180)', border: 'rgb(110 120 132 / 0.6)', label: 'rgb(58 70 84)', halo: 'rgb(255 255 255 / 0.9)',
    route: 'rgb(23 34 48)', routeDim: 'rgb(23 34 48 / 0.28)', routePick: 'rgb(224 154 28)',
    ink: 'rgb(23 34 48)', surface: 'rgb(255 255 255)', accent: 'rgb(224 154 28)', accentInk: 'rgb(23 34 48)',
    well: 'rgb(241 239 234)', line: 'rgb(214 209 199)', muted: 'rgb(98 108 120)',
  },
  dark: {
    land: 'rgb(26 35 48)', high: 'rgb(46 58 72)', shade: 'rgb(0 0 0 / 0.55)', contour: 'rgb(58 74 92)',
    water: 'rgb(63 124 143)', border: 'rgb(150 160 172 / 0.6)', label: 'rgb(200 210 220)', halo: 'rgb(11 17 25 / 0.9)',
    route: 'rgb(231 236 241)', routeDim: 'rgb(231 236 241 / 0.28)', routePick: 'rgb(235 168 48)',
    ink: 'rgb(231 236 241)', surface: 'rgb(20 28 40)', accent: 'rgb(235 168 48)', accentInk: 'rgb(23 34 48)',
    well: 'rgb(18 26 37)', line: 'rgb(48 62 78)', muted: 'rgb(150 162 176)',
  },
};

const TOKEN: Record<keyof MapPalette, string> = {
  land: '--map-land', high: '--map-high', shade: '--map-shade', contour: '--map-contour', water: '--map-water',
  border: '--map-border', label: '--ink-2', halo: '--map-halo', route: '--map-route', routeDim: '--map-route-dim',
  routePick: '--map-route-pick', ink: '--ink', surface: '--surface', accent: '--accent', accentInk: '--accent-ink',
  well: '--well', line: '--line', muted: '--muted',
};

let scratch: CanvasRenderingContext2D | null = null;
/** Normalises any CSS colour to a form MapLibre and Google both parse (#rrggbb or rgba(r, g, b, a)). */
export function normaliseColour(value: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  scratch ??= document.createElement('canvas').getContext('2d');
  if (!scratch) return fallback;
  const parse = (v: string): string | null => {
    scratch!.fillStyle = 'rgb(1 2 3)';
    const sentinel = scratch!.fillStyle;
    scratch!.fillStyle = v;
    const out = scratch!.fillStyle;
    return out === sentinel && v.replace(/\s+/g, '') !== 'rgb(123)' ? null : out;
  };
  return parse(value) ?? parse(fallback) ?? fallback;
}

export function pageIsDark(): boolean {
  if (typeof document === 'undefined') return false;
  const html = document.documentElement;
  if (html.classList.contains('dark') || /dark/.test(html.dataset.theme ?? '')) return true;
  if (html.classList.contains('light') || /light/.test(html.dataset.theme ?? '')) return false;
  const scheme = getComputedStyle(html).colorScheme;
  if (scheme.includes('dark') && !scheme.includes('light')) return true;
  if (scheme.includes('light') && !scheme.includes('dark')) return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** `mode` is the palette to produce; tokens are read only when it matches the page theme. */
export function readPalette(el: Element | null, mode: Mode): MapPalette {
  const fb = FALLBACK[mode];
  const live = el && typeof document !== 'undefined' && pageIsDark() === (mode === 'dark');
  const cs = live ? getComputedStyle(el) : null;
  const out = {} as MapPalette;
  (Object.keys(TOKEN) as (keyof MapPalette)[]).forEach((k) => {
    const raw = cs?.getPropertyValue(TOKEN[k]).trim();
    out[k] = raw ? normaliseColour(raw, fb[k]) : normaliseColour(fb[k], fb[k]);
  });
  return out;
}

export const fallbackPalette = (mode: Mode): MapPalette => FALLBACK[mode];
