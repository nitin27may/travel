import { toSearchParams } from '@travel/core/catalogue/httpCodec.ts';
import { fail, ok, type Result } from '@travel/core/catalogue/result.ts';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { gazetteerOf, type PublicTownsHolder } from '@travel/core/privacy/towns.ts';
import * as S from '@travel/core/schema/api/index.ts';
import { respond, type EndpointName } from '@/lib/server/respond';

// A CatalogueStore whose every method is a request through the route handlers' respond() (no network): the contract kit's tables run
// on it unchanged, so the URL codec, the status mapping, the ETag and the privacy detector are covered by the same cases.
const ORIGIN = 'http://api.test';

/** The URL parameters of a list query, every facet key included (an unknown key must reach the codec to be refused). */
function listParams(q: S.PlaceQuery | S.NearQuery | S.CountQuery | S.UncheckedQuery | S.CardQuery, page: S.ApiPage = {}): URLSearchParams {
  const p = toSearchParams(q, {});
  for (const [k, v] of Object.entries(q.facets ?? {})) if (!p.has(k) && v.length) p.set(k, v.join(','));
  if (page.page !== undefined) p.set('page', String(page.page));
  if (page.pageSize !== undefined) p.set('pageSize', String(page.pageSize));
  return p;
}

export class HandlerStore implements CatalogueStore, PublicTownsHolder {
  constructor(private readonly inner: CatalogueStore) {}

  /** The inner store's gazetteer, which respond() reads too (store.ts A33): the kit scans with what the handler scanned with. */
  publicTowns = () => gazetteerOf(this.inner);

  /** A raw GET through respond(), for the handler-layer cases (K18, K19). */
  request = async (path: string, init: { headers?: Record<string, string> } = {}): Promise<{ status: number; headers: Headers; text: string }> => {
    const url = new URL(path, ORIGIN);
    const route = ROUTES.find(([re]) => re.test(url.pathname));
    if (!route) throw new Error(`no route for ${path}`);
    const m = route[0].exec(url.pathname)!;
    const params = Object.fromEntries(route[2].map((n, i) => [n, decodeURIComponent(m[i + 1]!)]));
    const res = await respond(route[1], new Request(url, { headers: init.headers }), params, this.inner);
    return { status: res.status, headers: res.headers, text: await res.text() };
  }

  private async call<T>(name: EndpointName, path: string, params: Record<string, string> = {}, search?: URLSearchParams, init?: RequestInit): Promise<Result<T>> {
    const url = new URL(path, ORIGIN);
    if (search) url.search = search.toString();
    const res = await respond(name, new Request(url, init), params, this.inner);
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (res.status === 200 || res.status === 308) {
      const etag = res.headers.get('etag')?.replace(/"/g, '') ?? '';
      return ok((name === 'health' ? body.revision : body) as T, etag);
    }
    return body?.error ? ({ ok: false, error: body.error } as Result<T>) : fail('internal', `unexpected status ${res.status}`);
  }

  revision = async () => {
    const r = await this.call<string>('health', '/api/v1/health/');
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  };
  listPlaces = (q: S.PlaceQuery, page?: S.ApiPage) => this.call<S.Paged<S.PlaceRow>>('listPlaces', '/api/v1/places/', {}, listParams(q, page));
  countPlaces = (q: S.CountQuery) => this.call<S.FacetCounts>('countPlaces', '/api/v1/places/counts/', {}, listParams(q));
  listUnchecked = (q: S.UncheckedQuery, page?: S.ApiPage) => this.call<S.UncheckedPage>('listUnchecked', '/api/v1/places/unchecked/', {}, listParams(q, page));
  searchCards = (q: S.CardQuery) => this.call<S.CardHits>('searchCards', '/api/v1/places/cards/', {}, listParams(q));
  getPlace = (slug: string) => this.call<S.PlaceLookup>('getPlace', `/api/v1/places/${encodeURIComponent(slug)}/`, { slug });
  nearbyForPlace = (slug: string) => this.call<S.NearbyBlock>('nearbyForPlace', `/api/v1/places/${encodeURIComponent(slug)}/nearby/`, { slug });
  near = (q: S.NearQuery, page?: S.ApiPage) => this.call<S.NearPage>('near', '/api/v1/near/', {}, listParams(q, page));
  towns = (q: S.TownQuery) => this.call<S.TownList>('towns', '/api/v1/towns/', {}, new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])));
  parse = (input: S.ParseInput) => this.call<S.ParsedQuery>('parse', '/api/v1/parse/', {}, new URLSearchParams([['q', input.q], ...(input.target ? [['target', input.target]] : []), ...(input.dropped ? [['dropped', input.dropped.join(',')]] : [])] as [string, string][]));
  search = (q: S.SearchQuery) => this.call<S.SearchResult>('search', '/api/v1/search/', {}, new URLSearchParams([['q', q.q], ...(q.scope?.kind ? [['kind', q.scope.kind]] : []), ...(q.scope?.country ? [['country', q.scope.country]] : []), ...(q.limit !== undefined ? [['limit', String(q.limit)]] : [])] as [string, string][]));
  listTrips = (q: S.TripQuery, page?: S.ApiPage) => this.call<S.Paged<S.TripRow>>('listTrips', '/api/v1/trips/', {}, listParams(q, page));
  getTrip = (slug: string, profile?: S.TripProfile) => this.call<S.TripLookup>('getTrip', `/api/v1/trips/${encodeURIComponent(slug)}/`, { slug }, new URLSearchParams(Object.entries(profile ?? {}).filter(([, v]) => v !== undefined) as [string, string][]));
  tripLegs = (slug: string) => this.call<S.TripLegsLookup>('tripLegs', `/api/v1/trips/${encodeURIComponent(slug)}/legs/`, { slug });
  getExport = (q: S.ExportQuery) => this.call<S.ExportFile>('getExport', `/api/v1/export/${q.type}/${encodeURIComponent(q.slug)}/`, { type: q.type, slug: q.slug }, new URLSearchParams([['format', q.format], ...Object.entries(q.profile ?? {}).filter(([, v]) => v !== undefined)] as [string, string][]));
  globeTree = () => this.call<S.GlobeTree>('globeTree', '/api/v1/globe/tree/');
  globePins = (cc: string) => this.call<S.LightPin[]>('globePins', `/api/v1/globe/pins/${encodeURIComponent(cc)}/`, { cc });
  globeCard = (key: string) => {
    const at = key.indexOf(':');
    const kind = at < 0 ? key : key.slice(0, at);
    const slug = at < 0 ? '' : key.slice(at + 1);
    return this.call<S.GlobeCardFile>('globeCard', `/api/v1/globe/card/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}/`, { kind, slug });
  };
  globeFeature = (id: string) => this.call<S.GlobeFeature>('globeFeature', `/api/v1/globe/feature/${encodeURIComponent(id)}/`, { id });
  globeLine = (id: string) => this.call<S.GlobeLine>('globeLine', `/api/v1/globe/feature/${encodeURIComponent(id)}/line/`, { id });
  globeCity = (townId: string) => this.call<S.GlobeCity>('globeCity', `/api/v1/globe/city/${encodeURIComponent(townId)}/`, { townId });
  report = (input: S.ReportInput) => this.call<S.ReportResult>('report', '/api/v1/report/', {}, undefined, { method: 'POST', body: JSON.stringify(input) });
}

/** Path patterns for `request()`: regexp, endpoint, the names of its path parameters. */
const ROUTES: [RegExp, EndpointName, string[]][] = [
  [/^\/api\/v1\/health\/?$/, 'health', []],
  [/^\/api\/v1\/places\/counts\/?$/, 'countPlaces', []],
  [/^\/api\/v1\/places\/unchecked\/?$/, 'listUnchecked', []],
  [/^\/api\/v1\/places\/cards\/?$/, 'searchCards', []],
  [/^\/api\/v1\/places\/?$/, 'listPlaces', []],
  [/^\/api\/v1\/places\/([^/]+)\/nearby\/?$/, 'nearbyForPlace', ['slug']],
  [/^\/api\/v1\/places\/([^/]+)\/?$/, 'getPlace', ['slug']],
  [/^\/api\/v1\/near\/?$/, 'near', []],
  [/^\/api\/v1\/search\/?$/, 'search', []],
  [/^\/api\/v1\/parse\/?$/, 'parse', []],
  [/^\/api\/v1\/trips\/?$/, 'listTrips', []],
  [/^\/api\/v1\/trips\/([^/]+)\/legs\/?$/, 'tripLegs', ['slug']],
  [/^\/api\/v1\/trips\/([^/]+)\/?$/, 'getTrip', ['slug']],
  [/^\/api\/v1\/globe\/tree\/?$/, 'globeTree', []],
  [/^\/api\/v1\/globe\/pins\/([^/]+)\/?$/, 'globePins', ['cc']],
  [/^\/api\/v1\/globe\/card\/([^/]+)\/([^/]+)\/?$/, 'globeCard', ['kind', 'slug']],
  [/^\/api\/v1\/globe\/feature\/([^/]+)\/line\/?$/, 'globeLine', ['id']],
  [/^\/api\/v1\/globe\/feature\/([^/]+)\/?$/, 'globeFeature', ['id']],
  [/^\/api\/v1\/globe\/city\/([^/]+)\/?$/, 'globeCity', ['townId']],
];
