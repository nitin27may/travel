import { inBox, inFeature, type FeatColl } from './geometry';

/** Compass steps tried for a country disc, east and west first: [lng, lat] unit steps. */
const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
const SAMPLES = [3, 6, 9];

/** A land test over country shapes with geometry (the 110m set). The shapes are captured now: a later swap to geometry-less 50m shapes cannot blank it. */
export function landTest(fc: FeatColl): (lng: number, lat: number) => boolean {
  const feats = fc.features.filter((f) => f.geometry && f._bbox);
  return (lng, lat) => {
    const at: [number, number] = [((lng + 540) % 360) - 180, lat];
    return feats.some((f) => f._bbox && inBox(f._bbox, at) && inFeature(f, at));
  };
}

/**
 * The screen offset that moves a country's disc off its land and onto the nearest sea, so the country's own name stays readable
 * (review S3, spec 6.5): the compass direction with the fewest land samples within 9 degrees, `px` away. Null when every direction
 * is land (a country deep inland keeps its disc in place). The direction is geographic, so it does not flicker as the globe spins.
 */
export function seaOffset(lng: number, lat: number, isLand: (lng: number, lat: number) => boolean, px: number): [number, number] | null {
  const cos = Math.max(0.35, Math.cos((lat * Math.PI) / 180));
  let best: { i: number; hits: number } | null = null;
  STEPS.forEach(([dx, dy], i) => {
    const diag = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
    const hits = SAMPLES.filter((k) => isLand(lng + (dx * k * diag) / cos, Math.max(-85, Math.min(85, lat + dy * k * diag)))).length;
    if (!best || hits < best.hits) best = { i, hits };
  });
  const pick = best as { i: number; hits: number } | null;
  if (!pick || pick.hits >= 2) return null;
  const [dx, dy] = STEPS[pick.i];
  const diag = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
  // north is up the screen
  return [Math.round(dx * diag * px), Math.round(-dy * diag * px)];
}
