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

/** data/capture/points.json: points by capture ref. Keys are refs, some of them path-like; a ref is an id, never a path. */
export const capturePointsFile = z.strictObject({
  schema: z.literal(CAPTURE_POINTS_SCHEMA_ID),
  note: z.string().optional(),
  points: z.record(z.string().min(1), capPoint),
});

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
export type CapturePointsFile = z.infer<typeof capturePointsFile>;
export type PointRole = (typeof E.POINT_ROLE)[number];
