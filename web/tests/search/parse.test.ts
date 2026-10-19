import { describe, expect, it } from 'vitest';
import { parse } from '@/lib/search/parse/parse';
import type { VocabFile } from '@/lib/search/parse/types';
import { singular } from '@/lib/search/parse/words';
import { fixtures, labels, loadVocab, pairs, searchRecords } from './support';

// Smart search phase 1 (backlog 3.43, docs/v2/features/smart-search.md): the 30 queries of section 3, the ambiguity rules A1-A13 of
// section 5 and the honesty rules H1-H6 of section 7. Real data: the search index the site builds.

const records = searchRecords();
const vocab = loadVocab();
const p = (q: string, opts?: Parameters<typeof parse>[3]) => parse(q, vocab, records, opts);
const facetsOf = (q: string, opts?: Parameters<typeof parse>[3]) => p(q, opts).facets;

describe('the 30 fixture queries (section 3)', () => {
  it('has thirty of them, each with the URL the spec lists', () => {
    expect(fixtures).toHaveLength(30);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(30);
  });

  for (const f of fixtures) {
    it(`${f.id}. ${f.query}`, () => {
      const got = p(f.query);
      expect(got.target).toBe(f.target);
      if (f.target === 'search') {
        // A1: a name won, so there are no chips and no list to open
        expect(got.chips).toEqual([]);
        expect(got.href).toBe('');
        return;
      }
      expect(pairs(got.href)).toEqual(pairs(f.url));
      for (const text of f.chip ?? []) expect(labels(got)).toContain(text);
      for (const text of f.dym ?? []) expect(got.didYouMean.map((d) => d.label).join(' | ')).toContain(text);
      for (const text of f.notYet ?? []) expect(got.notYet).toContain(text);
      for (const text of f.unused ?? []) expect(got.unused).toContain(text);
      expect(got.chips.some((c) => c.ask)).toBe(Boolean(f.ask));
    });
  }

  it('the chips of query 1 are the ones the spec shows', () => {
    expect(labels(p(fixtures[0]!.query)).sort()).toEqual(['Banff, Alberta', 'Easy or a stroll', 'September', 'Trails and walks', 'With kids']);
  });
});

describe('ambiguity rules (section 5)', () => {
  it('A1: a name beats a parse, for trips, places and areas', () => {
    for (const q of ['Niagara Falls', 'Lake Louise', 'Banff', 'the Dolomites', 'Utah']) expect(p(q).target, q).toBe('search');
    expect(p('waterfalls near Niagara Falls').target).toBe('places');
  });

  it('A2: a word that is a type and an effort gives both, unless another type word is there', () => {
    expect(facetsOf('stroll')).toEqual({ k: ['nature.trail'], effort: ['stroll'] });
    expect(facetsOf('stroll to a waterfall')).toEqual({ k: ['water.falls'], effort: ['stroll'] });
  });

  it('A2: one phrase with two values of one key takes neither and offers both', () => {
    const v: VocabFile = JSON.parse(JSON.stringify(vocab));
    v.t.k!['water.falls']!.push('cascade thing');
    v.t.k!['nature.trail']!.push('cascade thing');
    const got = parse('cascade thing', v, records);
    expect(got.facets.k).toBeUndefined();
    expect(got.didYouMean.map((d) => d.label)).toEqual(['cascade thing: Trails and walks', 'cascade thing: Waterfalls and rapids']);
  });

  it('A3: type words widen to the category, and the marked ones stay exact', () => {
    expect(facetsOf('kayaking').k).toEqual(['water.paddle']);
    expect(facetsOf('gondola').k).toEqual(['ride.lift']);
    expect(facetsOf('hot springs').k).toEqual(['water.thermal.hot_spring']);
    expect(facetsOf('onsen').k).toEqual(['water.thermal.hot_spring']);
    expect(facetsOf('spa').k).toEqual(['water.thermal']);
    expect(facetsOf('zipline').k).toEqual(['air.zip.zipline']);
  });

  it('A4: fall is autumn, falls is a waterfall, and ordinary words are not types', () => {
    expect(facetsOf('fall')).toEqual({ season: ['9', '10', '11'] });
    expect(facetsOf('fall foliage')).toEqual({ season: ['9', '10', '11'] });
    expect(facetsOf('falls')).toEqual({ k: ['water.falls'] });
    expect(facetsOf('waterfalls')).toEqual({ k: ['water.falls'] });
    for (const word of ['tram', 'slot']) {
      const got = p(word);
      expect(got.facets, word).toEqual({});
      expect(got.unused, word).toEqual([word]);
    }
  });

  it('A5: an area tie picks the one with most places and offers the other', () => {
    const got = p('hikes near Banff');
    expect(got.facets.area).toEqual(['banff']);
    expect(got.chips.find((c) => c.id === 'where')?.alternatives?.map((a) => a.label)).toEqual(['Banff National Park, Alberta']);
    expect(got.didYouMean[0]!.href).toContain('area=banff-national-park');
  });

  it('A5: a prefix of four letters finds the area, and a landform sets no area', () => {
    expect(p('hikes in Chamonix').facets.area).toEqual(['chamonix-valley']);
    const rockies = p('hikes in the Rocky Mountains');
    expect(rockies.facets.area).toBeUndefined();
    expect(rockies.unused).toContain('rocky mountains');
  });

  it('A5: a place we do not know is not applied, and what holds the word is offered', () => {
    const got = p('waterfalls in Patagonia');
    expect(got.facets).toEqual({ k: ['water.falls'] });
    expect(got.unused).toContain('patagonia');
    expect(got.didYouMean.some((d) => d.href === '/trips/patagonia-2027/')).toBe(true);
  });

  it('A6: near a place uses the place\'s area; on trips an area below country stays text', () => {
    expect(facetsOf('stroll near Lake Louise').area).toEqual(['banff-national-park']);
    const trip = p('road trip in Utah');
    expect(trip.facets).toEqual({ country: ['US'], shape: ['road-trip'] });
    expect(trip.q).toBe('utah');
  });

  it('A7: length, climb and time bring trails; a duration with no kind sets nothing and offers both readings', () => {
    const km = p('under 5 km');
    expect(km.facets).toEqual({ k: ['nature.trail'], 'f.length': ['lt3', '3-6'] });
    expect(km.chips.find((c) => c.id === 'k')?.implied).toBe(true);
    expect(facetsOf('500 m climb')).toEqual({ k: ['nature.trail'], 'f.climb': ['400-800'] });
    const half = p('half day in Banff');
    expect(half.facets['f.time']).toBeUndefined();
    expect(half.facets['f.duration']).toBeUndefined();
    expect(half.unused).toContain('half day');
    expect(half.didYouMean.map((d) => d.label)).toEqual(expect.arrayContaining(['Half a day, hikes', 'Half a day, activities']));
    expect(facetsOf('half day activities')).toEqual({ k: ['intent:do'], 'f.duration': ['half-day'] });
  });

  it('A8: seasons follow the hemisphere of the country, and the north is the default', () => {
    expect(facetsOf('winter hikes in Argentina').season).toEqual(['6', '7', '8']);
    expect(facetsOf('summer hikes in Argentina').season).toEqual(['12', '1', '2']);
    expect(facetsOf('winter hikes in Canada').season).toEqual(['12', '1', '2']);
    expect(facetsOf('winter hikes').season).toEqual(['12', '1', '2']);
    expect(labels(p('winter hikes'))).toContain('Winter, Dec to Feb');
  });

  it('A9: party words without an age', () => {
    expect(facetsOf('hikes with kids').kid).toEqual(['yes']);
    expect(facetsOf('toddler friendly hikes').kid).toEqual(['2']);
    expect(facetsOf('hikes with a baby').kid).toEqual(['0']);
    expect(facetsOf('hikes with a teen').kid).toEqual(['13']);
    const trips = p('weekend trip with kids');
    expect(trips.facets.kid).toBeUndefined();
    const ask = trips.chips.find((c) => c.ask)!;
    expect(ask.alternatives!.map((a) => a.set.kid![0])).toEqual(['4', '6', '8', '10', '12']);
    expect(p('weekend trip with a 7 year old').facets.kid).toEqual(['6']);
    expect(p('weekend trip with a 3 year old').facets.kid).toBeUndefined();
  });

  it('Q40 is one switch: another answer changes the kids-without-age behaviour and nothing else', () => {
    const ask = p('hikes with kids', { decisions: { kidsWithoutAge: { places: 'ask', trips: 'ask' } } });
    expect(ask.facets.kid).toBeUndefined();
    expect(ask.chips.find((c) => c.ask)?.alternatives).toHaveLength(7);
    const none = p('weekend trip with kids', { decisions: { kidsWithoutAge: { places: 'yes', trips: 'none' } } });
    expect(none.chips.some((c) => c.ask)).toBe(false);
    expect(none.unused).toContain('kids');
    expect(p('hikes with kids').facets.kid).toEqual(['yes']);
  });

  it('A10: numbers map to bands, and the chip says when it rounded (H6)', () => {
    expect(labels(p('trails under 5 km'))).toContain('Up to 6 km (nearest band)');
    expect(labels(p('trails under 3 km'))).toContain('Under 3 km');
    expect(facetsOf('trails over 5 km')['f.length']).toEqual(['3-6', '6-10', '10+']);
    expect(labels(p('trails over 5 km'))).toContain('From 3 km (nearest band)');
    expect(facetsOf('5 km trails')['f.length']).toEqual(['3-6']);
    expect(facetsOf('trails 10 km')['f.length']).toEqual(['10+']);
    expect(facetsOf('trails 2 miles')['f.length']).toEqual(['3-6']);
    expect(facetsOf('5k trails')['f.length']).toEqual(['3-6']);
    expect(facetsOf('trails 1.5 km')['f.length']).toEqual(['lt3']);
    expect(labels(p('hike 500 m climb'))).toContain('400 to 800 m (band for 500 m)');
  });

  it('A11: trip words choose Trips, and places win when both kinds of word appear', () => {
    expect(p('weekend away').target).toBe('trips');
    expect(p('3 nights in Iceland').facets).toEqual({ country: ['IS'], length: ['long-weekend'] });
    const both = p('hike weekend trip');
    expect(both.target).toBe('places');
    expect(both.facets).toEqual({ k: ['nature.trail'] });
    expect(both.unused).toContain('weekend');
    const offer = both.didYouMean.find((d) => d.label === 'Search trips instead')!;
    expect(offer.href.startsWith('/trips/')).toBe(true);
    expect(offer.href).toContain('length=weekend');
  });

  it('A12: two ages give the youngest; two countries give neither and offer both', () => {
    expect(facetsOf('hikes aged 9 and aged 4').kid).toEqual(['4']);
    const two = p('hikes in Iceland and Norway');
    expect(two.facets.country).toBeUndefined();
    expect(two.didYouMean.map((d) => d.label).sort()).toEqual(['Iceland', 'Norway']);
  });

  it('A13: a typo is offered, never applied', () => {
    const got = p('waterfals in Iceland');
    expect(got.facets).toEqual({ country: ['IS'] });
    expect(got.unused).toContain('waterfals');
    const fix = got.didYouMean.find((d) => d.label === 'waterfall')!;
    expect(pairs(fix.href)).toEqual(pairs('country=IS&k=water.falls'));
  });
});

describe('honesty (section 7)', () => {
  // filler says nothing; a trip word ("trip") chooses the Trips list, which the result always names
  const FILLER = new Set([...Object.values(vocab.t.$filler!).flat(), ...Object.values(vocab.t.$trips!).flat()]);

  it('H3: every word is a chip, filler, or listed as not used; none is dropped silently', () => {
    for (const f of fixtures.filter((x) => x.target !== 'search')) {
      const got = p(f.query);
      const words = f.query.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean);
      const shown = new Set<string>();
      const add = (s: string) => s.split(' ').forEach((w) => shown.add(w));
      for (const text of [...got.unused, ...got.notYet, got.q]) add(text);
      for (const c of got.chips) for (const part of [c.label]) add(part.toLowerCase().replace(/[^a-z0-9 ]+/g, ' '));
      // a chip label can name its words differently ("hike" is "Trails and walks"), so a word counts as read when a chip's span covers it
      const covered = new Set<number>();
      for (const c of got.chips) for (let i = c.words[0]; i < c.words[1]; i += 1) covered.add(i);
      const uncovered = words.map((w, i) => ({ w, i })).filter(({ w, i }) => !FILLER.has(w) && !FILLER.has(singular(w)) && !covered.has(i) && !shown.has(w) && !shown.has(singular(w)));
      expect(uncovered.map((u) => u.w), `${f.id}. ${f.query}`).toEqual([]);
    }
  });

  it('H4: relevance words are shown as not used yet and change nothing', () => {
    const plain = p('hikes in Utah');
    const gems = p('hidden gems hikes in Utah');
    expect(gems.href).toBe(plain.href);
    expect(gems.notYet).toEqual(['hidden gem']);
    expect(p('must see waterfalls').notYet).toEqual(['must see']);
    expect(p('worth the journey').facets).toEqual({});
  });

  it('H3: a word with no filter is listed as not used and kept as text', () => {
    const got = p('quiet hike in Banff');
    expect(got.unused).toEqual(['quiet']);
    expect(got.q).toBe('quiet');
    expect(got.facets.q).toBeUndefined();
    expect(got.href).toContain('q=quiet');
  });

  it('a gap is never turned into a yes: a parsed constraint writes the filter, and the answer is checked by the list (gaps.test.ts)', () => {
    // the parser only writes keys; it never makes a place easy or stroller friendly
    expect(Object.keys(facetsOf('easy waterfall with a stroller')).sort()).toEqual(['effort', 'k', 'stroller']);
  });

  it('removing a chip drops its keys and its words do not come back (acceptance 4)', () => {
    const full = p('easy hike with kids near Banff in September');
    const less = p('easy hike with kids near Banff in September', { dropped: ['season'] });
    expect(less.facets.season).toBeUndefined();
    expect(less.chips.map((c) => c.id)).not.toContain('season');
    expect(less.q).toBe('');
    expect(less.unused).toEqual([]);
    expect(less.href).not.toBe(full.href);
    expect(pairs(less.href)).toEqual(pairs(full.href).filter((x) => !x.startsWith('season=')));
    expect(p('hikes near Banff', { dropped: ['where'] }).facets.area).toBeUndefined();
  });

  it('is pure: the same input gives the same answer and nothing is changed', () => {
    const frozen: VocabFile = JSON.parse(JSON.stringify(vocab));
    const deep = (o: unknown): void => {
      if (o && typeof o === 'object') {
        Object.freeze(o);
        Object.values(o).forEach(deep);
      }
    };
    deep(frozen);
    const a = parse(fixtures[0]!.query, frozen, records);
    expect(parse(fixtures[0]!.query, frozen, records)).toEqual(a);
    expect(a).toEqual(p(fixtures[0]!.query));
  });

  it('an empty or filler-only query reads as nothing', () => {
    for (const q of ['', '   ', 'in the', '???']) {
      const got = p(q);
      expect(got.chips, q).toEqual([]);
      expect(got.facets, q).toEqual({});
      expect(got.unused, q).toEqual([]);
    }
  });

  it('forcing a list works: trips-only words are not used on Places and the other way round', () => {
    const places = p('weekend hikes', { target: 'places' });
    expect(places.target).toBe('places');
    expect(places.unused).toContain('weekend');
    const trips = p('weekend hikes', { target: 'trips' });
    expect(trips.target).toBe('trips');
    expect(trips.facets).toEqual({ length: ['weekend'] });
    expect(trips.unused).toContain('hikes');
  });
});

describe('robustness', () => {
  it('never throws and always returns spans inside the query, for 2000 random queries', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const pool = [...Object.values(vocab.t).flatMap((v) => Object.values(v).flat()), 'banff', 'utah', 'iceland', 'toronto', 'from', '5', '12', '3.5', 'km', 'm', 'x', '', '???', 'Café', 'a b', '１２', 'zzzzz', 'under', 'over', 'to'];
    for (let i = 0; i < 2000; i += 1) {
      const words = Array.from({ length: 1 + Math.floor(rnd() * 9) }, () => pool[Math.floor(rnd() * pool.length)]!);
      const q = words.join(rnd() < 0.5 ? ' ' : '  ,');
      const got = p(q);
      const n = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).length + 8;
      for (const c of got.chips) {
        expect(c.words[0]).toBeGreaterThanOrEqual(0);
        expect(c.words[1]).toBeLessThanOrEqual(n);
      }
      expect(got.didYouMean.length).toBeLessThanOrEqual(3);
      expect(typeof got.href).toBe('string');
      for (const [k, v] of Object.entries(got.facets)) expect(v.length, `${q}: ${k}`).toBeGreaterThan(0);
    }
  });
});
