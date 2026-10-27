import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { tripWeatherFor, tripWeatherFrom, linkText } from '@/lib/public/weatherLinks';
import { MonthStrip } from '@/components/trips/summary/MonthStrip';
import { WhenToGo } from '@/components/trips/summary/WhenToGo';
import { cards, hero, monthStates, noteKind, stateSummary, legendStates } from '@/components/trips/summary/whenModel';

// UXB-4: When to go (spec trip-and-places-ux-fixes.md 6.2, W4; components 4.7). Real trips through the real adapters, plus the states no trip has yet.
const data = createPublicData();
const html = (slug: string) => {
  const t = data.getTrip(slug)!;
  return renderToStaticMarkup(<WhenToGo season={t.season} weather={tripWeatherFor(slug)} />);
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
    expect(cards({ tempC: '', rain: ' ', daylight: '', notes: [] }).filter((x) => x.value)).toHaveLength(0);
  });
});

describe('worth knowing: the warn glyph is for a closure or a hazard only (I9)', () => {
  it.each([
    ['Moraine Lake road closes in mid-October', 'warn'],
    ['Maligne cruise ends early October', 'warn'],
    ['Wind can close boats and the Fitz Roy ridge', 'warn'],
    ['Do not go in the Narrows if flash flood warnings are posted', 'warn'],
    ['Summer heat above 38 C makes midday hikes unsafe', 'warn'],
    ['Lagazuoi tunnels need a headlamp', 'info'],
    ['Larch gold peaks in the last third of September into early October', 'info'],
    ['Penguin colony season ends in March', 'info'],
    ['No darkness at any station, so northern lights are not possible in this window', 'info'],
  ] as const)('%s -> %s', (t, k) => expect(noteKind(t)).toBe(k));
});

describe('When to go on real trips', () => {
  it('the Rockies: a researched season, a hazard line at rest, advice behind a counted disclosure, forecasts and climate with the publisher named', () => {
    const h = html('canadian-rockies-2029');
    const t = text(h);
    expect(t).toContain('When to go');
    expect(t).toContain('Best time for this plan');
    expect(t).toContain('Early to late September');
    expect(h).toContain('September, best for this plan');
    expect(t).toContain('Other weeks have not been researched yet.');
    expect(t).toContain('Not checked yet');
    expect(h.match(/data-kind="warn"/g)).toHaveLength(2);
    expect(h).toMatch(/data-kind="info" data-extra="true"/);
    expect(h).not.toMatch(/data-kind="warn" data-extra/);
    expect(t).toContain('Show 1 more');
    expect(t).toContain('Environment Canada');
    expect(t).toContain('Parks Canada');
    expect(h).toContain('href="https://weather.gc.ca/en/location/index.html?coords=51.178,-115.571"');
    expect(h).toContain('target="_blank" rel="noopener noreferrer"');
    expect(h).toContain('>forecast, Environment Canada, opens in a new tab');
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
    expect(h).toContain('page in Italian');
    expect(h).toMatch(/data-secondary="true"/);
    expect(h).toContain('Not every base has its own forecast page yet.');
  });
  it('Patagonia (southern hemisphere): February and March, one honest SMN link, a gap line', () => {
    const h = html('patagonia-2027');
    expect(h).toContain('February, best for this plan');
    expect(h).toContain('March, best for this plan');
    expect(h).toContain('https://www.smn.gob.ar/');
    expect(h).toContain('Not every base has its own forecast page yet.');
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
    expect(w.sources[0]!.links[0]).toEqual({ kind: 'forecast', text: 'Town', href: 'https://a.example/town', language: 'French' });
    expect(w.sources[1]!.links).toHaveLength(1);
    expect(w.partial).toBe(false);
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
    expect(tripWeatherFrom(d, 't')!.sources[0]!.links[0]!.language).toBeNull();
  });
});
