import { describe, expect, it } from 'vitest';
import { appleMapsUrl, directionsUrl, formatPoint, searchUrl } from '@/lib/map/links';

const braies = { lng: 12.08536, lat: 46.69421 };

describe('map links are built from our stored point', () => {
  it('builds a Google directions URL with 5-decimal coordinates and no key', () => {
    const u = directionsUrl({ lng: 12.0853612, lat: 46.6942149 });
    expect(u).toBe('https://www.google.com/maps/dir/?api=1&destination=46.69421,12.08536&travelmode=driving');
    expect(u).not.toMatch(/key=/);
  });
  it('adds an origin and a travel mode', () => {
    const u = directionsUrl(braies, { from: { lng: 12.2, lat: 46.5 }, mode: 'walking' });
    expect(u).toContain('travelmode=walking');
    expect(u).toContain('origin=46.50000,12.20000');
  });
  it('searches by point, or by name plus place id', () => {
    expect(searchUrl('Lago di Braies', braies)).toBe('https://www.google.com/maps/search/?api=1&query=46.69421,12.08536');
    const withId = searchUrl('Lago di Braies', braies, 'ChIJabc');
    expect(withId).toContain('query=Lago+di+Braies');
    expect(withId).toContain('query_place_id=ChIJabc');
  });
  it('builds an Apple Maps URL, driving or walking', () => {
    expect(appleMapsUrl(braies)).toBe('https://maps.apple.com/?daddr=46.69421,12.08536&dirflg=d');
    expect(appleMapsUrl(braies, 'Lago di Braies', 'w')).toBe('https://maps.apple.com/?daddr=46.69421,12.08536&dirflg=w&q=Lago+di+Braies');
  });
  it('writes a point as lat, lng', () => {
    expect(formatPoint(braies)).toBe('46.69421,12.08536');
  });
});
