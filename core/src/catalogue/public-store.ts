// publicStore (public-ref-aliases 5.1 B1): the one data boundary that turns a CatalogueStore's answers into public ones. Internal code
// keeps internal refs everywhere (the graph index, joins, sidecars, Neon `entity.id`, the seed, the validator); every `/api/v1` body
// (`respond`), every export file, `resolve`, and the hosted MCP when MCP-C builds on the store read a store through this wrapper, so no
// public answer holds a dated legacy folder (`canadian-rockies-sept-2029`): every string value AND every object key goes through
// `publicRef` (alias.ts `aliasDeep`), which replaces the folder with its pinned alias (`canadian-rockies-2029`).
//
// Inputs: no store method takes a ref today except `resolveRefs`, whose resolver reads public refs itself (core/src/favourites/resolve.ts:
// `fromPublicInput` on each asked ref, `publicRef` on each answered one; a dated ref asked answers `unknown`, QR4). Its rows' `asked`
// is restored verbatim after the rewrite: an echo rewritten to the alias would tell a visitor which month was the right guess (G6).
// A later method that takes a ref reads it through `fromPublicInput` here (null: answer as for an unknown ref).
//
// SERVER-SIDE ONLY: the folder table (the slug registry's `trips.folderAliases`) never reaches a client chunk. The web wires this in
// web/lib/server/store.ts (REF-W), reading the table through a `server-only` module.
import { aliasDeep, fromPublicInput, publicRef, privateRef, type FolderAliases } from "./alias.ts";
import type { CatalogueStore } from "./store.ts";
import type { Result } from "./result.ts";
import type * as S from "../schema/api/index.ts";
import { gazetteerOf, type PublicTownsHolder } from "../privacy/towns.ts";

export { aliasDeep, fromPublicInput, publicRef, privateRef, type FolderAliases };

/** A result with its data and error (message, details) in public form; the revision is a hash and is left alone. */
function aliasResult<T>(r: Result<T>, table: FolderAliases): Result<T> {
  if (r.ok) {
    const data = aliasDeep(r.data, table);
    return data === r.data ? r : { ok: true, data, revision: r.revision };
  }
  const error = aliasDeep(r.error, table);
  return error === r.error ? r : { ok: false, error };
}

/** True when a value is a CatalogueStore already wrapped by `publicStore` (wrapping twice is harmless, but a caller can assert it). */
export const PUBLIC_STORE = Symbol.for("travel.publicStore");
export const isPublicStore = (s: CatalogueStore): boolean => (s as unknown as Record<symbol, unknown>)[PUBLIC_STORE] === true;

/**
 * The store with every answer in public form (5.1 B1). `table` is the pinned folder table (`folderAliasesOf(registry)`, slugs.ts). Every
 * method of CatalogueStore is listed, so a new method fails the type check here until it is wrapped.
 */
export function publicStore(store: CatalogueStore, table: FolderAliases): CatalogueStore & PublicTownsHolder {
  const a = <T>(r: Result<T>): Result<T> => aliasResult(r, table);
  const wrapped: CatalogueStore & PublicTownsHolder = {
    // the detector's town exemption reads the inner store's loaded gazetteer (towns.ts gazetteerOf); town ids and names hold no folder
    publicTowns: () => gazetteerOf(store),
    revision: () => store.revision(),
    listPlaces: async (q, page) => a(await store.listPlaces(q, page)),
    countPlaces: async (q) => a(await store.countPlaces(q)),
    listUnchecked: async (q, page) => a(await store.listUnchecked(q, page)),
    searchCards: async (q) => a(await store.searchCards(q)),
    getPlace: async (slug) => a(await store.getPlace(slug)),
    nearbyForPlace: async (slug) => a(await store.nearbyForPlace(slug)),
    near: async (q, page) => a(await store.near(q, page)),
    towns: async (q) => a(await store.towns(q)),
    parse: async (input) => a(await store.parse(input)),
    search: async (q) => a(await store.search(q)),
    listTrips: async (q, page) => a(await store.listTrips(q, page)),
    getTrip: async (slug, profile) => a(await store.getTrip(slug, profile)),
    tripLegs: async (slug) => a(await store.tripLegs(slug)),
    getExport: async (q) => a(await store.getExport(q)),
    globeTree: async () => a(await store.globeTree()),
    globePins: async (cc) => a(await store.globePins(cc)),
    globeCard: async (key) => a(await store.globeCard(key)),
    globeFeature: async (id) => a(await store.globeFeature(id)),
    globeLine: async (id) => a(await store.globeLine(id)),
    globeCity: async (townId) => a(await store.globeCity(townId)),
    report: async (input) => a(await store.report(input)),
    resolveRefs: async (q) => {
      const r = a(await store.resolveRefs(q));
      if (!r.ok) return r;
      // `asked` is the visitor's own string, echoed verbatim (resolveRow: "as asked"): never rewritten, or the echo would be an oracle
      const asked = (q as Partial<S.ResolveQuery> | null)?.refs;
      if (!Array.isArray(asked)) return r;
      const items = r.data.items.map((row, i) => (typeof asked[i] === "string" && row.asked !== asked[i] ? { ...row, asked: asked[i] } : row));
      return { ok: true, data: { ...r.data, items }, revision: r.revision };
    },
  };
  Object.defineProperty(wrapped, PUBLIC_STORE, { value: true });
  return wrapped;
}
