import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OPENAPI_PATH } from '@travel/core/catalogue/openapi.ts';
import { WEB } from '../helpers/built';

// The document and the routes name the same URLs (audit GB-A-6): every route file under app/api/v1 is a path of openapi.json, and every
// path of openapi.json is a route file. A documented URL that 404s fails here.
const ROOT = path.join(WEB, 'app', 'api', 'v1');

function routes(dir: string, rel: string[] = []): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    if (statSync(full).isDirectory()) return routes(full, [...rel, n]);
    return n === 'route.ts' ? [`/api/v1/${rel.join('/').replace(/\[(\w+)\]/g, '{$1}')}`.replace(/\/$/, '')] : [];
  });
}

describe('openapi.json and the route files', () => {
  const doc = JSON.parse(readFileSync(path.join(WEB, '..', OPENAPI_PATH), 'utf8')) as { paths: Record<string, unknown> };
  it('every route file is documented', () => {
    const documented = new Set(Object.keys(doc.paths));
    expect(routes(ROOT).filter((r) => !documented.has(r))).toEqual([]);
  });
  it('every documented path is a route file', () => {
    const files = new Set(routes(ROOT));
    expect(Object.keys(doc.paths).filter((p) => !files.has(p))).toEqual([]);
  });
});
