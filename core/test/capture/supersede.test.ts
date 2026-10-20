import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEDGER_PATH, laneLeaves, lostLeaves, displacedRelevance, removedSuitability } from "../../src/capture/migrate.ts";
import type { Ledger } from "../../src/capture/migrate.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { EARLIER_FIGURE, applySupersedes, getAt, loadSupersedes, resolveVal } from "../../src/capture/supersede.ts";
import { checkSupersedes } from "../../src/capture/supersedeCheck.ts";
import type { SupersedesFile } from "../../src/schema/capture/records.ts";
import { REPO } from "./helpers.ts";

const file = loadSupersedes(REPO)!;
const gain = file.entries.find((e) => e.path.endsWith("gain_m"))!;
const clone = (): SupersedesFile => structuredClone(file);
const codes = (f: SupersedesFile): string[] => checkSupersedes(REPO, f).filter((i) => !i.warning).map((i) => i.code);

describe("the supersede override (contract 9.7)", () => {
  it("the shipped file is clean", () => {
    expect(checkSupersedes(REPO, file).filter((i) => !i.warning)).toEqual([]);
  });

  it("a superseded value is the shown value, with the original kept as an earlier figure", () => {
    const world = loadWorld(REPO);
    const { val, superseded } = resolveVal(world, "suitability", gain.ref, gain.path);
    const v = val as { v: number; basis: string; conflicts: { v: number; note?: string }[] };
    expect(v.v).toBe(gain.value.v);
    expect(v.basis).toBe("official_info");
    expect(superseded?.id).toBe(gain.id);
    expect(v.conflicts[0]).toMatchObject({ v: gain.was, note: EARLIER_FIGURE });
    // the figure that is now the value is not also listed as a conflict of itself
    expect(v.conflicts.some((c) => c.v === gain.value.v)).toBe(false);
  });

  it("the original is preserved: the raw world and the lane file on disk still hold it", () => {
    const raw = loadWorld(REPO, undefined, [], { supersede: false });
    expect((getAt(raw.suit.get(gain.ref)!.rec, gain.path) as { v: unknown }).v).toBe(gain.was);
    const lane = JSON.parse(readFileSync(raw.suit.get(gain.ref)!.file, "utf8")) as { records: { ref: string }[] };
    const rec = lane.records.find((r) => r.ref === gain.ref);
    expect((getAt(rec, gain.path) as { v: unknown }).v).toBe(gain.was);
  });

  it("the ledger still holds with the overrides in place", () => {
    const ledger = JSON.parse(readFileSync(join(REPO, LEDGER_PATH), "utf8")) as Ledger;
    const leaves = laneLeaves(REPO, displacedRelevance(REPO), removedSuitability(REPO));
    expect(lostLeaves(ledger.suitability, leaves.suitability)).toBe(0);
    expect(lostLeaves(ledger.relevance, leaves.relevance)).toBe(0);
  });

  it("an entry applied to a world changes the shown value and nothing else on the record", () => {
    const world = loadWorld(REPO, undefined, [], { supersede: false });
    const other = file.entries.find((e) => e.id !== gain.id && e.ref === gain.ref)!;
    const before = JSON.stringify(getAt(world.suit.get(gain.ref)!.rec, other.path));
    applySupersedes(world, { ...file, entries: [gain] });
    expect((getAt(world.suit.get(gain.ref)!.rec, gain.path) as { v: unknown }).v).toBe(gain.value.v);
    expect(JSON.stringify(getAt(world.suit.get(gain.ref)!.rec, other.path))).toBe(before);
  });

  it("an entry whose stored value moved is skipped by the reader and rejected by the validator", () => {
    const f = clone();
    f.entries[0]!.was = 1;
    const world = loadWorld(REPO, undefined, [], { supersede: false });
    applySupersedes(world, f);
    expect(world.supersedes!.size).toBe(file.entries.length - 1); // only the stale one is skipped
    expect(codes(f)).toContain("E_SUP_STALE");
  });

  it("a supersede without a source is rejected", () => {
    const f = clone();
    f.entries[0]!.value.src = [];
    expect(codes(f)).toContain("E_SUP_SRC");
  });

  it("a source that is not in the file is rejected", () => {
    const f = clone();
    f.entries[0]!.value.src = ["src-9999"];
    expect(codes(f)).toContain("E_SUP_SRC");
  });

  it("a community or inference re-read never supersedes", () => {
    const f = clone();
    f.entries[0]!.value.basis = "community";
    expect(codes(f)).toContain("E_SUP_BASIS");
    f.entries[0]!.value.basis = "our_inference";
    expect(codes(f)).toContain("E_SUP_BASIS");
  });

  it("a duplicate ref and path, an unknown record and a capture-layer entry are rejected", () => {
    const dup = clone();
    dup.entries.push({ ...dup.entries[0]!, id: "sup-0099" });
    expect(codes(dup)).toContain("E_SUP_DUP");
    const gone = clone();
    gone.entries[0]!.ref = "place/does-not-exist";
    expect(codes(gone)).toContain("E_SUP_PATH");
    const capLayer = clone();
    capLayer.entries[0]!.layer = "capture";
    expect(codes(capLayer)).toContain("E_SUP_NOT_LEDGER");
  });

  it("a value of another shape is rejected", () => {
    const f = clone();
    f.entries[0]!.value.v = "434 m";
    expect(codes(f)).toContain("E_SUP_SCHEMA");
  });
});
