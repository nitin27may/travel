// The routed legs files (D-E5, TRP2b; API3-R-5, R-13): every `data/schedules/legs/<trip>.json` is a RESULT of scripts/legs-ors.mjs, and this is
// `--check` in the unit gate. No network and no key. A file that fails the contract's schema would silently drop a trip's legs at load
// (web/lib/server/source.ts legsFile returns null), so the schema, the caps, the pair coverage and the privacy guard are all checked here.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encodePolyline5 } from '@travel/core/schema/api/legs.ts';
import { API_LIMITS } from '@travel/core/schema/api/limits.ts';
import { checkLegsFile, LEG_SIMPLIFY_M, refusedGeometries, simplifyPolyline, TRIP_LEGS_MAX_CHARS, type RoutePair } from '../../scripts/legs/lib';
import { routePairs } from '../../scripts/legs/pairs';
import { getStore } from '@/lib/server/store';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DIR = path.join(ROOT, 'data', 'schedules', 'legs');
const slugs = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.unrouted.json')).map((f) => f.slice(0, -5));
const read = (f: string) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8'));

describe('the committed legs files', () => {
  it('there is one for the Rockies and one for the Dolomites', () => {
    expect(slugs).toContain('canadian-rockies-2029');
    expect(slugs).toContain('dolomites-2027');
  });
  for (const slug of slugs) {
    it(`${slug}: valid, within the caps, covering its route model, nothing near home`, async () => {
      const pairs = await routePairs(slug);
      const ledger = existsSync(path.join(DIR, `${slug}.unrouted.json`)) ? read(`${slug}.unrouted.json`) : null;
      const rep = checkLegsFile(read(`${slug}.json`), slug, pairs, ledger);
      expect(rep.problems).toEqual([]);
      expect(rep.refused).toBe(0); // the count only (R-5): any leg the guard would refuse stays out of the file
      expect(rep.routed).toBe(rep.legs);
      expect(rep.chars).toBeLessThan(TRIP_LEGS_MAX_CHARS);
      expect(rep.legs).toBeLessThanOrEqual(API_LIMITS.tripLegs.max);
    });
    it(`${slug}: the store serves every routed pair under public stop keys, with no geometry refused`, async () => {
      const r = await getStore().tripLegs(slug);
      expect(r.ok).toBe(true);
      if (!r.ok || 'moved' in r.data) return;
      expect(r.data.fetched).toBe(read(`${slug}.json`).fetched);
      expect(r.data.legs.length).toBeGreaterThan(0);
      expect(r.data.legs.filter((l) => l.geometry === null).length).toBe(0);
      expect(r.data.attribution).toMatch(/OpenStreetMap contributors \(ODbL\)/);
      for (const l of r.data.legs) expect(JSON.stringify(l)).not.toMatch(/proto:|loc:/);
    });
  }
  it('the fetcher\'s --check runs with no key and no network and passes', () => {
    const env = { ...process.env };
    delete env.ORS_API_KEY;
    const r = spawnSync(process.execPath, [path.join(ROOT, 'web', 'scripts', 'legs-ors.mjs'), '--check', '--key-file', '/nonexistent'], { cwd: path.join(ROOT, 'web'), env, encoding: 'utf8' });
    expect(r.stderr).not.toMatch(/ORS_API_KEY/);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('all files are valid');
  }, 120_000);
});

const pair = (from: string, to: string): RoutePair => ({ from, to, a: { lat: 1, lng: 1 }, b: { lat: 2, lng: 2 }, label: `${from} to ${to}` });
const good = (over: Record<string, unknown> = {}) => ({
  schema: 'trip-legs/2', trip: 't', fetched: '2026-10-23', attribution: 'x', simplifiedM: LEG_SIMPLIFY_M,
  legs: [{ from: 'a', to: 'b', profile: 'driving-car', mode: 'drive', km: 1, minutes: 2, geometry: encodePolyline5([[-116.1, 51.4], [-116.2, 51.5]]) }], ...over,
});

describe('checkLegsFile', () => {
  it('passes a good file and names nothing wrong', () => {
    expect(checkLegsFile(good(), 't', [pair('a', 'b')]).problems).toEqual([]);
  });
  it('fails a file that does not parse, a wrong trip, and a missing pair', () => {
    expect(checkLegsFile({ schema: 'trip-legs/3' }, 't', null).problems[0]).toMatch(/does not parse/);
    expect(checkLegsFile(good(), 'other', null).problems.join()).toMatch(/names trip/);
    const rep = checkLegsFile(good(), 't', [pair('a', 'b'), pair('b', 'c')]);
    expect(rep.missing.map((p) => p.to)).toEqual(['c']);
    expect(rep.problems.join()).toMatch(/1 of 2 pairs have no leg/);
  });
  it('accepts a pair the ledger lists as unrouted, and fails a stale leg or a ledger entry nobody asks for', () => {
    const ledger = { schema: 'trip-legs-unrouted/1' as const, trip: 't', pairs: [{ from: 'b', to: 'c', reason: 'x' }] };
    expect(checkLegsFile(good(), 't', [pair('a', 'b'), pair('c', 'b')], ledger).problems).toEqual([]);
    expect(checkLegsFile(good(), 't', [pair('a', 'b')], ledger).problems.join()).toMatch(/names a pair the route model does not ask for/);
    expect(checkLegsFile(good(), 't', [pair('x', 'y')]).problems.join()).toMatch(/not ask for/);
  });
  it('fails a leg with no geometry in a /2 file, a polyline over the cap and a total over the cap', () => {
    const bare = good({ legs: [{ from: 'a', to: 'b', profile: 'driving-car', mode: 'drive', km: 1, minutes: 2 }] });
    expect(checkLegsFile(bare, 't', [pair('a', 'b')]).problems.join()).toMatch(/no geometry/);
    const long = good({ legs: [{ ...good().legs[0]!, geometry: '?'.repeat(API_LIMITS.tripLegs.polylineChars + 1) }] });
    expect(checkLegsFile(long, 't', null).problems[0]).toMatch(/does not parse/);
    const many = Array.from({ length: 12 }, (_, i) => ({ ...good().legs[0]!, from: `a${i}`, to: `b${i}`, geometry: '?'.repeat(API_LIMITS.tripLegs.polylineChars) }));
    expect(checkLegsFile(good({ legs: many }), 't', null).problems.join()).toMatch(/over the total cap/);
  });
  it('counts a geometry within the household radius, and the file may not hold it', () => {
    const home = good({ legs: [{ ...good().legs[0]!, geometry: encodePolyline5([[-78.95, 43.87], [-78.9, 43.9]]) }] });
    expect(refusedGeometries(home.legs as { geometry?: string }[])).toBe(1);
    const rep = checkLegsFile(home, 't', null);
    expect(rep.refused).toBe(1);
    expect(rep.problems.join()).toMatch(/within the household radius/);
    expect(JSON.stringify(rep)).not.toMatch(/78\.9|43\.8/); // the report holds the count, never the leg
  });
});

describe('simplifyPolyline', () => {
  it('keeps the ends, drops points inside the tolerance and stays under the leg cap', () => {
    const wiggle: [number, number][] = Array.from({ length: 400 }, (_, i) => [-116 + i * 0.0005, 51 + (i % 2) * 0.00001]);
    const out = simplifyPolyline(encodePolyline5(wiggle))!;
    expect(out.tolM).toBe(LEG_SIMPLIFY_M);
    expect(out.geometry.length).toBeLessThan(encodePolyline5(wiggle).length / 10);
    expect(out.geometry.length).toBeLessThanOrEqual(API_LIMITS.tripLegs.polylineChars);
  });
  it('answers null for a string that is not a line', () => {
    expect(simplifyPolyline('!!')).toBeNull();
  });
});
