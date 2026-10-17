import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndex, countGaps, indexText, writeIndex } from "../../src/research/index.ts";
import { tmpRoot } from "../catalog/util.ts";

describe("research.index", () => {
  it("lists every sidecar once with lane, subject, geo, counts and gaps, sorted by path", () => {
    const root = tmpRoot();
    const idx = buildIndex(root) as { sidecars: any[] };
    expect(idx.sidecars.map((s) => s.path)).toEqual([
      "research/trips/patagonia-fixture/trails-badarea.json",
      "research/trips/patagonia-fixture/trails-corroborate.json",
      "research/trips/patagonia-fixture/trails-incomplete.json",
      "research/trips/patagonia-fixture/trails-update.json",
      "research/trips/patagonia-fixture/trails-weak.json",
      "research/trips/patagonia-fixture/trails.json",
      "research/trips/rockies-fixture/adventure-price-jump.json",
      "research/trips/rockies-fixture/adventure.json",
      "research/trips/stays-fixture/stays-duplicate.json",
      "research/trips/stays-fixture/stays.json",
    ]);
    const trails = idx.sidecars.find((s) => s.path.endsWith("patagonia-fixture/trails.json"))!;
    expect(trails).toMatchObject({
      lane: "trails", subject: { kind: "trip", id: "patagonia-fixture" }, researched: "2026-10-13",
      geo: { countries: ["AR"], regions: [], areas: ["AR/santa-cruz/el-chalten", "AR/tierra-del-fuego/ushuaia"] },
      styles: ["adventure"], gaps: 1, md: "research/trips/patagonia-fixture/trails.md",
    });
    expect(trails.counts).toEqual({ sources: 3, facts: 1, records: { trails: 3 } });
    const adv = idx.sidecars.find((s) => s.path.endsWith("rockies-fixture/adventure.json"))!;
    expect(adv.counts.records).toEqual({ activities: 3, offer_prices: 2, offers: 1 });
  });

  it("is deterministic: the same files give the same bytes, and a second write changes nothing", () => {
    const root = tmpRoot();
    const a = indexText(root);
    expect(indexText(root)).toBe(a);
    expect(writeIndex(root)).toBe(true);
    expect(readFileSync(join(root, "research/INDEX.json"), "utf8")).toBe(a);
    expect(writeIndex(root)).toBe(false);
  });

  it("skips the inbox, INDEX.json itself and JSON that is not a sidecar", () => {
    const root = tmpRoot();
    mkdirSync(join(root, "research/inbox"), { recursive: true });
    writeFileSync(join(root, "research/inbox/2026-10-17-x.json"), JSON.stringify({ schema: "research-sidecar/1", lane: "x" }));
    writeFileSync(join(root, "research/trips/rockies-fixture/photos.json"), JSON.stringify({ photos: [] }));
    writeFileSync(join(root, "research/trips/rockies-fixture/broken.json"), "{ not json");
    const before = (buildIndex(root) as any).sidecars.length;
    writeIndex(root);
    expect((buildIndex(root) as any).sidecars.length).toBe(before);
    expect(before).toBe(10);
  });

  it("counts a gap fact and a gap on a record", () => {
    expect(countGaps({ facts: [{ confidence: "gap" }, { confidence: "stated" }], records: { trails: [{ gaps: [{ field: "a" }] }, { confidence: "gap" }, {}] } })).toBe(3);
  });
});
