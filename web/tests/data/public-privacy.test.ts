import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readTownsFiles, TOWNS_DIR } from '@travel/core/derive/townsData.ts';
import { HOME_TOWN_RE, nearHome } from '@travel/core/privacy/home.ts';
import { buildSnapshotAllowList } from './allowlist';
import { REPO, WEB_DIR, realData } from './support';
import { builtOutDir } from '../helpers/built';

// The prototype's Dolomites data is household data. These tests pull every household value out of the SOURCE
// file (data/seed/prototype/trip.ts), so they need no node_modules, and prove none reaches the snapshot,
// the adapter output or a built site.
const tripSource = readFileSync(path.join(REPO, 'data', 'seed', 'prototype', 'trip.ts'), 'utf8');

function quoted(re: RegExp): string[] {
  return [...tripSource.matchAll(re)].map((m) => m[1]);
}

const SECRETS = [
  ...quoted(/\bcode:\s*"([^"]+)"/g), // booking codes
  ...quoted(/\bcost:\s*"([^"]+)"/g), // costs
  ...quoted(/\bphone:\s*"([^"]+)"/g),
  ...quoted(/\bemail:\s*"([^"]+)"/g),
  ...quoted(/\baddress:\s*"([^"]+)"/g),
  ...quoted(/\bmanageUrl:\s*"([^"]+)"/g),
  ...quoted(/\bname:\s*"([A-Za-z0-9-]+\.(?:pdf|png))"/g), // attachments
  ...quoted(/\bnotes:\s*"([^"]+)"/g), // reservation notes
  ...[...tripSource.matchAll(/\{ id: "t\d", name: "([^"]+)"/g)].map((m) => m[1]), // traveller names
  ...quoted(/\bseats:\s*\{([^}]+)\}/g),
  ...quoted(/\btitle:\s*"([^"]*Example[^"]*)"/g), // example hotels
  'Example hotel',
  'Example guesthouse',
  'Aarav',
  'Partner',
].filter((s) => s.length >= 4);

const PRIVATE_KEYS = ['travellers', 'who', 'age', 'initials', 'reservations', 'tasks', 'lists', 'payment', 'cost', 'code', 'phone', 'email', 'address', 'seats', 'attachments', 'manageUrl', 'guests', 'copies', 'by'];

function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

describe('household data never reaches the public output', () => {
  it('found the household values to look for', () => {
    expect(SECRETS.length).toBeGreaterThan(30);
    expect(SECRETS).toContain('K7Q2PZ');
    expect(SECRETS).toContain('Nitin');
  });

  it('the committed snapshot holds none of them', () => {
    const text = readFileSync(path.join(WEB_DIR, 'data-snapshots', 'prototype.json'), 'utf8');
    const hits = SECRETS.filter((s) => text.includes(s));
    // "Nitin" is the publisher's first name on public-trips entries; the snapshot drops that field too
    expect(hits).toEqual([]);
    expect(allKeys(JSON.parse(text).trip).size).toBeGreaterThan(0);
    for (const k of PRIVATE_KEYS) expect(allKeys(JSON.parse(text).trip).has(k), `trip key ${k}`).toBe(false);
  });

  it('the snapshot keeps only the allow-listed trip fields', () => {
    const trip = JSON.parse(readFileSync(path.join(WEB_DIR, 'data-snapshots', 'prototype.json'), 'utf8')).trip;
    expect(Object.keys(trip).sort()).toEqual(['days', 'id', 'logistics', 'nights', 'title', 'zone']);
    for (const d of trip.days) for (const it of d.items) expect(Object.keys(it).every((k) => ['id', 'placeId', 'time', 'variant', 'note'].includes(k))).toBe(true);
    for (const l of trip.logistics) expect(Object.keys(l).every((k) => ['id', 'kind', 'dayN', 'label', 'bookNote', 'bookRule'].includes(k))).toBe(true);
  });

  it('the allow-list function drops a household value planted in any field', () => {
    const planted = buildSnapshotAllowList();
    expect(JSON.stringify(planted)).not.toMatch(/PLANTED/);
  });

  it('adapter output holds none of them', () => {
    const d = realData();
    const out = JSON.stringify({ t: d.internals.trips, p: d.internals.places, g: d.globeIndex(), r: d.legacyPlaceRedirects() });
    expect(SECRETS.filter((s) => out.includes(s))).toEqual([]);
    expect(out).not.toMatch(/Example (hotel|guesthouse)/i);
    // a warning's `code` ("W_OVERLAP") is the scheduler's, not a booking code; the string checks above cover the timeline's values
    const stripped = JSON.parse(JSON.stringify({ t: d.internals.trips.map(({ schedule: _s, days, ...t }) => ({ ...t, days: days.map(({ scheduleInput: _i, ...x }) => x) })), p: d.internals.places, g: d.globeIndex(), r: d.legacyPlaceRedirects() }));
    for (const k of PRIVATE_KEYS) expect(allKeys(stripped).has(k), `output key ${k}`).toBe(false);
  });

  it('a built site holds none of them (the server build and the fixture builds, when present)', () => {
    const dirs = ['.next', '.fixture-out', '.fixture-beacon'].filter((d) => existsSync(path.join(WEB_DIR, d, 'BUILD_ID'))).map((d) => builtOutDir(d));
    const hits: string[] = [];
    for (const dir of dirs) {
      for (const f of walk(dir).filter((f) => /\.(html|txt|json|xml|js|css|map|svg)$/.test(f))) {
        const text = readFileSync(f, 'utf8');
        for (const s of SECRETS) if (!/^(Partner|Aarav|Nitin)$/.test(s) && text.includes(s)) hits.push(`${path.relative(WEB_DIR, f)}: ${s}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

// The towns layer is the trust root of the town rule (store.ts A33): the site serves a town exactly as the public gazetteer has it and the
// privacy detector accepts a point near home only when it equals the file's own value. So the file must be GeoNames' numbers and nothing else.
describe('the towns files are the GeoNames dump, verbatim (META-2)', () => {
  const layer = readTownsFiles(REPO); // throws when a part's bytes differ from the manifest's SHA-256
  const dump = path.join(REPO, 'tools', '.cache', 'geonames', 'cities1000.zip');

  it('records the source, the download date, the licence and the hash of the download', () => {
    const src = layer.manifest.source;
    expect(src.licence.id).toBe('CC BY 4.0');
    expect(src.downloaded).toMatch(/^\d{4}-\d\d-\d\d$/);
    for (const f of Object.values(src.files)) {
      expect(f.url.startsWith('https://download.geonames.org/')).toBe(true);
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('holds only the dump\'s own columns: a point has the dump\'s five decimals at most, the name is only in id, name and ascii', () => {
    for (const r of layer.rows) {
      for (const n of [r.lat, r.lon]) expect(String(n).split('.')[1]?.length ?? 0, r.id).toBeLessThanOrEqual(5);
      expect(Number.isInteger(r.geonamesId) && r.geonamesId > 0, r.id).toBe(true);
    }
    // the household town may be named in a row's id, name and ascii name (public GeoNames data) and nowhere else in the layer
    for (const f of readdirSync(path.join(REPO, TOWNS_DIR)).filter((n) => n.endsWith('.json') && n !== 'manifest.json' && n !== 'anchors.json')) {
      const doc = JSON.parse(readFileSync(path.join(REPO, TOWNS_DIR, f), 'utf8')) as { admin1: Record<string, string | null>; rows: unknown[][] };
      expect(JSON.stringify(doc.admin1), f).not.toMatch(HOME_TOWN_RE);
      for (const row of doc.rows) expect([row[2], row[3], row[4], row[5], row[7]].map(String).join(' '), `${f} ${row[0]}`).not.toMatch(HOME_TOWN_RE);
    }
    for (const n of ['manifest.json', 'anchors.json']) {
      const text = readFileSync(path.join(REPO, TOWNS_DIR, n), 'utf8');
      // the manifest lists parts and hashes; the anchors are rounded public points of places, none of them the household's
      expect(text, n).not.toMatch(HOME_TOWN_RE);
    }
    const anchors = JSON.parse(readFileSync(path.join(REPO, TOWNS_DIR, 'anchors.json'), 'utf8')) as [number, number][];
    expect(anchors.filter(([la, lo]) => nearHome(la, lo)).length).toBe(0);
  });

  it.runIf(existsSync(dump))('every point is a row of the downloaded GeoNames file, unchanged (a point the dump does not hold fails)', () => {
    const txt = execFileSync('unzip', ['-p', dump, 'cities1000.txt'], { maxBuffer: 1 << 28 }).toString('utf8');
    const rows = new Map<number, string[]>();
    for (const line of txt.split('\n')) if (line) rows.set(Number(line.split('\t')[0]), line.split('\t'));
    const bad: string[] = [];
    for (const r of layer.rows) {
      const f = rows.get(r.geonamesId);
      if (!f || f[1] !== r.name || Number(f[4]) !== r.lat || Number(f[5]) !== r.lon || Number(f[14]) !== r.pop || f[8].toLowerCase() !== r.cc) bad.push(r.id);
    }
    expect(bad).toEqual([]);
  });
});
