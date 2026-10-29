import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { planCandidatePage, planRegions } from '@travel/core/schema/api/plan.ts';
import { handlePlan, type PlanRouteDeps } from '@/app/api/v1/plan/shared';
import { createPlanService, defaultDrive, fileReference, PLAN_GROUP_MIN_PLACES } from '@/lib/server/planService';
import { getStore } from '@/lib/server/store';
import { REPO } from './support';

// TB-RG: the committed hubs, airports and region groups through the real fileReference() and the real public store: every group region is
// a region the catalogue has, a hub start answers in near mode (no longer not_available), and the Regions step returns the groups.

const read = (f: string) => JSON.parse(readFileSync(path.join(REPO, 'data', 'reference', f), 'utf8'));
const groups = read('region-groups.json').groups as { id: string; cc: string; regions: string[]; places: number; offered: boolean }[];
const hubs = read('hubs.json').hubs as { id: string; lat: number; lon: number; cc: string }[];
const airports = read('airports.json').airports as { iata: string; lat: number; lon: number }[];

const ON = { NEXT_PUBLIC_PLAN_BUILDER: '1', NEXT_PUBLIC_TRIP_EDIT: '1' };
const NOW = new Date('2026-10-28T12:00:00.000Z');
const deps = (): PlanRouteDeps => {
  const store = getStore();
  return {
    store,
    service: createPlanService({ store, legs: null, reference: fileReference(REPO), drive: defaultDrive, now: () => NOW }),
    quota: () => null,
    env: () => ON,
    now: () => NOW,
  };
};
const get = (route: 'regions' | 'candidates', p: string, params: Record<string, string> = {}) => handlePlan(route, new Request(`https://example.test/api/v1/plan${p}`), params, deps());

describe('plan reference files over the store', () => {
  it('the PLAN_GROUP_MIN_PLACES rule is the file\'s', () => {
    expect(read('region-groups.json').min_places).toBe(PLAN_GROUP_MIN_PLACES);
  });

  it('fileReference reads every hub, airport and group', () => {
    const ref = fileReference(REPO);
    for (const h of hubs) expect(ref.hub(h.id), h.id).toEqual({ lat: h.lat, lon: h.lon, cc: h.cc });
    for (const a of airports) expect(ref.airport(a.iata)?.lat, a.iata).toBe(a.lat);
    for (const cc of new Set(groups.map((g) => g.cc))) expect(ref.groups(cc).length).toBe(groups.filter((g) => g.cc === cc).length);
  });

  it('every group region is a region facet of its country in the catalogue, and every catalogue region of a grouped country has a group', async () => {
    const store = getStore();
    for (const cc of new Set(groups.map((g) => g.cc))) {
      const c = await store.countPlaces({ facets: { country: [cc] } });
      expect(c.ok, cc).toBe(true);
      if (!c.ok) continue;
      const facet = new Map((c.data.facets.region ?? []).map((r) => [r.value, r.count]));
      const mine = groups.filter((g) => g.cc === cc).flatMap((g) => g.regions);
      for (const slug of mine) expect(facet.has(slug), `${cc}/${slug}`).toBe(true);
      for (const slug of facet.keys()) expect(mine, `${cc}/${slug} has no group`).toContain(slug);
    }
  });

  it('the Regions step returns the groups with live counts; an offered group still has the minimum', async () => {
    for (const cc of ['CA', 'IT', 'US', 'FR', 'IS', 'AR']) {
      const res = await get('regions', `/regions/${cc}/`, { cc });
      expect(res.status, cc).toBe(200);
      const body = planRegions.parse(await res.json());
      expect(body.groups.length, cc).toBe(groups.filter((g) => g.cc === cc).length);
      expect(body.ungrouped, cc).toEqual([]);
      for (const g of body.groups) {
        const file = groups.find((x) => x.id === g.id)!;
        if (file.offered) expect(g.offered, g.id).toBe(true);
      }
    }
  });

  it('a hub start answers in near mode, and an airport start too', async () => {
    for (const from of ['hub:calgary', 'hub:venice', 'hub:reykjavik', 'iata:YYC']) {
      const res = await get('candidates', `/candidates/?m=near&from=${from}&r=120`);
      expect(res.status, from).toBe(200);
      planCandidatePage.parse(await res.json());
    }
    const none = await get('candidates', '/candidates/?m=near&from=hub:nowhere&r=120');
    expect(none.status).not.toBe(200);
  });
});
