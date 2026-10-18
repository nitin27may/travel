// data/suitability/kind-map.json: the reviewed assignment of kind and subkind to every record (applicability spec 7, M1-M6).
// The migration reads it; a research lane that finds a record's kind wrong corrects the entry here, with a reason.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SUIT_KIND, SUIT_SUBKIND } from "../schema/enums.ts";
import { profilesClaiming } from "./applicability.ts";
import type { Applicability } from "./applicability.ts";

export interface KindMapEntry {
  ref: string;
  /** for the reviewer; not read */
  name?: string;
  from: { kind: string; subkind: string | null };
  kind: string;
  subkind: string;
  reason: string;
  /** set only when a research lane overrides the rule-assigned kind, e.g. "lane R4"; the reason then starts with that lane's id and date */
  by?: string;
}
export interface KindMapSplit {
  /** the record that keeps the values not named in `move` */
  from_ref: string;
  /** the new record */
  ref: string;
  kind: string;
  subkind: string;
  /** top-level block fields that move to the new record; "hints" moves the record's hints */
  move: string[];
  reason: string;
}
export interface KindMap {
  schema: "suitability-kind-map/1";
  note: string;
  reviewed: string;
  entries: KindMapEntry[];
  split: KindMapSplit[];
}

export function loadKindMap(root: string): KindMap {
  const p = join(root, "data", "suitability", "kind-map.json");
  if (!existsSync(p)) throw new Error("data/suitability/kind-map.json is missing; the migration needs it to assign every record a subkind");
  return JSON.parse(readFileSync(p, "utf8")) as KindMap;
}

/** Every problem with the map itself: unknown vocabulary, a pair no profile claims, a duplicate ref, a missing reason. */
export function kindMapProblems(map: KindMap, app: Applicability): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const rows: { ref: string; kind: string; subkind: string; reason: string }[] = [...map.entries, ...map.split];
  for (const e of rows) {
    if (seen.has(e.ref)) out.push(`${e.ref}: appears twice`);
    seen.add(e.ref);
    if (!(SUIT_KIND as readonly string[]).includes(e.kind)) out.push(`${e.ref}: kind "${e.kind}" is not a suitability kind`);
    if (!(SUIT_SUBKIND as readonly string[]).includes(e.subkind)) out.push(`${e.ref}: subkind "${e.subkind}" is not in the vocabulary`);
    else if (profilesClaiming(app, e.kind, e.subkind).length !== 1) out.push(`${e.ref}: (${e.kind}, ${e.subkind}) maps to ${profilesClaiming(app, e.kind, e.subkind).length} profiles`);
    if (!e.reason || e.reason.trim().length < 5) out.push(`${e.ref}: no reason`);
  }
  return out;
}
