// MUST-5: the print view prints what the page shows. Times are the scheduler's for the profile on the page, the version is the chosen one,
// "Lane" never appears, and "Not checked yet" is kept for a missing fact, not for every stop with no time.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { TripPrintView, profileLine } from '@/components/actions/TripPrintView';
import { buildTripExport } from '@/lib/export/build.server';
import type { TimelineSession } from '@/lib/export/timelineState';
import { getTrip } from '@/lib/public';

const trip = getTrip('dolomites-2027')!;
const model = buildTripExport(trip);
const profile: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 6 };
const session: TimelineSession = {
  slug: trip.slug, profile, defaults: DEFAULT_PROFILE, overrides: {}, added: [],
  timelines: scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile), sunPoints: {},
};
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('the print view', () => {
  const html = renderToStaticMarkup(TripPrintView({ data: model, session }));
  it('says who the plan is for, as the page says it', () => {
    expect(profileLine(profile)).toBe('Family, 6 · Standard');
    expect(html).toContain('Planned for Family, 6 · Standard');
  });
  it('prints the timeline\'s time for each stop of day 3, in the timeline\'s order', () => {
    const day3 = session.timelines.find((t) => t.day === 3)!.entries.filter((e) => ['visit', 'trail'].includes(e.kind) && !e.insideOf);
    expect(day3.length).toBeGreaterThan(0);
    const section = html.split('<section').find((s) => s.includes('Day 3:'))!;
    const printed = [...section.matchAll(/<li><b>(\d\d:\d\d) · <\/b>([^<]+)/g)].map((m) => [m[1], m[2]]);
    expect(printed.map((r) => r[0])).toEqual(day3.map((e) => e.start));
    day3.forEach((e, i) => expect(printed[i]![1]).toContain(e.title.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')));
  });
  it('never says Lane, prints no gap marker on a stop, and at most one link per stop', () => {
    expect(html).not.toMatch(/Lane [ABC]/);
    expect(text(html)).not.toMatch(/Not checked yet\|? ?· /);
    for (const li of html.split('<li>').slice(1)) expect((li.match(/class="print-model-link"/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  it('credits the source and no map data it does not print', () => {
    expect(html).toContain('Source: Trip Plans');
    expect(html).not.toContain('OpenStreetMap');
  });
  it('without the page\'s timeline it lists the stops untimed, with no gap marker per stop', () => {
    const plain = renderToStaticMarkup(TripPrintView({ data: model }));
    expect(plain).not.toContain('Planned for');
    expect(plain).toContain('Day 3:');
    expect((plain.match(/Not checked yet/g) ?? []).length).toBeLessThan(3);
  });
});
