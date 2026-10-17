// Common block of every catalog row (plan 2.3A) and the per-file sources table.
import { z } from "zod";
import * as E from "../enums.ts";
import { date, enumOf, idList, int, json, monthList, pattern, real, strList, table, text, url } from "../meta.ts";

/** provenance columns shared by every catalog row, including legs and area guides */
export function provenance(): Record<string, z.ZodType> {
  return {
    review_status: enumOf(E.REVIEW_STATUS, { ui: { label: "Review status", facet: true } }),
    confidence: enumOf(E.CONFIDENCE, { ui: { label: "Confidence", facet: true } }),
    sources: idList(),
    field_meta: json(z.record(z.string(), z.unknown())),
    verified_by: text({ null: true }),
    last_verified: date({ null: true }),
    contributed_by: idList(),
    licence: enumOf(E.LICENCE),
    merged_from: idList(),
    updated: date(),
  };
}

/** the full common block; `id` first, then geography and limits, then provenance */
export function common(): Record<string, z.ZodType> {
  return {
    id: text({ min: 1 }),
    area_id: text({ min: 1, fk: "areas.id", ui: { label: "Area", facet: true } }),
    name: text({ min: 1, ui: { label: "Name" } }),
    name_lang: text({ null: true }),
    tags: strList({ fk: "tags.id" }),
    kid_fit: enumOf(E.KID_FIT, { ui: { label: "Kid fit", facet: true } }),
    min_age: int({ null: true, min: 0 }),
    max_age: int({ null: true, min: 0 }),
    min_height_cm: int({ null: true, min: 0 }),
    max_height_cm: int({ null: true, min: 0 }),
    min_weight_kg: int({ null: true, min: 0 }),
    max_weight_kg: int({ null: true, min: 0 }),
    house_grade: int({ null: true, min: 1, max: 5, ui: { label: "House grade", facet: true } }),
    walk_km: real({ null: true, min: 0 }),
    walk_gain_m: int({ null: true, min: 0 }),
    duration_min: int({ null: true, min: 0 }),
    accessibility: enumOf(E.ACCESSIBILITY),
    season_months: monthList(),
    cost_ref: text({ null: true }),
    lat: real({ null: true, min: -90, max: 90 }),
    lon: real({ null: true, min: -180, max: 180 }),
    ...provenance(),
  };
}

export const LATLON_CHECK = "CHECK ((lat IS NULL) = (lon IS NULL))";
export const CATALOG_INDEXES = [["review_status"], ["last_verified"], ["area_id"]];

/** every catalog file carries its own sources table */
export const catalogSources = table("sources", {
  id: pattern(/^src-\d{4,}$/),
  url: url(),
  title: text(),
  publisher: text(),
  kind: enumOf(E.SOURCE_KIND),
  read: date(),
}, {
  family: "catalog", pk: ["id"], ui: { label: "Sources" },
  sql: {
    name: "catalog_sources",
    // ids restart in every file, so a source is keyed by the file it came from, e.g. "trails/AR"
    lead: [{ name: "file", ddl: "file TEXT NOT NULL" }],
  },
});

