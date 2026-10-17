import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dedupe, dedupeSidecars } from "../../src/research/dedupe.ts";
import { findSidecars } from "../../src/research/index.ts";
import { FIXROOT, SIDECARS, deps, tmpRoot } from "../catalog/util.ts";

const doc = (p: string) => JSON.parse(readFileSync(join(FIXROOT, p), "utf8"));

describe("research.dedupe", () => {
  it("groups the same trail seen in two sidecars as the same entity (by id) and a near-duplicate stay as possible", async () => {
    const r = dedupe(tmpRoot(), await deps());
    const trail = r.groups.find((g) => g.entity === "trails" && g.members[0]!.id.endsWith("laguna-de-los-tres"))!;
    expect(trail.kind).toBe("same");
    expect(trail.members.map((m) => m.path).sort()).toEqual([
      "research/trips/patagonia-fixture/trails-corroborate.json", "research/trips/patagonia-fixture/trails-update.json", "research/trips/patagonia-fixture/trails.json",
    ]);
    const stay = r.groups.find((g) => g.entity === "stays")!;
    expect(stay.kind).toBe("possible");
    expect(stay.members.map((m) => m.name).sort()).toEqual(["Hosteria El Pilar", "Hosteria Pilar"]);
    // distinct things stay apart
    expect(r.groups.find((g) => g.members.some((m) => m.name === "Senda Costera") && g.members.some((m) => m.name === "Laguna de los Tres"))).toBeUndefined();
  });

  it("uses the offer matcher: provider plus product", async () => {
    const a = doc(SIDECARS.adventure);
    const b = JSON.parse(JSON.stringify(a));
    b.records.offers[0].product = "Banff Gondola Ticket";
    b.records.offers[0].match = { provider: "Banff Jasper Collection", product: "Banff Gondola Ticket" };
    delete b.records.offers[0].book_url;
    const r = dedupeSidecars([{ path: "a.json", doc: a }, { path: "b.json", doc: b }], await deps());
    const g = r.groups.find((x) => x.entity === "offers")!;
    expect(g.kind).toBe("possible");
    expect(g.by).toBe("provider+product");
  });

  it("keeps facts that disagree side by side as conflicts and ignores agreement and gaps", async () => {
    const base = doc(SIDECARS.trails);
    const mk = (value: unknown, confidence = "stated") => ({ ...base, facts: [{ key: "piratour.min_age", value, unit: "years", confidence, src: ["src-0001"], gap_reason: null, subject_ref: null }] });
    const r = dedupeSidecars([{ path: "a.json", doc: mk(6) }, { path: "b.json", doc: mk(8) }, { path: "c.json", doc: mk(null, "gap") }], await deps());
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]!.key).toBe("piratour.min_age");
    expect(r.conflicts[0]!.values.map((v) => [v.path, v.value])).toEqual([["a.json", 6], ["b.json", 8]]);
    expect(dedupeSidecars([{ path: "a.json", doc: mk(6) }, { path: "b.json", doc: mk(6) }], await deps()).conflicts).toEqual([]);
  });

  it("finds sidecars the way the index does", () => {
    expect(findSidecars(tmpRoot()).length).toBe(10);
  });
});
