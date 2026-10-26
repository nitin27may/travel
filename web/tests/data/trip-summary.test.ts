import { describe, expect, it } from 'vitest';
import { getPlace, getTrip, tripSlugs } from '@/lib/public';
import { summaryInput, tripShapeFor, tripSummaryFor } from '@/lib/public/summary';
import { buildTripExport } from '@/lib/export/build.server';
import { summaryLead, versionsText } from '@travel/core/trips/summary.ts';
import { dayDriveMin } from '@travel/core/trips/drive.ts';
import { describesParty } from '@travel/core/privacy/party.ts';

// UXB-C (trip-and-places-ux-fixes.md 3.5, 4.2, 4.7, 13.2): the Summary and the trip's shape on the real data. The numbers are the
// adapter's, measured on 26 Oct 2026; where they differ from the spec's table the spec's are older (see the UXB-C hand-back).

const summary = (slug: string) => tripSummaryFor(getTrip(slug)!, getPlace);

describe('Summary: Canadian Rockies (the test case)', () => {
  const s = summary('canadian-rockies-2029');
  it('names 2 provinces with the places the plan visits in each', () => {
    expect(s.regions).toEqual([{ name: 'Alberta', places: 29 }, { name: 'British Columbia', places: 6 }]);
  });
  it('names 4 national parks and the provincial parks the default plan visits', () => {
    expect(s.parks.filter((p) => p.kind === 'national').map((p) => p.name).sort()).toEqual(['Banff National Park', 'Jasper National Park', 'Kootenay National Park', 'Yoho National Park']);
    // the spec's table named two (Peter Lougheed, Mount Robson); the default plan also stops at the Canmore Nordic Centre and in Spray Valley
    expect(s.parks.filter((p) => p.kind === 'provincial').map((p) => p.name).sort()).toEqual([
      'Canmore Nordic Centre Provincial Park', 'Mount Robson Provincial Park', 'Peter Lougheed Provincial Park', 'Spray Valley Provincial Park',
    ]);
    // Kananaskis is not part of the World Heritage Site: the lead line must not say "all in"
    expect(s.heritage).toEqual([{ name: 'Canadian Rocky Mountain Parks', places: 25, all: false }]);
    expect(summaryLead(s)).toMatch(/^15 days through Alberta and British Columbia, in four national parks \(.+\) and four provincial parks \(.+\), with 25 stops in the Canadian Rocky Mountain Parks World Heritage Site$/);
  });
  it('counts bases, trails (all versions, with coverage), sights, activities, bookings and photos', () => {
    expect(s.counts).toMatchObject({
      bases: 4, stays: 5, sights: 27, activities: 15, photos: 41, highlights: 13,
      trails: { count: 33, km: 183.3, kmKnown: 33, gainM: 8401, gainKnown: 33 },
      bookings: { count: 7, dated: 0, earliest: null },
    });
  });
  it('has 13 highlights with days, a route folded into its payoff, photos from the place or the gallery section that names it', () => {
    // the gallery's own order (UXB-1F S2): the curator's sections run Moraine Lake, Lake Louise, Johnston Canyon, Peyto Lake, the Icefields
    // Parkway, the Columbia Icefield, Maligne Lake, Yoho; places with no photo follow in day order
    expect(s.highlights.map((h) => h.slug)).toEqual([
      'moraine-lake', 'lake-louise', 'johnston-canyon', 'peyto-lake-lookout-banff', 'icefields-parkway-scenic-drive', 'athabasca-glacier-and-columbia-icefield',
      'maligne-lake-and-spirit-island', 'takakkaw-falls', 'athabasca-falls', 'plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint',
      'larch-valley-to-sentinel-pass', 'highwood-pass-and-hwy-40-corridor', 'ptarmigan-cirque',
    ]);
    // S1: the first eight all have a photo (a caption or a section names the place's core)
    expect(s.highlights.slice(0, 8).every((h) => h.photo !== null)).toBe(true);
    const by = Object.fromEntries(s.highlights.map((h) => [h.slug, h]));
    expect(by['lake-louise']!.days).toEqual([3, 10]);
    expect(by['athabasca-glacier-and-columbia-icefield']!.days).toEqual([4, 8]);
    expect(by['moraine-lake']!.photo).toBe(0);
    expect(typeof by['takakkaw-falls']!.photo).toBe('number');
    const trip = getTrip('canadian-rockies-2029')!;
    for (const h of s.highlights) if (typeof h.photo === 'number') expect(trip.gallery[h.photo], h.slug ?? '').toBeTruthy();
  });
  it('says who it suits by version', () => {
    expect(versionsText(s.versions)).toBe("whole family on 14 days, adults' hike on 1");
  });
});

describe('Summary: Dolomites (full) and Costa Rica (overview) degrade', () => {
  it('Dolomites: 3 regions, 2 nature parks, 10 trails, 3 bookings with 1 dated', () => {
    const s = summary('dolomites-2027');
    expect(s.regions.map((r) => r.name)).toEqual(['South Tyrol', 'Veneto', 'Trentino']);
    expect(s.parks.map((p) => [p.name, p.kind])).toEqual([['Fanes-Sennes-Prags Nature Park', 'nature'], ['Puez-Odle Nature Park', 'nature']]);
    expect(s.counts.trails).toEqual({ count: 10, km: 90.9, kmKnown: 10, gainM: 4963, gainKnown: 10 });
    expect(s.counts.bookings.count).toBe(3);
    expect(s.counts.bookings.dated).toBe(1);
    expect(s.counts.bookings.earliest).toMatchObject({ name: 'Tre Cime toll road slot', day: 3 });
    expect(s.counts.bookings.earliest!.rule).toMatch(/^Opens 30 days before Day 3/);
    expect(s.highlights.map((h) => h.slug)).toEqual(['lago-di-braies', 'tre-cime-di-lavaredo-loop', 'lago-di-sorapis', 'alpe-di-siusi', 'otzi-south-tyrol-museum-of-archaeology']);
    expect(summaryLead(s)).toBe('14 days through South Tyrol, Veneto and Trentino, in two nature parks (Fanes-Sennes-Prags, Puez-Odle), with five stops in the Dolomites World Heritage Site');
  });
  it('Costa Rica: no regions, parks, counts, shape or bookings; gallery sections as highlights with no days', () => {
    const s = summary('costa-rica-2027');
    expect(s.flags).toEqual({ days: false, regions: false, parks: false, counts: false, bookings: false, highlights: true, photos: true, shape: false });
    expect(s.regions).toEqual([]);
    expect(s.parks).toEqual([]);
    expect(s.highlights.length).toBeGreaterThan(0);
    for (const h of s.highlights) expect(h).toMatchObject({ slug: null, days: [] });
    expect(summaryLead(s)).toBe('10 nights in Costa Rica. This plan has not been converted to days yet.');
    expect(tripShapeFor(getTrip('costa-rica-2027')!, getPlace)).toBeNull();
  });
});

describe('Summary: every trip', () => {
  it('stays under 2 KB serialised (P8) and carries no household data', () => {
    for (const slug of tripSlugs()) {
      const s = summary(slug);
      const json = JSON.stringify(s);
      expect(json.length, slug).toBeLessThan(2048);
      // no party, no traveller key, no child's age (navigation-and-mine 2.3; spec 15)
      expect(json, slug).not.toMatch(/"(?:adults|children|travellers|youngest|party|profile)":/);
      expect(describesParty(summaryLead(s)), slug).toBe(false);
    }
  });
  it('counts the bookings the export model lists, no more', () => {
    for (const slug of tripSlugs()) {
      const trip = getTrip(slug)!;
      if (trip.depth === 'overview') continue;
      expect(summaryInput(trip, getPlace).bookings.map((b) => b.name), slug).toEqual(buildTripExport(trip).bookings.map((b) => b.name));
    }
  });
});

describe("The trip's shape on the real timelines (spec 4.2)", () => {
  it('Rockies at the default party', () => {
    const sh = tripShapeFor(getTrip('canadian-rockies-2029')!, getPlace)!;
    expect(sh.sets.longDrive).toEqual([1, 4, 5, 8]);
    expect(sh.sets.booking).toEqual([1, 4, 5, 10, 11]);
    expect(sh.sets.warning).toEqual([2, 4, 7, 10, 12, 13]);
    // the spec's table said 7 (no Day 5); Day 5's family version visits Maligne Lake and Spirit Island, a highlight
    expect(sh.sets.highlight).toEqual([3, 4, 5, 8, 9, 10, 11, 14]);
    expect(sh.countLine).toBe('15 days · 4 long drive days · 5 days with a booking · 8 highlight days · 6 days with a warning');
    expect(sh.ribbon.map((r) => [r.name, r.nights])).toEqual([['Banff', 2], ['Lake Louise village', 1], ['Jasper townsite', 4], ['Lake Louise village', 4], ['Kananaskis Village / Peter Lougheed PP', 3]]);
    expect(sh.tail).toEqual({ days: [15], label: 'Flight home' });
    expect(sh.rows[5]!.notes.map((n) => n.text)).toEqual(["Adults' hike"]);
    expect(JSON.stringify(sh)).not.toMatch(/The plan's day/);
  });
  it('Dolomites at the default party', () => {
    const sh = tripShapeFor(getTrip('dolomites-2027')!, getPlace)!;
    expect(sh.countLine).toBe('14 days · 2 long drive days · 3 days with a booking · 5 highlight days · 5 days with a warning');
    expect(sh.sets.booking).toEqual([2, 3, 12]);
  });
});

describe('One drive figure (spec 4.7, finding I14)', () => {
  it('the cover average is the mean of what the day rows show, for every trip with a schedule', () => {
    for (const slug of tripSlugs()) {
      const trip = getTrip(slug)!;
      if (!trip.schedule) continue;
      const per = trip.days.map((d) => dayDriveMin(trip.schedule!.timelines.find((t) => t.day === d.n), d.driveMin)).filter((m): m is number => m !== null);
      const mean = per.reduce((a, b) => a + b, 0) / per.length;
      expect(Math.abs(trip.driveAvgMin! - mean), slug).toBeLessThanOrEqual(2.5);
    }
  });
  it('the Rockies cover says about 2 h a day, not the seed 1 h 40', () => {
    const trip = getTrip('canadian-rockies-2029')!;
    expect(trip.schedule!.timelines.reduce((s, t) => s + t.totals.driveMin, 0)).toBe(1765);
    expect(trip.driveAvgMin).toBe(120);
    expect(getTrip('dolomites-2027')!.driveAvgMin).toBe(90);
  });
});
