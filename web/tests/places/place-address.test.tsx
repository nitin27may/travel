import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlacePage } from '@/components/places/PlacePage';
import { createPublicData } from '@/lib/public';
import type { PublicPlace } from '@/lib/public/types';
import { addressClipboard, type PageAddress } from '@/lib/public/address';

// LT-M: the Directions card shows the address of its target, with a Copy button, and the OpenStreetMap and official-map buttons where the record
// holds them. The place objects are patched in memory: no record in data/ holds an address yet.
const data = createPublicData();
const render = (place: PublicPlace): string => {
  const district = place.areaChain.find((a) => a.level === 'district');
  const inside = data.listPlaces().filter((c) => c.slug !== place.slug && c.areaChain.find((a) => a.level === 'district')?.slug === district?.slug).slice(0, 8);
  return renderToString(<PlacePage place={place} inside={inside} url={`https://example.test/places/${place.slug}/`} />).replace(/<!-- -->/g, '');
};
const card = (html: string): string => html.slice(html.indexOf('id="h-dir"'), html.indexOf('</section>', html.indexOf('id="h-dir"')));
const patch = (slug: string, sections: Record<string, unknown>): PublicPlace => {
  const p = data.getPlace(slug)!;
  return { ...p, sections: { ...p.sections!, ...sections } as never };
};
const addr = (over: Partial<PageAddress> = {}): PageAddress => ({ ref: 'x', name: 'X', kind: 'postal', lines: ['224 Banff Avenue'], locality: 'Banff', postcode: 'T1L 1A3', ...over });

// a place reached by its own point (a door place), one reached through an access record (no car park of its own), one with a car park of the older data
const own = data.getPlace('athabasca-falls')!;
const via = data.getPlace('bow-lake')!;
const legacy = data.getPlace('adolf-munkel-weg')!;

describe('the Directions card: address (LT-M)', () => {
  it('shows nothing new on a place with no address data', () => {
    const c = card(render(own));
    expect(c).not.toContain('pl-addr');
    expect(c).not.toContain('Copy address');
    expect(c).not.toContain('OpenStreetMap');
    expect(c).toContain('Google Maps directions');
    expect(c).toContain('Apple Maps');
  });
  it('a door place: the postal address under "To <place>", with a Copy address button that names the place', () => {
    const c = card(render(patch('athabasca-falls', { address: addr({ ref: own.sections!.ref, name: own.name }) })));
    expect(c).toContain('<span class="sr-only">Address: </span>224 Banff Avenue, Banff, T1L 1A3');
    expect(c).toContain(`aria-label="Copy the address and map point of ${own.name}"`);
    expect(c).toContain('Copy address and point');
    expect(c.indexOf('To <strong>')).toBeLessThan(c.indexOf('pl-addr'));
    expect(c.indexOf('pl-addr')).toBeLessThan(c.indexOf('pl-dir-links'));
    expect(c).not.toContain(`<strong>${own.name}: </strong>`);
  });
  it('a nearest-road address reads "Near <road>, <locality>"', () => {
    const c = card(render(patch('athabasca-falls', { address: addr({ ref: own.sections!.ref, name: own.name, kind: 'nearest_road', lines: ['Icefields Parkway'], locality: 'Jasper', postcode: null }) })));
    expect(c).toContain('Near Icefields Parkway, Jasper');
  });
  it('PR-013: Copy address copies the words as shown, "Near" kept, and the point the card goes to on a second line', () => {
    const html = render(patch('athabasca-falls', { address: addr({ ref: own.sections!.ref, name: own.name, kind: 'nearest_road', lines: ['Icefields Parkway'], locality: 'Jasper', postcode: null }) }));
    const text = addressClipboard({ kind: 'nearest_road', lines: ['Icefields Parkway'], locality: 'Jasper', postcode: null }, { lat: 52.66, lon: -117.88 });
    expect(text).toBe('Near Icefields Parkway, Jasper\n52.66000, -117.88000');
    expect(card(html)).toContain('Near Icefields Parkway, Jasper');
  });
  it('a natural place with no car park of its own shows the address of the access point the card goes to', () => {
    const dir = via.sections!.directions as { mode: 'drive'; ref: string; name: string };
    expect(dir.mode).toBe('drive');
    const c = card(render(patch('bow-lake', { address: addr({ ref: dir.ref, name: dir.name, kind: 'nearest_road', lines: ['Icefields Parkway'], locality: 'Lake Louise', postcode: null }) })));
    expect(c).toContain('Near Icefields Parkway, Lake Louise');
    expect(c).toContain(`To <strong>${dir.name}</strong>`);
    expect(c).not.toContain(`<strong>${dir.name}: </strong>`);
  });
  it('an address that belongs to another record than the target names whose it is', () => {
    const c = card(render(patch('adolf-munkel-weg', { address: addr({ ref: legacy.sections!.ref, name: 'Rifugio Genova' }) })));
    expect(c).toContain('<strong>Rifugio Genova: </strong>');
  });
  it('the OpenStreetMap button is the stored element for a place\'s own point, else the point on the map; an official map sheet is a button', () => {
    const el = card(render(patch('athabasca-falls', { osmRef: 'way/4242' })));
    expect(el).toContain('href="https://www.openstreetmap.org/way/4242"');
    expect(el).not.toContain('pl-addr');
    const pt = card(render(patch('bow-lake', { osmRef: 'way/4242', address: addr({ ref: 'x' }) })));
    expect(pt).toMatch(/href="https:\/\/www\.openstreetmap\.org\/\?mlat=-?[\d.]+&amp;mlon=-?[\d.]+#map=17\/-?[\d.]+\/-?[\d.]+"/);
    const sheet = card(render(patch('athabasca-falls', { mapSheet: 'https://example.test/sheet.pdf' })));
    expect(sheet).toContain('href="https://example.test/sheet.pdf"');
    expect(sheet).toContain('Official map<span class="sr-only"> (opens in a new tab)</span>');
    expect(sheet).toContain('OpenStreetMap');
  });
  it('names no link-only platform in the card', () => {
    const c = card(render(patch('athabasca-falls', { osmRef: 'way/4242', mapSheet: 'https://example.test/sheet.pdf', address: addr({ ref: own.sections!.ref }) })));
    expect(c).not.toMatch(/alltrails|komoot|gaia|outdooractive|wikiloc|strava|tripadvisor/i);
  });
  it('no page says "Not checked yet" about an address at rest', () => {
    for (const p of [own, via, legacy]) expect(render(p)).not.toMatch(/Not checked yet:[^<]*address/i);
  });
});
