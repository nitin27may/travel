// Review STEP2-PRV PR-012 and PR-013: the address a print line, a CSV cell and an ICS LOCATION carry is the Directions target's, as the card
// shows it, named when it is an access point's; the person's own trip (ownModel) keeps it; Copy address copies the words as shown, "Near"
// included, with the point on a second line. And PR-011: the cover and Mine's hand-off reach the one calendar builder.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { privacyHits } from '@travel/core/privacy/detect.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { TripPrintView } from '@/components/actions/TripPrintView';
import { buildTripPageModel } from '@/components/trips/model';
import { buildTripExport } from '@/lib/export/build.server';
import { tripCsv } from '@/lib/export/csv';
import { ownIcs, ownModel, ownTripOf } from '@/lib/export/own';
import type { TimelineSession } from '@/lib/export/timelineState';
import { getPlace, getTrip } from '@/lib/public';
import { addressClipboard, addressLine, exportAddress, type PageAddress } from '@/lib/public/address';
import { copy } from '../trip-edit/helpers';
import { parseIcs } from './helpers';

const SLUG = 'canadian-rockies-2029';
const NOW = new Date(Date.UTC(2026, 9, 18, 12, 0, 0));
const NEAR: PageAddress = { ref: 'part/place/lake-louise#parking', name: 'Lake Louise Lakeshore parking', kind: 'nearest_road', lines: ['Lake Louise Drive'], locality: 'Improvement District No. 9', postcode: null };
// the versions that hold the access-point places: Lake Louise on Day 10 and Wedge Pond on Day 14 are in their C versions
const PICKS: Record<number, string> = { 10: 'C', 14: 'C' };
const POSTAL: PageAddress = { ref: 'place/x', name: 'X', kind: 'postal', lines: ['224 Banff Avenue'], locality: 'Banff', postcode: 'T1L 1A3' };

describe('the address words (PR-012, PR-013)', () => {
  it('a file names whose address it is when it is an access point, and keeps "near" for a nearest-road one', () => {
    expect(exportAddress(NEAR, 'place/lake-louise')).toBe('Lake Louise Lakeshore parking, near Lake Louise Drive, Improvement District No. 9');
    expect(exportAddress(POSTAL, 'place/x')).toBe('224 Banff Avenue, Banff, T1L 1A3');
    expect(exportAddress(POSTAL, 'place/other')).toBe('X, 224 Banff Avenue, Banff, T1L 1A3');
  });
  it('Copy address copies the words as shown ("Near" kept), then the point the card goes to, which a map app takes as it is', () => {
    const text = addressClipboard(NEAR, { lat: 51.416667, lon: -116.217712 });
    expect(text).toBe('Near Lake Louise Drive, Improvement District No. 9\n51.41667, -116.21771');
    expect(text.split('\n')[0]).toBe(addressLine(NEAR));
    expect(addressClipboard(POSTAL, null)).toBe('224 Banff Avenue, Banff, T1L 1A3');
  });
});

describe('the Rockies exports carry the Directions target address', () => {
  const trip = getTrip(SLUG)!;
  const data = buildTripExport(trip);
  const page = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, []);
  const profile = trip.schedule!.defaultProfile;
  const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile, PICKS);
  const draft = (copyToPlanDraft(copy({ slug: SLUG, title: 'Canadian Rockies', start: '2029-09-08', adults: 2, children: [10], overrides: { '10': 'C', '14': 'C' } })) as { success: true; data: PlanDraft }).data;
  const own = ownTripOf({ doc: draft, slug: SLUG, title: 'Canadian Rockies', ourTitle: 'Canadian Rockies', party: { adults: 2, children: [10] }, days: page.timeline!.days, addables: () => undefined });
  const session: TimelineSession = { slug: SLUG, profile, defaults: profile, overrides: PICKS, added: [], timelines, sunPoints: {}, route: page.route };

  it('the published model: the access-point stops (Lake Louise, Maligne Lake, Wedge Pond) name their car park', () => {
    const louise = data.stops.find((s) => s.placeSlug === 'lake-louise')!;
    expect(louise.address).toBe('Lake Louise Lakeshore parking, near Lake Louise Drive, Improvement District No. 9');
    const slugs = new Set(data.stops.filter((s) => s.address).map((s) => s.placeSlug));
    expect([...slugs].sort()).toEqual(expect.arrayContaining(['lake-louise', 'maligne-lake-and-spirit-island', 'wedge-pond']));
    // the address belongs to the record the place's Directions card goes to (sections.address), never another place's
    for (const s of data.stops.filter((x) => x.address)) expect(s.address).toContain(getPlace(s.placeSlug!)!.sections!.address!.name);
  });

  it('the person\'s own trip keeps it: print line, CSV cell and ICS LOCATION with "near"', () => {
    const m = ownModel(data, session, own);
    for (const slug of ['lake-louise', 'wedge-pond']) {
      const at = m.stops.filter((s) => s.placeSlug === slug);
      expect(at.length, slug).toBeGreaterThan(0);
      for (const s of at) expect(s.address).toBe(data.stops.find((x) => x.placeSlug === slug)!.address);
    }
    const html = renderToStaticMarkup(TripPrintView({ data: m, session, own }));
    expect(html).toContain('print-model-addr');
    expect(html).toMatch(/Lake Louise Lakeshore parking, near Lake Louise Drive/);
    expect(tripCsv(m)).toMatch(/near Lake Louise Drive/);
    const { text } = ownIcs(data, session, own, NOW);
    const located = parseIcs(text).events.filter((e) => /near Lake Louise Drive/.test(e.get('LOCATION') ?? ''));
    expect(located.length).toBeGreaterThan(0);
    for (const e of located) expect(e.get('GEO')).toMatch(/^-?\d+(\.\d+)?;-?\d+(\.\d+)?$/);
    // a LOCATION value sits after a colon, which the street rule leaves alone (ES-012): the file passes the privacy net
    expect(privacyHits(text)).toEqual([]);
  });
});

describe('one calendar builder (PR-011)', () => {
  afterEach(() => vi.restoreAllMocks());
  it('Mine\'s request is read once on the copy\'s page, for that copy only', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', { sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });
    const { requestCalendar, takeCalendarRequest, CALENDAR_KEY } = await import('@/lib/export/ownCalendar');
    expect(requestCalendar('copy-a')).toBe(true);
    expect(takeCalendarRequest('copy-b')).toBe(false);
    expect(store.get(CALENDAR_KEY)).toBe('copy-a');
    expect(takeCalendarRequest('copy-a')).toBe(true);
    expect(takeCalendarRequest('copy-a')).toBe(false);
    vi.unstubAllGlobals();
  });
  it('Mine (flag on) opens the copy and asks there; it never builds a file from the published plan itself', async () => {
    const { readFileSync } = await import('node:fs');
    const mine = readFileSync(new URL('../../components/mine/MyTrips.tsx', import.meta.url), 'utf8');
    const block = mine.slice(mine.indexOf('const calendar = useCallback'), mine.indexOf('/** Undo of an account Remove'));
    expect(block.indexOf('if (TRIP_EDIT_ON)')).toBeGreaterThan(-1);
    expect(block.indexOf('requestCalendar(r.item.id)')).toBeLessThan(block.indexOf('loadExport'));
    const shell = readFileSync(new URL('../../components/trips/edit/shell/TripShell.tsx', import.meta.url), 'utf8');
    expect(shell).toContain('useCalendarHandOff(');
    expect(shell).toContain('downloadTripCalendar({ key, slug, start: doc.start, device })');
    expect(shell).not.toMatch(/downloadOwnIcs|c\.downloadIcs/);
  });
  it('the builder makes the own file when the page has published its days: the same text the cover makes', async () => {
    const trip = getTrip(SLUG)!;
    const data = buildTripExport(trip);
    const page = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, []);
    const profile = trip.schedule!.defaultProfile;
    const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile, PICKS);
    const draft = (copyToPlanDraft(copy({ slug: SLUG, title: 'Canadian Rockies', start: '2029-09-08', adults: 2, children: [10], overrides: { '10': 'C', '14': 'C' } })) as { success: true; data: PlanDraft }).data;
    const own = ownTripOf({ doc: draft, slug: SLUG, title: 'Canadian Rockies', ourTitle: 'Canadian Rockies', party: { adults: 2, children: [10] }, days: page.timeline!.days, addables: () => undefined });
    const session: TimelineSession = { slug: SLUG, profile, defaults: profile, overrides: PICKS, added: [], timelines, sunPoints: {}, route: page.route };
    const saved: string[] = [];
    vi.doMock('@/lib/export/download', () => ({ fileName: (s: string, e: string) => `${s}.${e}`, saveFile: (_n: string, _t: string, text: string) => void saved.push(text) }));
    vi.doMock('@/lib/client/data', () => ({ loadExport: async () => data }));
    vi.resetModules();
    const { publishOwn } = await import('@/lib/export/ownState');
    const { publishTimeline } = await import('@/lib/export/timelineState');
    const { downloadTripCalendar } = await import('@/lib/export/ownCalendar');
    publishOwn(own);
    publishTimeline(session);
    // the cover's press and Mine's hand-off pass the same arguments for a copy (the hand-off has no device model: a copy has none)
    const a = await downloadTripCalendar({ key: SLUG, slug: SLUG, start: '2029-09-08' });
    const b = await downloadTripCalendar({ key: SLUG, slug: SLUG, start: '2029-09-08', device: undefined });
    expect(a.summary).toBe(b.summary);
    expect(a.summary).toMatch(/15 all-day events, \d+ timed/);
    const uids = (t: string) => parseIcs(t).events.map((e) => e.get('UID')).join('\n');
    expect(saved).toHaveLength(2);
    expect(uids(saved[0]!)).toBe(uids(saved[1]!));
    // it is the own builder: the timed events and their LOCATION, not the published plan's all-day file
    const own1 = ownIcs(data, session, own, NOW).text;
    expect(uids(saved[0]!)).toBe(uids(own1));
    expect(parseIcs(saved[0]!).events.some((e) => /near Lake Louise Drive/.test(e.get('LOCATION') ?? ''))).toBe(true);
    publishOwn(null);
    publishTimeline(null);
    vi.doUnmock('@/lib/export/download');
    vi.doUnmock('@/lib/client/data');
  });
});
