// The engine's drive figures (trip-builder.md 4.10; driving-time-model.md 6.1; task TB-E1): a routed leg-cache cell when the caller
// read one, else the pure L2 model (`modelDrive`), flagged as an estimate (≈). Memoised per build. The visitor's start is a node of
// its own (`START`) that is never looked up in the routed cells: a visitor start is never a cache key (core/src/drive/keys.ts).
import { modelDrive, type DriveIndex } from "../drive/model.ts";
import type { EnginePoint, RoutedLegs } from "./engineTypes.ts";

/** Node ids: a place, a town, the near-mode start, the trip's gateway. */
export const placeNode = (ref: string): string => `p:${ref}`;
export const townNode = (id: string): string => `t:${id}`;
export const START = "s";
export const GATEWAY = "g";

/** The key of a routed cell from node a to node b (RoutedLegs). Only place and town nodes have cells. */
export const routedKey = (a: string, b: string): string => `${a}>${b}`;

export interface DriveCell {
  /** whole minutes; null when there is no road (a closed segment, no crossing) */
  min: number | null;
  routed: boolean;
}

export interface DriveTable {
  get(a: string, b: string): DriveCell;
  /** minutes or null, for the packer */
  minutes(a: string, b: string): number | null;
}

const routable = (id: string): boolean => id.startsWith("p:") || id.startsWith("t:");

/** A table over named points. `month` feeds the model's winter and seasonal modifiers. */
export function driveTable(points: ReadonlyMap<string, EnginePoint>, drive: DriveIndex, month: number | null, routed?: RoutedLegs): DriveTable {
  const memo = new Map<string, DriveCell>();
  const get = (a: string, b: string): DriveCell => {
    if (a === b) return { min: 0, routed: true };
    const key = routedKey(a, b);
    const hit = memo.get(key);
    if (hit) return hit;
    let cell: DriveCell;
    const r = routable(a) && routable(b) ? routed?.get(key) ?? routed?.get(routedKey(b, a)) : undefined;
    if (r !== undefined) cell = { min: Math.max(0, Math.round(r)), routed: true };
    else {
      const pa = points.get(a);
      const pb = points.get(b);
      if (!pa || !pb) cell = { min: null, routed: false };
      else {
        const e = modelDrive(pa, pb, month ? { month } : {}, drive);
        cell = { min: e.minutes, routed: false };
      }
    }
    memo.set(key, cell);
    return cell;
  };
  return { get, minutes: (a, b) => get(a, b).min };
}
