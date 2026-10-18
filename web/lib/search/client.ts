import type { SearchRecord } from './types';

let pending: Promise<SearchRecord[]> | null = null;

/** Fetches the build-time index once per page load. Retries on the next call after a failure. */
export function loadSearchIndex(): Promise<SearchRecord[]> {
  pending ??= fetch('/search-index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`search index ${r.status}`);
      return r.json() as Promise<SearchRecord[]>;
    })
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}
