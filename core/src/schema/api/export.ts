// Exports (L5 copy, export and share): one item per request, never a list (P8, contract case K6).
import { z } from "zod";
import { apiSlug } from "./common.ts";
import { tripProfile } from "./trip.ts";

export const EXPORT_TYPES = ["trip", "place"] as const;
export const EXPORT_FORMATS = ["ics", "csv", "kml", "gpx", "print"] as const;

/**
 * `ExportQuery`: one trip or one place, one format. `slug` is a single slug (a comma or a list is `invalid_input`). A trip export is
 * scheduled for `profile` (the timeline's URL keys, overrides `d` and additions `add` included); a place export ignores it.
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
 * points written but labelled approximate.
 */
export const exportFile = z.strictObject({
  filename: z.string().min(1).max(160).regex(/^[a-z0-9][a-z0-9.-]*$/),
  mime: z.string().min(1),
  body: z.string(),
  source: z.string(),
  skipped: z.int().min(0),
  approx: z.int().min(0),
});

export type ExportQuery = z.infer<typeof exportQuery>;
export type ExportFile = z.infer<typeof exportFile>;
