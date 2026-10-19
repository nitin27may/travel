import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLICE, orderOf } from '@/lib/entities/facets';
import { FACET_PARAMS } from '@/lib/entities/types';
import { CLIMB_BANDS, LENGTH_BANDS, TIME_BANDS } from '@/lib/search/parse/grammar';
import { PHRASES } from '@/lib/search/parse/phrases';
import { parse } from '@/lib/search/parse/parse';
import { AROUND_ORDER, HIKE_ORDER, LENGTH_ORDER, PERDAY_ORDER } from '@/components/trips/tags/labels';
import { TIME_LABELS } from '@/lib/entities/facets/answers';
import { BASE_PARAMS, BASE_VALUES, STOP_ALIASES, buildVocab, vocabText } from '../../scripts/search-vocab.mjs';
import { WEB } from '../helpers';
import { loadVocab, readRoot, searchRecords, vocabPath } from './support';

// The build-time vocabulary (smart-search 4.3). It carries labels only (P8), it is rebuilt from data, and it fails on a dead word.

const types = readRoot('data/vocab/types.json');
const slice = readRoot('web/lib/entities/facets/contract-slice.json');
const built = () => buildVocab({ types, slice });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('vocab.json', () => {
  it('is what the build writes from types.json, the contract slice and phrases.ts (run `node web/scripts/search-vocab.mjs` after a change)', () => {
    expect(readFileSync(vocabPath, 'utf8')).toBe(vocabText(built().vocab));
  });

  it('builds with no dead vocabulary and no unruled double meaning', () => {
    expect(built().problems).toEqual([]);
  });

  it('the check runs from the command line and passes (this is the line in tools/check-all.sh)', () => {
    const out = execFileSync(process.execPath, [path.join(WEB, 'scripts/search-vocab.mjs'), '--check'], { cwd: WEB, encoding: 'utf8' });
    expect(out).toMatch(/search-vocab: ok/);
  });

  it('holds vocabulary only: grammar classes and the URL keys, no place names, slugs or facts (P8)', () => {
    const v = loadVocab();
    const keys = Object.keys(v.t);
    for (const k of keys) expect(k.startsWith('$') || BASE_PARAMS.includes(k) || SLICE.facets.some((f) => `f.${f.key}` === k), k).toBe(true);
    // no phrase is the name of a place or a trip the catalogue holds
    const names = new Set(searchRecords().filter((r) => r.k !== 'area').map((r) => r.n.toLowerCase()));
    const phrases = keys.flatMap((k) => Object.values(v.t[k]!).flat());
    expect(phrases.filter((p) => names.has(p))).toEqual([]);
    expect(Object.keys(v)).toEqual(['schema', 'v', 't', 'l', 'south', 'implied', 'c', 'cx']);
  });

  it('every word is lower case with plain letters, and a plural is left to the parser (a type label is stored singular)', () => {
    const v = loadVocab();
    for (const values of Object.values(v.t)) for (const phrases of Object.values(values)) for (const p of phrases) expect(p, p).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/);
    expect(v.t.k!['water.body']).toContain('lake');
    expect(v.t.k!['water.body']).not.toContain('lakes');
  });
});

describe('the parser reads the data, not a copy of it', () => {
  it('a new type with a label and aliases is found with no code change (acceptance 2)', () => {
    const t = clone(types);
    t.nodes.push({ id: 'nature.landform.sea_stack', parent: 'nature.landform', level: 'type', label: 'Sea stack', aliases: ['stack'] });
    const { vocab, problems } = buildVocab({ types: t, slice });
    expect(problems).toEqual([]);
    expect(vocab.t.k!['nature.landform']).toEqual(expect.arrayContaining(['sea stack', 'stack']));
    const before = parse('sea stacks in Iceland', loadVocab(), searchRecords());
    // before, only the word "sea" meant something (water.body) and "stack" was not used
    expect(before.facets.k).toEqual(['water.body']);
    expect(before.unused).toContain('stacks');
    const after = parse('sea stacks in Iceland', vocab as never, searchRecords());
    expect(after.facets).toEqual({ country: ['IS'], k: ['nature.landform'] });
  });

  it('a node marked search: "exact" stays exact, and the listed exact types do', () => {
    const t = clone(types);
    t.nodes.push({ id: 'nature.landform.sea_stack', parent: 'nature.landform', level: 'type', label: 'Sea stack', search: 'exact' });
    expect(buildVocab({ types: t, slice }).vocab.t.k!['nature.landform.sea_stack']).toEqual(['sea stack']);
  });

  it('an alias that is an ordinary word is left out (A4)', () => {
    expect(STOP_ALIASES.has('tram')).toBe(true);
    const k = loadVocab().t.k!;
    expect(Object.values(k).flat()).not.toContain('tram');
    expect(Object.values(k).flat()).not.toContain('slot');
  });
});

describe('the check fails on dead vocabulary (acceptance 3)', () => {
  it('a facet value that does not exist', () => {
    const phrases = clone(PHRASES);
    phrases['f.toilets'] = { ...phrases['f.toilets'], maybe: ['perhaps'] };
    const { problems } = buildVocab({ types, slice, phrases });
    expect(problems.join('\n')).toMatch(/"perhaps" -> f\.toilets=maybe .*not a value of f\.toilets/);
  });

  it('a value of a band that was renamed', () => {
    const phrases = clone(PHRASES);
    phrases['f.walk-from-the-car'] = { lt100: ['at the car'] };
    expect(buildVocab({ types, slice, phrases }).problems.join('\n')).toMatch(/not a value of f\.walk-from-the-car/);
  });

  it('a target that is not a URL key, and a facet that is gone from the contract', () => {
    const phrases = clone(PHRASES);
    phrases.bogus = { yes: ['foo'] };
    expect(buildVocab({ types, slice, phrases }).problems.join('\n')).toMatch(/"foo" -> bogus=yes .*bogus is not a URL filter key/);
    const gone = clone(slice);
    gone.facets = gone.facets.filter((f: { key: string }) => f.key !== 'toilets');
    expect(buildVocab({ types, slice: gone }).problems.join('\n')).toMatch(/f\.toilets is not a URL filter key/);
  });

  it('a type that does not exist, an age that is not one, a month that is not one', () => {
    const phrases = clone(PHRASES);
    phrases.k = { ...phrases.k, 'nature.nothing': ['nowhere'] };
    phrases.kid = { ...phrases.kid, '40': ['ancient'] };
    phrases.season = { '13': ['smarch'] };
    const text = buildVocab({ types, slice, phrases }).problems.join('\n');
    expect(text).toMatch(/nature\.nothing.*no such type/);
    expect(text).toMatch(/not an age/);
    expect(text).toMatch(/not a month/);
  });

  it('a double meaning with no rule', () => {
    const t = clone(types);
    t.nodes.push({ id: 'food.eat.cafe_two', parent: 'food.eat', level: 'type', label: 'Cafe two', aliases: ['hangout'] });
    t.nodes.push({ id: 'culture.show.arena', parent: 'culture.show', level: 'type', label: 'Arena', aliases: ['hangout'] });
    expect(buildVocab({ types: t, slice }).problems.join('\n')).toMatch(/"hangout" means k=food\.eat .* and k=culture\.show/);
  });

  it('an ordinary word that is also a grammar word', () => {
    const phrases = clone(PHRASES);
    phrases.k = { ...phrases.k, culture: [...phrases.k!.culture!, 'the'] };
    expect(buildVocab({ types, slice, phrases }).problems.join('\n')).toMatch(/"the" is both \$filler and k=culture/);
  });

  it('a phrase longer than the parser looks for', () => {
    const phrases = clone(PHRASES);
    phrases.k = { ...phrases.k, culture: ['one two three four five six'] };
    expect(buildVocab({ types, slice, phrases }).problems.join('\n')).toMatch(/longer than 5 words/);
  });
});

describe('the grammar constants match the real facets', () => {
  it('the URL keys the parser may write are the list\'s FACET_PARAMS', () => {
    expect([...BASE_PARAMS].sort()).toEqual([...FACET_PARAMS].sort());
  });
  it('the trip values are the labels file\'s', () => {
    expect(BASE_VALUES.length).toEqual(LENGTH_ORDER);
    expect(BASE_VALUES.around).toEqual([...AROUND_ORDER]);
    expect(BASE_VALUES.perday).toEqual([...PERDAY_ORDER]);
    expect(HIKE_ORDER).toEqual(['easy', 'moderate', 'strenuous']);
  });
  it('the length, climb and time bands are the facet bands', () => {
    const order = (key: string) => orderOf(SLICE.facets.find((f) => f.key === key)!);
    expect(LENGTH_BANDS.map((b) => b[0])).toEqual(order('length'));
    expect(CLIMB_BANDS.map((b) => b[0])).toEqual(order('climb'));
    expect(TIME_BANDS.map((b) => b[0])).toEqual(order('time'));
    expect(TIME_BANDS.map((b) => b[0])).toEqual(Object.keys(TIME_LABELS));
    expect(TIME_BANDS.map((b) => b[1])).toEqual(Object.values(TIME_LABELS));
  });
});
