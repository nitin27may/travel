// Which files belong to which family (RIS-N). Discovery is by folder and by the file's own `schema` field, so a run record, a
// split file, a changeset or a generated file under the same folders is never read as a lane file.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { FAMILIES, type Family } from "./types.ts";

export interface Found { file: string; abs: string; family: Family }

const norm = (p: string): string => p.split(sep).join("/");
const jsonIn = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => join(dir, e.name)).sort() : []);
const dirsIn = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(dir, e.name)).sort() : []);

const SCHEMAS: Readonly<Record<Family, readonly string[]>> = {
  capture: ["capture/1"],
  suitability: ["suitability/1"],
  relevance: ["relevance/1"],
  points: ["capture-points/1", "capture-points/2"],
  operators: ["capture-operators/1"],
  tracks: ["trail-track/1"],
  windows: ["trip-windows/1"],
  "base-plans": ["trip-base-plans/1"],
  seasons: ["trip-season-basic/1"],
};

/** The schema id of a file, or null when it is not JSON or has none. */
export function schemaOf(abs: string): string | null {
  try {
    const d = JSON.parse(readFileSync(abs, "utf8")) as { schema?: unknown };
    return typeof d.schema === "string" ? d.schema : null;
  } catch {
    return null;
  }
}

/** Every file of the wanted families under `root`, sorted by path. */
export function discover(root: string, families: readonly Family[] = FAMILIES, only?: readonly string[]): Found[] {
  const want = new Set(families);
  const out: Found[] = [];
  const add = (abs: string, family: Family): void => {
    if (!want.has(family)) return;
    const s = schemaOf(abs);
    if (s !== null && SCHEMAS[family].includes(s)) out.push({ file: norm(relative(root, abs)), abs, family });
  };
  for (const d of dirsIn(join(root, "data", "capture"))) if (!["runs", "splits", "changesets"].includes(d.split(sep).pop()!)) jsonIn(d).forEach((f) => add(f, "capture"));
  add(join(root, "data", "capture", "points.json"), "points");
  add(join(root, "data", "capture", "operators.json"), "operators");
  for (const d of dirsIn(join(root, "data", "suitability"))) jsonIn(d).forEach((f) => add(f, "suitability"));
  for (const d of dirsIn(join(root, "data", "relevance"))) if (!["signals", "derived", "inputs"].includes(d.split(sep).pop()!)) jsonIn(d).forEach((f) => add(f, "relevance"));
  jsonIn(join(root, "data", "tracks")).forEach((f) => add(f, "tracks"));
  jsonIn(join(root, "data", "windows")).forEach((f) => add(f, "windows"));
  jsonIn(join(root, "data", "base-plans")).forEach((f) => add(f, "base-plans"));
  jsonIn(join(root, "data", "seasons")).forEach((f) => add(f, "seasons"));
  const keep = only ? new Set(only.map(norm)) : null;
  return out.filter((f) => !keep || keep.has(f.file)).sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || a.file.localeCompare(b.file));
}
