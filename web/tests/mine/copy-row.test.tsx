import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { CopyRow } from '@/components/mine/CopyRow';
import { rowModel } from '@/lib/mine/rows';

const item: CopyItem = {
  id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03',
  adults: 2, children: [6], profile: null, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
};
const noop = () => undefined;
const props = { onCalendar: noop, onPrint: noop, onChangeDates: noop, onRemove: noop };
const html = (o: { unlisted?: boolean; chip?: boolean } = {}) => renderToStaticMarkup(<ul><CopyRow row={rowModel(item, '2026-10-25')} {...props} {...o} /></ul>);

describe('a My trips row', () => {
  it('is one link named with its date, countdown, length and party, and has a menu button named for the trip', () => {
    const h = html();
    expect(h).toMatch(/href="\/trips\/dolomites-2027\/?\?p=family-6"/);
    expect(h).toContain('aria-label="Dolomites, from Sat 3 Jul 2027, in 251 days, 14 days, 2 adults, 1 child"');
    expect(h).toContain('aria-label="Actions for Dolomites"');
    expect(h).not.toContain('On this device');
  });
  it('draws the chip only when asked (signed in)', () => {
    expect(html({ chip: true })).toContain('On this device');
  });
  it('a trip no longer listed is not a link and offers Remove, never silently dropped', () => {
    const h = html({ unlisted: true });
    expect(h).toContain('No longer listed');
    expect(h).toContain('aria-label="Remove Dolomites"');
    expect(h).not.toContain('<a ');
    expect(h).not.toContain('Actions for');
  });
});

describe('the signed-in chip', () => {
  it('sits inside the row link, in the grid, as a fourth line (never absolutely placed)', () => {
    const h = html({ chip: true });
    expect(h).toMatch(/<a [^>]*data-chip[^>]*>.*On this device<\/span><\/a>/);
  });
});
