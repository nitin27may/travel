// The supersede override (capture contract 9.7): an official re-read replaces a pre-migration value as the SHOWN value. The lane
// file is never edited, so the migration ledger holds; the original stays as an "earlier figure" conflict of the shown value.
// This file has no runtime import of records.ts or migrate.ts (records.ts calls it); the checks that need the ledger are in
// supersedeCheck.ts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupersedeEntry, SupersedesFile } from "../schema/capture/records.ts";
import { normaliseUrl } from "../sources/normalize.ts";
import type { World } from "./records.ts";

export const SUPERSEDES_PATH = "data/capture/supersedes.json";
export const EARLIER_FIGURE = "earlier figure";

type Any = Record<string, unknown>;
export type SupLayer = SupersedeEntry["layer"];

export function loadSupersedes(root: string): SupersedesFile | null {
  const p = join(root, SUPERSEDES_PATH);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SupersedesFile;
  } catch {
    return null;
  }
}

/** The node at a dot path of a record ("suitability.effort.drivers.gain_m"), or undefined. Array hops are not part of a path. */
export function getAt(rec: unknown, path: string): unknown {
  let cur: unknown = rec;
  for (const k of path.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Any)[k];
  }
  return cur;
}

function setAt(rec: Any, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur = rec;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Any;
  cur[keys[keys.length - 1]!] = value;
}

export const isValLike = (x: unknown): x is Any & { v: unknown; state: string } =>
  !!x && typeof x === "object" && !Array.isArray(x) && "v" in (x as Any) && "state" in (x as Any);

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const supersedeKey = (layer: string, ref: string, path: string): string => `${layer}|${ref}|${path}`;

/** The id of a lane-file source that has the same page as the entry's source, or the entry's own id when the lane file lacks it. */
function laneSourceId(entrySrc: string, entries: SupersedesFile, laneFile: string): string {
  const row = entries.sources.find((s) => s.id === entrySrc);
  if (!row || !laneFile || !existsSync(laneFile)) return entrySrc;
  try {
    const lane = JSON.parse(readFileSync(laneFile, "utf8")) as { sources?: { id: string; url: string }[] };
    const hit = (lane.sources ?? []).find((s) => normaliseUrl(s.url) === normaliseUrl(row.url));
    return hit?.id ?? entrySrc;
  } catch {
    return entrySrc;
  }
}

/** The Val an entry produces over `old`: the new value first, the old figure kept as a conflict, the other conflicts kept. */
export function supersededVal(entry: SupersedeEntry, old: Any, file: SupersedesFile, laneFile: string): Any {
  const oldConflicts = Array.isArray(old.conflicts) ? (old.conflicts as Any[]) : [];
  const conflicts = [
    { v: old.v, basis: (old.basis as string | null) ?? null, src: (old.src as string[]) ?? [], note: EARLIER_FIGURE },
    ...oldConflicts.filter((c) => !sameValue(c.v, entry.value.v)),
  ];
  const { v, state, basis, src, read, quote, note, applies_to } = entry.value;
  return {
    v, state, basis,
    src: src.map((s) => laneSourceId(s, file, laneFile)),
    ...(read ? { read } : {}), ...(quote ? { quote } : {}), ...(note ? { note } : {}), ...(applies_to ? { applies_to } : {}),
    conflicts,
  };
}

/**
 * Applies every entry to the world in memory (records are copied before they change; nothing on disk moves). An entry that does not
 * apply cleanly (record or path gone, stored value no longer `was`) is skipped: the validator reports it, the page keeps the old value.
 */
export function applySupersedes(world: World, file: SupersedesFile | null): void {
  world.supersedes = new Map();
  if (!file) return;
  for (const entry of file.entries) {
    const map = entry.layer === "suitability" ? world.suit : entry.layer === "relevance" ? world.rel : world.cap;
    const at = (map as Map<string, { rec: unknown; file: string }>).get(entry.ref) ?? (map as Map<string, { rec: unknown; file: string }>).get(world.alias.get(entry.ref) ?? "");
    if (!at) continue;
    const old = getAt(at.rec, entry.path);
    if (!isValLike(old) || !sameValue(old.v, entry.was)) continue;
    const copy = structuredClone(at.rec) as Any;
    setAt(copy, entry.path, supersededVal(entry, old, file, at.file));
    at.rec = copy;
    world.supersedes.set(supersedeKey(entry.layer, entry.ref, entry.path), entry);
  }
}

/**
 * The one reader of a value that may be superseded (9.7): the entry's value when there is one, else the winning lane record's.
 * `world` already has the entries applied, so this is a read of the world plus the entry that explains it.
 */
export function resolveVal(world: World, layer: SupLayer, ref: string, path: string): { val: unknown; superseded: SupersedeEntry | null } {
  const map = layer === "suitability" ? world.suit : layer === "relevance" ? world.rel : world.cap;
  const at = (map as Map<string, { rec: unknown }>).get(ref) ?? (map as Map<string, { rec: unknown }>).get(world.alias.get(ref) ?? "");
  return { val: at ? getAt(at.rec, path) : undefined, superseded: world.supersedes?.get(supersedeKey(layer, ref, path)) ?? null };
}
