import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import type { Result } from '@travel/core/catalogue/result.ts';
import type { TripDetail, TripPlanModel } from '@travel/core/schema/api/index.ts';
import { buildTripPageModel } from '@/components/trips/model';
import type { PublicTrip } from '@/lib/public/types';
import { createApiClient, type ApiCalls } from './api';
import type { DataClient } from './contract';

// StubAdapter, for unit tests: the ApiAdapter over a CatalogueStore in memory (the StubStore by default), so a component test or a data
// test runs the same adapter code the browser runs, with no network and no server. Tests only; nothing in the app imports this file.

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.data;
};
const orNull = async <T>(p: Promise<Result<T>>): Promise<T | null> => {
  const r = await p;
  if (r.ok) return r.data;
  if (r.error.code === 'not_found') return null;
  throw new Error(`${r.error.code}: ${r.error.message}`);
};

/** How the stub answers tripPlanModel: a function of the store and the slug (a test may pass the server's own, `publicTripPlanModel`). */
export type StubPlanModel = (store: CatalogueStore, slug: string) => Promise<TripPlanModel | null>;

/**
 * The stub's default plan model (STEP2-M): the page's model builder over the store's own trip detail, with no place lookup and no
 * nearby list (a stub store has no photos or points for the page to borrow), so it answers for any store's trips.
 */
export const planModelFromDetail: StubPlanModel = async (store, slug) => {
  const r = await store.getTrip(slug);
  if (!r.ok || 'moved' in r.data) return null;
  const trip = r.data as TripDetail as unknown as PublicTrip;
  return JSON.parse(JSON.stringify(buildTripPageModel(trip, () => null, []))) as TripPlanModel;
};

/** The calls of the ApiAdapter, answered by a store. */
export function callsFromStore(store: CatalogueStore, reportOn = true, planModel: StubPlanModel = planModelFromDetail): ApiCalls {
  return {
    search: async (q) => unwrap(await store.search(q)),
    parse: async (input) => unwrap(await store.parse(input)),
    listPlaces: async (q, page) => unwrap(await store.listPlaces(q, page)),
    countPlaces: async (q) => unwrap(await store.countPlaces(q)),
    listUnchecked: async (q, page) => unwrap(await store.listUnchecked(q, page)),
    searchCards: async (q) => unwrap(await store.searchCards(q)),
    globeTree: async () => unwrap(await store.globeTree()),
    globePins: async (cc) => unwrap(await store.globePins(cc)),
    globeCard: (key) => orNull(store.globeCard(key)),
    globeLine: (id) => orNull(store.globeLine(id)) as never,
    exportFile: async (type, slug, format) => unwrap(await store.getExport({ type, slug, format })),
    tripLegs: async (slug) => {
      const r = await store.tripLegs(slug);
      return r.ok && !('moved' in r.data) ? r.data : null;
    },
    tripPlanModel: (slug) => planModel(store, slug),
    resolveRefs: async (refs) => {
      const r = await store.resolveRefs({ refs: [...refs] });
      if (!r.ok && r.error.code === 'not_available') return null;
      return unwrap(r);
    },
    report: async (page) => {
      if (!reportOn) return null;
      return orNull(store.report({ page }));
    },
  };
}

export function createStubClient(store: CatalogueStore = new StubStore()): DataClient {
  return createApiClient(callsFromStore(store));
}
