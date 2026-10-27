import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { CopyRow } from '@/components/mine/CopyRow';
import { rowModel } from '@/lib/mine/rows';
import { thumbOf } from '@/lib/mine/thumb';

// MINE-T: a Mine row's thumbnail is our own rendition, or nothing (the type icon stays); never a Commons URL.
describe('thumbOf', () => {
  it('turns one of our renditions into a 320/640 pair', () => {
    const t = thumbOf('/img/abc123-640.webp');
    expect(t?.src).toBe('/img/abc123-320.webp');
    expect(t?.srcSet).toBe('/img/abc123-320.webp 320w, /img/abc123-640.webp 640w');
  });
  it('is no photo for null, empty, or any URL that is not ours', () => {
    expect(thumbOf(null)).toBeNull();
    expect(thumbOf('')).toBeNull();
    expect(thumbOf('https://upload.wikimedia.org/x/a.jpg')).toBeNull();
    expect(thumbOf('https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg?width=640')).toBeNull();
  });
});

const item: CopyItem = {
  id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: '/img/abc123-640.webp', start: '2027-07-03',
  adults: 2, children: [], profile: null, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
};
const noop = () => undefined;
const html = (i: CopyItem, unlisted = false) =>
  renderToStaticMarkup(<ul><CopyRow row={rowModel(i, '2026-10-25')} unlisted={unlisted} onCalendar={noop} onPrint={noop} onChangeDates={noop} onRemove={noop} /></ul>);

describe('a My trips row photo', () => {
  it('is a decorative, lazy, fixed-size image from our rendition', () => {
    const h = html(item);
    expect(h).toMatch(/<img [^>]*src="\/img\/abc123-320\.webp"/);
    expect(h).toContain('alt=""');
    expect(h).toContain('loading="lazy"');
    expect(h).toContain('width="56"');
    expect(h).toContain('height="42"');
    expect(h).not.toMatch(/wikimedia/);
  });
  it('keeps the icon when there is no photo, and for a trip no longer listed', () => {
    expect(html({ ...item, photo: null })).not.toContain('<img');
    expect(html(item, true)).not.toContain('<img');
  });
});
