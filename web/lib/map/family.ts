import type { MapFamily } from './types';

export interface GoogleEnv { key?: string; mapId?: string }

/** Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them into the client bundle. */
export function googleEnv(): GoogleEnv {
  return {
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || undefined,
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || undefined,
  };
}

const FAMILIES: readonly MapFamily[] = ['maplibre', 'google-js', 'google-embed'];
export const isMapFamily = (v: unknown): v is MapFamily => typeof v === 'string' && (FAMILIES as readonly string[]).includes(v);

let warned = false;
/**
 * A Google family needs a browser key. Without one the page falls back to MapLibre so the site is fully
 * working before the owner creates the key. The warning is logged once per page load.
 */
export function resolveFamily(requested: MapFamily | undefined, env: GoogleEnv = googleEnv()): MapFamily {
  const want = requested ?? 'maplibre';
  if (want === 'maplibre') return want;
  if (!env.key) {
    if (!warned && typeof console !== 'undefined') {
      warned = true;
      console.warn(`[map] ${want} requested but NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set; using maplibre.`);
    }
    return 'maplibre';
  }
  return want;
}

/** The family for place and trail pages: NEXT_PUBLIC_PLACE_MAP_FAMILY, default maplibre. */
export function placePageFamily(env: GoogleEnv = googleEnv(), raw: string | undefined = process.env.NEXT_PUBLIC_PLACE_MAP_FAMILY): MapFamily {
  return resolveFamily(isMapFamily(raw) ? raw : 'maplibre', env);
}

/**
 * The family for the trip page's route map. Google when BOTH the browser key and the Map ID are set (the shared Map ID has the owner's
 * style: POIs off, no green); MapLibre otherwise. It never falls back to `DEMO_MAP_ID`, which draws every business and is for testing only.
 * NEXT_PUBLIC_TRIP_MAP_FAMILY overrides it in tests (a Google family still needs a key).
 */
export function tripPageFamily(env: GoogleEnv = googleEnv(), raw: string | undefined = process.env.NEXT_PUBLIC_TRIP_MAP_FAMILY): MapFamily {
  if (isMapFamily(raw)) return resolveFamily(raw, env);
  return env.key && env.mapId ? 'google-js' : 'maplibre';
}

/** Test hook: lets the fallback warning fire again. */
export function resetFamilyWarning(): void { warned = false; }
