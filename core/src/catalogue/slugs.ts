// Place slugs and the pinned slug registry (D-B1; schema diff risk 2), plus the canonical value of the `region` URL key (D-B3).
//
// Before the registry, every build computed every slug from the whole set: a new place with a clashing name renamed an existing page
// (`moss-glen-falls` became `moss-glen-falls-stowe`). Now `data/catalogue/slugs.json` (`catalogue-slugs/2`) pins each identity key to its
// slug. A pinned key keeps its slug forever, even when its name changes. A new key gets the computed slug and skips every pinned and
// retired slug, so a newcomer whose name clashes takes the suffix and the incumbent is never renamed. A slug changes only through
// `slugs.ts rename <key> <slug>` (the old slug is retired and answers 308 to the new one) or `slugs.ts alias <old-key> <new-key>` (an
// identity change carries the slug over and the old key is kept in `formerKeys`). `merge` records a merged record whose slug answers
// 308 to the survivor, and `withdraw` tombstones a key that is gone (its slug stays reserved and answers not_found). Trips have their
// own space with the same rules. The registry is read by the dataset builder and the stores, never served.
//
// Origin keys (store.ts A24, REF1): a page with no capture record comes from the owner's wishlist or the old prototype. Its key, and so
// its public `ref`, is `place/<slug>`, minted from the slug it got when it was first pinned. Its origin (`loc:<locations id>` or
// `proto:<prototype id>`) is linked to that ref ONLY in the private file ORIGIN_KEYS_PATH, next to the wishlist itself; the registry
// may be published, so `registryProblems` refuses any origin key in it, and `aliasKey` never writes one into `formerKeys`.
//
// Pure: no file system here. The reader lives with the builder (web/lib/public/places.ts) and core/bin/slugs.ts.
import { z } from "zod";
import { SLUG_RE } from "../schema/api/common.ts";
import { compareCodePoints } from "./sortKey.ts";

// ---- the rules of patterns 1.2 (moved from web/lib/public/slugs.ts and seeds.ts; web re-exports them) -----------------------------

export function kebab(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface SlugInput {
  /**
   * the identity key: the page's `ref` (D-B2, A24): a capture ref or a pinned `place/<slug>`. A wishlist or prototype page that is not
   * pinned yet passes its private origin key here; it never leaves the builder (the ref is minted from the slug this returns).
   */
  key: string;
  name: string;
  areaSlug: string;
  /**
   * The order of first assignment, when it differs from `key`. The builder passes the key form it used before the registry
   * (`trail:<ref>`), so an empty registry reproduces the slugs of before exactly. Only unpinned keys are ordered.
   */
  order?: string;
}

/** A capture record that gets a page of its own (web CaptureSeed has these fields, among others). */
export interface SeedSlugInput {
  ref: string;
  name: string;
  areaChain: readonly { slug: string }[];
  typeLabel: string;
}

// ---- the registry ------------------------------------------------------------------------------------------------------------------

export const SLUG_REGISTRY_SCHEMA = "catalogue-slugs/2";
/** Repository-relative path of the registry. */
export const SLUG_REGISTRY_PATH = "data/catalogue/slugs.json";

/** The key of a region in the registry: lower-case country code, a slash, the region's canonical slug (`ca/alberta`). */
export const REGION_KEY_RE = /^[a-z]{2}\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The key of a trip: `trip/<trip id>` (store.ts A4). Place keys under a trip carry more segments (`trip/<id>/<kind>:<name>`). */
export const TRIP_KEY_RE = /^trip\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A private origin key: where a page with no capture record came from (`loc:<locations id>`, `proto:<prototype id>`). It names the
 * owner's wishlist, so it lives only in ORIGIN_KEYS_PATH and in the builder's memory (A24).
 */
export const ORIGIN_KEY_RE = /^(?:loc|proto):\S/;
/** The ref of a page with no capture record: `place/<the slug it was first pinned with>` (A24). */
export const PLACE_REF_RE = /^place\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const placeRefOf = (slugIn: string): string => `place/${slugIn}`;

const slug = z.string().regex(SLUG_RE);
const key = z.string().min(1);

/**
 * One URL space (`/places/` or `/trips/`): its pinned slugs and their history. A slug is unique across `slugs`, `retired` and
 * `withdrawn` of its space; the two spaces are separate URL paths, so a trip and a place may share a slug.
 */
const slugSpace = z.strictObject({
  /** identity key -> slug, for every key that has a slug now */
  slugs: z.record(key, slug),
  /** a slug no longer used -> the key that holds the page now; it answers 308 to that key's current slug */
  retired: z.record(slug, key),
  /** a record merged into another (`same_place_as`, R-1) -> the surviving key; its slug answers 308 to the survivor's slug */
  merged: z.record(key, key),
  /** a key withdrawn with no successor (R-3) -> its slug, which stays reserved and answers not_found; `build` restores it when the record returns */
  withdrawn: z.record(key, slug),
});
export type SlugSpace = z.infer<typeof slugSpace>;
export type SpaceName = "places" | "trips";

export const slugRegistry = z.strictObject({
  schema: z.literal(SLUG_REGISTRY_SCHEMA),
  note: z.string().optional(),
  places: slugSpace,
  trips: slugSpace,
  /**
   * An identity key that `alias` replaced -> the key that carries its slug now (R-2). Chains are collapsed, so one lookup resolves an
   * old ref. SupabaseStore's loader writes this section into `entity_alias (alias, ref)` (schema diff M5).
   */
  formerKeys: z.record(key, key),
  /** region key -> its English name and every spelling a URL may carry (the slug, the name, the ISO 3166-2 code, the legacy code) */
  regions: z.record(z.string().regex(REGION_KEY_RE), z.strictObject({ name: z.string().min(1), aliases: z.array(z.string().min(1)) })),
});
export type SlugRegistry = z.infer<typeof slugRegistry>;

export const SLUG_REGISTRY_NOTE =
  "Pinned place and trip slugs, their history (retired, merged, withdrawn, former keys) and canonical region values (D-B1, D-B3). Read by the dataset builder and the stores, never served. Change it only with node core/bin/slugs.ts (build, rename, alias, merge, withdraw); --check runs in check-all.";

const emptySpace = (): SlugSpace => ({ slugs: {}, retired: {}, merged: {}, withdrawn: {} });
export const emptyRegistry = (): SlugRegistry => ({ schema: SLUG_REGISTRY_SCHEMA, note: SLUG_REGISTRY_NOTE, places: emptySpace(), trips: emptySpace(), formerKeys: {}, regions: {} });

/** The space that holds a key (pinned or withdrawn), or null. */
export function spaceOf(reg: SlugRegistry, k: string): SpaceName | null {
  for (const name of ["places", "trips"] as const) if (k in reg[name].slugs || k in reg[name].withdrawn) return name;
  return null;
}

/** Every slug a newcomer of a space may not take: pinned, retired and withdrawn ones. */
export function reservedSlugs(reg: SlugRegistry, space: SpaceName = "places"): Set<string> {
  const s = reg[space];
  return new Set([...Object.values(s.slugs), ...Object.keys(s.retired), ...Object.values(s.withdrawn)]);
}

/** The sections of a registry that hold a private origin key, once per key (A24). Empty for a registry that may be published. */
function originKeysIn(reg: SlugRegistry): string[] {
  const hits: string[] = [];
  const isOrigin = (k: string) => ORIGIN_KEY_RE.test(k);
  for (const name of ["places", "trips"] as const) {
    const s = reg[name];
    for (const k of Object.keys(s.slugs)) if (isOrigin(k)) hits.push(`${name}.slugs`);
    for (const k of Object.values(s.retired)) if (isOrigin(k)) hits.push(`${name}.retired`);
    for (const [k, v] of Object.entries(s.merged)) if (isOrigin(k) || isOrigin(v)) hits.push(`${name}.merged`);
    for (const k of Object.keys(s.withdrawn)) if (isOrigin(k)) hits.push(`${name}.withdrawn`);
  }
  for (const [k, v] of Object.entries(reg.formerKeys)) if (isOrigin(k) || isOrigin(v)) hits.push("formerKeys");
  return hits;
}

/** Problems inside the registry itself. Empty when it is consistent. */
export function registryProblems(reg: SlugRegistry): string[] {
  const parsed = slugRegistry.safeParse(reg);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const out: string[] = [];
  // A24: the registry may be published, so it never holds a private origin key (the message names where, never the key)
  const origin = originKeysIn(reg);
  if (origin.length) out.push(`${origin.length} private origin key(s) (loc/proto) in ${[...new Set(origin)].join(", ")}: run \`node core/bin/slugs.ts migrate-origins\` (A24)`);
  for (const name of ["places", "trips"] as const) {
    const s = reg[name];
    const owner = new Map<string, string>();
    for (const [k, sl] of [...Object.entries(s.slugs), ...Object.entries(s.withdrawn)]) {
      const had = owner.get(sl);
      if (had) out.push(`${name}: slug ${sl} is pinned to two keys: ${had} and ${k}`);
      else owner.set(sl, k);
      if (k in s.slugs && k in s.withdrawn) out.push(`${name}: ${k} is both pinned and withdrawn`);
    }
    for (const [sl, k] of Object.entries(s.retired)) {
      if (owner.has(sl)) out.push(`${name}: retired slug ${sl} is also pinned to ${owner.get(sl)}`);
      if (!(k in s.slugs) && !(k in s.withdrawn)) out.push(`${name}: retired slug ${sl} points at ${k}, which has no slug`);
    }
    for (const [k, survivor] of Object.entries(s.merged)) {
      if (!(k in s.slugs)) out.push(`${name}: merged key ${k} has no slug`);
      if (!(survivor in s.slugs)) out.push(`${name}: ${k} is merged into ${survivor}, which has no slug`);
      if (survivor in s.merged) out.push(`${name}: ${k} is merged into ${survivor}, which is merged itself (collapse the chain)`);
    }
  }
  for (const [old, now] of Object.entries(reg.formerKeys)) {
    if (spaceOf(reg, old)) out.push(`former key ${old} still has a slug`);
    if (!spaceOf(reg, now)) out.push(`former key ${old} points at ${now}, which has no slug`);
    if (now in reg.formerKeys) out.push(`former key ${old} points at ${now}, which is a former key itself (collapse the chain)`);
  }
  return out;
}

// ---- assignment ----------------------------------------------------------------------------------------------------------------

/** The slug a key keeps: its pinned slug, or the slug it held when it was withdrawn (restored when the record returns). */
const pinnedSlug = (s: SlugSpace, k: string): string | undefined => s.slugs[k] ?? s.withdrawn[k];

/**
 * Slugs for a set of places (patterns 1.2): the kebab name; names that collide among the newcomers all get their area appended; a
 * remaining collision gets -2, -3. With a registry, a pinned key keeps its slug, and a newcomer whose name is reserved (pinned, retired
 * or withdrawn) takes the area suffix first, then a number. Inputs are ordered by `order ?? key` in code-point order, so the result does
 * not depend on the order places were read in.
 */
export function assignPlaceSlugs(items: readonly SlugInput[], registry: SlugRegistry = emptyRegistry()): Map<string, string> {
  const out = new Map<string, string>();
  const reserved = reservedSlugs(registry);
  const used = new Set<string>(reserved);
  const free: SlugInput[] = [];
  for (const it of items) {
    const pinned = pinnedSlug(registry.places, it.key);
    if (pinned) out.set(it.key, pinned);
    else free.push(it);
  }
  const orderOf = (it: SlugInput) => it.order ?? it.key;
  const sorted = [...free].sort((a, b) => compareCodePoints(orderOf(a), orderOf(b)));
  const byBase = new Map<string, SlugInput[]>();
  for (const it of sorted) {
    const base = kebab(it.name) || "place";
    byBase.set(base, [...(byBase.get(base) ?? []), it]);
  }
  for (const [base, group] of [...byBase].sort((a, b) => compareCodePoints(a[0], b[0]))) {
    for (const it of group) {
      let s = (group.length > 1 || reserved.has(base)) && it.areaSlug ? `${base}-${it.areaSlug}` : base;
      let n = 2;
      const root = s;
      while (used.has(s)) s = `${root}-${n++}`;
      used.add(s);
      out.set(it.key, s);
    }
  }
  return out;
}

/** A slug stays readable: at most 60 characters, cut at a word. */
const shortBase = (s: string): string => (s.length <= 60 ? s : s.slice(0, 60).replace(/-[^-]*$/, ""));

/**
 * Slugs for the capture records that get a page, given the slugs already taken (`used`). A pinned ref keeps its slug; the others fill
 * free names in ref order: the plain name; then name-district; then name-district-type; then a number. A record that is itself a place
 * takes the plain name before a part cut out of another record. Reserved slugs of the registry are never taken.
 */
export function assignSeedSlugs(seeds: readonly SeedSlugInput[], used: Set<string>, registry: SlugRegistry = emptyRegistry()): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of reservedSlugs(registry)) used.add(s);
  const free: SeedSlugInput[] = [];
  for (const s of seeds) {
    const pinned = pinnedSlug(registry.places, s.ref);
    if (pinned) {
      out.set(s.ref, pinned);
      used.add(pinned);
    } else free.push(s);
  }
  const rank = (s: SeedSlugInput) => (s.ref.startsWith("part/") ? 1 : 0);
  for (const s of free.sort((a, b) => rank(a) - rank(b) || compareCodePoints(a.ref, b.ref))) {
    const base = shortBase(kebab(s.name)) || "place";
    const district = s.areaChain[2]?.slug ?? "";
    const candidates = [base, district && `${base}-${district}`, district && `${base}-${district}-${kebab(s.typeLabel)}`].filter((c): c is string => !!c);
    let sl = candidates.find((c) => !used.has(c));
    if (!sl) {
      const root = candidates[candidates.length - 1]!;
      let n = 2;
      while (used.has(`${root}-${n}`)) n++;
      sl = `${root}-${n}`;
    }
    used.add(sl);
    out.set(s.ref, sl);
  }
  return out;
}

// ---- lookups -------------------------------------------------------------------------------------------------------------------

/**
 * Where a slug that is not a live page points now (cases K9, K9.merged): a retired slug answers its key's current slug; the slug of a
 * merged record answers its survivor's slug (R-1). Null for a live page, a withdrawn slug and an unknown slug.
 */
export function movedTo(reg: SlugRegistry, slugIn: string, space: SpaceName = "places"): { slug: string; key: string } | null {
  const s = reg[space];
  const live = (k: string): { slug: string; key: string } | null => {
    const target = s.merged[k] ?? k;
    const sl = s.slugs[target];
    return sl ? { slug: sl, key: target } : null;
  };
  const retiredKey = s.retired[slugIn];
  if (retiredKey) return live(retiredKey);
  for (const [k, survivor] of Object.entries(s.merged)) if (s.slugs[k] === slugIn) return live(survivor);
  return null;
}

/** True when a slug belongs to a withdrawn key: it stays reserved and answers not_found (R-3). */
export function isWithdrawn(reg: SlugRegistry, slugIn: string, space: SpaceName = "places"): boolean {
  return Object.values(reg[space].withdrawn).includes(slugIn);
}

/**
 * The current key and slug behind any ref a client ever held (R-2): a former key resolves through `formerKeys`, a merged key through its
 * survivor. Null for an unknown or withdrawn ref.
 */
export function resolveRef(reg: SlugRegistry, ref: string): { key: string; slug: string; space: SpaceName } | null {
  let k = reg.formerKeys[ref] ?? ref;
  const space = spaceOf(reg, k);
  if (!space) return null;
  k = reg[space].merged[k] ?? k;
  const sl = reg[space].slugs[k];
  return sl ? { key: k, slug: sl, space } : null;
}

/** The current slug for a slug a client holds: itself when live, the target of a retired or merged slug, null when gone (R-19). */
export function currentSlug(reg: SlugRegistry, slugIn: string, space: SpaceName = "places"): string | null {
  const moved = movedTo(reg, slugIn, space);
  if (moved) return moved.slug;
  return Object.values(reg[space].slugs).includes(slugIn) ? slugIn : null;
}

const norm = (s: string): string => kebab(s);

/**
 * The canonical value of a `region` URL value (D-B3, contract case K14): every alias (the slug, the English name, the ISO 3166-2
 * code `CA-AB`, the code `AB`, an old name) answers with the region's canonical slug. `cc` (ISO alpha-2, any case) narrows the search
 * to one country. Returns every matching region key (`ca/alberta`) in code-point order; empty when nothing matches. More than one match
 * means the alias is shared across countries (R-20): a store answers `invalid_scope` with the candidates in `details` unless `country`
 * settles it.
 */
export function resolveRegion(reg: SlugRegistry, value: string, cc?: string | readonly string[]): string[] {
  const want = norm(value);
  if (!want) return [];
  const ccs = (typeof cc === "string" ? [cc] : (cc ?? [])).map((c) => c.toLowerCase());
  const hits: string[] = [];
  for (const [k, r] of Object.entries(reg.regions)) {
    if (ccs.length && !ccs.includes(k.slice(0, 2))) continue;
    const sl = k.slice(3);
    if ([sl, r.name, ...r.aliases].some((a) => norm(a) === want)) hits.push(k);
  }
  return hits.sort(compareCodePoints);
}

/** The slug half of a region key. */
export const regionSlugOf = (k: string): string => k.slice(3);

// ---- building, checking and changing the registry (core/bin/slugs.ts) -----------------------------------------------------------

/** What the dataset builder assigns today. */
export interface SlugSnapshot {
  /** every place key that got a slug (pages and merged records) */
  places: Record<string, string>;
  /** merged place key -> surviving key, as the builder applies `same_place_as` */
  merged: Record<string, string>;
  /** every trip key (`trip/<id>`) -> its slug */
  trips: Record<string, string>;
  regions: Record<string, { name: string; aliases: string[] }>;
  /**
   * PRIVATE: every origin key of a page with no capture record -> the `place/<slug>` ref the builder gave it (A24). The snapshot file is
   * local (web/.generated, gitignored); only ORIGIN_KEYS_PATH keeps this section.
   */
  origins?: Record<string, string>;
}

const sortedRecord = <V>(r: Record<string, V>): Record<string, V> =>
  Object.fromEntries(Object.entries(r).sort((a, b) => compareCodePoints(a[0], b[0])));

const uniqueSorted = (xs: readonly string[]): string[] => [...new Set(xs)].sort(compareCodePoints);

const sortedSpace = (s: SlugSpace): SlugSpace => ({ slugs: sortedRecord(s.slugs), retired: sortedRecord(s.retired), merged: sortedRecord(s.merged), withdrawn: sortedRecord(s.withdrawn) });

/** Pinned keys the snapshot no longer has (a blocking problem: alias, merge or withdraw them), per space. */
function missingKeys(reg: SlugRegistry, snap: SlugSnapshot): string[] {
  const out: string[] = [];
  for (const [name, now] of [["places", snap.places], ["trips", snap.trips]] as const) {
    for (const [k, sl] of Object.entries(reg[name].slugs)) {
      if (k in now) continue;
      const origin = PLACE_REF_RE.test(k) ? ` (for a wishlist or prototype page whose id changed: \`reorigin <old origin key> <new origin key>\`)` : "";
      out.push(`${k} (slug ${sl}) has no record any more: run \`node core/bin/slugs.ts alias ${JSON.stringify(k)} <new-key>\` for an identity change${origin}, \`merge\` for a merge, or \`withdraw\` when it is gone for good`);
    }
  }
  return out;
}

/** Pinned regions with no place any more: a warning, never a failure (R-20). The region stays pinned so its canonical value survives. */
function emptiedRegions(reg: SlugRegistry, snap: SlugSnapshot): string[] {
  return Object.keys(reg.regions).filter((k) => !(k in snap.regions)).map((k) => `region ${k} has no place now; it stays pinned so its URL value survives`);
}

export interface RegistryUpdate {
  registry: SlugRegistry;
  added: string[];
  problems: string[];
  warnings: string[];
}

/**
 * The registry after a build: every pinned entry kept as it is; every new key, merge, trip and region of the snapshot pinned; a
 * withdrawn key whose record came back restored with its old slug; region aliases merged. A pinned key that is gone is a problem: it
 * needs an explicit `alias`, `merge` or `withdraw`, never a silent drop.
 */
export function updateRegistry(prev: SlugRegistry, snap: SlugSnapshot): RegistryUpdate {
  const problems = [...registryProblems(prev), ...missingKeys(prev, snap)];
  const added: string[] = [];
  const next: SlugRegistry = { ...prev, places: structuredClone(prev.places), trips: structuredClone(prev.trips), formerKeys: { ...prev.formerKeys } };
  for (const [name, now] of [["places", snap.places], ["trips", snap.trips]] as const) {
    const s = next[name];
    for (const [k, sl] of Object.entries(now)) {
      if (k in s.slugs) {
        if (s.slugs[k] !== sl) problems.push(`${k}: the builder gave ${sl}, the registry pins ${s.slugs[k]}`);
        continue;
      }
      if (k in s.withdrawn) {
        if (s.withdrawn[k] !== sl) problems.push(`${k}: the builder gave ${sl}, the withdrawn slug is ${s.withdrawn[k]}`);
        delete s.withdrawn[k];
        added.push(`${k} (restored)`);
      } else added.push(k);
      s.slugs[k] = sl;
    }
  }
  for (const [k, survivor] of Object.entries(snap.merged)) {
    const had = next.places.merged[k];
    if (had === undefined) {
      next.places.merged[k] = survivor;
      added.push(`merge ${k}`);
    } else if (had !== survivor) problems.push(`${k}: the builder merges it into ${survivor}, the registry into ${had}`);
  }
  const regions: SlugRegistry["regions"] = {};
  for (const k of uniqueSorted([...Object.keys(prev.regions), ...Object.keys(snap.regions)])) {
    const a = prev.regions[k];
    const b = snap.regions[k];
    if (!a) added.push(`region ${k}`);
    regions[k] = { name: a?.name ?? b!.name, aliases: uniqueSorted([...(a?.aliases ?? []), ...(b?.aliases ?? [])]) };
  }
  const registry: SlugRegistry = { schema: SLUG_REGISTRY_SCHEMA, note: prev.note ?? SLUG_REGISTRY_NOTE, places: sortedSpace(next.places), trips: sortedSpace(next.trips), formerKeys: sortedRecord(next.formerKeys), regions };
  problems.push(...registryProblems(registry));
  return { registry, added, problems, warnings: emptiedRegions(prev, snap) };
}

/**
 * Drift between the registry and what the builder assigns (`slugs.ts --check`, check-all step "catalogue slugs are pinned"): a pinned
 * slug that would change, a pinned key with no record, a key, merge, trip or region the registry does not pin yet, and the registry's own
 * problems. `warnings` (an emptied region) never fail the check.
 */
export function registryDrift(reg: SlugRegistry, snap: SlugSnapshot): { drift: string[]; warnings: string[] } {
  const out = [...registryProblems(reg), ...missingKeys(reg, snap)];
  for (const [name, now] of [["places", snap.places], ["trips", snap.trips]] as const) {
    for (const [k, sl] of Object.entries(now)) {
      const pinned = reg[name].slugs[k];
      if (pinned === undefined) out.push(`${k} (slug ${sl}) is not pinned${k in reg[name].withdrawn ? " (it is withdrawn and has come back)" : ""}: run \`node core/bin/slugs.ts build\``);
      else if (pinned !== sl) out.push(`${k}: the builder gives ${sl}, the registry pins ${pinned}`);
    }
  }
  for (const [k, survivor] of Object.entries(snap.merged)) {
    if (reg.places.merged[k] !== survivor) out.push(`merge ${k} -> ${survivor} is not in the registry: run \`node core/bin/slugs.ts build\``);
  }
  for (const [k, survivor] of Object.entries(reg.places.merged)) {
    if (snap.merged[k] !== survivor && k in snap.places) out.push(`the registry merges ${k} into ${survivor}, the builder does not`);
  }
  for (const [k, r] of Object.entries(snap.regions)) {
    const pinned = reg.regions[k];
    if (!pinned) out.push(`region ${k} is not pinned: run \`node core/bin/slugs.ts build\``);
    else {
      const gone = r.aliases.filter((a) => !pinned.aliases.includes(a));
      if (gone.length) out.push(`region ${k}: aliases ${gone.join(", ")} are not in the registry: run \`node core/bin/slugs.ts build\``);
    }
  }
  return { drift: out, warnings: emptiedRegions(reg, snap) };
}

function need(reg: SlugRegistry, k: string): SpaceName {
  const space = spaceOf(reg, k);
  if (!space || !(k in reg[space].slugs)) throw new Error(`${k} has no slug`);
  return space;
}

/** `rename <key> <slug>`: the key takes a new slug; the old one is retired and answers 308 to it. Works for a place or a trip key. */
export function renameSlug(reg: SlugRegistry, k: string, newSlug: string): SlugRegistry {
  const space = spaceOf(reg, k);
  if (!space || !(k in reg[space].slugs)) throw new Error(`${k} has no slug to rename`);
  const s = reg[space];
  const old = s.slugs[k]!;
  if (!SLUG_RE.test(newSlug)) throw new Error(`${newSlug} is not a slug (lower-case words joined by hyphens)`);
  if (old === newSlug) throw new Error(`${k} already has the slug ${newSlug}`);
  if (reservedSlugs(reg, space).has(newSlug) && s.retired[newSlug] !== k) throw new Error(`${newSlug} is pinned, retired or withdrawn already`);
  const retired = { ...s.retired, [old]: k };
  delete retired[newSlug];
  // a slug retired earlier for this key now points at the same key's new slug: no chain of redirects
  return { ...reg, [space]: sortedSpace({ ...s, slugs: { ...s.slugs, [k]: newSlug }, retired }) };
}

/**
 * `alias <old-key> <new-key>`: an identity change (a locations place gaining a capture record, a trip import) carries the slug over.
 * The old key is remembered in `formerKeys`, so an old ref still resolves (R-2); chains are collapsed.
 */
export function aliasKey(reg: SlugRegistry, oldKey: string, newKey: string): SlugRegistry {
  // A24: an origin key never enters the registry, and so never formerKeys; an origin id that changed is `reoriginKey`
  for (const k of [oldKey, newKey]) if (ORIGIN_KEY_RE.test(k)) throw new Error("a private origin key (loc/proto) cannot be a registry key: use reorigin for a wishlist or prototype id that changed (A24)");
  const space = need(reg, oldKey);
  if (spaceOf(reg, newKey)) throw new Error(`${newKey} has a slug already; rename one of them first`);
  const s = reg[space];
  const swap = (k: string) => (k === oldKey ? newKey : k);
  const slugs = Object.fromEntries(Object.entries(s.slugs).map(([k, v]) => [swap(k), v]));
  const retired = Object.fromEntries(Object.entries(s.retired).map(([sl, k]) => [sl, swap(k)]));
  const merged = Object.fromEntries(Object.entries(s.merged).map(([k, v]) => [swap(k), swap(v)]));
  const formerKeys = Object.fromEntries([...Object.entries(reg.formerKeys).map(([o, n]) => [o, n === oldKey ? newKey : n]), [oldKey, newKey]]);
  return { ...reg, [space]: sortedSpace({ ...s, slugs, retired, merged }), formerKeys: sortedRecord(formerKeys) };
}

/** `merge <key> <survivor>`: a record merged into another page; its slug answers 308 to the survivor's (R-1). */
export function mergeKey(reg: SlugRegistry, k: string, survivor: string): SlugRegistry {
  if (need(reg, k) !== "places" || need(reg, survivor) !== "places") throw new Error("merge joins two place keys");
  if (k === survivor) throw new Error("a key cannot merge into itself");
  const target = reg.places.merged[survivor] ?? survivor;
  const merged = Object.fromEntries([...Object.entries(reg.places.merged).map(([a, b]) => [a, b === k ? target : b]), [k, target]]);
  return { ...reg, places: sortedSpace({ ...reg.places, merged }) };
}

/**
 * `withdraw <key>`: a place or trip gone with no successor (deleted, or its trip made private). Its slug stays reserved and answers
 * not_found; `build` restores it when the record comes back (R-3).
 */
export function withdrawKey(reg: SlugRegistry, k: string): SlugRegistry {
  const space = need(reg, k);
  const s = reg[space];
  if (Object.values(s.merged).includes(k)) throw new Error(`${k} is the survivor of a merge; merge or withdraw the merged records first`);
  const slugs = { ...s.slugs };
  const sl = slugs[k]!;
  delete slugs[k];
  const merged = { ...s.merged };
  delete merged[k];
  return { ...reg, [space]: sortedSpace({ ...s, slugs, merged, withdrawn: { ...s.withdrawn, [k]: sl } }) };
}

/** The file text: stable key order, one entry per line, so a diff shows exactly what moved. */
export function registryText(reg: SlugRegistry): string {
  const ordered: SlugRegistry = {
    schema: reg.schema,
    ...(reg.note ? { note: reg.note } : {}),
    places: sortedSpace(reg.places),
    trips: sortedSpace(reg.trips),
    formerKeys: sortedRecord(reg.formerKeys),
    regions: Object.fromEntries(Object.entries(sortedRecord(reg.regions)).map(([k, r]) => [k, { name: r.name, aliases: uniqueSorted(r.aliases) }])),
  };
  return `${JSON.stringify(ordered, null, 1)}\n`;
}

/** Parses the file text; throws with the schema's own message on a malformed registry. */
export function parseRegistry(text: string): SlugRegistry {
  return slugRegistry.parse(JSON.parse(text));
}

// ---- the private origin keys (A24) ----------------------------------------------------------------------------------------------

export const ORIGIN_KEYS_SCHEMA = "catalogue-origin-keys/1";
/**
 * Repository-relative path of the private origin keys: next to the wishlist store, which holds the same fact, and never read by a
 * served route, never published, never copied into the registry.
 */
export const ORIGIN_KEYS_PATH = "data/locations/page-keys.json";
export const ORIGIN_KEYS_NOTE =
  "PRIVATE (store.ts A24). The origin of every place page with no capture record (loc:<locations id>, proto:<prototype id>) -> its public ref place/<slug>. Read only by the dataset builder; never served, never published, never copied into data/catalogue/slugs.json. Change it only with node core/bin/slugs.ts (build, reorigin, migrate-origins).";

export const originKeys = z.strictObject({
  schema: z.literal(ORIGIN_KEYS_SCHEMA),
  note: z.string().optional(),
  /** origin key -> the `place/<slug>` ref minted for it; never changes once written (a rename keeps the ref, A24) */
  keys: z.record(z.string().regex(ORIGIN_KEY_RE), z.string().regex(PLACE_REF_RE)),
});
export type OriginKeys = z.infer<typeof originKeys>;

export const emptyOriginKeys = (): OriginKeys => ({ schema: ORIGIN_KEYS_SCHEMA, note: ORIGIN_KEYS_NOTE, keys: {} });

export function parseOriginKeys(text: string): OriginKeys {
  return originKeys.parse(JSON.parse(text));
}

export function originKeysText(o: OriginKeys): string {
  return `${JSON.stringify({ schema: o.schema, note: o.note ?? ORIGIN_KEYS_NOTE, keys: sortedRecord(o.keys) }, null, 1)}\n`;
}

/**
 * Problems between the origin keys and the registry: two origins sharing one ref, and a ref the registry does not hold (pinned,
 * withdrawn, merged, or a former key after `alias`). Messages name refs, never origin keys, so a log line cannot leak one.
 */
export function originProblems(o: OriginKeys, reg: SlugRegistry): string[] {
  const out: string[] = [];
  const parsed = originKeys.safeParse(o);
  if (!parsed.success) return parsed.error.issues.map((i) => `origin keys ${i.path.length > 1 ? "entry" : i.path.join(".")}: ${i.message}`);
  const seen = new Set<string>();
  for (const ref of Object.values(o.keys)) {
    if (seen.has(ref)) out.push(`origin keys: two origins share the ref ${ref}`);
    seen.add(ref);
    if (spaceOf(reg, ref) !== "places" && !(ref in reg.formerKeys)) out.push(`origin keys: ${ref} is not a place key of the registry`);
  }
  return out;
}

/** The origin keys after a build: every new origin pinned to the ref the builder minted; an origin pinned to another ref is a problem. */
export function updateOriginKeys(prev: OriginKeys, snap: SlugSnapshot): { originKeys: OriginKeys; added: number; problems: string[] } {
  const keys = { ...prev.keys };
  const problems: string[] = [];
  let added = 0;
  for (const [origin, ref] of Object.entries(snap.origins ?? {})) {
    if (!ORIGIN_KEY_RE.test(origin) || !PLACE_REF_RE.test(ref)) problems.push(`the builder gave an origin a ref that is not place/<slug>: ${ref}`);
    else if (keys[origin] === undefined) {
      keys[origin] = ref;
      added++;
    } else if (keys[origin] !== ref) problems.push(`the builder gave ${ref} to an origin pinned to ${keys[origin]}`);
  }
  return { originKeys: { schema: ORIGIN_KEYS_SCHEMA, note: prev.note ?? ORIGIN_KEYS_NOTE, keys: sortedRecord(keys) }, added, problems };
}

/** Drift between the origin keys and the builder (`slugs.ts --check`): an origin not pinned yet, or pinned to another ref. */
export function originDrift(o: OriginKeys, snap: SlugSnapshot, reg: SlugRegistry): string[] {
  const out = [...originProblems(o, reg)];
  for (const [origin, ref] of Object.entries(snap.origins ?? {})) {
    if (o.keys[origin] === undefined) out.push(`the origin of ${ref} is not pinned in ${ORIGIN_KEYS_PATH}: run \`node core/bin/slugs.ts build\``);
    else if (o.keys[origin] !== ref) out.push(`the builder gives ${ref} to an origin pinned to ${o.keys[origin]}`);
  }
  return out;
}

/**
 * `reorigin <old origin key> <new origin key>`: a wishlist or prototype id changed (an area moved, a prototype id renamed); the page
 * keeps its ref and its slug. The private counterpart of `alias`, which never touches the registry.
 */
export function reoriginKey(o: OriginKeys, oldKey: string, newKey: string): OriginKeys {
  const ref = o.keys[oldKey];
  if (ref === undefined) throw new Error("the old origin key is not pinned");
  if (!ORIGIN_KEY_RE.test(newKey)) throw new Error("the new origin key must start loc: or proto:");
  if (o.keys[newKey] !== undefined) throw new Error(`the new origin key is pinned already (to ${o.keys[newKey]})`);
  const keys = { ...o.keys, [newKey]: ref };
  delete keys[oldKey];
  return { ...o, keys: sortedRecord(keys) };
}

/**
 * `migrate-origins` (REF1, once): every origin key of the registry is rekeyed to `place/<its slug>` and moved to the origin keys. No
 * formerKeys entry is written: the old refs were only ever in responses of an API that was never deployed, and a former key would
 * publish the fact the rekey hides (A24). Refuses when a `place/<slug>` ref is a key already.
 */
export function migrateOrigins(reg: SlugRegistry, prev: OriginKeys = emptyOriginKeys()): { registry: SlugRegistry; originKeys: OriginKeys; moved: number } {
  const map = new Map<string, string>();
  for (const name of ["places", "trips"] as const) {
    for (const [k, sl] of [...Object.entries(reg[name].slugs), ...Object.entries(reg[name].withdrawn)]) {
      if (!ORIGIN_KEY_RE.test(k)) continue;
      if (name !== "places") throw new Error("an origin key in the trips space");
      const ref = placeRefOf(sl);
      if (spaceOf(reg, ref) || ref in reg.formerKeys) throw new Error(`${ref} is a registry key already`);
      map.set(k, ref);
    }
  }
  for (const [k, v] of Object.entries(reg.formerKeys)) if (ORIGIN_KEY_RE.test(k) || (ORIGIN_KEY_RE.test(v) && !map.has(v))) throw new Error("formerKeys holds an origin key with no slug: settle it by hand first");
  const swap = (k: string) => map.get(k) ?? k;
  const s = reg.places;
  const places = sortedSpace({
    slugs: Object.fromEntries(Object.entries(s.slugs).map(([k, v]) => [swap(k), v])),
    retired: Object.fromEntries(Object.entries(s.retired).map(([sl, k]) => [sl, swap(k)])),
    merged: Object.fromEntries(Object.entries(s.merged).map(([k, v]) => [swap(k), swap(v)])),
    withdrawn: Object.fromEntries(Object.entries(s.withdrawn).map(([k, v]) => [swap(k), v])),
  });
  const formerKeys = sortedRecord(Object.fromEntries(Object.entries(reg.formerKeys).map(([k, v]) => [k, swap(v)])));
  const keys = { ...prev.keys };
  for (const [origin, ref] of map) {
    if (keys[origin] !== undefined && keys[origin] !== ref) throw new Error(`an origin is pinned to ${keys[origin]} already, not ${ref}`);
    keys[origin] = ref;
  }
  const registry: SlugRegistry = { ...reg, places, formerKeys };
  const problems = registryProblems(registry);
  if (problems.length) throw new Error(problems.join("; "));
  return { registry, originKeys: { schema: ORIGIN_KEYS_SCHEMA, note: prev.note ?? ORIGIN_KEYS_NOTE, keys: sortedRecord(keys) }, moved: map.size };
}
