import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAN_CANDIDATE_LISTS, PLAN_LIMITS, type PlanBuildAnswer, type PlanBuildInput, type PlanCandidateRow, type PlanCandidatesQuery } from '@travel/core/schema/api/plan.ts';
import { createPlanService, defaultDrive, fileReference, type PlanService } from '@/lib/server/planService';
import { getStore } from '@/lib/server/store';
import { travelRoot } from '@/lib/data/root';

// RB-003 (review TB-R1): the candidates never offer a Pick the engine cannot place. Both read one ladder (core/src/plan/candidates.ts
// `locateRow`) over the public store: a town row at its gazetteer town, an exact point or the record's own point its page holds back, a car
// park or trailhead, the record a part belongs to. Over the real catalogue and the real reference files (region groups), no network.

const reference = fileReference();
const service = (): PlanService => createPlanService({ store: getStore(), legs: null, reference, drive: defaultDrive, now: () => new Date('2026-10-28T12:00:00.000Z') });
const party = { adults: 2, children: [7], walkKm: null };

/** Every row a trip-mode scope offers, on every list and page. */
async function offered(svc: PlanService, cc: string, regions: string[], extra: Partial<PlanCandidatesQuery> = {}): Promise<{ rows: PlanCandidateRow[]; noLocation: number }> {
  const rows: PlanCandidateRow[] = [];
  let noLocation = 0;
  for (const list of PLAN_CANDIDATE_LISTS) {
    for (let page = 1; ; page++) {
      const r = await svc.candidates({ mode: 'trip', cc, regions, list, page, pageSize: PLAN_LIMITS.candidatePage.max, month: 7, ...extra } as PlanCandidatesQuery);
      if (!r.ok) throw new Error(`${cc} ${regions.join(',')}: ${r.error.code}`);
      if (list === 'main' && page === 1) noLocation = r.data.removed.no_location ?? 0;
      rows.push(...r.data.items);
      if (r.data.nextPage === null) break;
    }
  }
  return { rows, noLocation };
}

/** Builds every ref in batches of at most PLAN_LIMITS.picks; the answers. */
async function buildAll(svc: PlanService, where: PlanBuildInput['where'], refs: string[], over: Partial<PlanBuildInput> = {}): Promise<PlanBuildAnswer[]> {
  const out: PlanBuildAnswer[] = [];
  for (let i = 0; i < refs.length; i += PLAN_LIMITS.picks) {
    const picks = refs.slice(i, i + PLAN_LIMITS.picks).map((ref) => ({ ref, must: false }));
    const b = await svc.build({ where, nights: 14, pace: 'standard', moves: 'balanced', month: 7, picks, bases: [], edits: [], origin: null, party, ...over });
    if (!b.ok) throw new Error(`build: ${b.error.code}`);
    out.push(b.data);
  }
  return out;
}

describe('Italy, North-east (the review walk): every Pick is placeable and every pick is placed or says why', () => {
  it('offers rows with a point basis only; towns name their gazetteer town', async () => {
    const svc = service();
    const { rows } = await offered(svc, 'IT', ['it-ne']);
    expect(rows.length).toBeGreaterThan(30);
    for (const r of rows) expect(r.placeable, r.ref).toBe(true);
    // the picks the review saw as "no location": a lake placed by its own point, towns at their towns-layer town
    const by = new Map(rows.map((r) => [r.slug, r]));
    expect(by.get('lago-di-braies')?.pointBasis).toBe('exact');
    for (const t of ['ortisei', 'bolzano', 'cortina-dampezzo']) {
      expect(by.get(t)?.pointBasis, t).toBe('town');
      expect(by.get(t)?.townId, t).toMatch(/^it-\d+-/);
    }
    expect(by.get('lago-di-braies-walk')?.pointBasis).toBe('part_of');
    expect(rows.every((r) => r.driveMin !== null || r.pointBasis === null)).toBe(true);
  });

  it('a build with every offered pick places each one or lists it in Did not fit with a reason, never "no location"', async () => {
    const svc = service();
    const refs = [...new Set((await offered(svc, 'IT', ['it-ne'])).rows.map((r) => r.ref))];
    for (const a of await buildAll(svc, { mode: 'trip', cc: 'IT', regions: ['it-ne'] }, refs)) {
      expect(a.didNotFit.filter((m) => m.code === 'TB_UNKNOWN').map((m) => m.ref)).toEqual([]);
      for (const m of a.didNotFit) expect(m.reasons.length, m.ref).toBeGreaterThan(0);
      // the base is one of the towns around the placed picks, never a town for picks it cannot reach
      expect(a.bases.length).toBeGreaterThan(0);
      for (const b of a.bases) expect(b.picks).toBeGreaterThan(0);
    }
  });

  it('a picked town is a base the engine can choose: pinned by its townId it is the base', async () => {
    const svc = service();
    const { rows } = await offered(svc, 'IT', ['it-ne']);
    const ortisei = rows.find((r) => r.slug === 'ortisei')!;
    const near = rows.filter((r) => r.pointBasis !== 'town' && r.region === 'south-tyrol').slice(0, 4);
    const [a] = await buildAll(svc, { mode: 'trip', cc: 'IT', regions: ['it-ne'] }, [ortisei.ref, ...near.map((r) => r.ref)], { nights: 3, bases: [{ town: ortisei.townId!, nights: 3, pinned: true }] });
    expect(a!.bases.map((b) => b.town)).toEqual([ortisei.townId]);
    expect(a!.didNotFit.some((m) => m.ref === ortisei.ref && m.code === 'TB_UNKNOWN')).toBe(false);
  });

  it('picks that cannot be placed choose no base', async () => {
    const svc = service();
    const [a] = await buildAll(svc, { mode: 'trip', cc: 'IT', regions: ['it-ne'] }, ['place/no-such-place-anywhere', 'place/another-place-we-do-not-list'], { nights: 2 });
    expect(a!.bases).toEqual([]);
    expect(a!.didNotFit.map((m) => m.code)).toEqual(['TB_UNKNOWN', 'TB_UNKNOWN']);
  });
});

describe('the real catalogue, every region group: 100% of offered rows are placeable and placed or explained', () => {
  const groups = (cc: string) => reference.groups(cc);
  const file = JSON.parse(readFileSync(path.join(travelRoot(), 'data', 'reference', 'region-groups.json'), 'utf8')) as { groups: { id: string }[] };
  const all = file.groups.map((g) => ({ cc: g.id.slice(0, 2).toUpperCase(), id: g.id }));

  it('has groups to check', () => {
    expect(all.length).toBeGreaterThan(5);
  });

  it('offered equals placeable in every group, and a build never answers "no location" for an offered row', async () => {
    const svc = service();
    const report: { group: string; offered: number; placeable: number; noLocation: number }[] = [];
    for (const g of all) {
      const { rows, noLocation } = await offered(svc, g.cc, [g.id]);
      report.push({ group: g.id, offered: rows.length, placeable: rows.filter((r) => r.placeable === true).length, noLocation });
      const refs = [...new Set(rows.map((r) => r.ref))];
      if (!refs.length) continue;
      for (const a of await buildAll(svc, { mode: 'trip', cc: g.cc, regions: [g.id] }, refs)) {
        expect(a.didNotFit.filter((m) => m.code === 'TB_UNKNOWN').map((m) => m.ref), g.id).toEqual([]);
      }
    }
    for (const r of report) expect(r.placeable, r.group).toBe(r.offered);
    expect(report.reduce((n, r) => n + r.offered, 0)).toBeGreaterThan(300);
  }, 120_000);

  it('near mode from a public hub offers only placeable rows, and builds them without "no location"', async () => {
    const svc = service();
    const hubs = reference.starts?.().hubs ?? [];
    const chosen = hubs.filter((x) => ['calgary', 'toronto', 'venice', 'milan'].includes(x.id));
    expect(chosen.length).toBeGreaterThan(0);
    let built = 0;
    for (const h of chosen) {
      const q = { mode: 'near', start: { kind: 'hub', id: h.id }, driveLimitMin: 240, pageSize: 40 } as PlanCandidatesQuery;
      const r = await svc.candidates(q);
      if (!r.ok) continue;
      expect(r.data.items.every((x) => x.placeable === true && x.driveMin !== null), h.id).toBe(true);
      if (!r.data.items.length) continue;
      const [a] = await buildAll(svc, { mode: 'near', start: { kind: 'hub', id: h.id }, driveLimitMin: 240 }, r.data.items.map((x) => x.ref), { nights: 2 });
      expect(a!.didNotFit.filter((m) => m.code === 'TB_UNKNOWN').map((m) => m.ref), h.id).toEqual([]);
      built++;
    }
    expect(built).toBeGreaterThan(0);
  }, 60_000);

  it('a dated folder name (the private form of a ref) never reaches an answer', async () => {
    const svc = service();
    const { rows } = await offered(svc, 'CA', [groups('CA')[0]!.id]);
    const [a] = await buildAll(svc, { mode: 'trip', cc: 'CA', regions: [groups('CA')[0]!.id] }, rows.slice(0, 20).map((r) => r.ref));
    expect(JSON.stringify(rows) + JSON.stringify(a)).not.toMatch(/-sept-2029|-july-2027/);
  });
});
