import type { PlaceExport, TripExport } from '@/lib/export/types';
import { filterRows, facetCounts, gapCounts, gapNotes, matchesRow, scopeTotal } from '@/lib/entities/filter';
import { searchTexts } from '@/lib/search/fulltext';
import type { TextIndex } from '@/lib/search/fulltext';
import { isPlain, manifestCounts, pageWindow, shardsForScope } from '@/lib/entities/shards';
import type { ListManifest } from '@/lib/entities/shards';
import { emptyState } from '@/lib/entities/url';
import { sortRows } from '@/lib/entities/sort';
import { uncheckedRows } from '@/lib/entities/gaps';
import type { UncheckedGroup } from '@/lib/entities/gaps';
import type { EntityDescriptor, EntityType, FacetParam, ListState } from '@/lib/entities/types';
import { queryTokens } from '@/lib/search/aliases';
import { hrefFor } from '@/lib/search/parse/href';
import { mergeSets, withoutChips } from '@/lib/search/parse/pick';
import type { Chip, DidYouMean, ParseOptions, ParsedQuery, VocabFile } from '@/lib/search/parse/types';
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
 * that list (the Places and Trips pages register theirs) and the files that answer it have loaded. Null otherwise: a count is never a
 * guess, and counting an unloaded scope would mean a new bulk load, which is a server feature (P9). `countParsedAsync` loads what a
 * small scope needs and counts. The header then says "Show places" without a number.
 */
export function countParsed(parsed: ParsedQuery): { n: number; unchecked: number } | null {
  if (parsed.target === 'search') return null;
  return countList(parsed.target === 'trips' ? 'trip' : 'place', { ...emptyState(), q: parsed.q, facets: parsed.facets });
}

/** `countParsed`, loading the list files the parse is scoped to first (at most `maxFiles` of them; a wider scope stays uncounted). */
export async function countParsedAsync(parsed: ParsedQuery, maxFiles = 3): Promise<{ n: number; unchecked: number } | null> {
  if (parsed.target === 'search') return null;
  return countListAsync(parsed.target === 'trips' ? 'trip' : 'place', { ...emptyState(), q: parsed.q, facets: parsed.facets }, maxFiles);
}

/** The same count for any list state of a registered list: the list box asks it with the reading merged into the filters already set. */
export function countList(type: EntityType, query: ListState): { n: number; unchecked: number } | null {
  const hit = registered.get(type);
  if (!hit) return null;
  if (type === 'place') {
    // the unfiltered list is its manifest's total: no file needs to load for it
    if (hit.shards && isPlain(query)) return { n: hit.shards.manifest.total, unchecked: 0 };
    const got = peekPlacesChecked(query);
    return got ? { n: got.rows.length, unchecked: got.unchecked.reduce((a, g) => a + g.rows.length, 0) } : null;
  }
  return { n: filterRows(hit.rows as readonly unknown[], query, hit.d as unknown as EntityDescriptor<unknown>).length, unchecked: 0 };
}

/** `countList`, loading the files the query is scoped to first. Resolves to null when that is more than `maxFiles` files not yet loaded. */
export async function countListAsync(type: EntityType, query: ListState, maxFiles = Infinity): Promise<{ n: number; unchecked: number } | null> {
  const hit = registered.get(type);
  if (!hit) return null;
  if (hit.shards && !isPlain(query)) {
    const missing = shardsForScope(hit.shards.manifest, query).filter((r) => !shardLoaded.has(shardKey(type, r.id)));
    if (missing.length > maxFiles) return null;
    try {
      await ensureShards(type, query);
    } catch {
      return null;
    }
  }
  return countList(type, query);
}

// ---------------------------------------------------------------- lists

/**
 * The Places and Trips lists, in the shape a server answers: `listPlaces(query)` and `listTrips(query)`, where the query is
 * the list's URL state (filters, search, sort). Trips are few and ride in the page. Places do not: the page carries its first rows and
 * a manifest, and the rows beyond come as files the data module loads for the query's scope (see "list shards" below). A server step
 * replaces the file reads and the pages stay as they are.
 */
export interface ListResult<Row> {
  /** Rows that match, in the chosen order, before paging. With a page size given for the plain list, only that page's rows (see `offset`). */
  rows: Row[];
  /** Rows of the whole catalogue of this kind. */
  total: number;
  /** Options per facet with live counts. */
  counts: Record<string, FacetCount[]>;
  /** Extra words for the count line ("12 not checked yet"). */
  notes: string[];
  /** Rows that match, whether or not `rows` holds them all. */
  matched: number;
  /** Rank of `rows[0]` among the matches: 0 unless `rows` is one page of the plain list. */
  offset: number;
  /** Rows inside the query's scope (its Kind and country): the denominator of the count line. */
  scope: number;
  /** Per facet with a "not known" state, the rows in it that match every other filter. */
  gaps: Record<string, number>;
}

interface ListSource {
  d: EntityDescriptor<never>;
  /** Every row for a list the page carries whole (Trips); the first page for a sharded one. */
  rows: readonly unknown[];
  version: number;
  shards?: { manifest: ListManifest };
}

const registered = new Map<EntityType, ListSource>();

/** Gives the data module the descriptor and the light rows the page was built with. Idempotent; returns a version that changes with the rows. */
export function registerList<Row>(d: EntityDescriptor<Row>, rows: readonly Row[]): number {
  const had = registered.get(d.type);
  if (had?.rows === rows && !had.shards) return had.version;
  const version = (had?.version ?? 0) + 1;
  registered.set(d.type, { d: d as unknown as EntityDescriptor<never>, rows, version });
  return version;
}

function listEntities<Row>(type: EntityType, query: ListState): ListResult<Row> {
  const hit = registered.get(type);
  if (!hit) throw new Error(`No ${type} list registered`);
  const d = hit.d as unknown as EntityDescriptor<Row>;
  const rows = hit.rows as readonly Row[];
  const matched = sortRows(filterRows(rows, query, d), query, d);
  return { rows: matched, total: rows.length, counts: facetCounts(rows, query, d), notes: gapNotes(rows, query, d), matched: matched.length, offset: 0, scope: scopeTotal(rows, query, d), gaps: gapCounts(rows, query, d) };
}

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
 * `parsed` limits the second part to the keys a parse wrote (a filter the visitor chose by hand keeps its count line). `pageSize` asks for
 * one page of the plain list, which needs only the files that page touches.
 */
export async function listPlacesChecked(query: ListState, parsed?: readonly FacetParam[], pageSize?: number): Promise<PlacesAnswer> {
  await ensureShards('place', query, pageSize);
  const got = peekPlacesChecked(query, parsed, pageSize);
  if (!got) throw new Error('The place list is not loaded');
  return got;
}

/**
 * "Did you mean" for an empty answer (section 6.2, item 5): the parse with the one chip removed whose removal adds the most rows, with
 * the count ("Without September: 8 places"). Null when the answer is not empty, when no single chip is to blame, or when the list of that
 * kind is not registered.
 */
export async function relaxQuery(parsed: ParsedQuery): Promise<DidYouMean | null> {
  if (parsed.target === 'search') return null;
  const type: EntityType = parsed.target === 'trips' ? 'trip' : 'place';
  const hit = registered.get(type);
  if (!hit) return null;
  const d = hit.d as unknown as EntityDescriptor<unknown>;
  const asked = { ...emptyState(), q: parsed.q, facets: parsed.facets };
  const matches = async (q: ListState): Promise<number> => {
    await ensureShards(type, q);
    return filterRows(rowsFor(type, q) ?? [], q, d).length;
  };
  if (parsed.chips.length < 2 || (await matches(asked)) > 0) return null;
  let best: { label: string; href: string; n: number } | null = null;
  // the kind is what was asked for ("Without Waterfalls" for a waterfall query helps no one): it goes only when nothing else can
  const removable = parsed.chips.filter((c) => !c.ask && Object.keys(c.set).length);
  const candidates = removable.some((c) => c.id !== 'k') ? removable.filter((c) => c.id !== 'k') : removable;
  for (const chip of candidates) {
    const facets = { ...parsed.facets };
    for (const key of Object.keys(chip.set)) delete facets[key];
    const n = await matches({ ...emptyState(), q: parsed.q, facets });
    if (n > (best?.n ?? 0)) best = { label: `Without ${chip.label}: ${n} ${n === 1 ? d.noun.one : d.noun.many}`, href: hrefFor(parsed.target, facets, parsed.q), n };
  }
  return best ? { label: best.label, href: best.href } : null;
}

/** How narrow a reading's chip is: the lowest rank goes first when a reading gives no rows (the kind is what was asked for, so it goes last). */
function narrowness(c: Chip): number {
  const keys = Object.keys(c.set);
  if (keys.includes('season')) return 0;
  if (keys.includes('kid')) return 1;
  if (keys.some((k) => k === 'effort' || k === 'stroller' || k.startsWith('f.'))) return 2;
  if (keys.includes('area') || keys.includes('region')) return 4;
  if (keys.includes('k')) return 9;
  return 5;
}

/** A sentence that gave no rows, relaxed step by step until it gives some (smart-search 6.2, review 4.29). */
export interface Relaxation {
  /** The reading with the dropped chips taken out: its facets are what the list applies. */
  parsed: ParsedQuery;
  /** The chips taken out, narrowest first. */
  dropped: Chip[];
  /** Constraints in the full reading ("No match for all 4"). */
  total: number;
  /** Rows the relaxed reading gives, and the rows listed apart as not checked yet. */
  n: number;
  unchecked: number;
}

/** "No match for all 4; showing places that match 3": what was relaxed, in plain words. */
export function relaxText(r: Relaxation, noun: string): string {
  return `No match for all ${r.total}; showing ${noun} that match ${r.total - r.dropped.length}`;
}

/**
 * Never an empty answer under a good reading: when the reading as a whole gives nothing, drops the narrowest chip (the one whose removal gives
 * the most rows, season and age before area, and the kind last), then the next, until rows appear. `base` holds the filters already set on
 * the list. Null when the reading gives rows, when it gives none and no relaxing helps, or when the list is not registered or its scope is
 * too wide to count without a bulk load (P9). A chip that asks a question is never dropped: it sets nothing.
 */
export async function relaxToResults(parsed: ParsedQuery, base: ListState = emptyState()): Promise<Relaxation | null> {
  if (parsed.target === 'search') return null;
  const type: EntityType = parsed.target === 'trips' ? 'trip' : 'place';
  if (!registered.get(type)) return null;
  const countOf = (facets: Record<string, string[]>) => countListAsync(type, { ...base, q: parsed.q, facets: { ...base.facets, ...facets } }, 3);
  const first = await countOf(parsed.facets);
  if (!first || first.n > 0 || first.unchecked > 0) return null;
  const setters = parsed.chips.filter((c) => !c.ask && Object.keys(c.set).length);
  if (setters.length < 2) return null;
  let rest = parsed.chips;
  const dropped: Chip[] = [];
  while (dropped.length < setters.length - 1) {
    const candidates = rest.filter((c) => !c.ask && Object.keys(c.set).length);
    // the kind goes only when nothing else can
    const pool = candidates.some((c) => !Object.keys(c.set).includes('k')) ? candidates.filter((c) => !Object.keys(c.set).includes('k')) : candidates;
    let best: { chip: Chip; n: number; unchecked: number } | null = null;
    for (const chip of pool) {
      const got = await countOf(mergeSets(rest.filter((c) => c !== chip)));
      if (!got) continue;
      const better = !best || got.n > best.n || (got.n === best.n && narrowness(chip) < narrowness(best.chip));
      if (better) best = { chip, ...got };
    }
    if (!best) return null;
    dropped.push(best.chip);
    rest = rest.filter((c) => c !== best!.chip);
    if (best.n > 0 || best.unchecked > 0) return { parsed: withoutChips(parsed, dropped.map((c) => c.id)), dropped, total: setters.length, n: best.n, unchecked: best.unchecked };
  }
  return null;
}

// ---------------------------------------------------------------- list shards (3.59)

// A long list (Places) is not inlined whole in its page (principles P1, P8, P9). The page registers its first rows and a manifest; the other
// rows are files, one country at a time (`/list/places/<id>/data.json`, at most SHARD_ROWS rows each), and this section loads the ones a
// query needs: the plain list's page N reads only the files that hold rank (N-1) x 48 onward; a query naming a country reads that country's
// files; any other query reads them all, one request each, and the page shows "Counting" until they are in. No file holds the catalogue, and
// no caller reads a file itself.

export type PlacesAnswer = ListResult<PlaceListRow> & { unchecked: UncheckedGroup<PlaceListRow>[] };

const shardLoaded = new Map<string, readonly unknown[]>();
const shardPromises = new Map<string, Promise<readonly unknown[]>>();
const shardKey = (type: EntityType, id: string) => `${type}:${id}`;

/** Registers a list whose rows beyond the first page are files. Idempotent for the same `head` array; returns a version that changes with it. */
export function registerShardedList<Row>(d: EntityDescriptor<Row>, head: readonly Row[], manifest: ListManifest): number {
  const had = registered.get(d.type);
  if (had?.rows === head && had.shards) return had.version;
  const version = (had?.version ?? 0) + 1;
  registered.set(d.type, { d: d as unknown as EntityDescriptor<never>, rows: head, version, shards: { manifest } });
  return version;
}

/** The manifest of a registered sharded list, or null. */
export function listManifest(type: EntityType): ListManifest | null {
  return registered.get(type)?.shards?.manifest ?? null;
}

function loadShard(type: EntityType, id: string): Promise<readonly unknown[]> {
  const key = shardKey(type, id);
  let p = shardPromises.get(key);
  if (!p) {
    p = getJson<unknown[]>(`/list/${type}s/${encodeURIComponent(id)}/data.json`).then(
      (rows) => {
        shardLoaded.set(key, rows);
        return rows;
      },
      (e) => {
        shardPromises.delete(key);
        throw e;
      },
    );
    shardPromises.set(key, p);
  }
  return p;
}

/** Loads the files a query needs (nothing for a list the page carries whole, or for a first page the page carries). Rejects if any file fails. */
export async function ensureShards(type: EntityType, query: ListState, pageSize?: number): Promise<void> {
  const hit = registered.get(type);
  if (!hit?.shards) return;
  const m = hit.shards.manifest;
  const refs = pageSize && isPlain(query) ? pageWindow(m, query.page, pageSize).files.map((f) => f.ref) : shardsForScope(m, query);
  await Promise.all(refs.map((r) => loadShard(type, r.id)));
  // words the name, area and tags do not hold: the full-text files of the scope answer them (3.60)
  if (type === 'place' && query.q.trim() && !(pageSize && isPlain(query))) {
    const rows = rowsFor(type, query) as readonly PlaceListRow[] | null;
    if (rows && !filterRows(rows, query, hit.d as unknown as EntityDescriptor<PlaceListRow>).length) await Promise.all(refs.map((r) => loadText(r.id)));
  }
}

// ---- the full-text pass (3.60) ----

const textLoaded = new Map<string, TextIndex | null>();
const textPromises = new Map<string, Promise<void>>();

/** One full-text file. A file that will not load is remembered as missing, so the list shows its plain answer instead of waiting for it. */
function loadText(id: string): Promise<void> {
  let p = textPromises.get(id);
  if (!p) {
    p = getJson<TextIndex>(`/search/text/${encodeURIComponent(id)}/data.json`).then(
      (ix) => void textLoaded.set(id, ix),
      () => void textLoaded.set(id, null),
    );
    textPromises.set(id, p);
  }
  return p;
}

/**
 * When a search finds nothing as a substring, the places whose card text holds the words, best first (BM25 over the scope's files), still
 * passing every other filter. 'wait' while a file of the scope is on its way; null when no place holds the words.
 */
function fullText(rows: readonly PlaceListRow[], query: ListState, d: EntityDescriptor<PlaceListRow>, refs: readonly { id: string }[]): PlaceListRow[] | 'wait' {
  const indexes: TextIndex[] = [];
  for (const r of refs) {
    if (!textLoaded.has(r.id)) return 'wait';
    const ix = textLoaded.get(r.id);
    if (ix) indexes.push(ix);
  }
  const rank = new Map(searchTexts(indexes, query.q).map((h, i) => [h.id, i]));
  return rows.filter((r) => rank.has(r.slug) && matchesRow(r, query, d, 'q')).sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
}

/** The rows a query is answered from, or null while their files are not in. A whole-list source is always ready. */
function rowsFor(type: EntityType, query: ListState): readonly unknown[] | null {
  const hit = registered.get(type);
  if (!hit) return null;
  if (!hit.shards) return hit.rows;
  const out: unknown[] = [];
  for (const ref of shardsForScope(hit.shards.manifest, query)) {
    const rows = shardLoaded.get(shardKey(type, ref.id));
    if (!rows) return null;
    out.push(...rows);
  }
  return out;
}

/** The country facet for a query scoped to some countries: exact for the loaded ones, and the manifest's counts for the rest when nothing else filters. */
function countryCounts(counts: Record<string, FacetCount[]>, m: ListManifest, query: ListState): Record<string, FacetCount[]> {
  if (!query.facets.country?.length) return counts;
  const onlyCountry = !query.q.trim() && !query.bbox && !query.f && !query.sv && !query.ids.length && Object.entries(query.facets).every(([k, v]) => k === 'country' || !v?.length);
  if (!onlyCountry) return counts;
  const mine = new Map((counts.country ?? []).map((o) => [o.value, o]));
  const all = (manifestCounts(m).country ?? []).map((o) => mine.get(o.value) ?? o);
  return { ...counts, country: all };
}

/**
 * The Places answer when every file it needs has loaded, or null. For the plain list with a page size it is one page of rows
 * (`offset` says where it starts) and the counts are the manifest's; for any other query it is the whole filtered, sorted answer.
 */
export function peekPlaces(query: ListState, pageSize?: number): ListResult<PlaceListRow> | null {
  const hit = registered.get('place');
  if (!hit) return null;
  const d = hit.d as unknown as EntityDescriptor<PlaceListRow>;
  if (hit.shards && pageSize && isPlain(query)) {
    const m = hit.shards.manifest;
    const w = pageWindow(m, query.page, pageSize);
    let rows: PlaceListRow[];
    if (!w.files.length) rows = (hit.rows as readonly PlaceListRow[]).slice(w.offset, w.offset + w.count);
    else {
      rows = [];
      for (const { ref, start } of w.files) {
        const have = shardLoaded.get(shardKey('place', ref.id)) as readonly PlaceListRow[] | undefined;
        if (!have) return null;
        rows.push(...have.slice(Math.max(0, w.offset - start), Math.min(ref.n, w.offset + w.count - start)));
      }
    }
    return { rows, total: m.total, counts: manifestCounts(m), notes: m.countNotes, matched: m.total, offset: w.offset, scope: m.total, gaps: Object.fromEntries(m.gaps) };
  }
  const rows = rowsFor('place', query) as readonly PlaceListRow[] | null;
  if (!rows) return null;
  let matched = sortRows(filterRows(rows, query, d), query, d);
  let counts = facetCounts(rows, query, d);
  const extra: string[] = [];
  if (hit.shards && !matched.length && query.q.trim()) {
    const found = fullText(rows, query, d, shardsForScope(hit.shards.manifest, query));
    if (found === 'wait') return null;
    if (found.length) {
      // the same list, narrowed: the places whose descriptions hold the words, best first unless a sort was chosen
      matched = query.sort.length ? sortRows(found, query, d) : found;
      counts = facetCounts(found, { ...query, q: '' }, d);
      extra.push(`matched on descriptions: \u201c${query.q.trim()}\u201d`);
    }
  }
  return {
    rows: matched,
    total: hit.shards?.manifest.total ?? rows.length,
    counts: hit.shards ? countryCounts(counts, hit.shards.manifest, query) : counts,
    notes: [...gapNotes(rows, query, d), ...extra],
    matched: matched.length,
    offset: 0,
    scope: scopeTotal(rows, query, d),
    gaps: extra.length ? gapCounts(matched, { ...query, q: '' }, d) : gapCounts(rows, query, d),
  };
}

/** `peekPlaces` split by honesty (H1). The plain list has nothing unchecked. */
export function peekPlacesChecked(query: ListState, parsed?: readonly FacetParam[], pageSize?: number): PlacesAnswer | null {
  const got = peekPlaces(query, pageSize);
  if (!got) return null;
  const hit = registered.get('place')!;
  if (got.offset > 0 || (hit.shards && pageSize && isPlain(query))) return { ...got, unchecked: [] };
  const rows = rowsFor('place', query) as readonly PlaceListRow[];
  return { ...got, unchecked: uncheckedRows(rows, query, hit.d as unknown as EntityDescriptor<PlaceListRow>, parsed) };
}

/** The Places list for a query, in the shape a server answers: `listPlaces(query)`. Loads the files the query is scoped to first. */
export async function listPlaces(query: ListState, pageSize?: number): Promise<ListResult<PlaceListRow>> {
  await ensureShards('place', query, pageSize);
  const got = peekPlaces(query, pageSize);
  if (!got) throw new Error('No place list registered');
  return got;
}
