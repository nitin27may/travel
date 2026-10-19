import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll } from "vitest";

export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A scratch repository root holding the real types file, difficulty map, relevance classes and applicability file. */
export function scratchRoot(extra: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "capture-"));
  dirs.push(root);
  for (const f of ["data/vocab/types.json", "data/vocab/relevance-classes.json", "data/schema/difficulty-map.json", "data/schema/suitability-applicability.json"]) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    cpSync(join(REPO, f), join(root, f));
  }
  for (const [rel, doc] of Object.entries(extra)) put(root, rel, doc);
  return root;
}

export function put(root: string, rel: string, doc: unknown): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof doc === "string" ? doc : JSON.stringify(doc, null, 2) + "\n");
}

/** scope.json that lets the fixture refs resolve */
export const scope = (places: string[], items: { ref: string; name: string; trip: string }[] = []) => ({
  schema: "suitability-scope/1",
  places,
  items: items.map((i) => ({ ref: i.ref, key: null, trip: i.trip, kind: "trail", name: i.name, days: [], source: {} })),
});

export const capDoc = (records: unknown[], over: Record<string, unknown> = {}) => ({
  schema: "capture/1", trip: "fixture-trip", lane: "t", researched: "2026-10-18", agent: "test", model: "none", sources: [], records, ...over,
});
