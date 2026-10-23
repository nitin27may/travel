import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { inputRevision, type RevisionInputs } from '@travel/core/catalogue/revision.ts';
import { travelRoot } from '@/lib/data/root';

// The files the JSON store is built from, with their content hashes (store.ts A30, D-E4). The revision is `inputRevision()` of this: the build
// id and the SHA-256 of each file's bytes, never a built detail, so the first call at 10,000 places costs one pass over about 1,000 files
// (about 100 ms) and not 2.9 s. Content only: an mtime is never read. The set is a superset on purpose: a file the builder does not read yet
// can only move the ETag, which is harmless; a file it reads that this set misses would serve stale caches, which is not.
//
// Repository-relative paths, forward slashes. A directory is walked in full (no filter), so a new data file joins the revision by being
// there. `data/schema/generated` is output of the code (the build id covers a code change), not an input.

/** Directories walked in full, from the repository root. */
const TREES = ['data', 'web/data-snapshots', 'web/public/globe/data', 'web/public/globe/line', 'legacy/globe/assets/data'];
/** Single files, from the repository root (and each trip folder's `data/*.json` and gallery file, below). */
const FILES = ['legacy/MANIFEST.json', 'web/public/search/vocab.json', 'web/.generated/image-map.json', 'web/.generated/legacy-trips.json'];
const SKIP = new Set(['data/schema/generated']);

function walk(root: string, rel: string, out: string[]): void {
  if (SKIP.has(rel)) return;
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const child = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(root, child, out);
    else if (e.isFile() && e.name !== '.DS_Store') out.push(child);
  }
}

/** The build's id: Next's BUILD_ID, or the fixed `dev` outside a build (A30). */
export function buildId(): string {
  const file = path.join(process.cwd(), '.next', 'BUILD_ID');
  return existsSync(file) ? readFileSync(file, 'utf8').trim() || 'dev' : 'dev';
}

/** Every input file with its hash, and the build id. */
export function revisionInputs(root: string = travelRoot()): RevisionInputs {
  const paths: string[] = [];
  for (const t of TREES) walk(root, t, paths);
  for (const f of FILES) if (existsSync(path.join(root, f))) paths.push(f);
  // each trip folder's data files and gallery file (the page's photos)
  const legacy = path.join(root, 'legacy');
  if (existsSync(legacy)) {
    for (const n of readdirSync(legacy)) {
      const data = path.join(legacy, n, 'data');
      if (existsSync(data) && statSync(data).isDirectory()) for (const f of readdirSync(data)) if (f.endsWith('.json')) paths.push(`legacy/${n}/data/${f}`);
      if (existsSync(path.join(legacy, n, 'gallery', 'gallery.json'))) paths.push(`legacy/${n}/gallery/gallery.json`);
    }
  }
  const files = [...new Set(paths)].map((p) => ({ path: p, sha256: createHash('sha256').update(readFileSync(path.join(root, p))).digest('hex') }));
  return { buildId: buildId(), files };
}

/** The revision of the current inputs (a helper for tests and the build report). */
export const currentRevision = (root?: string): string => inputRevision(revisionInputs(root));
