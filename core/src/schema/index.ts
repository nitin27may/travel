// The registry: every table in a stable order, sorted by family then name.
import { LOCATION_TABLES } from "./locations.ts";
import { TRIP_TABLES } from "./trip.ts";
import type { Family, Table } from "./meta.ts";
import { activities } from "./catalog/activities.ts";
import { area_guides } from "./catalog/areas.ts";
import { backlog } from "./catalog/backlog.ts";
import { catalog_changes } from "./catalog/changes.ts";
import { catalogSources } from "./catalog/sources.ts";
import { eateries } from "./catalog/eateries.ts";
import { legs } from "./catalog/legs.ts";
import { offer_prices, offers } from "./catalog/offers.ts";
import { stays } from "./catalog/stays.ts";
import { trails } from "./catalog/trails.ts";
import { difficulty_map } from "./difficultyMap.ts";
import { freshness } from "./freshness.ts";
import { policy } from "./policy.ts";
import { research_sidecar } from "./researchSidecar.ts";
import { route_geometry } from "./routeGeometry.ts";
import { relevance } from "./relevance.ts";
import { suitability } from "./suitability.ts";
import { suitability_applicability } from "./suitabilityApplicability.ts";

export { TRIP_TABLES } from "./trip.ts";
export { LOCATION_TABLES, LOCATION_FILE_TABLES } from "./locations.ts";
export * from "./meta.ts";

/** catalog tables in the order they appear in a file of the same name */
export const CATALOG_TABLES: Table[] = [
  trails, activities, stays, eateries, offers, offer_prices, legs, area_guides, catalog_changes, backlog, catalogSources,
];

export const DOCUMENT_TABLES: Table[] = [research_sidecar, route_geometry, policy, freshness, difficulty_map, suitability, suitability_applicability, relevance];

const FAMILY_ORDER: Family[] = ["catalog", "locations", "sidecar", "trip"];

export const REGISTRY: Table[] = [...TRIP_TABLES, ...LOCATION_TABLES, ...CATALOG_TABLES, ...DOCUMENT_TABLES]
  .sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || a.name.localeCompare(b.name));

export const BY_KEY: Map<string, Table> = new Map(REGISTRY.map((t) => [t.key, t]));

export function tableOf(family: Family, name: string): Table {
  const t = BY_KEY.get(`${family}.${name}`);
  if (!t) throw new Error(`no table ${family}.${name}`);
  return t;
}

/** catalog entity folder -> the table(s) a file in it carries */
export const CATALOG_FILES: Record<string, string[]> = {
  trails: ["trails"],
  activities: ["activities"],
  stays: ["stays"],
  eateries: ["eateries"],
  offers: ["offers", "offer_prices"],
  legs: ["legs"],
  areas: ["area_guides"],
};
