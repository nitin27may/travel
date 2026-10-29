// The trip builder's public reference files (TB-RG, MX hubs, ORG-D airports): data/reference/hubs.json (reference-hubs/1),
// data/reference/airports.json (reference-airports/1) and data/reference/region-groups.json (region-groups/1). Read on the server by
// web/lib/server/planService.ts `fileReference()`; validated by core/src/validate/reference.ts (ids unique, coordinates in range, a group's
// id names its country). Points are public (Wikidata CC0, OurAirports public domain), never Google and never a person's home.
// Subset rule (meta.ts): no refine, transform or lazy schemas; the cross-row rules live in the validator.
import { z } from "zod";
import { date, int, json, pattern, table } from "./meta.ts";

export const REFERENCE_HUBS_SCHEMA_ID = "reference-hubs/1";
export const REFERENCE_AIRPORTS_SCHEMA_ID = "reference-airports/1";
export const REGION_GROUPS_SCHEMA_ID = "region-groups/1";

/** The licences a reference row may carry (data/reference/licences.json holds the attribution). */
export const REFERENCE_LICENCE = ["CC0-1.0", "public-domain"] as const;
export const REFERENCE_SOURCE = ["wikidata", "ourairports"] as const;
export const HUB_KIND = ["city", "town"] as const;
export const AIRPORT_SIZE = ["large", "medium"] as const;
/** QB7: NUTS-1 for European countries, US census divisions, our own traveller groups elsewhere. */
export const GROUP_BASIS = ["nuts-1", "census-division", "traveller"] as const;

const isoDate = z.iso.date();
const text = z.string().trim().min(1);
const cc = z.string().regex(/^[A-Z]{2}$/);
/** ISO 3166-2 as OurAirports writes it (`CA-AB`, `IT-34`, `AT-7`) */
const iso31662 = z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/);
const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);

const sourceHead = z.strictObject({
  id: z.enum(REFERENCE_SOURCE),
  url: text,
  terms: text,
  licence: z.enum(REFERENCE_LICENCE),
  read: isoDate,
  user_agent: text,
});

export const referenceHub = z.strictObject({
  /** a slug (PLAN_HUB_RE): the `id` of a `{kind: "hub"}` origin, looked up by PlanService */
  id: z.string().max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** the origin token, `hub:<id>` */
  ref: z.string().regex(/^hub:[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: text,
  kind: z.enum(HUB_KIND),
  cc,
  iso_3166_2: iso31662,
  lat,
  lon,
  wikidata: z.string().regex(/^Q[1-9]\d*$/),
  /** the towns-layer row (data/reference/towns) within 10 km, or null */
  town: z.string().regex(/^[a-z]{2}-[a-z0-9]+-[a-z0-9-]+$/).nullable(),
  source: z.enum(REFERENCE_SOURCE),
  licence: z.enum(REFERENCE_LICENCE),
  read: isoDate,
});

export const referenceAirport = z.strictObject({
  /** OurAirports `ident` (ICAO code for most rows) */
  id: z.string().regex(/^[A-Z0-9-]{3,10}$/),
  iata: z.string().regex(/^[A-Z]{3}$/),
  /** the origin token, `iata:<IATA>` */
  ref: z.string().regex(/^iata:[A-Z]{3}$/),
  name: text,
  /** OurAirports `municipality` */
  city: text,
  cc,
  iso_3166_2: iso31662,
  size: z.enum(AIRPORT_SIZE),
  lat,
  lon,
  source: z.enum(REFERENCE_SOURCE),
  /** OurAirports numeric row id */
  source_key: z.string().regex(/^\d+$/),
  licence: z.enum(REFERENCE_LICENCE),
  read: isoDate,
});

export const regionGroup = z.strictObject({
  /** `<cc>-<id>`, lower case (PLAN_REGION_RE's group form); its first two letters are the country */
  id: z.string().max(48).regex(/^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  cc,
  /** our own label (QB7) */
  name: text,
  basis: z.enum(GROUP_BASIS),
  /** the NUTS-1 code or census division number the group follows; null for a traveller group */
  basis_code: z.string().regex(/^[A-Z0-9]{1,4}$/).nullable(),
  /** catalogue region facet slugs; PlanService reads them as `<CC>/<slug>` */
  regions: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1),
  /** the matching data/locations region ids */
  locations_regions: z.array(z.string().regex(/^[A-Z]{2}\/[A-Za-z0-9-]+$/)),
  /** researched places on `updated` (a snapshot; PlanService counts live) */
  places: z.number().int().min(0),
  /** places >= min_places on `updated` */
  offered: z.boolean(),
});

export const reference_hubs = table("reference_hubs", {
  schema: pattern(/^reference-hubs\/1$/),
  updated: date(),
  run: pattern(/^\S+$/),
  note: pattern(/\S/),
  source: json(sourceHead),
  hubs: json(z.array(referenceHub).min(1)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Public hubs" } });

export const reference_airports = table("reference_airports", {
  schema: pattern(/^reference-airports\/1$/),
  updated: date(),
  run: pattern(/^\S+$/),
  note: pattern(/\S/),
  source: json(sourceHead),
  airports: json(z.array(referenceAirport).min(1)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Airports" } });

export const region_groups = table("region_groups", {
  schema: pattern(/^region-groups\/1$/),
  updated: date(),
  run: pattern(/^\S+$/),
  note: pattern(/\S/),
  min_places: int({ min: 1 }),
  groups: json(z.array(regionGroup).min(1)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Region groups" } });

export type ReferenceHub = z.infer<typeof referenceHub>;
export type ReferenceAirport = z.infer<typeof referenceAirport>;
export type RegionGroup = z.infer<typeof regionGroup>;
