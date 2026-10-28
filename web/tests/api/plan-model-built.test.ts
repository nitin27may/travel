import { describe, expect, it } from 'vitest';
import { BUILT_VARIANT_LABEL, clockOf, tripPageModelForBuilt } from '@travel/core/plan/pageModel.ts';
import { parsePlanDraft, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { tripPlanModel } from '@travel/core/schema/api/index.ts';
import type { ResolveRow } from '@travel/core/schema/favourites.ts';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { sampleDraft } from '../../../core/test/plan/helpers';

// STEP2-M (gap-analysis D7): tripPageModelForBuilt maps a builder draft's last build onto the details page's model, so a built plan
// renders at /t/<id>/ with the same components as a copy: days with times, bases and kinds, from the build and the resolve rows only.

const row = (ref: string, slug: string, name: string, kind: string, state: ResolveRow['state'] = 'current'): ResolveRow => ({
  asked: ref, state, space: 'place', slug, ref, name, kind, cc: 'IT',
});

/** A trip-mode build over three days and two bases: a move day, a routed leg, an untimed day and a visit past midnight. */
function tripDraft(): PlanDraft {
  return sampleDraft({
    where: { mode: 'trip', cc: 'IT', regions: [] },
    nights: 3,
    picks: [
      { ref: 'route/sentiero-alto', slug: 'sentiero-alto', name: 'Sentiero alto', must: true },
      { ref: 'place/lago-verde', slug: 'lago-verde', name: 'Lago Verde', must: false },
      { ref: 'place/rifugio-cena', slug: 'rifugio-cena', name: 'Rifugio dinner', must: false },
      { ref: 'place/old-name', slug: 'old-name', name: 'Snapshot name', must: false },
      { ref: 'place/star-point', slug: 'star-point', name: 'Star point', must: false },
    ],
    bases: [
      { town: 'it-tn-alpha', nights: 2, pinned: true },
      { town: 'it-bz-beta', nights: 1, pinned: false },
    ],
    edits: [],
    lastBuild: {
      engine: 'tb-e1.1',
      basis: 'mixed',
      bases: [
        { town: 'it-tn-alpha', name: 'Alpha', nights: 2, pinned: true, picks: 2, reasons: [] },
        { town: 'it-bz-beta', name: 'Beta', nights: 1, pinned: false, picks: 2, reasons: [] },
      ],
      days: [
        {
          day: 1, base: 'it-tn-alpha', move: false, returnMin: 30, warnings: ['W_DAYLIGHT'], reasons: [],
          items: [
            { ref: 'route/sentiero-alto', slug: 'sentiero-alto', name: 'Sentiero alto', startMin: 540, visitMin: 240, driveMin: 25, basis: 'routed', locked: true },
            { ref: 'place/lago-verde', slug: 'lago-verde', name: 'Lago Verde', startMin: 840, visitMin: 60, driveMin: 15, basis: 'estimate', locked: false },
          ],
        },
        {
          day: 2, base: 'it-bz-beta', move: true, returnMin: null, warnings: [], reasons: [],
          items: [
            { ref: 'place/old-name', slug: 'old-name', name: 'Snapshot name', startMin: null, visitMin: 45, driveMin: null, basis: null, locked: false },
            { ref: 'place/rifugio-cena', slug: 'rifugio-cena', name: 'Rifugio dinner', startMin: null, visitMin: 90, driveMin: 40, basis: 'estimate', locked: false },
          ],
        },
        {
          day: 3, base: 'it-bz-beta', move: false, returnMin: null, warnings: [], reasons: [],
          items: [{ ref: 'place/star-point', slug: 'star-point', name: 'Star point', startMin: 1470, visitMin: 30, driveMin: null, basis: null, locked: false }],
        },
      ],
      didNotFit: [],
      spareDays: 0,
      builtAt: '2026-10-27T10:00:00.000Z',
    },
  });
}

const ROWS: ResolveRow[] = [
  row('route/sentiero-alto', 'sentiero-alto', 'Sentiero Alto', 'trail'),
  row('place/lago-verde', 'lago-verde', 'Lago Verde', 'lake'),
  row('place/rifugio-cena', 'rifugio-cena', 'Rifugio Cena', 'eatery'),
  // a pick our list no longer has: the draft's snapshot name stands, the kind reads as a sight
  { asked: 'place/old-name', state: 'unknown', space: null, slug: null, ref: null, name: null, kind: null, cc: null },
  row('place/star-point', 'star-point', 'Star Point', 'viewpoint'),
];

describe('tripPageModelForBuilt', () => {
  it('the fixtures are valid plan-draft/1 builder drafts', () => {
    expect(parsePlanDraft(sampleDraft()).success).toBe(true);
    const r = parsePlanDraft(tripDraft());
    expect(r.success, r.success ? '' : r.issues.join('; ')).toBe(true);
  });

  it('answers null for a draft with no build yet ("Not built yet")', () => {
    expect(tripPageModelForBuilt(sampleDraft({ lastBuild: null }), [])).toBeNull();
  });

  it('the model parses with the plan-model contract, for both fixtures', () => {
    for (const d of [sampleDraft(), tripDraft()]) {
      const m = tripPageModelForBuilt(d, ROWS);
      const parsed = tripPlanModel.safeParse(m);
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
    }
  });

  it('yields days with the engine\'s times, bases and kinds', () => {
    const m = tripPageModelForBuilt(tripDraft(), ROWS)!;
    expect(m.days.map((d) => [d.n, d.base, d.title])).toEqual([
      [1, 'Alpha', 'Sentiero Alto and Lago Verde'],
      [2, 'Beta', 'Snapshot name and Rifugio Cena'],
      [3, 'Beta', 'Star Point'],
    ]);
    // names and kinds from the resolve rows; the unknown pick keeps its snapshot
    expect(m.days[0]!.stops.map((s) => [s.name, s.kind, s.time, s.placeSlug])).toEqual([
      ['Sentiero Alto', 'trail', '09:00', 'sentiero-alto'],
      ['Lago Verde', 'lake', '14:00', 'lago-verde'],
    ]);
    expect(m.days[1]!.stops.map((s) => [s.name, s.kind, s.time])).toEqual([
      ['Snapshot name', 'sight', null],
      ['Rifugio Cena', 'eatery', null],
    ]);
    // past midnight is the next morning's clock
    expect(m.days[2]!.stops[0]!.time).toBe('00:30');
    expect(clockOf(1470)).toBe('00:30');
    // the drive: the day's legs and the way back, ≈ when any leg is an estimate
    expect(m.days[0]!.drive).toBe('≈1 h 10');
    expect(m.days[0]!.driveIsEstimate).toBe(true);
    expect(m.days[2]!.drive).toBeNull();
    expect(m.days.map((d) => d.glyph)).toEqual(['trail', 'sight', 'viewpoint']);
  });

  it('builds a timeline the page\'s components read: one version, legs and visits in order, the move day a transfer', () => {
    const t = tripPageModelForBuilt(tripDraft(), ROWS)!.timeline!;
    expect(t.slug).toBe(tripDraft().id);
    expect(t.defaultProfile).toEqual({ party: 'adults', youngest: null, pace: 'standard', walkKm: null, split: false });
    expect(t.days.map((d) => [d.n, d.input.kind, d.input.base?.name ?? null])).toEqual([[1, 'normal', 'Alpha'], [2, 'transfer', 'Beta'], [3, 'normal', 'Beta']]);
    const v = t.days[0]!.input.variants;
    expect(v.map((x) => [x.key, x.label])).toEqual([['main', BUILT_VARIANT_LABEL]]);
    expect(v[0]!.items.map((i) => [i.id, i.kind, i.sub, i.durationMin, i.start?.time ?? null])).toEqual([
      ['route/sentiero-alto', 'trail', 'hike', 240, '09:00'],
      ['place/lago-verde', 'visit', 'lake', 60, '14:00'],
    ]);
    const day1 = t.defaultTimelines[0]!;
    const entries = day1.entries as TimelineEntry[];
    expect(entries.map((e) => [e.kind, e.start, e.end, e.title])).toEqual([
      ['leg', '08:35', '09:00', 'Drive to Sentiero Alto'],
      ['trail', '09:00', '13:00', 'Sentiero Alto'],
      ['leg', '13:45', '14:00', 'Drive to Lago Verde'],
      ['visit', '14:00', '15:00', 'Lago Verde'],
      ['leg', '15:00', '15:30', 'Drive to Alpha'],
    ]);
    // a locked pick is pinned; a routed leg is not an estimate, an estimated one says so
    expect(entries[1]!.time.pinned).toBe(true);
    expect(entries[0]!.honesty).toEqual([]);
    expect(entries[2]!.honesty).toEqual(['drive_estimated']);
    expect(day1.totals).toEqual({ activeMin: 300, driveMin: 70, walkKm: 0, gainM: 0 });
    expect(day1.span).toEqual({ start: '08:35', end: '15:30', minutes: 415 });
    expect(day1.blocks).toBe(false);
    // a day the build left untimed reads in parts of the day, never with invented times
    expect(t.defaultTimelines[1]!.blocks).toBe(true);
    expect(t.addByDay).toEqual({ 1: [], 2: [], 3: [] });
  });

  it('lists each placed pick once in its Stops tab category, with its days', () => {
    const m = tripPageModelForBuilt(tripDraft(), ROWS)!;
    const by = Object.fromEntries(m.sections.map((s) => [s.id, s.rows.map((r) => [r.name, r.days])]));
    expect(by).toEqual({
      stays: [],
      trails: [['Sentiero Alto', [1]]],
      sights: [['Lago Verde', [1]], ['Snapshot name', [2]], ['Star Point', [3]]],
      activities: [],
      food: [['Rifugio Cena', [2]]],
      logistics: [],
    });
    expect(m.route.unplaced).toBe(5);
    expect(m.gallery).toEqual([]);
  });

  it('ignores keys a later document adds (STEP2-C1), and never reads household data', () => {
    const plain = tripPageModelForBuilt(tripDraft(), ROWS);
    const later = { ...tripDraft(), notes: { trip: 'our anniversary' }, identity: { label: 'secret' }, driveDayMin: 180, convertedAt: '2026-10-27T11:00:00.000Z' } as unknown as PlanDraft;
    expect(tripPageModelForBuilt(later, ROWS)).toEqual(plain);
    const household = { ...tripDraft(), party: 'trip', travellers: { adults: 2, children: [7] }, start: '2026-07-04', fromRef: 'hub:toronto' } as unknown as PlanDraft;
    const text = JSON.stringify(tripPageModelForBuilt(household, ROWS));
    expect(text).toBe(JSON.stringify(plain));
    for (const s of ['2026-07-04', 'toronto', 'anniversary']) expect(text).not.toContain(s);
  });

  it('works without resolve rows, from the draft\'s snapshots alone', () => {
    const m = tripPageModelForBuilt(sampleDraft())!;
    expect(m.days.map((d) => [d.n, d.base, d.stops.map((s) => [s.name, s.time])])).toEqual([[1, 'Huntsville', [['Lake of Two Rivers trail', '10:00']]]]);
  });
});
