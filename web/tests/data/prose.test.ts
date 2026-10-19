import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import {
  KNOW_GROUPS, dayKnow, datesToYear, dropDatedParens, hasMarker, noteBlock, noteLine, plainOf, prepareSentence, quantityRuns, scrubMarkers, stripMarkers,
} from '@/lib/public/prose';
import { formatDistance, formatElevation } from '@/lib/format/units';

const MARKERS = /\b(INFERENCE|CALC|GAP)\b|low confidence|\(\s*\d{1,2}:\d{2}\s+CALC\)/;
const SUN = { sunset: ['19:55', '20:30'] as [string, string], sunrise: ['07:05', '07:25'] as [string, string] };

describe('markers become chips (spec 5.1)', () => {
  it.each([
    ['about 1 h each way (INFERENCE, not in the matrix)', 'about 1 h each way', ['estimate']],
    ['Vermilion Lakes Drive for the last hour before sunset (20:16 CALC).', 'Vermilion Lakes Drive for the last hour before sunset (about 19:55 to 20:30).', []],
    ['Rental about C$10-12 a day at Banff shops (2025-26 blogs, low confidence).', 'Rental about C$10-12 a day at Banff shops.', ['low_confidence']],
    ['Cave and Basin (hours and admission GAP)', 'Cave and Basin (hours and admission not known yet)', ['not_known']],
    ['Whether a young child counts toward four is a GAP.', 'Whether a young child counts toward four is not known yet.', ['not_known']],
    ['Parks Canada 28 Aug-2 Oct; a blog says 1 Sep-6 Oct (2026, conflict)', 'Parks Canada 28 Aug-2 Oct; a blog says 1 Sep-6 Oct', ['sources_disagree']],
  ])('%s', (input, out, chips) => {
    const r = stripMarkers(input, SUN);
    expect(r.text).toBe(out);
    expect([...r.chips].sort()).toEqual([...chips].sort());
    expect(MARKERS.test(r.text)).toBe(false);
  });
  it('turns a status flag line into a bullet with its chip', () => {
    expect(stripMarkers('GAP: Maligne Canyon status in 2029')).toEqual({ text: 'Maligne Canyon status in 2029: not known yet.', chips: ['not_known'] });
    expect(stripMarkers('INFERENCE: drive time from the matrix')).toEqual({ text: 'Drive time from the matrix: an estimate.', chips: ['estimate'] });
  });
  it('leaves an ordinary word alone ("checked" in "checked luggage")', () => {
    expect(stripMarkers('even checked luggage is not allowed').text).toBe('even checked luggage is not allowed');
  });
  it('drops a 2026 hours parenthesis rather than a whole instruction, and keeps the year', () => {
    expect(datesToYear('rated Poor on 8 Oct 2026')).toBe('rated Poor in 2026');
    expect(dropDatedParens('Book a 10:00 cruise (2026: 7 Sep-3 Oct, 09:00-17:30)').text).toBe('Book a 10:00 cruise');
    const s = prepareSentence('Book a 10:00 cruise (2026: 7 Sep-3 Oct, 09:00-17:30; morning calm is the common advice).');
    expect(s).toEqual({ plain: 'Book a 10:00 cruise.', chips: ['pattern_2026'] });
  });
  it('replaces record ids with names and drops bare id parentheses', () => {
    const names = new Map([['maligne-canyon', 'Maligne Canyon']]);
    expect(prepareSentence('If Maligne Canyon (maligne-canyon) has reopened by 2029, stop.', { names })!.plain).toBe('If Maligne Canyon has reopened by 2029, stop.');
    expect(prepareSentence('Opal Hills (opal-hills, 8.2 km, 460 m) is shorter.')!.plain).toBe('Opal Hills (8.2 km, 460 m) is shorter.');
  });
  it("says the plan's tracks in words", () => {
    expect(prepareSentence('No Track A: arrival day.')!.plain).toBe("No adults' hike: arrival day.");
  });
  it('scrubMarkers cleans every string of a built value in place', () => {
    const v = { a: 'ok', b: ['x (INFERENCE)', { c: 'price GAP' }] };
    scrubMarkers(v);
    expect(JSON.stringify(v)).not.toMatch(MARKERS);
  });
});

describe('quantities (spec 5.2)', () => {
  const q = (t: string) => quantityRuns(t).filter((r) => 'qty' in r);
  it('parses distances, elevations and temperatures', () => {
    expect(q('Fenland Loop 1.9 km, 20 m, 45 min, flat.')).toEqual([
      { qty: 1.9, unit: 'km', dim: 'distance', decimals: 1 },
      { qty: 20, unit: 'm', dim: 'elevation', decimals: 0 },
    ]);
  });
  it.each([
    ['Highway 93 is closed', 0],
    ['Hwy 40 to Highway 1A and Route 100', 0],
    ['Parking is at P4', 0],
    ['Allow 45 min and 2 h', 0],
    ['a 1A lot', 0],
  ])('leaves names and times alone: %s', (t, n) => expect(q(t)).toHaveLength(n));
  it('reads 500 m next to a km figure as elevation, and a bare 30 m as a distance in km', () => {
    expect(q('10.4 km, 500 m, 4-5 h')[1]).toMatchObject({ qty: 500, unit: 'm', dim: 'elevation' });
    expect(q('stay at least 30 m from all elk')[0]).toMatchObject({ unit: 'km', dim: 'distance', decimals: 3, qty: 0.03 });
    expect(q('climbs 750 m to the pass')[0]).toMatchObject({ dim: 'elevation' });
    expect(q('starting at 2,206 m')).toHaveLength(1);
  });
  it('keeps ranges as ranges', () => {
    expect(q('walk 10-12 km out and back')[0]).toMatchObject({ qty: 10, to: 12, unit: 'km' });
    expect(q('day highs of 9-12 C')[0]).toMatchObject({ qty: 9, to: 12, unit: 'C', dim: 'temperature' });
  });
  it('round-trips to the same metric text', () => {
    for (const t of ['Fenland Loop 1.9 km, 20 m, 45 min, flat.', 'stay at least 30 m from all elk', 'walk 10-12 km out and back']) expect(plainOf(quantityRuns(t))).toBe(t);
  });
  it('renders through the unit preference so the note and the item line agree', () => {
    const runs = quantityRuns('Lower Falls 1.1 km one way, 85 m.');
    const km = runs.find((r) => 'qty' in r && r.unit === 'km') as { qty: number };
    const m = runs.find((r) => 'qty' in r && r.unit === 'm') as { qty: number };
    expect(formatDistance(km.qty, 'mi')).toBe(formatDistance(1.1, 'mi'));
    expect(formatDistance(km.qty, 'mi')).toBe('0.7 mi');
    expect(formatElevation(m.qty, 'ft')).toBe('280 ft');
  });
  it('parses twenty real Rockies strings without throwing and without touching road numbers', () => {
    const real = [
      '10.4 km, 500 m, 4-5 h from Maligne Lake', 'Mary Schaffer Loop 3.2 km, 84 m', 'Moose Lake Loop 2.7 km, 59 m on the drive out',
      'Lower Falls 1.1 km one way, 85 m; exposed catwalks', 'Then Hwy 93S into Kootenay: Marble Canyon 1.8 km, 65 m, fenced bridges', 'Paint Pots 2.0 km, 35 m',
      'Peyto Lake lookout, 1.2 km and 30 m, by 09:30', 'Bow Glacier Falls is 3.8 km each way, too long', 'Athabasca Falls is 200 m; Sunwapta upper falls is a few steps',
      'toe of the glacier 1.8 km, 60 m', 'Altitude 2,159-2,385 m: low risk after a night at 1,383 m', 'Stewart Canyon bridge is 1.6 km one way',
      'keep children close; stay at least 30 m from all elk (a Banff specialist suggests 60 m in rut)', 'Ptarmigan Cirque 4.5 km, 210 m, 2-3 h, starting at 2,206 m',
      'At 2,000-2,500 m expect day highs of 9-12 C and nights below freezing', 'Wedge Pond on the way back: 1 km, flat', 'Takakkaw Falls walk 1.8 km flat at 08:00',
      'Lakeshore loop 5.2 km with a muddy, rooty east side', 'on Highway 93 north of Banff, 17 km of road', 'The Rockpile is a 0.7 km loop with stairs',
    ];
    expect(real).toHaveLength(20);
    for (const t of real) {
      const runs = quantityRuns(t);
      expect(plainOf(runs).replace(/,/g, '')).toBe(t.replace(/,/g, ''));
      expect(runs.some((r) => 'qty' in r && (r.qty === 93 || r.qty === 1 || r.qty === 40) && /Highway|Hwy/.test(t) && r.unit === 'm' && !/\bkm\b/.test(t)), t).toBe(false);
    }
    expect(quantityRuns('on Highway 93 north of Banff, 17 km of road').filter((r) => 'qty' in r)).toEqual([{ qty: 17, unit: 'km', dim: 'distance', decimals: 0 }]);
  });
});

describe('Know before you go (spec 5.3)', () => {
  const long = 'Leave Jasper 07:30. Book a 10:00 cruise. The boat stops at an overlook; no toilet on board; no strollers. Then Mary Schaffer Loop 3.2 km, 84 m. Maligne Road: wildlife, slow down, stay in the car. Evening: Pyramid Lake for calm water.';
  it('keeps the first sentence as the lead and groups the rest in the fixed order', () => {
    const b = noteBlock(long);
    expect(b.lead?.plain).toBe('Leave Jasper 07:30.');
    const order = b.know.map((g) => g.group);
    expect(order).toEqual([...KNOW_GROUPS].filter((g) => order.includes(g)));
    expect(order).toEqual(['Book', 'Getting there', 'With kids', 'Other']);
    expect(b.know.find((g) => g.group === 'With kids')!.bullets[0]!.plain).toContain('no strollers');
  });
  it('leaves a short note as a single lead line', () => {
    const b = noteBlock('Zero walking. Last ride up 19:30.');
    expect(b.know).toEqual([]);
    expect(b.lead?.plain).toBe('Zero walking. Last ride up 19:30.');
  });
  it('puts the decision rule, the wet-weather swap and the flags in the day groups', () => {
    const g = dayKnow({ decisionRule: 'If the Parkway is closed, stay a second night.', wetWeather: 'Fewer stops, same order.', statusFlags: ['GAP: Num-Ti-Jah Lodge open status'] });
    expect(g.map((x) => x.group)).toEqual(['Conditions', 'Decide on the day', 'If it rains']);
    expect(g[0]!.bullets[0]).toEqual({ plain: 'Num-Ti-Jah Lodge open status: not known yet.', chips: ['not_known'] });
  });
  it('noteLine joins a short note and keeps its chips', () => {
    expect(noteLine('Fits the block (INFERENCE). Bighorn sheep.')).toEqual({ plain: 'Fits the block. Bighorn sheep.', chips: ['estimate'] });
  });
});

describe('Rockies Day 5 as built', () => {
  const data = createPublicData();
  const day = data.getTrip('canadian-rockies-2029')!.days.find((d) => d.n === 5)!;
  it('keeps the track notes as a lead line plus grouped bullets, in the fixed group order', () => {
    const b = day.variants.find((v) => v.key === 'B')!.notes;
    expect(b.lead?.plain).toBe('Leave Jasper 07:30.');
    const order = b.know.map((g) => g.group);
    expect(order).toEqual([...KNOW_GROUPS].filter((g) => order.includes(g)));
    expect(order[0]).toBe('Book');
  });
  it("carries the day's own groups: conditions, decide on the day, if it rains", () => {
    expect(day.know.map((g) => g.group)).toEqual(['Conditions', 'Decide on the day', 'If it rains']);
  });
  it('shows the sunset range, not a typed time', () => {
    expect(day.light).toBe('Sunrise about 07:13 to 07:36, sunset about 19:54 to 20:28 in this window.');
    const d1 = data.getTrip('canadian-rockies-2029')!.days.find((d) => d.n === 1)!;
    const text = JSON.stringify(d1.variants);
    expect(text).toContain('about 19:43 to 20:16');
    expect(text).not.toContain('20:16 CALC');
  });
});

describe('the marker sweep', () => {
  it('no adapter string for any trip carries a research marker', () => {
    const data = createPublicData();
    const hits: string[] = [];
    const walk = (v: unknown, where: string): void => {
      if (typeof v === 'string') {
        if (hasMarker(v) || MARKERS.test(v)) hits.push(`${where}: ${v.slice(0, 80)}`);
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
    };
    for (const t of data.internals.trips) walk(t, t.slug);
    for (const p of data.internals.places) walk(p, p.slug);
    expect(hits).toEqual([]);
  });
});
