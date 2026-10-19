import type { PlaceExport, TripExport } from '@/lib/export/types';
import { filterRows, facetCounts, gapNotes } from '@/lib/entities/filter';
import { emptyState } from '@/lib/entities/url';
import { sortRows } from '@/lib/entities/sort';
import { uncheckedRows } from '@/lib/entities/gaps';
import type { UncheckedGroup } from '@/lib/entities/gaps';
import type { EntityDescriptor, EntityType, FacetParam, ListState } from '@/lib/entities/types';
import { queryTokens } from '@/lib/search/aliases';
import { hrefFor } from '@/lib/search/parse/href';
import type { DidYouMean, ParseOptions, ParsedQuery, VocabFile } from '@/lib/search/parse/types';
import { createSearcher } from '@/lib/search/search';
import type { Searcher } from '@/lib/search/search';
import { suggest as suggestFrom } from '@/lib/search/suggest';
import type { Suggestion } from '@/lib/search/suggest';
import type { SearchManifest, SearchPartRef, SearchRecord, SearchResult } from '@/lib/search/types';
import type { FacetCount } from '@/lib/entities/filter';
import type { CountryFacts, GlobeCardFile, GlobeTree, LightPin } from '@/lib/globe/types';
import type { Topology } from '@/lib/globe/geometry';
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

/**
 * How many rows a parse would open, and how many more are listed apart as "not checked yet" (Places only), when the page already holds
 * that list (the Places and Trips pages register theirs). Null on any other page: counting would mean loading the whole catalogue, and a new
 * bulk load is a server feature (P9). The header then says "Show places" without a number.
 */
export function countParsed(parsed: ParsedQuery): { n: number; unchecked: number } | null {
  if (parsed.target === 'search') return null;
  return countList(parsed.target === 'trips' ? 'trip' : 'place', { ...emptyState(), q: parsed.q, facets: parsed.facets });
}

/** The same count for any list state of a registered list: the list box asks it with the reading merged into the filters already set. */
export function countList(type: EntityType, query: ListState): { n: number; unchecked: number } | null {
  const hit = registered.get(type);
  if (!hit) return null;
  if (type === 'place') {
    const got = listPlacesChecked(query);
    return { n: got.rows.length, unchecked: got.unchecked.reduce((a, g) => a + g.rows.length, 0) };
  }
  return { n: filterRows(hit.rows as readonly unknown[], query, hit.d as unknown as EntityDescriptor<unknown>).length, unchecked: 0 };
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

// ---------------------------------------------------------------- globe reference geo (2.49)

// Geography the globe draws, from public sources (Natural Earth, geoBoundaries, Statistics Canada, OpenStreetMap), not our
// researched content. It still goes through this module so a server step can replace a body and leave the callers alone.

const GEO_BASE = '/globe/data/';
const ADMIN_BASE = '/globe/admin/';
/** ISO 3 codes whose admin file is filed under the Natural Earth code. */
const NE_ALIAS: Record<string, string> = { PSE: 'PSX', SSD: 'SDS', XKX: 'KOS' };

export type GlobeAdminLevel = 'adm1' | 'adm2';
/** One admin file, or one file per state (`parts`, keyed by the state's ISO 3166-2 code) for the countries whose districts are many: Texas does not download Alaska. */
export interface GlobeAdminEntry { file: string | null; n: number; source: string; parts?: Record<string, string> }
export type GlobeAdminManifest = Record<string, Partial<Record<GlobeAdminLevel, GlobeAdminEntry>>>;

const geoPromises = new Map<string, Promise<unknown>>();
/** One cached read of a reference file; a failure is forgotten so the next call retries. */
function geoOnce<T>(url: string): Promise<T> {
  let p = geoPromises.get(url) as Promise<T> | undefined;
  if (!p) {
    p = getJson<T>(url).catch((e) => {
      geoPromises.delete(url);
      throw e;
    });
    geoPromises.set(url, p);
  }
  return p;
}

/** Country outlines as TopoJSON: 110m for the first paint and the world view, 50m from zoom 3 and on the first drill-down. */
export const globeCountries = (res: '110m' | '50m' = '50m'): Promise<Topology> => geoOnce<Topology>(`${GEO_BASE}countries-${res}.json`);
/** Facts for each country keyed by the zero-padded ISO numeric code. */
export const globeCountryFacts = (): Promise<Record<string, CountryFacts>> => geoOnce<Record<string, CountryFacts>>(`${GEO_BASE}countries.json`);
/** Which admin files exist for which country. */
export const globeAdminManifest = (): Promise<GlobeAdminManifest> => geoOnce<GlobeAdminManifest>(`${ADMIN_BASE}index.json`);
/** The 1,000 largest lakes as TopoJSON. */
export const globeLakes = (): Promise<Topology> => geoOnce<Topology>(`${GEO_BASE}lakes-10m.json`);

/** Rows are [kind, name, lon, lat, a3, extra, rank, population]. `part` is reserved for the top and rest split. */
export function globeGazetteer(part: 'all' = 'all'): Promise<(string | number | null)[][]> {
  return geoOnce<(string | number | null)[][]>(`${GEO_BASE}${part === 'all' ? 'gazetteer' : part}.json`);
}

/**
 * The admin boundaries of one country at one level as TopoJSON, or null when we ship none. Where the entry is split into
 * `parts`, `part` names the state (ISO 3166-2, as Natural Earth writes it) and only that state's file is read.
 */
export async function globeAdmin(a3: string, level: GlobeAdminLevel, part?: string): Promise<Topology | null> {
  const manifest = await globeAdminManifest();
  const entry = manifest[a3]?.[level] ?? manifest[NE_ALIAS[a3]]?.[level];
  if (!entry) return null;
  const file = entry.parts ? (part ? entry.parts[part] : undefined) : entry.file;
  if (!file) return null;
  try {
    return await geoOnce<Topology>(`${ADMIN_BASE}${file}`);
  } catch {
    return null;
  }
}

/** Whether a country's districts come as one file per state, so the caller knows to name the state. */
export async function globeAdminIsSplit(a3: string, level: GlobeAdminLevel): Promise<boolean> {
  const manifest = await globeAdminManifest();
  return !!(manifest[a3]?.[level] ?? manifest[NE_ALIAS[a3]]?.[level])?.parts;
}

/** The OSM city areas (admin level 8) for the cities that hold one of our public places or are a trip base. Small, one file. */
export const globeCityAreas = (): Promise<{ type: 'FeatureCollection'; credit: string; features: { type: 'Feature'; properties: { id: string; name: string; wd: string | null }; geometry: unknown }[] }> => geoOnce(`${GEO_BASE}cities-adm8.json`);

/** The slice of a Wikidata entity the feature cards read. */
export interface WikidataEntity {
  claims?: Record<string, unknown>;
  labels?: { en?: { value: string } };
  sitelinks?: { enwiki?: { title: string } };
}

/**
 * One Wikidata entity by QID, for a feature card after it opens: claims, the English label and the English Wikipedia link, in one
 * `wbgetentities` call (CC0 data, read in the browser with the Wikimedia API user agent header). Null when the entity is missing.
 */
export async function globeWikidata(qid: string, signal?: AbortSignal): Promise<WikidataEntity | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=claims|labels|sitelinks&languages=en&sitefilter=enwiki&format=json&origin=*`;
  const r = await fetch(url, { signal, headers: { 'Api-User-Agent': `travel-globe/1.0 (+${typeof location === 'undefined' ? '' : location.origin}/about/)` } });
  if (!r.ok) throw new Error(`wikidata ${r.status}`);
  const body = (await r.json()) as { entities?: Record<string, WikidataEntity & { missing?: string }> };
  const e = body.entities?.[qid];
  return e && !e.missing ? e : null;
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

/**
 * The Places answer split by honesty (H1): the rows that pass, and the rows that fail only on a gap of a constraint, per constraint.
 * `parsed` limits the second part to the keys a parse wrote (a filter the visitor chose by hand keeps its count line).
 */
export function listPlacesChecked(query: ListState, parsed?: readonly FacetParam[]): ListResult<PlaceListRow> & { unchecked: UncheckedGroup<PlaceListRow>[] } {
  const hit = registered.get('place');
  if (!hit) throw new Error('No place list registered');
  const d = hit.d as unknown as EntityDescriptor<PlaceListRow>;
  return { ...listPlaces(query), unchecked: uncheckedRows(hit.rows as readonly PlaceListRow[], query, d, parsed) };
}

/**
 * "Did you mean" for an empty answer (section 6.2, item 5): the parse with the one chip removed whose removal adds the most rows, with
 * the count ("Without September: 8 places"). Null when the answer is not empty, when no single chip is to blame, or when the list of that
 * kind is not registered.
 */
export function relaxQuery(parsed: ParsedQuery): DidYouMean | null {
  if (parsed.target === 'search') return null;
  const type: EntityType = parsed.target === 'trips' ? 'trip' : 'place';
  const hit = registered.get(type);
  if (!hit) return null;
  const d = hit.d as unknown as EntityDescriptor<unknown>;
  const rows = hit.rows as readonly unknown[];
  const asked = { ...emptyState(), q: parsed.q, facets: parsed.facets };
  if (parsed.chips.length < 2 || filterRows(rows, asked, d).length > 0) return null;
  let best: { label: string; href: string; n: number } | null = null;
  for (const chip of parsed.chips) {
    if (chip.ask || !Object.keys(chip.set).length) continue;
    const facets = { ...parsed.facets };
    for (const key of Object.keys(chip.set)) delete facets[key];
    const n = filterRows(rows, { ...emptyState(), q: parsed.q, facets }, d).length;
    if (n > (best?.n ?? 0)) best = { label: `Without ${chip.label}: ${n} ${n === 1 ? d.noun.one : d.noun.many}`, href: hrefFor(parsed.target, facets, parsed.q), n };
  }
  return best ? { label: best.label, href: best.href } : null;
}
