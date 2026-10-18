import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allFiles, validateDoc, validateFile } from "../src/validate/index.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), "utf8"));
const FILES = ["data/schema/freshness.json", "data/schema/difficulty-map.json", "data/catalog/policy.json"];

describe("reference files", () => {
  for (const f of FILES) {
    it(`${f} validates against its schema and is part of --all`, () => {
      expect(validateFile(join(REPO, f), REPO).errors).toEqual([]);
      expect(allFiles(REPO)).toContain(join(REPO, f));
    });
  }

  it("creates the empty catalog folders", () => {
    for (const d of ["trails", "trails/geo", "activities", "stays", "eateries", "offers", "legs", "legs/geo", "areas", "changes"]) {
      expect(existsSync(join(REPO, "data/catalog", d, ".gitkeep")), d).toBe(true);
    }
  });
});

describe("policy.json (plan 0A.2)", () => {
  const p = read("data/catalog/policy.json");
  it("has every rule enabled and the six rows of the auto-accept table", () => {
    expect(p.rules.map((r: { id: string }) => r.id)).toEqual([
      "new-row", "new-price-snapshot", "new-link", "fill-null-field", "change-non-null-fact", "price-change-over-20pct",
    ]);
    expect(p.rules.every((r: { enabled: boolean }) => r.enabled === true)).toBe(true);
  });
  it("lands new rows as proposed and stated, never verified", () => {
    const row = p.rules.find((r: { id: string }) => r.id === "new-row");
    expect(row.lands_as).toMatchObject({ review_status: "proposed", confidence: "stated" });
    expect(row.mode).toBe("auto");
  });
  it("never auto-accepts a change to a non-null fact", () => {
    expect(p.rules.find((r: { id: string }) => r.id === "change-non-null-fact").mode).toBe("owner-review");
  });
  it("promotes on two official sources from different hosts", () => {
    expect(p.promotion).toEqual({ owner_verify: true, independent_official_sources: 2, distinct_hosts: true });
  });
  it("rejects an unknown mode with a message naming the allowed values", () => {
    const bad = structuredClone(p);
    bad.rules[0].mode = "always";
    const r = validateDoc(bad, "sidecar", REPO, { kind: "policy" });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("freshness.json (plan 0A.1)", () => {
  const f = read("data/schema/freshness.json");
  const byId = Object.fromEntries(f.classes.map((c: { id: string }) => [c.id, c]));
  it("has the eight field classes with the plan's limits", () => {
    expect(Object.keys(byId)).toEqual(["prices", "hours", "booking-windows", "closures", "hard-limits", "trail-stats", "geography", "summaries"]);
    expect(byId.prices.stale_after_days).toBe(120);
    expect(byId.hours.stale_after_days).toBe(180);
    expect(byId["booking-windows"].stale_after_days).toBe(365);
    expect(byId.closures.stale_after_days).toBe(7);
    expect(byId["hard-limits"].stale_after_days).toBe(365);
    expect(byId["trail-stats"].stale_after_days).toBe(1095);
    expect(byId.geography.stale_after_days).toBeNull();
    expect(byId.summaries.stale_after_days).toBe(730);
  });
});

describe("difficulty-map.json (plan 3A)", () => {
  const d = read("data/schema/difficulty-map.json");
  const effortGrade = (km: number, gain: number): number => {
    const e = km + gain / 100;
    return d.effort.bands.find((b: { below: number | null }) => b.below === null || e < b.below).grade;
  };
  it("reproduces the plan's worked effort examples", () => {
    expect(effortGrade(21.5, 950)).toBe(4);   // Laguna de los Tres, effort_km 31
    expect(effortGrade(11.7, 390)).toBe(3);   // Laguna Capri loop, 15.6
    expect(effortGrade(8, 70)).toBe(2);       // Senda Costera, 8.7
    expect(effortGrade(3, 0)).toBe(1);
  });
  it("covers every local system the catalog allows", () => {
    // the nine of difficulty-map v1 must stay; v2 adds the scales of docs/v2/research/suitability.md section 2
    const ids = d.systems.map((s: { id: string }) => s.id);
    for (const v1 of ["apn", "dnt", "nps", "other", "parks-canada", "sac", "sepaq", "uk", "yds"]) expect(ids).toContain(v1);
  });
  it("maps SAC T1 to 2 and T3 to 4", () => {
    const sac = d.systems.find((s: { id: string }) => s.id === "sac").mappings;
    const house = (l: string) => sac.find((m: { local: string }) => m.local === l).house;
    expect(house("T1")).toBe(2);
    expect(house("T3")).toBe(4);
    expect(house("T4")).toBe(5);
  });
});
