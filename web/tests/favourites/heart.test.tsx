import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavouriteHeart } from '@/lib/favourites/heart';
import { setSession } from '@/lib/favourites/light';
import { FAV_KEY } from '@/lib/mine/keys';

// The heart's markup (mine-and-bar-spec 6, 9): one fixed name with aria-pressed, never a name that flips; the glyph is decorative.
const stub = (raw: string | null) => vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === FAV_KEY ? raw : null) } });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  setSession([]);
});
const html = () => renderToStaticMarkup(<FavouriteHeart space="place" slug="moraine-lake" name="Moraine Lake" />);

describe('FavouriteHeart', () => {
  it('is a toggle button named "Favourite <name>", not pressed at rest, with the glyph hidden from readers', () => {
    stub(null);
    const h = html();
    expect(h).toContain('aria-label="Favourite Moraine Lake"');
    expect(h).toContain('aria-pressed="false"');
    expect(h).toContain('title="Favourite"');
    expect(h).toContain('type="button"');
    expect(h).toContain('aria-hidden="true"');
    expect(h).not.toMatch(/Add .* to favourites|Remove .* from favourites/);
  });
  it('keeps the same name and reports pressed when the page is a favourite', () => {
    stub(JSON.stringify({ schema: 'favourites/1', items: [{ space: 'place', slug: 'moraine-lake' }] }));
    const h = html();
    expect(h).toContain('aria-label="Favourite Moraine Lake"');
    expect(h).toContain('aria-pressed="true"');
  });
  it('a trip with the same slug is a different page', () => {
    stub(JSON.stringify({ schema: 'favourites/1', items: [{ space: 'trip', slug: 'moraine-lake' }] }));
    expect(html()).toContain('aria-pressed="false"');
  });
  it('renders nothing when the flag is off (NEXT_PUBLIC_FAVOURITES=0)', async () => {
    vi.stubEnv('NEXT_PUBLIC_FAVOURITES', '0');
    vi.resetModules();
    stub(null);
    const m = await import('@/lib/favourites/heart');
    expect(renderToStaticMarkup(<m.FavouriteHeart space="place" slug="a" name="A" />)).toBe('');
    const f = await import('@/lib/favourites/flag');
    expect(f.FAVOURITES_ON).toBe(false);
  });
});
