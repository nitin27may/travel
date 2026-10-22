import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { StubStore } from '@travel/core/catalogue/stub/index.ts';
import type { Result } from '@travel/core/catalogue/result.ts';
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

/** The calls of the ApiAdapter, answered by a store. */
export function callsFromStore(store: CatalogueStore, reportOn = true): ApiCalls {
  return {
    search: async (q) => unwrap(await store.search(q)),
    parse: async (input) => unwrap(await store.parse(input)),
    listPlaces: async (q, page) => unwrap(await store.listPlaces(q, page)),
    globeTree: async () => unwrap(await store.globeTree()),
    globePins: async (cc) => unwrap(await store.globePins(cc)),
    globeCard: (key) => orNull(store.globeCard(key)),
    globeLine: (id) => orNull(store.globeLine(id)) as never,
    exportFile: async (type, slug, format) => unwrap(await store.getExport({ type, slug, format })),
    report: async (page) => {
      if (!reportOn) return null;
      return orNull(store.report({ page }));
    },
  };
}

export function createStubClient(store: CatalogueStore = new StubStore()): DataClient {
  return createApiClient(callsFromStore(store));
}
