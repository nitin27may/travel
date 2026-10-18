import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertOneFamilyPerPage, findMixedRoutes, pageFamilyEntries, registerPageFamily } from '@/lib/map/registry';

const WEB = path.resolve(__dirname, '..', '..');

describe('one map family per page', () => {
  it('passes for the registered pages (the globe counts as maplibre)', () => {
    expect(pageFamilyEntries().find((e) => e.route === '/globe')?.family).toBe('maplibre');
    expect(() => assertOneFamilyPerPage()).not.toThrow();
  });
  it('lets lanes register a page, and the same family twice', () => {
    registerPageFamily('/places/[slug]', 'google-embed');
    registerPageFamily('/places/[slug]', 'google-embed');
    expect(findMixedRoutes()).toEqual([]);
  });
  it('fails on a mix on one route', () => {
    const mixed = [
      { route: '/places/[slug]', family: 'google-js' as const },
      { route: '/places/[slug]', family: 'maplibre' as const },
    ];
    expect(findMixedRoutes(mixed)).toEqual([{ route: '/places/[slug]', families: ['google-js', 'maplibre'] }]);
    expect(() => assertOneFamilyPerPage(mixed)).toThrow(/Mixed map families/);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  let names: string[] = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.tsx?$/.test(n)) out.push(f);
  }
  return out;
}

describe('static scan of the app for mixed families', () => {
  it('no route file names two different literal map families', () => {
    const offenders: string[] = [];
    for (const f of walk(path.join(WEB, 'app'))) {
      const src = readFileSync(f, 'utf8');
      const fams = new Set([...src.matchAll(/(?:family|registerPageFamily\([^,]+,)\s*=?\s*["'{`]*\s*['"](maplibre|google-js|google-embed)['"]/g)].map((m) => m[1]));
      const google = [...fams].some((x) => x.startsWith('google'));
      const libre = fams.has('maplibre');
      if (google && libre) offenders.push(`${path.relative(WEB, f)}: ${[...fams].join(' + ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('MapLibre stays out of pages without a map', () => {
  const lib = (p: string) => readFileSync(path.join(WEB, p), 'utf8');
  it('only the client-only MapLibre component imports maplibre-gl, and only dynamically', () => {
    const runtime: string[] = [];
    for (const f of [...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'components')), ...walk(path.join(WEB, 'lib'))]) {
      const src = readFileSync(f, 'utf8');
      if (/from ['"]maplibre-gl['"]/.test(src.replace(/import type[^;]*;/g, ''))) runtime.push(path.relative(WEB, f));
      if (/\bawait import\(['"]maplibre-gl['"]\)/.test(src) && !f.endsWith('MapLibreMap.tsx')) runtime.push(`dyn:${path.relative(WEB, f)}`);
    }
    expect(runtime).toEqual([]);
  });
  it('MapSurface loads each family with next/dynamic and ssr:false', () => {
    const src = lib('components/map/MapSurface.tsx');
    for (const c of ['MapLibreMap', 'GoogleJsMap', 'GoogleEmbedMap']) {
      expect(src).toMatch(new RegExp(`const ${c} = dynamic\\(\\(\\) => import\\('./${c}'\\), \\{ ssr: false`));
      expect(src).not.toMatch(new RegExp(`^import .* from './${c}'`, 'm'));
    }
  });
  it('loads the Google script only inside loadGoogleMaps', () => {
    const hits = [...walk(path.join(WEB, 'components')), ...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'lib'))]
      .filter((f) => /maps\.googleapis\.com\/maps\/api\/js/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(WEB, f));
    expect(hits).toEqual([path.join('lib', 'map', 'google-js', 'loader.ts')]);
  });
});
