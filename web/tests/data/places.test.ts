import { describe, expect, it } from 'vitest';
import { computeCompleteness, PROFILE_TOTAL, type CompletenessInput } from '@/lib/public/completeness';
import { assignPlaceSlugs, kebab } from '@/lib/public/slugs';
import { mapLocationKind, mapPrototypeKind, categoryOf, STOP_KINDS, CATEGORY_OF_KIND, CONTINENT_OF } from '@/lib/public/taxonomy';
import { parseSeasonMonths } from '@/lib/public/places';
import { realData } from './support';

const d = realData();

describe('slugs', () => {
  it('kebab-cases with accents and punctuation removed', () => {
    expect(kebab("Ötzi, South Tyrol Museum")).toBe('otzi-south-tyrol-museum');
    expect(kebab("Cortina d'Ampezzo")).toBe('cortina-dampezzo');
  });

  it('appends the area when two places share a name, both of them, in any input order', () => {
    const a = { key: 'a', name: 'Moss Glen Falls', areaSlug: 'stowe' };
    const b = { key: 'b', name: 'Moss Glen Falls', areaSlug: 'granville' };
    const c = { key: 'c', name: 'Lake Louise', areaSlug: 'banff' };
    const one = assignPlaceSlugs([a, b, c]);
    const two = assignPlaceSlugs([c, b, a]);
    expect([...one].sort()).toEqual([...two].sort());
    expect(one.get('a')).toBe('moss-glen-falls-stowe');
    expect(one.get('b')).toBe('moss-glen-falls-granville');
    expect(one.get('c')).toBe('lake-louise');
  });

  it('numbers a collision inside one area', () => {
    const s = assignPlaceSlugs([{ key: 'a', name: 'X', areaSlug: 'z' }, { key: 'b', name: 'X', areaSlug: 'z' }]);
    expect([...s.values()].sort()).toEqual(['x-z', 'x-z-2']);
  });

  it('keeps the sample slug from the patterns page', () => {
    expect(d.getPlace('tre-cime-di-lavaredo-loop')?.name).toBe('Tre Cime di Lavaredo loop');
  });
});

describe('kind to category', () => {
  const real = d.internals.places;
  it('maps every kind present in the data (table-driven over the real places)', () => {
    for (const p of real) {
      expect(p.category, p.name).toBe(CATEGORY_OF_KIND[p.kind]);
      expect(p.kindLabel.length).toBeGreaterThan(0);
    }
    const kinds = new Set(real.map((p) => p.kind));
    for (const k of ['trail', 'lake', 'viewpoint', 'town', 'area', 'waterfall', 'sight', 'activity', 'lift']) expect(kinds.has(k as never), k).toBe(true);
  });

  it('follows README 2.4 for the data kinds', () => {
    expect(mapLocationKind('city')).toMatchObject({ kind: 'town' });
    expect(mapLocationKind('park').kind).toBe('area');
    expect(mapLocationKind('mountain')).toMatchObject({ kind: 'viewpoint', subkind: 'summit' });
    expect(mapLocationKind('drive')).toMatchObject({ kind: 'sight', subkind: 'scenic_drive' });
    expect(mapLocationKind('canyon')).toMatchObject({ kind: 'waterfall', subkind: 'canyon' });
    expect(mapPrototypeKind('pass')).toMatchObject({ kind: 'viewpoint', subkind: 'pullout' });
    expect(mapPrototypeKind('hut')).toMatchObject({ kind: 'eatery', subkind: 'hut_kitchen' });
    expect(mapPrototypeKind('airport')).toBeNull();
    expect(mapPrototypeKind('parking')).toBeNull();
    expect(categoryOf('airport')).toBe('logistics');
    expect(categoryOf('lift')).toBe('activities');
    expect(categoryOf('eatery')).toBe('food');
    expect(categoryOf('stay')).toBe('stays');
    expect(categoryOf('trail')).toBe('trails');
    expect(STOP_KINDS.drive).toBeNull();
    expect(STOP_KINDS.food?.kind).toBe('eatery');
  });

  it('every country with a place or trip has a continent', () => {
    for (const p of real) expect(CONTINENT_OF[p.areaChain[0].slug], p.areaChain[0].slug).toBeTruthy();
  });
});

const base: CompletenessInput = {
  kind: 'trail', name: 'T', hasArea: true, point: { lat: 46.61203, lon: 12.29648, pointSource: 'osm_node:1', pointChecked: null },
  hasDatedSource: true, hasSummary: true, hasSeason: true, hasOsmOrWikidata: true, checklistComplete: false, hasCreditedPhoto: false,
  distanceKm: 10, gainM: 450, timeHours: '3.5-4.5', hasTrailheadPoint: true, hasAccess: true, durationMin: 270,
};

describe('completeness', () => {
  it('a researched trail is Partly checked and the tooltip counts what is not tracked', () => {
    const c = computeCompleteness(base);
    expect(c.level).toBe('usable');
    expect(c.total).toBe(15);
    expect(c.passed).toBe(12);
    expect(c.notTracked).toBe(PROFILE_TOTAL.trail - 15);
    expect(c.failed.map((f) => f.id).sort()).toEqual(['C1', 'C3', 'C4']);
    expect(c.label).toBe('Partly checked · 12 of 15');
    expect(c.tooltip).toBe('12 of 15 tracked checks pass; 23 checks are not tracked yet');
  });

  it('a place with a capture record takes its level from the contract engine, in the public words', () => {
    const p = d.getPlace('tre-cime-di-lavaredo-loop')!;
    expect(p.sections).not.toBeNull();
    expect(p.completeness.passed).toBe(p.sections!.checks.done);
    expect(p.completeness.total).toBe(p.sections!.checks.total);
    expect(p.completeness.label).toMatch(/^(Basics only|Partly checked · \d+ of \d+|Checked)$/);
    expect(p.completeness.failed.every((f) => f.id.startsWith('check:'))).toBe(true);
  });
  it('"Draft" is nobody\'s label: no place says it', () => {
    for (const slug of d.placeSlugs()) expect(d.getPlace(slug)!.completeness.label, slug).not.toMatch(/draft|usable|complete\b/i);
  });

  it('a locations.json lake without access is Basics only until access is recorded', () => {
    const lake = computeCompleteness({ ...base, kind: 'lake', hasAccess: false, checklistComplete: null });
    expect(lake.total).toBeGreaterThan(8);
    expect(lake.failed.map((f) => f.id)).toContain('U3');
    expect(lake.level).toBe('draft');
    expect(lake.label).toBe('Basics only');
    expect(lake.notTracked).toBe(PROFILE_TOTAL.lake - lake.total);
  });

  it('a place with no source, no point and no summary is a Draft that lists D checks first', () => {
    const c = computeCompleteness({ ...base, kind: 'sight', point: null, hasDatedSource: false, hasSummary: false, hasSeason: false, hasOsmOrWikidata: false, checklistComplete: null, durationMin: null });
    expect(c.level).toBe('draft');
    expect(c.failed[0].id).toBe('D4');
    expect(c.failed.map((f) => f.id)).toContain('D5');
  });

  it('a point with 4 decimals or a non-OSM source fails D4', () => {
    expect(computeCompleteness({ ...base, point: { lat: 45.5053, lon: 12.3519, pointSource: 'prototype_approx', pointChecked: null } }).failed.map((f) => f.id)).toContain('D4');
  });
});

describe('seasons', () => {
  it('reads a month range', () => {
    expect(parseSeasonMonths('Jun-Oct; hut open in July')).toEqual([6, 7, 8, 9, 10]);
    expect(parseSeasonMonths('Nov to Feb')).toEqual([11, 12, 1, 2]);
    expect(parseSeasonMonths('Year-round walk')).toEqual([]);
  });
});
