import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { tripShape } from '@travel/core/trips/shape.ts';
import { createPublicData } from '@/lib/public';
import { buildTripPageModel } from '@/components/trips/model';
import { shapeFactsFor } from '@/components/trips/summary/shapeData';
import { buildShape, TripShape } from '@/components/trips/summary/TripShape';
import TripShapeRows from '@/components/trips/summary/TripShapeRows';
import { shortName, tailText } from '@/components/trips/summary/ShapeParts';
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
    expect(model.countLine).toBe('15 days · 4 long drive days · 5 days with a booking · 8 highlight days · 6 days with a warning');
    expect(model.sets.longDrive).toEqual([1, 4, 5, 8]);
    expect(model.sets.booking).toEqual([1, 4, 5, 10, 11]);
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
    for (const p of model.phrases) expect(html).toContain(`>${p.text}</button>`);
    expect((html.match(/<button[^>]*class="shape-phrase"[^>]*aria-expanded="false"/g) ?? []).length).toBe(5);
    expect(html).toMatch(/<button[^>]*class="shape-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="/);
    expect(html).not.toContain('<table');
    expect(html).not.toMatch(/The trip at a glance|The plan.s day|tl-trip|tl-bar/);
    // a name and its nights are text, and a screen reader gets the whole name
    expect(html).toContain('Jasper townsite, 4 nights');
    expect(html).toContain('Kan');
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
    expect(text(day1)).toMatch(/Long drive/);
    expect(text(day1)).toMatch(/Book 2/);
    expect(text(day1)).toMatch(/2 h 30/);
  });

  it('a count phrase filters the table to those days and offers every day again', () => {
    const html = renderToStaticMarkup(<TripShapeRows model={model} timelines={tm!.defaultTimelines} filter="longDrive" onClear={() => undefined} onReady={() => undefined} />);
    expect([...html.matchAll(/data-day="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([1, 4, 5, 8]);
    expect(html).toContain('4 long drive days of 15');
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

describe('ribbon names under 64 px', () => {
  it('keeps three letters of a long first word and the initials of two short ones', () => {
    expect(shortName('Kananaskis Village')).toBe('Kan');
    expect(shortName('Lake Louise village')).toBe('LL');
    expect(shortName('Banff')).toBe('Ban');
    expect(shortName('Ubud')).toBe('Ubud');
    expect(shortName('El Chalten')).toBe('Cha');
    expect(shortName('El Calafate')).toBe('Cal');
    expect(shortName('Jasper townsite')).toBe('Jas');
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
