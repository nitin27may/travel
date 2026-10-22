import { reportLink, reportUrl } from '@/lib/config/product';
import type { PlaceExport, TripExport } from '@/lib/export/types';
import { queryTokens } from '@/lib/search/aliases';
import type { ParseOptions, ParsedQuery, VocabFile } from '@/lib/search/parse/types';
import { createSearcher } from '@/lib/search/search';
import type { Searcher } from '@/lib/search/search';
import { suggest as suggestFrom } from '@/lib/search/suggest';
import type { Suggestion } from '@/lib/search/suggest';
import type { SearchManifest, SearchPartRef, SearchRecord, SearchResult } from '@/lib/search/types';
import type { GlobeCardFile, GlobeTree, LightPin } from '@/lib/globe/types';
import type { TextIndex } from '@/lib/search/fulltext';
import type { DataClient, GlobeLineFile, GlobeScope, ReportInput, ReportResult, SearchScope } from './contract';

// StaticAdapter: today's data functions over the files the build wrote (search parts, the globe files, list shards, the page's own
// export data). Selected with NEXT_PUBLIC_DATA_ADAPTER=static (inlined at build time, so it needs its own build), and the base the
// ApiAdapter delegates to for what the API does not carry (bulk search parts, the full-text files, reference geography).
// Every function keeps the shape of its API call, so swapping the adapter changes no caller.

let manifestPromise: Promise<SearchManifest> | null = null;
const partPromises = new Map<string, Promise<SearchRecord[]>>();

export async function getJson<T>(url: string): Promise<T> {
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

// globe (GLB2)
/** The line file behind a gazetteer row's line id, or null when there is none. Static: `/globe/line/<id>.json`; later `GET /api/v1/globe/feature/{id}/line`. */
export function globeLine(id: string): Promise<GlobeLineFile | null> {
  return lineOnce(id);
}

// ---------------------------------------------------------------- smart search (backlog 3.43, smart-search.md section 9.1)

let vocabPromise: Promise<VocabFile> | null = null;

/** The parser's words (`vocab.json`, labels only). Loaded on the first parse and kept for the page view; retries after a failure. */
export function searchVocab(): Promise<VocabFile> {
  vocabPromise ??= getJson<VocabFile>('/search/vocab.json').catch((e) => {
    vocabPromise = null;
    throw e;
  });
  return vocabPromise;
}

/**
 * Reads a human query as filters, in the shape a server answers (`GET /api/parse?q=&target=` later): the same call with the same
 * result. Today it runs in the browser from `vocab.json` and the search parts the search already loads, so a query leaves no
 * request of its own (H7) and nothing is sent to a third party.
 */
export async function parseQuery(q: string, opts?: ParseOptions): Promise<ParsedQuery> {
  // the parser is its own chunk: it loads on the first query, never with the first paint of a page
  const [vocab, records, { parse }] = await Promise.all([searchVocab(), loadSearchRecords(), import('@/lib/search/parse/parse')]);
  return parse(q, vocab, records, opts);
}



/** Report a problem on a page (11.2, Q63, Q70). Until a server takes reports it hands back the public feedback form's URL. */
export async function reportProblem(input: ReportInput): Promise<ReportResult> {
  const url = reportLink(reportUrl, input.page);
  return url ? { kind: 'link', url } : { kind: 'off' };
}

const lines = new Map<string, Promise<GlobeLineFile | null>>();
function lineOnce(id: string): Promise<GlobeLineFile | null> {
  let p = lines.get(id);
  if (!p) {
    p = getJson<GlobeLineFile>(`/globe/line/${encodeURIComponent(id)}.json`).catch(() => {
      lines.delete(id);
      return null;
    });
    lines.set(id, p);
  }
  return p;
}

/** One file of list rows: the rows of one country, or one 300-row part of a large one. */
export function shardRows(type: 'place' | 'trip', id: string): Promise<readonly unknown[]> {
  return getJson<unknown[]>(`/list/${type}s/${encodeURIComponent(id)}/data.json`);
}

/** One full-text file (backlog 3.60). */
export function textIndex(id: string): Promise<TextIndex> {
  return getJson<TextIndex>(`/search/text/${encodeURIComponent(id)}/data.json`);
}

export const staticClient: DataClient = {
  searchManifest, searchPart, searchParts, loadSearchRecords, onSearchGrow, search, suggest, searchVocab, parseQuery,
  loadExport: loadExport as DataClient['loadExport'],
  globeTree, globePins, globeCard, globeLine, reportProblem,
  shardRows: (type, id) => shardRows(type, id),
  textIndex,
};
