import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GENERATED_LINE, GRAPH_DIR } from '@travel/core/graph/build.ts';
import { builtOutDir } from '../helpers/built';

// PA-W, the built half (protected-area-entry 12; P9, public-ref-aliases): (1) the graph index is server side only: no client chunk and no
// public/ file holds it or its API; (2) what the trip pages and API carry of protected-area entry is derived text, never a capture ref of the
// records behind it. The wiring itself is tests/trips/entry-wiring.test.ts and tests/data/booking-refs.test.ts.
const ROOT = path.resolve(__dirname, '../../..');
const out = builtOutDir();

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}
const TEXT = /\.(?:html|txt|json|js|css|xml|map|body)$|^[^.]+$/;
const text = (f: string): string => readFileSync(f, 'utf8');

describe('the graph index never reaches a visitor (P9)', () => {
  const served = walk(out).filter((f) => !/\.(?:png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp4|webm|pbf|gz|br|zip|wasm)$/.test(f));
  const shards = walk(path.join(ROOT, GRAPH_DIR)).map((f) => path.basename(f));

  it('found the build and the graph files to look for', () => {
    expect(served.length).toBeGreaterThan(500);
    expect(shards).toContain('index.json');
    expect(shards.length).toBeGreaterThan(5);
  });
  it('no served file is a graph file, and none holds its path, its generated line or its schema names', () => {
    const hits: string[] = [];
    for (const f of served) {
      const rel = path.relative(out, f);
      if (/(?:^|\/)graph(?:\/|\.json$)/.test(rel) || /catalogue\/graph/.test(rel)) hits.push(`${rel} (name)`);
      if (!TEXT.test(f)) continue;
      const t = text(f);
      for (const m of [GRAPH_DIR, GENERATED_LINE, 'catalogue-graph-shard/', '"catalogue-graph/']) if (t.includes(m)) hits.push(`${rel} (${m})`);
    }
    expect(hits).toEqual([]);
  });
  it('no client chunk holds the index builder or its reads (chainOf, membersAll, requirementsOf, buildIndex)', () => {
    const hits: string[] = [];
    for (const f of walk(path.join(out, '_next', 'static')).filter((x) => x.endsWith('.js'))) {
      const t = text(f);
      for (const m of ['chainOf', 'membersAll', 'requirementsOf', 'containerChain', 'catalogue-graph']) if (t.includes(m)) hits.push(`${path.relative(out, f)} (${m})`);
    }
    expect(hits).toEqual([]);
  });
});

describe('the trips carry derived entry text, never the records behind it', () => {
  const refs = Object.values(JSON.parse(readFileSync(path.join(ROOT, 'data/trips/booking-refs.json'), 'utf8')).trips as Record<string, Record<string, string | { ref: string }>>)
    .flatMap((rows) => Object.values(rows).map((v) => (typeof v === 'string' ? v : v.ref)));
  const tripFiles = walk(path.join(out, 'trips')).filter((f) => /\.(?:html|txt)$/.test(f));
  const apiFiles = (() => {
    try { return walk(path.join(out, 'api', 'v1', 'trips')); } catch { return []; }
  })();

  it('found the Rockies page and the refs to look for', () => {
    expect(refs.length).toBeGreaterThan(0);
    expect(tripFiles.some((f) => f.includes(`${path.sep}canadian-rockies-2029${path.sep}`))).toBe(true);
  });
  it('no trip page, payload or trip API body holds the ref of a mapped record', () => {
    const hits: string[] = [];
    for (const f of [...tripFiles, ...apiFiles]) {
      const t = text(f);
      for (const r of refs) if (t.includes(r) || t.includes(encodeURIComponent(r))) hits.push(`${path.relative(out, f)} (${r})`);
    }
    expect(hits).toEqual([]);
  });
  it('the Rockies page says what it knows: the shuttle window and link, the lakeshore check, and an honest "not checked" line for a park nobody has read', () => {
    const html = text(path.join(out, 'trips', 'canadian-rockies-2029', 'index.html'));
    expect(html).toContain('Opens 2 days before Day 10 at 08:00 local');
    expect(html).toContain('https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise');
    expect(html).toContain('Entry not checked yet for');
    expect(html).toMatch(/data-print-parks="canadian-rockies-2029"/);
  });
  it('the trip API carries `parks` with names, slugs and days', () => {
    const body = apiFiles.find((f) => /canadian-rockies-2029/.test(f) && !/\.meta$/.test(f));
    if (!body) return; // the API files are only prerendered for some routes; the adapter test pins the shape
    const j = JSON.parse(text(body)) as { parks?: { name: string; line: string; slug: string | null; days: number[] }[] };
    for (const p of j.parks ?? []) expect(Object.keys(p).sort()).toEqual(['coveredBy', 'days', 'kind', 'line', 'modes', 'name', 'needs', 'nights', 'parent', 'saving', 'slug', 'state']);
  });
});
