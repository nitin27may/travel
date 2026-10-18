import { afterEach, describe, expect, it } from 'vitest';
import { FakeGoogle } from '@/lib/map/fake-google';
import { embedUrl } from '@/lib/map/google-embed/url';
import { loadGoogleMaps, setGoogleLoader } from '@/lib/map/google-js/loader';
import { primaryPin } from '@/lib/map/primary';
import type { Pin } from '@/lib/map/types';

const pins: Pin[] = [
  { id: 'p', at: { lng: 12.08, lat: 46.69 }, style: 'parking', label: 'Parking' },
  { id: 't', at: { lng: 12.09, lat: 46.7 }, style: 'trailhead', label: 'Trailhead' },
];

describe('Google families without a key', () => {
  afterEach(() => setGoogleLoader(null));

  it('picks the trailhead as the primary point, or the selected pin', () => {
    expect(primaryPin({ pins })?.id).toBe('t');
    expect(primaryPin({ pins, selectedId: 'p' })?.id).toBe('p');
  });
  it('builds a place embed URL from our stored point', () => {
    expect(embedUrl('fake-key', { pins })).toBe('https://www.google.com/maps/embed/v1/place?key=fake-key&q=46.70000,12.09000&zoom=14');
  });
  it('builds a view embed URL when the page sets a camera', () => {
    const u = embedUrl('fake-key', { pins, camera: { lng: 12.1, lat: 46.5, zoom: 10.4 } });
    expect(u).toBe('https://www.google.com/maps/embed/v1/view?key=fake-key&center=46.50000,12.10000&zoom=10');
  });
  it('returns null with nothing to show', () => {
    expect(embedUrl('k', { pins: [] })).toBeNull();
  });
  it('loads through the injected FakeGoogle and records the map calls', async () => {
    const fake = new FakeGoogle();
    setGoogleLoader(fake.loader());
    const g = await loadGoogleMaps({ key: 'fake-key' });
    expect(fake.loads).toBe(1);
    const m = new g.Map(document_stub(), { center: { lat: 1, lng: 2 }, zoom: 7 });
    m.panTo({ lat: 3, lng: 4 });
    m.setZoom(12);
    new g.marker.AdvancedMarkerElement({ map: m, position: { lat: 3, lng: 4 } });
    new g.Polyline({ path: [{ lat: 0, lng: 0 }], strokeWeight: 2 });
    expect(fake.calls.map((c) => c.fn)).toEqual(['Map', 'panTo', 'setZoom', 'AdvancedMarkerElement', 'Polyline']);
    expect(m.getZoom()).toBe(12);
    expect(fake.markers).toHaveLength(1);
  });
});

function document_stub(): HTMLElement { return {} as HTMLElement; }
