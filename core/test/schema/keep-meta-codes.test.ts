// Every keep and RowMeta code with a failing case through the validator, and the families that gained an optional `meta`, an
// `estimate`, outcome `ask`, capture-points/2 and capture-changeset/1 (RIS-C). Real lane files are read and changed in memory only:
// nothing under data/ is written.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiAnyVal } from "../../src/schema/api/val.ts";
import { capturePointsFile } from "../../src/schema/capture/points.ts";
import { val } from "../../src/schema/suitability.ts";
import { z } from "zod";
import {
  KEEP_ERROR_LIST, KEEP_WARNING_LIST, META_ERROR_LIST, META_WARNING_LIST, detect, validateDoc, validateFile,
} from "../../src/validate/index.ts";
import { KEEP_ENFORCEMENT, NOTE_MAX, QUOTE_WARN, SUMMARY_MAX, keepFindings, levelOfKeep } from "../../src/validate/keep.ts";
import { REPO, capDoc, scope, scratchRoot } from "../capture/helpers.ts";

const errs = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const warns = (r: { warnings: { code: string }[] }) => [...new Set(r.warnings.map((e) => e.code))].sort();
const read = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), "utf8")) as Record<string, any>;
const covered = new Set<string>();
const seen = <R extends { errors: { code: string }[]; warnings: { code: string }[] }>(r: R): R => {
  for (const e of [...r.errors, ...r.warnings]) covered.add(e.code);
  return r;
};

/** a scratch root whose scope resolves one place and lists one operator */
function root(): string {
  return scratchRoot({
    "data/suitability/scope.json": scope(["lago-di-braies"]),
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-18", operators: [{ ref: "operator/wild-water", name: "Wild Water", url: "https://www.wildwater.com/" }] },
    "data/schema/freshness.json": read("data/schema/freshness.json"),
  });
}
const lake = (over: Record<string, unknown> = {}) => ({ ref: "place/lago-di-braies", type: "water.body.lake", layer: "place", name: "Lago di Braies", ...over });
const cap = (r: string, records: unknown[], over: Record<string, unknown> = {}) => seen(validateDoc(capDoc(records, over), "sidecar", r, { kind: "capture" }));
const SRC = { id: "src-0001", url: "https://www.wildwater.com/", title: "t", publisher: "Wild Water", kind: "operator", read: "2026-10-18" };
const season = (over: Record<string, unknown> = {}) => ({ v: [{ from: "06-01", to: "09-30", status: "open" }], state: "value", basis: "operator_info", src: ["src-0001"], ...over });

describe("capture/1 records: E_KEEP_UNKNOWN, meta, notes_private, text limits", () => {
  it("a record with meta and notes_private is valid", () => {
    const r = root();
    const res = cap(r, [lake({ notes_private: "In the Rockies plan; check the shuttle first.", meta: { schema_version: 1, run_id: "DATA-D7R", review_state: "agent_checked", research_ref: ["research/runs/DATA-D7R/run.md"] } })]);
    expect(res.errors, JSON.stringify(res.errors)).toEqual([]);
  });
  it("E_KEEP_UNKNOWN: a key outside the registry, the schema and meta, reported once and nothing else", () => {
    const r = root();
    const res = cap(r, [lake({ colour: "blue", batch: "D7-R" })]);
    expect(errs(res)).toEqual(["E_KEEP_UNKNOWN"]);
    expect(res.errors.map((e) => e.path)).toEqual(["/records/0/colour", "/records/0/batch"]);
  });
  it("notes_private is at most 1,000 characters", () => {
    const r = root();
    expect(errs(cap(r, [lake({ notes_private: "x".repeat(1001) })]))).toEqual(["E_CAP_SCHEMA"]);
    expect(errs(cap(r, [lake({ notes_private: "x".repeat(1000) })]))).toEqual([]);
  });
  it("E_META_* on a record's meta; an offer's meta is read as an offer row", () => {
    const r = root();
    expect(errs(cap(r, [lake({ meta: { schema_version: 1, colour: "blue" } })]))).toEqual(["E_META_KEY"]);
    expect(errs(cap(r, [lake({ meta: { schema_version: 1, raw_ref: "research/inbox/x.json" } })]))).toEqual(["E_META_RAWREF"]);
    expect(errs(cap(r, [lake({ meta: { schema_version: 1, searched_none: [{ what: "season", on: "2026-10-25", tried: ["https://example.org/"] }] } })]))).toEqual(["E_META_SN_PROP"]);
    expect(errs(cap(r, [lake({ meta: { schema_version: 1, origin: { from: "loc:IT/x", reason: "split" } } })]))).toEqual(["E_META_PRIVACY"]);
    expect(errs(cap(r, [lake({ meta: { schema_version: 1, freshness_class: "no-such-class" } })]))).toEqual(["E_META_SCHEMA"]);
    expect(errs(cap(r, [lake({ meta: { schema_version: 1, conflicts: Array.from({ length: 300 }, (_, i) => `evidence-reading-${i}`) } })]))).toEqual(["E_META_SIZE"]);
    expect(warns(cap(r, [lake({ meta: { schema_version: 1, conflicts: Array.from({ length: 60 }, (_, i) => `evidence-reading-${i}`) } })]))).toContain("W_META_SIZE");
    expect(errs(cap(r, [lake({ meta: { run_id: "DATA-D7R" } })]))).toEqual(["E_META_SCHEMA"]);
    expect(errs(cap(r, [lake({ meta: [] })]))).toEqual(["E_CAP_SCHEMA"]);
    // an offer row may not carry record_id either; an evidence-like table would (row-meta.test.ts)
    const offer = { ref: "offer/place/lago-di-braies#rowing", type: "water.boat.boat_rental.rowboat", layer: "offer", at: ["place/lago-di-braies"] };
    expect(cap(r, [{ ...offer, meta: { schema_version: 1, record_id: "place/lago-di-braies" } }]).errors.find((e) => e.code === "E_META_KEY")?.message).toContain("offer row");
  });
  it("E_NOTE_LONG warns (WARN mode until RIS-J) and W_QUOTE_LONG warns above 120; a short note and quote pass", () => {
    const r = root();
    const long = cap(r, [lake({ season: season({ note: "n".repeat(NOTE_MAX + 1), quote: "q".repeat(QUOTE_WARN + 1) }) })], { sources: [SRC] });
    expect(errs(long)).toEqual([]);
    expect(warns(long)).toEqual(expect.arrayContaining(["E_NOTE_LONG", "W_QUOTE_LONG"]));
    const ok = cap(r, [lake({ season: season({ note: "From the operator's season page.", quote: "Open June to September" }) })], { sources: [SRC] });
    expect(warns(ok)).not.toContain("E_NOTE_LONG");
    expect(warns(ok)).not.toContain("W_QUOTE_LONG");
    // a quote over 300 is still refused by the Val schema (A6)
    expect(errs(cap(r, [lake({ season: season({ quote: "q".repeat(301) }) })], { sources: [SRC] }))).toEqual(["E_CAP_SCHEMA"]);
  });
  it("Val.estimate: storage and API values accept the flag", () => {
    const r = root();
    expect(errs(cap(r, [lake({ season: season({ basis: "our_inference", src: [], note: "Computed from OSM ways.", estimate: true }) })]))).toEqual([]);
    expect(val(z.number()).safeParse({ v: 9.4, state: "value", basis: "our_inference", src: [], note: "OSM ways", estimate: true }).success).toBe(true);
    expect(val(z.number()).safeParse({ v: 9.4, state: "value", basis: "our_inference", src: [], estimate: "yes" }).success).toBe(false);
    expect(apiAnyVal.safeParse({ v: 9.4, state: "value", basis: "our_inference", src: [], estimate: true }).success).toBe(true);
  });
});

describe("suitability/1, relevance/1 and operators: optional meta on every record", () => {
  const SUIT = "data/suitability/dolomites-2027/R1.json";
  const REL = "data/relevance/dolomites-2027/R1.json";
  const run = (doc: unknown, kind: string, file: string) => seen(validateDoc(doc, "sidecar", REPO, { kind: kind as never }, join(REPO, file)));
  it("the shipped files keep validating with their errors unchanged; a good meta block adds none", () => {
    for (const [file, kind] of [[SUIT, "suitability"], [REL, "relevance"]] as const) {
      const before = errs(validateFile(join(REPO, file), REPO));
      const d = read(file);
      d.records[0].meta = { schema_version: 1, run_id: "DATA-D3a", review_state: "sample_checked", license: "own-words" };
      expect(errs(run(d, kind, file)), file).toEqual(before);
    }
  });
  it("a bad meta block fails with E_META_KEY in both families", () => {
    for (const [file, kind] of [[SUIT, "suitability"], [REL, "relevance"]] as const) {
      const d = read(file);
      d.records[0].meta = { schema_version: 1, colour: "blue" };
      expect(errs(run(d, kind, file)), file).toContain("E_META_KEY");
    }
  });
  it("an operator's meta is read as an operator row", () => {
    const r = root();
    const doc = { schema: "capture-operators/1", updated: "2026-10-25", operators: [{ ref: "operator/wild-water", name: "Wild Water", url: "https://www.wildwater.com/", meta: { schema_version: 1, record_id: "x" } }] };
    expect(errs(seen(validateDoc(doc, "sidecar", r, { kind: "capture-operators" })))).toEqual(["E_META_KEY"]);
    doc.operators[0]!.meta = { schema_version: 1, run_id: "DATA-D4a" } as never;
    expect(errs(validateDoc(doc, "sidecar", r, { kind: "capture-operators" }))).toEqual([]);
  });
});

describe("text limits as pure findings", () => {
  it("E_SUMMARY_LONG: a relevance summary over 160 (the relevance schema already caps `why` at 120, so this reads the shape directly)", () => {
    const f = keepFindings({ schema: "relevance/1", records: [{ ref: "place/x", why: "w".repeat(SUMMARY_MAX + 1) }] }, null);
    expect(f.map((x) => x.code)).toEqual(["E_SUMMARY_LONG"]);
    expect(f[0]!.warning).toBe(true);
    covered.add("E_SUMMARY_LONG");
    expect(keepFindings({ schema: "relevance/1", records: [{ ref: "place/x", why: "w".repeat(SUMMARY_MAX) }] }, null)).toEqual([]);
  });
  it("a conflict's note is held to the same 280", () => {
    const v = { v: 7.8, state: "value", basis: "official_info", src: ["src-0001"], conflicts: [{ v: 4.9, basis: "our_inference", src: [], note: "n".repeat(NOTE_MAX + 1) }] };
    expect(keepFindings({ schema: "suitability/1", records: [{ ref: "place/x", suitability: { effort: { drivers: { distance_km: v } } } }] }, null).map((x) => x.code)).toEqual(["E_NOTE_LONG"]);
  });
  it("severity: the measured codes warn until RIS-J; every other keep code is an error", () => {
    expect(KEEP_ENFORCEMENT).toEqual({ E_NOTE_LONG: "warn", E_SUMMARY_LONG: "warn" });
    expect(levelOfKeep("E_KEEP_UNKNOWN")).toBe("error");
    expect(levelOfKeep("E_META_KEY")).toBe("error");
    expect(levelOfKeep("W_QUOTE_LONG")).toBe("warn");
  });
});

describe("capture-points/2", () => {
  const v2 = (row: Record<string, unknown>) => capturePointsFile.safeParse({ schema: "capture-points/2", points: { "place/x": { lat: 51.1, lon: -115.5, coord_src: "osm", ...row } } });
  const SRCP = { provider: "OpenStreetMap", element: "node/470623991", url: "https://www.openstreetmap.org/node/470623991", read: "2026-10-25" };
  it("a structured row parses; the free-text point_source does not; version 1 still parses", () => {
    expect(v2({ point_src: SRCP, point_role: "trailhead", meta: { schema_version: 1, run_id: "DATA-D1b", review_state: "agent_checked", license: "ODbL-1.0" } }).success).toBe(true);
    expect(v2({ point_src: { ...SRCP, legacy: "OSM node 470623991 ... read 2026-10-25 (lane D1)" } }).success).toBe(true);
    expect(v2({ point_src: SRCP, point_source: "OSM node 1" }).success).toBe(false);
    expect(v2({ point_src: { ...SRCP, element: "osm 1" } }).success).toBe(false);
    expect(v2({}).success).toBe(false);
    expect(capturePointsFile.safeParse(read("data/capture/points.json")).success).toBe(true);
  });
  it("a competing coordinate is a conflict row with a reason", () => {
    const conflict = { lat: 51.11, lon: -115.51, coord_src: "wikidata", provider: "Wikidata", element: "Q123", note: "1.4 km from the NPS and OSM overlook." };
    expect(v2({ point_src: SRCP, conflicts: [conflict] }).success).toBe(true);
    expect(v2({ point_src: SRCP, conflicts: [{ ...conflict, note: undefined }] }).success).toBe(false);
  });
  it("its meta blocks are checked like any row's", () => {
    const doc = { schema: "capture-points/2", points: { "place/x": { lat: 51.1, lon: -115.5, coord_src: "osm", point_src: SRCP, meta: { schema_version: 1, raw_ref: "research/inbox/a.png" } } } };
    expect(keepFindings(doc, null).map((f) => f.code)).toEqual(["E_META_RAWREF"]);
  });
});

describe("capture-changeset/1 and run outcome ask", () => {
  const good = {
    schema: "capture-changeset/1", run: "DATA-D3a", by: "travel-researcher", on: "2026-10-25",
    sources: [{ id: "src-0001", url: "https://parks.canada.ca/pn-np/ab/banff", title: "Johnston Canyon", publisher: "Parks Canada", kind: "official", read: "2026-10-25" }],
    changes: [
      { file: "data/suitability/canadian-rockies-2029/R2a.json", ref: "place/johnston-canyon", op: "set", path: "suitability.access_season", value: { v: [], state: "searched_none", basis: null, src: ["src-0001"], on: "2026-10-25", tried: ["https://parks.canada.ca/"] }, why: "The official page lists the 2026 closure." },
      { file: "data/capture/canadian-rockies-2029/migrated.json", ref: "place/johnston-canyon", op: "add", path: "links", value: { kind: "official", url: "https://parks.canada.ca/pn-np/ab/banff", state: "filled" }, why: "The official page." },
    ],
  };
  const cs = (doc: unknown) => seen(validateDoc(doc, "sidecar", REPO, { kind: "capture-changeset" }));
  it("is detected under data/capture/changesets/, never read as a lane file, and a good file is valid", () => {
    expect(detect(join(REPO, "data/capture/changesets/DATA-D3a.json"), {}, REPO)).toEqual({ family: "sidecar", kind: "capture-changeset" });
    expect(detect(null, { schema: "capture-changeset/1" }, REPO)?.kind).toBe("capture-changeset");
    expect(errs(cs(good))).toEqual([]);
  });
  it("E_CAP_CHANGESET: a target outside the lane files, a set without a value, a remove with one, an unknown src, a repeat", () => {
    const mk = (i: number, over: Record<string, unknown>) => ({ ...good, changes: good.changes.map((c, j) => (j === i ? { ...c, ...over } : c)) });
    expect(errs(cs(mk(0, { file: "data/capture/migration-ledger.json" })))).toEqual(["E_CAP_CHANGESET"]);
    expect(errs(cs(mk(0, { value: undefined })))).toEqual(["E_CAP_CHANGESET"]);
    expect(errs(cs(mk(1, { op: "remove" })))).toEqual(["E_CAP_CHANGESET"]);
    expect(errs(cs(mk(0, { value: { ...good.changes[0]!.value, src: ["src-0009"] } })))).toEqual(["E_CAP_CHANGESET"]);
    expect(errs(cs({ ...good, changes: [good.changes[0], good.changes[0]] }))).toEqual(["E_CAP_CHANGESET"]);
    expect(errs(cs({ ...good, changes: [] }))).toEqual(["E_CAP_SCHEMA"]);
  });
  it("outcome ask names who and what; the fields belong to ask only; a link-only contact page fails", () => {
    const runDoc = (result: Record<string, unknown>) => ({ schema: "capture-run/1", run: "data-d4a", started: "2026-10-25", agent: "t", model: "t", scope: {}, hosts: [], results: [{ ref: "place/x", field: "min_age", ...result }] });
    const run = (d: unknown) => seen(validateDoc(d, "sidecar", REPO, { kind: "capture-run" }));
    expect(errs(run(runDoc({ outcome: "ask", to: "Alpine Stables", contact_url: "https://example.org/contact", question: "What is the weight limit for rides over 2 hours?" })))).toEqual([]);
    expect(errs(run(runDoc({ outcome: "ask", to: "Alpine Stables" })))).toEqual(["E_CAP_RUN"]);
    expect(errs(run(runDoc({ outcome: "gap", question: "x?" })))).toEqual(["E_CAP_RUN"]);
    expect(errs(run(runDoc({ outcome: "ask", to: "x", question: "y?", contact_url: "https://www.tripadvisor.com/x" })))).toEqual(["E_CAP_LINK_ONLY"]);
  });
});

describe("the code lists", () => {
  it("every keep and meta code has a case above (W_KEEP_UNREAD is RIS-N's: normalise.ts reads trip-level files)", () => {
    const all = [...KEEP_ERROR_LIST, ...KEEP_WARNING_LIST, ...META_ERROR_LIST, ...META_WARNING_LIST].filter((c) => c !== "W_KEEP_UNREAD");
    expect(all.filter((c) => !covered.has(c))).toEqual([]);
  });
});
