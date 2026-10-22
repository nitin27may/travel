// Shared shapes of the public API (EXECUTION-PLAN 4.2, PHASE-B-START section 5): identity (`ref`, `slug`), paging, errors, the
// result envelope with its revision, and the point every detail carries.
//
// These schemas are contracts, not data tables: they are never registered in core/src/schema/index.ts REGISTRY, so
// `schema.ts generate` does not change because of them (collision C11). API-1b turns them into OpenAPI 3.1 with `z.toJSONSchema()`,
// so they keep to the subset rule of meta.ts: no refine, transform or lazy schemas.
import { z } from "zod";
import { POINT_ROLE } from "../enums.ts";
import { TOWN_ID_RE } from "../capture/points.ts";

// ---- identity ------------------------------------------------------------------------------------------------------------------

/**
 * The stable id of a row or detail (D-B2, owner Q74: `entity.id` is the ref). The capture ref verbatim when the page is built from a
 * capture record (`route/johnston-canyon`, `place/moraine-lake`, refs with spaces, `:` and `#` occur), otherwise the key the adapter
 * already uses: `loc:<locations id>` or `proto:<prototype id>`. Any URL that carries one encodes it.
 */
export const REF_MAX = 160;
export const apiRef = z.string().min(1).max(REF_MAX).meta({ description: "Stable id: the capture ref, or loc:<id> / proto:<id>" });

/** A URL slug: lower-case words joined by single hyphens (patterns 1.2). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const apiSlug = z.string().min(1).max(120).regex(SLUG_RE);

/** ISO 3166-1 alpha-2, upper case, as rows carry it; empty when the place has no country yet. */
export const apiCountry = z.string().regex(/^(?:[A-Z]{2})?$/);

/** A town id `<cc>-<admin1>-<slug>` (owner Q76, `ca-on-whitby`): the canonical value of the `city` URL key (D-B3). META-0's rule, written once. */
export const apiTownId = z.string().max(120).regex(TOWN_ID_RE);

/** An ISO date (`2026-10-21`). */
export const apiDate = z.iso.date();

/** The content hash of what the store serves (D-B6): SHA-256 hex. */
export const apiRevision = z.string().regex(/^[0-9a-f]{64}$/);

// ---- paging ----------------------------------------------------------------------------------------------------------------

/**
 * One page of a paged method. Shape only: `pageSize` above API_LIMITS.pageSize.max is refused by the store with `too_large`, so the
 * cap has one home (limits.ts). Absent values take the defaults (page 1, API_LIMITS.pageSize.default).
 */
export const apiPage = z.strictObject({
  page: z.int().min(1).optional(),
  pageSize: z.int().min(1).optional(),
});

/** A page of rows, sorted by the stored sort key with `ref` as the tiebreaker (D-B5), so every store cuts pages at the same row. */
export function paged<T extends z.ZodType>(row: T) {
  return z.strictObject({
    items: z.array(row),
    /** rows that match the query, across all pages */
    total: z.int().min(0),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    /** the next page number, or null on the last page */
    nextPage: z.int().min(2).nullable(),
  });
}

// ---- errors and the result envelope -----------------------------------------------------------------------------------------

/** Error codes and their HTTP statuses (EXECUTION-PLAN 4.2). `not_available` means a flag or a data layer is not there yet. */
export const API_ERROR_CODES = ["invalid_input", "invalid_scope", "not_found", "too_large", "not_available", "internal"] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  invalid_input: 400,
  invalid_scope: 400,
  not_found: 404,
  too_large: 413,
  not_available: 501,
  internal: 500,
};

export const apiError = z.strictObject({
  code: z.enum(API_ERROR_CODES),
  /** one plain sentence a developer can act on; never a stack, a path or a household string */
  message: z.string().min(1).max(500),
  /** machine-readable detail: the failing keys of an `invalid_input`, the cap of a `too_large` */
  details: z.record(z.string(), z.unknown()).optional(),
});

/** `Result<T>`: what every store method returns. The revision travels with the data, so a handler sets the ETag from the same read. */
export function result<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data, revision: apiRevision }),
    z.strictObject({ ok: z.literal(false), error: apiError }),
  ]);
}

// ---- points -----------------------------------------------------------------------------------------------------------------

/**
 * A point in a detail (schema diff 13.1 item 3; capture contract 3.7): every detail point says what it stands for and whether it is
 * approximate. `pointRole` is a POINT_ROLE value, or null when the record names none (the type's default role applies, capture
 * contract 3.7.1). `approx` is true only when the point is marked approximate; an approximate point counts for Where, never for a
 * distance (T5), so `near` and `nearbyForPlace` skip it and say so in `basis`.
 */
export const apiPointCore = {
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  pointRole: z.enum(POINT_ROLE).nullable(),
  approx: z.boolean(),
};

export const apiPoint = z.strictObject({
  ...apiPointCore,
  /** osm_node:<id>, osm_way:<id>, wikidata:<QID>, official:<url>, manual_pin, prototype_approx. Never Google. */
  pointSource: z.string(),
  /** who looked at the pin, or null when nobody has */
  pointChecked: z.string().nullable(),
  /** licence of the source geometry, for the export guard */
  sourceLicence: z.string(),
});

export type ApiPage = z.infer<typeof apiPage>;
export type ApiError = z.infer<typeof apiError>;
export type ApiPoint = z.infer<typeof apiPoint>;
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  nextPage: number | null;
}
export type Result<T> = { ok: true; data: T; revision: string } | { ok: false; error: ApiError };
