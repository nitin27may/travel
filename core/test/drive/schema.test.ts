// The drive data files (driving-time-model.md 5.1 to 5.5, 5.7): schemas, the cross-file rules, display rounding, and purity of the
// modules a client chunk or a route handler may import.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { driveDataProblems } from "../../src/drive/check.ts";
import { displayMinutes, isApproximate, keepWithin } from "../../src/drive/display.ts";
import { DRIVE_FILES, registryAreaIds } from "../../src/drive/load.ts";
import { areasFile, crossingsFile, profileFile, segmentRow, segmentsFile, type ProfileRow } from "../../src/drive/schema.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), "utf8"));
const SRC = { url: "https://example.org/x", title: "a source", read: "2026-10-27" };

describe("data/reference/drive files", () => {
  it("parse with their schemas", () => {
    expect(profileFile.safeParse(read(DRIVE_FILES.countries)).success).toBe(true);
    expect(areasFile.safeParse(read(DRIVE_FILES.areas)).success).toBe(true);
    expect(crossingsFile.safeParse(read(DRIVE_FILES.crossings)).success).toBe(true);
    expect(segmentsFile.safeParse(read(DRIVE_FILES.segments)).success).toBe(true);
  });

  it("seed only the countries with routed legs (CA with its subdivisions, IT), each with a source and read date", () => {
    const rows = profileFile.parse(read(DRIVE_FILES.countries)).rows;
    expect([...new Set(rows.map((r) => r.cc))].sort()).toEqual(["CA", "IT"]);
    expect(rows.find((r) => r.cc === "IT" && !r.sub)!.legal).toMatchObject({ urban: 50, rural: 90, expressway: 110, motorway: 130 });
    expect(rows.find((r) => r.sub === "AB")!.legal.rural).toBe(100);
    for (const r of rows) expect(r.legalSource.url).toMatch(/^https:\/\//);
  });

  it("the CC BY-SA legal table is never merged into the authored profile", () => {
    const doc = read(DRIVE_FILES.countries);
    expect(doc.licence).toMatch(/separate/);
    expect(JSON.stringify(doc)).not.toMatch(/legal_default_speeds/);
  });
});

describe("cross-file rules", () => {
  const base = profileFile.parse(read(DRIVE_FILES.countries)).rows;
  const ids = registryAreaIds(REPO);
  const empty = { profiles: base, areas: [], crossings: [], segments: [], calibration: null };

  it("the committed files pass", () => {
    const areas = areasFile.parse(read(DRIVE_FILES.areas)).rows;
    expect(driveDataProblems({ ...empty, areas }, ids)).toEqual([]);
  });

  it("refuses an unknown area, a duplicate row, a subdivision without its country, a self-neighbour", () => {
    const area = { area: "CA/AB/not-an-area", terrain: "mountain" as const, basis: "prior" as const, unpavedShare: 0, winterFactor: null, note: "x y z" };
    const sub: ProfileRow = { ...base[1]!, cc: "FR", sub: "ARA" };
    const self: ProfileRow = { ...base[0]!, borderDefaultMin: { CA: 1 } };
    const out = driveDataProblems({ ...empty, profiles: [self, ...base.slice(1), base[1]!, sub], areas: [area] }, ids).join("\n");
    expect(out).toMatch(/not-an-area is not an area/);
    expect(out).toMatch(/CA-AB has more than one row/);
    expect(out).toMatch(/FR-ARA has no country row FR/);
    expect(out).toMatch(/names its own country/);
  });

  it("a crossing must name registry areas; a segment needs refs or a line and its rule's value", () => {
    const row = { id: "x", from: "CA/AB/banff-national-park", to: "CA/AB/nope", kind: "ferry" as const, via: null, symmetric: true, minutes: 30, checkinMin: null, headwayMin: null, months: null, source: SRC };
    expect(driveDataProblems({ ...empty, crossings: [row] }, ids).join("\n")).toMatch(/nope/);
    expect(crossingsFile.safeParse({ schema: "drive-crossings/1", about: "a test file", rows: [{ ...row, kind: "closed-season" }] }).success).toBe(false);
    expect(segmentRow.safeParse({ id: "s", rule: "closed", note: "abc", source: SRC }).success).toBe(false);
    expect(segmentRow.safeParse({ id: "s", refs: ["place/x"], rule: "fixed", note: "abc", source: SRC }).success).toBe(false);
    expect(segmentRow.safeParse({ id: "s", refs: ["place/x"], rule: "slow", note: "abc", source: SRC }).success).toBe(false);
    expect(segmentRow.safeParse({ id: "s", refs: ["place/x"], rule: "slow", factor: 1.5, months: [6, 7], note: "abc", source: SRC }).success).toBe(true);
    expect(segmentRow.safeParse({ id: "s", refs: ["place/x"], rule: "closed", months: [13], note: "abc", source: SRC }).success).toBe(false);
  });
});

describe("display (spec 4.6, 4.2)", () => {
  it("rounds to 5 under 1 h, 10 to 4 h, 15 above", () => {
    expect([1, 7, 58, 61, 66, 239, 241, 248].map(displayMinutes)).toEqual([5, 5, 60, 60, 70, 240, 240, 255]);
  });
  it("marks modelled and rough figures approximate; keeps routed at the limit and modelled at x 0.75", () => {
    expect(isApproximate({ confidence: "modelled" })).toBe(true);
    expect(isApproximate({ confidence: "routed" })).toBe(false);
    expect(keepWithin({ minutes: 200, confidence: "modelled" }, 180)).toBe(true);
    expect(keepWithin({ minutes: 200, confidence: "routed" }, 180)).toBe(false);
    expect(keepWithin({ minutes: null, confidence: "none" }, 180)).toBe(false);
  });
});

/** Module specifiers a pure file may not import (the rule of core/test/purity/pure-modules.test.ts). */
const violations = (src: string): string[] =>
  [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g)]
    .map((m) => m[2]!)
    .filter((x) => /^(node:)?(fs|path|child_process|os)(\/|$)/.test(x) || /^(react|next)(\/|$)/.test(x) || x.startsWith("@/") || /(^|\/)web\//.test(x));

describe("pure modules (no fs, no React, no web)", () => {
  const dir = fileURLToPath(new URL("../../src/drive/", import.meta.url));
  const NODE_ONLY = new Set(["load.ts", "golden.ts", "cli.ts"]);
  it("the rule catches a Node-only module", () => expect(violations(readFileSync(join(dir, "load.ts"), "utf8"))).toContain("node:fs"));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts") && !NODE_ONLY.has(x))) {
    it(f, () => expect(violations(readFileSync(join(dir, f), "utf8"))).toEqual([]));
  }
});
