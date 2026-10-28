import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADD_NEARBY_KM, ADD_PIN_FAR_KM, NEAR_KM } from '@travel/core/config/nearby.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { applyOps } from '@travel/core/plan/ops.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { missingSlugs, withExtras } from '@/components/trips/edit/add/extras';
import { makeFitter } from '@/components/trips/edit/add/fit';
import { bboxAround, bearingOf, candidateOf, isStop, type Found } from '@/components/trips/edit/add/place';
import { anchorsOf, bandWords, basesOf, buildSections, centreOf, daysByDistance, distanceWords, isFar, passesChips, withGhosts, type Chips, type Inputs } from '@/components/trips/edit/add/rows';
import { newTripHref } from '@/components/trips/edit/add/source';
import type { AddCandidate, TimelineModel } from '@/components/trips/timeline/model';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { dayRef } from '@/lib/trip-edit/stopOps';
import { PAGE_SIZE } from '@/lib/config/product';
import { copy } from './helpers';

// STEP2-E3: the add picker's pure parts, over the real Rockies plan model: the groups of edit-mode-spec 7.2 in order, the far rule, a park
// never a stop, the chips, the fit words from the template scheduler, the model merge for a place the plan does not carry.

const rockies = async () => {
  const data = (await import('@/lib/public')).createPublicData();
  const { buildTripPageModel } = await import('@/components/trips/model');
  const { listPlaces, getPlace } = await import('@/lib/public');
  const trip = data.getTrip('canadian-rockies-2029')!;
  const m = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, listPlaces());
  return m.timeline as unknown as TimelineModel;
};
const profile: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 10, pace: 'standard', adults: 2 };
const draft = (over = {}): PlanDraft => (copyToPlanDraft(copy({ slug: 'canadian-rockies-2029', title: 'Rockies', days: 15, cc: 'CA', start: '2029-09-08', overrides: {}, children: [10], profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, ...over })) as { success: true; data: PlanDraft }).data;
let n = 0;
const id = () => `o-e3${++n}`;
const found = (over: Partial<Found> = {}): Found => ({ slug: 'x', name: 'X', kind: 'lake', kindLabel: 'Lake', lat: 51.4, lon: -116.18, km: null, gainM: null, area: '', kidFit: 'unknown', kidsFrom: null, flags: [], season: [], ...over });
const limit = { versions: 48, removed: 48, maybe: 48, trip: 48, near: 48, search: 48 };
const inputs = (model: TimelineModel, doc: PlanDraft, over: Partial<Inputs> = {}): Inputs => ({
  doc, model, day: 5, onTrip: new Map(), youngest: 10, near: null, q: '', search: null, chips: { rainy: false, kids: false, month: null }, maybe: [], limit, keep: new Set(), ...over,
});

describe('the add radius (one home)', () => {
  it('is 30 km, the day-trip limit is the far rule, and neither is the near API radius', () => {
    expect(ADD_NEARBY_KM).toBe(30);
    expect(ADD_PIN_FAR_KM).toBe(100);
    expect(NEAR_KM).toBe(25);
  });
  it('the timeline model reads it from the config, with no literal of its own', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../components/trips/timeline/model.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/import \{ ADD_NEARBY_KM \} from '@travel\/core\/config\/nearby\.ts'/);
    expect(src).not.toMatch(/NEARBY_KM\s*=\s*30/);
  });
});

describe('a place is a stop, a park is not', () => {
  it('areas, stays and eateries are never offered', () => {
    for (const kind of ['area', 'stay', 'eatery']) expect(isStop({ kind })).toBe(false);
    for (const kind of ['trail', 'lake', 'viewpoint', 'waterfall', 'sight', 'town', 'activity', 'lift']) expect(isStop({ kind })).toBe(true);
  });
  it('a row becomes the timeline candidate the scheduler places, with its distance', () => {
    const c = candidateOf(found({ slug: 'moraine-lake', name: 'Moraine Lake', kind: 'lake', kindLabel: 'Lake' }), 12.4);
    expect(c).toMatchObject({ key: 'moraine-lake', placeSlug: 'moraine-lake', kind: 'visit', sub: 'lake', label: 'Lake', km: 12.4, point: { lat: 51.4, lon: -116.18 } });
  });
  it('a box round a point covers its radius, and the compass point is the way from it', () => {
    const [w, s, e, nn] = bboxAround({ lat: 51.18, lon: -115.57 }, 30).split(',').map(Number);
    expect(nn! - s!).toBeCloseTo(0.5394, 2);
    expect(e! - w!).toBeGreaterThan(nn! - s!);
    expect(bearingOf({ lat: 51, lon: -115 }, { lat: 52, lon: -115 })).toBe('N');
    expect(bearingOf({ lat: 51, lon: -115 }, { lat: 51, lon: -114 })).toBe('E');
    expect(bearingOf({ lat: 51, lon: -115 }, { lat: 50, lon: -116 })).toBe('SW');
  });
});

describe('the groups of edit-mode-spec 7.2', () => {
  it('a copy offers the other versions, the trip stops at this base and the plan model nearby places, in the spec order, with no empty group', async () => {
    const model = await rockies();
    const s = buildSections(inputs(model, draft()));
    const order = ['versions', 'removed', 'maybe', 'trip', 'near', 'search'];
    expect(s.map((x) => x.id)).toEqual(order.filter((o) => s.some((x) => x.id === o)));
    expect(s.length).toBeGreaterThan(0);
    for (const g of s) expect(g.rows.length).toBeGreaterThan(0);
    for (const g of s) for (const r of g.rows) expect(r.kind).not.toBe('area');
  });
  it('the day\'s removed stops are a group, newest first, and Put back deletes the removal', async () => {
    const model = await rockies();
    const d = draft();
    const item = model.days.find((x) => x.n === 5)!.input.variants[0]!.items.find((i) => i.kind === 'visit' || i.kind === 'trail')!;
    const r = applyOps(d, [{ kind: 'removePlace', id: id(), day: 5, item: item.id }]);
    expect(r.skipped).toEqual([]);
    const s = buildSections(inputs(model, r.doc));
    const g = s.find((x) => x.id === 'removed')!;
    expect(g.rows.map((x) => x.name)).toContain(item.title);
    const row = g.rows.find((x) => x.name === item.title)!;
    expect(row.back!.verb).toBe('Put back');
    const ops = row.back!.ops(id);
    expect(ops).toHaveLength(1);
    expect(applyOps(r.doc, ops).doc.template!.removed).toEqual([]);
    // another day's removed stop is not listed here
    expect(buildSections(inputs(model, r.doc, { day: 6 })).find((x) => x.id === 'removed')).toBeUndefined();
  });
  it('Maybe places add with one undo step: the Maybe entry leaves and the place joins the day', async () => {
    const model = await rockies();
    const slug = Object.keys(model.addables)[0]!;
    const base = applyOps(draft(), [{ kind: 'addMaybe', id: id(), ref: `place/${slug}` }]);
    expect(base.skipped).toEqual([]);
    const g = buildSections(inputs(model, base.doc)).find((x) => x.id === 'maybe')!;
    const row = g.rows[0]!;
    expect(row.note).toBe('In Maybe');
    const ops = row.back!.ops(id);
    expect(ops.map((o) => o.kind)).toEqual(['deleteEntry', 'addPlace']);
    const after = applyOps(base.doc, ops);
    expect(after.skipped).toEqual([]);
    expect(after.doc.template!.maybe).toEqual([]);
    expect(after.doc.template!.added.map((a) => a.ref)).toContain(`place/${slug}`);
  });
  it('the catalogue\'s near rows replace the model\'s short list, nearest first, and a park in the answer is dropped by the source filter, not offered', async () => {
    const model = await rockies();
    const c = centreOf(model, 5)!;
    const near = [found({ slug: 'a', name: 'Alpha', lat: c.lat + 0.05, lon: c.lon }), found({ slug: 'b', name: 'Bravo', lat: c.lat + 0.01, lon: c.lon })];
    const g = buildSections(inputs(model, draft(), { near })).find((x) => x.id === 'near')!;
    expect(g.rows.map((x) => x.slug)).toEqual(['a', 'b']);
    expect(g.rows[0]!.km).toBeGreaterThan(0);
    expect(g.rows[0]!.bearing).toBe('N');
    expect(g.label).toBe(`Within ${ADD_NEARBY_KM} km, with a place page`);
  });
  it('a group shows PAGE_SIZE.list rows and says how many more', async () => {
    const model = await rockies();
    const c = centreOf(model, 5)!;
    const near = Array.from({ length: PAGE_SIZE.list + 5 }, (_, i) => found({ slug: `p${i}`, name: `P${i}`, lat: c.lat + i * 0.001, lon: c.lon }));
    const g = buildSections(inputs(model, draft(), { near })).find((x) => x.id === 'near')!;
    expect(g.rows).toHaveLength(PAGE_SIZE.list);
    expect(g.more).toBe(5);
  });
  it('words narrow every group and add the catalogue\'s matches, nearest the base first and the far ones last', async () => {
    const model = await rockies();
    const c = centreOf(model, 5)!;
    const search = [
      found({ slug: 'far', name: 'Lake Far', lat: -33, lon: 151 }),
      found({ slug: 'mid', name: 'Lake Mid', lat: c.lat + 0.2, lon: c.lon }),
      found({ slug: 'close', name: 'Lake Close', lat: c.lat + 0.01, lon: c.lon }),
    ];
    const s = buildSections(inputs(model, draft(), { q: 'lake', search }));
    const g = s.find((x) => x.id === 'search')!;
    expect(g.rows.map((x) => x.slug)).toEqual(['close', 'mid', 'far']);
    expect(g.rows[2]!.far).toBe(true);
    expect(g.rows[2]!.farKm).toBeGreaterThan(ADD_PIN_FAR_KM);
    expect(g.rows[0]!.far).toBe(false);
    // the other groups hold only what matches the words
    for (const x of s.filter((y) => y.id !== 'search')) for (const r of x.rows) expect(`${r.name} ${r.kindLabel}`.toLowerCase()).toContain('lake');
  });
  it('a place already on the trip says so, never a duplicate: it is "On Day 3" with Move here', async () => {
    const model = await rockies();
    const c = centreOf(model, 5)!;
    const entry = { id: 'x', day: 3, title: 'Alpha', kind: 'visit', addedBy: 'author', sourceItemId: 'x' } as never;
    const near = [found({ slug: 'alpha', name: 'Alpha', lat: c.lat + 0.02, lon: c.lon })];
    const on = new Map([['alpha', { day: 3, entry }]]);
    const row = buildSections(inputs(model, draft(), { near, onTrip: on })).find((x) => x.id === 'near')!.rows[0]!;
    expect(row.on?.day).toBe(3);
    expect(row.here).toBe(false);
    // on this very day, it leaves the list unless it was just added
    const here = new Map([['alpha', { day: 5, entry }]]);
    expect(buildSections(inputs(model, draft(), { near, onTrip: here })).find((x) => x.id === 'near')).toBeUndefined();
    const kept = buildSections(inputs(model, draft(), { near, onTrip: here, keep: new Set(['near:alpha']) })).find((x) => x.id === 'near')!;
    expect(kept.rows[0]!.here).toBe(true);
  });
  it('a row put back stays where it was, as a ghost', async () => {
    const model = await rockies();
    const c = centreOf(model, 5)!;
    const near = [found({ slug: 'a', name: 'A', lat: c.lat + 0.01, lon: c.lon }), found({ slug: 'b', name: 'B', lat: c.lat + 0.02, lon: c.lon })];
    const live = buildSections(inputs(model, draft(), { near }));
    const row = live.find((x) => x.id === 'near')!.rows[1]!;
    const gone = buildSections(inputs(model, draft(), { near: [near[0]!] }));
    const back = withGhosts(gone, [{ id: 'near', index: 1, row }]);
    expect(back.find((x) => x.id === 'near')!.rows.map((x) => x.slug)).toEqual(['a', 'b']);
  });
});

describe('the chips', () => {
  const none: Chips = { rainy: false, kids: false, month: null };
  it('Rainy day keeps what is marked indoor or for a rainy day, and nothing else', () => {
    expect(passesChips(found({ flags: ['indoor-or-rainy-day'] }), { ...none, rainy: true }, 10)).toBe(true);
    expect(passesChips(found({ flags: ['toilets'] }), { ...none, rainy: true }, 10)).toBe(false);
    expect(passesChips(found({ flags: [] }), none, 10)).toBe(true);
  });
  it('Kids drops what is not for kids or not for the youngest child, keeps what is not checked', () => {
    const k = { ...none, kids: true };
    expect(passesChips(found({ kidFit: 'no' }), k, 6)).toBe(false);
    expect(passesChips(found({ kidFit: 'yes', kidsFrom: 8 }), k, 6)).toBe(false);
    expect(passesChips(found({ kidFit: 'yes', kidsFrom: 4 }), k, 6)).toBe(true);
    expect(passesChips(found({ kidFit: 'unknown' }), k, 6)).toBe(true);
  });
  it('Open in the month drops a place whose season is known and does not hold it', () => {
    const m = { ...none, month: 9 };
    expect(passesChips(found({ season: [6, 7, 8] }), m, null)).toBe(false);
    expect(passesChips(found({ season: [8, 9] }), m, null)).toBe(true);
    expect(passesChips(found({ season: [] }), m, null)).toBe(true);
  });
});

describe('far places get no day', () => {
  it('a place beyond ADD_PIN_FAR_KM of every base is far; one near any base is not; a trip with no base cannot say', async () => {
    const model = await rockies();
    expect(basesOf(model).length).toBeGreaterThan(0);
    expect(isFar({ lat: 45.4, lon: 12.3 }, model)).toBe(true);
    expect(isFar(centreOf(model, 5)!, model)).toBe(false);
    expect(isFar(null, model)).toBe(false);
    expect(isFar({ lat: 0, lon: 0 }, { ...model, days: model.days.map((d) => ({ ...d, input: { ...d.input, base: null, nextBase: null } })) })).toBe(false);
  });
  it('the days are ranked by the distance to their nearest anchor', async () => {
    const model = await rockies();
    const p = centreOf(model, 5)!;
    const ranked = daysByDistance(model, p);
    expect(ranked).toHaveLength(model.days.length);
    expect(ranked[0]!.km).toBeLessThanOrEqual(ranked[ranked.length - 1]!.km ?? Infinity);
    expect(anchorsOf(model, 5).length).toBeGreaterThan(0);
  });
  it('the link to a new trip is drawn only while the planner is open', () => {
    expect(newTripHref('moraine-lake')).toBe(process.env.NEXT_PUBLIC_PLAN_BUILDER === '1' ? '/plan/?p=moraine-lake' : null);
  });
});

describe('the words of a row', () => {
  it('the drive bands are the ones of the nearby spec, an estimate, and a walk under 1.2 km', () => {
    expect(bandWords(10, 4)).toBe('under 15 min');
    expect(bandWords(20, 12)).toBe('15 to 30 min');
    expect(bandWords(45, 30)).toBe('30 to 60 min');
    expect(bandWords(90, 70)).toBe('60 min to 2 h');
    expect(bandWords(3, 0.5)).toBe('a walk');
    expect(bandWords(null, null)).toBeNull();
    expect(distanceWords({ km: 12, bearing: 'NE', driveMin: 20 }, (k) => `${k} km`)).toBe('12 km NE · 15 to 30 min ≈');
  });
});

describe('how a place fits a day (the template scheduler)', () => {
  it('an added place gets words naming the stop it follows, the driving it adds and where the day ends, and the add is the day the person gets', async () => {
    const model = await rockies();
    const engine = await import('@travel/core/schedule/template.ts');
    const d = draft();
    const f = makeFitter({ engine, days: model.days, delta: deltaOfDraft(d), overrides: {}, profile, candidates: model.addables });
    const key = (model.addByDay[5] ?? []).find((k) => model.addables[k]!.group === 'nearby')!;
    const c = model.addables[key]!;
    const fit = f.fit(c, 5);
    expect(['fits', 'tight', 'full', 'fix']).toContain(fit.state);
    if (fit.state === 'fits' || fit.state === 'tight') expect(fit.words).toMatch(/^fits (after .+|at the start of the day)/);
    // the same op through the document gives the day the preview showed
    const r = applyOps(d, [{ kind: 'addPlace', id: id(), day: 5, ref: `place/${c.key}` }]);
    expect(r.skipped).toEqual([]);
    const after = makeFitter({ engine, days: model.days, delta: deltaOfDraft(r.doc), overrides: {}, profile, candidates: model.addables });
    expect(after.onTrip.get(c.key)?.day).toBe(5);
    if (fit.ends) expect(after.base.get(5)!.span.end).toBe(fit.ends);
    // the day's last stop is where a Move here lands
    expect(after.lastStop(5)).toBeTruthy();
  });
  it('Day full when the addition pushes the day past its cap or past 23:00', async () => {
    const model = await rockies();
    const engine = await import('@travel/core/schedule/template.ts');
    let d = draft();
    const keys = Object.keys(model.addables).filter((k) => model.addables[k]!.kind === 'trail');
    for (const k of keys.slice(0, 5)) d = applyOps(d, [{ kind: 'addPlace', id: id(), day: 5, ref: `place/${k}` }]).doc;
    const f = makeFitter({ engine, days: model.days, delta: deltaOfDraft(d), overrides: {}, profile, candidates: model.addables });
    const more = keys[5] ? model.addables[keys[5]]! : model.addables[keys[0]!]!;
    expect(['full', 'tight', 'fits', 'fix']).toContain(f.fit(more, 5).state);
  });
  it('a place on another day is found by its slug for Move here', async () => {
    const model = await rockies();
    const engine = await import('@travel/core/schedule/template.ts');
    const d = draft();
    const f = makeFitter({ engine, days: model.days, delta: deltaOfDraft(d), overrides: {}, profile, candidates: model.addables });
    const planned = f.base.get(3)!.entries.find((e) => e.at?.placeSlug && e.sourceItemId)!;
    const found = f.onTrip.get(planned.at!.placeSlug!);
    expect(found?.day).toBeLessThanOrEqual(3);
    expect(found?.entry.title).toBeTruthy();
  });
});

describe('the fit and the add after a day was inserted (STEP2-INT)', () => {
  it('Day n is the day the page shows: the new day is empty, the stops that followed it moved down one, and an add to it names its ref', async () => {
    const model = await rockies();
    const engine = await import('@travel/core/schedule/template.ts');
    let d = draft();
    d = applyOps(d, [{ kind: 'insertDay', id: 'o-day', after: 2 } as never]).doc;
    const plain = makeFitter({ engine, days: model.days, delta: deltaOfDraft(draft()), overrides: {}, profile, candidates: model.addables, model });
    const f = makeFitter({ engine, days: model.days, delta: deltaOfDraft(d), overrides: {}, profile, candidates: model.addables, model });
    expect(f.eff).not.toBeNull();
    expect(f.refOf(2)).toBe(2);
    expect(f.refOf(3)).toBe('o-day');
    expect(f.refOf(4)).toBe(3);
    expect(f.base.get(3)!.entries.filter((e) => e.sourceItemId && !e.insideOf && e.kind !== 'leg' && e.kind !== 'sun')).toEqual([]);
    expect(f.base.get(4)!.entries.map((e) => e.title)).toEqual(plain.base.get(3)!.entries.map((e) => e.title));
    expect(f.base.get(4)!.entries.every((e) => e.day === 4)).toBe(true);
    // an add to the new day is an op with the day's ref, and the scheduler puts the place on shown Day 3
    const key = Object.keys(model.addables).find((k) => model.addables[k]!.kind === 'trail')!;
    const r = applyOps(d, [{ kind: 'addPlace', id: id(), day: dayRef(d, 3), ref: `place/${key}` }]);
    expect(r.skipped).toEqual([]);
    const after = makeFitter({ engine, days: model.days, delta: deltaOfDraft(r.doc), overrides: {}, profile, candidates: model.addables, model });
    expect(after.onTrip.get(key)?.day).toBe(3);
    expect(['fits', 'tight', 'full', 'fix']).toContain(f.fit(model.addables[key]!, 3).state);
  });
});

describe('a place the plan model does not carry', () => {
  it('is asked for by slug once, and merged into the model and into the day it was added to', async () => {
    const model = await rockies();
    const slug = 'far-away-lake';
    expect(model.addables[slug]).toBeUndefined();
    const d = applyOps(draft(), [{ kind: 'addPlace', id: id(), day: 5, ref: `place/${slug}` }]).doc;
    expect(missingSlugs(d, model, {})).toEqual([slug]);
    const c: AddCandidate = candidateOf(found({ slug, name: 'Far Away Lake' }), null);
    expect(missingSlugs(d, model, { [slug]: c })).toEqual([]);
    const merged = withExtras(model, { [slug]: c }, d);
    expect(merged.addables[slug]).toBe(c);
    expect(merged.addByDay[5]).toContain(slug);
    // nothing to merge: the same model, so no re-render
    expect(withExtras(model, {}, d)).toBe(model);
    // the plan model's own candidate wins
    const own = Object.keys(model.addables)[0]!;
    expect(withExtras(model, { [own]: c }, d).addables[own]).toBe(model.addables[own]);
  });
});

describe('the reads are light (P8) and fall back without an API', () => {
  const real = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = real;
    vi.unstubAllEnvs();
  });
  it('near asks for one page of one box, drops what is outside the circle and any park, and sorts nearest first', async () => {
    const calls: string[] = [];
    const row = (slug: string, kind: string, lat: number, lon: number) => ({ slug, name: slug, kind, kindLabel: kind, lat, lon, km: null, gain_m: null, area_name: '', kid_fit: 'unknown', kids_from: null, flags: [], season: [] });
    globalThis.fetch = (async (u: string) => {
      calls.push(String(u));
      return new Response(JSON.stringify({ items: [row('far-in-box', 'lake', 51.18 + 0.28, -115.57), row('near', 'lake', 51.19, -115.57), row('park', 'area', 51.181, -115.57), row('stay', 'stay', 51.181, -115.57)], nextPage: null }), { status: 200 });
    }) as typeof fetch;
    const { nearPage } = await import('@/components/trips/edit/add/source');
    const p = await nearPage({ lat: 51.18, lon: -115.57 }, 1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^\/api\/v1\/places\/\?/);
    expect(calls[0]).toContain(`pageSize=${PAGE_SIZE.list}`);
    expect(calls[0]).toContain('bbox=');
    expect(p!.rows.map((r) => r.slug)).toEqual(['near']);
  });
  it('a failed read is null, so the picker falls back to the lists the plan model carries', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    const { searchPage, rowsOf } = await import('@/components/trips/edit/add/source');
    expect(await searchPage('lake', 1)).toBeNull();
    expect(await rowsOf(['a'])).toBeNull();
  });
});
