// Reads data/reference/towns/** (written only by tools/towns.py from the public GeoNames dump; store.ts A33 names the file the trust root).
// Every part is checked against the SHA-256 in the manifest on load, so a hand-edited part is refused here before anything is derived
// from it or served. Node only (it reads files); the pure derivation is near.ts.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TOWNS_DIR = "data/reference/towns";

/** One town as the part file holds it (columns of the manifest's `row`), with its country and the GeoNames name of its admin1. */
export interface TownRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  pop: number;
  /** the ISO 3166-2 suffix in the id (`00` when the country has no table in tools/towns_admin1.json) */
  admin1: string;
  ascii: string;
  geonamesId: number;
  /** lower-case ISO 3166-1 alpha-2 */
  cc: string;
  /** GeoNames' name for the admin1 (`Ontario`), or null */
  admin1Name: string | null;
}

export interface TownsManifest {
  source: { name: string; downloaded: string; licence: { id: string; attribution: string; url: string }; files: Record<string, { url: string; sha256: string }> };
  filter: { population_min: number };
  parts: { file: string; cc: string; rows: number; gzip: number; sha256: string }[];
  totals: { parts: number; rows: number; bytes: number; gzip: number };
}

export interface TownsLayerFiles {
  manifest: TownsManifest;
  rows: TownRow[];
}

const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

export function hasTownsFiles(root: string): boolean {
  return existsSync(join(root, TOWNS_DIR, "manifest.json"));
}

/** All parts, verified against the manifest. Throws when the manifest is missing, a part is missing, or a part's bytes differ. */
export function readTownsFiles(root: string): TownsLayerFiles {
  const dir = join(root, TOWNS_DIR);
  const mp = join(dir, "manifest.json");
  if (!existsSync(mp)) throw new Error(`${TOWNS_DIR}/manifest.json is missing; run: python3 tools/towns.py build`);
  const manifest = JSON.parse(readFileSync(mp, "utf8")) as TownsManifest;
  const rows: TownRow[] = [];
  for (const p of manifest.parts) {
    const bytes = readFileSync(join(dir, p.file));
    if (sha256(bytes) !== p.sha256) throw new Error(`${TOWNS_DIR}/${p.file} differs from the manifest: the towns files are written only by tools/towns.py from the GeoNames dump`);
    const doc = JSON.parse(bytes.toString("utf8")) as { cc: string; admin1: Record<string, string | null>; rows: [string, string, number, number, number, string, string, number][] };
    for (const [id, name, lat, lon, pop, admin1, ascii, geonamesId] of doc.rows) rows.push({ id, name, lat, lon, pop, admin1, ascii, geonamesId, cc: doc.cc, admin1Name: doc.admin1[admin1] ?? null });
  }
  return { manifest, rows };
}
