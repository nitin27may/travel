// The keep-or-drop rule in the property registry (spec docs/v2/features/catalogue-intake-and-storage.md 2; owner Q170; RIS-C).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KEEP_CODE, KEEP_REASONS, PROPERTIES, PROPERTY_BY_KEY, emptyKeep, keepOf, type PropertyDef } from "../../src/schema/capture/properties.ts";
import { CAPTURE_RECORD_KEYS, CAPTURE_SCHEMA_KEYS, keepClassOf, unknownRecordKeys } from "../../src/validate/keep.ts";
import { REPO } from "../capture/helpers.ts";

const keep = (k: string) => PROPERTY_BY_KEY.get(k)!.keep;

describe("keep lists on the registry", () => {
  it("K1 to K7 are the seven reasons, in order", () => {
    expect(KEEP_REASONS).toEqual(["decision", "display", "filter", "check", "money", "proof", "freshness"]);
    expect(KEEP_REASONS.map((r) => KEEP_CODE[r])).toEqual(["K1", "K2", "K3", "K4", "K5", "K6", "K7"]);
  });
  it("every property serves at least one reason, and only known ones", () => {
    expect(PROPERTIES.length).toBeGreaterThanOrEqual(239);
    expect(emptyKeep(PROPERTIES)).toEqual([]);
    for (const p of PROPERTIES) expect(p.keep, p.key).toEqual(KEEP_REASONS.filter((r) => p.keep.includes(r)));
  });
  it("fails a property with an empty keep list or an unknown reason", () => {
    const base = PROPERTY_BY_KEY.get("season")!;
    const bad: PropertyDef[] = [{ ...base, key: "x_empty", keep: [] }, { ...base, key: "x_typo", keep: ["display", "shown" as never] }, base];
    expect(emptyKeep(bad)).toEqual(["x_empty", "x_typo"]);
  });
  it("derives the default from what the registry already says: display levels, filters, Rest!, groups, triggers, money and proof keys", () => {
    expect(keep("price")).toEqual(["decision", "display", "filter", "check", "money"]);
    expect(keep("min_age")).toEqual(["decision", "display", "check"]);
    expect(keep("effort.drivers.distance_km")).toEqual(["decision", "display", "filter"]);
    expect(keep("wikidata")).toEqual(["decision", "display", "proof"]);
    expect(keep("closures")).toEqual(["decision", "display", "check"]);
    expect(keep("access_cost")).toContain("money");
    expect(keep("photos")).toEqual(["display"]);
    expect(keep("sun_loss")).toEqual(["display"]);
    // the derivation is a pure function of the definition, so a test can feed it any row
    const { keep: _k, ...season } = PROPERTY_BY_KEY.get("season")!;
    void _k;
    expect(keepOf({ ...season, display: [], filter: undefined, base: "N", group: "type_facts", trigger: undefined, key: "x" })).toEqual([]);
  });
});

describe("E_KEEP_UNKNOWN: every capture/1 record key has a keep class", () => {
  it("each key of the record schema is a registry property, a schema key or meta", () => {
    for (const k of CAPTURE_RECORD_KEYS) expect(keepClassOf(k), k).not.toBeNull();
    expect(keepClassOf("meta")).toBe("meta");
    for (const k of CAPTURE_SCHEMA_KEYS) expect(CAPTURE_RECORD_KEYS, k).toContain(k);
    // the schema keys are not properties: if one becomes a property, it leaves the list
    for (const k of CAPTURE_SCHEMA_KEYS) expect(PROPERTY_BY_KEY.has(k), k).toBe(false);
  });
  it("names the keys outside the rule, and leaves reached_by to its own code", () => {
    expect(unknownRecordKeys({ ref: "place/x", type: "water.body.lake", layer: "place", name: "X", meta: { schema_version: 1 } })).toEqual([]);
    expect(unknownRecordKeys({ ref: "place/x", colour: "blue", batch: "D7-R", reached_by: [] })).toEqual(["colour", "batch"]);
  });
});

describe("the properties without a home (TODO data, not code)", () => {
  const todo = JSON.parse(readFileSync(join(REPO, "data/vocab/homeless-properties.json"), "utf8")) as { schema: string; properties: { key: string; plan: string }[] };
  it("lists exactly the registry properties with home none, so the list only shrinks when a home lands", () => {
    expect(todo.schema).toBe("homeless-properties/1");
    const homeless = PROPERTIES.filter((p) => p.home.in === "none").map((p) => p.key).sort();
    expect(todo.properties.map((p) => p.key).sort()).toEqual(homeless);
    // 43 on 25 Oct 2026 (spec 1.1), 36 after RIS-H (26 Oct): may only fall
    expect(homeless.length).toBeLessThanOrEqual(36);
  });
  it("RIS-H homed its seven (DATA-PLAN row 24); transit and last_transport wait as later; every entry has a plan", () => {
    for (const k of ["duration_min", "activity_min", "book_url", "closures", "check_in_out", "fills_by", "groceries"]) {
      expect(PROPERTY_BY_KEY.get(k)!.home, k).toEqual({ in: "capture", path: k });
      expect(todo.properties.some((p) => p.key === k), k).toBe(false);
    }
    expect(todo.properties.filter((p) => p.plan === "RIS-H")).toEqual([]);
    for (const p of todo.properties) expect(["RIS-H", "later"], p.key).toContain(p.plan);
  });
});

describe("freshness classes are keyed by registry keys (conflict C4)", () => {
  const f = JSON.parse(readFileSync(join(REPO, "data/schema/freshness.json"), "utf8")) as { schema_version: number; classes: { id: string; fields: string[] }[] };
  it("version 2: every field is a registry property, and none sits in two classes", () => {
    expect(f.schema_version).toBe(2);
    const seen = new Map<string, string>();
    for (const c of f.classes) for (const k of c.fields) {
      expect(PROPERTY_BY_KEY.has(k), `${c.id}: ${k}`).toBe(true);
      expect(seen.get(k), `${k} in ${c.id} and ${seen.get(k)}`).toBeUndefined();
      seen.set(k, c.id);
    }
  });
  it("keeps the eight classes of plan 0A.1 and covers the safety and money keys", () => {
    expect(f.classes.map((c) => c.id)).toEqual(["prices", "hours", "booking-windows", "closures", "hard-limits", "trail-stats", "geography", "summaries"]);
    const of = (k: string) => f.classes.find((c) => c.fields.includes(k))?.id;
    expect(of("price")).toBe("prices");
    expect(of("hours")).toBe("hours");
    expect(of("window")).toBe("booking-windows");
    expect(of("closures")).toBe("closures");
    expect(of("min_age")).toBe("hard-limits");
    expect(of("effort.drivers.distance_km")).toBe("trail-stats");
    expect(of("point")).toBe("geography");
  });
});
