import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlaceListRow } from '@/components/places/rows';
import { placeDescriptor as d } from '@/lib/entities/descriptors/place';
import { activeFilters, clearAll, dropDependents, facetCounts, filterRows, gapNotes } from '@/lib/entities/filter';
import { BASE_FACET_OF_PROPERTY, MIN_COVERAGE, SLICE, coverageOf, facetsForScope, hiddenNote, paramOf, promotedFor, scopeOf, scopeState, scopedFacets, sliceContract, typeInScope } from '@/lib/entities/facets';
import type { ContractSlice } from '@/lib/entities/facets';
import { decodeState, encodeState } from '@/lib/entities/url';
import { travelRoot } from '@/lib/data/root';
import { placeRows } from '../places/support';

const root = travelRoot();
const readJson = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const contract = readJson('data/schema/capture/contract.json');
const types = readJson('data/vocab/types.json');
const real = placeRows();

const blank = (over: Partial<PlaceListRow> = {}): PlaceListRow => ({
  ...real[0]!, id: 'x', slug: 'x', name: 'X', kind: 'trail', type: 'nature.trail.hike', km: null, gain_m: null, season: [], kid_fit: 'unknown',
  effort: null, kids_from: null, kids_basis: null, time_band: null, price_band: null, booking: null, flags: [], trips: [], tags: [], ...over,
});
const labelsOf = (fs: { label: string }[]) => fs.map((f) => f.label);

describe('the slice of the contract the browser carries', () => {
  it('is what the generator writes (run `node web/scripts/facets-slice.mjs` after a contract or types change)', () => {
    const committed = JSON.parse(readFileSync(path.join(root, 'web/lib/entities/facets/contract-slice.json'), 'utf8'));
    expect(committed).toEqual(sliceContract(contract, types));
  });
  it('gives every facet its own URL name, and every band a reader', () => {
    expect(new Set(SLICE.facets.map((f) => f.key)).size).toBe(SLICE.facets.length);
    const known = new Set(['time_band', 'price_band', 'booking', 'effort', 'kids_from', 'length_band', 'climb_band', 'walk_band', 'season_band']);
    for (const f of SLICE.facets) if (f.band) expect(known.has(f.band), `${f.label} reads ${f.band}`).toBe(true);
  });
});

describe('scope: the Kind brings its facets (contract 7.1, 7.2)', () => {
  it('trails and treks: Effort, Length, Time, Climb, Shape, Stroller, Dogs', () => {
    expect(labelsOf(facetsForScope(['nature.trail'])).sort()).toEqual(['Climb', 'Dogs', 'Effort', 'Length', 'Shape', 'Stroller', 'Time'].sort());
    // the registry gives a trek no Stroller facet (a trek is not pushed)
    expect(labelsOf(facetsForScope(['nature.trek'])).sort()).toEqual(['Climb', 'Dogs', 'Effort', 'Length', 'Shape', 'Time'].sort());
  });
  it('a type below the category takes the category scope; a domain takes only what its own scope names', () => {
    expect(labelsOf(facetsForScope(['nature.trail.hike']))).toEqual(labelsOf(facetsForScope(['nature.trail'])));
    expect(labelsOf(facetsForScope(['water']))).toEqual(expect.arrayContaining(['Toilets', 'Walk from the car']));
    expect(labelsOf(facetsForScope(['water.body']))).toContain('Swimming');
    expect(labelsOf(facetsForScope(['water']))).not.toContain('Change rooms'); // that one is water.swim only
    expect(labelsOf(facetsForScope(['water.swim']))).toContain('Change rooms');
  });
  it('activities (an offer type) bring Duration, Price band, Booking needed, Guided and Weather dependent', () => {
    const l = labelsOf(facetsForScope(['water.motor']));
    expect(l).toEqual(expect.arrayContaining(['Duration', 'Price band', 'Booking needed', 'Guided or self-guided', 'Weather dependent', 'Effort']));
    expect(l).not.toContain('Length');
  });
  it('Effort, Stroller and Ages from are the list\'s own facets, not repeated', () => {
    expect(BASE_FACET_OF_PROPERTY).toMatchObject({ 'effort.source_grade': 'effort', stroller: 'stroller', age_band: 'kid' });
    const params = facetsForScope(['nature.trail']).map(paramOf);
    expect(params).toEqual(expect.arrayContaining(['effort', 'stroller']));
    expect(scopedFacets().map((f) => f.param)).not.toContain('f.effort');
    expect(scopedFacets().map((f) => f.param)).toContain('f.length');
  });
  it('a new type under an existing category joins its scope with no code change (contract 8, jet ski)', () => {
    const jet = { id: 'water.motor.jet_ski', parent: 'water.motor', level: 'type', label: 'Jet ski', aliases: ['pwc'], records: ['offer'] };
    const extended: ContractSlice = sliceContract(contract, { nodes: [...types.nodes, jet] });
    const before = labelsOf(facetsForScope(['water.motor'], extended));
    expect(labelsOf(facetsForScope(['water.motor.jet_ski'], extended))).toEqual(before);
    expect(before).toEqual(expect.arrayContaining(['Duration', 'Price band', 'Booking needed']));
    // and a row of that type is inside the Activities scope
    expect(typeInScope('water.motor.jet_ski', ['water.motor'], extended)).toBe(true);
    expect(typeInScope('water.motor.jet_ski', ['intent:do'], extended)).toBe(true);
    // the slice itself did not need the type: it is below a category
    expect(extended.categories).toEqual(SLICE.categories);
  });
  it('promotes two facets per scope from the data table; the most specific entry wins', () => {
    expect(promotedFor(['nature.trail'])).toEqual(['effort', 'f.length']);
    expect(promotedFor(['nature.trail.hike'])).toEqual(['effort', 'f.length']);
    expect(promotedFor(['water.swim'])).toEqual(['f.swimming', 'f.walk-from-the-car']);
    expect(promotedFor(['water.motor'])).toEqual(['kid', 'f.duration']);
    expect(promotedFor(['culture.museum'])).toEqual(['f.time-on-site', 'f.price-band']);
    expect(promotedFor(['snow.ski'])).toEqual(['effort', 'kid']);
    expect(promotedFor([])).toEqual([]);
  });
});

describe('coverage: the 60% rule (contract 7.1 rule 3)', () => {
  const duration = scopedFacets<PlaceListRow>().find((f) => f.label === 'Duration')!;
  const rowsAnswering = (answered: number, total = 100) =>
    Array.from({ length: total }, (_, i) => blank({ id: `r${i}`, time_band: i < answered ? (i % 2 ? '1-2h' : '<1h') : null }));
  it('a facet answered by 59% of the scope is hidden, at 60% it shows', () => {
    expect(MIN_COVERAGE).toBe(0.6);
    expect(coverageOf(duration, rowsAnswering(59)).shows).toBe(false);
    expect(coverageOf(duration, rowsAnswering(60)).shows).toBe(true);
  });
  it('and it needs at least two values to split the results', () => {
    const one = Array.from({ length: 10 }, (_, i) => blank({ id: `r${i}`, time_band: '<1h' }));
    expect(coverageOf(duration, one)).toMatchObject({ answered: 10, values: 1, shows: false });
  });
  it('the count line says why, in the contract\'s words', () => {
    expect(hiddenNote([coverageOf(duration, rowsAnswering(10))])).toBe('Duration hidden: not known for most results');
    expect(hiddenNote([])).toBeNull();
    const two = hiddenNote([coverageOf(duration, rowsAnswering(10)), coverageOf(scopedFacets<PlaceListRow>()[0]!, rowsAnswering(10))]);
    expect(two).toMatch(/^Duration and .+ hidden: not known for most results$/);
  });
  it('scopeState hides a scoped facet that too few rows answer, and shows one that enough do', () => {
    const rows = [...Array.from({ length: 10 }, (_, i) => blank({ id: `a${i}`, type: 'water.motor.jet_ski', kind: 'activity', time_band: i % 2 ? '1-2h' : '<1h' })), ...Array.from({ length: 10 }, (_, i) => blank({ id: `b${i}`, type: 'nature.trail.hike' }))];
    const st = scopeState(d, rows, decodeState('k=water.motor'));
    expect(st.shown.has('f.duration')).toBe(true);
    expect(st.hidden.map((h) => h.label)).toContain('Price band');
    expect(st.note).toMatch(/Price band.* hidden: not known for most results/);
    // other rows' answers do not count: the coverage is measured inside the scope
    expect(scopeState(d, rows, decodeState('k=nature.trail')).shown.has('f.duration')).toBe(false);
  });
});

describe('a gap never passes a positive filter', () => {
  it('on every facet of the Places list', () => {
    const gapRow = blank();
    const offered = new Map<string, Set<string>>();
    for (const f of d.facets) for (const r of real) for (const o of f.options(r)) offered.set(f.param, (offered.get(f.param) ?? new Set()).add(o.value));
    for (const f of d.facets) {
      if (f.hidden || f.legacy || ['country', 'k', 'season', 'region', 'area', 'trip', 'tag'].includes(f.param)) continue;
      for (const v of offered.get(f.param) ?? []) {
        if (v === 'unknown' || v === 'other') continue; // the gap options themselves
        expect(filterRows([gapRow], decodeState(`${f.param}=${v}`), d), `${f.param}=${v}`).toHaveLength(0);
      }
    }
  });
  it('Kids by age: a rule above the age hides, advice above it stays (faded), a gap is hidden and counted', () => {
    const rule = blank({ id: 'rule', kids_from: 8, kids_basis: 'rule' });
    const advice = blank({ id: 'advice', kids_from: 8, kids_basis: 'advice' });
    const fits = blank({ id: 'fits', kids_from: 4, kids_basis: 'rule' });
    const gap = blank({ id: 'gap' });
    const rows = [rule, advice, fits, gap];
    const st = decodeState('kid=6');
    expect(filterRows(rows, st, d).map((r) => r.id)).toEqual(['advice', 'fits']);
    expect(filterRows(rows, decodeState('kid=8'), d).map((r) => r.id)).toEqual(['rule', 'advice', 'fits']);
    expect(filterRows(rows, decodeState('kid=3'), d).map((r) => r.id)).toEqual(['advice']);
    expect(gapNotes(rows, st, d)).toEqual(expect.arrayContaining(['1 not checked yet', 'for a 6-year-old · 1 is a stretch, shown faded']));
    // the older kid-fit values keep working
    expect(filterRows([blank({ kid_fit: 'yes' }), blank({ kid_fit: 'no' })], decodeState('kid=yes'), d)).toHaveLength(1);
  });
  it('Effort: a place with no effort is left out, and the count line names how many', () => {
    const rows = [blank({ id: 'a', effort: 'Easy' }), blank({ id: 'b', effort: 'Hard' }), blank({ id: 'c', kind: 'lift', type: 'ride.lift.gondola' })];
    expect(filterRows(rows, decodeState('effort=easy,hard'), d).map((r) => r.id)).toEqual(['a', 'b']);
    expect(gapNotes(rows, decodeState('effort=easy'), d)).toContain('1 have no effort rating and are not shown');
  });
  it('Stroller: any passes yes, all-terrain passes yes and partly', () => {
    const rows = [blank({ id: 'y', flags: ['stroller'] }), blank({ id: 'p', flags: ['stroller_part'] }), blank({ id: 'n', flags: ['!stroller'] }), blank({ id: 'g' })];
    expect(filterRows(rows, decodeState('stroller=any'), d).map((r) => r.id)).toEqual(['y']);
    expect(filterRows(rows, decodeState('stroller=all-terrain'), d).map((r) => r.id)).toEqual(['y', 'p']);
    expect(gapNotes(rows, decodeState('stroller=any'), d)).toContain('1 not checked yet');
  });
  it('a scoped yes/no facet: yes passes the places that answered yes, never a gap', () => {
    const rows = [blank({ id: 'y', flags: ['dogs'] }), blank({ id: 'n', flags: ['!dogs'] }), blank({ id: 'g' })];
    expect(filterRows(rows, decodeState('f.dogs=yes'), d).map((r) => r.id)).toEqual(['y']);
    expect(filterRows(rows, decodeState('f.dogs=no'), d).map((r) => r.id)).toEqual(['n']);
  });
});

describe('the Kind pill and the scoped facets in the counts', () => {
  it('lists domains first, then categories, each with a count', () => {
    const rows = [blank({ id: 'a' }), blank({ id: 'b', type: 'water.body.lake', kind: 'lake' }), blank({ id: 'c', type: 'nature.viewpoint.viewpoint', kind: 'viewpoint' })];
    const k = facetCounts(rows, decodeState(''), d).k!;
    const shape = k.map((o) => [o.group, o.value, o.count]);
    expect(shape.slice(0, 2)).toEqual([['Domains', 'nature', 2], ['Domains', 'water', 1]]);
    expect(shape.slice(2).sort()).toEqual([['Categories', 'nature.trail', 1], ['Categories', 'nature.viewpoint', 1], ['Categories', 'water.body', 1]]);
    expect(k[0]!.label).toBe('Nature');
  });
  it('an old kind=trail link still filters and brings the trail scope; a scoped facet shows only inside its scope', () => {
    const rows = [blank({ id: 'a', time_band: '<1h' }), blank({ id: 'b', time_band: '1-2h' }), blank({ id: 'c', type: 'water.body.lake', kind: 'lake' })];
    expect(filterRows(rows, decodeState('kind=trail'), d).map((r) => r.id)).toEqual(['a', 'b']);
    expect(facetCounts(rows, decodeState(''), d)['f.time']).toBeUndefined();
    expect(facetCounts(rows, decodeState('k=nature.trail'), d)['f.time']?.map((o) => [o.value, o.count])).toEqual([['<1h', 1], ['1-2h', 1]]);
    expect(facetCounts(rows, decodeState('kind=trail'), d)['f.time']).toBeDefined();
    expect(scopeOf(d, rows, decodeState('kind=trail')).tokens).toEqual(['nature.trail']);
  });
  it('clearing the Kind removes the scope\'s facets and keeps the base ones', () => {
    const facets = decodeState('k=nature.trail&kid=6&effort=easy&f.length=3-6&f.dogs=yes').facets;
    delete facets.k;
    dropDependents(facets, d, 'k');
    expect(facets).toEqual({ kid: ['6'], effort: ['easy'] });
  });
  it('every active facet is a chip, and Clear all drops them', () => {
    const st = decodeState('k=nature.trail&f.length=3-6&effort=easy');
    const rows = [blank({ km: 4, effort: 'Easy' })];
    expect(activeFilters(st, d, (p, v) => v).map((c) => c.key)).toEqual(['k:nature.trail', 'effort:easy', 'f.length:3-6']);
    expect(filterRows(rows, st, d)).toHaveLength(1);
    expect(clearAll(st).facets).toEqual({});
  });
});

describe('URL state (P9): k and f.<facet>', () => {
  const q = 'q=lake&country=IT&k=nature.trail&kid=6&effort=easy,moderate&stroller=any&f.climb=150-400&f.length=3-6,6-10&f.time=1-2h&view=table&group=country&sort=name&dir=asc&page=2';
  it('round-trips with the list-state key order', () => {
    expect(encodeState(decodeState(q))).toBe(q);
  });
  it('reads f.<facet> in any order and writes them sorted after the base facets', () => {
    const s = decodeState('f.time=1-2h&view=list&f.length=3-6&k=nature.trail');
    expect(s.facets).toEqual({ k: ['nature.trail'], 'f.time': ['1-2h'], 'f.length': ['3-6'] });
    expect(encodeState(s)).toBe('k=nature.trail&f.length=3-6&f.time=1-2h&view=list');
  });
  it('the advanced filter param f is not a scoped facet', () => {
    const s = decodeState('f=a:b&f.dogs=yes');
    expect(s.f).toBe('a:b');
    expect(s.facets).toEqual({ 'f.dogs': ['yes'] });
  });
});
