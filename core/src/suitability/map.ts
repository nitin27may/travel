// The difficulty map (data/schema/difficulty-map.json, v2) as typed data, plus the lookups derive.ts needs.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import defaultMapJson from "../../../data/schema/difficulty-map.json" with { type: "json" };
import type { GradeSystem } from "./types.ts";

export interface MapMapping {
  local: string;
  house: number;
  note: string;
  when?: "flat";
  source?: string;
  read?: string;
}
export interface MapSystem {
  id: GradeSystem;
  label: string;
  mappings: MapMapping[];
  note: string;
}
export interface DifficultyMap {
  schema_version: number;
  updated: string;
  systems: MapSystem[];
  effort: { formula: string; bands: { below: number | null; grade: number }[]; note: string };
  modes: { walk: number; ride: number; note: string } | null;
}

export const DEFAULT_MAP = defaultMapJson as unknown as DifficultyMap;

/** The map under `root`, or the one shipped with the code when the root has none (test roots). */
export function loadMap(root?: string): DifficultyMap {
  if (!root) return DEFAULT_MAP;
  const p = join(root, "data", "schema", "difficulty-map.json");
  if (!existsSync(p)) return DEFAULT_MAP;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as DifficultyMap;
  } catch {
    return DEFAULT_MAP;
  }
}

/** The grade words a system accepts, or null when it has no mapping (any word is accepted). */
export function gradesOf(map: DifficultyMap, system: GradeSystem): string[] | null {
  const s = map.systems.find((x) => x.id === system);
  if (!s || s.mappings.length === 0) return null;
  return [...new Set(s.mappings.map((m) => m.local))];
}

/** Terrain grade for a published grade. `flat` selects the "short, level, made surface" row when the system has one. */
export function terrainFromGrade(map: DifficultyMap, system: GradeSystem, value: string, flat: boolean): number | null {
  const s = map.systems.find((x) => x.id === system);
  if (!s) return null;
  const rows = s.mappings.filter((m) => m.local === value);
  if (rows.length === 0) return null;
  if (flat) {
    const f = rows.find((m) => m.when === "flat");
    if (f) return f.house;
  }
  return (rows.find((m) => m.when === undefined) ?? rows[0]!).house;
}

export function modeFactor(map: DifficultyMap, mode: "walk" | "ride"): number {
  return map.modes ? map.modes[mode] : 1;
}

export function bandOf(map: DifficultyMap, effortKm: number): number {
  for (const b of map.effort.bands) if (b.below === null || effortKm < b.below) return b.grade;
  return map.effort.bands[map.effort.bands.length - 1]!.grade;
}
