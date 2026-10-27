import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { bookingCounts, tripBookings, type BookRulePhase } from '@travel/core/export/bookings.ts';
import { opensBeforeDay1 } from '@/lib/public/summary';
import type { ExportBooking } from '@travel/core/export/types.ts';
import { createPublicData } from '@/lib/public';
import { BookingsPanel } from '@/components/trips/tabs/BookingsPanel';
import { PhotosPanel, photoTabModel } from '@/components/trips/tabs/PhotosPanel';
import { bookingsSummary, groupBookings, pricesLine, safeLink } from '@/components/trips/tabs/bookingGroups';
import { daysLabel, photoGroups } from '@/components/trips/tabs/photoGroups';
import { sectionsLabel } from '@/components/trips/tabs/photoGroups';
import { PHOTOS_TAB_MIN } from '@/components/trips/summary/text';
import { Gallery } from '@/components/ui/Gallery';
import type { Photo } from '@/lib/public/types';

// UXB-6: the Bookings and Photos tabs (spec 3.2, 3.6; UXB-N 7, 8; owner QP3, Q307).
const b = (over: Partial<ExportBooking> & Pick<ExportBooking, 'name' | 'ref'>): ExportBooking => ({ rule: null, note: null, day: null, kind: 'booking', park: null, link: null, ...over });
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the count says what it counts', () => {
  const rows = [b({ name: 'Tour', ref: 'a', rule: 'Opens 30 days before Day 3', day: 3 }), b({ name: 'Cabin', ref: 'b', day: 1 }), b({ name: 'Park pass', ref: 'c', kind: 'pass' }), b({ name: 'Lot fills early', ref: 'd', kind: 'check', note: 'No reservation' }), b({ name: 'Print the permit', ref: 'e', kind: 'task' })];
  it('"N to book ahead" is toBook, never the row count; the other kinds are counted apart', () => {
    expect(rows.length).toBe(5);
    expect(bookingCounts(rows).toBook).toBe(2);
    expect(bookingsSummary(rows)).toBe('2 to book ahead, 1 with a published opening date; also 1 pass, 1 check, 1 task');
    expect(bookingsSummary(rows.slice(0, 2))).toBe('2 to book ahead, 1 with a published opening date');
    expect(bookingsSummary([rows[1]!])).toBe('1 to book ahead, none with a published opening date yet');
    expect(bookingsSummary(rows.slice(3))).toBe('Nothing to book ahead; also 1 check, 1 task');
  });
  it('groups by kind in a fixed order and leaves empty groups out', () => {
    expect(groupBookings(rows).map((g) => g.kind)).toEqual(['booking', 'pass', 'check', 'task']);
    expect(groupBookings([rows[3]!]).map((g) => g.kind)).toEqual(['check']);
    expect(groupBookings([])).toEqual([]);
  });
  it('one prices line for the rows that cost money, never a column; none when there are none', () => {
    expect(pricesLine(rows)).toBe('Prices: not checked yet for the 2 bookings and 1 pass.');
    expect(pricesLine(rows.slice(0, 2))).toBe('Prices: not checked yet for these 2.');
    expect(pricesLine([rows[2]!])).toBe('Prices: not checked yet for the 1 pass.');
    expect(pricesLine([rows[1]!])).toBe('Prices: not checked yet for this one.');
    expect(pricesLine(rows.slice(3))).toBeNull();
  });
  it('an official link is drawn only when it is http or https', () => {
    expect(safeLink('https://reservation.pc.gc.ca/x')).toBe('https://reservation.pc.gc.ca/x');
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('not a url')).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});

describe('BookingsPanel', () => {
  it('draws kinds as groups with honest headings; a check is listed under "To check" and never in the to-book count', () => {
    const html = renderToStaticMarkup(
      <BookingsPanel
        bookings={[b({ name: 'Tour', ref: 'a', day: 3, link: 'https://example.org/book' }), b({ name: 'Lot', ref: 'd', kind: 'check', note: 'No reservation; fills before sunrise', park: 'Banff National Park', day: 2 })]}
        placeSlugs={{ a: 'tre-cime' }}
      />,
    );
    const t = text(html);
    expect(t).toContain('1 to book ahead, none with a published opening date yet; also 1 check.');
    expect(html).toContain('To book ahead');
    expect(html).toContain('To check');
    expect(html).toContain('nothing to book.');
    expect(html).not.toMatch(/not counted|Bought any time/);
    expect(html).toContain('href="/places/tre-cime/"');
    expect(html).toContain('Banff National Park');
    expect(html).toMatch(/href="https:\/\/example.org\/book" target="_blank" rel="noopener noreferrer"/);
    expect(html).toContain('opens in a new tab');
    expect(html).toContain('href="?view=day#day-3"');
  });
  it('a row has a place link only when a slug exists, and no link when the contract has none', () => {
    const html = renderToStaticMarkup(<BookingsPanel bookings={[b({ name: 'Car hire', ref: 'x', note: 'Reserve early' })]} />);
    expect(html).not.toContain('/places/');
    expect(html).not.toContain('Booking page');
    expect(html).not.toContain('bk-group-h');
  });
  it('has no filter row (UXB-N: 12 rows or fewer)', () => {
    const html = renderToStaticMarkup(<BookingsPanel bookings={Array.from({ length: 12 }, (_, i) => b({ name: `Row ${i}`, ref: `r${i}`, day: i + 1, note: 'n' }))} />);
    expect(html).not.toMatch(/<select|role="combobox"|aria-haspopup|Filter/);
  });
});

describe('the real trips', () => {
  const data = createPublicData();
  const rows = (slug: string) => tripBookings(Object.values(data.getTrip(slug)!.categories).flat());
  it('Rockies (PA-W, PA-R-CA2): 8 to book ahead (the shuttle one row per ridden day, the Roam batch, the O\'Hara lottery), the Discovery and Kananaskis passes listed, the lakeshore lot a check; passes and checks are never counted', () => {
    const r = rows('canadian-rockies-2029');
    const t = text(renderToStaticMarkup(<BookingsPanel bookings={r} />));
    expect(bookingCounts(r)).toMatchObject({ toBook: 8, pass: 2, check: 1, task: 0 });
    expect(r).toHaveLength(11);
    expect(t).toContain('8 to book ahead, 4 with a published opening date; also 2 passes, 1 check.');
    expect(t).toContain('then 2 days before Day 10 at 08:00 local (60% of seats)');
    expect(t).toContain('Buy any time before Day 1');
    expect(t).toContain('Buy by 23:59 on Day 12');
    expect(t).toContain('Prices: not checked yet for the 8 bookings and 2 passes.');
  });
  it('Dolomites: the Tre Cime window reads "Opens 30 days before Day 3", with no dangling "local"', () => {
    const r = rows('dolomites-2027');
    const html = renderToStaticMarkup(<BookingsPanel bookings={r} />);
    expect(text(html)).toContain('Opens 30 days before Day 3');
    expect(text(html)).not.toMatch(/\blocal\b/);
    expect(text(html)).toContain('1 with a published opening date');
  });
});

const photo = (n: number, group: string | null): Photo => ({ file: `F${n}.jpg`, url: `https://commons.example/F${n}.jpg`, width: 1600, caption: `Caption ${n}`, author: `Author ${n}`, licence: 'CC BY-SA 4.0', licenceUrl: null, sourceUrl: 'https://commons.example/x', group });

describe('photo groups', () => {
  const rows = [
    { name: 'Moraine Lake', placeSlug: 'moraine-lake', days: [11] },
    { name: 'Lake Louise', placeSlug: 'lake-louise', days: [10, 3] },
  ];
  it('keeps the gallery order, matches a section to the plan rows it names, and marks the rest nearby', () => {
    const g = photoGroups([photo(1, 'Moraine Lake and the Valley of the Ten Peaks'), photo(2, 'Lake Louise and Lake Agnes'), photo(3, 'Waterton Lakes'), photo(4, 'Lake Louise and Lake Agnes'), photo(5, null)], rows);
    expect(g.map((x) => x.name)).toEqual(['Moraine Lake and the Valley of the Ten Peaks', 'Lake Louise and Lake Agnes', 'Waterton Lakes', null]);
    expect(g[0]).toMatchObject({ days: [11], nearby: false });
    expect(g[0]!.parts.find((x) => x.slug)).toMatchObject({ text: 'Moraine Lake', slug: 'moraine-lake' });
    expect(g[1]).toMatchObject({ days: [3, 10], nearby: false });
    expect(g[1]!.parts.filter((x) => x.slug).map((x) => x.slug)).toEqual(['lake-louise']);
    expect(g[1]!.photos).toHaveLength(2);
    expect(g[2]).toMatchObject({ days: [], nearby: true, inPlan: false });
    expect(g[3]!.nearby).toBe(false);
  });
  it('an overview trip has no plan rows, so nothing is called "not in this plan"', () => {
    expect(photoGroups([photo(1, 'Arenal')], []).every((x) => !x.nearby)).toBe(true);
  });
  it('a theme section ("Larches and early autumn") is never called a place the plan skipped', () => {
    expect(photoGroups([photo(1, 'Larches and early autumn')], rows)[0]!.nearby).toBe(false);
    expect(photoGroups([photo(1, 'Mount Assiniboine and the Sunshine Meadows')], rows)[0]!.nearby).toBe(true);
  });
  it('day signs', () => {
    expect(daysLabel([11])).toBe('Day 11');
    expect(daysLabel([3, 10])).toBe('Days 3 and 10');
    expect(daysLabel([4, 8, 12])).toBe('Days 4, 8 and 12');
    expect(daysLabel([])).toBe('');
  });
});

describe('PhotosPanel and the credit at rest', () => {
  it('the tab is for 6 or more photos', () => expect(PHOTOS_TAB_MIN).toBe(6));
  it('an empty gallery says so instead of drawing an empty grid', () => {
    expect(text(renderToStaticMarkup(<PhotosPanel photos={[]} />))).toContain('No licensed photos for this trip yet.');
  });
  it('headings carry the place link, the day signs and "Nearby, not in this plan"', () => {
    const m = photoTabModel([photo(1, 'Moraine Lake'), photo(2, 'Waterton Lakes')], [{ name: 'Moraine Lake', placeSlug: 'moraine-lake', days: [11] }]);
    const html = renderToStaticMarkup(<Gallery photos={m.flat} sections={m.sections} creditAtRest />) + renderToStaticMarkup(<PhotosPanel photos={[photo(1, 'Moraine Lake'), photo(2, 'Waterton Lakes')]} />);
    expect(html).toContain('href="/places/moraine-lake/"');
    expect(text(html)).toContain('Day 11');
    expect(text(html)).toContain('Nearby, not in this plan');
    expect(text(html)).toContain('2 photos in 2 sections');
  });
  it('Gallery: at rest the credit is author and licence, visible to a screen reader; otherwise it stays the hidden hover strip', () => {
    const p = [{ url: 'https://commons.example/a.jpg', caption: 'A lake', title: 'A lake', author: 'Ann', licence: 'CC BY 4.0' }];
    const rest = renderToStaticMarkup(<Gallery photos={p} creditAtRest />);
    expect(rest).toContain('gal-rest');
    expect(rest).toContain('<span class="gal-credit-by">Ann</span>');
    expect(rest).toContain('<span class="gal-credit-lic">CC BY 4.0</span>');
    const hover = renderToStaticMarkup(<Gallery photos={p} />);
    expect(hover).toContain('aria-hidden="true">A lake · Ann · CC BY 4.0');
    expect(hover).not.toContain('gal-rest');
  });
});

describe('UXB-6F: section matching on the real Rockies rows', () => {
  const data = createPublicData();
  const t = data.getTrip('canadian-rockies-2029')!;
  const planRows = Object.values(t.categories).flat().map((r) => ({ name: r.name, placeSlug: r.placeSlug, days: r.days }));
  const groups = photoGroups(t.gallery, planRows);
  const g = (needle: RegExp) => groups.find((x) => x.name && needle.test(x.name))!;
  it('Kananaskis reads the days the plan is there (12 to 14), never Day 10 from "Park and Ride"', () => {
    const k = g(/Kananaskis/);
    expect(k.days).not.toContain(10);
    expect(k.days.every((d) => d >= 12)).toBe(true);
  });
  it('"Park and Ride" and a bare "park" match no section', () => {
    const rows = [{ name: 'Lake Louise Lakeshore parking and Park and Ride', placeSlug: null, days: [10] }];
    expect(photoGroups([photo(1, 'Kananaskis Country and Peter Lougheed Provincial Park')], rows)[0]!.days).toEqual([]);
  });
  it('PP and NP read as provincial and national park', () => {
    const rows = [{ name: 'Kananaskis Village / Peter Lougheed PP', placeSlug: 'plpp', days: [12, 13] }, { name: 'Banff NP entry', placeSlug: null, days: [1] }];
    const k = photoGroups([photo(1, 'Kananaskis Country and Peter Lougheed Provincial Park'), photo(2, 'Banff National Park')], rows);
    expect(k[0]!.days).toEqual([12, 13]);
    expect(k[1]!.days).toEqual([1]);
  });
  it('a heading naming two places links each to its own page, never one to whichever comes first', () => {
    const rows = [
      { name: 'Lake Minnewanka', placeSlug: 'lake-minnewanka', days: [3] },
      { name: 'Johnston Canyon', placeSlug: 'johnston-canyon', days: [2] },
    ];
    const j = photoGroups([photo(1, 'Johnston Canyon and Lake Minnewanka')], rows)[0]!;
    expect(j.parts.filter((x) => x.slug).map((x) => [x.text, x.slug])).toEqual([['Johnston Canyon', 'johnston-canyon'], ['Lake Minnewanka', 'lake-minnewanka']]);
    expect(j.parts.map((x) => x.text).join('')).toBe('Johnston Canyon and Lake Minnewanka');
    const real = g(/Johnston/);
    for (const part of real.parts.filter((x) => x.slug)) expect(part.slug).not.toBe(null);
  });
  it('the card and the tab count sections the same way, never "places"', () => {
    expect(sectionsLabel(13)).toBe('13 sections');
    expect(sectionsLabel(1)).toBe('1 section');
  });
  it('one lightbox over every photo: the panel passes one flat list with each section named', () => {
    const m = photoTabModel(t.gallery, planRows);
    expect(m.flat).toHaveLength(t.gallery.length);
    expect(m.sections!.map((x) => x.from)).toEqual([...m.sections!.map((x) => x.from)].sort((a, b) => a - b));
    expect(m.flat.every((p) => p.section)).toBe(true);
    const html = renderToStaticMarkup(<Gallery photos={m.flat} sections={m.sections} creditAtRest />);
    expect((html.match(/gal-tile/g) ?? []).length).toBe(t.gallery.length);
    expect((html.match(/Open photo \d+ of /g) ?? []).length).toBe(t.gallery.length);
    expect(html).toContain(`of ${t.gallery.length}`);
    expect(text(renderToStaticMarkup(<PhotosPanel photos={t.gallery} rows={planRows} />))).toContain(`${t.gallery.length} photos in`);
  });
});

describe('opensBeforeDay1: ranking "earliest" across window kinds (PA-R-CA2)', () => {
  it('a launch day or a lottery opens whole months before the trip; a monthly batch its lead before the month; rolling its days', () => {
    const p = (o: Partial<BookRulePhase>): BookRulePhase => ({ kind: 'rolling', daysBefore: 0, dayN: 10, time: null, tz: null, ...o });
    expect(opensBeforeDay1(p({ daysBefore: 2 }), 9)).toBe(11);
    expect(opensBeforeDay1(p({ kind: 'monthly_release', dayN: 11, monthLeadDays: 36 }), 9)).toBe(46);
    // the shuttle: an April launch day, then 2 days before; the launch day counts
    expect(opensBeforeDay1({ ...p({ kind: 'fixed_date', months: [4, 4] }), then: p({ daysBefore: 2 }) }, 9)).toBe(9 + 150);
    // the O'Hara lottery in March, for a September trip, opens before the April launch day
    expect(opensBeforeDay1({ ...p({ kind: 'lottery', dayN: 9, months: [3, 3] }) }, 9)).toBeGreaterThan(9 + 150);
    // no trip month: a month band cannot be placed, so it counts like a window on its day
    expect(opensBeforeDay1(p({ kind: 'fixed_date', months: [4, 4] }), null)).toBe(9);
  });
});
