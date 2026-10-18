// Refs of relevance/1 are the refs of suitability/1 (suitability 5.2); this file re-exports the resolver and adds the
// relevance-side file listing.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export { RefResolver, loadScope } from "../suitability/refs.ts";

/** Folders of data/relevance that hold generated or input data, not lane files. */
export const NON_TRIP_DIRS = ["signals", "derived", "inputs"];

/** Every data/relevance/<trip>/<lane>.json, sorted. */
export function relevanceFiles(root: string, onlyTrip?: string | null): string[] {
  const base = join(root, "data", "relevance");
  if (!existsSync(base)) return [];
  const out: string[] = [];
  for (const trip of readdirSync(base).sort()) {
    if (NON_TRIP_DIRS.includes(trip) || (onlyTrip && trip !== onlyTrip)) continue;
    let names: string[] = [];
    try {
      names = readdirSync(join(base, trip)).filter((n) => n.endsWith(".json")).sort();
    } catch {
      continue; // README.md sits beside the trip folders
    }
    for (const n of names) out.push(join(base, trip, n));
  }
  return out;
}
