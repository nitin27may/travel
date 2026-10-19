/**
 * One label pass for all three styles (spec 6.2, review M5). OpenFreeMap's Liberty, Positron and Dark each keep their own label
 * logic: a name in two scripts, capitals in some layers, state names at world zoom. This reduces them to one rule set, decided
 * from the layer's id and source layer alone so it is testable without a map.
 */
import type { ExpressionSpecification } from 'maplibre-gl';

/** English name first, then the Latin transliteration, then whatever the tile has: one script per label, never "Belarus Беларусь". */
export const NAME_FIELD = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']] as unknown as ExpressionSpecification;

export type PlaceClass = 'country' | 'state' | 'city' | 'town' | 'village' | 'minor';
export interface LayerLike { id: string; type: string; 'source-layer'?: string; minzoom?: number; maxzoom?: number; layout?: Record<string, unknown> }

/** A name layer from the vector tiles that this pass owns (roads, shields and POI are not labels of places). */
export function isNameLayer(l: LayerLike): boolean {
  if (l.type !== 'symbol') return false;
  const sl = l['source-layer'] ?? '';
  if (sl !== 'place' && sl !== 'water_name' && sl !== 'waterway') return false;
  return !!l.layout && 'text-field' in l.layout;
}

export function placeClassOf(id: string): PlaceClass {
  if (/country/.test(id)) return 'country';
  if (/state|province|region/.test(id)) return 'state';
  if (/city/.test(id)) return 'city';
  if (/town/.test(id)) return 'town';
  if (/village/.test(id)) return 'village';
  return 'minor';
}

/** The rank class of a country layer: 1 and 2 show from the start, the rest from zoom 2.5. */
export const isMinorCountry = (id: string): boolean => /(^|[_-])3$|minor|other/.test(id);

export interface RankBand { suffix: string; minRank: number; maxRank: number; minzoom: number }
/** Cities by rank (spec 6.2): rank 1 and 2 from zoom 3, 3 and 4 from 4.5, the rest from 6. */
export const CITY_BANDS: RankBand[] = [
  { suffix: '', minRank: 0, maxRank: 2, minzoom: 3 },
  { suffix: '~r4', minRank: 3, maxRank: 4, minzoom: 4.5 },
  { suffix: '~r9', minRank: 5, maxRank: 99, minzoom: 6 },
];

export interface LabelPlan {
  hide: boolean;
  layout: Record<string, unknown>;
  /** New zoom range, when this layer's changes. */
  minzoom?: number;
  maxzoom?: number;
  /** Cities: the layer is repeated once per rank band. */
  bands?: RankBand[];
  /** Muted ink for state names. */
  muted?: boolean;
}

/** The decisions for one name layer. */
export function planLabel(l: LayerLike): LabelPlan {
  const base: Record<string, unknown> = { 'text-field': NAME_FIELD, 'text-transform': 'none', 'text-letter-spacing': 0.02, 'text-padding': 8 };
  if ((l['source-layer'] ?? '') !== 'place') return { hide: false, layout: base };
  const cls = placeClassOf(l.id);
  switch (cls) {
    case 'country':
      return {
        hide: false,
        layout: { ...base, 'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 5, 14], 'text-max-width': 7 },
        minzoom: isMinorCountry(l.id) ? 2.5 : l.minzoom,
        maxzoom: 9,
      };
    case 'state':
      return { hide: false, layout: { ...base, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 7, 12] }, minzoom: 5, maxzoom: 9, muted: true };
    case 'city':
      return { hide: false, layout: base, minzoom: 3, bands: CITY_BANDS };
    case 'town':
      return { hide: false, layout: base, minzoom: 7 };
    case 'village':
      return { hide: false, layout: base, minzoom: 10 };
    default:
      return { hide: true, layout: base };
  }
}
