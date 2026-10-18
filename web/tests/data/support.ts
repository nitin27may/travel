import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPublicData } from '@/lib/public';

export const REPO = path.resolve(__dirname, '..', '..', '..');
export const WEB_DIR = path.join(REPO, 'web');

let real: ReturnType<typeof createPublicData> | null = null;
/** The adapter over the real repo data (built once per test file). */
export function realData() {
  return (real ??= createPublicData());
}

export interface FixtureFolder { slug: string; served?: boolean; private?: unknown; visibility?: unknown; kind?: string }

/** A temporary repo root whose legacy/MANIFEST.json is ours and whose data is the real data (symlinked). */
export function fixtureRoot(folders: FixtureFolder[]): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ld-fixture-'));
  symlinkSync(path.join(REPO, 'data'), path.join(root, 'data'));
  mkdirSync(path.join(root, 'legacy'));
  for (const name of readdirSync(path.join(REPO, 'legacy'))) {
    if (name === 'MANIFEST.json') continue;
    symlinkSync(path.join(REPO, 'legacy', name), path.join(root, 'legacy', name));
  }
  writeFileSync(path.join(root, 'legacy', 'MANIFEST.json'), JSON.stringify({ schema: 'legacy-manifest/1', folders }));
  return root;
}

/** The real manifest folders, with overrides applied. */
export function manifestWith(overrides: Record<string, Partial<FixtureFolder>>): FixtureFolder[] {
  const doc = JSON.parse(readFileSync(path.join(REPO, 'legacy', 'MANIFEST.json'), 'utf8')) as { folders: FixtureFolder[] };
  return doc.folders.map((f) => ({ ...f, ...(overrides[f.slug] ?? {}) }));
}
