import { describe, expect, it } from 'vitest';
import { privacyHits } from '@travel/core/privacy/detect.ts';
import { placeDetail } from '@travel/core/schema/api/place.ts';
import { respond } from '@/lib/server/respond';
import { jsonTarget } from './targets';

// LT-M: the place detail carries the Directions target's address, the OpenStreetMap element and the official map sheet, and only there: the
// list row has no such key (P8). The contract kit covers the real data; this plants an address in memory.
const { source } = jsonTarget();
// a place whose own detail is clean today, so a failure here is the address and nothing else
const slug = source.placeRows.find((r) => {
  const d = source.placeDetail(r.slug);
  return !!d?.sections && placeDetail.safeParse(d).success && privacyHits(d).length === 0;
})!.slug;
const ADDRESS = { ref: 'place/lake-louise', name: 'Lake Louise lakeshore car park', kind: 'postal', lines: ['224 Banff Avenue'], locality: 'Banff', postcode: 'T1L 1A3' };
const planted = (extra: Record<string, unknown>) => {
  const d = source.placeDetail(slug)!;
  return { ...d, sections: { ...d.sections!, ...extra } };
};
const REV = 'a'.repeat(64);
const store = (detail: unknown) => ({ revision: async () => REV, getPlace: async () => ({ ok: true, data: detail, revision: REV }) }) as never;
const get = () => respond('getPlace', new Request(`http://api.test/api/v1/places/${slug}/`), { slug }, store(planted({ address: ADDRESS, osmRef: 'way/4242', mapSheet: 'https://example.test/sheet.pdf' })));

describe('/api/v1/places/<slug>: address', () => {
  it('the detail schema accepts address, osmRef and mapSheet, and a detail without them (they are optional)', () => {
    expect(placeDetail.safeParse(planted({ address: ADDRESS, osmRef: 'way/4242', mapSheet: 'https://example.test/sheet.pdf' })).success).toBe(true);
    expect(placeDetail.safeParse(source.placeDetail(slug)).success).toBe(true);
  });
  it('refuses a malformed address or element id', () => {
    for (const bad of [{ address: { ...ADDRESS, kind: 'hq' } }, { address: { ...ADDRESS, lines: [] } }, { address: { ...ADDRESS, extra: 1 } }, { osmRef: 'way/x' }]) expect(placeDetail.safeParse(planted(bad)).success, JSON.stringify(bad)).toBe(false);
  });
  it('is served: the privacy net knows the typed address and does not take it for a household\'s', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.sections.address).toMatchObject({ kind: 'postal', locality: 'Banff', postcode: 'T1L 1A3' });
    expect(body.sections.osmRef).toBe('way/4242');
  });
  it('the list row has no address (P8): the row keys are the contract\'s, address among none of them', () => {
    expect(Object.keys(source.placeRows[0]!)).not.toContain('address');
    expect(JSON.stringify(source.placeRows)).not.toMatch(/"address"|"osmRef"|"mapSheet"/);
  });
});
