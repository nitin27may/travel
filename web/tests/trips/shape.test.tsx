import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { tripShape } from '@travel/core/trips/shape.ts';
import { createPublicData } from '@/lib/public';
import { buildTripPageModel } from '@/components/trips/model';
import { shapeFactsFor } from '@/components/trips/summary/shapeData';
import { buildShape, TripShape } from '@/components/trips/summary/TripShape';
import TripShapeRows from '@/components/trips/summary/TripShapeRows';
import { fitOf, shortName, tailText } from '@/components/trips/summary/ShapeParts';
import { DEFAULT_TRIP_UI_ENTRY, patchTripUi, readTripEntry, writeTripEntry } from '@/lib/storage/tripUi';

// UXB-3: the trip's shape on real trips (spec trip-and-places-ux-fixes.md 4.2 to 4.5, W5).
const data = createPublicData();
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function shapeOf(slug: string) {
  const trip = data.getTrip(slug)!;
  const facts = shapeFactsFor(trip, data.getPlace);
  const tm = buildTripPageModel(trip, () => null, []).timeline;
  return { trip, facts, tm };
}

describe('the shape on the Canadian Rockies', () => {
  const { facts, tm } = shapeOf('canadian-rockies-2029');
  const model = buildShape(tm!.days, facts!, tm!.defaultTimelines, new Set());

  it('reads the count line of the spec at the plan as written', () => {
    expect(model.countLine).toBe('15 days · 2 long drive days · 6 days with a booking · 8 highlight days · 6 days with a warning');
    // S2D-LEG: Days 1 and 5 drive under the long-drive line once their in-town and trailhead hops have stored legs
    expect(model.sets.longDrive).toEqual([4, 8]);
    expect(model.sets.booking).toEqual([1, 4, 5, 9, 10, 11]); // Day 9: the Lake O'Hara lottery (PA-R-CA2)
    // the spec's 7 predates Day 5's Athabasca Falls reaching the trip-surface badge; web/tests/data/trip-summary.test.ts pins the same 8
    expect(model.sets.highlight).toEqual([3, 4, 5, 8, 9, 10, 11, 14]);
    expect(model.sets.warning).toEqual([2, 4, 7, 10, 12, 13]);
  });

  it('the ribbon is the five stays by nights, with the flight home as its tail', () => {
    expect(model.ribbon.map((s) => `${s.name} ${s.nights}`)).toEqual(['Banff 2', 'Lake Louise village 1', 'Jasper townsite 4', 'Lake Louise village 4', 'Kananaskis Village / Peter Lougheed PP 3']);
    expect(tailText(model.tail)).toBe('+ the flight home on Day 15');
  });

  it('the closed shape is server HTML: the ribbon, one button a phrase, a toggle that says how many days, no table, no clock chart', () => {
    const html = renderToStaticMarkup(<TripShape slug="canadian-rockies-2029" facts={facts!} days={tm!.days} timelines={tm!.defaultTimelines} changedDays={new Set()} />);
    const t = text(html);
    expect(t).toContain('The trip&#x27;s shape');
    expect(t).toContain('Show all 15 days');
    for (const p of model.phrases) expect(html).toContain(`<span class="shape-long">${p.text}</span><span class="shape-brief">${p.short}</span>`);
    expect((html.match(/<button[^>]*class="shape-phrase"[^>]*aria-expanded="false"/g) ?? []).length).toBe(5);
    expect(html).toMatch(/<button[^>]*class="shape-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="/);
    expect(html).not.toContain('<table');
    expect(html).not.toMatch(/The trip at a glance|The plan.s day|tl-trip|tl-bar/);
    // a name and its nights are text, and a screen reader gets the whole name
    expect(html).toContain('Jasper townsite, 4 nights');
    expect(html).toContain('data-fit="xl"');
  });

  it('the controls point at one region that is in the page while the shape is closed', () => {
    const html = renderToStaticMarkup(<TripShape slug="canadian-rockies-2029" facts={facts!} days={tm!.days} timelines={tm!.defaultTimelines} changedDays={new Set()} />);
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(1);
    expect(html).toContain(`id="${ids[0]}"`);
  });

  it('the table has a caption, 15 rows, each a link into Days at its day, and no clock', () => {
    const html = renderToStaticMarkup(<TripShapeRows model={model} timelines={tm!.defaultTimelines} filter={null} onClear={() => undefined} onReady={() => undefined} />);
    expect(html).toContain("The trip&#x27;s shape, 15 days");
    expect((html.match(/<tr[^>]*class="shape-row"/g) ?? []).length).toBe(15);
    expect(html).toContain('href="?view=day#day-11"');
    expect(html).toMatch(/<th scope="col"[^>]*>Driving<\/th>/);
    expect(html).not.toMatch(/The plan.s day|Worth the journey/);
    const day1 = html.slice(html.indexOf('data-day="1"'), html.indexOf('data-day="2"'));
    expect(text(day1)).toMatch(/Banff/);
    expect(text(day1)).not.toMatch(/Long drive/);
    expect(text(day1)).toMatch(/Book 1/); // the rental car; the Discovery Pass is a pass now, never counted (PA-R-CA2)
    expect(text(day1)).toMatch(/sunset 2 h 1\.9 km/); // 1 h 30 from the airport and six short hops inside Banff (S2D-LEG)
  });

  it('a count phrase filters the table to those days and offers every day again', () => {
    const html = renderToStaticMarkup(<TripShapeRows model={model} timelines={tm!.defaultTimelines} filter="longDrive" onClear={() => undefined} onReady={() => undefined} />);
    expect([...html.matchAll(/data-day="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([4, 8]);
    expect(html).toContain('2 long drive days of 15');
    expect(html).toContain('Show all days');
  });

  it('never prints a drive or walk it does not know as a number', () => {
    const none = buildShape(tm!.days, facts!, [], new Set());
    const html = renderToStaticMarkup(<TripShapeRows model={none} timelines={[]} filter={null} onClear={() => undefined} onReady={() => undefined} />);
    expect(html).not.toMatch(/\b0 km\b|\b0 min\b/);
  });
});

describe('the shape on the other trips', () => {
  it('a version that differs from the main one shows as a note, and the title follows the version on screen', () => {
    const { facts, tm } = shapeOf('dolomites-2027');
    const m = buildShape(tm!.days, facts!, tm!.defaultTimelines, new Set());
    expect(m.days).toBe(14);
    expect(m.rows.every((r) => r.title.length > 0)).toBe(true);
    expect(JSON.stringify(m.rows)).not.toContain("The plan's day");
  });

  it('an overview trip and a trip with no schedule have no shape (P4)', () => {
    const overview = data.getTrip('costa-rica-2027')!;
    expect(shapeFactsFor(overview, data.getPlace)).toBeNull();
  });

  it('the facts are light: a few hundred bytes for the Rockies (P8)', () => {
    const { facts } = shapeOf('canadian-rockies-2029');
    expect(JSON.stringify(facts).length).toBeLessThan(1500);
  });

  it('core and the shell agree: the same function builds both', () => {
    const { facts, tm } = shapeOf('canadian-rockies-2029');
    const direct = tripShape({
      days: tm!.days.map((d) => ({ n: d.n, title: d.variants.find((v) => v.key === tm!.defaultTimelines.find((t) => t.day === d.n)?.variant.key)?.title ?? d.title, base: d.base, plannedDriveMin: facts!.planned[d.n] ?? null, variants: d.variants })),
      bases: facts!.bases, timelines: tm!.defaultTimelines, bookingDays: facts!.bookingDays, highlightSlugs: facts!.highlightSlugs, highlightVersions: facts!.highlightVersions, changedDays: new Set(),
    });
    expect(buildShape(tm!.days, facts!, tm!.defaultTimelines, new Set()).countLine).toBe(direct.countLine);
  });
});

describe('ribbon names (review UXB-3 M2)', () => {
  it('a single word keeps up to six letters whole, a longer one takes four and a full stop; two or more words take initials', () => {
    expect(shortName('Banff')).toBe('Banff');
    expect(shortName('Myvatn')).toBe('Myvatn');
    expect(shortName('Grundarfjordur')).toBe('Grun.');
    expect(shortName('Kananaskis Village')).toBe('KV');
    expect(shortName('Lake Louise village')).toBe('LL');
    expect(shortName('Jasper townsite')).toBe('JT');
    expect(shortName('El Chalten')).toBe('Chal.');
    expect(shortName('El Calafate')).toBe('Cala.');
  });
  it('the room a whole name needs follows its length', () => {
    expect(['Vik', 'Selfoss', 'Reykjavik area', 'Kananaskis Village / Peter Lougheed PP'].map(fitOf)).toEqual(['s', 'm', 'l', 'xl']);
  });
  it('words the tail by what it is', () => {
    expect(tailText({ days: [15], label: 'Flight home' })).toBe('+ the flight home on Day 15');
    expect(tailText({ days: [9], label: 'Last day' })).toBe('+ Day 9, the last day');
    expect(tailText(null)).toBeNull();
  });
});

describe('remembered per trip (travel.tripui)', () => {
  it('keeps shapeOpen for one trip and leaves the others closed', () => {
    const ui = patchTripUi({ v: 1, partyOpen: false, trips: {} }, 'canadian-rockies-2029', { shapeOpen: true });
    expect(ui.trips['canadian-rockies-2029']!.shapeOpen).toBe(true);
    expect(ui.trips['canadian-rockies-2029']!.tab).toBe('summary');
    expect(ui.trips['dolomites-2027']).toBeUndefined();
    expect(DEFAULT_TRIP_UI_ENTRY.shapeOpen).toBe(false);
  });
  it('reads closed and writes nothing visible when storage is blocked', () => {
    // node has no localStorage: the safe wrappers answer null / false instead of throwing
    expect(readTripEntry('canadian-rockies-2029').shapeOpen).toBe(false);
    expect(writeTripEntry('canadian-rockies-2029', { shapeOpen: true })).toBe(false);
  });
});

describe('Light day is claimed only where the page knows the day (review UXB-3 C1)', () => {
  const light = (slug: string): number[] => {
    const { facts, tm } = shapeOf(slug);
    return buildShape(tm!.days, facts!, tm!.defaultTimelines, new Set()).sets.light;
  };
  it('never on a condensed day, a flight day or the first day: Patagonia Days 1, 2, 13; Chamonix Days 2, 4, 7, 8; Vermont Day 2', () => {
    const p = light('patagonia-2027');
    for (const d of [1, 2, 13]) expect(p, `patagonia ${d}`).not.toContain(d);
    const c = light('chamonix-mont-blanc-2028');
    for (const d of [2, 4, 7, 8]) expect(c, `chamonix ${d}`).not.toContain(d);
    expect(light('vermont-fall-2026')).not.toContain(2);
  });
  it('not on the Lagazuoi day: 3 h 30 in the tunnels and 2 h at Rifugio Scotoni are not a light day', () => {
    expect(light('dolomites-2027')).not.toContain(7);
  });
  it('on the Rockies day that really is light: Day 11 (a boat and 75 min on foot); Day 10 adds a gondola and a lakeshore hike, 3 h of stops', () => {
    expect(light('canadian-rockies-2029')).toEqual([11]);
  });
});
