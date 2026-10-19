import type { PlaceExport, TripExport } from '@/lib/export/types';
import { filterRows, facetCounts, gapNotes } from '@/lib/entities/filter';
import { sortRows } from '@/lib/entities/sort';
import type { EntityDescriptor, EntityType, ListState } from '@/lib/entities/types';
import { queryTokens } from '@/lib/search/aliases';
import { createSearcher } from '@/lib/search/search';
import type { Searcher } from '@/lib/search/search';
import { suggest as suggestFrom } from '@/lib/search/suggest';
import type { Suggestion } from '@/lib/search/suggest';
import type { SearchManifest, SearchPartRef, SearchRecord, SearchResult } from '@/lib/search/types';
import type { FacetCount } from '@/lib/entities/filter';
import type { GlobeCardFile, GlobeTree, LightPin } from '@/lib/globe/types';
import type { PlaceListRow } from '@/components/places/rows';
import type { TripListRow } from '@/components/trips/types';

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

/** Can this part hold a match for the query? Every word must start like some word of the part (aliases applied). */
function mayMatch(ref: SearchPartRef, words: string[]): boolean {
  if (!ref.w || !words.length) return true;
  const w = ref.w;
  return words.every((t) => {
    const g = t.slice(0, 3);
    return w.some((x) => x.startsWith(g));
  });
}

const loadedParts = new Map<string, SearchRecord[]>();
const growListeners = new Set<() => void>();
let searcherCache: { count: number; searcher: Searcher } | null = null;
let restLoading: Promise<void> | null = null;

const searcherOver = (): Searcher => {
  const count = [...loadedParts.values()].reduce((n, p) => n + p.length, 0);
  if (!searcherCache || searcherCache.count !== count) searcherCache = { count, searcher: createSearcher([...loadedParts.values()].flat()) };
  return searcherCache.searcher;
};

/** Called when more parts have arrived after an answer, so a caller can ask again. Returns the way to stop listening. */
export function onSearchGrow(fn: () => void): () => void {
  growListeners.add(fn);
  return () => growListeners.delete(fn);
}

/**
 * Search, in the shape a server answers: `search(q, scope, limit)`. Loads the parts that can match the query first and
 * answers from them; the other parts of the scope load afterwards (a typo or a mid-word match may be in one), `partial` says
 * so, and `onSearchGrow` fires when they land. Nothing loads before the first keystroke.
 */
export async function search(q: string, scope: SearchScope = {}, limit?: number): Promise<SearchResult> {
  const words = queryTokens(q);
  const refs = await searchParts(scope);
  const first = refs.filter((r) => mayMatch(r, words));
  const rest = refs.filter((r) => !first.includes(r));
  await Promise.all(first.map((r) => searchPart(r.id).then((records) => void loadedParts.set(r.id, records))));
  const pending = rest.filter((r) => !loadedParts.has(r.id));
  if (pending.length && !restLoading) {
    restLoading = Promise.all(pending.map((r) => searchPart(r.id).then((records) => void loadedParts.set(r.id, records))))
      .then(() => growListeners.forEach((f) => f()))
      .catch(() => undefined)
      .finally(() => {
        restLoading = null;
      });
  }
  const inScope = new Set(refs.map((r) => r.id));
  const searcher = scope.kind || scope.country ? createSearcher([...loadedParts].filter(([id]) => inScope.has(id)).flatMap(([, v]) => v)) : searcherOver();
  return { ...searcher.search(q, limit), partial: pending.length > 0 };
}

/**
 * What to offer when `search` found nothing, in the shape a server answers: `suggest(q, scope)`. It needs every part of the
 * scope (a country is read from the area records, and the fallback counts matches per word), so it waits for them all.
 * The component never holds the record list; it asks here and shows the answer.
 */
export async function suggest(q: string, scope: SearchScope = {}): Promise<Suggestion | null> {
  const refs = await searchParts(scope);
  await Promise.all(refs.map((r) => searchPart(r.id).then((records) => void loadedParts.set(r.id, records))));
  const inScope = new Set(refs.map((r) => r.id));
  const records = [...loadedParts].filter(([id]) => inScope.has(id)).flatMap(([, v]) => v);
  const searcher = createSearcher(records);
  return suggestFrom(q, records, (t) => {
    const r = searcher.search(t);
    return r.counts.trips + r.counts.places + r.counts.areas;
  });
}

// ---------------------------------------------------------------- lists

/**
 * The Places and Trips lists, in the shape a server answers: `listPlaces(query)` and `listTrips(query)`, where the query is
 * the list's URL state (filters, search, sort). Today the server page ships the light rows and registers them here, and the
 * answer is computed in the browser; a server step replaces `listEntities` and the pages stay as they are.
 */
export interface ListResult<Row> {
  /** Rows that match, in the chosen order, before paging. */
  rows: Row[];
  /** Rows of the whole catalogue of this kind. */
  total: number;
  /** Options per facet with live counts. */
  counts: Record<string, FacetCount[]>;
  /** Extra words for the count line ("12 not checked yet"). */
  notes: string[];
}

const registered = new Map<EntityType, { d: EntityDescriptor<never>; rows: readonly unknown[]; version: number }>();

/** Gives the data module the descriptor and the light rows the page was built with. Idempotent; returns a version that changes with the rows. */
export function registerList<Row>(d: EntityDescriptor<Row>, rows: readonly Row[]): number {
  const had = registered.get(d.type);
  if (had?.rows === rows) return had.version;
  const version = (had?.version ?? 0) + 1;
  registered.set(d.type, { d: d as unknown as EntityDescriptor<never>, rows, version });
  return version;
}

function listEntities<Row>(type: EntityType, query: ListState): ListResult<Row> {
  const hit = registered.get(type);
  if (!hit) throw new Error(`No ${type} list registered`);
  const d = hit.d as unknown as EntityDescriptor<Row>;
  const rows = hit.rows as readonly Row[];
  return {
    rows: sortRows(filterRows(rows, query, d), query, d),
    total: rows.length,
    counts: facetCounts(rows, query, d),
    notes: gapNotes(rows, query, d),
  };
}

export const listPlaces = (query: ListState): ListResult<PlaceListRow> => listEntities<PlaceListRow>('place', query);
export const listTrips = (query: ListState): ListResult<TripListRow> => listEntities<TripListRow>('trip', query);

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

// ---------------------------------------------------------------- globe

// The globe's data, split so a page never carries it (backlog 2.39): the area tree first (counts and a centre per country),
// then the light pins of one country when it opens, then one card when a pin is selected. Files today; a server later.

let treePromise: Promise<GlobeTree> | null = null;
const pinPromises = new Map<string, Promise<LightPin[]>>();
const cardPromises = new Map<string, Promise<GlobeCardFile | null>>();

/** The area tree with counts. No pins. Retries on the next call after a failure. */
export function globeTree(): Promise<GlobeTree> {
  treePromise ??= getJson<GlobeTree>('/globe-data/index.json').catch((e) => {
    treePromise = null;
    throw e;
  });
  return treePromise;
}

export interface GlobeScope {
  /** Lower-case ISO alpha-2. Without it, every country (the whole list; ask for one country when you can). */
  country?: string;
}

/** The light pins of a scope: name, kind, slug, position and area path. Cached per page view; retries after a failure. */
export async function globePins(scope: GlobeScope = {}): Promise<LightPin[]> {
  const ccs = scope.country ? [scope.country.toLowerCase()] : (await globeTree()).continents.flatMap((c) => c.countries.map((n) => n.slug));
  const parts = await Promise.all(
    ccs.map((cc) => {
      let p = pinPromises.get(cc);
      if (!p) {
        p = getJson<LightPin[]>(`/globe-data/pins/${encodeURIComponent(cc)}/data.json`).catch((e) => {
          pinPromises.delete(cc);
          throw e;
        });
        pinPromises.set(cc, p);
      }
      return p;
    }),
  );
  return parts.flat();
}

/** The card and pin behind one `kind:slug` key, or null when it is not on the globe. Cached per page view. */
export function globeCard(key: string): Promise<GlobeCardFile | null> {
  const [kind, slug] = key.split(':');
  if ((kind !== 'place' && kind !== 'trip') || !slug) return Promise.resolve(null);
  let p = cardPromises.get(key);
  if (!p) {
    p = getJson<GlobeCardFile | null>(`/globe-data/card/${kind}/${encodeURIComponent(slug)}/data.json`).catch(() => {
      cardPromises.delete(key);
      return null;
    });
    cardPromises.set(key, p);
  }
  return p;
}
