// The record rules of S1 and S4 (RIS-N): origin to meta, the Estimate flag, units, price year, dates, names and languages,
// privacy refusals, the meta size cap and conflicts that are kept.
import { describe, expect, it } from "vitest";
import { canonicalLanguage, noteSaysEstimate } from "../../src/normalise/records.ts";
import { rowMeta } from "../../src/schema/rowMeta.ts";
import { capDoc, place, run, val } from "./helpers.ts";

const codes = (r: { findings: { code: string }[] }) => r.findings.map((f) => f.code);

describe("origin to meta.origin", () => {
  const origin = { from: "legacy/x/trails/a", reason: "payoff of the trail" };

  it("moves the key into a meta block that passes RowMeta, and starts the block", () => {
    const r = run("capture", capDoc([place("part/legacy/x/trails/a#payoff", { origin })]));
    const rec = r.out.records[0];
    expect(rec.origin).toBeUndefined();
    expect(rec.meta).toEqual({ schema_version: 1, run_id: "TEST-1", origin });
    expect(rowMeta.safeParse(rec.meta).success).toBe(true);
    expect(r.changes.map((c) => c.rule).sort()).toEqual(["meta", "origin"]);
  });

  it("keeps every other key of the record and its order", () => {
    const r = run("capture", capDoc([place("a", { origin, area_id: "CA/AB/x" })]));
    expect(Object.keys(r.out.records[0])).toEqual(["ref", "type", "layer", "name", "area_id", "meta"]);
  });

  it("does not overwrite an existing meta key and adds to the block", () => {
    const r = run("capture", capDoc([place("a", { origin, meta: { schema_version: 1, run_id: "DATA-D1", review_state: "agent_checked" } })]));
    expect(r.out.records[0].meta).toEqual({ schema_version: 1, run_id: "DATA-D1", review_state: "agent_checked", origin });
  });

  it("REFUSES a record whose origin names a private-list key (loc:), and copies it nowhere", () => {
    const bad = { from: "loc:wl-20260101-banff", reason: "from the wishlist" };
    const r = run("capture", capDoc([place("a", { origin: bad })]));
    expect(codes(r)).toContain("E_NORM_REFUSED");
    expect(r.changes).toEqual([]);
    // the record is exactly as it was: no meta, the origin key still there for a person to fix
    expect(r.out.records[0].meta).toBeUndefined();
    expect(JSON.stringify(r.out)).not.toMatch(/"meta"/);
    expect(r.out.records[0].origin).toEqual(bad);
  });

  it("REFUSES a prototype id (proto:) the same way", () => {
    const r = run("capture", capDoc([place("a", { origin: { from: "proto:place-17", reason: "split" } })]));
    expect(codes(r)).toContain("E_NORM_REFUSED");
    expect(r.out.records[0].meta).toBeUndefined();
  });

  it("refuses a reason that holds a street address or an email (meta never holds either)", () => {
    for (const reason of ["Backlog row: depart from 2750 Beaverfoot Road, Golden", "asked bob@example.com"]) {
      const r = run("capture", capDoc([place("a", { origin: { from: "x/y", reason } })]));
      expect(codes(r)).toContain("E_NORM_REFUSED");
      expect(r.out.records[0].meta).toBeUndefined();
    }
  });

  it("size cap: a block that would pass 4 KB with the origin is refused, not written", () => {
    const fat = { schema_version: 1, work_tags: Array.from({ length: 10 }, (_, i) => `tag-${i}`), research_ref: Array.from({ length: 40 }, (_, i) => `research/runs/${"x".repeat(100)}-${i}.md`) };
    const r = run("capture", capDoc([place("a", { origin, meta: fat })]));
    expect(codes(r)).toContain("E_NORM_REFUSED");
    expect(r.out.records[0].origin).toEqual(origin);
  });

  it("a record whose origin and meta.origin differ is a conflict: both kept, nothing picked", () => {
    const r = run("capture", capDoc([place("a", { origin, meta: { schema_version: 1, origin: { from: "other/ref", reason: "other" } } })]));
    expect(codes(r)).toContain("W_NORM_CONFLICT");
    expect(r.out.records[0].origin).toEqual(origin);
    expect(r.out.records[0].meta.origin.from).toBe("other/ref");
  });

  it("is idempotent", () => {
    const once = run("capture", capDoc([place("a", { origin })]));
    const twice = run("capture", once.text);
    expect(twice.changes).toEqual([]);
    expect(twice.text).toBe(once.text);
  });
});

describe("estimate (S4)", () => {
  const ours = (note: string, over: Record<string, unknown> = {}) => val(7.8, { basis: "our_inference", note, ...over });

  it("flags a value of basis our_inference whose note says estimate", () => {
    expect(noteSaysEstimate(ours("Our estimate; the trip gives 60 min."))).toBe(true);
    expect(noteSaysEstimate(ours("Estimate, not official: 4.68 km one way, doubled."))).toBe(true);
  });

  it("does not flag a denied estimate, another basis, another state or an already flagged value", () => {
    expect(noteSaysEstimate(ours("The footprint hike alone is 4 h 40, so it is not part of this estimate."))).toBe(false);
    expect(noteSaysEstimate(ours("This is no estimate: it is read from the sign."))).toBe(false);
    expect(noteSaysEstimate({ ...ours("Our estimate"), basis: "official_info" })).toBe(false);
    expect(noteSaysEstimate({ ...ours("Our estimate"), state: "gap" })).toBe(false);
    expect(noteSaysEstimate(ours("Our estimate", { estimate: false }))).toBe(false);
    expect(noteSaysEstimate(ours("Computed from OSM ways."))).toBe(false);
  });

  it("sets Val.estimate on a suitability record and leaves every old leaf in place", () => {
    const rec = { ref: "legacy/x/trails/a", kind: "trail", subkind: "hike", suitability: { effort: { drivers: { distance_km: ours("Estimate: 9.4 km from OSM ways, doubled.") } } } };
    const r = run("suitability", { schema: "suitability/1", trip: "t", lane: "t", researched: "2026-10-18", agent: "x", model: "n", sources: [], records: [rec] });
    expect(r.out.records[0].suitability.effort.drivers.distance_km.estimate).toBe(true);
    expect(r.out.records[0].meta).toMatchObject({ schema_version: 1 });
    expect(r.changes.map((c) => c.rule)).toContain("estimate");
    expect(codes(r)).not.toContain("E_NORM_LEDGER");
  });
});

describe("units, price year, dates, names", () => {
  it("converts a text value in feet to metres and keeps the source form in meta.original", () => {
    const r = run("capture", capDoc([place("a", { high_point_m: val("1,200 ft") })]));
    expect(r.out.records[0].high_point_m.v).toBe(366);
    expect(r.out.records[0].meta.original).toEqual({ value: 1200, unit: "ft" });
  });

  it("converts miles to kilometres for a km property, and leaves a second conversion in the record as written", () => {
    const r = run("capture", capDoc([place("a", { near_town_km: val("3.5 mi"), high_point_m: val("900 ft") })]));
    expect(r.out.records[0].near_town_km.v).toBe(5.6);
    expect(r.out.records[0].high_point_m.v).toBe("900 ft");
    expect(codes(r)).toContain("W_NORM_UNIT");
  });

  it("does not touch a plain number, a text in another unit, or a unit the property does not take", () => {
    const r = run("capture", capDoc([place("a", { high_point_m: val(1500), near_town_km: val("5 lb") })]));
    expect(r.changes).toEqual([]);
  });

  it("gives a price Val the year it was read when nothing says which year it is for", () => {
    const price = val([{ amount: 12, currency: "CAD", per: "person" }]);
    const r = run("capture", capDoc([place("a", { price })]));
    expect(r.out.records[0].price.applies_to).toBe("2026");
    const keep = run("capture", capDoc([place("a", { price: val([{ amount: 12, currency: "CAD", per: "person", applies_to: "2025" }]) })]));
    expect(keep.changes).toEqual([]);
  });

  it("upper-cases a currency written in lower case, and reports one that is not ISO 4217", () => {
    const r = run("capture", capDoc([place("a", { price: val([{ amount: 12, currency: "cad", per: "person", applies_to: "2026" }]) })]));
    expect(r.out.records[0].price.v[0].currency).toBe("CAD");
    const bad = run("capture", capDoc([place("a", { price: val([{ amount: 12, currency: "ZZZ", per: "person", applies_to: "2026" }]) })]));
    expect(codes(bad)).toContain("E_NORM_CURRENCY");
  });

  it("rewrites dates that cannot be read two ways and reports the ones that can", () => {
    const r = run("capture", capDoc([place("a", { duration_min: val([60, 90], { read: "25 Oct 2026", on: "2026/10/19" }) })], { researched: "October 25, 2026" }));
    expect(r.out.researched).toBe("2026-10-25");
    expect(r.out.records[0].duration_min.read).toBe("2026-10-25");
    expect(r.out.records[0].duration_min.on).toBe("2026-10-19");
    const amb = run("capture", capDoc([place("a", { duration_min: val([60, 90], { read: "03/04/2026" }) })]));
    expect(amb.out.records[0].duration_min.read).toBe("03/04/2026");
    expect(codes(amb)).toContain("W_NORM_DATE");
    const us = run("capture", capDoc([place("a", { duration_min: val([60, 90], { read: "10/25/2026" }) })]));
    expect(us.out.records[0].duration_min.read).toBe("2026-10-25");
  });

  it("writes the name as signed (NFC, one space) and the language tags of `names` in BCP 47 case", () => {
    const r = run("capture", capDoc([place("a", { name: "  Lac  Blanc ", names: { "DE-ch": "Weisser See", fr: "Lac Blanc " } })]));
    expect(r.out.records[0].name).toBe("Lac Blanc");
    expect(r.out.records[0].names).toEqual({ "de-CH": "Weisser See", fr: "Lac Blanc" });
    expect(canonicalLanguage("zh_hant_tw")).toBe("zh-Hant-TW");
    expect(canonicalLanguage("not a tag")).toBeNull();
  });

  it("two tags that become the same language with different text are a conflict: both kept as written", () => {
    const r = run("capture", capDoc([place("a", { names: { de: "Weisser See", DE: "Weißer See" } })]));
    expect(codes(r)).toContain("W_NORM_CONFLICT");
    expect(r.out.records[0].names).toEqual({ de: "Weisser See", DE: "Weißer See" });
  });
});

describe("conflicts are kept, never picked (S3)", () => {
  it("a Val with conflicts is untouched and counted; a weaker shown value is reported", () => {
    const withConflict = val(7.8, { conflicts: [{ v: 4.9, basis: "our_inference", src: ["src-0002"], note: "OSM ways" }] });
    const r = run("capture", capDoc([place("a", { near_town_km: withConflict })]));
    expect(r.out.records[0].near_town_km.conflicts).toHaveLength(1);
    expect(codes(r)).toContain("I_NORM_CONFLICT_KEPT");
    const weak = val(7.8, { basis: "our_inference", conflicts: [{ v: 9, basis: "official_info", src: ["src-0002"] }] });
    expect(codes(run("capture", capDoc([place("a", { near_town_km: weak })])))).toContain("W_NORM_CONFLICT_SHOWN");
  });
});

describe("keep and meta checks run on the result", () => {
  it("reports E_KEEP_UNKNOWN for a record key outside the keep rule, and a long note", () => {
    const r = run("capture", capDoc([place("a", { mood: "calm", near_town_km: val(5, { note: "x".repeat(300) }) })]));
    expect(codes(r)).toEqual(expect.arrayContaining(["E_KEEP_UNKNOWN", "E_NOTE_LONG"]));
  });

  it("reports an unknown meta key as E_META_KEY", () => {
    const r = run("capture", capDoc([place("a", { meta: { schema_version: 1, colour: "red" } })]));
    expect(codes(r)).toContain("E_META_KEY");
  });
});
