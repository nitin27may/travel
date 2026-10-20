import { beforeAll, describe, expect, it } from 'vitest';
import type { PlaceListRow } from '@/components/places/rows';
import { listPlacesChecked, registerList } from '@/lib/client/data';
import { placeDescriptor as d } from '@/lib/entities/descriptors/place';
import { matchesRow } from '@/lib/entities/filter';
import { isGapRow, uncheckedRows } from '@/lib/entities/gaps';
import { typeInScope } from '@/lib/entities/facets';
import type { ListState } from '@/lib/entities/types';
import { decodeState } from '@/lib/entities/url';
import { parse } from '@/lib/search/parse/parse';
import { placeRows } from '../places/support';
import { fixtures, loadVocab, searchRecords } from './support';

// Honesty rule H1: a gap is never a yes. A row with no answer for a parsed constraint is not in the main results; it is listed apart,
// per constraint, as "not checked yet". Acceptance 5 of smart-search.md.

const real = placeRows();
const blank = (over: Partial<PlaceListRow>): PlaceListRow => ({
  ...real[0]!, id: 'x', slug: 'x', name: 'X', kind: 'waterfall', type: 'water.falls.waterfall', km: null, gain_m: null, season: [], kid_fit: 'unknown',
  effort: null, kids_from: null, kids_basis: null, time_band: null, price_band: null, booking: null, flags: [], walk_band: null, shape: null, best_time: null, trips: [], tags: [], ...over,
});
const state = (href: string): ListState => decodeState(href.split('?')[1] ?? '');
const parsed = (q: string) => parse(q, loadVocab(), searchRecords());

describe('H1 on rows built for the purpose', () => {
  const rows = [
    blank({ id: 'yes', name: 'yes', flags: ['stroller'] }),
    blank({ id: 'part', name: 'part', flags: ['stroller_part'] }),
    blank({ id: 'no', name: 'no', flags: ['!stroller'] }),
    blank({ id: 'gap1', name: 'gap1' }),
    blank({ id: 'gap2', name: 'gap2', flags: ['toilets'] }),
    blank({ id: 'other', name: 'other', kind: 'trail', type: 'nature.trail.hike' }),
  ];

  beforeAll(() => {
    registerList(d, rows);
  });

  it('waterfalls with a stroller: the answer holds the yes, the two gaps are apart, the known no is neither', async () => {
    const p = parsed('waterfall I can reach with a stroller');
    const got = await listPlacesChecked(state(p.href));
    expect(got.rows.map((r) => r.id)).toEqual(['yes']);
    expect(got.unchecked).toHaveLength(1);
    expect(got.unchecked[0]!.param).toBe('stroller');
    expect(got.unchecked[0]!.note).toBe('not checked yet');
    expect(got.unchecked[0]!.rows.map((r) => r.id).sort()).toEqual(['gap1', 'gap2']);
    expect(got.unchecked[0]!.rows.map((r) => r.id)).not.toContain('no');
    expect(got.unchecked[0]!.rows.map((r) => r.id)).not.toContain('other');
  });

  it('a scoped facet is a gap when the row has no answer: toilets on lakes', async () => {
    const lakes = [blank({ id: 'a', type: 'water.body.lake', flags: ['toilets'] }), blank({ id: 'b', type: 'water.body.lake', flags: ['!toilets'] }), blank({ id: 'c', type: 'water.body.lake' })];
    registerList(d, lakes);
    const got = await listPlacesChecked(state(parsed('lake with toilets').href));
    expect(got.rows.map((r) => r.id)).toEqual(['a']);
    expect(got.unchecked.map((g) => [g.param, g.rows.map((r) => r.id)])).toEqual([['f.toilets', ['c']]]);
    registerList(d, rows);
  });

  it('a row that is a gap on two constraints is listed once, under the first', async () => {
    const s = state(parsed('waterfall with a stroller with toilets').href);
    const got = uncheckedRows(rows, s, d);
    const ids = got.flatMap((g) => g.rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a gap on a constraint the visitor chose by hand is not moved when the parse did not write it', async () => {
    const s = state('/places/?k=water.falls&stroller=any');
    registerList(d, rows);
    expect((await listPlacesChecked(s, ['kid'])).unchecked).toEqual([]);
    expect((await listPlacesChecked(s, ['stroller'])).unchecked).toHaveLength(1);
  });

  it('an explicit "not checked yet" selection is not a gap (the visitor asked for them)', async () => {
    const f = d.facets.find((x) => x.param === 'stroller')!;
    expect(isGapRow(rows[3]!, f, ['any'])).toBe(true);
    expect(isGapRow(rows[3]!, f, ['none'])).toBe(false);
    expect(isGapRow(rows[2]!, f, ['any'])).toBe(false);
  });
});

describe('H1 over the real places and the fixture queries (property)', () => {
  beforeAll(() => {
    registerList(d, real);
  });

  const places = fixtures.filter((f) => f.target === 'places');

  for (const f of places) {
    it(`${f.id}. ${f.query}: no gap row is in the main group, and every gap row passes the other filters`, async () => {
      const s = state(parsed(f.query).href);
      const got = await listPlacesChecked(s);
      const main = new Set(got.rows.map((r) => r.id));
      for (const facet of d.facets) {
        const sel = s.facets[facet.param] ?? [];
        if (!sel.length || (!facet.gap && !facet.scoped)) continue;
        for (const row of got.rows) expect(isGapRow(row, facet, sel), `${row.name} is a gap on ${facet.param}`).toBe(false);
      }
      const seen = new Set<string>();
      for (const g of got.unchecked) {
        const facet = d.facets.find((x) => x.param === g.param)!;
        for (const row of g.rows) {
          expect(main.has(row.id), `${row.name} is in both groups`).toBe(false);
          expect(seen.has(row.id), `${row.name} listed twice`).toBe(false);
          seen.add(row.id);
          expect(matchesRow(row, s, d, g.param), `${row.name} fails another filter`).toBe(true);
          expect(isGapRow(row, facet, s.facets[g.param] ?? [])).toBe(true);
        }
      }
    });
  }

  it('queries 2, 9 and 28 show their gaps with the right counts', async () => {
    // the count is worked out here from the rows, not from the function under test
    const q2 = state(parsed(fixtures[1]!.query).href);
    const falls = real.filter((p) => typeInScope(p.type, ['water.falls']));
    const expectGap = falls.filter((p) => !p.flags.some((x) => x === 'stroller' || x === 'stroller_part' || x === '!stroller'));
    const got2 = await listPlacesChecked(q2);
    expect(got2.rows.every((p) => p.flags.includes('stroller'))).toBe(true);
    expect(got2.unchecked.find((g) => g.param === 'stroller')?.rows.length ?? 0).toBe(expectGap.length);

    const q9 = state(parsed(fixtures[8]!.query).href);
    const culture = real.filter((p) => typeInScope(p.type, ['culture']) && p.country === 'US' && p.region === 'vermont');
    const gap9 = culture.filter((p) => !p.flags.includes('step_free') && !p.flags.includes('!step_free'));
    expect((await listPlacesChecked(q9)).unchecked.find((g) => g.param === 'f.step-free')?.rows.length ?? 0).toBe(gap9.length);

    const q28 = state(parsed(fixtures[27]!.query).href);
    const trails = real.filter((p) => typeInScope(p.type, ['nature.trail']));
    const got28 = await listPlacesChecked(q28);
    const unknownDogs = trails.filter((p) => !p.flags.includes('dogs') && !p.flags.includes('!dogs')).length;
    const dogs = got28.unchecked.find((g) => g.param === 'f.dogs')?.rows.length ?? 0;
    // a row with no dogs answer and no shape answer is counted once, under dogs
    expect(dogs).toBeLessThanOrEqual(unknownDogs);
    expect(got28.rows.every((p) => p.flags.includes('dogs') && p.shape === 'loop')).toBe(true);
  });
});
