// URL parameters <-> store input (review API1a-R-5): the one codec `respond()` calls, on the rules of web's decodeState/encodeState
// (web/lib/entities/url.ts), so a page URL and an API URL carry the same keys and mean the same thing. web/tests/api/url-codec.test.ts
// proves the round trip against web's own codec.
//
// Decoding rules: comma lists; `country` upper-cased; `f.<facet>` keys taken by FACET_KEY_RE; a single `sort` key with `dir=desc` becomes
// `-key` (`dir=asc` drops a leading `-`); `bbox` is `w,s,e,n`; `page` and `pageSize` are positive integers; empty values are absent.
// The page-only keys (PAGE_ONLY_KEYS) are dropped; any other unknown key is `invalid_input`, so a typo never filters silently.
// The decoded object is then checked by the method's input schema, so every refusal is the store's own `invalid_input`.
import type { z } from "zod";
import * as S from "../schema/api/index.ts";

export type HttpMethod = "listPlaces" | "countPlaces" | "near" | "listTrips" | "towns" | "search" | "parse" | "getTrip" | "getExport";

/** The store call a request decodes to. */
export type DecodedArgs =
  | { method: "listPlaces" | "countPlaces"; q: S.PlaceQuery; page: S.ApiPage }
  | { method: "listTrips"; q: S.TripQuery; page: S.ApiPage }
  | { method: "near"; q: S.NearQuery; page: S.ApiPage }
  | { method: "towns"; q: S.TownQuery }
  | { method: "search"; q: S.SearchQuery }
  | { method: "parse"; q: S.ParseInput }
  | { method: "getTrip"; slug: string; profile?: S.TripProfile }
  | { method: "getExport"; q: S.ExportQuery };

type Decoded = { ok: true; args: DecodedArgs } | { ok: false; error: S.ApiError };

const csv = (v: string | null | undefined): string[] => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const invalid = (message: string, details?: Record<string, unknown>): Decoded => ({ ok: false, error: { code: "invalid_input", message, ...(details ? { details } : {}) } });

const HTTP_SCHEMA: Record<HttpMethod, z.ZodObject> = {
  listPlaces: S.listHttpQuery,
  countPlaces: S.listHttpQuery,
  listTrips: S.listHttpQuery,
  near: S.nearHttpQuery,
  towns: S.townsHttpQuery,
  search: S.searchHttpQuery,
  parse: S.parseHttpQuery,
  getTrip: S.profileHttpQuery,
  getExport: S.exportHttpQuery,
};

const LIST_METHODS = new Set<HttpMethod>(["listPlaces", "countPlaces", "listTrips", "near"]);
const NORMALISE: Record<string, (v: string) => string> = { country: (v) => v.toUpperCase() };

function isBad(x: unknown): x is { bad: string } {
  return typeof x === "object" && x !== null && "bad" in x;
}

function posInt(v: string | undefined, name: string): number | undefined | { bad: string } {
  if (v === undefined || v === "") return undefined;
  return /^[1-9]\d*$/.test(v) ? Number(v) : { bad: `${name} must be a positive integer` };
}

/** The list part of a query: free text, facets, sort, bbox and ids, as decodeState reads them. */
function listQuery(flat: Record<string, string | undefined>, scoped: Record<string, string[]>): S.PlaceQuery | { bad: string } {
  const q: S.PlaceQuery = {};
  if (flat.q) q.q = flat.q;
  const facets: Record<string, string[]> = {};
  for (const k of S.PLACE_FACET_KEYS) {
    const values = csv(flat[k]).map((v) => (NORMALISE[k] ? NORMALISE[k](v) : v));
    if (values.length) facets[k] = values;
  }
  Object.assign(facets, scoped);
  if (Object.keys(facets).length) q.facets = facets;
  let sort = csv(flat.sort);
  if (sort.length === 1 && flat.dir === "desc" && !sort[0]!.startsWith("-")) sort = [`-${sort[0]}`];
  else if (sort.length === 1 && flat.dir === "asc") sort = [sort[0]!.replace(/^-/, "")];
  if (sort.length) q.sort = sort;
  if (flat.bbox) {
    const n = flat.bbox.split(",").map(Number);
    if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return { bad: "bbox is west,south,east,north in degrees" };
    q.bbox = n as [number, number, number, number];
  }
  const ids = csv(flat.ids);
  if (ids.length) q.ids = ids;
  return q;
}

/** Splits URL parameters into the method's flat keys and the scoped `f.<facet>` keys; refuses unknown keys and repeated keys. */
function split(method: HttpMethod, params: URLSearchParams): { flat: Record<string, string>; scoped: Record<string, string[]> } | { bad: string; details?: Record<string, unknown> } {
  const known = new Set(Object.keys(HTTP_SCHEMA[method].shape));
  const flat: Record<string, string> = {};
  const scoped: Record<string, string[]> = {};
  const unknown: string[] = [];
  for (const [k, v] of params) {
    if ((S.PAGE_ONLY_KEYS as readonly string[]).includes(k)) continue;
    if (LIST_METHODS.has(method) && k.startsWith("f.") && S.FACET_KEY_RE.test(k)) {
      const values = csv(v);
      if (values.length) scoped[k] = values;
      continue;
    }
    if (!known.has(k)) unknown.push(k);
    else if (k in flat) return { bad: `${k} appears twice; use one comma list` };
    else flat[k] = v;
  }
  if (unknown.length) return { bad: `unknown query parameter: ${unknown.join(", ")}`, details: { unknown } };
  return { flat, scoped };
}

const profileOf = (flat: Record<string, string>): S.TripProfile | undefined => {
  const p: Record<string, string> = {};
  for (const k of Object.keys(S.profileHttpQuery.shape)) if (flat[k]) p[k] = flat[k]!;
  return Object.keys(p).length ? (p as S.TripProfile) : undefined;
};

/**
 * Decodes a request's query (and its path parameters) into the store call, then checks it with the method's input schema. Every failure
 * is `invalid_input` with the reason; a well-formed request that is too big for the store still reaches the store (its 413).
 */
export function fromSearchParams(method: HttpMethod, params: URLSearchParams, path: Record<string, string> = {}): Decoded {
  const parts = split(method, params);
  if ("bad" in parts) return invalid(parts.bad, parts.details);
  const { flat, scoped } = parts;
  const shape = HTTP_SCHEMA[method].safeParse(flat);
  if (!shape.success) return invalid("a query parameter is malformed", { issues: shape.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const checked = <T>(schema: z.ZodType<T>, value: unknown): T | { bad: string; issues: unknown } => {
    const r = schema.safeParse(value);
    return r.success ? r.data : { bad: "the request does not match the contract", issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  };
  const fail = (x: { bad: string }) => {
    const issues = (x as { issues?: unknown }).issues;
    return invalid(x.bad, issues ? { issues } : undefined);
  };

  if (LIST_METHODS.has(method)) {
    const lq = listQuery(flat, scoped);
    if (isBad(lq)) return fail(lq);
    const page: S.ApiPage = {};
    for (const k of ["page", "pageSize"] as const) {
      const n = posInt(flat[k], k);
      if (isBad(n)) return fail(n);
      if (n !== undefined) page[k] = n;
    }
    if (method === "near") {
      const nq: S.NearQuery = { ...lq };
      if (flat.near) nq.near = flat.near;
      const city = lq.facets?.city?.[0];
      if (city) nq.city = city;
      if (flat.r) nq.r = Number(flat.r);
      const q = checked(S.nearQuery, nq);
      return isBad(q) ? fail(q) : { ok: true, args: { method, q, page } };
    }
    if (method === "listTrips") {
      const q = checked(S.tripQuery, lq);
      return isBad(q) ? fail(q) : { ok: true, args: { method, q, page } };
    }
    const q = checked(S.placeQuery, lq);
    return isBad(q) ? fail(q) : { ok: true, args: { method: method as "listPlaces" | "countPlaces", q, page } };
  }
  switch (method) {
    case "towns": {
      const q = checked(S.townQuery, { ...flat, ...(flat.r ? { r: Number(flat.r) } : {}) });
      return isBad(q) ? fail(q) : { ok: true, args: { method, q } };
    }
    case "search": {
      const limit = posInt(flat.limit, "limit");
      if (isBad(limit)) return fail(limit);
      const scope = { ...(flat.kind ? { kind: flat.kind } : {}), ...(flat.country ? { country: flat.country.toLowerCase() } : {}) };
      const q = checked(S.searchQuery, { q: flat.q ?? "", ...(Object.keys(scope).length ? { scope } : {}), ...(limit !== undefined ? { limit } : {}) });
      return isBad(q) ? fail(q) : { ok: true, args: { method, q } };
    }
    case "parse": {
      const dropped = csv(flat.dropped);
      const q = checked(S.parseInput, { q: flat.q ?? "", ...(flat.target ? { target: flat.target } : {}), ...(dropped.length ? { dropped } : {}) });
      return isBad(q) ? fail(q) : { ok: true, args: { method, q } };
    }
    case "getTrip": {
      const profile = profileOf(flat);
      const q = checked(S.tripSlugInput, { slug: path.slug ?? "", ...(profile ? { profile } : {}) });
      return isBad(q) ? fail(q) : { ok: true, args: { method, slug: q.slug, ...(q.profile ? { profile: q.profile } : {}) } };
    }
    case "getExport": {
      const profile = profileOf(flat);
      const q = checked(S.exportQuery, { type: path.type, slug: path.slug, format: flat.format ?? path.format, ...(profile ? { profile } : {}) });
      return isBad(q) ? fail(q) : { ok: true, args: { method, q } };
    }
    default:
      return invalid(`no query codec for ${method}`);
  }
}

/** The inverse for the list methods: a PlaceQuery (or NearQuery) and a page as URL parameters, in encodeState's canonical order. */
export function toSearchParams(q: S.PlaceQuery | S.NearQuery, page: S.ApiPage = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  for (const k of S.PLACE_FACET_KEYS) {
    const v = q.facets?.[k];
    if (v?.length) p.set(k, v.join(","));
  }
  for (const k of Object.keys(q.facets ?? {}).filter((x) => x.startsWith("f.")).sort()) {
    const v = q.facets![k]!;
    if (v.length) p.set(k, v.join(","));
  }
  if (q.bbox) p.set("bbox", q.bbox.join(","));
  const sort = q.sort ?? [];
  if (sort.length === 1) {
    p.set("sort", sort[0]!.replace(/^-/, ""));
    p.set("dir", sort[0]!.startsWith("-") ? "desc" : "asc");
  } else if (sort.length) p.set("sort", sort.join(","));
  if (page.page && page.page > 1) p.set("page", String(page.page));
  if (page.pageSize) p.set("pageSize", String(page.pageSize));
  if (q.ids?.length) p.set("ids", q.ids.join(","));
  if ("near" in q && q.near) p.set("near", q.near);
  if ("r" in q && q.r !== undefined) p.set("r", String(q.r));
  return p;
}
