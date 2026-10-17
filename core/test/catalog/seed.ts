// A hand-built catalog for the coverage, freshness and backlog tests: known rows, known counts, no pipeline involved.
import { FOLDER, blankRow, countryOfRow, emptyFile, serializeCatalogFile } from "../../src/catalog/common.ts";
import type { Entity, Row } from "../../src/catalog/common.ts";
import { MemoryStore } from "../../src/store/memory.ts";
import { newStore } from "./util.ts";

export const SRC = (n: number, kind = "official", read = "2026-10-01", url = `https://src${n}.example/x`): Row => ({ id: `src-${String(n).padStart(4, "0")}`, url, title: "t", publisher: "p", kind, read });

export function row(entity: Entity, id: string, area: string, extra: Row = {}): Row {
  const r = { ...blankRow(entity, "2026-10-01"), id, area_id: area, name: id.split("/").pop(), review_status: "verified", confidence: "stated", sources: ["src-0001"], ...extra };
  if (entity === "stays" || entity === "eateries") {
    r.lat = r.lat ?? -49.3;
    r.lon = r.lon ?? -72.9;
  }
  if (entity === "stays") r.kind = r.kind ?? "hotel";
  if (entity === "activities") r.type = r.type ?? "gondola";
  if (entity === "trails") r.km = r.km ?? 8;
  if (entity === "offers") Object.assign(r, { subject_entity: "activity", subject_id: "x", category: "activity", provider: "P", ...extra });
  return r;
}

/** put rows into their country files (one source table per file) */
export async function seed(store: MemoryStore, rows: { entity: Entity; row: Row }[], sources: Row[] = [SRC(1)]): Promise<void> {
  const files = new Map<string, { folder: string; cc: string; doc: Row }>();
  for (const { entity, row: r } of rows) {
    const cc = entity === "offer_prices" ? r.__cc : countryOfRow(entity, r);
    const folder = FOLDER[entity];
    const key = `${folder}/${cc}`;
    if (!files.has(key)) files.set(key, { folder, cc, doc: { ...emptyFile(folder, cc), sources } });
    const { __cc: _c, ...clean } = r;
    (files.get(key)!.doc[entity] as Row[]).push(clean);
  }
  for (const [, f] of files) await store.write(`data/catalog/${f.folder}/${f.cc}.json`, new TextEncoder().encode(serializeCatalogFile(f.folder, f.doc)));
}

export const store = (): MemoryStore => newStore();
