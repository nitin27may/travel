// Place slugs and the pinned slug registry (D-B1; schema diff risk 2), plus the canonical value of the `region` URL key (D-B3).
//
// Before the registry, every build computed every slug from the whole set: a new place with a clashing name renamed an existing page
// (`moss-glen-falls` became `moss-glen-falls-stowe`). Now `data/catalogue/slugs.json` (`catalogue-slugs/1`) pins each identity key to its
// slug. A pinned key keeps its slug forever, even when its name changes. A new key gets the computed slug and skips every pinned and
// retired slug, so a newcomer whose name clashes takes the suffix and the incumbent is never renamed. A slug changes only through
// `slugs.ts rename <key> <slug>` (the old slug is retired and answers 308 to the new one) or `slugs.ts alias <old-key> <new-key>` (an
// identity change carries the slug over). The registry is read by the dataset builder and the stores, never served.
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
  /** the identity key: the page's `ref` (D-B2): a capture ref, `loc:<id>` or `proto:<id>` */
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

export const SLUG_REGISTRY_SCHEMA = "catalogue-slugs/1";
/** Repository-relative path of the registry. */
export const SLUG_REGISTRY_PATH = "data/catalogue/slugs.json";

/** The key of a region in the registry: lower-case country code, a slash, the region's canonical slug (`ca/alberta`). */
export const REGION_KEY_RE = /^[a-z]{2}\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugRegistry = z.strictObject({
  schema: z.literal(SLUG_REGISTRY_SCHEMA),
  note: z.string().optional(),
  /** identity key -> slug, for every key that has been given a slug (pages, and merged records whose slug redirects) */
  places: z.record(z.string().min(1), z.string().regex(SLUG_RE)),
  /** region key -> its English name and every spelling a URL may carry (the slug, the name, the ISO 3166-2 code, the legacy code) */
  regions: z.record(z.string().regex(REGION_KEY_RE), z.strictObject({ name: z.string().min(1), aliases: z.array(z.string().min(1)) })),
  /** a slug no longer used -> the key that holds the page now; it answers 308 to that key's slug */
  retired: z.record(z.string().regex(SLUG_RE), z.string().min(1)),
});
export type SlugRegistry = z.infer<typeof slugRegistry>;

export const SLUG_REGISTRY_NOTE =
  "Pinned place slugs and canonical region values (D-B1, D-B3). Read by the dataset builder and the stores, never served. Change it only with node core/bin/slugs.ts (build, rename, alias); --check runs in check-all.";

export const emptyRegistry = (): SlugRegistry => ({ schema: SLUG_REGISTRY_SCHEMA, note: SLUG_REGISTRY_NOTE, places: {}, regions: {}, retired: {} });

/** Every slug a newcomer may not take: the pinned ones and the retired ones. */
export function reservedSlugs(reg: SlugRegistry): Set<string> {
  return new Set([...Object.values(reg.places), ...Object.keys(reg.retired)]);
}

/** Problems inside the registry itself: two keys on one slug, a retired slug still in use, a retired slug pointing at no pinned key. */
export function registryProblems(reg: SlugRegistry): string[] {
  const out: string[] = [];
  const parsed = slugRegistry.safeParse(reg);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const owner = new Map<string, string>();
  for (const [key, slug] of Object.entries(reg.places)) {
    const had = owner.get(slug);
    if (had) out.push(`slug ${slug} is pinned to two keys: ${had} and ${key}`);
    else owner.set(slug, key);
  }
  for (const [slug, key] of Object.entries(reg.retired)) {
    if (owner.has(slug)) out.push(`retired slug ${slug} is also pinned to ${owner.get(slug)}`);
    if (!(key in reg.places)) out.push(`retired slug ${slug} points at ${key}, which has no slug`);
  }
  return out;
}

// ---- assignment ----------------------------------------------------------------------------------------------------------------

/**
 * Slugs for a set of places (patterns 1.2): the kebab name; names that collide among the newcomers all get their area appended; a
 * remaining collision gets -2, -3. With a registry, a pinned key keeps its slug, and a newcomer whose name is reserved (pinned or retired)
 * takes the area suffix first, then a number. Inputs are ordered by `order ?? key` in code-point order, so the result does not depend on
 * the order places were read in.
 */
export function assignPlaceSlugs(items: readonly SlugInput[], registry: SlugRegistry = emptyRegistry()): Map<string, string> {
  const out = new Map<string, string>();
  const reserved = reservedSlugs(registry);
  const used = new Set<string>(reserved);
  const free: SlugInput[] = [];
  for (const it of items) {
    const pinned = registry.places[it.key];
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
      let slug = (group.length > 1 || reserved.has(base)) && it.areaSlug ? `${base}-${it.areaSlug}` : base;
      let n = 2;
      const root = slug;
      while (used.has(slug)) slug = `${root}-${n++}`;
      used.add(slug);
      out.set(it.key, slug);
    }
  }
  return out;
}

/** A slug stays readable: at most 60 characters, cut at a word. */
const shortBase = (slug: string): string => (slug.length <= 60 ? slug : slug.slice(0, 60).replace(/-[^-]*$/, ""));

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
    const pinned = registry.places[s.ref];
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
    let slug = candidates.find((c) => !used.has(c));
    if (!slug) {
      const root = candidates[candidates.length - 1]!;
      let n = 2;
      while (used.has(`${root}-${n}`)) n++;
      slug = `${root}-${n}`;
    }
    used.add(slug);
    out.set(s.ref, slug);
  }
  return out;
}

// ---- lookups -------------------------------------------------------------------------------------------------------------------

/** Where a retired slug points now: the current slug of the key that replaced it, or null when the slug is not retired. */
export function movedTo(reg: SlugRegistry, slug: string): { slug: string; key: string } | null {
  const key = reg.retired[slug];
  if (!key) return null;
  const current = reg.places[key];
  return current ? { slug: current, key } : null;
}

const norm = (s: string): string => kebab(s);

/**
 * The canonical value of a `region` URL value (D-B3, contract case K14): every alias (the slug, the English name, the ISO 3166-2
 * code `CA-AB`, the code `AB`, an old name) answers with the region's canonical slug. `cc` (ISO alpha-2, any case) narrows the search
 * to one country, which settles a code shared by two countries. Returns the matching region keys (`ca/alberta`); empty when nothing
 * matches.
 */
export function resolveRegion(reg: SlugRegistry, value: string, cc?: string | readonly string[]): string[] {
  const want = norm(value);
  if (!want) return [];
  const ccs = (typeof cc === "string" ? [cc] : (cc ?? [])).map((c) => c.toLowerCase());
  const hits: string[] = [];
  for (const [key, r] of Object.entries(reg.regions)) {
    if (ccs.length && !ccs.includes(key.slice(0, 2))) continue;
    const slug = key.slice(3);
    if ([slug, r.name, ...r.aliases].some((a) => norm(a) === want)) hits.push(key);
  }
  return hits.sort(compareCodePoints);
}

/** The slug half of a region key. */
export const regionSlugOf = (key: string): string => key.slice(3);

// ---- building, checking and changing the registry (core/bin/slugs.ts) -----------------------------------------------------------

/** What the dataset builder assigns today: every key that got a slug, and every region rows carry. */
export interface SlugSnapshot {
  places: Record<string, string>;
  regions: Record<string, { name: string; aliases: string[] }>;
}

const sortedRecord = <V>(r: Record<string, V>): Record<string, V> =>
  Object.fromEntries(Object.entries(r).sort((a, b) => compareCodePoints(a[0], b[0])));

const uniqueSorted = (xs: readonly string[]): string[] => [...new Set(xs)].sort(compareCodePoints);

/**
 * The registry after a build: every pinned entry kept as it is, every new key and region of the snapshot pinned with the slug the
 * builder gave it, region aliases merged. Fails (returns problems) when a pinned key or region is gone: that needs an explicit
 * `alias`, never a silent drop.
 */
export function updateRegistry(prev: SlugRegistry, snap: SlugSnapshot): { registry: SlugRegistry; added: string[]; problems: string[] } {
  const problems = [...registryProblems(prev), ...missing(prev, snap)];
  const places: Record<string, string> = { ...prev.places };
  const added: string[] = [];
  for (const [key, slug] of Object.entries(snap.places)) {
    if (key in places) {
      if (places[key] !== slug) problems.push(`${key}: the builder gave ${slug}, the registry pins ${places[key]}`);
      continue;
    }
    places[key] = slug;
    added.push(key);
  }
  const regions: SlugRegistry["regions"] = {};
  for (const key of uniqueSorted([...Object.keys(prev.regions), ...Object.keys(snap.regions)])) {
    const a = prev.regions[key];
    const b = snap.regions[key];
    if (!a) added.push(`region ${key}`);
    regions[key] = { name: a?.name ?? b!.name, aliases: uniqueSorted([...(a?.aliases ?? []), ...(b?.aliases ?? [])]) };
  }
  const registry: SlugRegistry = { schema: SLUG_REGISTRY_SCHEMA, ...(prev.note ? { note: prev.note } : {}), places: sortedRecord(places), regions, retired: sortedRecord(prev.retired) };
  problems.push(...registryProblems(registry));
  return { registry, added, problems };
}

function missing(reg: SlugRegistry, snap: SlugSnapshot): string[] {
  const out: string[] = [];
  for (const key of Object.keys(reg.places)) {
    if (!(key in snap.places)) out.push(`${key} (slug ${reg.places[key]}) has no record any more: run \`node core/bin/slugs.ts alias ${JSON.stringify(key)} <new-key>\` to carry its slug over`);
  }
  for (const key of Object.keys(reg.regions)) {
    if (!(key in snap.regions)) out.push(`region ${key} has no place any more: its canonical value would vanish from URLs; rename it in the registry or restore the region`);
  }
  return out;
}

/**
 * Drift between the registry and what the builder assigns (`slugs.ts --check`, check-all step "catalogue slugs are pinned"): a pinned
 * slug that would change, a pinned key or region with no record (needs `alias`), a key or region the registry does not pin yet (needs
 * `build`), and the registry's own problems. Empty when they agree.
 */
export function registryDrift(reg: SlugRegistry, snap: SlugSnapshot): string[] {
  const out = [...registryProblems(reg), ...missing(reg, snap)];
  for (const [key, slug] of Object.entries(snap.places)) {
    const pinned = reg.places[key];
    if (pinned === undefined) out.push(`${key} (slug ${slug}) is not pinned: run \`node core/bin/slugs.ts build\``);
    else if (pinned !== slug) out.push(`${key}: the builder gives ${slug}, the registry pins ${pinned}`);
  }
  for (const [key, r] of Object.entries(snap.regions)) {
    const pinned = reg.regions[key];
    if (!pinned) out.push(`region ${key} is not pinned: run \`node core/bin/slugs.ts build\``);
    else {
      const gone = r.aliases.filter((a) => !pinned.aliases.includes(a));
      if (gone.length) out.push(`region ${key}: aliases ${gone.join(", ")} are not in the registry: run \`node core/bin/slugs.ts build\``);
    }
  }
  return out;
}

/** `rename <key> <slug>`: the key takes a new slug; the old one is retired and answers 308 to it. */
export function renameSlug(reg: SlugRegistry, key: string, slug: string): SlugRegistry {
  const old = reg.places[key];
  if (!old) throw new Error(`${key} has no slug to rename`);
  if (!SLUG_RE.test(slug)) throw new Error(`${slug} is not a slug (lower-case words joined by hyphens)`);
  if (old === slug) throw new Error(`${key} already has the slug ${slug}`);
  if (reservedSlugs(reg).has(slug) && reg.retired[slug] !== key) throw new Error(`${slug} is pinned or retired already`);
  const retired = { ...reg.retired, [old]: key };
  delete retired[slug];
  // a slug retired earlier for this key now points at the same key's new slug: no chain of redirects
  return { ...reg, places: sortedRecord({ ...reg.places, [key]: slug }), retired: sortedRecord(retired) };
}

/** `alias <old-key> <new-key>`: an identity change (a merge, a locations place gaining a capture record) carries the slug over. */
export function aliasKey(reg: SlugRegistry, oldKey: string, newKey: string): SlugRegistry {
  const slug = reg.places[oldKey];
  if (!slug) throw new Error(`${oldKey} has no slug`);
  if (newKey in reg.places) throw new Error(`${newKey} has a slug already (${reg.places[newKey]}); rename one of them first`);
  const places = { ...reg.places, [newKey]: slug };
  delete places[oldKey];
  const retired = Object.fromEntries(Object.entries(reg.retired).map(([s, k]) => [s, k === oldKey ? newKey : k]));
  return { ...reg, places: sortedRecord(places), retired: sortedRecord(retired) };
}

/** The file text: stable key order, one entry per line, so a diff shows exactly what moved. */
export function registryText(reg: SlugRegistry): string {
  const ordered: SlugRegistry = {
    schema: reg.schema,
    ...(reg.note ? { note: reg.note } : {}),
    places: sortedRecord(reg.places),
    regions: Object.fromEntries(Object.entries(sortedRecord(reg.regions)).map(([k, r]) => [k, { name: r.name, aliases: uniqueSorted(r.aliases) }])),
    retired: sortedRecord(reg.retired),
  };
  return `${JSON.stringify(ordered, null, 1)}\n`;
}

/** Parses the file text; throws with the schema's own message on a malformed registry. */
export function parseRegistry(text: string): SlugRegistry {
  return slugRegistry.parse(JSON.parse(text));
}
