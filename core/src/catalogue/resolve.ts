// The store side of `resolveRefs` (FAV-1W): the registry index and the light lookup every store builds once, over its own public rows,
// so JsonStore, StubStore and a later PostgresStore answer from the same pure function (core/src/favourites/resolve.ts,
// `resolveRefsResult`). P8: the lookup holds name, kind and country only; P9: the one boundary is the store method.
//
// Privacy: the lookup is built from the PUBLIC rows only (the Places list and the Trips list). A key the registry pins whose page is not
// among them (a trip made private, an unlisted trip, a place taken off the site) has no light row, so the resolver answers it `unknown`,
// exactly like a slug that never existed.
import { buildResolveIndex, resolveRefsResult, type LightLookup, type ResolveIndex } from "../favourites/resolve.ts";
import { type FavSpace, type LightRow, type ResolveAnswer } from "../schema/favourites.ts";
import type { Result } from "./result.ts";
import type { SlugRegistry } from "./slugs.ts";

/** What a public place row gives a snapshot. */
export interface PlaceLight {
  slug: string;
  name: string;
  kind: string;
  country: string;
}

/** What a public trip row gives a snapshot. */
export interface TripLight {
  slug: string;
  title: string;
  country: string;
}

export interface ResolveSetup {
  ix: ResolveIndex;
  light: LightLookup;
}

/** The longest snapshot name the answer schema takes (favourites.ts `name`). */
const NAME_MAX = 120;
const CC = /^[A-Z]{2}$/;
const KIND = /^[a-z][a-z0-9_-]{0,39}$/;

/** A light row the answer schema accepts, or null when the row has no usable name (then the page answers `unknown`). */
function lightOf(name: string, kind: string | null, country: string): LightRow | null {
  const n = name.trim().slice(0, NAME_MAX).trim();
  if (!n) return null;
  return { name: n, kind: kind && KIND.test(kind) ? kind : null, cc: CC.test(country) ? country : null };
}

/**
 * The index and lookup for one registry and one set of public rows. Keys are matched through the registry to the slug they are pinned
 * to, and the slug to the public row, so a trip row whose `ref` was written from its slug still answers for its registry key.
 */
export function resolveSetupOf(reg: SlugRegistry, places: readonly PlaceLight[], trips: readonly TripLight[]): ResolveSetup {
  const placeBySlug = new Map<string, LightRow>();
  for (const p of places) {
    const l = lightOf(p.name, p.kind, p.country);
    if (l) placeBySlug.set(p.slug, l);
  }
  const tripBySlug = new Map<string, LightRow>();
  for (const t of trips) {
    const l = lightOf(t.title, null, t.country);
    if (l) tripBySlug.set(t.slug, l);
  }
  const light: LightLookup = (space: FavSpace, key: string) => {
    const slug = space === "place" ? reg.places.slugs[key] : reg.trips.slugs[key];
    if (slug === undefined) return null;
    return (space === "place" ? placeBySlug : tripBySlug).get(slug) ?? null;
  };
  return { ix: buildResolveIndex(reg), light };
}

/**
 * The store method's answer: `resolveRefsResult` over this setup. Every privacy rule is the resolver's own (core/src/favourites/
 * resolve.ts): a page pinned but not public answers `unknown` exactly like one that never existed, and asked by ref it names no space
 * (FAV-1X moved that rule there from a map here).
 */
export function resolveRefsAnswer(setup: ResolveSetup, input: unknown, revision: string): Result<ResolveAnswer> {
  return resolveRefsResult(setup.ix, setup.light, input, revision);
}
