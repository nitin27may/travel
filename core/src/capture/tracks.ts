// Stored OSM tracks (data/tracks/<place>.json, trail-track/1) as the completeness engine sees them: which capture refs have a
// line, and whether the line is confirmed. The geometry itself is never loaded here; the public site reads it at build time.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { World } from "./records.ts";

export interface TrackInfo {
  place: string;
  confirmed: boolean;
  /** why the line is held back, as the fetcher wrote it */
  held_back: string[];
  /** a line exists (stitched, with points), whether or not it is confirmed */
  stitched: boolean;
}

const cache = new WeakMap<World, Map<string, TrackInfo>>();

/** Capture ref -> the track file that names it in `refs`. */
export function tracksByRef(world: World): Map<string, TrackInfo> {
  const hit = cache.get(world);
  if (hit) return hit;
  const out = new Map<string, TrackInfo>();
  const dir = join(world.root, "data", "tracks");
  if (existsSync(dir)) {
    for (const n of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "inputs.json").sort()) {
      try {
        const t = JSON.parse(readFileSync(join(dir, n), "utf8")) as { schema?: string; place?: string; refs?: string[]; confirmed?: boolean; held_back?: string[]; stitched?: boolean };
        if (t.schema !== "trail-track/1") continue;
        const info: TrackInfo = { place: t.place ?? n.replace(/\.json$/, ""), confirmed: t.confirmed === true, held_back: t.held_back ?? [], stitched: t.stitched === true };
        for (const r of t.refs ?? []) out.set(world.alias.get(r) ?? r, info);
      } catch {
        // an unreadable track file is the track validator's business, not the engine's
      }
    }
  }
  cache.set(world, out);
  return out;
}

/**
 * Whether a held-back track counts as present for completeness. The capture contract (3.3) asks a route for "geometry or
 * searched_none" and is silent on confirmation, so a confirmed track is done and a held-back one is a gap: "route not confirmed".
 */
export const UNCONFIRMED_TRACK_COUNTS = false;
export const GEOMETRY_GAP_REASON = "route not confirmed";
