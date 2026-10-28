import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OwnActions } from '@/components/trips/edit/shell/OwnActions';

vi.mock('next/dynamic', () => ({ default: () => () => <button type="button">Export trip</button> }));

// Review STEP2-ES: Share hands over the public trip, never the person's own title (ES-007); a built trip has no public slug, so it
// offers no Export or Share and its private id never goes into a request path or a shared link (ES-008).
const noop = () => undefined;
const base = { onEdit: noop, onCalendar: null, onAddDates: noop };

describe('the own-trip cover actions', () => {
  it('shares the public trip under its public title', () => {
    const html = renderToStaticMarkup(<OwnActions {...base} slug="canadian-rockies-2029" shareTitle="Canadian Rockies" url="https://example.test/trips/canadian-rockies-2029/" />);
    expect(html).toContain('aria-label="Share Canadian Rockies"');
    expect(html).toContain('Export trip');
  });
  it('offers no Export and no Share on a built trip (no public slug)', () => {
    const html = renderToStaticMarkup(<OwnActions {...base} slug={null} shareTitle="Trip" url={null} />);
    expect(html).not.toContain('Share');
    expect(html).not.toContain('Export trip');
    expect(html).toContain('Edit trip');
  });
  it('the shell passes the public title and never this page\'s address', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../components/trips/edit/shell/TripShell.tsx', import.meta.url), 'utf8');
    expect(src).toContain('shareTitle={ourTitle');
    expect(src).not.toMatch(/OwnActions[^>]*title=\{title\}/);
    expect(src).not.toContain('location.href');
  });
});
