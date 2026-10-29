import { describe, expect, it } from 'vitest';
import { allTrailsLink, appleMapsUrl, directionsUrl, formatPoint, komootSearchUrl, osmElementUrl, osmPointUrl, searchUrl } from '@/lib/map/links';

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

  it('gives AllTrails as the stored page when the record has one, else a labelled search from name and area', () => {
    const direct = allTrailsLink({ name: 'Fenland Loop', links: [{ kind: 'alltrails', url: 'https://www.alltrails.com/trail/canada/alberta/fenland-trail' }] });
    expect(direct).toEqual({ url: 'https://www.alltrails.com/trail/canada/alberta/fenland-trail', direct: true, label: 'Open on AllTrails', text: 'Open trail page' });
    const search = allTrailsLink({ name: 'Tre Cime di Lavaredo loop', area: 'Belluno', links: [{ kind: 'official', url: 'https://example.test/' }] });
    expect(search).toEqual({ url: 'https://www.alltrails.com/search?q=Tre+Cime+di+Lavaredo+loop+Belluno', direct: false, label: 'Search AllTrails', text: 'Search for this trail' });
    expect(allTrailsLink({ name: 'Wilcox Pass' }).url).toBe('https://www.alltrails.com/search?q=Wilcox+Pass');
  });
  it('ignores an alltrails link that is not an AllTrails page', () => {
    expect(allTrailsLink({ name: 'X', links: [{ kind: 'alltrails', url: 'https://evil.test/alltrails.com/x' }] }).direct).toBe(false);
  });
  it('builds a Komoot search link', () => {
    expect(komootSearchUrl('Wilcox Pass', 'Banff')).toBe('https://www.komoot.com/discover?q=Wilcox+Pass+Banff');
  });
});

describe('OpenStreetMap links (LT-M): made at read time, never stored', () => {
  it('points at a stored element id, and only at a well-formed one', () => {
    expect(osmElementUrl('node/123')).toBe('https://www.openstreetmap.org/node/123');
    expect(osmElementUrl('relation/44741')).toBe('https://www.openstreetmap.org/relation/44741');
    for (const bad of [null, undefined, '', 'way/', 'way/x', 'node/12/../x', 'https://evil.test/node/1', 'Way/1']) expect(osmElementUrl(bad as never), String(bad)).toBeNull();
  });
  it('marks our point at zoom 17 with 5-decimal coordinates and no key', () => {
    expect(osmPointUrl({ lng: 12.0853612, lat: 46.6942149 })).toBe('https://www.openstreetmap.org/?mlat=46.69421&mlon=12.08536#map=17/46.69421/12.08536');
  });
});
