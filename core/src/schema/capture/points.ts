// The point value and the points sidecar (META-0, capture contract 3.7; decision 3.37: the point stays in the sidecar, keyed by ref).
//
// A record's point lives in data/capture/points.json (`capture-points/1`), read first, then data/relevance/inputs/points.json
// (`relevance-points/1`). Both rows share this value shape. `point_role` and `approx` are optional on read, so every row written
// before META-0 stays valid; a row with no role reads as the default role of its type (`defaultPointRole`), and a row with no
// `approx` is not approximate. An approximate point counts for Where (country, region, area) but never for a distance (T5).
//
// Subset rule (meta.ts): no refine, transform or lazy schemas, so the file exports to JSON Schema.
import { z } from "zod";
import * as E from "../enums.ts";
import { rowMetaSlot } from "../rowMeta.ts";

/** Where a coordinate was read. Google is never one (T5); the relevance sidecar also knows `nominatim` and `prototype`. */
export const CAPTURE_COORD_SRC = ["osm", "wikidata", "official", "manual"] as const;

/** One point: the thing itself (or its trailhead, lower station, entrance), with where it came from and what it stands for. */
export const capPoint = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  coord_src: z.enum(CAPTURE_COORD_SRC),
  /** the source row in words: "OSM node 123 <name> (what the node is); read <date> (lane <id>)" */
  point_source: z.string().min(1).optional(),
  /** what the point stands for; absent means the default role of the record's type */
  point_role: z.enum(E.POINT_ROLE).optional(),
  /** true when the point is a centroid or a guess: it counts for Where, never for distances */
  approx: z.boolean().optional(),
  /** why the point is approximate and what would fix it (W_PLACE_APPROX when an approximate point has none) */
  approx_note: z.string().min(1).optional(),
});

export const CAPTURE_POINTS_SCHEMA_ID = "capture-points/1";
export const CAPTURE_POINTS_V2_SCHEMA_ID = "capture-points/2";

/** An OSM element (`node/123`), a Wikidata item (`Q123`): what the coordinate was read from, when it has an id. */
export const POINT_ELEMENT_RE = /^(?:(?:node|way|relation)\/\d+|Q[1-9]\d*)$/;

/**
 * capture-points/2 (spec 4.2, RIS-C): the free-text `point_source` becomes structured provenance. `provider` is who published the
 * coordinate (OpenStreetMap, Wikidata, Parks Canada); `read` the day it was read; `quote` the phrase that names it (at most 300, A6).
 * `legacy` keeps the old point_source text of a row the migration ledger pins, until a supersede replaces it (gotcha 9).
 */
export const pointSrc = z.strictObject({
  provider: z.string().min(1).max(80),
  element: z.string().regex(POINT_ELEMENT_RE).optional(),
  url: z.string().min(1).optional(),
  read: z.iso.date(),
  quote: z.string().min(1).max(300).optional(),
  legacy: z.string().min(1).optional(),
});

/** A competing coordinate (a Wikidata point 1.4 km from the official overlook): loaded as an `evidence` reading, never shown. */
export const pointConflict = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  coord_src: z.enum(CAPTURE_COORD_SRC),
  provider: z.string().min(1).max(80),
  element: z.string().regex(POINT_ELEMENT_RE).optional(),
  url: z.string().min(1).optional(),
  read: z.iso.date().optional(),
  /** why this reading lost: one sentence */
  note: z.string().min(1).max(280),
});

/** One capture-points/2 row: the v1 point without point_source, plus point_src, conflicts and RowMeta (run id, review state, refs). */
export const capPointV2 = z.strictObject({
  lat: capPoint.shape.lat,
  lon: capPoint.shape.lon,
  coord_src: capPoint.shape.coord_src,
  point_src: pointSrc,
  point_role: capPoint.shape.point_role,
  approx: capPoint.shape.approx,
  approx_note: capPoint.shape.approx_note,
  conflicts: z.array(pointConflict).optional(),
  meta: rowMetaSlot.optional(),
});

const pointsV1 = z.strictObject({
  schema: z.literal(CAPTURE_POINTS_SCHEMA_ID),
  note: z.string().optional(),
  points: z.record(z.string().min(1), capPoint),
});
const pointsV2 = z.strictObject({
  schema: z.literal(CAPTURE_POINTS_V2_SCHEMA_ID),
  note: z.string().optional(),
  points: z.record(z.string().min(1), capPointV2),
});

/**
 * data/capture/points.json: points by capture ref. Keys are refs, some of them path-like; a ref is an id, never a path. Both versions
 * read until RIS-J converts the file to /2; readers take lat, lon, coord_src, point_role and approx, which both share.
 */
export const capturePointsFile = z.discriminatedUnion("schema", [pointsV1, pointsV2]);

/** A row of data/capture/points.json as its readers see it: capture-points/1 carries the free-text `point_source`, /2 `point_src`. */
export interface CapturedPointRow { lat: number; lon: number; coord_src: string; point_source?: string; point_src?: { provider?: string; element?: string; quote?: string; legacy?: string } }

/**
 * The provenance text of a captured row, for the readers that take the OSM element or the Wikidata P625 id from `point_source` (the
 * relevance inputs file, core's loadPoints, the web seeds, Directions and trail pages). A /2 row gives its `legacy` string (the whole v1
 * text: every ledger-pinned row has one), else its `quote` (the v1 text without the read date and review state, which still opens with
 * the element), else provider and element.
 */
export function capturedPointSource(c: CapturedPointRow): string | undefined {
  if (c.point_source) return c.point_source;
  const s = c.point_src;
  if (!s) return undefined;
  return s.legacy ?? s.quote ?? ([s.provider, s.element].filter(Boolean).join(" ") || undefined);
}

/** The read side of a relevance-points/1 row: the same fields, its own wider coord_src, unknown keys tolerated (its own checker owns it). */
export const relevancePointRow = z.looseObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  coord_src: z.string().min(1),
  point_source: z.string().optional(),
  point_role: z.enum(E.POINT_ROLE).optional(),
  approx: z.boolean().optional(),
  approx_note: z.string().optional(),
});

/**
 * The nearest town (META-2 derives it): a town id `<cc>-<admin1>-<slug>` (owner Q76, `ca-on-whitby`). `<admin1>` is the lower-case
 * ISO 3166-2 subdivision suffix (`on`, `ab`), never the GeoNames admin1 code (Ontario is `08`); `00` when the country has none.
 */
export const TOWN_ID_RE = /^[a-z]{2}-[a-z0-9]+-[a-z0-9-]+$/;
/** The value (never a gap) when no settlement of at least 1,000 people lies within the town radius. */
export const NEAR_TOWN_NONE = "none_within_50km";
export const nearTownValue = z.union([z.string().regex(TOWN_ID_RE), z.literal(NEAR_TOWN_NONE)]);

/** GeoNames feature ids are positive integers, stored as text like a QID. */
export const GEONAMES_ID_RE = /^[1-9]\d*$/;

export type CapPoint = z.infer<typeof capPoint>;
export type CapPointV2 = z.infer<typeof capPointV2>;
export type CapturePointsFile = z.infer<typeof capturePointsFile>;
export type PointRole = (typeof E.POINT_ROLE)[number];
