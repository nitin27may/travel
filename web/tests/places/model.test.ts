import { describe, expect, it } from 'vitest';
import { lineCoords, pointAlong, profilePoints, trackOfLines, accessFacts, directionsTarget, elevationAt, factByLabel, firstNumber, glanceFor, hutFacts, isUrl, lastRead, lerpPoint, linkTabs, observed, phoneParts, profileSummary, profileTicks, pointSourceInfo, routeLineInfo, publicProvenance, publicText, shortDate, sampleProfile, seasonMonths } from '@/components/places/model';
import { createPublicData } from '@/lib/public';
import type { Fact, PublicPlace } from '@/lib/public/types';

const data = createPublicData();
const place = (slug: string): PublicPlace => {
  const p = data.getPlace(slug);
  if (!p) throw new Error(`no place ${slug}`);
  return p;
};
const fact = (label: string, value: string): Fact => ({ label, value, provenance: 'Our research, read Aug 2026, (operator)', conflicts: [] });

describe('observed: dated operator facts read "observed 2026"', () => {
  it('turns a day-month range into the year it was seen', () => {
    expect(observed('Cable car 6 Jun - 18 Oct 2026')).toBe('Cable car, observed 2026');
    expect(observed('Year-round walk; shuttle 440 runs 14 Jun - 11 Oct 2026, line 446 otherwise')).toBe('Year-round walk; shuttle 440 runs, observed 2026, line 446 otherwise');
  });
  it('turns one date too, and leaves text without a dated year alone', () => {
    expect(observed('Opens 18 Oct 2026')).toBe('Opens, observed 2026');
    expect(observed('Jun-Oct; Rifugio Locatelli open in July')).toBe('Jun-Oct; Rifugio Locatelli open in July');
    expect(observed('Bus 444 from Dobbiaco')).toBe('Bus 444 from Dobbiaco');
  });
  it('never leaves a day and month of 2026 in the real data', () => {
    for (const p of data.internals.places) for (const f of p.facts) expect(observed(f.value)).not.toMatch(/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (- )?(\d{1,2} \w+ )?2026/);
  });
});

describe('phoneParts: public business numbers become tel: links', () => {
  it('splits around an international number', () => {
    const parts = phoneParts('Lunch at Averau, +39 0436 4660');
    expect(parts.map((p) => p.text).join('')).toBe('Lunch at Averau, +39 0436 4660');
    expect(parts.find((p) => p.tel)?.tel).toBe('+3904364660');
  });
  it('ignores short numbers and years', () => {
    expect(phoneParts('Built in 2026, 12 km').every((p) => !p.tel)).toBe(true);
    expect(phoneParts('+39 12').every((p) => !p.tel)).toBe(true);
  });
  it('finds the one phone number in the Dolomites data', () => {
    const all = data.internals.places.flatMap((p) => p.facts.map((f) => f.value)).filter((v) => phoneParts(v).some((x) => x.tel));
    expect(all.length).toBeGreaterThanOrEqual(1);
  });
});

describe('small helpers', () => {
  it('reads the first number and recognises URLs', () => {
    expect(firstNumber('3.5-4.5 h')).toBe(3.5);
    expect(firstNumber('450 m')).toBe(450);
    expect(firstNumber('none')).toBeNull();
    expect(isUrl('https://pass.auronzo.info')).toBe(true);
    expect(isUrl('see https://x.y')).toBe(false);
    expect(factByLabel([fact('Climb', '450 m')], 'climb')?.value).toBe('450 m');
  });
  it('marks written months open and nothing else', () => {
    const m = seasonMonths([6, 7]);
    expect(m.filter((x) => x === 'open')).toHaveLength(2);
    expect(m[5]).toBe('open');
    expect(m[0]).toBe('closed');
  });
});

describe('glance strip', () => {
  it('leads a trail with its six slots, each recorded fact with provenance; the AllTrails difficulty is gone (backlog 2.31)', () => {
    const g = glanceFor(place('tre-cime-di-lavaredo-loop'));
    expect(g.map((s) => s.label)).toEqual(['Distance', 'Climb', 'Time', 'Shape', 'Minimum age', 'Difficulty']);
    expect(g.filter((s) => s.fact).every((s) => s.fact?.provenance)).toBe(true);
    const difficulty = g.find((s) => s.label === 'Difficulty');
    expect(difficulty?.fact).toBeNull();
    expect(difficulty?.empty).toBe('Not checked yet: difficulty');
  });
  it('says what is missing instead of leaving a blank (a sight has no hours yet)', () => {
    const g = glanceFor({ kind: 'sight', facts: [] });
    expect(g.map((s) => s.empty)).toContain('Not checked yet: hours');
    expect(g.every((s) => s.fact === null && s.empty.length > 0)).toBe(true);
    expect(g).toHaveLength(6);
  });
  it('every kind in the data gets six slots and none is blank', () => {
    for (const p of data.internals.places) {
      const g = glanceFor(p);
      expect(g.length).toBeGreaterThan(0);
      for (const s of g) expect(Boolean(s.fact) || s.empty.length > 0).toBe(true);
    }
  });
  it('carries a conflict as extra values on the fact, never replacing it', () => {
    const fee = factByLabel(place('lago-di-braies').facts, 'Fee');
    expect(fee?.conflicts.length).toBeGreaterThan(0);
  });
  it('splits huts and access facts out of the main list', () => {
    const p = place('tre-cime-di-lavaredo-loop');
    expect(hutFacts(p.facts).map((f) => f.label)).toContain('Rifugio Locatelli');
    expect(accessFacts(p.facts).map((f) => f.label)).toContain('Fee');
  });
});

describe('directions', () => {
  it('goes to the first stored car park (lift-start trails go to the valley car park)', () => {
    const p = place('tre-cime-di-lavaredo-loop');
    const t = directionsTarget(p);
    expect(t?.source).toBe('parking');
    expect(t?.at.lat).toBeCloseTo(p.access?.parking[0].lat ?? 0, 5);
  });
  it('falls back to the trailhead, then the pin, then nothing', () => {
    const th = { lat: 1, lon: 2, pointSource: 'x', pointChecked: null, sourceLicence: '', name: 'TH', note: null, elevationM: null };
    expect(directionsTarget({ name: 'N', point: null, access: { trailhead: th, parking: [] } })?.source).toBe('trailhead');
    expect(directionsTarget({ name: 'N', point: { lat: 3, lon: 4, pointSource: 'x', pointChecked: null, sourceLicence: '' }, access: null })?.source).toBe('place');
    expect(directionsTarget({ name: 'N', point: null, access: null })).toBeNull();
  });
  it('uses only stored points: every place with a point has a target', () => {
    for (const p of data.internals.places) if (p.point || p.access) expect(directionsTarget(p)).not.toBeNull();
  });
});

describe('links as tabs', () => {
  it('makes the five tabs of patterns 3.6 with counts, and keeps empty ones', () => {
    const tabs = linkTabs(place('tre-cime-di-lavaredo-loop').links);
    expect(tabs.map((t) => t.label)).toEqual(['Official', 'Booking', 'Route', 'Conditions', 'Report']);
    expect(tabs.reduce((n, t) => n + t.links.length, 0)).toBe(place('tre-cime-di-lavaredo-loop').links.flatMap((g) => g.links).length);
    expect(linkTabs([]).every((t) => t.links.length === 0)).toBe(true);
  });
  it('reads the latest "read" date from the fact provenance', () => {
    expect(lastRead([fact('a', 'b'), { ...fact('c', 'd'), provenance: 'x, read 18 Oct 2026, (official)' }])).toBe('18 Oct 2026');
    expect(lastRead([fact('a', 'b')])).toBe('Aug 2026');
    expect(lastRead([])).toBeNull();
  });
});

describe('elevation profile sketch', () => {
  const input = { km: 10, gainM: 450, startM: 2320, loop: true, highM: null };
  it('is deterministic and spans the distance', () => {
    const a = sampleProfile(input);
    expect(a).toEqual(sampleProfile(input));
    expect(a[0].km).toBe(0);
    expect(a[a.length - 1].km).toBeCloseTo(10);
  });
  it('summarises in text for the img role', () => {
    expect(profileSummary(sampleProfile(input))).toMatch(/^10 km, \d+ m climb, high point [\d,]+ m at [\d.]+ km$/);
  });
  it('interpolates elevation and a straight-line guide position', () => {
    const pts = [{ km: 0, m: 100 }, { km: 10, m: 200 }];
    expect(elevationAt(pts, 5)).toBe(150);
    expect(elevationAt(pts, -1)).toBe(100);
    expect(elevationAt(pts, 99)).toBe(200);
    expect(lerpPoint({ lng: 0, lat: 0 }, { lng: 10, lat: 20 }, 0.5)).toEqual({ lng: 5, lat: 10 });
  });
});

describe('wording for visitors', () => {
  it('provenance names no file, record id or pipeline', () => {
    expect(publicProvenance('PLAN.md, read Aug 2026')).toBe('Our research, read Aug 2026');
    expect(publicProvenance('existing prototype catalogue, read Aug 2026')).toBe('Our research, read Aug 2026');
    expect(publicProvenance('OpenStreetMap node 2984514849, read 18 Oct 2026')).toBe('OpenStreetMap, read 18 Oct 2026');
    expect(publicProvenance('Overpass query 18 Oct 2026')).toBe('OpenStreetMap query 18 Oct 2026');
  });
  it('capture notes with record ids are dropped', () => {
    expect(publicText('Signpost 6 m from the Seeweg lake path (OSM relation 12043472)')).toBe('');
    expect(publicText("Unnamed lot beside the bus stop (OSM node 12106651301); confirm this is P1")).toBe('');
    expect(publicText('Closest lot, 3-4 min walk')).toBe('Closest lot, 3-4 min walk');
  });
  it('a pin source reads as words with a link to the record', () => {
    expect(pointSourceInfo({ pointSource: 'osm_node:2430381561', pointChecked: null })).toEqual({ text: 'From OpenStreetMap \u00b7 not yet checked', url: 'https://www.openstreetmap.org/node/2430381561' });
    expect(pointSourceInfo({ pointSource: 'prototype_approx', pointChecked: null }).text).toBe('Approximate position \u00b7 not yet checked');
  });
  it('the route line is a sentence with linked records', () => {
    const r = routeLineInfo([{ ref: 'osm_relation:1' }, { ref: 'osm_relation:2' }]);
    expect(r?.text).toBe('Route from OpenStreetMap (2 records); not yet confirmed by a person.');
    expect(r?.refs.map((x) => x.url)).toEqual(['https://www.openstreetmap.org/relation/1', 'https://www.openstreetmap.org/relation/2']);
  });
  it('shortDate formats an ISO date', () => {
    expect(shortDate('2026-10-18')).toBe('18 Oct 2026');
  });
});

describe('profile axes follow the units preference', () => {
  it('metric: km and metres', () => {
    const t = profileTicks(2300, 2600, 10, 'km', 'm');
    expect(t.x.at(-1)?.label).toBe('10 km');
    expect(t.y.map((v) => v.label)).toEqual(['2300', '2400', '2500', '2600']);
  });
  it('imperial: miles and feet, ticks placed at the right spot on the metric scale', () => {
    const t = profileTicks(2300, 2600, 10, 'mi', 'ft');
    expect(t.x.every((v) => v.label.endsWith(' mi'))).toBe(true);
    expect(t.x[1].at).toBeCloseTo(1.609344, 3);
    expect(t.y[0].label).toBe('8000');
    expect(Number(t.y[0].label) / 3.280839895).toBeCloseTo(t.y[0].at, 5);
    expect(t.y.some((v) => v.label.includes('m'))).toBe(false);
  });
});

describe('a stored track on the place page (L4b)', () => {
  const geometry: [number, number][] = [[11, 46], [11.01, 46], [11.01, 46.01]];
  const line = { ref: 'osm_relation:1', label: 'x', source: 's', exportable: true, geometry, dashed: false, credit: '© OpenStreetMap contributors (ODbL), read 19 Oct 2026', profile: { samples: [[0, 1500], [1, 1600]] as [number, number][], km: 1, gainM: 100, lossM: 0, highM: 1600, lowM: 1500, dem: 'd' } };
  it('puts the marker on the line, not on the straight guide', () => {
    const coords = lineCoords(geometry);
    const total = pointAlong(coords, 1000);
    expect(total).toEqual(coords[2]);
    const km = 0.7; // before the corner at about 0.77 km
    const p = pointAlong(coords, km)!;
    expect(p.lat).toBe(46);
    expect(p.lng).toBeGreaterThan(11);
    expect(p.lng).toBeLessThan(11.01);
    // a straight line from start to end would put the same distance off the track
    const straight = lerpPoint(coords[0], coords[2], 0.5);
    expect(straight.lat).not.toBe(46);
    expect(pointAlong(coords, 0)).toEqual(coords[0]);
    expect(pointAlong([], 1)).toBeNull();
  });
  it('turns the lines of a place into pieces to draw, a credit and the profile', () => {
    const t = trackOfLines([line])!;
    expect(t.lines).toHaveLength(1);
    expect(t.dashed).toBe(false);
    expect(t.exportable).toBe(true);
    expect(t.credit).toContain('OpenStreetMap');
    expect(profilePoints(t.profile!)).toEqual([{ km: 0, m: 1500 }, { km: 1, m: 1600 }]);
    expect(trackOfLines([{ ref: 'osm_relation:2', label: 'y', source: 's', exportable: false }])).toBeNull();
  });
  it('draws a held-back track dashed', () => {
    expect(trackOfLines([{ ...line, dashed: true, exportable: false }])!.dashed).toBe(true);
  });
  it('words a point as ours, with its source', () => {
    expect(pointSourceInfo({ pointSource: 'osm_node:123', pointChecked: null }).text).toBe('From OpenStreetMap · not yet checked');
  });
});
