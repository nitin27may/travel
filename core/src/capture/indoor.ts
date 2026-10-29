// The rainy-day rule (DG-01, S2D-IND; DATA-PLAN 2.4): whether a place is indoor or under cover, read at the time a list row is made, so
// no place JSON carries a stored copy (S2D-SIZE). Two inputs, strongest first:
//   1. the record's own relevance `weather` of `indoor` (a researcher's judgement of that one place: Cave and Basin, a visitor centre);
//   2. the type's `indoor_default` in data/vocab/types.json, nearest node in the chain (a museum yes, an open-air museum no).
// A mixed type (a gondola, a hot spring, a viewpoint with a shelter) has no default: it is indoor only when its record says so. A
// weather-proof viewpoint is never indoor; `any_weather` in relevance means "worth it in any weather", not "under a roof".
// Pure: the tree is the one shipped with the code unless a file is passed (tests).
import type { TypesFile } from "../schema/capture/typesFile.ts";
import { chainOf, treeOf } from "./tree.ts";

const cache = new WeakMap<object, Map<string, boolean | null>>();

/** The type's default, or null when no node of its chain sets one (or the id is not in the tree). */
export function indoorDefaultOf(type: string | null | undefined, file?: TypesFile): boolean | null {
  if (!type) return null;
  const tree = treeOf(file);
  let byType = cache.get(tree);
  if (!byType) cache.set(tree, (byType = new Map()));
  const hit = byType.get(type);
  if (hit !== undefined) return hit;
  let out: boolean | null = null;
  const chain = chainOf(tree, type);
  for (let i = chain.length - 1; i >= 0; i--) {
    const v = chain[i]!.indoor_default;
    if (v !== undefined) {
      out = v;
      break;
    }
  }
  byType.set(type, out);
  return out;
}

/** True when the place suits a rainy day indoors; false when its type says it is not; null when nothing says. */
export function indoorOf(type: string | null | undefined, weather: string | null | undefined, file?: TypesFile): boolean | null {
  if (weather === "indoor") return true;
  return indoorDefaultOf(type, file);
}
