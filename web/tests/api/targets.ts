import { existsSync, readdirSync, statSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import type { JsonSource } from '@travel/core/catalogue/json/source.ts';
import { registryProblems, type SlugRegistry } from '@travel/core/catalogue/slugs.ts';
import { sortKey } from '@travel/core/catalogue/sortKey.ts';
import type { ContractFacts, ContractTarget, Planted } from '../../../core/test/catalogue/contract/index.ts';
import { travelRoot } from '@/lib/data/root';
import { createJsonSource } from '@/lib/server/source';
import { registryIds } from '@/lib/server/sources';

// The contract kit's `json` target on the real data (API-1b): a JsonStore over createPublicData(), with the registry COPIED and one
// rename, one merge, one withdrawal, one former key, one retired trip slug and one ambiguous region alias planted in the copy (C4), so
// the cases that need history run on real pages. Phase E layers are pending exactly as on the stub-before-E target.
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
  const tie = [...bySortKey.values()].find((v) => v.length >= 2)?.sort();
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
    town: { id: 'ca-ab-canmore', layer: false },
    exportPlace: a!.slug,
    registryIds: registryIds(travelRoot()),
    featureId: base.globe.feature('abay') ? 'abay' : 'abay',
    pinCountry: 'ca',
    // API-3a (K27): routed legs from the file; geometry arrives with TRP2b's trip-legs/2 fetch
    ...(legsTrip ? { legs: { trip: legsTrip, geometry: false } } : {}),
  };
  /** A store with `p` planted (K26, globePins.cap): a country's pins cloned up to n. Towns cannot be planted before META-2 loads a layer here. */
  const plant = (p: Planted): JsonStore => {
    const src = wrap(base);
    if (!p.pins) return new JsonStore(src);
    const { cc, n } = p.pins;
    const pins = base.globe.pins(cc) ?? [];
    const many = Array.from({ length: Math.max(n, pins.length) }, (_, i) => (i < pins.length ? pins[i]! : { ...pins[0]!, slug: `${pins[0]!.slug}-p${i}` }));
    return new JsonStore({ ...src, globe: { ...src.globe, pins: (c: string) => (c === cc ? many : base.globe.pins(c)) } });
  };
  const target: ContractTarget = {
    name: 'json',
    make: () => new JsonStore(spy()),
    makeChanged: () => new JsonStore(wrap(base, base.placeRows.map((r, i) => (i === 0 ? { ...r, name: `${r.name} (renamed)` } : r)))),
    touch: () => touchAll(path.join(travelRoot(), 'data')),
    registry: () => registry,
    rowReads: () => reads,
    plant,
    facts,
  };
  return { target, reads: () => reads, source: base };
}
