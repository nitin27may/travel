// Containment, the ONE implementation (entity-graph 6.1; EG-I). The graph index (core/src/graph/build.ts) uses it, and the validator
// may import it (PA-C) instead of keeping its own copy. Rules, in order:
//   1. an explicit `part_of` wins (alias refs resolve to their primary);
//   2. else `covers_areas`: a record whose `area_id` is a covered area is a member of that protected area;
//   3. never geometry;
//   4. a record that has `covers_areas` itself is NEVER an area member of another protected area (two parks over one area must not
//      make each other members); only its explicit `part_of` places it in a container.
// Offers are never area members (they are placed by `at`). Every walk uses a visited set, so a loop cannot hang the closure.
import { primaryRef } from "./records.ts";
import type { World } from "./records.ts";
import { targetsOf } from "../schema/capture/relations.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";

export type Basis = "explicit" | "area";
export interface Containment {
  /** direct containers, nearest first (the file's order for an explicit part_of; ref order for area parks) */
  containers(ref: string): { refs: string[]; basis: Basis | null };
  /** every container up the tree, nearest first, each once */
  containerChain(ref: string): string[];
  /** loops found in the containment graph, each as [a, b, ..., a] */
  cycles: string[][];
}

/** The distinct primary refs a record holds under a relation key, in the record's order (duplicates and aliases collapsed). */
export function uniqueTargets(world: World, rec: CaptureRecord, key: string): string[] {
  return [...new Set(targetsOf(rec as unknown as Record<string, unknown>, key).map((t) => primaryRef(world, t)))];
}

export function buildContainment(world: World): Containment {
  const recs = new Map<string, CaptureRecord>();
  for (const [ref, { rec }] of world.cap) recs.set(ref, rec);
  const areaParks = new Map<string, string[]>();
  for (const ref of [...recs.keys()].sort()) for (const a of recs.get(ref)!.covers_areas ?? []) areaParks.set(a, [...(areaParks.get(a) ?? []), ref]);

  const memo = new Map<string, { refs: string[]; basis: Basis | null }>();
  const containers = (ref: string): { refs: string[]; basis: Basis | null } => {
    const hit = memo.get(ref);
    if (hit) return hit;
    const r = recs.get(ref);
    let out: { refs: string[]; basis: Basis | null } = { refs: [], basis: null };
    if (r) {
      const explicit = uniqueTargets(world, r, "part_of").filter((c) => c !== ref);
      if (explicit.length) out = { refs: explicit, basis: "explicit" };
      else if (r.layer !== "offer" && r.area_id && !(r.covers_areas?.length)) {
        const parks = (areaParks.get(r.area_id) ?? []).filter((x) => x !== ref);
        if (parks.length) out = { refs: parks, basis: "area" };
      }
    }
    memo.set(ref, out);
    return out;
  };

  const containerChain = (ref: string): string[] => {
    const seen = new Set<string>([ref]);
    const out: string[] = [];
    let frontier = [ref];
    while (frontier.length) {
      const next: string[] = [];
      for (const f of frontier) for (const c of containers(f).refs) if (!seen.has(c)) { seen.add(c); out.push(c); next.push(c); }
      frontier = next;
    }
    return out;
  };

  const cycles: string[][] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const dfs = (ref: string): void => {
    state.set(ref, 1);
    stack.push(ref);
    for (const c of containers(ref).refs) {
      if (state.get(c) === 1) cycles.push([...stack.slice(stack.indexOf(c)), c]);
      else if (!state.has(c)) dfs(c);
    }
    stack.pop();
    state.set(ref, 2);
  };
  for (const ref of [...recs.keys()].sort()) if (!state.has(ref)) dfs(ref);
  return { containers, containerChain, cycles };
}
