// Review STEP2-PRV PR-003: the park arrival. (c) A park's places are its named area, never a 50 km circle round its point (Kananaskis places
// are not Banff members). (b) Each row names the day it fits best, never a full day. (a) The rows on show are scored in idle-time batches,
// fast: the first page of Banff on the Rockies copy is scored well inside 2 s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { makeFitter, type Fit } from '@/components/trips/edit/add/fit';
import { FIT_DAYS, groupByBase, isParkMember, memberQuery, nearDays, ownsArea, parkStem, scoreDays, scoredWords } from '@/components/trips/edit/add/members';
import { candidateOf, type Found } from '@/components/trips/edit/add/place';
import { foundOf } from '@/components/trips/edit/add/source';
import { runStaged, type IdleHost } from '@/components/trips/edit/add/stage';
import type { TimelineModel } from '@/components/trips/timeline/model';
import { PAGE_SIZE } from '@/lib/config/product';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { copy } from './helpers';

const rowsOfCatalogue = async () => {
  const { createJsonSource } = await import('@/lib/server/source');
  return createJsonSource().placeRows.map((r) => ({ ...foundOf(r as never), ref: r.ref }));
};
const bySlug = (rows: readonly Found[], slug: string) => rows.find((r) => r.slug === slug)!;

describe('a park\'s places are its named area (c)', () => {
  it('the name a place\'s area is called by', () => {
    expect(parkStem('Banff National Park')).toBe('banff');
    expect(parkStem('Kananaskis Country')).toBe('kananaskis');
    expect(parkStem('Mount Robson Provincial Park')).toBe('mount robson');
    expect(parkStem("Smugglers' Notch State Park")).toBe('smugglers notch');
    expect(parkStem('Percé Rock')).toBe('perce rock');
    expect(memberQuery({ name: 'National Park' })).toBeNull();
  });

  it('Banff: Moraine Lake, Lake Louise, Bow Lake and Johnston Canyon are in; Kananaskis, Canmore and Kootenay places are not', async () => {
    const rows = await rowsOfCatalogue();
    const park = bySlug(rows, 'banff-national-park');
    expect(ownsArea(park)).toBe(true);
    const members = rows.filter((r) => isParkMember(r, park)).map((r) => r.slug);
    for (const s of ['moraine-lake', 'lake-louise', 'bow-lake', 'johnston-canyon', 'lake-minnewanka', 'peyto-lake-lookout']) expect(members, s).toContain(s);
    for (const s of ['kananaskis-river', 'barrier-lake', 'nakiska-summer-gondola-coaster', 'ribbon-creek', 'troll-falls', 'smith-dorrien-spray-trail', 'grassi-lakes', 'canmore-nordic-centre-summer', 'marble-canyon', 'paint-pots', 'banff-national-park', 'spray-valley-provincial-park']) expect(members, s).not.toContain(s);
  });

  it('no member of a park is placed in another protected area by its capture record (the graph\'s area_id), for every Canadian park', async () => {
    const rows = await rowsOfCatalogue();
    const graph = JSON.parse(readFileSync(new URL('../../../data/catalogue/graph/CA.json', import.meta.url), 'utf8')) as { nodes: Record<string, [string, string, string | null, string | null]> };
    const areaOf = (ref: string) => graph.nodes[ref]?.[2] ?? null;
    for (const slug of ['banff-national-park', 'jasper-national-park', 'kananaskis-country', 'kootenay-national-park']) {
      const park = bySlug(rows, slug);
      const own = areaOf((park as Found & { ref: string }).ref);
      const members = rows.filter((r) => isParkMember(r, park));
      expect(members.length, slug).toBeGreaterThan(5);
      for (const m of members) {
        const a = areaOf((m as Found & { ref: string }).ref);
        if (a && /national-park|kananaskis-country/.test(a)) expect(a, `${m.slug} in ${slug}`).toBe(own);
      }
    }
  });

  it('a park in an administrative area never takes the whole area (Val Gardena is in Bolzano; Bolzano is not in Val Gardena)', async () => {
    const rows = await rowsOfCatalogue();
    const park = bySlug(rows, 'val-gardena');
    expect(ownsArea(park)).toBe(false);
    const members = rows.filter((r) => isParkMember(r, park)).map((r) => r.slug);
    expect(members).toContain('ortisei');
    expect(members).not.toContain('bolzano');
    expect(members).not.toContain('otzi-south-tyrol-museum-of-archaeology');
  });
});

describe('the member read is one bounded read by the park\'s name (P8, P9)', () => {
  const real = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = real;
    vi.unstubAllEnvs();
  });
  const row = (slug: string, name: string, area: string, area_name: string, kind = 'lake') => ({ slug, name, kind, kindLabel: kind, lat: 51.2, lon: -115.6, km: null, gain_m: null, area, area_name, kid_fit: 'unknown', kids_from: null, flags: [], season: [] });
  it('asks the places list for the words, a page at a time, at most MEMBER_PAGES pages, and keeps the members only', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const calls: string[] = [];
    globalThis.fetch = (async (u: string) => {
      calls.push(String(u));
      const page = Number(new URL(String(u), 'http://x').searchParams.get('page') ?? 1);
      const items = page === 1 ? [row('moraine-lake', 'Moraine Lake', 'banff', 'Banff'), row('banff-avenue-cafe', 'Banff Avenue Cafe', 'banff', 'Banff', 'eatery'), row('barrier-lake', 'Barrier Lake', 'kananaskis-country', 'Kananaskis Country')] : [row(`p${page}`, `Banff thing ${page}`, 'canmore', 'Canmore')];
      return new Response(JSON.stringify({ items, total: 10, page, pageSize: PAGE_SIZE.list, nextPage: page + 1 }), { status: 200 });
    }) as typeof fetch;
    const { parkMembers, MEMBER_PAGES } = await import('@/components/trips/edit/add/source');
    const park: Found = { slug: 'banff-national-park', name: 'Banff National Park', kind: 'area', kindLabel: 'Area', lat: 51.17, lon: -115.55, km: null, gainM: null, area: 'Banff National Park', areaSlug: 'banff-national-park', kidFit: 'unknown', kidsFrom: null, flags: [], season: [] };
    const got = await parkMembers(park);
    expect(calls).toHaveLength(MEMBER_PAGES);
    for (const u of calls) {
      expect(u).toMatch(/^\/api\/v1\/places\/\?/);
      expect(decodeURIComponent(u)).toContain('q=banff');
      expect(u).toContain(`pageSize=${PAGE_SIZE.list}`);
      expect(u).not.toMatch(/near|bbox/);
    }
    // an eatery is not a stop; Kananaskis is not Banff; a "Banff ..." name in Canmore is a member by its name
    expect(got!.map((r) => r.slug)).toEqual(['moraine-lake', 'p2', 'p3']);
  });
  it('a failed read is null (the sheet says the places are not available), and no API answers off', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    const { parkMembers } = await import('@/components/trips/edit/add/source');
    expect(await parkMembers({ slug: 'p', name: 'Banff National Park', kind: 'area', kindLabel: 'Area', lat: 1, lon: 1, km: null, gainM: null, area: '', kidFit: 'unknown', kidsFrom: null, flags: [], season: [] })).toBeNull();
  });
});

describe('each row names the day it fits best (b)', () => {
  const fit = (state: Fit['state'], words = 'fits after X · ends 17:00'): Fit => ({ state, words: state === 'full' ? 'Day full' : words, ends: null, driveMin: 0 });
  it('the nearest day when it fits; the best other day when the nearest is full; Pick a day when every near day is full', () => {
    const a = scoreDays([{ n: 1, km: 2, fit: fit('fits') }, { n: 2, km: 3, fit: fit('fits') }])!;
    expect(scoredWords(a)).toEqual({ line: 'fits after X · ends 17:00', day: 1, button: 'Add to Day 1' });
    const b = scoreDays([{ n: 1, km: 2, fit: fit('full') }, { n: 2, km: 3, fit: fit('tight') }, { n: 3, km: 9, fit: fit('fits') }])!;
    expect(scoredWords(b)).toEqual({ line: 'Day 1 full: try Day 3', day: 3, button: 'Add to Day 3' });
    const c = scoreDays([{ n: 1, km: 2, fit: fit('full') }, { n: 2, km: 3, fit: fit('full') }])!;
    expect(scoredWords(c)).toEqual({ line: 'Day 1 is full, and so are the other days near it', day: null, button: 'Pick a day' });
    expect(scoreDays([])).toBeNull();
  });

  it('on the Rockies copy, no Banff member is offered a full day, and the first page is scored in well under 2 s', async () => {
    const data = (await import('@/lib/public')).createPublicData();
    const { buildTripPageModel } = await import('@/components/trips/model');
    const { listPlaces, getPlace } = await import('@/lib/public');
    const m = buildTripPageModel(data.getTrip('canadian-rockies-2029')!, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, listPlaces());
    const model = m.timeline as unknown as TimelineModel;
    const profile: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 10, pace: 'standard', adults: 2 };
    const doc = (copyToPlanDraft(copy({ slug: 'canadian-rockies-2029', title: 'Rockies', days: 15, cc: 'CA', start: '2029-09-08', overrides: {}, children: [10], profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false } })) as { success: true; data: PlanDraft }).data;
    const engine = await import('@travel/core/schedule/template.ts');
    const fitter = makeFitter({ engine, days: model.days, delta: deltaOfDraft(doc), overrides: {}, profile, candidates: model.addables, model });
    const rows = await rowsOfCatalogue();
    const park = bySlug(rows, 'banff-national-park');
    const members = rows.filter((r) => isParkMember(r, park) && !fitter.onTrip.has(r.slug)).slice(0, 12);
    expect(members.length).toBe(12);
    const t0 = performance.now();
    const days = new Set<number>();
    for (const f of members) {
      const near = nearDays(model, { lat: f.lat!, lon: f.lon! });
      expect(near.length).toBeLessThanOrEqual(FIT_DAYS);
      const s = scoreDays(near.map((d) => ({ ...d, fit: fitter.fit(candidateOf(f, null), d.n) })));
      if (!s) continue;
      const w = scoredWords(s);
      if (w.day !== null) {
        days.add(w.day);
        expect(fitter.fit(candidateOf(f, null), w.day).state, f.slug).not.toBe('full');
        expect(w.button).toBe(`Add to Day ${w.day}`);
      } else expect(w.button).toBe('Pick a day');
    }
    expect(performance.now() - t0).toBeLessThan(2000);
    // not every row says Day 1 (the review's "every row offers Add to Day 1")
    expect(days.size).toBeGreaterThan(1);
  });

  it('groups by the base of the nearest day, in trip order; near no day and already on the trip last', () => {
    const m = { days: [{ n: 1, base: 'Banff' }, { n: 2, base: 'Banff' }, { n: 3, base: 'Lake Louise village' }] } as unknown as TimelineModel;
    const g = groupByBase([{ day: 3, on: false, k: 'a' }, { day: null, on: false, k: 'b' }, { day: 2, on: false, k: 'c' }, { day: 1, on: true, k: 'd' }, { day: 1, on: false, k: 'e' }], m);
    expect(g.map((x) => [x.label, x.rows.map((r) => r.k)])).toEqual([['Near Banff', ['c', 'e']], ['Near Lake Louise village', ['a']], ['Not near any day of this trip', ['b']], ['Already on this trip', ['d']]]);
  });
});

describe('scoring is staged in idle time (a)', () => {
  const fakeHost = () => {
    const q: { id: number; cb: (d: { timeRemaining(): number }) => void }[] = [];
    let n = 0;
    const host: IdleHost = { request: (cb) => (q.push({ id: ++n, cb }), n), cancel: (h) => void q.splice(q.findIndex((x) => x.id === h), 1) };
    return { host, q, tick: (ms: number) => { let left = ms; q.shift()?.cb({ timeRemaining: () => (left -= 1) }); } };
  };
  it('runs at least one job per idle callback, more while the deadline has time, in order, and reports after each batch', () => {
    const { host, q, tick } = fakeHost();
    const batches: string[][] = [];
    runStaged(['a', 'b', 'c', 'd', 'e'], (j) => j.toUpperCase(), (done) => batches.push([...done.values()]), host);
    expect(q).toHaveLength(1);
    tick(0);
    expect(batches).toEqual([['A']]);
    tick(4);
    expect(batches.at(-1)).toEqual(['A', 'B', 'C', 'D']);
    tick(50);
    expect(batches.at(-1)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(q).toHaveLength(0);
  });
  it('the cancel stops it at once (a closed sheet, a new page of rows)', () => {
    const { host, q, tick } = fakeHost();
    const seen: number[] = [];
    const stop = runStaged([1, 2, 3], (j) => seen.push(j), () => undefined, host);
    tick(0);
    stop();
    expect(q).toHaveLength(0);
    expect(seen).toEqual([1]);
  });
  it('the arrival never computes a fit inline: it stages them, and a source check keeps the old restart loop out', () => {
    const src = readFileSync(new URL('../../components/trips/edit/add/Arrival.tsx', import.meta.url), 'utf8');
    const park = src.slice(src.indexOf('function Park('));
    expect(park).toContain('runStaged(');
    expect(park).not.toContain('useNearRows');
    expect(park).not.toMatch(/AREA_DEFAULT_R|kmBetween\(centre/);
    // the effect restarts only when the rows on show change (a string key), not on every render's new object
    expect(park).toMatch(/\}, \[fitter, shownKey\]\);/);
  });
});
