// The globe's shapes (web/lib/globe/types.ts, web/lib/client/data.ts): the area tree first, the light pins of one country, one card,
// one feature, one line, one city outline. Each method answers per country or per item, never the whole world in one body (P8).
import { z } from "zod";
import { apiSlug, apiTownId } from "./common.ts";

export const DRAW_TIERS = ["world", "national", "regional", "local"] as const;

/** A country, state or district with its counts. Countries carry `at` ([lon, lat] of their real pins' mean, or null). */
export const globeTreeNode = z.strictObject({
  slug: z.string(),
  name: z.string(),
  places: z.int().min(0),
  trips: z.int().min(0),
  get children() {
    return z.array(globeTreeNode);
  },
  at: z.tuple([z.number(), z.number()]).nullable().optional(),
});

export const globeTree = z.strictObject({
  continents: z.array(z.strictObject({
    slug: z.string(),
    name: z.string(),
    places: z.int().min(0),
    trips: z.int().min(0),
    countries: z.array(globeTreeNode),
  })),
});

/** A light pin (P8): name, kind, slug, position and the area path; no facts, photo or credit. */
export const lightPin = z.strictObject({
  kind: z.enum(["place", "trip"]),
  slug: apiSlug,
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  type: z.string(),
  path: z.array(z.string()),
  approx: z.boolean(),
  tier: z.enum(DRAW_TIERS),
  kindLabel: z.string(),
});

const cardFact = z.union([
  z.strictObject({ label: z.string(), text: z.string() }),
  z.strictObject({ label: z.string(), elevationM: z.number() }),
  z.strictObject({ label: z.string(), distanceKm: z.number() }),
]);

export const globeCard = z.strictObject({
  key: z.string(),
  kind: z.enum(["place", "trip"]),
  slug: apiSlug,
  title: z.string(),
  kindLabel: z.string(),
  glyph: z.string(),
  areaLabel: z.string(),
  summary: z.string().max(200),
  facts: z.array(cardFact).max(3),
  usedIn: z.strictObject({ slug: apiSlug, title: z.string(), day: z.int().nullable() }).nullable(),
  image: z.strictObject({
    url: z.string(),
    width: z.int().min(1),
    author: z.string(),
    licence: z.string(),
    sourceUrl: z.string(),
    from: z.enum(["place", "trip", "wikidata"]),
  }).nullable(),
  badge: z.string().nullable(),
  approx: z.boolean(),
  href: z.string(),
});

export const globeCardFile = z.strictObject({ card: globeCard, pin: lightPin });

/** A gazetteer feature (a range, sea, river, landform) by id: the row `[kind, name, lon, lat, a3, extra, rank, population, aliases, bbox, lineId]` as an object. */
export const globeFeature = z.strictObject({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  lon: z.number(),
  lat: z.number(),
  a3: z.string().nullable(),
  extra: z.string().nullable(),
  rank: z.number().nullable(),
  population: z.number().nullable(),
  aliases: z.array(z.string()),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  lineId: z.string().nullable(),
});

/** One landform's or river's line or outline (Natural Earth, public domain). */
export const globeLine = z.strictObject({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["line", "area"]),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  geometry: z.strictObject({ type: z.enum(["MultiLineString", "MultiPolygon"]), coordinates: z.unknown() }),
  credit: z.string(),
});

/** One city's outline (row 9.3, GLB2; OSM admin level 8, ODbL), by town id. A town with no polygon keeps the ring (`geometry` null). */
export const globeCity = z.strictObject({
  id: apiTownId,
  name: z.string(),
  geometry: z.unknown().nullable(),
  credit: z.string(),
});

export const globePinsInput = z.strictObject({ cc: z.string().regex(/^[a-z]{2}$/) });
export const globeCardInput = z.strictObject({ key: z.string().regex(/^(?:place|trip):[a-z0-9]+(?:-[a-z0-9]+)*$/) });
export const globeIdInput = z.strictObject({ id: z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/) });
export const globeCityInput = z.strictObject({ townId: apiTownId });

export type GlobeTree = z.infer<typeof globeTree>;
export type LightPin = z.infer<typeof lightPin>;
export type GlobeCardFile = z.infer<typeof globeCardFile>;
export type GlobeFeature = z.infer<typeof globeFeature>;
export type GlobeLine = z.infer<typeof globeLine>;
export type GlobeCity = z.infer<typeof globeCity>;
