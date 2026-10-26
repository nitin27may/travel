import { fromSearchParams } from '@travel/core/catalogue/httpCodec.ts';
import { RESOLVE_PARAM, resolveQueryOf } from '@travel/core/favourites/resolve.ts';
import { httpStatus, type Result } from '@travel/core/catalogue/result.ts';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { API_LIMITS, PLACE_ROW_KEYS, RESOLVE_MAX, TRIP_ROW_KEYS, globeCardKey, reportInput, resolveRow, type ApiError } from '@travel/core/schema/api/index.ts';
import { gazetteerOf } from '@travel/core/privacy/towns.ts';
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
const NEAR_ROW = new Set<string>([...PLACE_ROW_KEYS, 'distanceKm', 'bearing', 'band', 'basis', 'minutes']);
/** listUnchecked rows: a Places row plus the key it is a gap for (store.ts A27). */
const UNCHECKED_ROW = new Set<string>([...PLACE_ROW_KEYS, 'gap']);
const TRIP_ROW = new Set<string>(TRIP_ROW_KEYS);
/** resolveRefs rows (FAV-1W): the answer schema's keys, light only (P8). */
const RESOLVE_ROW = new Set<string>(Object.keys(resolveRow.shape));

type Run = (store: CatalogueStore, req: Request, p: Record<string, string>) => Promise<Result<unknown>>;
interface Endpoint {
  cache: string;
  run: Run;
  /** the allowed keys of each row in `items` */
  rows?: ReadonlySet<string>;
  /** where a `moved` answer points, given the current slug */
  movedTo?: (slug: string) => string;
  /**
   * What the detector reads, when it is not the body itself; null fails closed. resolveRefs (FAV-1W) uses it to lift its `asked`
   * echo (see `resolveScan`); every other field of the body is still read.
   */
  scan?: (data: Record<string, unknown>, req: Request) => unknown;
}

const query = (req: Request) => new URL(req.url).searchParams;

/** The request's own strings: every query parameter value, which is all a search, parse or card-search echo may repeat (A40). */
const requestText = (req: Request): string[] => [...query(req).values()].filter((v) => v.length > 0);

/** An endpoint whose input is its path alone refuses any query key, as the codec does for the others (audit GB-A-1): a stray key filters nothing and would only make a new cache key. */
const pathOnly = (run: Run): Run => (s, r, p) => {
  const keys = [...new Set(query(r).keys())];
  return keys.length ? Promise.resolve(bad({ code: 'invalid_input', message: `This endpoint takes no query parameter: ${keys.join(', ')}.`, details: { unknown: keys } })) : run(s, r, p);
};

/** The body of a POST as text, read in pieces up to `max` bytes: null when it is longer (audit GB-A-2). */
async function boundedText(r: Request, max: number): Promise<string | null> {
  const declared = Number(r.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = r.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
const bad = (error: ApiError): Result<never> => ({ ok: false, error });

/**
 * `GET /api/v1/resolve?ref=..&ref=..` (FAV-1W; visitor spec 8.2): every `ref` value in order, and no other key. More than RESOLVE_MAX
 * values is `too_large` before a value is decoded (the store says the same; this keeps a long URL from costing a parse). Validation of
 * each value, and `invalid_input` naming indexes only, are the store's (core/src/favourites/resolve.ts).
 */
const resolveRun: Run = (s, r) => {
  const params = query(r);
  const unknown = [...new Set(params.keys())].filter((k) => k !== RESOLVE_PARAM);
  if (unknown.length) return Promise.resolve(bad({ code: 'invalid_input', message: `unknown query parameter: ${unknown.join(', ')}`, details: { unknown } }));
  if (params.getAll(RESOLVE_PARAM).length > RESOLVE_MAX) return Promise.resolve(bad({ code: 'too_large', message: `at most ${RESOLVE_MAX} refs in one call`, details: { max: RESOLVE_MAX } }));
  return s.resolveRefs(resolveQueryOf(params));
};

/**
 * The resolve answer as the detector reads it (store.ts A40, applied to `asked`): each row's `asked` is the request's own value at the
 * same index, verbatim, so it carries nothing the request did not bring, and reading it as text would make the endpoint an oracle
 * (`?ref=place:<the home town>` answering 500 where any other unknown slug answers 200). It is checked to be exactly that value and then
 * left out; `slug`, `ref`, `name`, `kind` and `cc` are read as in any body. Any other shape, or an `asked` the request did not send, is
 * null: fail closed.
 */
function resolveScan(data: Record<string, unknown>, req: Request): unknown {
  const asked = query(req).getAll(RESOLVE_PARAM);
  const items = data.items;
  if (!Array.isArray(items) || items.length !== asked.length) return null;
  const rows: unknown[] = [];
  for (const [i, row] of items.entries()) {
    if (!row || typeof row !== 'object' || (row as { asked?: unknown }).asked !== asked[i]) return null;
    const { asked: _echo, ...rest } = row as Record<string, unknown>;
    rows.push(rest);
  }
  return { ...data, items: rows };
}

/** The decoded store call of a GET, or the `invalid_input` the codec found. */
async function decoded(method: Parameters<typeof fromSearchParams>[0], req: Request, p: Record<string, string>, call: (store: CatalogueStore, a: Extract<ReturnType<typeof fromSearchParams>, { ok: true }>['args']) => Promise<Result<unknown>>, store: CatalogueStore) {
  const d = fromSearchParams(method, query(req), p);
  return d.ok ? call(store, d.args) : bad(d.error);
}

export const ENDPOINTS = {
  health: { cache: CACHE.none, run: pathOnly(async (s) => ({ ok: true, data: { status: 'ok', revision: await s.revision() }, revision: await s.revision() })) },
  listPlaces: { cache: CACHE.data, rows: PLACE_ROW, run: (s, r, p) => decoded('listPlaces', r, p, (st, a) => (a.method === 'listPlaces' ? st.listPlaces(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  countPlaces: { cache: CACHE.data, run: (s, r, p) => decoded('countPlaces', r, p, (st, a) => (a.method === 'countPlaces' ? st.countPlaces(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  // API-3 (store.ts A27, A28)
  listUnchecked: { cache: CACHE.data, rows: UNCHECKED_ROW, run: (s, r, p) => decoded('listUnchecked', r, p, (st, a) => (a.method === 'listUnchecked' ? st.listUnchecked(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  searchCards: { cache: CACHE.data, rows: PLACE_ROW, run: (s, r, p) => decoded('searchCards', r, p, (st, a) => (a.method === 'searchCards' ? st.searchCards(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  getPlace: { cache: CACHE.data, run: pathOnly((s, _r, p) => s.getPlace(p.slug ?? '')), movedTo: (slug) => `/api/v1/places/${slug}/` },
  nearbyForPlace: { cache: CACHE.data, run: pathOnly((s, _r, p) => s.nearbyForPlace(p.slug ?? '')) },
  near: { cache: CACHE.data, rows: NEAR_ROW, run: (s, r, p) => decoded('near', r, p, (st, a) => (a.method === 'near' ? st.near(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  towns: { cache: CACHE.data, run: (s, r, p) => decoded('towns', r, p, (st, a) => (a.method === 'towns' ? st.towns(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  parse: { cache: CACHE.data, run: (s, r, p) => decoded('parse', r, p, (st, a) => (a.method === 'parse' ? st.parse(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  search: { cache: CACHE.data, run: (s, r, p) => decoded('search', r, p, (st, a) => (a.method === 'search' ? st.search(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  listTrips: { cache: CACHE.data, rows: TRIP_ROW, run: (s, r, p) => decoded('listTrips', r, p, (st, a) => (a.method === 'listTrips' ? st.listTrips(a.q, a.page) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  getTrip: { cache: CACHE.data, run: (s, r, p) => decoded('getTrip', r, p, (st, a) => (a.method === 'getTrip' ? st.getTrip(a.slug, a.profile) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s), movedTo: (slug) => `/api/v1/trips/${slug}/` },
  // API-3 (store.ts A34)
  tripLegs: { cache: CACHE.data, run: pathOnly((s, _r, p) => s.tripLegs(p.slug ?? '')), movedTo: (slug) => `/api/v1/trips/${slug}/legs/` },
  getExport: { cache: CACHE.export, run: (s, r, p) => decoded('getExport', r, p, (st, a) => (a.method === 'getExport' ? st.getExport(a.q) : Promise.resolve(bad({ code: 'internal', message: 'codec mismatch' }))), s) },
  globeTree: { cache: CACHE.globe, run: pathOnly((s) => s.globeTree()) },
  globePins: { cache: CACHE.globe, run: pathOnly((s, _r, p) => s.globePins(p.cc ?? '')) },
  globeCard: { cache: CACHE.globe, run: pathOnly((s, _r, p) => s.globeCard(globeCardKey(p.kind ?? '', p.slug ?? ''))) },
  globeFeature: { cache: CACHE.globe, run: pathOnly((s, _r, p) => s.globeFeature(p.id ?? '')) },
  globeLine: { cache: CACHE.globe, run: pathOnly((s, _r, p) => s.globeLine(p.id ?? '')) },
  globeCity: { cache: CACHE.globe, run: pathOnly((s, _r, p) => s.globeCity(p.townId ?? '')) },
  // FAV-1W (visitor spec 4.5, 8.2): public, cached by revision like every catalogue read; the answer never varies by visitor
  resolveRefs: { cache: CACHE.data, rows: RESOLVE_ROW, run: resolveRun, scan: resolveScan },
  report: {
    cache: CACHE.none,
    run: pathOnly(async (s, r) => {
      // a request-size cap answers invalid_input (store.ts A1); the body is read in pieces and never held beyond the cap
      const text = await boundedText(r, API_LIMITS.reportText.max + 1000);
      if (text === null) return bad({ code: 'invalid_input', message: 'The report is too long.', details: { max: API_LIMITS.reportText.max } });
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return bad({ code: 'invalid_input', message: 'The body must be JSON.' });
      }
      const parsed = reportInput.safeParse(json);
      return parsed.success ? s.report(parsed.data) : bad({ code: 'invalid_input', message: 'The request does not match the contract.', details: { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    }),
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
    // a move keeps the query (store.ts A32, audit GB-A-13): `?p=family` survives the redirect
    if (ep.movedTo && data && typeof data.moved === 'string') return json(308, { moved: data.moved, ref: data.ref }, { location: `${ep.movedTo(data.moved)}${new URL(req.url).search}`, 'cache-control': ep.cache, etag });
    const headers: Record<string, string> = { 'cache-control': ep.cache, ...(ep.cache === CACHE.none ? {} : { etag }) };
    // the answer is the JSON envelope (filename, mime, body); it is not the file, so it carries no content-disposition (audit GB-A-3)
    // fail closed: a body with a household string, a private key or a row key outside the allowlist is never sent
    const stray = ep.rows ? rowOutsideAllowlist(data.items, ep.rows) : null;
    // the detector reads a town's point as public only when it is the loaded gazetteer's own (store.ts A33), and does not read the
    // request's own words back as household text where an echo key repeats them (A40, review API3-R-1)
    const scanned = ep.scan ? ep.scan(data, req) : data;
    const hits = scanned === null ? [{ where: '$', why: 'the body is not the shape its scan expects' }] : privacyHits(scanned, 20, { gazetteer: await gazetteerOf(store), echo: requestText(req) });
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
