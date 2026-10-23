import type { ParseInput, ParsedQuery, PlaceQuery, PlaceRow, ReportResult as ApiReportResult, SearchQuery, SearchResult as ApiSearchResult, GlobeCardFile as ApiGlobeCard, GlobeTree as ApiGlobeTree, LightPin as ApiLightPin, ExportFile, Paged } from '@travel/core/schema/api/index.ts';
import { reportLink, reportUrl } from '@/lib/config/product';
import { defaultOrder } from '@/lib/entities/sort';
import { SHARD_ROWS } from '@/lib/entities/shards';
import type { EntityDescriptor } from '@/lib/entities/types';
import type { PlaceExport, TripExport } from '@/lib/export/types';
import type { GlobeCardFile, GlobeTree, LightPin } from '@/lib/globe/types';
import { normalize } from '@/lib/search/normalize';
import { GROUP_DEFAULT_LIMIT } from '@/lib/search/search';
import { suggest as suggestFrom } from '@/lib/search/suggest';
import type { SearchRecord, SearchResult } from '@/lib/search/types';
import type { DataClient, GlobeLineFile, ReportResult } from './contract';
import { staticClient } from './static';

// ApiAdapter, the default (EXECUTION-PLAN 4.5): the data functions as calls on /api/v1/*. `ApiCalls` is the typed seam: `fetchCalls()`
// is the browser's implementation, `callsFromStore` (stub.ts) the in-memory one for unit tests, and `createApiClient` is the same
// adapter over either. In development and tests a response is parsed with its contract schema before it is used.
//
// What the API does not carry stays on the static files, named here: the bulk search parts and manifest (a bulk read is not an API
// call, P8), the full-text files of the list (the contract has no card-text search), the parser's vocabulary file (the server holds it) and
// the reference geography the globe draws (Natural Earth and OSM files, not catalogue data).

/** What the adapter asks of a server, one method per call it makes. A missing item is `null`. */
export interface ApiCalls {
  search(q: SearchQuery): Promise<ApiSearchResult>;
  parse(input: ParseInput): Promise<ParsedQuery>;
  listPlaces(q: PlaceQuery, page: { page?: number; pageSize?: number }): Promise<Paged<PlaceRow>>;
  globeTree(): Promise<ApiGlobeTree>;
  globePins(cc: string): Promise<ApiLightPin[]>;
  globeCard(key: string): Promise<ApiGlobeCard | null>;
  globeLine(id: string): Promise<GlobeLineFile | null>;
  exportFile(type: 'trip' | 'place', slug: string, format: 'print'): Promise<ExportFile>;
  report(page: string): Promise<ApiReportResult | null>;
}

// ---- the browser's calls ----------------------------------------------------------------------------------------------------------

const BASE = '/api/v1';
/** API paths end in a slash, as every page does (next.config trailingSlash), so no request is redirected first. */
const at = (path: string, params?: URLSearchParams): string => `${BASE}${path.endsWith('/') ? path : `${path}/`}${params && [...params].length ? `?${params}` : ''}`;
const seg = encodeURIComponent;

async function check(method: string, data: unknown): Promise<void> {
  // development and tests only: the schema code is not in a production bundle
  if (process.env.NODE_ENV === 'production') return;
  const { CATALOGUE_CONTRACT } = await import('@travel/core/catalogue/store.ts');
  const entry = (CATALOGUE_CONTRACT as Record<string, { output: { parse(x: unknown): unknown } }>)[method];
  entry?.output.parse(data);
}

async function read<T>(method: string, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const data = (await r.json()) as T;
  await check(method, data);
  return data;
}

/** Like `read`, but a 404 is "there is none". */
async function readOrNull<T>(method: string, url: string): Promise<T | null> {
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const data = (await r.json()) as T;
  await check(method, data);
  return data;
}

export function fetchCalls(): ApiCalls {
  // the list's URL keys (core/src/catalogue/httpCodec.ts, which carries the schemas, so the browser writes the few it needs itself)
  const list = (q: PlaceQuery, page: { page?: number; pageSize?: number }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q.facets ?? {})) if (v.length) p.set(k, v.join(','));
    if (page.page && page.page > 1) p.set('page', String(page.page));
    if (page.pageSize) p.set('pageSize', String(page.pageSize));
    return p;
  };
  return {
    search: (q) => {
      const p = new URLSearchParams({ q: q.q });
      if (q.scope?.kind) p.set('kind', q.scope.kind);
      if (q.scope?.country) p.set('country', q.scope.country);
      if (q.limit) p.set('limit', String(q.limit));
      return read('search', at('/search', p));
    },
    parse: (input) => {
      const p = new URLSearchParams({ q: input.q });
      if (input.target) p.set('target', input.target);
      if (input.dropped?.length) p.set('dropped', input.dropped.join(','));
      return read('parse', at('/parse', p));
    },
    listPlaces: (q, page) => read('listPlaces', at('/places', list(q, page))),
    globeTree: () => read('globeTree', at('/globe/tree')),
    globePins: (cc) => read('globePins', at(`/globe/pins/${seg(cc)}`)),
    globeCard: (key) => {
      const i = key.indexOf(':');
      return readOrNull('globeCard', at(`/globe/card/${seg(key.slice(0, i))}/${seg(key.slice(i + 1))}`));
    },
    globeLine: (id) => readOrNull('globeLine', at(`/globe/feature/${seg(id)}/line`)),
    exportFile: (type, slug, format) => read('getExport', at(`/export/${type}/${seg(slug)}`, new URLSearchParams({ format }))),
    report: async (page) => {
      const r = await fetch(at('/report'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page }) });
      if (r.status === 501) return null;
      if (!r.ok) throw new Error(`report: ${r.status}`);
      return (await r.json()) as ApiReportResult;
    },
  };
}

// ---- the adapter ------------------------------------------------------------------------------------------------------------------

const SEARCH_MAX = 200;
const API_PAGE = 100;

/**
 * The country's rows as a list file: every page of `/places?country=`, cut back to the light list row, in the list's default order,
 * then the part the file id names (SHARD_ROWS rows). The file the build writes is exactly this, so the list engine in data.ts sees no difference.
 */
async function countryRows(calls: ApiCalls, cc: string, d: EntityDescriptor<never>, expected?: number): Promise<unknown[]> {
  const query: PlaceQuery = { facets: { country: [cc.toUpperCase()] } };
  // the manifest says how many rows the country has, so every page goes out at once; a count that has moved is made up afterwards
  const asked = Math.max(1, Math.ceil((expected ?? 1) / API_PAGE));
  const pages = await Promise.all(Array.from({ length: asked }, (_, i) => calls.listPlaces(query, { page: i + 1, pageSize: API_PAGE })));
  const first = pages[0]!;
  const more = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.total / API_PAGE) - asked) }, (_, i) => calls.listPlaces(query, { page: asked + i + 1, pageSize: API_PAGE })));
  const rest = [...pages.slice(1), ...more];
  // ties of the default order keep the order the rows come in, and the build's rows come in slug order (buildPlaces sorts the pages by
  // slug with localeCompare), so the same pre-order gives the build's order exactly (pinned by tests/api/adapters.test.ts). Never the
  // ref: refs are opaque ids that may change (store.ts A24), and a visible order must not hang on them.
  const bySlug = [first, ...rest].flatMap((p) => p.items).sort((a, b) => a.slug.localeCompare(b.slug));
  // the light list row is the API row without the keys the API adds (`ref`, `approx`; `nearTown` until LST2b ships it: store.ts A35)
  const rows = bySlug.map((r) => {
    const row: Record<string, unknown> = { ...r };
    delete row.ref;
    delete row.approx;
    // API-3
    delete row.nearTown;
    return row;
  });
  return defaultOrder(rows, d as unknown as EntityDescriptor<unknown>);
}

export function createApiClient(calls: ApiCalls): DataClient {
  const exports = new Map<string, Promise<TripExport | PlaceExport>>();
  let tree: Promise<GlobeTree> | null = null;
  const pins = new Map<string, Promise<LightPin[]>>();
  const cards = new Map<string, Promise<GlobeCardFile | null>>();
  const countries = new Map<string, Promise<unknown[]>>();

  const search: DataClient['search'] = async (q, scope = {}, limit) => {
    const got = (await calls.search({ q: q.slice(0, SEARCH_MAX), ...(scope.kind || scope.country ? { scope: { ...(scope.kind ? { kind: scope.kind } : {}), ...(scope.country ? { country: scope.country.toLowerCase() } : {}) } } : {}), ...(limit ? { limit } : {}) })) as unknown as SearchResult;
    // no limit asked: each group shows what it always has (the contract's one default is wider for trips and areas)
    return limit ? got : { ...got, groups: got.groups.map((g) => ({ ...g, hits: g.hits.slice(0, GROUP_DEFAULT_LIMIT[g.id]) })) };
  };

  return {
    ...staticClient,
    search,
    async suggest(q, scope = {}) {
      // the words that name a country (an area record) and the matches per word, asked of the search before the sync rules run
      const words = [...new Set(normalize(q).split(' ').filter(Boolean))];
      const areas = (await Promise.all(words.filter((w) => w.length >= 3).map((w) => search(w, { ...scope, kind: 'area' }, 50)))).flatMap((r) => r.groups.flatMap((g) => g.hits.map((h) => h.record as SearchRecord)));
      const counts = new Map(await Promise.all(words.map(async (w) => { const r = await search(w, scope); return [w, r.counts.trips + r.counts.places + r.counts.areas] as const; })));
      return suggestFrom(q, areas, (w) => counts.get(w) ?? 0);
    },
    parseQuery: (q, opts) => calls.parse({ q: q.slice(0, SEARCH_MAX), ...(opts?.target ? { target: opts.target } : {}), ...(opts?.dropped?.length ? { dropped: [...opts.dropped] } : {}) }),
    loadExport(type, slug) {
      const key = `${type}:${slug}`;
      let p = exports.get(key);
      if (!p) {
        p = calls.exportFile(type, slug, 'print').then((f) => JSON.parse(f.body) as TripExport | PlaceExport);
        p.catch(() => exports.delete(key));
        exports.set(key, p);
      }
      return p;
    },
    globeTree() {
      tree ??= (calls.globeTree() as unknown as Promise<GlobeTree>).catch((e) => {
        tree = null;
        throw e;
      });
      return tree;
    },
    async globePins(scope = {}) {
      const ccs = scope.country ? [scope.country.toLowerCase()] : (await this.globeTree()).continents.flatMap((c) => c.countries.map((n) => n.slug));
      const parts = await Promise.all(
        ccs.map((cc) => {
          let p = pins.get(cc);
          if (!p) {
            p = (calls.globePins(cc) as unknown as Promise<LightPin[]>).catch((e) => {
              pins.delete(cc);
              throw e;
            });
            pins.set(cc, p);
          }
          return p;
        }),
      );
      return parts.flat();
    },
    globeCard(key) {
      const [kind, slug] = key.split(':');
      if ((kind !== 'place' && kind !== 'trip') || !slug) return Promise.resolve(null);
      let p = cards.get(key);
      if (!p) {
        p = (calls.globeCard(key) as unknown as Promise<GlobeCardFile | null>).catch(() => {
          cards.delete(key);
          return null;
        });
        cards.set(key, p);
      }
      return p;
    },
    globeLine: (id) => calls.globeLine(id).catch(() => null),
    async reportProblem(input): Promise<ReportResult> {
      // reporting is off in the product settings until the feedback repo exists: nothing to ask the server then
      if (!reportLink(reportUrl, input.page)) return { kind: 'off' };
      const r = await calls.report(input.page);
      return r ?? { kind: 'off' };
    },
    async shardRows(type, id, d, expected) {
      const m = /^([a-z]{2})(?:-(\d+))?$/.exec(id);
      // a row with no country has no country filter to ask for: its file stays a static one
      if (type !== 'place' || !m || m[1] === 'xx') return staticClient.shardRows(type, id, d);
      const cc = m[1]!;
      let all = countries.get(cc);
      if (!all) {
        all = countryRows(calls, cc, d, expected);
        all.catch(() => countries.delete(cc));
        countries.set(cc, all);
      }
      const rows = await all;
      const part = m[2] ? Number(m[2]) : 1;
      return rows.slice((part - 1) * SHARD_ROWS, part * SHARD_ROWS);
    },
  };
}

export const apiClient: DataClient = createApiClient(fetchCalls());
