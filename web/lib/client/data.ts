import type { PlaceExport, TripExport } from '@/lib/export/types';
import type { SearchManifest, SearchPartRef, SearchRecord } from '@/lib/search/types';

// The one client data module (principle P9, backlog 2.23). Every read of catalogue data from the browser goes through
// a function here, and each function has the shape of a future API call: a server step later replaces one body and
// leaves every caller as it is. `tests/data/boundary.test.ts` fails when another module fetches a catalogue URL.
//
// Today the data is static: search parts are files the build wrote, and an export is the JSON the page itself carries.
// Nothing here fetches a list of places or trips: the list pages receive their light rows from the server page.

// ---------------------------------------------------------------- search

let manifestPromise: Promise<SearchManifest> | null = null;
const partPromises = new Map<string, Promise<SearchRecord[]>>();

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

/** The list of search parts. Retries on the next call after a failure. */
export function searchManifest(): Promise<SearchManifest> {
  manifestPromise ??= getJson<SearchManifest>('/search/manifest.json').catch((e) => {
    manifestPromise = null;
    throw e;
  });
  return manifestPromise;
}

/** One part of the index: the records of one kind in one country. Cached per page view; retries after a failure. */
export function searchPart(id: string): Promise<SearchRecord[]> {
  let p = partPromises.get(id);
  if (!p) {
    p = getJson<SearchRecord[]>(`/search/${encodeURIComponent(id)}/data.json`).catch((e) => {
      partPromises.delete(id);
      throw e;
    });
    partPromises.set(id, p);
  }
  return p;
}

export interface SearchScope {
  kind?: SearchRecord['k'];
  /** Lower-case ISO alpha-2. */
  country?: string;
}

/** The parts a scope needs, from the manifest. */
export async function searchParts(scope: SearchScope = {}): Promise<SearchPartRef[]> {
  const { parts } = await searchManifest();
  return parts.filter((p) => (!scope.kind || p.k === scope.kind) && (!scope.country || p.cc === scope.country.toLowerCase()));
}

/**
 * Loads the records of a scope (everything by default). `onRecords` fires as each part arrives, with all records so far,
 * so a search can answer from the first part while the rest load. Rejects if any part fails.
 */
export async function loadSearchRecords(scope: SearchScope = {}, onRecords?: (soFar: SearchRecord[]) => void): Promise<SearchRecord[]> {
  const refs = await searchParts(scope);
  const have: SearchRecord[] = [];
  await Promise.all(
    refs.map((ref) =>
      searchPart(ref.id).then((records) => {
        have.push(...records);
        onRecords?.([...have]);
      }),
    ),
  );
  return have;
}

// ---------------------------------------------------------------- exports

/**
 * The export data of one trip or place: the JSON the page carries for itself (a `script` tag written by
 * `components/actions/ExportData`). There is no file at a predictable address and no way to ask for another
 * item's export (principle P8). Rejects when the page carries none, as it would for a failed request.
 */
export function loadExport(type: 'trip', slug: string): Promise<TripExport>;
export function loadExport(type: 'place', slug: string): Promise<PlaceExport>;
export function loadExport(type: 'trip' | 'place', slug: string): Promise<TripExport | PlaceExport> {
  if (typeof document === 'undefined') return Promise.reject(new Error('No export data outside a page'));
  const tag = [...document.querySelectorAll('script[data-export-data]')].find((s) => s.getAttribute('data-export-data') === `${type}:${slug}`);
  if (!tag?.textContent) return Promise.reject(new Error(`No export data for ${slug}`));
  try {
    return Promise.resolve(JSON.parse(tag.textContent) as TripExport | PlaceExport);
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error(String(e)));
  }
}
