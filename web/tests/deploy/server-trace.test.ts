import { readFileSync, globSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '@/next.config';
import { travelRoot } from '@/lib/data/root';
import { revisionInputs } from '@/lib/server/inputs';
import { NEVER_SHIPPED_GLOBS, REVISION_FILES, REVISION_TREES, SERVER_RUNTIME_GLOBS, fromWebDir } from '@/lib/server/runtime-files';

// A deployed server function carries only what its trace lists. The dataset is read from the repository root, which the bundler cannot
// follow, so next.config.ts ships SERVER_RUNTIME_GLOBS explicitly; these tests keep that list and the readers in step (Vercel, R-61).

const root = travelRoot();
// Next expands the include globs with `dot: true`; path.matchesGlob has no such option, so leading dots are dropped from both sides.
const undot = (p: string) => p.replace(/(^|\/)\./g, '$1');
const shipped = (rel: string) => SERVER_RUNTIME_GLOBS.some((g) => path.matchesGlob(undot(rel), undot(g)));

describe('server function file list', () => {
  it('ships every file the catalogue revision hashes', () => {
    const files = revisionInputs(root).files.map((f) => f.path);
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((f) => !shipped(f))).toEqual([]);
  });

  it('has no glob that matches nothing (a renamed folder would ship an empty function)', () => {
    const dead = SERVER_RUNTIME_GLOBS.filter((g) => globSync(g, { cwd: root }).length === 0);
    expect(dead).toEqual([]);
  });

  it('keeps the revision trees and files inside the shipped list', () => {
    for (const t of REVISION_TREES) expect(SERVER_RUNTIME_GLOBS).toContain(`${t}/**/*`);
    for (const f of REVISION_FILES) expect(SERVER_RUNTIME_GLOBS).toContain(f);
  });

  it('ships the request-time reads outside the revision', () => {
    for (const rel of ['web/public/globe/admin/USA-ADM1.json', 'data/schema/generated/openapi.json', 'data/reference/licences.json', 'legacy/MANIFEST.json']) {
      expect(shipped(rel), rel).toBe(true);
    }
  });

  it('never ships local-only private inputs', () => {
    expect(NEVER_SHIPPED_GLOBS.some((g) => path.matchesGlob('data/relevance/inputs/private-origin.local.json', g))).toBe(true);
  });
});

describe('next.config tracing', () => {
  it('includes the runtime list in every route, relative to web/', () => {
    expect(config.outputFileTracingIncludes?.['*']).toEqual(SERVER_RUNTIME_GLOBS.map(fromWebDir));
    expect(fromWebDir('web/public/globe/admin/**/*')).toBe('public/globe/admin/**/*');
    expect(fromWebDir('data/**/*')).toBe('../data/**/*');
  });

  it('excludes the bulk folders and the private inputs', () => {
    const ex = config.outputFileTracingExcludes?.['*'] ?? [];
    for (const g of ['out/**', 'tests/**', 'test-results/**', 'public/img/**', 'public/og/**', '.og-cache/**', '.fixture-*/**', '../data/**/*.local.json']) {
      expect(ex).toContain(g);
    }
  });
});

describe('dynamic fs reads are opaque to the bundler', () => {
  // A read whose path the bundler cannot bound makes it trace the whole project (about 700 MB) into every function; these are the
  // reads Turbopack flagged ("Dynamic filesystem access causes tracing of the whole project"), each now marked.
  const FS_CALL = /\b(existsSync|readFileSync|readdirSync|statSync)\(([^)]*)/g;
  const fnBody = (src: string, fn: string) => {
    const at = src.indexOf(`function ${fn}(`);
    return src.slice(at, src.indexOf('\n}\n', at));
  };
  const cases: [string, string, (arg: string) => boolean][] = [
    ['web/lib/server/inputs.ts', 'walk', () => true],
    ['web/lib/server/inputs.ts', 'revisionInputs', () => true],
    ['web/lib/data/trips.ts', 'readLegacyTrips', (arg) => arg.includes('file')],
    ['core/src/db/loader.ts', 'loadMigrations', () => true],
  ];
  for (const [file, fn, relevant] of cases) {
    it(`${file} ${fn}(): its fs calls carry turbopackIgnore`, () => {
      const calls = [...fnBody(readFileSync(path.join(root, file), 'utf8'), fn).matchAll(FS_CALL)].filter((m) => relevant(m[2]));
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.filter((m) => !m[2].startsWith('/* turbopackIgnore: true */')).map((m) => m[0])).toEqual([]);
    });
  }
});
