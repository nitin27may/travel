import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TripPark } from '@travel/core/schema/api/trip.ts';
import { ParkLines } from '@/components/trips/summary/ParkLines';
import { readParkLines } from '@/lib/export/printParks';

// PA-W: the Summary's park line (protected-area-entry 6.2, 6.4): core's sentence, the park's name first, a link only when the park has a page.
const park = (over: Partial<TripPark>): TripPark => ({
  slug: 'banff-national-park', name: 'Banff National Park', kind: 'national', parent: null, days: [3, 4, 5, 6, 9, 10, 11], nights: [], modes: ['day'], state: 'requirements',
  needs: [], coveredBy: 'Discovery Pass',
  line: 'Banff National Park, days 3 to 6 and 9 to 11: entry fee each day, or the Discovery Pass covers it (also Jasper, Yoho and Kootenay on this trip)', saving: null, ...over,
});

describe('ParkLines', () => {
  it('renders the spec sentence with the park name first and linked to its page', () => {
    const html = renderToStaticMarkup(<ParkLines parks={[park({})]} linkable={['banff-national-park']} />);
    expect(html).toContain('<a class="sum-park-link" href="/places/banff-national-park/">Banff National Park</a></b>, days 3 to 6 and 9 to 11: entry fee each day, or the Discovery Pass covers it (also Jasper, Yoho and Kootenay on this trip)');
    expect(html).toContain('<h2 id="sum-parks-h"');
  });
  it('does not link a park that has no page here, and says "Entry not checked yet" for a park nobody read', () => {
    const html = renderToStaticMarkup(<ParkLines parks={[park({ slug: null, state: 'not_checked', name: 'Kananaskis Lakes', line: 'Entry not checked yet for Kananaskis Lakes', days: [13] })]} />);
    expect(html).not.toContain('<a ');
    expect(html).toContain('data-state="not_checked"');
    expect(html).toContain('Entry not checked yet for Kananaskis Lakes');
  });
  it('shows a saving line only when core gave one, and nothing at all for a trip with no parks', () => {
    expect(renderToStaticMarkup(<ParkLines parks={[park({ saving: 'For 10 park days, the Discovery Pass is likely cheaper than the daily entry fee (family price)' })]} />)).toContain('likely cheaper than the daily entry fee (family price).');
    expect(renderToStaticMarkup(<ParkLines parks={[park({})]} />)).not.toContain('sum-park-saving');
    expect(renderToStaticMarkup(<ParkLines parks={[]} />)).toBe('');
  });
  it('reads no park lines outside a page', () => {
    expect(readParkLines('canadian-rockies-2029')).toEqual([]);
  });
});
