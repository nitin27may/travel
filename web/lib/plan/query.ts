// The candidates query for a state (FLOW stage 3 and 4; api/plan.ts `PlanCandidatesQuery`). Pure, type-only imports. Trip mode needs a
// country and an area; near mode a start. Everything here is a public key: the party is only the youngest child's age band (`p`), never
// the ages, and the start is a typed reference the server resolves.
import type { PlanCandidatesQuery } from '@travel/core/schema/api/plan.ts';
import type { Party } from '@travel/core/trips/party.ts';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { partyBand } from './draft';
import type { FlowState } from './flow';
import { modeOf } from './flow';

export interface QueryExtra {
  /** a pick's slug: list the places near it instead (the near strip, "also within your driving") */
  near?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  /** ignore the filters (the strips use the base query: kids and month only, FLOW S9) */
  strip?: boolean;
  /** override the reach (the stage 1 count and the reach control ask for other values than the state's) */
  driveLimitMin?: number;
  /** the rows the default list left out, under their own headings (TB-W2 "Not for your party", "Closed in <month>") */
  list?: 'not_for_party' | 'closed';
}

export function candidateQuery(s: FlowState, party: Party, x: QueryExtra = {}): PlanCandidatesQuery | null {
  const f = s.filters;
  const facets: Record<string, string[]> = {};
  if (!x.strip && f.kinds.length) facets.kind = f.kinds;
  if (!x.strip && f.stroller) facets.stroller = ['1'];
  const month = (x.strip ? null : f.month) ?? s.month ?? undefined;
  const band = f.kids ? partyBand(party) : undefined;
  const common = {
    ...(Object.keys(facets).length ? { facets } : {}),
    ...(month ? { month } : {}),
    ...(band ? { party: band } : {}),
    ...(x.near ? { near: x.near } : {}),
    ...(x.limit ? { limit: x.limit } : {}),
    ...(x.list ? { list: x.list } : {}),
    ...(x.page && x.page > 1 ? { page: x.page } : {}),
    pageSize: x.pageSize ?? PLAN_BUILDER_UI.pageSize,
  };
  if (modeOf(s) === 'trip') {
    if (!s.cc || !s.regions.length) return null;
    // the area pill narrows the list to some of the chosen areas (never to one that is not chosen)
    const narrowed = (f.areas ?? []).filter((r) => s.regions.includes(r));
    return { mode: 'trip', cc: s.cc, regions: x.strip || !narrowed.length ? s.regions : narrowed, ...common };
  }
  if (!s.start) return null;
  return { mode: 'near', start: s.start, driveLimitMin: x.driveLimitMin ?? s.driveLimitMin, ...(s.regions.length ? { regions: s.regions } : {}), ...common };
}
