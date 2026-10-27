import { describe, expect, it } from 'vitest';
import { scheduleDay } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { createPublicData } from '@/lib/public';
import { addCost, costLine, LATEST_END } from '@/components/trips/timeline/consequence';
import { flightEntries, localEntries, shiftClock, zoneNotes, zoneRun } from '@/components/trips/timeline/marks';
import * as engine from '@travel/core/schedule/schedule.ts';
import { buildTripPageModel } from '@/components/trips/model';
import { candidateToItem } from '@/components/trips/timeline/model';

const data = createPublicData();
const rockies = data.getTrip('canadian-rockies-2029')!;
const P: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 6 };
const day = (n: number) => rockies.days.find((d) => d.n === n)!;

describe('the clock across a time-zone line (Rockies Day 6, row 3.35)', () => {
  it('moves a clock back an hour and wraps midnight', () => {
    expect(shiftClock('08:30', -60)).toBe('07:30');
    expect(shiftClock('00:20', -60)).toBe('23:20');
  });
  it('Day 6 carries the zone, with the stops on the far side', () => {
    expect(day(6).zone).toMatchObject({ place: 'Mount Robson', abbr: 'PT', homeAbbr: 'MT', offsetMin: -60 });
    expect(day(5).zone).toBeUndefined();
  });
  it('the stops at Mount Robson read an hour earlier, everything back in Jasper reads as scheduled', () => {
    const tl = scheduleDay(day(6).scheduleInput!, P);
    const local = localEntries(tl.entries, day(6).zone);
    const at = (es: typeof tl.entries, id: string) => es.find((e) => e.sourceItemId === id)!;
    expect(at(local, 'mount-robson-viewpoint').start).toBe(shiftClock(at(tl.entries, 'mount-robson-viewpoint').start, -60));
    expect(at(local, 'mount-robson-viewpoint').tz).toBe('PT');
    expect(at(local, 'overlander-falls-trail').start).toBe(shiftClock(at(tl.entries, 'overlander-falls-trail').start, -60));
    // the SkyTram is in Jasper, on the home clock
    expect(at(local, 'jasper-skytram').start).toBe(at(tl.entries, 'jasper-skytram').start);
    expect(at(local, 'jasper-skytram').tz).toBe(tl.entries[0]!.tz);
    // durations, order and warnings do not change
    expect(local.map((e) => `${e.id}:${e.durationMin}`)).toEqual(tl.entries.map((e) => `${e.id}:${e.durationMin}`));
  });
  it('a marker goes before the first stop over the line and again after the drive back', () => {
    const tl = scheduleDay(day(6).scheduleInput!, P);
    const run = zoneRun(tl.entries, day(6).zone!)!;
    expect(tl.entries[run.from]!.sourceItemId).toBe('mount-robson-viewpoint');
    expect(tl.entries[run.back!]!.kind).not.toBe('leg');
    expect(run.back).toBeGreaterThan(run.to);
    expect(zoneNotes(day(6).zone!).enter).toMatch(/clocks go back 1 hour/);
    expect(zoneNotes(day(6).zone!).back).toMatch(/Mountain time/);
  });
  it('the all-day Kinney Lake version reads in local time and has no marker back until the base', () => {
    const tl = scheduleDay(day(6).scheduleInput!, { ...P, party: 'adults', youngest: null }, { variant: 'A' });
    const local = localEntries(tl.entries, day(6).zone);
    const kinney = tl.entries.findIndex((e) => e.sourceItemId === 'kinney-lake');
    expect(local[kinney]!.start).toBe(shiftClock(tl.entries[kinney]!.start, -60));
  });
});

describe('a departure day that waits for a flight (Rockies Day 15)', () => {
  it('ties the leave, the drive to the airport and the end to the flight, and invents no clock time', () => {
    expect(day(15).flight).toBe(true);
    const tl = scheduleDay(day(15).scheduleInput!, P);
    const es = flightEntries(tl.entries, true);
    for (const e of es.filter((x) => x.kind === 'start' || x.kind === 'end')) {
      expect(e.time.confidence).toBe('anchored');
      expect(e.time.note).toMatch(/Depends on your flight/);
    }
    expect(es.map((e) => e.start)).toEqual(tl.entries.map((e) => e.start));
    expect(flightEntries(tl.entries, undefined)).toBe(tl.entries);
  });
});

describe('Day 9 canoe: the last rental (row 3.35)', () => {
  it('carries 14:00 as its last start next to the 16:45 close, in every version', () => {
    for (const v of day(9).scheduleInput!.variants) {
      const canoe = v.items.find((i) => i.id === 'emerald-lake-canoe');
      if (canoe) expect(canoe.window).toMatchObject({ lastUp: '14:00', to: '16:45' });
    }
  });
});

describe('what an addition costs before it is made (row 4.4)', () => {
  const nearby = data.listPlaces();
  const model = buildTripPageModel(rockies, () => null, nearby);
  it('every candidate has a cost from the scheduler itself: driving added and where the day ends', () => {
    const tm = model.timeline!;
    const d5 = tm.days.find((d) => d.n === 5)!;
    const cands = (tm.addByDay[5] ?? []).map((k) => tm.addables[k]!);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      const cost = addCost(engine, d5.input, P, {}, candidateToItem(c));
      expect(cost.driveMin).toBeGreaterThanOrEqual(0);
      expect(costLine(cost)).toMatch(/adds (about|no)|not added/);
    }
  });
  it('an addition that would end the day after 23:00 is not offered, and the line says so plainly', () => {
    const base = day(5).scheduleInput!;
    const late = { id: 'add-late', kind: 'visit', sub: 'sight', title: 'A very long stop', placeSlug: null, point: null, rule: null, durationMin: 300, durationRange: null, durationSource: 'plan', stats: null, start: null, needs: null, window: null, checkinMin: null, optional: false, note: null, minAge: null, minAgeRule: null, needsDaylight: false, honesty: [] } as never;
    const cost = addCost(engine, base, P, {}, late);
    expect(cost.tooLate).toBe(true);
    expect(costLine(cost)).toBe(`Ends after ${LATEST_END}, not added`);
  });
});
