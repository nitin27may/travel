import { describe, expect, it } from 'vitest';
import { dedupeMapPoints, labelledIds } from '@/components/places/mapPoints';
import type { PlaceMapPoint } from '@/components/places/PlaceMap';

const pt = (id: string, style: PlaceMapPoint['style'], lat: number, lng: number): PlaceMapPoint => ({ id, style, at: { lat, lng }, label: id });

describe('place map points', () => {
  it('drops the destination pin when the trailhead is the same spot (Tre Cime)', () => {
    const out = dedupeMapPoints([pt('trailhead', 'trailhead', 46.61203, 12.29648), pt('parking-0', 'parking', 46.61285, 12.29267), pt('place', 'place', 46.61203, 12.29648)]);
    expect(out.map((p) => p.id)).toEqual(['trailhead', 'parking-0']);
  });
  it('keeps a destination that is elsewhere', () => {
    const out = dedupeMapPoints([pt('trailhead', 'trailhead', 46.69898, 12.08554), pt('place', 'place', 46.6946, 12.0853)]);
    expect(out.map((p) => p.id)).toEqual(['trailhead', 'place']);
  });
  it('names only the trailhead when the selected pin sits within 250 m of it (Braies P4 and the hotel)', () => {
    const pts = [pt('trailhead', 'trailhead', 46.69898, 12.08554), pt('parking-0', 'parking', 46.70039, 12.0847), pt('parking-3', 'parking', 46.70059, 12.08572)];
    expect([...labelledIds(pts, 'parking-0')].sort()).toEqual(['trailhead']);
  });
  it('names the selected pin and the trailhead when they are far apart, and just the trailhead with no selection', () => {
    const pts = [pt('trailhead', 'trailhead', 46.0, 12.0), pt('parking-0', 'parking', 46.01, 12.0)];
    expect([...labelledIds(pts, 'parking-0')].sort()).toEqual(['parking-0', 'trailhead']);
    expect([...labelledIds(pts)]).toEqual(['trailhead']);
  });
});

import { stackParking } from '@/components/places/mapPoints';
describe('stacked car parks', () => {
  it('snaps car parks within 180 m onto the first, leaves far ones and non-parking alone', () => {
    const pts = [pt('trailhead', 'trailhead', 46.0, 12.0), pt('p0', 'parking', 46.0001, 12.0), pt('p1', 'parking', 46.0004, 12.0), pt('p2', 'parking', 46.01, 12.0)];
    const out = stackParking(pts);
    expect(out[1].at).toEqual(pts[1].at);
    expect(out[2].at).toEqual(pts[1].at);
    expect(out[3].at).toEqual(pts[3].at);
    expect(out[0].at).toEqual(pts[0].at);
  });
});
