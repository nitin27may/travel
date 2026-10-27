import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { tripSummaryFor } from '@/lib/public/summary';
import { createPublicData } from '@/lib/public';
import { PageTabs } from '@/components/ui/PageTabs';
import { highlightCards } from '@/components/trips/summary/highlights';
import { SummaryBottom, SummaryTop } from '@/components/trips/summary/Summary';
import { countCards, highlightsAtRest, knowBeforeYouGo, PHOTOS_TAB_MIN, SAFETY_NOTE } from '@/components/trips/summary/text';
import { tripBookings } from '@travel/core/export/bookings.ts';

// UXB-1: the Summary tab on real trips (spec 3.5, W2) and the tab bar's semantics (components 1.6).
const data = createPublicData();
const parts = (slug: string, link = { stops: true, bookings: true, photos: true }) => {
  const trip = data.getTrip(slug)!;
  const summary = tripSummaryFor(trip, data.getPlace);
  const bookings = tripBookings(Object.values(trip.categories).flat());
  const html = renderToStaticMarkup(
    <>
      <SummaryTop trip={trip} summary={summary} link={link} highlights={highlightCards(trip, summary, data.getPlace)} galleryGroups={3} />
      <SummaryBottom trip={trip} summary={summary} bookings={bookings} />
    </>,
  );
  return { trip, summary, bookings, html };
};
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Summary: the Canadian Rockies', () => {
  const { html, summary } = parts('canadian-rockies-2029');
  it('names the provinces and the parks, in the order the days reach them', () => {
    const t = text(html);
    expect(t).toContain('15 days through Alberta and British Columbia');
    for (const park of ['Banff', 'Jasper', 'Kootenay', 'Yoho']) expect(t).toContain(park);
    expect(t).toMatch(/World Heritage Site/);
  });
  it('draws the count cards as whole-card links into the tabs, and never a button inside one', () => {
    expect(html).toMatch(/<a class="sum-card" href="\?view=all#trails" data-tab-link="" data-card="trails">/);
    expect(html).toMatch(/href="\?view=bookings"/);
    expect(html).toMatch(/href="\?view=photos"/);
    expect(html).toContain('to book ahead');
    expect(html).toContain('none with a published opening date yet');
    expect(html).not.toMatch(/<a [^>]*class="sum-card"[^>]*>[^]*?<button/);
  });
  it('shows at most eight highlights, four of them behind "Show 4 more" on a phone, each with its day links into Days', () => {
    expect((html.match(/<li class="sum-hl"/g) ?? []).length).toBe(8);
    expect((html.match(/<li class="sum-hl" data-extra/g) ?? []).length).toBe(4);
    expect(summary.highlights.length).toBeGreaterThan(8);
    expect(html).toContain('Show 4 more');
    expect(html).toMatch(/href="\?view=day#day-\d+" data-tab-link=""/);
  });
  it('S1/S2: every card at rest has a photo, and the curator order puts Moraine Lake first (so it is in the four a phone shows)', () => {
    expect(html).not.toContain('No licensed photo yet');
    const cards = highlightCards(parts('canadian-rockies-2029').trip, summary, data.getPlace);
    const first4 = highlightsAtRest(cards, 8).slice(0, 4).map((c) => c.name);
    expect(first4[0]).toBe('Moraine Lake');
    expect(first4).toEqual(expect.arrayContaining(['Moraine Lake', 'Lake Louise', 'Johnston Canyon']));
    expect(highlightsAtRest(cards, 8).every((c) => c.photoUrl)).toBe(true);
  });
  it('S5: no "See all" link to an unfiltered Stops list until OVR-2', () => {
    expect(html).not.toMatch(/See all \d+/);
    expect(html).not.toContain('href="?view=all" data-tab-link');
  });
  it('S7: a highlight day link reads "Day N" with its place in the accessible name', () => {
    expect(html).toMatch(/<a href="\?view=day#day-\d+" data-tab-link="" aria-label="Day \d+, [^"]+">Day \d+<\/a>/);
    expect(html).not.toMatch(/data-tab-link="">\d+<\/a>/);
  });
  it('S4: the bases card counts stays so it agrees with the cover', () => {
    expect(text(html)).toMatch(/\d+ bases? \d+ stays, \d+ nights/);
  });
  it('M1: both safety lines show at rest, the Larch Valley rule and the Moraine Lake road ban', () => {
    const { bookings } = parts('canadian-rockies-2029');
    const k = knowBeforeYouGo(bookings);
    const atRest = k.atRest.map((l) => l.name).join(' | ');
    expect(atRest).toMatch(/Larch Valley/i);
    expect(atRest).toMatch(/Moraine Lake Road/i);
    expect(k.more.map((l) => l.name).join(' | ')).not.toMatch(/Moraine Lake Road|Larch Valley/i);
  });
  it('keeps the know-before-you-go list and who it suits', () => {
    expect(html).toContain('Who it suits');
    expect(html).toContain('Know before you go');
  });
});

describe('Summary: degrades', () => {
  it('the Dolomites name their regions, nature parks and the dated booking', () => {
    const { html } = parts('dolomites-2027');
    const t = text(html);
    expect(t).toMatch(/South Tyrol/);
    expect(t).toMatch(/nature parks?/);
    expect(t).toMatch(/earliest: .*opens 30 days before Day 3/);
  });
  it('an overview trip says it has no days yet and draws no count of stops, no bookings card, no tab links to days', () => {
    const slug = data.tripSlugs().find((s) => data.getTrip(s)!.depth === 'overview')!;
    const { html } = parts(slug, { stops: false, bookings: false, photos: true });
    const t = text(html);
    expect(t).toContain('This plan has not been converted to days yet.');
    expect(html).not.toContain('data-card="trails"');
    expect(html).not.toContain('data-card="bookings"');
    expect(html).not.toMatch(/\?view=day/);
  });
  it('a card whose tab is not drawn is a plain box, never a dead link', () => {
    const { html } = parts('canadian-rockies-2029', { stops: false, bookings: false, photos: false });
    expect(html).not.toContain('href="?view=all#trails"');
    expect(html).toContain('data-card="trails"');
  });
});

describe('count cards and the lines', () => {
  it('carry their coverage and skip what is not there', () => {
    const base = tripSummaryFor(data.getTrip('canadian-rockies-2029')!, data.getPlace);
    const cards = countCards(base, { stops: true, bookings: true, photos: true });
    expect(cards.map((c) => c.key)).toEqual(['bases', 'trails', 'sights', 'activities', 'bookings', 'photos']);
    const none = countCards({ ...base, counts: { ...base.counts, trails: { count: 0, km: 0, kmKnown: 0, gainM: 0, gainKnown: 0 }, photos: 0 } }, { stops: true, bookings: true, photos: true });
    expect(none.map((c) => c.key)).not.toContain('trails');
    expect(none.map((c) => c.key)).not.toContain('photos');
  });
  it('know before you go: three at rest, every safety line at rest, the rest counted behind a disclosure', () => {
    const b = (name: string, note: string) => ({ name, note, rule: null, day: 1, ref: name, kind: 'booking' as const, park: null, link: null });
    const k = knowBeforeYouGo([b('A', 'Book early'), b('B', 'Buy on site'), b('C', 'Cash only'), b('D', 'Pay at the desk'), b('E', 'Road closed to private cars in season')]);
    expect(k.atRest.map((l) => l.name)).toEqual(['A', 'B', 'C', 'E']);
    expect(k.more.map((l) => l.name)).toEqual(['D']);
    expect(SAFETY_NOTE.test('Larch Valley: group-of-four rule')).toBe(true);
    // M1: the danger can be in the NAME while the note is calm
    const road = knowBeforeYouGo([b('A', 'x'), b('B', 'x'), b('C', 'x'), b('Moraine Lake Road private vehicle ban and commercial/Roam options', 'Have the shuttle reservation as primary')]);
    expect(road.atRest.map((l) => l.name)).toContain('Moraine Lake Road private vehicle ban and commercial/Roam options');
    for (const w of ['Road banned to cars', 'Not allowed without a permit', 'Prohibited in the closure area']) expect(SAFETY_NOTE.test(w)).toBe(true);
  });
  it('highlights at rest: photos first, each group in the model order (never re-sorted into day order), never more than the limit', () => {
    const h = (name: string, photo: boolean) => ({ name, photoUrl: photo ? 'x' : null });
    const all = [h('a', false), h('b', true), h('c', false), h('d', true), h('e', true)];
    expect(highlightsAtRest(all, 3).map((x) => x.name)).toEqual(['b', 'd', 'e']);
    expect(highlightsAtRest(all, 4).map((x) => x.name)).toEqual(['b', 'd', 'e', 'a']);
    expect(highlightsAtRest(all, 9)).toHaveLength(5);
  });
  it('the Photos tab needs six photos', () => {
    expect(PHOTOS_TAB_MIN).toBe(6);
  });
});

describe('the tab bar', () => {
  const tabs = [
    { value: 'summary', label: 'Summary' },
    { value: 'days', label: 'Days' },
    { value: 'bookings', label: 'Bookings', count: 7 },
  ];
  const html = renderToStaticMarkup(<PageTabs label="Trip sections" idPrefix="trip" tabs={tabs} value="days" onActivate={() => undefined} />);
  it('is a labelled tablist of buttons that control their panels, with one tab stop', () => {
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Trip sections"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(3);
    expect(html).toContain('id="trip-tab-days"');
    expect(html).toContain('aria-controls="trip-panel-days"');
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/id="trip-tab-days"[^>]*aria-selected="true"/);
  });
  it('puts the count in the accessible name', () => {
    expect(html).toContain('aria-label="Bookings, 7"');
  });
});
