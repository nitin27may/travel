import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import { FavouritesRow } from '@/components/mine/FavouritesRow';

// A Favourites row (mine-and-bar-spec 5.3, 9): a list row with the kind glyph, never a photo; the heart at the right removes; a page that
// is no longer listed keeps its name, is not a link and offers Remove.
const item = (o: Partial<FavItem> = {}): FavItem => ({
  space: 'place', slug: 'moraine-lake', ref: null, name: 'Moraine Lake', kind: 'lake', cc: 'CA', favouredAt: '2026-10-20T10:00:00.000Z', unlistedAt: null, ...o,
});
const html = (i: FavItem) => renderToStaticMarkup(<ul><FavouritesRow item={i} onRemove={() => undefined} /></ul>);

describe('FavouritesRow', () => {
  it('is one link to the page with its kind and country, and a pressed heart named for the page', () => {
    const h = html(item());
    expect(h).toMatch(/href="\/places\/moraine-lake\/?"/);
    expect(h).toContain('Moraine Lake');
    expect(h).toContain('Lake · Canada');
    expect(h).toContain('aria-label="Favourite Moraine Lake"');
    expect(h).toContain('aria-pressed="true"');
    expect(h).not.toContain('<img');
  });
  it('a trip links to its page and reads Trip', () => {
    const h = html(item({ space: 'trip', slug: 'dolomites-2027', name: 'Dolomites', kind: null, cc: 'IT' }));
    expect(h).toMatch(/href="\/trips\/dolomites-2027\/?"/);
    expect(h).toContain('Trip · Italy');
  });
  it('a withdrawn page is not a link, reads "No longer listed" and offers Remove instead of the heart', () => {
    const h = html(item({ unlistedAt: '2026-10-25T10:00:00.000Z' }));
    expect(h).not.toContain('<a ');
    expect(h).toContain('No longer listed');
    expect(h).toContain('aria-label="Moraine Lake, no longer listed"');
    expect(h).toContain('aria-label="Remove Moraine Lake"');
    expect(h).not.toContain('aria-pressed');
  });
});
