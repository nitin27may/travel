import { fromSearchParams } from '@travel/core/catalogue/httpCodec.ts';
import { httpStatus, type Result } from '@travel/core/catalogue/result.ts';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { API_LIMITS, PLACE_ROW_KEYS, TRIP_ROW_KEYS, reportInput, type ApiError } from '@travel/core/schema/api/index.ts';
import { privacyHits, rowOutsideAllowlist } from './privacy';
import { getStore } from './store';

// respond(): the one place an API response is made (EXECUTION-PLAN 4.3 rule 8). A handler names its endpoint and passes the request; this
// decodes the URL with core's codec, calls the store, runs the privacy detector and the row allowlist, sets the ETag from the store's
// revision, answers If-None-Match with 304, and maps error codes to statuses. A body that fails the detector is never sent: 500
// `internal`, logged, never rewritten.

const CACHE = {
  data: 'public, max-age=60, stale-while-revalidate=600',
  globe: 'public, max-age=3600',
  export: 'private, max-age=0',
  none: 'no-store',
} as const;

const PLACE_ROW = new Set<string>(PLACE_ROW_KEYS);
const NEAR_ROW = new Set<string>([...PLACE_ROW_KEYS, 'distanceKm', 'bearing', 'band', 'basis']);
const TRIP_ROW = new Set<string>(TRIP_ROW_KEYS);

type Run = (store: CatalogueStore, req: Request, p: Record<string, string>) => Promise<Result<unknown>>;
interface Endpoint {
  cache: string;
  run: Run;
  /** the allowed keys of each row in `items` */
  rows?: ReadonlySet<string>;
  /** where a `moved` answer points, given the current slug */
  movedTo?: (slug: string) => string;
}

const query = (req: Request) => new URL(req.url).searchParams;
const bad = (error: ApiError): Result<never> => ({ ok: false, error });

/** The decoded store call of a GET, or the `invalid_input` the codec found. */
async function decoded(method: Parameters<typeof fromSearchParams>[0], req: Request, p: Record<string, string>, call: (store: CatalogueStore, a: Extract<ReturnType<typeof fromSearchParams>, { ok: true }>['args']) => Promise<Result<unknown>>, store: CatalogueStore) {
  const d = fromSearchParams(method, query(req), p);
  return d.ok ? call(store, d.args) : bad(d.error);
}

export const ENDPOINTS = {
  health: { cache: CACHE.none, run: async (s) => ({ ok: true, data: { status: 'ok', revision: await s.revision() }, revision: await s.revision() }) },
  listPlaces: { cache: CACHE.data, rows: PLACE_ROW, run: (s, r, p) => decoded('listPlaces', r, p, (st, a) => (a.method === 'listPlaces' ? st.listPlaces(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  countPlaces: { cache: CACHE.data, run: (s, r, p) => decoded('countPlaces', r, p, (st, a) => (a.method === 'countPlaces' ? st.countPlaces(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  getPlace: { cache: CACHE.data, run: (s, _r, p) => s.getPlace(p.slug ?? ''), movedTo: (slug) => `/api/v1/places/${slug}/` },
  nearbyForPlace: { cache: CACHE.data, run: (s, _r, p) => s.nearbyForPlace(p.slug ?? '') },
  near: { cache: CACHE.data, rows: NEAR_ROW, run: (s, r, p) => decoded('near', r, p, (st, a) => (a.method === 'near' ? st.near(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  towns: { cache: CACHE.data, run: (s, r, p) => decoded('towns', r, p, (st, a) => (a.method === 'towns' ? st.towns(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  parse: { cache: CACHE.data, run: (s, r, p) => decoded('parse', r, p, (st, a) => (a.method === 'parse' ? st.parse(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  search: { cache: CACHE.data, run: (s, r, p) => decoded('search', r, p, (st, a) => (a.method === 'search' ? st.search(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  listTrips: { cache: CACHE.data, rows: TRIP_ROW, run: (s, r, p) => decoded('listTrips', r, p, (st, a) => (a.method === 'listTrips' ? st.listTrips(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  getTrip: { cache: CACHE.data, run: (s, r, p) => decoded('getTrip', r, p, (st, a) => (a.method === 'getTrip' ? st.getTrip(a.slug, a.profile) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s), movedTo: (slug) => `/api/v1/trips/${slug}/` },
  getExport: { cache: CACHE.export, run: (s, r, p) => decoded('getExport', r, p, (st, a) => (a.method === 'getExport' ? st.getExport(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  globeTree: { cache: CACHE.globe, run: (s) => s.globeTree() },
  globePins: { cache: CACHE.globe, run: (s, _r, p) => s.globePins(p.cc ?? '') },
  globeCard: { cache: CACHE.globe, run: (s, _r, p) => s.globeCard(`${p.kind ?? ''}:${p.slug ?? ''}`) },
  globeFeature: { cache: CACHE.globe, run: (s, _r, p) => s.globeFeature(p.id ?? '') },
  globeLine: { cache: CACHE.globe, run: (s, _r, p) => s.globeLine(p.id ?? '') },
  globeCity: { cache: CACHE.globe, run: (s, _r, p) => s.globeCity(p.townId ?? '') },
  report: {
    cache: CACHE.none,
    run: async (s, r) => {
      const text = await r.text();
      if (text.length > API_LIMITS.reportText.max + 1000) return bad({ code: 'too_large', message: 'The report is too long.', details: { max: API_LIMITS.reportText.max } });
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return bad({ code: 'invalid_input', message: 'The body must be JSON.' });
      }
      const parsed = reportInput.safeParse(json);
      return parsed.success ? s.report(parsed.data) : bad({ code: 'invalid_input', message: 'The request does not match the contract.', details: { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    },
  },
} satisfies Record<string, Endpoint>;

export type EndpointName = keyof typeof ENDPOINTS;

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

const failure = (error: ApiError): Response => json(httpStatus(error.code), { error }, { 'cache-control': CACHE.none });

/** `If-None-Match` names the current ETag (a list, weak validators and `*` included). */
const matches = (header: string | null, etag: string): boolean =>
  !!header && (header.trim() === '*' || header.split(',').some((t) => t.trim().replace(/^W\//, '') === etag));

export async function respond(name: EndpointName, req: Request, params: Record<string, string> = {}, store: CatalogueStore = getStore()): Promise<Response> {
  const ep = ENDPOINTS[name] as Endpoint;
  try {
    const result = await ep.run(store, req, params);
    if (!result.ok) return failure(result.error);
    const etag = `"${result.revision}"`;
    const data = result.data as Record<string, unknown>;
    if (ep.movedTo && data && typeof data.moved === 'string') return json(308, { moved: data.moved, ref: data.ref }, { location: ep.movedTo(data.moved), 'cache-control': ep.cache, etag });
    const headers: Record<string, string> = { 'cache-control': ep.cache, ...(ep.cache === CACHE.none ? {} : { etag }) };
    if (name === 'getExport') headers['content-disposition'] = `attachment; filename="${(data as { filename: string }).filename}"`;
    // fail closed: a body with a household string, a private key or a row key outside the allowlist is never sent
    const stray = ep.rows ? rowOutsideAllowlist(data.items, ep.rows) : null;
    const hits = privacyHits(data);
    if (stray || hits.length) {
      console.error(`api privacy detector blocked ${name}:`, stray ? `row key ${stray} is not in the allowlist` : JSON.stringify(hits.slice(0, 5)));
      return failure({ code: 'internal', message: 'The response could not be served.' });
    }
    if (ep.cache !== CACHE.none && matches(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers });
    return json(200, data, headers);
  } catch (e) {
    console.error(`api ${name} failed:`, e);
    return failure({ code: 'internal', message: 'The request could not be answered.' });
  }
}
