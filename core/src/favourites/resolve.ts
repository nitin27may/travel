// resolveRefs (visitor spec 4.5, 8.2): for up to 48 handles or refs, where each one is now (current, moved, merged, withdrawn, unknown)
// and its light snapshot. Pure, over the pinned slug registry (data/catalogue/slugs.json, the source of the 308 redirects) and a lookup
// of public light rows, so JsonStore, StubStore and PostgresStore answer identically: FAV-1 wires `CatalogueStore.resolveRefs` to
// `resolveRefsResult` and `GET /api/v1/resolve` to the codec below.
//
// Privacy: the registry is never served. A row names a slug, ref or snapshot only when the target has a public light row now; a key
// that is pinned but not public (a trip made private) answers `unknown`, exactly like a slug that never existed, and errors never echo
// an input. A private origin key (`loc:`, `proto:`) is not a handle or a public ref, so it is `invalid_input`.
//
// Public refs (public-ref-aliases 5.3, QR4): a ref is asked and answered in its PUBLIC form. The registry's keys are internal refs, so an
// asked ref goes through `fromPublicInput` (its alias back to the dated folder, through the registry's `trips.folderAliases`) and every
// answered `ref` through `publicRef`. A ref that itself holds a dated folder answers `unknown` with no space, exactly like a ref that
// never existed, whether or not the month is the right one: twelve guesses must not reveal the month (G6).
import { fromPublicInput, publicRef, type FolderAliases } from "../catalogue/alias.ts";
import { fail, ok, type Result } from "../catalogue/result.ts";
import { folderAliasesOf, type SlugRegistry, type SpaceName } from "../catalogue/slugs.ts";
import { REF_RE } from "../schema/api/common.ts";
import {
  favRef,
  favRefShape,
  HANDLE_RE,
  RESOLVE_MAX,
  resolveQuery,
  type FavSpace,
  type LightRow,
  type ResolveAnswer,
  type ResolveQuery,
  type ResolveRow,
  type ResolveState,
} from "../schema/favourites.ts";

/** The store method FAV-1 adds to `CatalogueStore` (store.ts); declared here so the contract and its cases land first. */
export interface ResolveRefsMethod {
  /**
   * One row per asked value, in order. More than RESOLVE_MAX values: `too_large` with `details.max`. A value that is neither a handle
   * (`place:<slug>`, `trip:<slug>`) nor a public ref: `invalid_input` with `details.paths` (indexes only, never the value). Cached by
   * the store's revision: the same revision gives the same answer.
   */
  resolveRefs(q: ResolveQuery): Promise<Result<ResolveAnswer>>;
}

/** The light row of a public page by its registry key (its public ref), or null when it is not public now. */
export type LightLookup = (space: FavSpace, key: string) => LightRow | null;

const SPACE_NAME: Record<FavSpace, SpaceName> = { place: "places", trip: "trips" };
const FAV_SPACE: Record<SpaceName, FavSpace> = { places: "place", trips: "trip" };

/** The registry's lookups, built once per revision (at 10,000 places a reverse slug map per call would be the cost of the call). */
export interface ResolveIndex {
  reg: SlugRegistry;
  /** per space: slug -> the key pinned to it */
  bySlug: Record<SpaceName, Map<string, string>>;
  /** per space: withdrawn slug -> its key */
  withdrawnBySlug: Record<SpaceName, Map<string, string>>;
  /** the pinned folder aliases (public-ref-aliases 4.3): asked refs are read and answered in their public form */
  aliases: FolderAliases;
}

export function buildResolveIndex(reg: SlugRegistry): ResolveIndex {
  const rev = (r: Record<string, string>) => new Map(Object.entries(r).map(([k, s]) => [s, k]));
  return {
    reg,
    bySlug: { places: rev(reg.places.slugs), trips: rev(reg.trips.slugs) },
    withdrawnBySlug: { places: rev(reg.places.withdrawn), trips: rev(reg.trips.withdrawn) },
    aliases: folderAliasesOf(reg),
  };
}

/** Follows `merged` to the survivor (the registry collapses chains; a cycle stops at 16 hops and reads as no survivor). */
function survivorOf(reg: SlugRegistry, space: SpaceName, k: string): string | null {
  let cur = k;
  for (let i = 0; i < 16; i++) {
    const next = reg[space].merged[cur];
    if (next === undefined) return cur;
    cur = next;
  }
  return null;
}

const unknownRow = (asked: string, space: FavSpace | null): ResolveRow => ({ asked, state: "unknown", space, slug: null, ref: null, name: null, kind: null, cc: null });

/** A row for a key that is live in the registry: public only when the lookup has it; otherwise `unknown`, as if it never existed. */
function liveRow(ix: ResolveIndex, light: LightLookup, asked: string, space: SpaceName, key: string, state: ResolveState): ResolveRow {
  const fs = FAV_SPACE[space];
  const slug = ix.reg[space].slugs[key];
  const row = slug ? light(fs, key) : null;
  const ref = publicRef(key, ix.aliases);
  if (!slug || !row || !favRef.safeParse(ref).success) return unknownRow(asked, fs);
  return { asked, state, space: fs, slug, ref, name: row.name, kind: fs === "trip" ? null : row.kind, cc: row.cc };
}

/** Where a key stands: withdrawn, merged into a survivor, or live (`stateIfLive` for a live key: current, or moved for an alias). */
function fromKey(ix: ResolveIndex, light: LightLookup, asked: string, space: SpaceName, key: string, stateIfLive: ResolveState): ResolveRow {
  const s = ix.reg[space];
  if (key in s.withdrawn) return { ...unknownRow(asked, FAV_SPACE[space]), state: "withdrawn", slug: s.withdrawn[key]! };
  if (key in s.merged) {
    const survivor = survivorOf(ix.reg, space, key);
    return survivor ? liveRow(ix, light, asked, space, survivor, "merged") : unknownRow(asked, FAV_SPACE[space]);
  }
  return liveRow(ix, light, asked, space, key, stateIfLive);
}

/** One handle (`place:<slug>`): a pinned slug, a retired slug, a merged record's slug, a withdrawn slug, or unknown. */
function resolveHandle(ix: ResolveIndex, light: LightLookup, asked: string, fs: FavSpace, slug: string): ResolveRow {
  const space = SPACE_NAME[fs];
  const pinned = ix.bySlug[space].get(slug);
  if (pinned !== undefined) return fromKey(ix, light, asked, space, pinned, "current");
  const retired = ix.reg[space].retired[slug];
  if (retired !== undefined) {
    const r = fromKey(ix, light, asked, space, retired, "moved");
    return r.state === "current" ? { ...r, state: "moved" } : r;
  }
  const gone = ix.withdrawnBySlug[space].get(slug);
  if (gone !== undefined) return { ...unknownRow(asked, fs), state: "withdrawn", slug };
  return unknownRow(asked, fs);
}

/**
 * One public ref: a key, a former key (alias: moved), a merged key, a withdrawn key, or unknown. An unknown ref names NO space (the
 * answer schema: "null for an unknown ref"), whatever the registry filed it under: a pinned key whose page is not public (a private
 * trip) must answer exactly like a ref that never existed, or the space would tell a visitor the private id exists (FAV-1X). A handle
 * keeps its space on `unknown`: the space is the asker's own word, not the registry's.
 */
function resolvePublicRef(ix: ResolveIndex, light: LightLookup, asked: string): ResolveRow {
  const internal = fromPublicInput(asked, ix.aliases);
  if (internal === null) return unknownRow(asked, null);
  const former = ix.reg.formerKeys[internal];
  const key = former ?? internal;
  for (const space of ["places", "trips"] as const) {
    const s = ix.reg[space];
    if (key in s.slugs || key in s.withdrawn) {
      const r = fromKey(ix, light, asked, space, key, former !== undefined ? "moved" : "current");
      return r.state === "unknown" ? unknownRow(asked, null) : r;
    }
  }
  return unknownRow(asked, null);
}

/** Resolves one value already known to be a handle or a public ref. */
export function resolveOne(ix: ResolveIndex, light: LightLookup, asked: string): ResolveRow {
  const h = HANDLE_RE.exec(asked);
  return h ? resolveHandle(ix, light, asked, h[1] as FavSpace, h[2]!) : resolvePublicRef(ix, light, asked);
}

/** A handle, or anything shaped like a ref: a dated ref is askable (and answers `unknown`), so it is never told apart by `invalid_input`. */
const isAskable = (v: string): boolean => HANDLE_RE.test(v) || (REF_RE.test(v) && favRefShape.safeParse(v).success);

/**
 * The whole method as a store answers it: validation, the cap, then one row per value. `input` is unchecked (a handler passes the
 * decoded query straight in), so a malformed body is `invalid_input`, never a throw.
 */
export function resolveRefsResult(ix: ResolveIndex, light: LightLookup, input: unknown, revision: string): Result<ResolveAnswer> {
  const q = resolveQuery.safeParse(input);
  if (!q.success) {
    const paths = [...new Set(q.error.issues.map((i) => i.path.join(".") || "$"))];
    return fail("invalid_input", "refs must be 1 to 48 handles (place:<slug>, trip:<slug>) or public refs", { paths });
  }
  if (q.data.refs.length > RESOLVE_MAX) return fail("too_large", `at most ${RESOLVE_MAX} refs in one call`, { max: RESOLVE_MAX });
  const bad = q.data.refs.flatMap((v, i) => (isAskable(v) ? [] : [`refs.${i}`]));
  if (bad.length) return fail("invalid_input", "each ref must be a handle (place:<slug>, trip:<slug>) or a public ref", { paths: bad });
  return ok({ items: q.data.refs.map((v) => resolveOne(ix, light, v)) }, revision);
}

// ---- the HTTP codec: GET /api/v1/resolve?ref=<value>&ref=<value> (visitor spec 8.2) ----

export const RESOLVE_PARAM = "ref";

/** The query of a request's search params: every `ref` value, in order. Validation is `resolveRefsResult`'s. */
export const resolveQueryOf = (params: URLSearchParams): { refs: string[] } => ({ refs: params.getAll(RESOLVE_PARAM) });

/** The search string of a query, values sorted so the same set is one cache key (the answer is still in the order asked). */
export function resolveSearchOf(q: ResolveQuery, opts: { sorted?: boolean } = {}): string {
  const p = new URLSearchParams();
  const refs = opts.sorted ? [...q.refs].sort() : q.refs;
  for (const r of refs) p.append(RESOLVE_PARAM, r);
  return p.toString();
}
