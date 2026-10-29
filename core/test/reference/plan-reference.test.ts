import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLAN_HUB_RE, PLAN_IATA_RE, PLAN_ORIGIN_TOKEN_RE, PLAN_REGION_RE } from "../../src/schema/plan-draft.ts";
import { referenceAirport, referenceHub, regionGroup } from "../../src/schema/reference.ts";
import { allFiles, validateDoc, validateFile } from "../../src/validate/index.ts";

// TB-RG: the builder's public reference files (hubs, airports, region groups) validate against their schemas and their cross-row rules,
// carry public points only, and fit the grammar PlanService and the plan contract read.

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), "utf8"));
const FILES = ["data/reference/hubs.json", "data/reference/airports.json", "data/reference/region-groups.json"];
const hubs = read(FILES[0]!);
const airports = read(FILES[1]!);
const groups = read(FILES[2]!);
const locations = read("data/locations/locations.json");

const inRange = (r: { lat: number; lon: number }) => r.lat >= -90 && r.lat <= 90 && r.lon >= -180 && r.lon <= 180 && !(r.lat === 0 && r.lon === 0);

describe("plan reference files", () => {
  for (const f of FILES) {
    it(`${f} validates and is part of --all`, () => {
      expect(validateFile(join(REPO, f), REPO).errors).toEqual([]);
      expect(allFiles(REPO)).toContain(join(REPO, f));
    });
  }

  it("hubs: ids unique, slugs PlanService and the origin token accept, points in range", () => {
    const ids = hubs.hubs.map((h: { id: string }) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of hubs.hubs) {
      expect(referenceHub.safeParse(h).success, h.id).toBe(true);
      expect(h.id).toMatch(PLAN_HUB_RE);
      expect(h.ref).toBe(`hub:${h.id}`);
      expect(h.ref).toMatch(PLAN_ORIGIN_TOKEN_RE);
      expect(inRange(h), h.id).toBe(true);
    }
    // the hubs Q19 and the MX brief name
    for (const id of ["toronto", "hamilton", "ottawa", "montreal", "calgary", "salt-lake-city", "las-vegas", "burlington", "venice", "bolzano", "geneva", "reykjavik"]) expect(ids).toContain(id);
  });

  it("hubs: points sit in their country (longitude is positive east)", () => {
    const at = (id: string) => hubs.hubs.find((h: { id: string }) => h.id === id);
    expect(at("reykjavik").lon).toBeLessThan(-20);
    expect(at("toronto").lon).toBeLessThan(-79);
    expect(at("venice").lon).toBeGreaterThan(12);
    expect(at("ushuaia").lat).toBeLessThan(-54);
  });

  it("airports: ids and IATA codes unique, points in range, every country we have places in is covered", () => {
    const iata = airports.airports.map((a: { iata: string }) => a.iata);
    const ids = airports.airports.map((a: { id: string }) => a.id);
    expect(new Set(iata).size).toBe(iata.length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of airports.airports) {
      expect(referenceAirport.safeParse(a).success, a.iata).toBe(true);
      expect(a.iata).toMatch(PLAN_IATA_RE);
      expect(a.ref).toMatch(PLAN_ORIGIN_TOKEN_RE);
      expect(inRange(a), a.iata).toBe(true);
    }
    const countries = new Set(airports.airports.map((a: { cc: string }) => a.cc));
    for (const c of locations.countries as { code: string }[]) expect(countries.has(c.code), c.code).toBe(true);
    // gateways the public trips fly into
    for (const code of ["YYC", "YYZ", "YUL", "YVR", "SLC", "LAS", "BTV", "VCE", "VRN", "BZO", "INN", "MUC", "GVA", "KEF", "EZE", "AEP", "USH", "FTE", "PUQ"]) expect(iata).toContain(code);
  });

  it("region groups: ids unique, the plan's group grammar, every locations region exists and sits in one group", () => {
    const ids = groups.groups.map((g: { id: string }) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set((locations.regions as { id: string }[]).map((r) => r.id));
    const seen = new Set<string>();
    for (const g of groups.groups) {
      expect(regionGroup.safeParse(g).success, g.id).toBe(true);
      expect(g.id).toMatch(PLAN_REGION_RE);
      expect(g.id.slice(0, 2).toUpperCase()).toBe(g.cc);
      for (const r of g.locations_regions) {
        expect(known.has(r), `${g.id}: ${r}`).toBe(true);
        expect(seen.has(r), r).toBe(false);
        seen.add(r);
      }
      expect(g.offered).toBe(g.places >= groups.min_places);
    }
    expect(groups.min_places).toBe(5);
  });

  it("every locations region of a grouped country is in a group", () => {
    const grouped = new Set(groups.groups.map((g: { cc: string }) => g.cc));
    const inGroups = new Set(groups.groups.flatMap((g: { locations_regions: string[] }) => g.locations_regions));
    for (const r of locations.regions as { id: string; country: string }[]) if (grouped.has(r.country)) expect(inGroups.has(r.id), r.id).toBe(true);
  });

  it("rejects a duplicate hub, an IATA code twice, a (0, 0) point and a group id in the wrong country", () => {
    const dupHub = structuredClone(hubs);
    dupHub.hubs.push(structuredClone(dupHub.hubs[0]));
    expect(validateDoc(dupHub, "sidecar", REPO, { kind: "reference-hubs" }).errors.map((e) => e.code)).toContain("E_SCHEMA");

    const dupIata = structuredClone(airports);
    dupIata.airports.push({ ...dupIata.airports[0], id: "XXXX" });
    expect(validateDoc(dupIata, "sidecar", REPO, { kind: "reference-airports" }).errors.some((e) => e.path.endsWith("/iata"))).toBe(true);

    const zero = structuredClone(airports);
    zero.airports[0].lat = 0;
    zero.airports[0].lon = 0;
    expect(validateDoc(zero, "sidecar", REPO, { kind: "reference-airports" }).errors.some((e) => e.path.endsWith("/lat"))).toBe(true);

    const far = structuredClone(hubs);
    far.hubs[0].lat = 91;
    expect(validateDoc(far, "sidecar", REPO, { kind: "reference-hubs" }).errors.length).toBeGreaterThan(0);

    const wrong = structuredClone(groups);
    wrong.groups[0].id = "zz-west";
    expect(validateDoc(wrong, "sidecar", REPO, { kind: "region-groups" }).errors.some((e) => e.path.endsWith("/id"))).toBe(true);

    const twice = structuredClone(groups);
    twice.groups[1].regions = [...twice.groups[1].regions, twice.groups[0].regions[0]];
    twice.groups[1].cc = twice.groups[0].cc;
    expect(validateDoc(twice, "sidecar", REPO, { kind: "region-groups" }).errors.some((e) => e.message.includes("two groups"))).toBe(true);
  });

  it("holds no Google-derived or private point: every row names a public source and licence", () => {
    for (const h of hubs.hubs) expect([h.source, h.licence]).toEqual(["wikidata", "CC0-1.0"]);
    for (const a of airports.airports) expect([a.source, a.licence]).toEqual(["ourairports", "public-domain"]);
    const text = JSON.stringify([hubs.hubs, airports.airports, groups.groups, hubs.source, airports.source]);
    expect(text).not.toMatch(/google|maps\.app\.goo/i);
    expect(text).not.toMatch(/home_point|HOME_POINT/);
  });
});
