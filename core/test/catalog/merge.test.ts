import { describe, expect, it } from "vitest";
import { ensureSource } from "../../src/catalog/common.ts";
import type { Evidence, Row } from "../../src/catalog/common.ts";
import { applyFieldChanges, fieldEvidenceOf, mergeFields } from "../../src/catalog/merge.ts";
import type { MergeCtx } from "../../src/catalog/merge.ts";
import { deps } from "./util.ts";

const ev = (kind: string, read: string, url = `https://${kind}.example/${read}`): Evidence => ({ url, kind, read, title: "t", publisher: "p" });

/** a row whose km was stated by `kind` on `read` */
function rowWith(kind: string, read: string, km = 10): { row: Row; file: Row } {
  const file: Row = { sources: [] };
  const e = ev(kind, read, "https://old.example/x");
  const id = ensureSource(file, e);
  return { row: { id: "t", km, gain_m: null, tags: ["hiking"], official_url: null, sources: [id], field_meta: { km: { kind, read, src: [id] } } }, file };
}

async function ctx(file: Row): Promise<MergeCtx> {
  const rank = (await deps()).rank;
  return { rank, evidenceOf: (row, f) => fieldEvidenceOf(rank, row, f, file.sources) };
}

const run = async (kind: string, read: string, incoming: Row, e: Evidence[]) => {
  const { row, file } = rowWith(kind, read);
  return { row, file, changes: mergeFields(row, incoming, e, await ctx(file)) };
};

describe("merge precedence by source kind and read date", () => {
  it("fills a null field", async () => {
    const { changes } = await run("operator", "2026-10-01", { gain_m: 300 }, [ev("blog", "2026-10-13")]);
    expect(changes).toMatchObject([{ field: "gain_m", kind: "fill", before: null, after: 300 }]);
  });

  it("a newer read from an equal kind replaces, and the old value is kept as an alternative", async () => {
    const { row, file, changes } = await run("operator", "2026-10-01", { km: 12 }, [ev("operator", "2026-10-13")]);
    expect(changes).toMatchObject([{ field: "km", kind: "replace", before: 10, after: 12 }]);
    applyFieldChanges(row, changes, file, (await deps()).rank);
    expect(row.km).toBe(12);
    expect(row.field_meta.km).toMatchObject({ kind: "operator", read: "2026-10-13" });
    expect(row.field_meta.km.alternatives).toEqual([expect.objectContaining({ value: 10, kind: "operator", read: "2026-10-01" })]);
  });

  it("a newer read from a better kind replaces", async () => {
    const { changes } = await run("blog", "2026-10-01", { km: 12 }, [ev("official", "2026-10-13")]);
    expect(changes[0]).toMatchObject({ kind: "replace", after: 12 });
  });

  it("a newer read from a weaker kind goes to the alternatives; the stored value stays", async () => {
    const { row, file, changes } = await run("official", "2026-10-01", { km: 12 }, [ev("blog", "2026-10-13")]);
    expect(changes[0]).toMatchObject({ kind: "alternative", before: 10, after: 10, incoming: 12 });
    applyFieldChanges(row, changes, file, (await deps()).rank);
    expect(row.km).toBe(10);
    expect(row.field_meta.km.alternatives).toEqual([expect.objectContaining({ value: 12, kind: "blog" })]);
    expect(row.field_meta.km.confidence).toBeUndefined();
  });

  it("an older read from a better kind goes to the alternatives too", async () => {
    const { changes } = await run("blog", "2026-10-13", { km: 12 }, [ev("official", "2026-09-01")]);
    expect(changes[0]).toMatchObject({ kind: "alternative" });
  });

  it("equal kind, same day, different value is a conflict for that field", async () => {
    const { row, file, changes } = await run("operator", "2026-10-13", { km: 12 }, [ev("operator", "2026-10-13")]);
    expect(changes[0]).toMatchObject({ kind: "conflict" });
    applyFieldChanges(row, changes, file, (await deps()).rank);
    expect(row.km).toBe(10);
    expect(row.field_meta.km.confidence).toBe("conflict");
    expect(row.field_meta.km.alternatives[0].value).toBe(12);
  });

  it("the same disagreement is not proposed twice", async () => {
    const { row, file, changes } = await run("operator", "2026-10-13", { km: 12 }, [ev("operator", "2026-10-13")]);
    applyFieldChanges(row, changes, file, (await deps()).rank);
    expect(mergeFields(row, { km: 12 }, [ev("operator", "2026-10-13")], await ctx(file))).toEqual([]);
  });

  it("the same value from a source not yet cited is a corroboration; from a cited source it is nothing", async () => {
    const { row, file, changes } = await run("official", "2026-10-01", { km: 10 }, [ev("official", "2026-10-13", "https://other-host.example/km")]);
    expect(changes).toMatchObject([{ field: "km", kind: "corroborate" }]);
    applyFieldChanges(row, changes, file, (await deps()).rank);
    expect(row.field_meta.km.src).toHaveLength(2);
    expect(mergeFields(row, { km: 10 }, [ev("official", "2026-10-13", "https://other-host.example/km")], await ctx(file))).toEqual([]);
    expect(mergeFields(row, { km: 10 }, [ev("official", "2026-10-13", "https://old.example/x")], await ctx(file))).toEqual([]);
  });

  it("list fields merge as sets: a subset is nothing, a new member is a change that keeps the old ones", async () => {
    const a = await run("operator", "2026-10-01", { tags: ["hiking"] }, [ev("operator", "2026-10-01", "https://old.example/x")]);
    expect(a.changes).toEqual([]);
    const b = await run("operator", "2026-10-01", { tags: ["viewpoint"] }, [ev("operator", "2026-10-13")]);
    expect(b.changes[0]).toMatchObject({ field: "tags", kind: "replace", after: ["hiking", "viewpoint"] });
  });

  it("a null or empty incoming value never overwrites", async () => {
    const { changes } = await run("blog", "2026-10-01", { km: null, tags: [], official_url: "" }, [ev("official", "2026-10-13")]);
    expect(changes).toEqual([]);
  });

  it("filling a link is a link change, whatever the source", async () => {
    const { changes } = await run("official", "2026-10-01", { official_url: "https://x.example/trail" }, [ev("community", "2026-10-13")]);
    expect(changes[0]).toMatchObject({ field: "official_url", kind: "link" });
  });

  it("a row with no field_meta is weighed against its strongest cited source", async () => {
    const file: Row = { sources: [{ id: "src-0001", url: "https://a.example", kind: "official", read: "2026-09-01" }] };
    const row: Row = { id: "t", km: 10, sources: ["src-0001"], field_meta: {} };
    const rank = (await deps()).rank;
    const changes = mergeFields(row, { km: 12 }, [ev("blog", "2026-10-13")], { rank, evidenceOf: (r, f) => fieldEvidenceOf(rank, r, f, file.sources) });
    expect(changes[0]).toMatchObject({ kind: "alternative", against: { kind: "official", read: "2026-09-01" } });
  });
});
