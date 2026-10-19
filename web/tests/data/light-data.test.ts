import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOKING_BANDS, BAND_KEYS } from '@travel/core/capture/bandKeys.ts';
import { PLACE_LIST_KEYS } from '@/components/places/rows';
import { TRIP_LIST_KEYS } from '@/components/trips/types';
import { tripListRows } from '@/app/trips/rows';
import { buildSearchIndex, buildSearchParts } from '@/lib/search/build';
import { normalize } from '@/lib/search/normalize';
import { createPublicData } from '@/lib/public';
import { WEB, readText, walkFiles } from '../helpers';
import { placeRows } from '../places/support';

// Principle P8 (backlog 2.24): list, search and globe data carry card and filter fields only. Facts, links, suitability
// values, times and notes stay on the item's own page.

/** Keys that mean "the researched content". None may appear in a list row, a search record or a list page's payload. */
const CONTENT_KEYS = [
  'facts', 'links', 'linksNone', 'hazards', 'access', 'lines', 'seasonNote', 'minAge', 'booking', 'notes', 'note', 'summary', 'subtitle', 'stats',
  'elevationM', 'wikidata', 'sources', 'durationMin', 'timeHours', 'driveAvgMin', 'bases', 'categories', 'gallery', 'legacyUrl',
  'suitability', 'tooltip', 'reason', 'passed', 'failed', 'hint', 'effort_level', 'stroller', 'height_cm', 'weight_kg', 'min_height_cm', 'max_age', 'time', 'times', 'hours', 'photos', 'location_status',
];

function keysDeep(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  return out;
}

/**
 * The exact keys a place list row may carry, written out here on purpose: a key added to the row type fails
 * these tests until it is added below, with a reason (principle P8). Nested objects are listed the same way.
 * km, gain_m and elevation_m are a recorded waiver: numeric glance facts (P3) that are widely published.
 */
const PLACE_ROW_KEYS = ['id', 'slug', 'name', 'kind', 'kindLabel', 'legacyKind', 'country', 'country_name', 'region', 'region_name', 'regionAliases', 'area', 'area_name', 'lat', 'lon', 'km', 'gain_m', 'elevation_m', 'season', 'kid_fit', 'tags', 'image', 'trips', 'honesty', 'completeness', 'sourceTypes', 'statsState', 'researched', 'added', 'type', 'effort', 'kids_from', 'kids_basis', 'time_band', 'price_band', 'booking', 'flags', 'walk_band', 'shape', 'best_time'];
/** The one content-looking key a place row may carry: the `booking` band (none, recommended, required), a label and not a fact (contract 7.3). */
const BAND_NAMED_LIKE_CONTENT = ['booking'];
const NESTED_KEYS: Record<string, string[]> = { tags: ['id', 'kind', 'label'], trips: ['slug', 'title'], honesty: ['id', 'label'], completeness: ['label', 'level'] };

describe('list rows (principle P8)', () => {
  it('a place row carries exactly the allowed keys, and its nested objects only theirs', () => {
    for (const r of placeRows()) {
      expect(Object.keys(r).sort(), r.slug).toEqual([...PLACE_ROW_KEYS].sort());
      for (const [k, allowed] of Object.entries(NESTED_KEYS)) {
        const v = (r as unknown as Record<string, unknown>)[k];
        for (const o of Array.isArray(v) ? v : [v]) expect(Object.keys(o as object).sort(), `${r.slug}.${k}`).toEqual(allowed);
      }
    }
    expect([...PLACE_LIST_KEYS].sort()).toEqual([...PLACE_ROW_KEYS].sort());
  });
  it('a place row carries exactly the card and filter keys', () => {
    for (const r of placeRows()) expect(Object.keys(r).sort(), r.slug).toEqual([...PLACE_LIST_KEYS].sort());
  });
  it('a place row carries no content key at any depth', () => {
    const keys = keysDeep(placeRows());
    for (const k of CONTENT_KEYS.filter((k) => !BAND_NAMED_LIKE_CONTENT.includes(k))) expect(keys.has(k), `place row key ${k}`).toBe(false);
  });
  it('the booking band is a label: none, recommended, required or null, never text', () => {
    for (const r of placeRows()) expect([...BOOKING_BANDS, null], r.slug).toContain(r.booking);
  });
  it('band values are labels and numbers, never a fact with a source or a note (contract 7.3)', () => {
    for (const r of placeRows()) {
      for (const k of BAND_KEYS) {
        const v = (r as unknown as Record<string, unknown>)[k === 'kids_from' ? 'kids_from' : k];
        const ok = v === null || typeof v === 'number' || (typeof v === 'string' && v.length <= 16) || (Array.isArray(v) && v.length <= 6 && v.every((x) => typeof x === 'string' && x.length <= 14));
        expect(ok, `${r.slug}.${k}`).toBe(true);
      }
    }
  });
  it('a place row has no URL except the card cover', () => {
    for (const r of placeRows()) {
      const { image, ...rest } = r;
      void image;
      expect(JSON.stringify(rest), r.slug).not.toMatch(/https?:\/\//);
    }
  });
  it('a trip row carries exactly the card and filter keys, and no content key', () => {
    const rows = tripListRows();
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) expect(Object.keys(r).sort(), r.slug).toEqual([...TRIP_LIST_KEYS].sort());
    const keys = keysDeep(rows);
    for (const k of CONTENT_KEYS) expect(keys.has(k), `trip row key ${k}`).toBe(false);
  });
  it('the test can fail: a planted content key is seen', () => {
    expect(keysDeep([{ a: { summary: 'x' } }]).has('summary')).toBe(true);
  });
});

describe('search records (principle P8): names and areas only', () => {
  const data = createPublicData();
  it('a record has the six search keys and nothing else', () => {
    for (const r of buildSearchIndex()) expect(Object.keys(r).every((k) => ['k', 'h', 'n', 's', 'x', 'kind', 'b'].includes(k)), r.h).toBe(true);
  });
  it('the match text of a place is its kind and its area chain, with no tag, summary or fact word', () => {
    const places = new Map(data.listPlaces().map((p) => [`/places/${p.slug}/`, p]));
    const index = buildSearchIndex().filter((r) => r.k === 'place');
    expect(index.length).toBe(places.size);
    for (const r of index) {
      const p = places.get(r.h)!;
      const allowed = new Set(normalize([p.kindLabel, p.kind, p.subkind ?? '', ...p.areaChain.map((a) => a.name)].join(' ')).split(' ').filter(Boolean));
      const extra = normalize(r.x).split(' ').filter((w) => w && !allowed.has(w));
      expect(extra, r.h).toEqual([]);
    }
  });
  it('a trip record names the region and the first base, not the subtitle', () => {
    for (const t of data.listTrips()) {
      const r = buildSearchIndex().find((x) => x.h === `/trips/${t.slug}/`)!;
      expect(r.x).toBe([t.region, t.firstBase ?? ''].join(' '));
    }
  });
  it('no record holds a URL, a sentence or a number of metres', () => {
    for (const r of buildSearchIndex()) {
      expect(`${r.n} ${r.s} ${r.x}`, r.h).not.toMatch(/https?:\/\/|\b\d[\d,.]*\s?(?:m|km|ft|mi|h)\b/i);
      expect(r.x.length, r.h).toBeLessThan(160);
    }
  });
  it('the split parts together hold the same records as the whole index', () => {
    const { parts } = buildSearchParts();
    const joined = Object.values(parts).flat().map((r) => r.h).sort();
    expect(joined).toEqual(buildSearchIndex().map((r) => r.h).sort());
  });
});

const OUT = path.join(WEB, 'out');

describe.skipIf(!existsSync(path.join(OUT, 'index.html')))('the built site holds no whole-catalogue file (principle P8)', () => {
  const files = existsSync(OUT) ? walkFiles(OUT) : [];
  const rel = (f: string) => path.relative(OUT, f).split(path.sep).join('/');

  it('has no places.json, trips.json, search-index.json or export-data file', () => {
    const bad = files.map(rel).filter((p) => /(^|\/)(places|trips)\.json$/.test(p) || /(^|\/)search-index\.json$/.test(p) || p.startsWith('export-data/'));
    expect(bad).toEqual([]);
  });
  it('every public data file is a search part or geography, and no search part is bigger than 48 KB', () => {
    const json = files.map(rel).filter((p) => p.endsWith('.json') && !p.startsWith('_next/') && !p.startsWith('globe/') && !p.startsWith('globe-data/')); // globe-data has its own limits in budget.test.ts
    for (const p of json) expect(p === 'search/manifest.json' || p === 'search/vocab.json' || /^search\/(trip|place|area)-[a-z]{2,4}\/data\.json$/.test(p), p).toBe(true);
    for (const p of json) expect(readFileSync(path.join(OUT, p)).length, p).toBeLessThan(48 * 1024);
  });
  it('a search file carries no content key', () => {
    for (const f of files.filter((x) => rel(x).startsWith('search/'))) {
      // vocab.json names URL filter keys (`stroller`, `effort`) as words of its table, so only its own fields are checked; its words are pinned by tests/search/vocab.test.ts
      const json = JSON.parse(readText(f));
      const keys = rel(f) === 'search/vocab.json' ? new Set(Object.keys(json)) : keysDeep(json);
      for (const k of CONTENT_KEYS) expect(keys.has(k), `${rel(f)} key ${k}`).toBe(false);
    }
  });
  it('the list pages ship rows with no content key in their payload', () => {
    for (const page of ['places/index.html', 'trips/index.html']) {
      const text = readText(path.join(OUT, page));
      const exempt = page.startsWith('places') ? BAND_NAMED_LIKE_CONTENT : [];
      for (const k of CONTENT_KEYS.filter((k) => !exempt.includes(k))) expect(new RegExp(`\\\\?"${k}\\\\?":`).test(text), `${page} has "${k}"`).toBe(false);
    }
    // the places payload may name `booking` only as the band: none, recommended, required or null
    const text = readText(path.join(OUT, 'places/index.html'));
    for (const m of text.matchAll(/\\?"booking\\?":(null|\\?"[^"\\]*\\?")/g)) expect(m[1]).toMatch(/^(null|\\?"(none|recommended|required)\\?")$/);
  });
  it('the globe page ships cards with a title, a kind and an area, not facts', () => {
    const text = readText(path.join(OUT, 'globe/index.html'));
    for (const k of ['facts', 'links', 'hazards', 'notes', 'summary', 'stats', 'elevation_m']) expect(new RegExp(`\\\\?"${k}\\\\?":`).test(text), `globe has "${k}"`).toBe(false);
  });
});
