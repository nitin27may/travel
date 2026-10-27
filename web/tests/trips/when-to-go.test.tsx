import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { tripWeatherFor, tripWeatherFrom, linkText } from '@/lib/public/weatherLinks';
import { tripWindowsFor, tripWindowsFrom } from '@/lib/public/windows';
import { MonthStrip } from '@/components/trips/summary/MonthStrip';
import { WhenToGo } from '@/components/trips/summary/WhenToGo';
import { cards, crowdsCard, goodMonths, hero, monthStates, noteKind, notesOf, otherWeeks, stateSummary, legendStates } from '@/components/trips/summary/whenModel';

// UXB-4: When to go (spec trip-and-places-ux-fixes.md 6.2, W4; components 4.7). Real trips through the real adapters, plus the states no trip has yet.
const data = createPublicData();
const html = (slug: string) => {
  const t = data.getTrip(slug)!;
  return renderToStaticMarkup(<WhenToGo season={t.season} weather={tripWeatherFor(slug)} windows={tripWindowsFor(slug)} />);
};
const text = (h: string): string => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the month strip', () => {
  it('uses three-letter names, never single letters, and gives every cell its full month and state as text', () => {
    const h = renderToStaticMarkup(<MonthStrip states={monthStates({ months: [9], basis: 'researched' })} />);
    for (const m of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) expect(h).toContain(`>${m}<`);
    expect(h).not.toMatch(/>[A-Z]<\/span>/);
    expect(h).toContain('September, best for this plan');
    expect(h).toContain('January, not checked for this plan');
    expect(h.match(/<li class="mstrip-cell"/g)).toHaveLength(12);
    // the visible names and words are hidden from a screen reader; the list is ordered, not role="img"
    expect(h).toContain('<ol class="mstrip-list"');
    expect(h).not.toContain('role="img"');
    expect(h.match(/aria-hidden="true">Sep</g)).toHaveLength(1);
  });
  it('reads the summary line first: best, also good, the plan\'s months, avoid', () => {
    const s = monthStates({ months: [9], basis: 'researched' }, { 6: 'good', 8: 'good', 2: 'avoid' });
    expect(stateSummary(s)).toBe('Best: September. Also good: June and August. Avoid: February.');
    expect(stateSummary(monthStates({ months: [7, 8], basis: 'plan' }))).toBe("The plan's months: July and August.");
    expect(stateSummary(monthStates({ months: [], basis: 'plan' }))).toBe('No month has been checked for this plan.');
  });
  it('a plan\'s own window is outlined as the plan\'s months, never "best"', () => {
    const h = renderToStaticMarkup(<MonthStrip states={monthStates({ months: [2], basis: 'plan' })} />);
    expect(h).toContain('February, one of the plan&#x27;s months');
    expect(h).not.toContain('best for this plan');
    expect(h).toContain('data-state="plan"');
  });
  it('draws a legend for the states in use only, and a state\'s word in its cell', () => {
    const s = monthStates({ months: [9], basis: 'researched' }, { 6: 'good' });
    expect(legendStates(s)).toEqual(['best', 'good']);
    const h = renderToStaticMarkup(<MonthStrip states={s} />);
    expect(h).toContain('Also good, with trade-offs');
    expect(h).not.toContain('Avoid');
    expect(h).toContain('Blank: not checked for this plan');
    expect(h).toContain('>best<');
    expect(h).toContain('>good<');
  });
});

describe('the hero and the cards', () => {
  it('says "Best time for this plan" only for a researched season', () => {
    expect(hero({ label: 'Early to late September', why: 'x', basis: 'researched' }).kicker).toBe('Best time for this plan');
    const p = hero({ label: 'Mid-February', why: 'x', basis: 'plan' });
    expect(p.kicker).toBe('The window this plan was written for');
    expect(p.basisNote).toMatch(/have not been checked/);
  });
  it('has four equal cards and says "Not checked yet" for crowds, never a guess', () => {
    const c = cards({ tempC: '2 to 16 C', rain: 'Showers', daylight: 'Sunrise about 07:00', notes: [] });
    expect(c.map((x) => x.key)).toEqual(['temperature', 'rain', 'daylight', 'crowds']);
    expect(c[3]!.value).toBeNull();
    expect(cards({ tempC: 'x', rain: '', daylight: '', notes: [] }, { value: 'Lower', sub: 'Government of Alberta, 2019 pattern' })[3]).toMatchObject({ value: 'Lower', sub: 'Government of Alberta, 2019 pattern' });
    expect(cards({ tempC: '', rain: ' ', daylight: '', notes: [] }).filter((x) => x.value)).toHaveLength(0);
  });
});

describe('worth knowing: the warn glyph is for a closure or a hazard only (I9, C2)', () => {
  it.each([
    ['Moraine Lake road closes in mid-October', 'warn'],
    ['Maligne cruise ends early October', 'warn'],
    ['Wind can close boats and the Fitz Roy ridge', 'warn'],
    ['Do not go in the Narrows if flash flood warnings are posted', 'warn'],
    ['Summer heat above 38 C makes midday hikes unsafe', 'warn'],
    ['No river crossings: rental cover excludes them', 'warn'],
    ['Penguin colony season ends in March', 'warn'],
    ['Rockfall after rain on the north face', 'warn'],
    ['Wildfire smoke can close the valley road', 'warn'],
    ['Lightning on the ridge by early afternoon', 'warn'],
    ['The ford at the car park is passable only in the morning', 'warn'],
    ['Lagazuoi tunnels need a headlamp', 'info'],
    ['Larch gold peaks in the last third of September into early October', 'info'],
    ['Stay close to the river path for the best light', 'info'],
    ['A closer look at the glacier from the lower viewpoint', 'info'],
    ['Oxford Street shops are open late', 'info'],
    ['No darkness at any station, so northern lights are not possible in this window', 'info'],
  ] as const)('%s -> %s', (t, k) => expect(noteKind(t)).toBe(k));

  // every season note on the 14 trips and its kind: a new or reworded note that flips a kind (or folds a hazard) fails here
  const PINNED: Record<string, [string, 'warn' | 'info'][]> = {
    'algonquin-muskoka-2026': [['Algonquin day permits sell online only a few days ahead', 'info'], ['Thanksgiving traffic is heavy on Friday and Monday', 'info'], ['Colour year varies by two weeks', 'info']],
    'canadian-rockies-2029': [['Moraine Lake road closes in mid-October', 'warn'], ['Larch gold peaks in the last third of September into early October', 'info'], ['Maligne cruise ends early October', 'warn']],
    'chamonix-mont-blanc-2028': [['Mont Blanc tunnel autumn closures may cut off Courmayeur', 'warn'], ['UTMB week fills every bed', 'info'], ['Huts close around the third week of September', 'warn']],
    'costa-rica-2027': [['Civil dusk falls about 18:05 to 18:15 at both airports, so plan long drives to end by then', 'info'], ['The Arenal and South Pacific bases are not covered by any normals station found', 'info']],
    'dolomites-2027': [['Mountain huts are open and busy; Tre Cime and Braies need booked parking or a toll slot', 'info'], ['Early June and September close several lifts', 'warn'], ['Lagazuoi tunnels need a headlamp', 'info']],
    'iceland-ring-road-2027': [['About 50 campsites close during September', 'warn'], ['Puffins have left by September', 'info'], ['No river crossings: rental cover excludes them', 'warn']],
    'new-hampshire-stopover-2026': [['October is the wettest of the two months at Lincoln', 'info']],
    'niagara-day-2026': [['Civil twilight lasts about half an hour after sunset', 'info']],
    'norway-summer-2028': [['Bergen is the wettest stop, with rain on about half the days', 'info'], ['No darkness at any station, so northern lights are not possible in this window', 'info']],
    'patagonia-2027': [['Wind can close boats and the Fitz Roy ridge', 'warn'], ['Penguin colony season ends in March', 'warn'], ['Check national park entry fees before the day', 'info']],
    'quebec-2026': [['October nights average just above freezing, so pack a warm layer for evenings', 'info']],
    'switzerland-2027': [['Zermatt is the driest base, with well under half the rain of Lucerne', 'info'], ['Mean highs on the Jungfraujoch stay near 3 C even in high summer, so pack warm layers', 'info']],
    'utah-five-parks': [['Do not go in the Narrows if flash flood warnings are posted', 'warn'], ['Summer heat above 38 C makes midday hikes unsafe', 'warn'], ['Timed entry may apply at Arches', 'info']],
    'vermont-fall-2026': [["Smugglers' Notch road closes in November", 'warn'], ['Weekend traffic around Stowe is slow', 'info'], ['Carry passports for every traveller, including children', 'info']],
  };
  it('pins all 33 season notes of the 14 trips and their kind', () => {
    const live: Record<string, [string, string][]> = {};
    for (const slug of data.tripSlugs()) live[slug] = (data.getTrip(slug)!.season?.weather.notes ?? []).map((n) => [n, noteKind(n)]);
    expect(Object.keys(live).sort()).toEqual(Object.keys(PINNED).sort());
    expect(live).toEqual(PINNED);
    expect(Object.values(PINNED).flat()).toHaveLength(33);
  });
  it('shows every note whole at three or fewer, so no heading is drawn over an empty list (I1)', () => {
    for (const notes of Object.values(PINNED)) expect(notesOf(notes.map(([t]) => t)).some((n) => n.fold)).toBe(false);
  });
  it('over three notes: a hazard stays at rest and advice folds; with no hazard the first note stays', () => {
    const n = notesOf(['Huts open', 'Road closes in October', 'Bring layers', 'Permits sell out']);
    expect(n.map((x) => x.fold)).toEqual([true, false, true, true]);
    const calm = notesOf(['a', 'b', 'c', 'd']);
    expect(calm.map((x) => x.fold)).toEqual([false, true, true, true]);
  });
});

describe('windows: the researched weeks (C1)', () => {
  const doc = {
    schema: 'trip-windows/1', trip: 't', default: 'a',
    sources: [{ id: 's1', publisher: 'Gov A', url: 'https://x.example/' }],
    windows: [
      { id: 'a', label: 'Second week of September', verdict: 'best', start: { month: 9 }, crowd: { level: 'lower', src: ['s1'], pattern_year: 2019 }, plus: [{ text: 'After the long weekend' }], minus: [{ text: 'Cold nights' }] },
      { id: 'b', label: 'Last week of June', verdict: 'good', start: { month: 6 }, crowd: { level: 'rising', src: ['s1'] }, plus: [{ text: 'On 15 June the road opens' }, { text: 'Longest days' }], minus: [] },
      { id: 'c', label: 'Second week of June', verdict: 'workable', start: { month: 6 }, crowd: { level: 'lower' } },
      { id: 'd', label: 'Bad', verdict: 'terrible' },
    ],
  };
  it('keeps what reads as a window, drops the rest, and drops a dated line rather than rewriting it', () => {
    const w = tripWindowsFrom(doc, 't')!;
    expect(w.rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(w.rows[0]).toMatchObject({ verdict: 'best', isDefault: true, startMonth: 9, plus: 'After the long weekend', minus: 'Cold nights', crowd: { level: 'lower', source: 'Gov A', year: 2019 } });
    expect(w.rows[1]!.plus).toBe('Longest days');
    expect(w.rows[1]!.minus).toBeNull();
    expect(w.rows[2]!.crowd).toEqual({ level: 'lower', source: null, year: null });
  });
  it('returns null for another trip, another schema or no usable window', () => {
    expect(tripWindowsFrom(doc, 'other')).toBeNull();
    expect(tripWindowsFrom({ ...doc, schema: 'x/1' }, 't')).toBeNull();
    expect(tripWindowsFrom({ ...doc, windows: [] }, 't')).toBeNull();
  });
  it('feeds the crowds card, the other weeks and the good months', () => {
    const rows = tripWindowsFrom(doc, 't')!.rows;
    expect(crowdsCard(rows)).toEqual({ value: 'Lower', sub: 'Gov A, 2019 pattern' });
    expect(otherWeeks(rows).map((r) => r.id)).toEqual(['b', 'c']);
    expect(goodMonths(rows)).toEqual({ 6: 'good' });
    expect(crowdsCard([])).toBeNull();
  });
  it('the public file adds no source URL, no affected ref and no id of a source to the rows', () => {
    const w = tripWindowsFor('canadian-rockies-2029')!;
    expect(JSON.stringify(w)).not.toMatch(/https?:|legacy\/|s-[0-9a-f]{10}/);
  });
});

describe('When to go on real trips', () => {
  it('the Rockies: researched crowds, the other weeks, June as good, a hazard in view, forecasts and climate with the publisher named', () => {
    const h = html('canadian-rockies-2029');
    const t = text(h);
    expect(t).toContain('When to go');
    expect(t).toContain('Best time for this plan');
    expect(t).toContain('Early to late September');
    expect(h).toContain('September, best for this plan');
    expect(h).toContain('June, also good, with trade-offs');
    expect(t).not.toContain('Other weeks have not been researched yet.');
    expect(h).toMatch(/data-card="crowds"[^>]*>(?:(?!<\/li>).)*Lower/);
    expect(t).toContain('Government of Alberta, 2019 pattern');
    expect(h.match(/class="wtg-week"/g)).toHaveLength(3);
    expect(t).toContain('First week of September');
    expect(t).toContain('Crowds high');
    expect(t).not.toContain('Second week of September Best'); // the window the plan is written for is the hero, not a line
    expect(h.match(/data-kind="warn"/g)).toHaveLength(2);
    expect(h).not.toContain('data-extra="true"><svg'); // three notes: nothing folds
    expect(h).not.toContain('wtg-notes-more');
    expect(t).toContain('Environment Canada');
    expect(t).toContain('Parks Canada');
    expect(t).toContain('More weather pages (3)');
    expect(h).toContain('href="https://weather.gc.ca/en/location/index.html?coords=51.178,-115.571"');
    expect(h).toContain('target="_blank" rel="noopener noreferrer"');
    expect(h).toContain('>forecast, Environment Canada, opens in a new tab');
  });
  it('a trip with no windows file keeps its honest gap lines', () => {
    const t = text(html('dolomites-2027'));
    expect(t).toContain('Other weeks have not been researched yet.');
    expect(html('dolomites-2027')).toMatch(/data-card="crowds"[^>]*>(?:(?!<\/li>).)*Not checked yet/);
    expect(tripWindowsFor('dolomites-2027')).toBeNull();
  });
  it('a plan-basis trip (Costa Rica) says it is the plan\'s own window and shows the weather it has', () => {
    const t = text(html('costa-rica-2027'));
    expect(t).toContain('The window this plan was written for');
    expect(t).toContain('Mid-February');
    expect(t).toContain('have not been checked yet');
    expect(t).not.toContain('Best time for this plan');
    expect(t).toContain('IMN Costa Rica');
  });
  it('Dolomites: non-English pages name their language; mountain weather is a secondary row', () => {
    const h = html('dolomites-2027');
    expect(text(h)).toContain('Italian');
    expect(h).not.toContain('page in Italian'); // said once, by the visible chip
    expect(h).toMatch(/hreflang="it"/i);
    expect(h).toMatch(/data-secondary="true"/);
    expect(h).toContain('Some weather pages for this trip are not linked yet');
  });
  it('Patagonia (southern hemisphere): February and March, no unreachable link, the gap sentence alone under Weather', () => {
    const h = html('patagonia-2027');
    expect(h).toContain('February, best for this plan');
    expect(h).toContain('March, best for this plan');
    expect(h).not.toContain('smn.gob.ar');
    expect(h).not.toContain('class="wtg-link"');
    expect(h).toContain('Some weather pages for this trip are not linked yet');
  });
  it('every public trip draws one When to go heading, one h2, a 4-card row when weather is written, and only https links from the data file', () => {
    const file = JSON.parse(readFileSync(path.join(process.cwd(), '..', 'data', 'reference', 'weather-links.json'), 'utf8')) as { trips: { trip: string; links: { url: string }[] }[] };
    const stored = new Set(file.trips.flatMap((t) => t.links.map((l) => l.url)));
    for (const slug of data.tripSlugs()) {
      const h = html(slug);
      expect(h.match(/<h2/g), slug).toHaveLength(1);
      for (const [, href] of h.matchAll(/class="wtg-link" href="([^"]+)"/g)) expect(stored.has(href!.replace(/&amp;/g, '&')), `${slug} ${href}`).toBe(true);
      expect(h, slug).not.toContain('role="img"');
    }
  });
  it('a trip with no season says so and still draws its links; no links and no season draws only the heading and the notice', () => {
    const h = renderToStaticMarkup(<WhenToGo season={null} weather={null} />);
    expect(text(h)).toContain('have not been written down');
    expect(h).not.toContain('wtg-wx');
    expect(h).not.toContain('mstrip');
  });
});

describe('the weather-links adapter', () => {
  const doc = {
    publishers: { a: { short: 'Met A', langs: ['fr', 'en'] }, b: { short: 'Met B', langs: ['en'] } },
    trips: [{ trip: 't', gaps: [], links: [
      { kind: 'forecast', label: 'Forecast: Town', publisher: 'a', url: 'https://a.example/town', english: false },
      { kind: 'climate', label: 'Climate of Land', publisher: 'b', url: 'https://b.example/c', english: true },
      { kind: 'forecast', label: 'Forecast: Bad', publisher: 'b', url: 'http://b.example/x', english: true },
      { kind: 'forecast', label: 'Forecast: Unknown source', publisher: 'zzz', url: 'https://z.example/', english: true },
      { kind: 'tide', label: 'Tide: X', publisher: 'b', url: 'https://b.example/t', english: true },
    ] }],
  };
  it('keeps what the file validates and drops the rest, never repairing a URL', () => {
    const w = tripWeatherFrom(doc, 't')!;
    expect(w.sources.map((s) => s.name)).toEqual(['Met A', 'Met B']);
    expect(w.sources[0]!.links[0]).toEqual({ kind: 'forecast', text: 'Town', href: 'https://a.example/town', language: 'French', lang: 'fr' });
    expect(w.sources[1]!.links).toHaveLength(1);
    expect(w.partial).toBe(false);
  });
  it('skips a row whose check says the page was unreachable, and counts only "GAP:" entries', () => {
    const d = { publishers: { a: { short: 'Met A', langs: ['en'] } }, trips: [{ trip: 't', gaps: ['Chile DMC not needed: x'], links: [{ kind: 'forecast', label: 'Forecast: X', publisher: 'a', url: 'https://a.example/x', english: true, check: { reachable: false } }] }, { trip: 'u', gaps: ['GAP: no page'], links: [{ kind: 'forecast', label: 'Forecast: X', publisher: 'a', url: 'https://a.example/x', english: true, check: { reachable: false } }] }] };
    expect(tripWeatherFrom(d, 't')).toBeNull();
    expect(tripWeatherFrom(d, 'u')).toEqual({ sources: [], partial: true });
  });
  it('returns null for a trip with no usable link, so the section is left out', () => {
    expect(tripWeatherFrom(doc, 'nope')).toBeNull();
    expect(tripWeatherFrom({ ...doc, trips: [{ trip: 't', links: [{ kind: 'forecast', label: 'x', publisher: 'zzz', url: 'https://x.example/' }] }] }, 't')).toBeNull();
  });
  it('strips the "Forecast: " lead and keeps a label with no lead whole', () => {
    expect(linkText('Forecast: Banff')).toBe('Banff');
    expect(linkText('Climate of Costa Rica')).toBe('Climate of Costa Rica');
  });
  it('does not name a language the label already names', () => {
    const d = { publishers: { i: { short: 'IMN', langs: ['en', 'es'] } }, trips: [{ trip: 't', links: [{ kind: 'climate', label: 'Climate of the North Pacific region (PDF, Spanish)', publisher: 'i', url: 'https://i.example/p.pdf', english: false }] }] };
    expect(tripWeatherFrom(d, 't')!.sources[0]!.links[0]).toMatchObject({ language: null, lang: 'es' });
  });
});
