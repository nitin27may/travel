import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSnapshotAllowList } from './allowlist';
import { REPO, WEB_DIR, realData } from './support';
import { builtOutDir } from '../helpers/built';

// The prototype's Dolomites data is household data. These tests pull every household value out of the SOURCE
// file (prototype/src/data/trip.ts), so they need no node_modules, and prove none reaches the snapshot,
// the adapter output or a built site.
const tripSource = readFileSync(path.join(REPO, 'prototype', 'src', 'data', 'trip.ts'), 'utf8');

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
  'Kai',
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
        for (const s of SECRETS) if (!/^(Partner|Kai|Nitin)$/.test(s) && text.includes(s)) hits.push(`${path.relative(WEB_DIR, f)}: ${s}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
