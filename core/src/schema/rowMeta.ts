// RowMeta, version 1 (docs/v2/features/catalogue-intake-and-storage.md 3.3; PLAN R-131, owner Q171 of 25 Oct 2026).
//
// `meta` describes a ROW: where it came from, when, how it was checked, how to roll it back. It never holds a value a page shows
// (that is a column, `attrs` or a Val) and it is never readable by the app role (RI-6: column-list grants leave it out; the privacy
// detector lists `meta` as a private key, so a served body that carries one fails closed).
//
// One contract for the 27 catalogue and research tables of 3.3, and for the optional `meta` block on the records of the JSON
// families that load into them (5.3). Not to be confused with ./meta.ts, which builds table definitions, or with the
// `catalogue_meta` revision table (gotcha 9.1).
//
// Adding a key: an optional key is a code change only. Append it to META_KEYS with `since` set to the next version and add a test;
// no migration (the column is jsonb) and no backfill. Making a key required, renaming it or changing its meaning bumps
// ROW_META_VERSION and the normaliser rewrites the files. A key is never reused for a new meaning.
//
// Subset rule (./meta.ts): no refine, transform or lazy schemas, so `rowMeta` exports to JSON Schema
// (data/schema/generated/row-meta.json, with additionalProperties: false). Cross-key rules (which table a key may sit on, the size
// cap, raw_ref only in private tables, privacy) are core/src/validate/rowMeta.ts.
import { z } from "zod";
import { SUIT_BASIS } from "./enums.ts";

/** The RowMeta version this code writes and reads. */
export const ROW_META_VERSION = 1;
/** The hard cap per row: `pg_column_size(meta) <= 4096` in Postgres (RIS-M); here measured as UTF-8 bytes of the JSON text. */
export const META_MAX_BYTES = 4096;
/** Above this the normaliser and the validator warn: a block this large is usually prose that belongs in the archive. */
export const META_WARN_BYTES = 1024;

/** The 27 tables that get `meta jsonb not null default '{}'` (3.3). Projections, caches, `catalogue_meta` and household tables do not. */
export const META_TABLES = [
  "area", "town", "operator", "entity", "entity_alias", "offer", "relation", "entity_link", "track", "condition_report",
  "event_occurrence", "source", "dataset_file", "record_doc", "source_local", "capture_supersede", "evidence", "media",
  "suitability", "relevance", "relevance_signal", "type_node", "tag", "relevance_class", "research_gap", "change", "changeset",
] as const;
/** Private (owner-only) tables where a `raw_ref` into research/inbox/ and `privacy_class: private` are allowed (3.3). */
export const PRIVATE_META_TABLES = ["saved_source", "collection"] as const;
export type MetaTable = (typeof META_TABLES)[number] | (typeof PRIVATE_META_TABLES)[number];
export const ALL_META_TABLES: readonly MetaTable[] = [...META_TABLES, ...PRIVATE_META_TABLES];

/** Rows whose own key is not the capture ref they belong to: only these carry `record_id`. */
export const RECORD_ID_TABLES = ["evidence", "track", "media", "entity_link", "research_gap"] as const;

/** How a fact was obtained (capture contract 9.4). */
export const META_METHOD = ["read", "crawl", "api", "computed", "owner"] as const;
/** How far a row has been checked (capture contract 9.5: crawled values are proposals). */
export const REVIEW_STATE = ["proposed", "agent_checked", "sample_checked", "person_checked", "approved", "rejected"] as const;
export const PRIVACY_CLASS = ["public", "internal", "private"] as const;

/** A run id: a capture-run/1 id (`crawl-2026-10-21-ontario-parks`) or a batch id (`DATA-D7R`). */
export const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
/** A source id behind a row with no Val of its own: a registry id, or a lane-local id the loader resolves through `source_local`. */
export const META_SOURCE_ID_RE = /^(?:s-[0-9a-f]{10}|src-\d{4,})$/;
/** A repository path, relative, no `..`, no leading slash. */
export const REPO_PATH_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/]+$/;
/** A prose file (optionally with a heading anchor) under research/trips/ or research/runs/: the archive a row is explained by. */
export const RESEARCH_REF_RE = /^research\/(?:trips|runs)\/[A-Za-z0-9._\-/]+(?:#[A-Za-z0-9._\-]+)?$/;
/** An inbox path (owner captures, PRIV1). */
export const RAW_REF_RE = /^research\/inbox\/[A-Za-z0-9._\-/ ]+$/;
export const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A licence id: SPDX-like (`ODbL-1.0`, `CC-BY-SA-4.0`) or `own-words`. */
export const LICENSE_RE = /^[A-Za-z0-9][A-Za-z0-9.+-]{1,40}$/;
export const WORK_TAGS_MAX = 10;

const isoDate = z.iso.date();
const runId = z.string().regex(RUN_ID_RE);

export type MetaRequired = "always" | "loaded" | "optional";
/** Who may read a key: `internal` is researchers and the loader (never the app role); `private` is the owner's tables only. */
export type MetaPrivacy = "internal" | "private";
export interface MetaKeyDef {
  key: string;
  /** the RowMeta version that added the key */
  since: number;
  /** `always`: every block; `loaded`: every row the loader writes (stamped by it, absent from the JSON files); else optional */
  required: MetaRequired;
  /** the tables the key may appear on */
  tables: readonly MetaTable[];
  privacy: MetaPrivacy;
  /** `loader`: the loader stamps it, a JSON file never needs to */
  stamp?: "loader";
  meaning: string;
}

const ALL: readonly MetaTable[] = ALL_META_TABLES;
const PUBLIC_AND_PRIVATE = ALL;

/** Every reserved key, in the order of the spec's table (3.3). The Zod object below is built to the same list (the test pins it). */
export const META_KEYS: readonly MetaKeyDef[] = [
  { key: "schema_version", since: 1, required: "always", tables: ALL, privacy: "internal", meaning: "RowMeta version, 1" },
  { key: "record_id", since: 1, required: "optional", tables: RECORD_ID_TABLES, privacy: "internal", meaning: "the capture ref the row belongs to, when the row's own key is not that ref" },
  { key: "run_id", since: 1, required: "loaded", tables: ALL, privacy: "internal", meaning: "the run that last wrote the row (a capture-run/1 id or a batch id such as DATA-D7R)" },
  { key: "first_run_id", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the run that created the row" },
  { key: "imported_from", since: 1, required: "loaded", tables: ALL, privacy: "internal", stamp: "loader", meaning: "the repository path and sha256 of the file the loader read" },
  { key: "imported_at", since: 1, required: "optional", tables: ALL, privacy: "internal", stamp: "loader", meaning: "when the loader wrote the row" },
  { key: "source_ids", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "source ids behind a row that has no Val of its own (a track, a point, a photo)" },
  { key: "observed_on", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "when the fact was observed, when it differs from the read date" },
  { key: "basis", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "whose statement the row is (SUIT_BASIS), for rows without Vals" },
  { key: "method", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "how it was obtained: read, crawl, api, computed, owner" },
  { key: "estimate", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the whole row is an estimate (a track cut by hand, an approximate point)" },
  { key: "review_state", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "how far the row has been checked" },
  { key: "conflicts", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "ids of the evidence readings that disagree with the shown value" },
  { key: "searched_none", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "a search with no property to hold it (a duplicate check, a parent search); never a registry key" },
  { key: "original", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the value and unit as the source gave them, when the normaliser converted" },
  { key: "raw_ref", since: 1, required: "optional", tables: PRIVATE_META_TABLES, privacy: "private", meaning: "a path under research/inbox/; private tables only" },
  { key: "research_ref", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "prose files (with a heading anchor) under research/trips/ or research/runs/ that explain the row" },
  { key: "license", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the licence of the row's content: ODbL-1.0, CC-BY-SA-4.0, own-words" },
  { key: "work_tags", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "internal workflow labels, at most 10, kebab-case; never the public tag vocabulary" },
  { key: "last_checked", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the last re-read that confirmed the row" },
  { key: "freshness_class", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the class id of data/schema/freshness.json that applies" },
  { key: "ttl_days", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "an override of the class's age limit, for this row only" },
  { key: "privacy_class", since: 1, required: "optional", tables: PUBLIC_AND_PRIVATE, privacy: "internal", meaning: "public, internal or private; private only in private tables" },
  { key: "origin", since: 1, required: "optional", tables: ALL, privacy: "internal", meaning: "the record this one was split from: {from, reason}" },
];
export const META_KEY_BY_NAME: ReadonlyMap<string, MetaKeyDef> = new Map(META_KEYS.map((k) => [k.key, k]));

export const metaImportedFrom = z.strictObject({ file: z.string().regex(REPO_PATH_RE), sha256: z.string().regex(/^[0-9a-f]{64}$/) });
export const metaSearchedNone = z.strictObject({ what: z.string().min(1).max(120), on: isoDate, tried: z.array(z.string().min(1)).min(1) });
export const metaOriginal = z.strictObject({ value: z.union([z.number(), z.string().min(1).max(120)]), unit: z.string().min(1).max(20) });
export const metaOrigin = z.strictObject({ from: z.string().min(1), reason: z.string().min(1).max(280) });

/** The RowMeta v1 block. Strict: an unknown key fails (E_META_KEY). Every key but schema_version is optional here. */
export const rowMeta = z.strictObject({
  schema_version: z.number().int().min(1).max(ROW_META_VERSION),
  record_id: z.string().min(1).optional(),
  run_id: runId.optional(),
  first_run_id: runId.optional(),
  imported_from: metaImportedFrom.optional(),
  imported_at: z.iso.datetime({ offset: true }).optional(),
  source_ids: z.array(z.string().regex(META_SOURCE_ID_RE)).optional(),
  observed_on: isoDate.optional(),
  basis: z.enum(SUIT_BASIS).optional(),
  method: z.enum(META_METHOD).optional(),
  estimate: z.boolean().optional(),
  review_state: z.enum(REVIEW_STATE).optional(),
  conflicts: z.array(z.string().min(1)).optional(),
  searched_none: z.array(metaSearchedNone).optional(),
  original: metaOriginal.optional(),
  raw_ref: z.string().regex(RAW_REF_RE).optional(),
  research_ref: z.array(z.string().regex(RESEARCH_REF_RE)).optional(),
  license: z.string().regex(LICENSE_RE).optional(),
  work_tags: z.array(z.string().regex(KEBAB_RE).max(40)).max(WORK_TAGS_MAX).optional(),
  last_checked: isoDate.optional(),
  freshness_class: z.string().regex(KEBAB_RE).optional(),
  ttl_days: z.number().int().min(1).max(3650).optional(),
  privacy_class: z.enum(PRIVACY_CLASS).optional(),
  origin: metaOrigin.optional(),
});

/**
 * The `meta` slot of a family schema (capture/1, suitability/1, relevance/1, capture-points/2, capture-operators/1): any object here, so
 * the family parse never hides a meta fault behind its own schema code; the keep pass (core/src/validate/keep.ts) then checks it
 * against `rowMeta` and reports E_META_KEY, E_META_SCHEMA and the rest by name.
 */
export const rowMetaSlot = z.record(z.string(), z.unknown()).meta({ description: "RowMeta v1 (data/schema/generated/row-meta.json); checked by the keep pass, internal, never served" });

/** What the loader writes: the same block with run_id and imported_from required (3.3 "required on loaded rows"). */
export const rowMetaLoaded = rowMeta.extend({ run_id: runId, imported_from: metaImportedFrom });

export type RowMeta = z.infer<typeof rowMeta>;
export type RowMetaLoaded = z.infer<typeof rowMetaLoaded>;

/**
 * Where a `meta` block may sit in each JSON family (5.3), and the table its rows load into. `records[]` means each record of the file;
 * `points{}` each row of the points map; `.` the file itself (one row per file: a track, a windows file).
 */
export const FAMILY_META: Readonly<Record<string, { at: "records[]" | "points{}" | "operators[]" | "."; table: MetaTable }>> = {
  "capture/1": { at: "records[]", table: "entity" },
  "suitability/1": { at: "records[]", table: "suitability" },
  "relevance/1": { at: "records[]", table: "relevance" },
  "capture-points/2": { at: "points{}", table: "entity" },
  "capture-operators/1": { at: "operators[]", table: "operator" },
  "trail-track/1": { at: ".", table: "track" },
  "trip-windows/1": { at: ".", table: "record_doc" },
  "trip-base-plans/1": { at: ".", table: "record_doc" },
  "trip-season-basic/1": { at: ".", table: "record_doc" },
};

/** The JSON Schema of RowMeta v1 (data/schema/generated/row-meta.json). */
export function rowMetaJsonSchema(): Record<string, unknown> {
  const js = z.toJSONSchema(rowMeta, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "throw",
    override: (ctx) => {
      const s = ctx.jsonSchema as Record<string, unknown>;
      if (s.format === "date" || s.format === "date-time") delete s.pattern;
      if (s.maximum === Number.MAX_SAFE_INTEGER) delete s.maximum;
      if (s.minimum === Number.MIN_SAFE_INTEGER) delete s.minimum;
    },
  }) as Record<string, unknown>;
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `RowMeta v${ROW_META_VERSION}`,
    description: "Generated by node core/bin/schema.ts generate from core/src/schema/rowMeta.ts. Do not edit by hand. The row-level metadata of every catalogue and research table (docs/v2/features/catalogue-intake-and-storage.md 3.3); internal, never granted to the app role.",
    ...Object.fromEntries(Object.entries(js).filter(([k]) => k !== "$schema")),
    "x-version": ROW_META_VERSION,
    "x-max-bytes": META_MAX_BYTES,
    "x-warn-bytes": META_WARN_BYTES,
    "x-tables": [...META_TABLES],
    "x-private-tables": [...PRIVATE_META_TABLES],
    "x-keys": META_KEYS.map((k) => ({ key: k.key, since: k.since, required: k.required, privacy: k.privacy, tables: k.tables.length === ALL.length ? "all" : [...k.tables], ...(k.stamp ? { stamp: k.stamp } : {}) })),
  };
}

export const rowMetaJsonText = (): string => JSON.stringify(rowMetaJsonSchema(), null, 2) + "\n";
