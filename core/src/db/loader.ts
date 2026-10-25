// Migration file loader (pure, no database driver).
//
// Migrations live beside this file in ./migrations as `NNNN_name.sql`, where NNNN is a
// zero-padded, strictly increasing integer version. The loader reads them from disk, parses
// the version and name, and computes a stable sha256 checksum over the exact file bytes. It is
// deliberately free of any SQL driver so it can be unit-tested offline and so the runner can be
// tested with a fake executor.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export interface Migration {
  /** Zero-padded version string exactly as it appears in the filename, e.g. "0001". */
  version: string;
  /** Human name after the version, e.g. "bootstrap". */
  name: string;
  /** Filename, e.g. "0001_bootstrap.sql". */
  file: string;
  /** Raw SQL text. */
  sql: string;
  /** sha256 of the raw file bytes, hex. */
  checksum: string;
}

const FILE_RE = /^(\d{4,})_([a-z0-9][a-z0-9_]*)\.sql$/;

export function migrationsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "migrations");
}

/** sha256 hex of a UTF-8 string. Exported so tests and the runner share one definition. */
export function checksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

/**
 * Parse a list of `{ file, sql }` entries into ordered, validated Migration records.
 * Throws on a malformed name or a duplicate version so a mistake fails loudly, not silently.
 */
export function parseMigrations(entries: { file: string; sql: string }[]): Migration[] {
  const out: Migration[] = [];
  const seen = new Map<string, string>();
  for (const { file, sql } of entries) {
    const m = FILE_RE.exec(file);
    if (!m) throw new Error(`migration filename is not NNNN_name.sql: ${file}`);
    const version = m[1];
    if (seen.has(version)) {
      throw new Error(`duplicate migration version ${version}: ${seen.get(version)} and ${file}`);
    }
    seen.set(version, file);
    out.push({ version, name: m[2], file, sql, checksum: checksum(sql) });
  }
  out.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  // After sorting, versions must be strictly increasing (the duplicate guard above already ran).
  for (let i = 1; i < out.length; i++) {
    if (out[i].version === out[i - 1].version) {
      throw new Error(`duplicate migration version ${out[i].version}`);
    }
  }
  return out;
}

/** Read every migration file from the on-disk migrations directory, ordered and validated. */
export function loadMigrations(dir = migrationsDir()): Migration[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const entries = files.map((file) => ({ file, sql: readFileSync(join(dir, file), "utf8") }));
  return parseMigrations(entries);
}
