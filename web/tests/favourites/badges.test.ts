import { describe, expect, it } from 'vitest';
import { handleOfPath } from '@/lib/favourites/badges';

// A card carries no heart markup of its own: the badge finds its page from the card's own link (spec 6, D9).
describe('handleOfPath', () => {
  it('maps a place and a trip link to the device handle', () => {
    expect(handleOfPath('/places/lago-di-braies/')).toBe('place:lago-di-braies');
    expect(handleOfPath('/places/lago-di-braies')).toBe('place:lago-di-braies');
    expect(handleOfPath('/trips/dolomites-2027/')).toBe('trip:dolomites-2027');
  });
  it('ignores links that are not a place or a trip page', () => {
    for (const p of ['/places/', '/trips/', '/globe/place/x/', '/places/a/b/', '/mine/', '/', '/places/%E0%A4%A/']) expect(handleOfPath(p), p).toBeNull();
  });
});
