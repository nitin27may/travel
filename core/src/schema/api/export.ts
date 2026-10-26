// Exports (L5 copy, export and share): one item per request, never a list (P8, contract case K6).
import { z } from "zod";
import { apiSlug } from "./common.ts";
import { tripProfile } from "./trip.ts";

export const EXPORT_TYPES = ["trip", "place"] as const;
/**
 * The export formats (D-E6, API-3). `json` is the structured export model (`exportModel` below) that the client's Export menu and the
 * browser-side file builders read; `print` is a printable plain-text file (store.ts A26). Five files and one model.
 */
export const EXPORT_FORMATS = ["ics", "csv", "kml", "gpx", "print", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * The file each format is, written once (store.ts A26): every store answers exactly this `mime` and a `filename` of `<slug>.<ext>`, so
 * a client, the handlers and SupabaseStore cannot disagree (cases K20, K21).
 */
export const EXPORT_FILE: Readonly<Record<ExportFormat, { ext: string; mime: string }>> = {
  ics: { ext: "ics", mime: "text/calendar" },
  csv: { ext: "csv", mime: "text/csv" },
  kml: { ext: "kml", mime: "application/vnd.google-earth.kml+xml" },
  gpx: { ext: "gpx", mime: "application/gpx+xml" },
  print: { ext: "txt", mime: "text/plain; charset=utf-8" },
  json: { ext: "json", mime: "application/json" },
};

/** What a `print` file writes for a value the item does not have yet: the site's gap wording (store.ts A26, case K21). */
export const PRINT_GAP = "Not checked yet";

/**
 * `ExportQuery`: one trip or one place, one format. `slug` is a single slug (a comma or a list is `invalid_input`).
 * `profile` (the timeline's URL keys) is accepted so an export URL can carry the page's own keys, and is IGNORED today: every export is
 * the plan as written, scheduled for its own default profile (audit GB-A-12; store.ts A31). Applying it later is an additive change
 * that moves no URL.
 */
export const exportQuery = z.strictObject({
  type: z.enum(EXPORT_TYPES),
  slug: apiSlug,
  format: z.enum(EXPORT_FORMATS),
  profile: tripProfile.optional(),
});

/**
 * `ExportFile`: the body and how to serve it. `source` is the attribution line the file carries (ODbL for OSM geometry); `skipped`
 * counts the points left out because their source is not ours to give (the licence guard), never listing them; `approx` counts the
 * points written but labelled approximate. `mime` and the extension of `filename` are EXPORT_FILE's for the format.
 */
export const exportFile = z.strictObject({
  filename: z.string().min(1).max(160).regex(/^[a-z0-9][a-z0-9.-]*$/),
  mime: z.string().min(1),
  body: z.string(),
  source: z.string(),
  skipped: z.int().min(0),
  approx: z.int().min(0),
});

// ---- the export model (`format=json`, D-E6) ------------------------------------------------------------------------------------
// The shapes of core/src/export/types.ts as the contract. The `body` of a `json` export parses with `exportModel` (case K20). The
// licence guard holds inside the model too (store.ts A26): a waypoint whose point is not ours to give is left out and counted in
// `skipped`, and a stop whose point is not ours keeps the stop with `point: null`.

const exportPoint = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  pointSource: z.string(),
  pointChecked: z.string().nullable(),
  sourceLicence: z.string(),
});

export const exportWaypoint = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  kind: z.string(),
  role: z.enum(["stop", "trailhead", "parking", "base", "place"]),
  day: z.int().min(0).nullable(),
  note: z.string().nullable(),
  url: z.string().nullable(),
  point: exportPoint,
});

export const exportLine = z.strictObject({
  ref: z.string(),
  label: z.string(),
  exportable: z.boolean(),
  licence: z.string(),
  /** [lon, lat] pairs */
  geometry: z.array(z.tuple([z.number(), z.number()])),
});

export const exportStop = z.strictObject({
  day: z.int().min(0),
  order: z.int().min(0),
  id: z.string().min(1),
  name: z.string(),
  kind: z.string(),
  category: z.string().nullable(),
  area: z.string().nullable(),
  time: z.string().nullable(),
  durationMin: z.number().nullable(),
  lane: z.string().nullable(),
  note: z.string().nullable(),
  placeSlug: apiSlug.nullable(),
  links: z.array(z.string()),
  point: exportPoint.nullable(),
  /** The stop's booking windows as "Book ahead" says them (core/src/export/bookings.ts), when a booking names its place that day. Dateless. */
  bookRule: z.string().min(1).optional(),
});

/**
 * One booking of the trip (MUST-6, TRP-GL-C): a category row with a booking window or note, worded as the trip page words it. Dateless:
 * `rule` is relative to a day ("Opens 30 days before Day 3"), never a calendar date. `ref` is the page's category row key.
 */
export const exportBooking = z.strictObject({
  name: z.string().min(1),
  rule: z.string().min(1).nullable(),
  note: z.string().min(1).nullable(),
  day: z.int().min(0).nullable(),
  ref: z.string().min(1),
});

export const tripExportModel = z.strictObject({
  type: z.literal("trip"),
  slug: apiSlug,
  title: z.string(),
  url: z.string(),
  depth: z.enum(["full", "summary", "overview"]),
  nights: z.int().min(0),
  days: z.array(z.strictObject({ n: z.int().min(0), title: z.string(), base: z.string().nullable() })),
  stops: z.array(exportStop),
  /** The trip's bookings in day order; `[]` when the plan has none. */
  bookings: z.array(exportBooking),
  waypoints: z.array(exportWaypoint),
  lines: z.array(exportLine),
  tz: z.string().nullable(),
  seasonLabel: z.string().nullable(),
  skipped: z.int().min(0),
});

export const placeExportModel = z.strictObject({
  type: z.literal("place"),
  slug: apiSlug,
  title: z.string(),
  url: z.string(),
  kind: z.string(),
  waypoints: z.array(exportWaypoint),
  lines: z.array(exportLine),
  skipped: z.int().min(0),
});

/** The body of a `json` export, parsed (case K20). */
export const exportModel = z.discriminatedUnion("type", [tripExportModel, placeExportModel]);

export type ExportQuery = z.infer<typeof exportQuery>;
export type ExportFile = z.infer<typeof exportFile>;
export type ExportModel = z.infer<typeof exportModel>;
