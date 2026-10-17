import { describe, expect, it } from 'vitest';
import { loadPlaces } from '@/lib/data/places';
import { loadListedTrips } from '@/lib/data/trips';
import { PLACE_VIEW_FIELDS, TRIP_VIEW_FIELDS, entityView, placeView, tripView } from '@/lib/views/places';

describe('entity-view/1 allow-list', () => {
  it('writes exactly the listed place keys, whatever the loader read', () => {
    const rows = loadPlaces();
    const polluted = { ...rows[0], height_cm: 137, screenshot: 'locations/inbox/x.png', secret: 'nope' } as unknown as typeof rows[0];
    const out = placeView(polluted);
    expect(Object.keys(out).sort()).toEqual([...PLACE_VIEW_FIELDS].sort());
    expect(JSON.stringify(out)).not.toContain('nope');
    expect(JSON.stringify(out)).not.toContain('inbox');
  });

  it('writes only type, url and post date for a source, and only id and label for a tag', () => {
    const withSource = loadPlaces().find((p) => p.sources.length)!;
    const polluted = { ...withSource, sources: [{ ...withSource.sources[0], screenshot: 'inbox/a.png', note: 'private' }], tags: [{ id: 'a', label: 'A', alias_of: 'b' }] } as unknown as typeof withSource;
    const out = placeView(polluted);
    expect(Object.keys(out.sources[0]).sort()).toEqual(['post_date', 'type', 'url']);
    expect(Object.keys(out.tags[0]).sort()).toEqual(['id', 'label']);
  });

  it('publishes only the allow-listed stat keys', () => {
    const stats = loadPlaces().flatMap((p) => Object.keys(p.stats));
    for (const k of stats) expect(['km', 'gain_m', 'hours', 'minutes', 'level', 'miles']).toContain(k);
  });

  it('wraps rows in the entity-view/1 envelope', () => {
    const doc = entityView(loadPlaces().map(placeView), '2026-10-17');
    expect(doc.schema).toBe('entity-view/1');
    expect(doc.generated).toBe('2026-10-17');
    expect(doc.rows).toHaveLength(64);
  });

  it('trip rows carry only the listed keys', () => {
    for (const t of loadListedTrips()) expect(Object.keys(tripView(t)).sort()).toEqual([...TRIP_VIEW_FIELDS].sort());
  });
});
