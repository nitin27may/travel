import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll } from "vitest";
import { normaliseText, type TextResult } from "../../src/normalise/run.ts";
import type { Family } from "../../src/normalise/types.ts";

export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
export const FIX = join(REPO, "core/test/normalise/fixtures/golden");

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** An empty scratch repository root; nothing of the real repository is shared with it. */
export function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "normalise-"));
  dirs.push(root);
  return root;
}

export function put(root: string, rel: string, doc: unknown): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof doc === "string" ? doc : JSON.stringify(doc, null, 2) + "\n");
}

export function copyFixture(root: string, fixture: string, rel: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  cpSync(join(FIX, fixture), p);
}

export const val = (v: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ v, state: "value", basis: "official_info", src: ["src-0001"], read: "2026-10-18", ...extra });

export const capDoc = (records: unknown[], over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: "capture/1", trip: "fixture-trip", lane: "t", researched: "2026-10-18", agent: "test", model: "none", sources: [], records, ...over,
});

export const place = (ref: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({ ref, type: "nature.trail.hike", layer: "place", name: "A place", ...over });

/** Normalise one document given as an object, printed the way the repository's own files are. */
export function run(family: Family, doc: unknown, over: { pinned?: string[]; run?: string; readDefault?: string } = {}): TextResult & { out: any } {
  const text = typeof doc === "string" ? doc : JSON.stringify(doc, null, 2) + "\n";
  const r = normaliseText(text, { family, file: "fixture.json", run: over.run ?? "TEST-1", ...(over.readDefault ? { readDefault: over.readDefault } : {}), pinned: new Set(over.pinned ?? []) });
  return { ...r, out: JSON.parse(r.text) };
}
