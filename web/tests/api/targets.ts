import { existsSync, readdirSync, statSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import type { JsonSource } from '@travel/core/catalogue/json/source.ts';
import { folderAliasesOf, registryProblems, type SlugRegistry } from '@travel/core/catalogue/slugs.ts';
import { publicRef, publicStore } from '@travel/core/catalogue/public-store.ts';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { sortKey } from '@travel/core/catalogue/sortKey.ts';
import type { TownRow } from '@travel/core/derive/townsData.ts';
import type { ContractFacts, ContractTarget, Planted } from '../../../core/test/catalogue/contract/index.ts';
import { REAL_CARD_ORDER } from '../../../core/test/catalogue/contract/cardOrder.golden.ts';
import { travelRoot } from '@/lib/data/root';
import { createJsonSource } from '@/lib/server/source';
import { registryIds } from '@/lib/server/sources';

// The contract kit's `json` target on the real data (API-1b): a JsonStore over createPublicData(), with the registry COPIED and one
// rename, one merge, one withdrawal, one former key, one retired trip slug and one ambiguous region alias planted in the copy (C4), so
// the cases that need history run on real pages. Phase E layers are pending exactly as on the stub-before-E target.
//
// Every store of this target is read through publicStore (public-ref-aliases 5.1 B1, REF-C acceptance A5: K7 and every shape case green on
// the real data through the wrapper; the real data holds dated legacy refs, which the schemas and the detector refuse). REF-W wires the
// same wrapper into web/lib/server/store.ts for the routes.
const PLANT = { old: 'planted-old-slug', mergedKey: 'planted/merged-record', mergedSlug: 'planted-merged-slug', withdrawnKey: 'planted/withdrawn-record', withdrawnSlug: 'planted-withdrawn-slug', formerKey: 'planted/former-key', oldTrip: 'planted-old-trip', ambiguous: 'AB-AMBIG' };

export const PHASE_E = 'phase E, N2 (nearby-and-regions.md section 7): near and nearbyForPlace answer not_available until then';

export function plantedRegistry(src: JsonSource, a: string, b: string, trip: string): SlugRegistry {
  const reg = structuredClone(src.registry);
  const keyOf = (slug: string) => src.placeRows.find((r) => r.slug === slug)!.ref;
  reg.places.retired[PLANT.old] = keyOf(a);
  reg.places.slugs[PLANT.mergedKey] = PLANT.mergedSlug;
  reg.places.merged[PLANT.mergedKey] = keyOf(b);
  reg.places.withdrawn[PLANT.withdrawnKey] = PLANT.withdrawnSlug;
  reg.formerKeys[PLANT.formerKey] = keyOf(b);
  reg.trips.retired[PLANT.oldTrip] = `trip/${trip}`;
  reg.regions['us/planted-alberta'] = { name: 'Planted Alberta', aliases: [PLANT.ambiguous] };
  reg.regions['ca/alberta']!.aliases.push(PLANT.ambiguous);
  const problems = registryProblems(reg);
  if (problems.length) throw new Error(`planted registry is inconsistent: ${problems.join('; ')}`);
  return reg;
}

function touchAll(dir: string): void {
  const now = new Date();
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) touchAll(f);
    else utimesSync(f, now, now);
  }
}

export function jsonTarget(): { target: ContractTarget; reads: () => number; source: JsonSource } {
  const base = createJsonSource();
  const exact = base.placeRows.filter((r) => !r.approx && r.lat !== null);
  const full = base.tripRows.find((t) => t.depth === 'full')!;
  const [a, b] = exact.filter((r) => base.placeDetail(r.slug)!.point?.pointSource.startsWith('osm_')).slice(0, 2);
  const registry = plantedRegistry(base, a!.slug, b!.slug, full.slug);
  let reads = 0;
  // reporting is off in the product settings; the kit's report case needs a form, so the target supplies one
  const wrap = (src: JsonSource, rows = src.placeRows): JsonSource => ({ ...src, registry, placeRows: rows, reportLink: (page: string) => `https://feedback.invalid/new?page=${encodeURIComponent(page)}` });
  const spy = (): JsonSource => {
    const s = wrap(base);
    const rows = base.placeRows;
    Object.defineProperty(s, 'placeRows', { get: () => (reads++, rows), enumerable: true });
    return s;
  };
  const counts = new Map<string, number>();
  for (const r of base.placeRows) for (const t of r.tags) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  const tagId = [...counts].filter(([, n]) => n >= 1 && n <= 12).sort((x, y) => y[1] - x[1])[0]![0];
  const bySortKey = new Map<string, string[]>();
  for (const r of base.placeRows) bySortKey.set(sortKey(r.name), [...(bySortKey.get(sortKey(r.name)) ?? []), r.ref]);
  // the pair as served: public refs (public-ref-aliases 4), in the order the served refs sort
  const tie = [...bySortKey.values()].find((v) => v.length >= 2)?.map((r) => publicRef(r, folderAliasesOf(registry))).sort();
  const alberta = registry.regions['ca/alberta']!;
  // a public trip with a legs file (K27; API-3a): the file names no trip in this test
  const legsDir = path.join(travelRoot(), 'data', 'schedules', 'legs');
  const legsSlugs = existsSync(legsDir) ? readdirSync(legsDir).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, '')) : [];
  const legsTrip = base.tripRows.find((t) => legsSlugs.includes(t.slug))?.slug;
  const facts: ContractFacts = {
    placeSlug: a!.slug,
    tripSlug: full.slug,
    retired: { from: PLANT.old, to: a!.slug },
    merged: { from: PLANT.mergedSlug, to: b!.slug },
    withdrawn: PLANT.withdrawnSlug,
    former: { ref: PLANT.formerKey, slug: b!.slug },
    tripRetired: { from: PLANT.oldTrip, to: full.slug },
    ambiguousRegion: { alias: PLANT.ambiguous, cc: 'CA' },
    tag: { id: tagId, slugs: base.placeRows.filter((r) => r.tags.some((t) => t.id === tagId)).map((r) => r.slug) },
    approxSlugs: base.placeRows.filter((r) => r.approx).map((r) => r.slug),
    ...(tie ? { sortKeyTie: [tie[0]!, tie[1]!] as [string, string] } : {}),
    region: { cc: 'CA', canonical: 'alberta', aliases: [alberta.name, 'AB', 'CA-AB', ...alberta.aliases.filter((x) => x !== PLANT.ambiguous && x !== 'alberta' && x !== 'AB' && x !== 'CA-AB' && x !== alberta.name).slice(0, 1)] },
    near: { token: `place:${a!.slug}`, unknown: 'place:no-such-place-anywhere' },
    // the towns layer is the real one (META-2: data/reference/towns); near, globeCity and nearbyForPlace answer not_available until LST2c, GLB2b and PLC2b
    town: { id: 'ca-ab-canmore', layer: true, notYet: ['near', 'globeCity', 'nearbyForPlace'] },
    exportPlace: a!.slug,
    registryIds: registryIds(travelRoot()),
    featureId: base.globe.feature('abay') ? 'abay' : 'abay',
    pinCountry: 'ca',
    // K23: a key with a gap state and a value that is not the gap option itself (`kid=unknown` IS the gap, so it leaves nothing unchecked)
    gap: { key: 'effort', value: 'moderate' },
    // API-3a (K27): routed legs from the file; geometry arrives with TRP2b's trip-legs/2 fetch
    cardOrder: { exact: false, cases: REAL_CARD_ORDER },
    ...(legsTrip ? { legs: { trip: legsTrip, geometry: false } } : {}),
  };
  /** A store with `p` planted (K26, globePins.cap): towns added to the real layer, a country's pins cloned up to n. */
  const pub = (s: JsonStore): CatalogueStore => publicStore(s, folderAliasesOf(registry));
  const plant = (p: Planted): CatalogueStore => {
    // resolveRefs.private: keys pinned in a copy of the planted registry with no public row behind them (a page made private)
    const hidden = p.hidden ? structuredClone(registry) : null;
    if (hidden && p.hidden?.place) hidden.places.slugs[p.hidden.place.key] = p.hidden.place.slug;
    if (hidden && p.hidden?.trip) hidden.trips.slugs[p.hidden.trip.key] = p.hidden.trip.slug;
    const withTowns = hidden ? { ...wrap(base), registry: hidden } : wrap(base);
    const src: JsonSource = p.towns?.length
      ? { ...withTowns, towns: () => [...(base.towns?.() ?? []), ...p.towns!.map((t): TownRow => ({ id: t.id, name: t.name, lat: t.lat, lon: t.lon, pop: t.pop ?? 0, admin1: t.id.split('-')[1]!, ascii: t.name, geonamesId: 0, cc: t.cc, admin1Name: null }))] }
      : withTowns;
    if (!p.pins) return pub(new JsonStore(src));
    const { cc, n } = p.pins;
    const pins = base.globe.pins(cc) ?? [];
    const many = Array.from({ length: Math.max(n, pins.length) }, (_, i) => (i < pins.length ? pins[i]! : { ...pins[0]!, slug: `${pins[0]!.slug}-p${i}` }));
    return pub(new JsonStore({ ...src, globe: { ...src.globe, pins: (c: string) => (c === cc ? many : base.globe.pins(c)) } }));
  };
  const target: ContractTarget = {
    name: 'json',
    make: () => pub(new JsonStore(spy())),
    // K10: one INPUT file's hash changes (the revision is computed from the inputs, A30), not a served value
    makeChanged: () => pub(new JsonStore({ ...wrap(base), revisionInputs: () => { const i = base.revisionInputs(); return { ...i, files: i.files.map((f, n) => (n === 0 ? { ...f, sha256: '0'.repeat(64) } : f)) }; } })),
    touch: () => touchAll(path.join(travelRoot(), 'data')),
    registry: () => registry,
    rowReads: () => reads,
    plant,
    facts,
  };
  return { target, reads: () => reads, source: base };
}
