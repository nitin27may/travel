import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OwnActions } from '@/components/trips/edit/shell/OwnActions';
import { builtExportOf } from '@/lib/export/ownState';
import { BUILT_KEY, BUILT_SHARE_TITLE } from '@/lib/trip-edit/built';

vi.mock('next/dynamic', () => ({ default: () => () => <button type="button">Export trip</button> }));

// Review STEP2-ES: Share hands over the public trip, never the person's own title (ES-007); a built trip has no public slug, so its
// private id never goes into a request path or a shared link (ES-008): STEP2-B2 offers Export from a model made on the device and Share
// with the builder's public keys, under a generic title.
const noop = () => undefined;
const base = { onEdit: noop, onCalendar: null, onAddDates: noop };

describe('the own-trip cover actions', () => {
  it('shares the public trip under its public title', () => {
    const html = renderToStaticMarkup(<OwnActions {...base} slug="canadian-rockies-2029" shareTitle="Canadian Rockies" url="https://example.test/trips/canadian-rockies-2029/" />);
    expect(html).toContain('aria-label="Share Canadian Rockies"');
    expect(html).toContain('Export trip');
  });
  it('a built trip: Export from the device model, Share with the builder keys under the generic title', () => {
    const device = builtExportOf({ id: BUILT_KEY, title: 'Rockies with Emma', origin: 'https://example.test', nights: 2, days: [] });
    const html = renderToStaticMarkup(<OwnActions {...base} slug={null} shareTitle={BUILT_SHARE_TITLE} url="https://example.test/plan/?m=trip&cc=CA" device={device} />);
    expect(html).toContain('Export trip');
    expect(html).toContain('aria-label="Share Trip plan"');
    expect(html).not.toContain('Emma');
    // a private address is never shared
    const priv = renderToStaticMarkup(<OwnActions {...base} slug={null} shareTitle="Trip plan" url="https://example.test/t/6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b/" device={device} />);
    expect(priv).not.toContain('Share');
  });
  it('offers no Export and no Share without a public slug or a device model', () => {
    const html = renderToStaticMarkup(<OwnActions {...base} slug={null} shareTitle="Trip" url={null} />);
    expect(html).not.toContain('Share');
    expect(html).not.toContain('Export trip');
    expect(html).toContain('Edit trip');
  });
  it('the shell passes the public title and never this page\'s address', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../components/trips/edit/shell/TripShell.tsx', import.meta.url), 'utf8');
    expect(src).toContain('shareTitle={slug ? (ourTitle');
    expect(src).not.toMatch(/OwnActions[^>]*title=\{title\}/);
    expect(src).not.toContain('location.href');
  });
});
