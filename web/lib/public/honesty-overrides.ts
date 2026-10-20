// The Open TODO row "Trail data for a person to confirm" (docs/v2/TODO.md, 2026-10-18), by prototype place id.
// Each one is shown as "Location unconfirmed" until a person confirms it and the id is removed here.
export const UNCONFIRMED_TRAIL_DATA: Record<string, string> = {
  braies: 'The P1 lot is inferred from a bus stop; a person must confirm it.',
  'monte-piana': 'The trailhead node is waiting for a person to confirm it.',
  'fanes-falls': 'The OpenStreetMap route is waiting for a person to confirm it.',
  seceda: 'The OpenStreetMap route is waiting for a person to confirm it.',
  nuvolau: 'The OpenStreetMap route is waiting for a person to confirm it.',
  'viel-dal-pan': 'The distance and climb figures are waiting for a person to confirm them.',
  'cinque-torri': 'The OpenStreetMap route is a 0.64 km cut from the hut with no researched length to check it against; a person must confirm it.',
  siusi: 'The distance and climb figures are waiting for a person to confirm them.',
  antorno: 'The pin is about 500 m off in places; a person must re-place it.',
};

/**
 * Suitability properties a record carries that cannot apply to what it is. The lane files are pinned by the migration ledger (no leaf
 * is edited or removed), so the page drops the value here instead of showing it. Keyed by capture ref; each path is a suitability key.
 */
export const NOT_APPLICABLE_SUITABILITY: Record<string, { paths: string[]; why: string }> = {
  // the Dolomites are a mountain range: the "lift season" was the trips' lift table copied onto the range (REVIEW4 4.27)
  'place/dolomites': { paths: ['access_season'], why: 'A mountain range has no lift season; each lift has its own page.' },
};

/** The suitability location of a record without the values that cannot apply to it. Returns the same object when nothing is dropped. */
export function withoutInapplicable<T extends { rec: { ref?: string; suitability?: Record<string, unknown> } }>(ref: string, loc: T): T {
  const rule = NOT_APPLICABLE_SUITABILITY[ref];
  const suit = loc.rec.suitability;
  if (!rule || !suit || !rule.paths.some((p) => p in suit)) return loc;
  const kept = Object.fromEntries(Object.entries(suit).filter(([k]) => !rule.paths.includes(k)));
  return { ...loc, rec: { ...loc.rec, suitability: kept } };
}
