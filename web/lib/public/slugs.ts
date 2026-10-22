// Slug rules: patterns 1.2. A trip slug is the kebab name plus the start year; a place slug is the kebab name,
// with the area appended when two places share a name (moss-glen-falls-stowe, moss-glen-falls-granville).

/** Legacy folder -> public trip slug (build plan README 2.3). Past and future trips alike. */
export const TRIP_SLUGS: Record<string, string> = {
  'dolomites-july-2027': 'dolomites-2027',
  'canadian-rockies-sept-2029': 'canadian-rockies-2029',
  'patagonia-feb-mar-2027': 'patagonia-2027',
  'iceland-ring-road': 'iceland-ring-road-2027',
  'chamonix-mont-blanc-sept-2028': 'chamonix-mont-blanc-2028',
  'costa-rica-feb-2027': 'costa-rica-2027',
  'switzerland-2027': 'switzerland-2027',
  'usa-southwest-rockies': 'utah-five-parks',
  'algonquin-muskoka-oct-2026': 'algonquin-muskoka-2026',
  'vermont-fall-2026': 'vermont-fall-2026',
  'quebec-sept-2026': 'quebec-2026',
  'norway-summer': 'norway-summer-2028',
  'new-hampshire-stopover-2026': 'new-hampshire-stopover-2026',
  'niagara-day-aug-2026': 'niagara-day-2026',
};

/** prototype public-trips id -> legacy folder */
export const PUBLIC_TRIP_FOLDER: Record<string, string> = {
  'p-dolomites': 'dolomites-july-2027',
  'p-rockies': 'canadian-rockies-sept-2029',
  'p-iceland': 'iceland-ring-road',
  'p-patagonia': 'patagonia-feb-mar-2027',
  'p-utah': 'usa-southwest-rockies',
  'p-algonquin': 'algonquin-muskoka-oct-2026',
  'p-vermont': 'vermont-fall-2026',
  'p-chamonix': 'chamonix-mont-blanc-sept-2028',
};

// The slug rules and the assignment live in core (API-1a, D-B1): one implementation for the dataset builder, the stores and
// `node core/bin/slugs.ts`, which pins every slug in data/catalogue/slugs.json.
export { kebab, assignPlaceSlugs, assignSeedSlugs } from '@travel/core/catalogue/slugs.ts';
export type { SlugInput, SeedSlugInput, SlugRegistry } from '@travel/core/catalogue/slugs.ts';
