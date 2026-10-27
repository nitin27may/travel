// The envelope exposure map (property-display-matrix 8.1; PM-C): the privacy class and the MCP exposure of every top-level key of the
// public read models (`PlaceRow`, `PlaceDetail`, `TripRow`, `TripDetail`). Registry properties carry their own exposure
// (core/src/schema/capture/properties.ts `expose`); these are the read models' own keys, which no registry row describes.
//
// Authored, not generated. core/test/capture/registry-exposure.test.ts fails a Zod key with no row and a row with no Zod key, so a new
// read-model key is decided here in the same change (K8 in PM-G's generator reads this file too). The household data of 8.2 never
// appears in these models: a `household` row would fail the test, and the privacy detector (core/src/privacy/detect.ts) fails any body
// that carries one of its keys at run time.
import type { McpExpose, PrivacyClass } from "./capture/properties.ts";

export interface EnvelopeExposure {
  privacy: PrivacyClass;
  mcp: McpExpose;
  /** why the key is not public on MCP, or what it is computed from */
  note?: string;
}

export const READ_MODELS = ["placeRow", "placeDetail", "tripRow", "tripDetail"] as const;
export type ReadModel = (typeof READ_MODELS)[number];

const P: EnvelopeExposure = { privacy: "public", mcp: "public" };
const D: EnvelopeExposure = { privacy: "derived", mcp: "public" };
const legacyFlat = (what: string): EnvelopeExposure => ({ privacy: "public", mcp: "none", note: `legacy flat copy of ${what}; MCP reads the facts model only (FA-2 decides whether the page still needs it)` });
const internal = (note: string): EnvelopeExposure => ({ privacy: "internal", mcp: "none", note });

const PLACE_ROW: Record<string, EnvelopeExposure> = {
  id: P, slug: P, name: P, kind: P, kindLabel: P,
  legacyKind: internal("the old site's kind, kept for redirects"),
  country: P, country_name: P, region: P, region_name: P,
  regionAliases: { privacy: "public", mcp: "none", note: "URL spellings of the region; the MCP projection drops them" },
  area: P, area_name: P, lat: P, lon: P, km: P, gain_m: P,
  elevation_m: { privacy: "public", mcp: "none", note: "a third elevation read from the locations store with no registry key (9.2); none until the MERGE onto altitude_m" },
  season: P, kid_fit: D, tags: P, image: P, trips: P, honesty: D, completeness: D, statsState: D, researched: D, type: P, effort: D,
  kids_from: D, kids_basis: D, time_band: D, price_band: D, booking: D,
  flags: { privacy: "derived", mcp: "none", note: "list-filter flags; the MCP projection drops them" },
  walk_band: D, shape: P, best_time: P, badge: D, ref: P, approx: P,
  nearTown: { privacy: "derived", mcp: "public", note: "a town id only; names leave only through find_towns (Q50)" },
};

const PLACE_DETAIL: Record<string, EnvelopeExposure> = {
  ref: P, slug: P, name: P, kind: P, kindLabel: P, subkind: P, category: P, type: P, badge: D, areaChain: P, areaLabel: P, point: P,
  season: P, kidFit: legacyFlat("the age band"), summary: P, photo: P, trips: P, tags: P, completeness: D, honesty: D,
  stats: legacyFlat("the effort and time facts"),
  sources: internal("an origin list (prototype, trail, capture): PRIV1 spirit"),
  elevationM: legacyFlat("altitude_m"), access: legacyFlat("the access facts"), lines: { privacy: "public", mcp: "none", note: "the track lines: size; served by trip_legs and export only" },
  facts: legacyFlat("the registry facts"), hazards: legacyFlat("hazards"), links: P, linksNone: P, seasonNote: legacyFlat("the season"),
  photos: P, wikidata: P, notes: internal("always empty on the public site"), minAge: legacyFlat("min_age"), booking: legacyFlat("window"),
  sections: { privacy: "public", mcp: "public", note: "public through the facts model (API-P)" },
  suitability: { privacy: "public", mcp: "public", note: "public through the facts model" },
  relevance: { privacy: "public", mcp: "public", note: "through the facts model, plus similar, pairs and planB as refs" },
  refSlugs: P, citations: P,
};

const TRIP_ROW: Record<string, EnvelopeExposure> = {
  ref: P, id: P, slug: P, title: P, depth: P, nights: P, days: P, seasonNotSet: internal("an editorial flag"), region: P, cover: P,
  seasonLabel: P, seasonBasis: P, seasonMonths: P, country: P, countryName: P, lat: P, lon: P, approx: P, ageFit: D, kidsBasis: D,
  effort: D, firstBase: P, countries: P, continents: P, length: D, lengthClass: D, hike: D, hikeBasis: D, strollerDays: D, activities: D,
  highlights: P, around: D, perDay: D, perDayApprox: D, shape: D,
  fromHubMin: { privacy: "derived", mcp: "public", note: "from the trip's public hubs, never the visitor's origin (OR2)" },
  fromHubApprox: D,
};

const TRIP_DETAIL: Record<string, EnvelopeExposure> = {
  ref: P, slug: P, title: P, subtitle: P, depth: P, visibility: internal("publication state"), nights: P, daysCount: P,
  seasonNotSet: internal("an editorial flag"), region: P, cover: P, season: P, firstBase: P, legacyUrl: internal("the old site's address"),
  honesty: D, tags: P, lengthClass: D,
  fromHubs: { privacy: "derived", mcp: "public", note: "the trip's public hubs, never the visitor's origin (OR2)" },
  schedule: { privacy: "derived", mcp: "none", note: "the scheduler's open shapes (looseObject) and timelines never reach MCP" },
  bases: P, days: { privacy: "public", mcp: "public", note: "without scheduleInput" }, categories: P, gallery: P, effort: D, ageFit: D,
  driveAvgMin: D,
};

export const ENVELOPE_EXPOSURE: Readonly<Record<ReadModel, Readonly<Record<string, EnvelopeExposure>>>> = {
  placeRow: PLACE_ROW, placeDetail: PLACE_DETAIL, tripRow: TRIP_ROW, tripDetail: TRIP_DETAIL,
};

/** The rule breaks of an envelope map (a test feeds planted maps): household rows, and internal rows that reach MCP. */
export function envelopeProblems(map: Readonly<Record<string, Readonly<Record<string, EnvelopeExposure>>>>): string[] {
  const out: string[] = [];
  for (const [model, rows] of Object.entries(map)) for (const [key, e] of Object.entries(rows)) {
    if (e.privacy === "household") out.push(`${model}.${key}: household data in a public read model`);
    if ((e.privacy === "internal" || e.privacy === "household") && e.mcp !== "none") out.push(`${model}.${key}: ${e.privacy} exposed to mcp`);
  }
  return out;
}
