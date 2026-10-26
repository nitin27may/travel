import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { EXPORT_FORMATS } from '@travel/core/schema/api/index.ts';
import { loadTrips } from '@/lib/data/trips';
import { travelRoot } from '@/lib/data/root';
import { respond } from '@/lib/server/respond';
import { HandlerStore } from '../api/handlerStore';
import { jsonTarget } from '../api/targets';

// PRIV-TD (BACKLOG 15.328, R-257, owner Q308): no public trip output carries a value computed from the household's real trip dates.
// The pages used to print "Finished plan" from the old hub's `trip-date` meta and `/api/v1` served `isDone`. Every public trip is now
// a published, dateless plan. This file reads what the API serves (list, every detail, every export format, the globe trip cards)
// through the route handlers; trip-status-built.test.ts reads the built HTML.

/** Words only a finished-trip status writes; none is a plan's own wording. */
// the hub's countdown badge is matched as written ("Past trip"); the home legend's generic "a past trip used as the template" is copy
const BADGE = /\bPast trip\b/;
const STATUS_WORDS = /finished plan|kept as a template|use (?:it )?as a template|\bin \d+ days\b|data-trip-done/i;

/**
 * The household's real trip dates, read from where the old hub reads them (the `trip-date` and `trip-dates` metas, a data trip's
 * edition) and the countdown the hub derives from them. Values only: the test never prints them.
 */
function realDateValues(): string[] {
  const out = new Set<string>();
  for (const t of loadTrips(travelRoot())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.date)) out.add(t.date);
    if (t.dates.trim().length >= 6) out.add(t.dates.trim());
    if (t.badge && t.when !== 'unknown') out.add(t.badge);
  }
  return [...out];
}

function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}

/** Which kinds of leak a served text holds (named, never the value). */
function leaks(text: string, real: string[]): string[] {
  const hits: string[] = [];
  if (/"isDone"\s*:/.test(text)) hits.push('the isDone key');
  if (STATUS_WORDS.test(text) || BADGE.test(text)) hits.push('a finished-trip status word');
  if (real.some((v) => text.includes(v))) hits.push('a real trip date');
  return hits;
}

describe('public trip output carries no household-derived status (PRIV-TD)', () => {
  const { target } = jsonTarget();
  const store = target.make() as JsonStore;
  const api = new HandlerStore(store);
  const real = realDateValues();

  it('found the real trip dates to look for (the scan is live)', () => {
    expect(real.length).toBeGreaterThan(5);
    expect(leaks('{"isDone":false}', real)).toEqual(['the isDone key']);
    expect(leaks('<p class="trip-kicker">Finished plan · Vermont</p>', real)).toEqual(['a finished-trip status word']);
    expect(leaks(`starts ${real[0]}`, real)).toEqual(['a real trip date']);
  });

  it('/api/v1/trips and every /api/v1/trips/{slug} answer without isDone, a status word or a real date', async () => {
    const list = await api.request('/api/v1/trips/?pageSize=100');
    expect(list.status).toBe(200);
    const rows = (JSON.parse(list.text) as { items: { slug: string }[] }).items;
    expect(rows.length).toBeGreaterThan(5);
    expect(keysOf(JSON.parse(list.text)).has('isDone')).toBe(false);
    expect(leaks(list.text, real), '/api/v1/trips/').toEqual([]);
    for (const { slug } of rows) {
      const r = await api.request(`/api/v1/trips/${slug}/`);
      expect(r.status, slug).toBe(200);
      expect(keysOf(JSON.parse(r.text)).has('isDone'), slug).toBe(false);
      expect(leaks(r.text, real), `/api/v1/trips/${slug}/`).toEqual([]);
    }
  });

  it('every trip export, in every format, and every globe trip card is clean', async () => {
    const rows = (JSON.parse((await api.request('/api/v1/trips/?pageSize=100')).text) as { items: { slug: string }[] }).items;
    let cards = 0;
    for (const { slug } of rows) {
      for (const format of EXPORT_FORMATS) {
        const res = await respond('getExport', new Request(`http://api.test/api/v1/export/trip/${slug}/?format=${format}`), { type: 'trip', slug }, store);
        expect(res.status, `${slug} ${format}`).toBe(200);
        expect(leaks(await res.text(), real), `export ${slug} ${format}`).toEqual([]);
      }
      const card = await api.request(`/api/v1/globe/card/trip/${slug}/`);
      if (card.status !== 200) continue;
      cards++;
      expect(leaks(card.text, real), `globe card ${slug}`).toEqual([]);
    }
    expect(cards).toBeGreaterThan(0);
  });

  it('the handlers refuse a body with a planted isDone (the detector key), whatever its value', async () => {
    const REV = 'a'.repeat(64);
    for (const isDone of [true, false]) {
      const store = { revision: async () => REV, listTrips: async () => ({ ok: true, data: { items: [{ slug: 'x', title: 'X', isDone }], total: 1, page: 1, pageSize: 1 }, revision: REV }) } as never;
      const res = await respond('listTrips', new Request('http://api.test/api/v1/trips/'), {}, store);
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain('isDone');
    }
  });

  it('a day zone\'s `home` is the trip\'s own base zone, never the household\'s (alignment 2.6 S3)', async () => {
    const rows = (JSON.parse((await api.request('/api/v1/trips/?pageSize=100')).text) as { items: { slug: string }[] }).items;
    let seen = 0;
    for (const { slug } of rows) {
      const t = JSON.parse((await api.request(`/api/v1/trips/${slug}/`)).text) as { days: { zone?: { home: string; homeAbbr: string } }[] };
      const zones = t.days.map((d) => d.zone).filter((z): z is { home: string; homeAbbr: string } => !!z);
      if (!zones.length) continue;
      const file = path.join(travelRoot(), 'data', 'schedules', `${slug}.json`);
      expect(existsSync(file), slug).toBe(true);
      const tz = (JSON.parse(readFileSync(file, 'utf8')) as { tz: string }).tz;
      const part = (style: 'longGeneric' | 'shortGeneric') => new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style }).formatToParts(new Date(Date.UTC(2029, 6, 1))).find((p) => p.type === 'timeZoneName')!.value;
      for (const z of zones) {
        expect(z.home.toLowerCase(), slug).toBe(part('longGeneric').toLowerCase());
        expect(z.homeAbbr, slug).toBe(part('shortGeneric'));
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
