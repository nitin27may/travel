import { describe, expect, it } from 'vitest';
import { fallbackLabel } from '@/lib/entities/valueLabels';
import type { FacetParam } from '@/lib/entities/types';
import { parse } from '@/lib/search/parse/parse';
import { CLIMB_BANDS, LENGTH_BANDS, TIME_BANDS } from '@/lib/search/parse/grammar';
import { fixtures, loadVocab, searchRecords } from './support';

// Review SQ1b M2: a value the parser writes must reach the filter bar with a name, not as its code, even when no row carries it.

const vocab = loadVocab();
const looksLikeCode = (label: string, value: string) => label === value || /[._]/.test(label) || /^\d+$/.test(label);

describe('every value the parser can write has a name', () => {
  it('each value in the vocabulary', () => {
    const bad: string[] = [];
    for (const [param, values] of Object.entries(vocab.t)) {
      if (param.startsWith('$')) continue;
      for (const value of Object.keys(values)) for (const v of value.split(',')) {
        const label = fallbackLabel(param as FacetParam, v);
        if (looksLikeCode(label, v) && !['yes', 'no', 'any'].includes(v)) bad.push(`${param}=${v} -> ${label}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('months, the bands a number can pick, and the trip classes', () => {
    for (let m = 1; m <= 12; m += 1) expect(fallbackLabel('season', String(m))).toMatch(/^[A-Z][a-z]{2}$/);
    for (const [id, label] of LENGTH_BANDS) expect(fallbackLabel('f.length', id)).toBe(label);
    for (const [id, label] of CLIMB_BANDS) expect(fallbackLabel('f.climb', id)).toBe(label);
    for (const [id, label] of TIME_BANDS) { expect(fallbackLabel('f.time', id)).toBe(label); expect(fallbackLabel('f.duration', id)).toBe(label); }
    for (const n of [1, 2, 3, 4]) expect(fallbackLabel('drive', `toronto-${n}`)).toMatch(/^Within \d hours? of Toronto$/);
    expect(fallbackLabel('k', 'water.thermal.hot_spring')).toBe('Hot spring');
    expect(fallbackLabel('country', 'IS')).toBe('Iceland');
    expect(fallbackLabel('kid', '2')).toBe('Age 2');
  });

  it('every key and value of the 30 fixture parses', () => {
    const bad: string[] = [];
    for (const f of fixtures.filter((x) => x.target !== 'search')) {
      const p = parse(f.query, vocab, searchRecords());
      for (const [param, values] of Object.entries(p.facets)) for (const v of values) {
        if (param === 'q') continue;
        const label = fallbackLabel(param as FacetParam, v);
        if (looksLikeCode(label, v) && !['yes', 'no', 'any', 'friendly', 'weekend', 'day', 'overnight', 'easy', 'moderate', 'loop', 'train', 'tours', 'hard', 'technical', 'stroll'].includes(v.toLowerCase())) bad.push(`${f.id} ${param}=${v} -> ${label}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('the facet buttons of the desktop bar name a parsed value that no row carries', () => {
  it('facetCounts labels a selected value from the same tables, so "Kind" and "Season" never show a code', async () => {
    const { facetCounts } = await import('@/lib/entities/filter');
    const { placeDescriptor } = await import('@/lib/entities/descriptors/place');
    const { placeRows } = await import('../places/support');
    const { decodeState } = await import('@/lib/entities/url');
    const state = decodeState('k=water.thermal.hot_spring&season=12&f.length=lt3&f.climb=150-400&drive=toronto-2&effort=technical');
    const counts = facetCounts(placeRows(), state, placeDescriptor);
    const label = (param: string, v: string) => counts[param]?.find((o) => o.value === v)?.label;
    expect(label('k', 'water.thermal.hot_spring')).toBe('Hot spring');
    expect(label('season', '12')).toBe('Dec');
    for (const [param, v] of [['k', 'water.thermal.hot_spring'], ['season', '12'], ['effort', 'technical']] as const) {
      const l = label(param, v);
      expect(l, `${param}=${v}`).toBeDefined();
      expect(l, `${param}=${v}`).not.toMatch(/[._]|^\d+$/);
    }
  });
});
