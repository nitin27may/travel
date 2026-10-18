// sources/1: the source registry (backlog 3a.7). data/sources/registry.json is DERIVED from the `sources` arrays of the
// suitability and relevance lane files by core/bin/sources.ts build; nobody edits it by hand. Subset rule (meta.ts): no
// refine, transform or lazy schemas. Cross-field rules (id is the hash of the url, entries sorted, no drift from the lane
// files) live in core/src/validate/sources.ts and `sources.ts check`.
import { z } from "zod";
import { json, pattern, table } from "./meta.ts";

export const SOURCES_SCHEMA_ID = "sources/1";
export const SOURCE_REG_KIND = ["operator", "official", "agency", "community", "editorial", "reference"] as const;
export const FACT_TYPE = ["prices_hours", "seasons_closures", "grades_geography", "rules", "general"] as const;
export const LINK_STATUS = ["unchecked", "ok", "redirect", "blocked", "broken", "error", "local"] as const;

const isoDate = z.iso.date();

const usedBy = z.strictObject({
  /** repo-relative path of the lane file */
  file: z.string().min(1),
  ref: z.string().min(1),
  /** dotted path of the value inside the record, e.g. suitability.min_age */
  field: z.string().min(1),
});

export const sourceEntry = z.strictObject({
  /** "s-" plus the first 10 hex digits of the SHA-1 of the normalised url */
  id: z.string().regex(/^s-[0-9a-f]{10}$/),
  url: z.string().min(1),
  title: z.string(),
  publisher: z.string(),
  kind: z.enum(SOURCE_REG_KIND),
  first_read: isoDate,
  last_read: isoDate,
  used_by: z.array(usedBy),
  licence_note: z.string().min(1),
  terms_note: z.string().min(1),
  recheck: z.strictObject({ cadence_days: z.number().int().min(1), fact_type: z.enum(FACT_TYPE) }),
  link: z.strictObject({ status: z.enum(LINK_STATUS), checked: isoDate.nullable() }),
});

export const sources = table("sources", {
  schema: pattern(/^sources\/1$/),
  entries: json(z.array(sourceEntry)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Source registry" } });

export type SourceEntry = z.infer<typeof sourceEntry>;
export type SourceUsedBy = z.infer<typeof usedBy>;
export type FactType = (typeof FACT_TYPE)[number];
export type LinkStatus = (typeof LINK_STATUS)[number];
export interface SourceRegistry { schema: "sources/1"; entries: SourceEntry[] }
