import { featureZoom } from './flight';

/** [west, south, east, north] in degrees; east may pass 180 for a shape across the antimeridian. */
export type Box4 = [number, number, number, number];

/** What the gazetteer row of a river, landform or sea knows about its extent (GLB2). */
export interface FeatureFit { bbox: Box4 | null; lineId: string | null; cls: string; rank: number }

/** A camera move: fit a box, or go to a point at a zoom. */
export type FitMove =
  | { type: 'box'; box: [[number, number], [number, number]]; maxZoom: number; wide: boolean }
  | { type: 'point'; at: [number, number]; zoom: number };

/** Highest zoom a fit may reach, by class: a river or range is read at map scale, a small island or a delta can go closer. */
const MAX_ZOOM: Record<string, number> = { river: 10, area: 10, sea: 8 };

/** The class a gazetteer row falls in: the fit zoom table keys on it. */
export function classOfRow(kind: string, extra: string | null): string {
  if (kind === 'river') return 'river';
  if (kind === 'marine') return 'sea';
  if (/lake/i.test(extra ?? '')) return 'lake';
  return 'area';
}

/**
 * One fit model for every feature class (backlog 9.7). A point class (peak, park, city, a cape) goes to its class zoom. A line or an area
 * fits its own box, so the camera ends inside the feature and shows all of it. `context` leaves room around it (the search landing, so
 * Fly here, which fits tight, always moves the camera); a box wider than 170 degrees stays on the globe, flat.
 */
export function fitMove(fit: FeatureFit, at: [number, number], mode: 'context' | 'tight'): FitMove {
  const box = fit.bbox;
  if (!box) return { type: 'point', at, zoom: featureZoom(fit.cls, fit.rank) };
  const [w, s, e, n] = box;
  const span = Math.max(e - w, n - s, 0.05);
  const pad = (mode === 'context' ? 0.45 : 0.06) * span;
  const maxTight = MAX_ZOOM[fit.cls] ?? 10;
  return {
    type: 'box',
    box: [[w - pad, Math.max(-84, s - pad)], [e + pad, Math.min(84, n + pad)]],
    maxZoom: mode === 'context' ? maxTight - 1.5 : maxTight,
    wide: e - w > 170,
  };
}

/** Whether a point lies inside a box, across the antimeridian when east passes 180. */
export function inBox4(b: Box4, lon: number, lat: number): boolean {
  const x = b[2] > 180 && lon < 0 ? lon + 360 : lon;
  return x >= b[0] && x <= b[2] && lat >= b[1] && lat <= b[3];
}
