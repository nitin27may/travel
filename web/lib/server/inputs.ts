import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { inputRevision, type RevisionInputs } from '@travel/core/catalogue/revision.ts';
import { travelRoot } from '@/lib/data/root';
import { REVISION_FILES, REVISION_TREES } from './runtime-files';

// The files the JSON store is built from, with their content hashes (store.ts A30, D-E4). The revision is `inputRevision()` of this: the build
// id and the SHA-256 of each file's bytes, never a built detail, so the first call at 10,000 places costs one pass over about 1,000 files
// (about 100 ms) and not 2.9 s. Content only: an mtime is never read. The set is a superset on purpose: a file the builder does not read yet
// can only move the ETag, which is harmless; a file it reads that this set misses would serve stale caches, which is not.
//
// Repository-relative paths, forward slashes. A directory is walked in full (no filter), so a new data file joins the revision by being
// there. `data/schema/generated` is output of the code (the build id covers a code change), not an input.

// The trees and files are listed in runtime-files.ts, which next.config.ts also ships in every server function. The reads below carry
// `turbopackIgnore`: their paths are built at runtime, so the bundler would otherwise trace the whole project (over Vercel's 250 MB).
const TREES = REVISION_TREES;
const FILES = REVISION_FILES;
const SKIP = new Set(['data/schema/generated']);

function walk(root: string, rel: string, out: string[]): void {
  if (SKIP.has(rel)) return;
  const abs = path.join(root, rel);
  if (!existsSync(/* turbopackIgnore: true */ abs)) return;
  for (const e of readdirSync(/* turbopackIgnore: true */ abs, { withFileTypes: true })) {
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
  for (const f of FILES) if (existsSync(/* turbopackIgnore: true */ path.join(root, f))) paths.push(f);
  // each trip folder's data files and gallery file (the page's photos)
  const legacy = path.join(root, 'legacy');
  if (existsSync(/* turbopackIgnore: true */ legacy)) {
    for (const n of readdirSync(/* turbopackIgnore: true */ legacy)) {
      const data = path.join(legacy, n, 'data');
      if (existsSync(/* turbopackIgnore: true */ data) && statSync(/* turbopackIgnore: true */ data).isDirectory()) for (const f of readdirSync(/* turbopackIgnore: true */ data)) if (f.endsWith('.json')) paths.push(`legacy/${n}/data/${f}`);
      if (existsSync(/* turbopackIgnore: true */ path.join(legacy, n, 'gallery', 'gallery.json'))) paths.push(`legacy/${n}/gallery/gallery.json`);
    }
  }
  const files = [...new Set(paths)].map((p) => ({ path: p, sha256: createHash('sha256').update(readFileSync(/* turbopackIgnore: true */ path.join(root, p))).digest('hex') }));
  return { buildId: buildId(), files };
}

/** The revision of the current inputs (a helper for tests and the build report). */
export const currentRevision = (root?: string): string => inputRevision(revisionInputs(root));
