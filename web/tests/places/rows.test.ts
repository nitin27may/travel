import { describe, expect, it } from 'vitest';
import { loadPlaces } from '@/lib/data/places';
import { createPublicData } from '@/lib/public';
import { placeRows } from './support';

const rows = placeRows();
const data = createPublicData();

describe('place list rows', () => {
  it('has one row per public place, with unique slugs as ids', () => {
    expect(rows).toHaveLength(data.listPlaces().length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.every((r) => r.id === r.slug)).toBe(true);
  });
  it('joins the saved places with their legacy source types and tags', () => {
    const saved = rows.filter((r) => r.legacyKind !== null);
    expect(saved).toHaveLength(loadPlaces().length);
    expect(saved.some((r) => r.sourceTypes.length > 0)).toBe(true);
    expect(saved.some((r) => r.tags.length > 0)).toBe(true);
  });
  it('carries no personal status on a row', () => {
    for (const r of rows) expect(Object.keys(r)).not.toContain('status');
    expect(JSON.stringify(rows)).not.toMatch(/"status"/);
  });
  it('names the public trips a place is used in', () => {
    expect(rows.some((r) => r.trips.length > 0)).toBe(true);
    for (const r of rows) for (const t of r.trips) expect(t.slug.length).toBeGreaterThan(0);
  });
  it('lists every kind in the data, each with a label', () => {
    const kinds = new Set(rows.map((r) => r.kind));
    for (const k of ['trail', 'lake', 'viewpoint', 'waterfall', 'sight', 'town', 'area', 'activity', 'lift', 'eatery']) expect(kinds.has(k as never)).toBe(true);
    expect(rows.every((r) => r.kindLabel.length > 0)).toBe(true);
  });
  it('shows no private trip name on any place row', () => {
    const privateTitles = data.internals.trips.filter((t) => t.visibility !== 'public').map((t) => t.title.toLowerCase());
    for (const r of rows) {
      const text = JSON.stringify(r).toLowerCase();
      for (const t of privateTitles) expect(text).not.toContain(t);
    }
  });
  it('carries the honesty markers the cards show, and a completeness label on every row', () => {
    const unconfirmed = rows.filter((r) => r.honesty.some((h) => h.id === 'location_unconfirmed')).map((r) => r.slug);
    for (const s of ['lago-di-braies', 'monte-piana', 'viel-dal-pan', 'alpe-di-siusi', 'cascate-di-fanes', 'seceda-ridge', 'lago-dantorno']) expect(unconfirmed).toContain(s);
    expect(rows.every((r) => r.completeness.label.length > 0)).toBe(true);
  });
  it('serialises to plain JSON (it crosses the server-client boundary)', () => {
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
  });
});
