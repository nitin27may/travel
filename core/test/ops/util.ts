// Shared helpers for the operation tests: a canonical fixture trip in a MemoryStore, a fake place backend, and `check`,
// which runs an operation and asserts the file diff against an expected fixture, the changelog row and the inverse.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { runOp } from "../../src/ops/run.ts";
import type { RunResult, WriteOk } from "../../src/ops/run.ts";
import type { PlaceBackend } from "../../src/ops/types.ts";
import { MemoryStore } from "../../src/store/memory.ts";

export const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
export const ROOT = join(FIX, "root");
export const SLUG = "patagonia-fixture";
export const TRIP_PATH = `data/trips/${SLUG}/trip.json`;
export const ACTOR = { id: "u_owner", via: "cli" } as const;
export const NOW = "2026-10-17T15:00:00Z";
export const TODAY = "2026-10-17";
process.env.TRAVEL_TODAY = TODAY;

export const baseText = (): string => readFileSync(join(FIX, "trips", SLUG, "trip.json"), "utf8");
export const baseDoc = (): any => JSON.parse(baseText());

export function newStore(extra: Record<string, string> = {}): MemoryStore {
  return new MemoryStore(ROOT, { [TRIP_PATH]: baseText(), ...extra });
}

export class FakeBackend implements PlaceBackend {
  edits: { id: string; change: { status?: string; trip?: string | null } }[] = [];
  places = new Map<string, { id: string; name: string; status: string; trip: string | null }>([
    ["CA/ON/niagara/niagara-falls", { id: "CA/ON/niagara/niagara-falls", name: "Niagara Falls", status: "idea", trip: null }],
  ]);
  async get(id: string) {
    return this.places.get(id) ?? null;
  }
  async edit(id: string, change: { status?: string; trip?: string | null }) {
    this.edits.push({ id, change });
    const p = this.places.get(id)!;
    if (change.status !== undefined) p.status = change.status;
    if (change.trip !== undefined) p.trip = change.trip;
  }
}

export const run = (store: MemoryStore, name: string, input: Record<string, unknown>, backend?: PlaceBackend): Promise<RunResult> =>
  runOp(store, name, { actor: ACTOR, ...input }, { now: NOW, today: TODAY, backend: backend ?? null });

/** a row that becomes the last in its table gains or loses a trailing comma; that is not a change */
const norm = (l: string): string => l.replace(/,$/, "");

export function lineDiff(before: string, after: string): { removed: string[]; added: string[] } {
  const count = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (const l of s.split("\n").map(norm)) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const b = count(before);
  const a = count(after);
  const removed: string[] = [];
  const added: string[] = [];
  for (const l of before.split("\n").map(norm)) {
    const n = a.get(l) ?? 0;
    if (n > 0) a.set(l, n - 1);
    else removed.push(l);
  }
  for (const l of after.split("\n").map(norm)) {
    const n = b.get(l) ?? 0;
    if (n > 0) b.set(l, n - 1);
    else added.push(l);
  }
  return { removed, added };
}

const EXPECTED = join(FIX, "trips", "expected");

export interface CheckOptions {
  /** extra files to compare, besides the trip file */
  files?: string[];
  backend?: PlaceBackend;
  store?: MemoryStore;
  /** fixture name when one operation has several cases */
  variant?: string;
  /** the trip file whose changelog to inspect (default: the fixture trip) */
  tripPath?: string;
}

/** Run an operation and assert the contract of acceptance criterion 1. Returns the result and the store after. */
export async function check(name: string, input: Record<string, unknown>, o: CheckOptions = {}): Promise<{ r: WriteOk; store: MemoryStore; after: string }> {
  const store = o.store ?? newStore();
  const tripFile = o.tripPath ?? TRIP_PATH;
  const paths = [tripFile, ...(o.files ?? [])];
  const before: Record<string, string | null> = { ...Object.fromEntries(paths.map((p) => [p, null])), ...store.snapshot() };
  const res = await run(store, name, input, o.backend);
  if (!res.ok) throw new Error(`${name} failed: ${JSON.stringify(res)}`);
  const r = res as WriteOk;
  const all = await store.list("data/");
  const afterAll = Object.fromEntries(all.map((p) => [p, store.text(p)]));
  const diffs: Record<string, { removed: string[]; added: string[] }> = {};
  for (const p of new Set([...paths, ...all])) {
    const d = lineDiff(before[p] ?? "", afterAll[p] ?? "");
    if (d.removed.length || d.added.length) diffs[p] = d;
  }
  const after = store.text(tripFile) ?? "";
  const doc = after ? JSON.parse(after) : null;
  const row = doc?.changelog?.at(-1);
  const snapshot = {
    summary: row?.summary,
    changed: r.changed,
    warnings: r.warnings.map((w) => `${w.code} ${w.where}`),
    diffs,
  };
  const file = join(EXPECTED, `${name.replace(/\./g, "_")}${o.variant ? `.${o.variant}` : ""}.json`);
  if (process.env.UPDATE_FIXTURES) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(snapshot, null, 2) + "\n");
  }
  expect(existsSync(file), `missing expected fixture ${file}; run with UPDATE_FIXTURES=1 and review it`).toBe(true);
  expect(snapshot).toEqual(JSON.parse(readFileSync(file, "utf8")));

  // the changelog row
  expect(row).toMatchObject({ op: name, actor_id: ACTOR.id, actor_via: ACTOR.via, at: NOW });
  expect(row.seq).toBe(r.changelog_seq);
  // the inverse restores the exact bytes, and its own inverse brings the change back
  expect(r.inverse, "an operation returns its inverse").not.toBeNull();
  const undo = await runOp(store, r.inverse!.name, r.inverse!.input, { now: NOW, today: TODAY, backend: o.backend ?? null });
  if (!undo.ok) throw new Error(`inverse of ${name} failed: ${JSON.stringify(undo)}`);
  for (const p of new Set([...paths, ...Object.keys(diffs)])) expect(store.text(p), `${name}: inverse restores ${p}`).toBe(before[p] ?? null);
  const redo = await runOp(store, (undo as WriteOk).inverse!.name, (undo as WriteOk).inverse!.input, { now: NOW, today: TODAY, backend: o.backend ?? null });
  expect(redo.ok).toBe(true);
  for (const p of Object.keys(diffs)) expect(store.text(p), `${name}: the inverse of the inverse restores ${p}`).toBe(afterAll[p] ?? null);
  return { r, store, after };
}

export async function must(store: MemoryStore, name: string, input: Record<string, unknown>, backend?: PlaceBackend): Promise<WriteOk> {
  const res = await run(store, name, input, backend);
  if (!res.ok) throw new Error(`${name} failed: ${JSON.stringify(res)}`);
  return res as WriteOk;
}
