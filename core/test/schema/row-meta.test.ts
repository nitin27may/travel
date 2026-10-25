// RowMeta v1 (core/src/schema/rowMeta.ts; spec docs/v2/features/catalogue-intake-and-storage.md 3.3; RIS-C acceptance).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  META_KEYS, META_MAX_BYTES, META_TABLES, PRIVATE_META_TABLES, RECORD_ID_TABLES, ROW_META_VERSION, rowMeta, rowMetaJsonSchema,
  rowMetaJsonText, rowMetaLoaded,
} from "../../src/schema/rowMeta.ts";
import { metaFindings, metaBytes } from "../../src/validate/rowMeta.ts";
import { REPO } from "../capture/helpers.ts";

const codes = (m: unknown, table: Parameters<typeof metaFindings>[2]["table"] = "entity", extra: Partial<Parameters<typeof metaFindings>[2]> = {}) =>
  [...new Set(metaFindings(m, "/meta", { table, ...extra }).filter((f) => !f.warning).map((f) => f.code))].sort();
const warns = (m: unknown, table: Parameters<typeof metaFindings>[2]["table"] = "entity") => metaFindings(m, "/meta", { table }).filter((f) => f.warning).map((f) => f.code);

/** A block that uses every key a public entity row may carry. */
const FULL = {
  schema_version: 1,
  run_id: "DATA-D7R",
  first_run_id: "crawl-2026-10-21-ontario-parks",
  imported_from: { file: "data/capture/canadian-rockies-2029/migrated.json", sha256: "a".repeat(64) },
  imported_at: "2026-10-25T10:00:00Z",
  source_ids: ["s-0123456789", "src-0004"],
  observed_on: "2026-09-12",
  basis: "official_info",
  method: "read",
  estimate: false,
  review_state: "agent_checked",
  conflicts: ["ev-1"],
  searched_none: [{ what: "duplicate of another record", on: "2026-10-25", tried: ["https://www.openstreetmap.org/"] }],
  original: { value: 4.9, unit: "mi" },
  research_ref: ["research/runs/DATA-D7R/run.md#access-seasons"],
  license: "ODbL-1.0",
  work_tags: ["r2-bar", "rockies-plan-day"],
  last_checked: "2026-10-25",
  freshness_class: "hours",
  ttl_days: 90,
  privacy_class: "internal",
  origin: { from: "legacy/canadian-rockies-sept-2029/adventures/banff-gondola", reason: "split the ticket offer from the lift" },
};

describe("RowMeta v1: the contract", () => {
  it("lists the 27 tables of 3.3 and two private tables, with no overlap", () => {
    expect(META_TABLES).toHaveLength(27);
    expect(new Set(META_TABLES).size).toBe(27);
    for (const t of PRIVATE_META_TABLES) expect(META_TABLES as readonly string[]).not.toContain(t);
    // projections, caches and the revision table carry no meta (3.3 and gotcha 9)
    for (const t of ["place_row", "place_page", "trip_row", "trip_page", "relevance_derived", "leg_cache", "catalogue_meta"]) expect(META_TABLES as readonly string[]).not.toContain(t);
  });
  it("META_KEYS is the Zod object's key list, in the spec's order, each with since, required, tables and privacy", () => {
    expect(META_KEYS.map((k) => k.key)).toEqual(Object.keys(rowMeta.shape));
    expect(META_KEYS.map((k) => k.key)).toEqual([
      "schema_version", "record_id", "run_id", "first_run_id", "imported_from", "imported_at", "source_ids", "observed_on", "basis", "method",
      "estimate", "review_state", "conflicts", "searched_none", "original", "raw_ref", "research_ref", "license", "work_tags", "last_checked",
      "freshness_class", "ttl_days", "privacy_class", "origin",
    ]);
    for (const k of META_KEYS) {
      expect(k.since, k.key).toBeGreaterThanOrEqual(1);
      expect(k.since, k.key).toBeLessThanOrEqual(ROW_META_VERSION);
      expect(k.tables.length, k.key).toBeGreaterThan(0);
      expect(k.meaning.length, k.key).toBeGreaterThan(10);
    }
    expect(META_KEYS.filter((k) => k.required === "always").map((k) => k.key)).toEqual(["schema_version"]);
    expect(META_KEYS.filter((k) => k.required === "loaded").map((k) => k.key).sort()).toEqual(["imported_from", "run_id"]);
    expect(META_KEYS.find((k) => k.key === "raw_ref")!.tables).toEqual(PRIVATE_META_TABLES);
    expect(META_KEYS.find((k) => k.key === "record_id")!.tables).toEqual(RECORD_ID_TABLES);
  });
  it("is strict: the JSON Schema has additionalProperties false, and the committed export is current", () => {
    const js = rowMetaJsonSchema() as { additionalProperties?: unknown; required?: string[]; properties: Record<string, unknown> };
    expect(js.additionalProperties).toBe(false);
    expect(js.required).toEqual(["schema_version"]);
    expect(Object.keys(js.properties)).toHaveLength(META_KEYS.length);
    expect(readFileSync(join(REPO, "data/schema/generated/row-meta.json"), "utf8")).toBe(rowMetaJsonText());
  });
  it("a full block parses; only schema_version is required; the loader's shape also needs run_id and imported_from", () => {
    expect(rowMeta.safeParse(FULL).success).toBe(true);
    expect(rowMeta.safeParse({ schema_version: 1 }).success).toBe(true);
    expect(rowMeta.safeParse({}).success).toBe(false);
    expect(rowMeta.safeParse({ schema_version: 2 }).success).toBe(false);
    expect(rowMeta.safeParse({ schema_version: 1, note: "x" }).success).toBe(false);
    expect(rowMetaLoaded.safeParse({ schema_version: 1 }).success).toBe(false);
    expect(rowMetaLoaded.safeParse({ schema_version: 1, run_id: "DATA-D7R", imported_from: FULL.imported_from }).success).toBe(true);
  });
  it("the full block is far under the cap (the 616-character point_source of today fits in about 400 bytes once structured)", () => {
    expect(metaBytes(FULL)).toBeLessThan(META_MAX_BYTES / 2);
  });
});

describe("RowMeta v1: the validator codes", () => {
  it("a good block has no finding on a public table", () => {
    expect(metaFindings(FULL,"/meta", { table: "entity", freshnessIds: new Set(["hours"]), propertyKeys: new Set(["season"]) })).toEqual([]);
  });
  it("E_META_KEY: an unknown key, a key outside its tables, a table with no meta", () => {
    expect(codes({ schema_version: 1, colour: "blue" })).toEqual(["E_META_KEY"]);
    expect(codes({ schema_version: 1, record_id: "place/x" }, "entity")).toEqual(["E_META_KEY"]);
    expect(codes({ schema_version: 1, record_id: "place/x" }, "evidence")).toEqual([]);
    expect(codes({ schema_version: 1 }, "catalogue_meta" as never)).toEqual(["E_META_KEY"]);
  });
  it("E_META_SCHEMA: not an object, no schema_version, a wrong type, an unknown freshness class", () => {
    expect(codes([1])).toEqual(["E_META_SCHEMA"]);
    expect(codes({ run_id: "DATA-D7R" })).toEqual(["E_META_SCHEMA"]);
    expect(codes({ schema_version: 1, review_state: "looked_at" })).toEqual(["E_META_SCHEMA"]);
    expect(codes({ schema_version: 1, work_tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })).toEqual(["E_META_SCHEMA"]);
    expect(codes({ schema_version: 1, research_ref: ["docs/v2/PLAN.md"] })).toEqual(["E_META_SCHEMA"]);
    expect(codes({ schema_version: 1, freshness_class: "nope" }, "entity", { freshnessIds: new Set(["hours"]) })).toEqual(["E_META_SCHEMA"]);
  });
  it("E_META_SIZE above 4 KB, W_META_SIZE above 1 KB", () => {
    const tags = (n: number) => ({ schema_version: 1, conflicts: Array.from({ length: n }, (_, i) => `evidence-reading-${i}`) });
    expect(codes(tags(300))).toEqual(["E_META_SIZE"]);
    expect(codes(tags(60))).toEqual([]);
    expect(warns(tags(60))).toEqual(["W_META_SIZE"]);
    expect(warns({ schema_version: 1 })).toEqual([]);
  });
  it("E_META_RAWREF: raw_ref and privacy_class private only in private tables", () => {
    const raw = { schema_version: 1, raw_ref: "research/inbox/2026-10-16-saved.json" };
    expect(codes(raw, "entity")).toEqual(["E_META_RAWREF"]);
    expect(codes(raw, "saved_source")).toEqual([]);
    expect(codes({ schema_version: 1, privacy_class: "private" }, "entity")).toEqual(["E_META_RAWREF"]);
    expect(codes({ schema_version: 1, privacy_class: "private" }, "collection")).toEqual([]);
  });
  it("E_META_SN_PROP: a meta search names a registry property", () => {
    const sn = (what: string) => ({ schema_version: 1, searched_none: [{ what, on: "2026-10-25", tried: ["https://example.org/"] }] });
    expect(codes(sn("season"), "entity", { propertyKeys: new Set(["season"]) })).toEqual(["E_META_SN_PROP"]);
    expect(codes(sn("a parent record"), "entity", { propertyKeys: new Set(["season"]) })).toEqual([]);
  });
  it("E_META_PRIVACY: a private origin key, household text, an email, a secret, page HTML; messages never echo the value", () => {
    const at = (s: string) => ({ schema_version: 1, origin: { from: "place/x", reason: s } });
    expect(codes({ schema_version: 1, origin: { from: "loc:CA/AB/x/y", reason: "split" } })).toEqual(["E_META_PRIVACY"]);
    expect(codes(at("Hotel idea near the lake"))).toEqual(["E_META_PRIVACY"]);
    expect(codes(at("ask someone@example.org"))).toEqual(["E_META_PRIVACY"]);
    expect(codes(at("postgres://user:pw@host/db"))).toEqual(["E_META_PRIVACY"]);
    expect(codes(at("token=abcdef123456"))).toEqual(["E_META_PRIVACY"]);
    expect(codes(at("<div class=\"x\">copied</div>"))).toEqual(["E_META_PRIVACY"]);
    expect(codes(at("split because the ticket is sold separately"))).toEqual([]);
    const f = metaFindings(at("ask someone@example.org"), "/meta", { table: "entity" });
    expect(JSON.stringify(f)).not.toContain("someone@example.org");
  });
});
