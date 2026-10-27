import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { DATED_FOLDER_RE, publicRef } from '@travel/core/catalogue/alias.ts';
import { hasDatedFolder } from '@travel/core/privacy/detect.ts';
import { EXPORT_FORMATS } from '@travel/core/schema/api/index.ts';
import { ownHosts } from '@/lib/config/product';
import { folderAliases } from '@/lib/public/aliases';
import { placeSlugs, tripSlugs } from '@/lib/public';
import { TRIP_SLUGS } from '@/lib/public/slugs';
import { respond, type EndpointName } from '@/lib/server/respond';
import { getStore } from '@/lib/server/store';
import { createJsonSource } from '@/lib/server/source';
import { builtOutDir } from '../helpers/built';

// REF-W, public-ref-aliases 6.2 (acceptance A6): no byte a visitor can fetch holds a dated trip folder (`canadian-rockies-sept-2029`).
// Scans ALL of the built output (HTML, RSC payloads, client chunks, web/public, sitemaps, the search index, share-image data) and the
// body of every /api/v1 endpoint for every place and trip slug plus every export format, for (1) the exact pinned folder names with NO
// URL exemption, case-insensitive, and (2) the privacy detector's month-and-year rule (a link to somebody else's page is skipped by its
// own-hosts rule). It also checks that no link to the old site's legacy folders (`<old host>/<folder>/`) is emitted anywhere.

const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp4|webm|pbf|gz|br|zip|wasm|map)$/i;
const TEXT_LIMIT = 40 * 1024 * 1024;

/** Every folder a dated name can come from: the pinned table, the slug map's keys, and any key that has a month and year. */
export function datedFolders(): string[] {
  const names = new Set([...Object.keys(folderAliases()), ...Object.keys(TRIP_SLUGS).filter((f) => DATED_FOLDER_RE.test(f))]);
  return [...names].sort();
}
const allFolders = (): string[] => [...new Set([...Object.keys(folderAliases()), ...Object.keys(TRIP_SLUGS)])].sort();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface Finding { where: string; kind: 'folder-name' | 'month-year' | 'old-site-link'; sample: string; count: number }

/** One text through the three checks. The sample is the matched token only (it is a dated name, which this test never prints in full into a log of values). */
export function scanText(text: string, where: string, folders = datedFolders(), every = allFolders()): Finding[] {
  const out: Finding[] = [];
  const names = new RegExp(folders.map(esc).join('|'), 'ig');
  const m = text.match(names);
  if (m) out.push({ where, kind: 'folder-name', sample: `${m.length}x ${m[0]!.slice(0, 4)}...`, count: m.length });
  if (hasDatedFolder(text, ownHosts())) out.push({ where, kind: 'month-year', sample: 'detector', count: 1 });
  const old = new RegExp(`nks-travel\\.pages\\.dev/(?:${every.map(esc).join('|')})(?![a-z0-9-])`, 'i');
  if (old.test(text)) out.push({ where, kind: 'old-site-link', sample: 'old host + legacy folder', count: 1 });
  return out;
}

function* walk(dir: string, rel = ''): Generator<string> {
  for (const name of readdirSync(path.join(dir, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(path.join(dir, r)).isDirectory()) yield* walk(dir, r);
    else yield r;
  }
}

export function scanDir(dir: string): { files: number; findings: Finding[]; countOf: (kind: Finding['kind']) => number; stringsOf: (kind: Finding['kind']) => number } {
  const findings: Finding[] = [];
  let files = 0;
  for (const rel of walk(dir)) {
    if (BINARY.test(rel) || rel === '.built-from') continue;
    const full = path.join(dir, rel);
    if (statSync(full).size > TEXT_LIMIT) continue;
    files++;
    findings.push(...scanText(readFileSync(full, 'utf8'), rel));
  }
  return { files, findings, countOf: (k) => findings.filter((f) => f.kind === k).length, stringsOf: (k) => findings.filter((f) => f.kind === k).reduce((n, f) => n + f.count, 0) };
}

const show = (f: Finding[]) => f.slice(0, 12).map((x) => `${x.kind} ${x.where} (${x.sample})`).join('\n') + (f.length > 12 ? `\n... ${f.length} in all` : '');

describe('the scanner itself (it must fail on output that is not fixed)', () => {
  it('finds a planted dated ref in each form: a file, an RSC id, an encoded href, a key, upper case, the old site link', () => {
    const f = folderAliases();
    expect(Object.keys(f).length).toBeGreaterThanOrEqual(8);
    const [dated] = datedFolders();
    const planted = [
      `legacy/${dated}/sights/bow-lake`,
      `<section id="offer-legacy-${dated}-banff-gondola-ticket">`,
      `?ref=legacy%2F${dated}%2Fsights`,
      `{"${dated.toUpperCase()}":1}`,
      `<a href="https://nks-travel.pages.dev/${dated}/">trip</a>`,
    ];
    for (const p of planted) expect(scanText(p, 'planted').length, p).toBeGreaterThan(0);
    expect(scanText(`legacy/${publicRef(`legacy/${dated}/x`, f).split('/')[1]}/x and https://on-top.ca/Outings/2022/Indefatigable-Bench-July-2022.html`, 'ok')).toEqual([]);
  });

  it('fails on a directory with one planted file, and passes the same directory without it', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'dated-scan-'));
    try {
      mkdirSync(path.join(dir, 'places', 'x'), { recursive: true });
      writeFileSync(path.join(dir, 'places', 'x', 'index.html'), '<div id="offer-legacy-canadian-rockies-2029-x"></div>');
      expect(scanDir(dir).findings).toEqual([]);
      writeFileSync(path.join(dir, 'places', 'x', 'index.txt'), 'legacy/canadian-rockies-sept-2029/sights/bow-lake');
      expect(scanDir(dir).findings.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the store without the wrapper (the state before the fix) holds dated names, and respond() fails closed on it', async () => {
    const raw = new JsonStore(createJsonSource());
    const r = await raw.getPlace('banff-gondola');
    expect(r.ok && scanText(JSON.stringify(r.data), 'raw getPlace').length).toBeGreaterThan(0);
    const res = await respond('getPlace', new Request('http://x/api/v1/places/banff-gondola/'), { slug: 'banff-gondola' }, raw);
    expect(res.status).toBe(500);
  });
});

describe('built output holds no dated trip folder', () => {
  const dir = builtOutDir();
  const scan = scanDir(dir);

  it('scans the HTML, RSC payloads, client chunks, web/public, sitemaps, search index and share-image data', () => {
    expect(scan.files).toBeGreaterThan(1000);
    // report the count: 0 is the fixed state
    console.log(`DATED_SCAN built files=${scan.files} folder-name=${scan.countOf('folder-name')} (${scan.stringsOf('folder-name')} strings) month-year=${scan.countOf('month-year')} old-site-link=${scan.countOf('old-site-link')}`);
    expect(scan.findings.filter((f) => f.kind !== 'old-site-link'), show(scan.findings)).toEqual([]);
  });

  it('emits no link to a legacy folder of the old site', () => {
    expect(scan.findings.filter((f) => f.kind === 'old-site-link'), show(scan.findings)).toEqual([]);
  });

  it('has the files the scan must cover (pages, RSC, chunks, sitemap, search, public)', () => {
    const names = [...walk(dir)];
    for (const re of [/^places\/banff-gondola\/index\.html$/, /^places\/banff-gondola\/(index|__next\.[^/]+)\.txt$/, /^_next\/static\/.+\.js$/, /^sitemap\.xml$/, /^search\//]) {
      expect(names.some((n) => re.test(n)), String(re)).toBe(true);
    }
  });
});

describe('every /api/v1 body and every export format holds no dated trip folder', () => {
  const get = async (name: EndpointName, url: string, params: Record<string, string> = {}) => {
    const res = await respond(name, new Request(`http://localhost${url}`), params, getStore());
    return { status: res.status, text: await res.text(), url };
  };

  it('lists, details, legs, nearby, search, globe and resolve answer 200 and scan clean', async () => {
    const calls: Promise<{ status: number; text: string; url: string }>[] = [
      get('listPlaces', '/api/v1/places/?pageSize=100'),
      get('listTrips', '/api/v1/trips/'),
      get('globeTree', '/api/v1/globe/tree/'),
      get('search', '/api/v1/search/?q=gondola'),
      get('search', '/api/v1/search/?q=rockies'),
      ...placeSlugs().flatMap((s) => [get('getPlace', `/api/v1/places/${s}/`, { slug: s }), get('nearbyForPlace', `/api/v1/places/${s}/nearby/`, { slug: s })]),
      ...tripSlugs().flatMap((s) => [get('getTrip', `/api/v1/trips/${s}/`, { slug: s }), get('tripLegs', `/api/v1/trips/${s}/legs/`, { slug: s })]),
    ];
    const bodies = await Promise.all(calls);
    const bad = bodies.filter((b) => b.status !== 200 && b.status !== 404 && b.status !== 501);
    expect(bad.map((b) => `${b.status} ${b.url}`), 'a body held back by the detector (fail closed) is a leak the wrapper missed').toEqual([]);
    const findings = bodies.flatMap((b) => scanText(b.text, b.url));
    console.log(`DATED_SCAN api bodies=${bodies.length} findings=${findings.length}`);
    expect(findings, show(findings)).toEqual([]);
  }, 300_000);

  it('every export format of every trip and place scans clean', async () => {
    const calls: Promise<{ status: number; text: string; url: string }>[] = [];
    for (const type of ['trip', 'place'] as const) {
      for (const slug of type === 'trip' ? tripSlugs() : placeSlugs()) {
        for (const format of EXPORT_FORMATS) calls.push(get('getExport', `/api/v1/export/${type}/${slug}/?format=${format}`, { type, slug, format }));
      }
    }
    const bodies = await Promise.all(calls);
    const bad = bodies.filter((b) => b.status >= 500);
    expect(bad.map((b) => `${b.status} ${b.url}`)).toEqual([]);
    const findings = bodies.flatMap((b) => scanText(b.text, b.url));
    console.log(`DATED_SCAN exports bodies=${bodies.length} findings=${findings.length}`);
    expect(findings, show(findings)).toEqual([]);
  }, 600_000);
});
