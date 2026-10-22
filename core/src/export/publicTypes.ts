// Types the pure export builders share with the public data model: the trip categories, the depth of a trip and a stored point.
// web/lib/public/types.ts re-exports them, so every import in web is unchanged.

/** The six trip categories, in the fixed order patterns 3.4 requires. */
export const CATEGORIES = ['stays', 'trails', 'sights', 'activities', 'food', 'logistics'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  stays: 'Stays',
  trails: 'Trails',
  sights: 'Sights',
  activities: 'Activities',
  food: 'Food',
  logistics: 'Logistics',
};

/** How much a trip holds: full day-by-day plan, a condensed stop list, or a card only. */
export type Depth = 'full' | 'summary' | 'overview';

export interface Point {
  lat: number;
  lon: number;
  /** osm_node:<id>, osm_way:<id>, osm_relation:<id>, wikidata:<QID>, official:<url>, manual_pin or prototype_approx. Never Google. */
  pointSource: string;
  /** Who looked at the pin, or null when nobody has. */
  pointChecked: string | null;
  /** Licence of the source geometry, for the export guard. */
  sourceLicence: string;
}
