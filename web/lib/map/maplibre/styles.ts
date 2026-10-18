import type { Mode } from '../palette';

export type StyleKey = 'relief' | 'light' | 'dark';

export const STYLE_URLS: Record<StyleKey, string> = {
  relief: 'https://tiles.openfreemap.org/styles/liberty',
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export const TERRAIN_URL = 'https://tiles.mapterhorn.com/tilejson.json';
/** Same fallback as the live globe (legacy/globe/index.html) when Mapterhorn is unreachable. */
export const TERRAIN_FALLBACK = {
  type: 'raster-dem' as const,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Terrain: Mapzen / AWS Terrain Tiles',
};
/** 3D terrain only once the view is close enough; hillshade carries the relief below this. */
export const TERRAIN_MIN_ZOOM = 3.5;


/** 'auto' follows the page theme: relief in light, dark in dark. */
export function effectiveStyle(style: StyleKey | 'auto' | undefined, pageDark: boolean): StyleKey {
  if (!style || style === 'auto') return pageDark ? 'dark' : 'relief';
  return style;
}
export const modeOf = (s: StyleKey): Mode => (s === 'dark' ? 'dark' : 'light');
