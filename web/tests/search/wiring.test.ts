import { beforeAll, describe, expect, it } from 'vitest';
import { countParsed, listPlacesChecked, registerList } from '@/lib/client/data';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { tripDescriptor } from '@/lib/entities/descriptors/trip';
import { FACET_PARAMS } from '@/lib/entities/types';
import type { ListState } from '@/lib/entities/types';
import { decodeState, encodeState, emptyState } from '@/lib/entities/url';
import { stillApplies, undoState } from '@/lib/search/applied';
import type { Applied } from '@/lib/search/applied';
import { parse } from '@/lib/search/parse/parse';
import { mergeSets, pickAlternative, withoutChips } from '@/lib/search/parse/pick';
import { placeRows } from '../places/support';
import { tripListRows } from '@/app/trips/rows';
import { fixtures, loadVocab, pairs, searchRecords } from './support';

// The UI wiring of smart search (backlog 3.43 part B): chip removal and picks, the undo state, the URL round trip through the keys that
// already exist, and the counts the header shows.

const records = searchRecords();
const vocab = loadVocab();
const p = (q: string, opts?: Parameters<typeof parse>[3]) => parse(q, vocab, records, opts);
const onlyListKeys = (keys: string[]) => keys.every((k) => k === 'q' || (FACET_PARAMS as readonly string[]).includes(k) || /^f\.[a-z-]+$/.test(k));

describe('URL round trip: no new key (acceptance, backlog 3.43)', () => {
  const read = fixtures.filter((f) => f.target !== 'search');
  for (const f of read) {
    it(`${f.id}. ${f.query}`, async () => {
      const got = p(f.query);
      const query = got.href.split('?')[1] ?? '';
      const state = decodeState(query);
      // the list reads every key the parser wrote, and writes them back as they were
      expect(pairs(encodeState(state))).toEqual(pairs(query));
      expect(onlyListKeys([...new URLSearchParams(query).keys()])).toBe(true);
      expect(state.facets).toEqual(Object.fromEntries(Object.entries(got.facets).filter(([k]) => k !== 'q')));
      expect(state.q).toBe(got.q);
    });
  }
});

describe('removing and switching chips', () => {
  it('removing a chip drops exactly its keys from the keys and the link', async () => {
    const got = p('easy hike with kids near Banff in September');
    const less = withoutChips(got, ['season']);
    expect(less.chips.map((c) => c.id)).not.toContain('season');
    expect(less.facets.season).toBeUndefined();
    expect(pairs(less.href)).toEqual(pairs(got.href).filter((x) => !x.startsWith('season=')));
    // the area chip writes three keys, and all three go with it
    const noArea = withoutChips(got, ['where']);
    for (const k of ['country', 'region', 'area']) expect(noArea.facets[k]).toBeUndefined();
    expect(withoutChips(got, [])).toBe(got);
  });

  it('a removed chip stays removed on the next parse: its words stay used, so q does not gain them', async () => {
    const got = p('easy hike with kids near Banff in September', { dropped: ['season'] });
    expect(got.chips.map((c) => c.id)).not.toContain('season');
    expect(got.q).toBe('');
    expect(got.unused).not.toContain('september');
  });

  it('picking the other area replaces the area chip and the three keys', async () => {
    const got = p('easy hike near Auronzo in September');
    const where = got.chips.find((c) => c.id === 'where')!;
    expect(where.alternatives?.length).toBeGreaterThan(0);
    const alt = where.alternatives![0]!;
    const next = pickAlternative(got, 'where', alt);
    expect(next.chips.find((c) => c.id === 'where')!.label).toBe(alt.label);
    expect(next.facets.area).toEqual(alt.set.area);
    expect(next.chips.map((c) => c.id)).toEqual(got.chips.map((c) => c.id));
    expect(pairs(next.href)).toEqual(pairs(`?${encodeState({ ...emptyState(), q: next.q, facets: mergeSets(next.chips) })}`));
  });

  it('on Trips, "with kids" asks the age and sets nothing until one is picked (Q40)', async () => {
    const got = p('weekend trip with kids in October');
    const ask = got.chips.find((c) => c.ask)!;
    expect(ask.set).toEqual({});
    expect(got.facets.kid).toBeUndefined();
    expect(ask.alternatives!.map((a) => a.set.kid?.[0])).toEqual(['0', '3', '6', '9', '12']);
    const six = pickAlternative(got, 'kid', ask.alternatives![2]!);
    expect(six.facets.kid).toEqual(['6']);
    expect(six.chips.find((c) => c.id === 'kid')!.ask).toBeUndefined();
    expect(six.href).toContain('kid=6');
  });

  it('on Places, "with kids" and no age asks the age and sets nothing until one is picked (Q40, 4.29)', async () => {
    const got = p('easy hike with kids near Banff in September');
    expect(got.facets.kid).toBeUndefined();
    const ask = got.chips.find((c) => c.ask)!;
    const six = pickAlternative(got, 'kid', ask.alternatives![2]!);
    expect(six.facets.kid).toEqual(['6']);
    expect(six.chips.find((c) => c.id === 'kid')!.label).toBe('Youngest child 6');
  });
});

describe('the undo line (Q39)', () => {
  const before: ListState = { ...emptyState(), facets: { country: ['IT'] } };
  const parsed = p('easy hike with kids near Banff in September');
  const applied: Applied = { parsed, text: 'easy hike with kids near Banff in September', before };
  const after: ListState = { ...before, q: parsed.q, facets: { ...before.facets, ...parsed.facets } };

  it('undo puts the words back as plain text and the filters back as they were', async () => {
    const back = undoState(applied);
    expect(back.q).toBe(applied.text);
    expect(back.facets).toEqual(before.facets);
  });

  it('holds while the filters it wrote are untouched, and lets go when the visitor changes one', async () => {
    expect(stillApplies(after, applied)).toBe(true);
    expect(stillApplies({ ...after, facets: { ...after.facets, season: ['10'] } }, applied)).toBe(false);
    const dropped = { ...after, facets: { ...after.facets } };
    delete dropped.facets.season;
    expect(stillApplies(dropped, applied)).toBe(false);
  });
});

describe('the header count (countParsed)', () => {
  beforeAll(() => {
    registerList(placeDescriptor, placeRows());
    registerList(tripDescriptor, tripListRows());
  });

  it('is the number of rows the list would show, and the number listed apart', async () => {
    const got = p('waterfall I can reach with a stroller');
    const n = countParsed(got)!;
    const real = await listPlacesChecked(decodeState(got.href.split('?')[1]!));
    expect(n.n).toBe(real.rows.length);
    expect(n.unchecked).toBe(real.unchecked.reduce((a, g) => a + g.rows.length, 0));
  });

  it('is null when a name won, and a plain count for trips', async () => {
    expect(countParsed(p('Niagara Falls'))).toBeNull();
    const trips = p('camper van trip in Iceland');
    expect(countParsed(trips)!.unchecked).toBe(0);
  });
});
