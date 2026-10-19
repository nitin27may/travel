import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { primaryRef, type World } from '@travel/core/capture/records.ts';
import type { CaptureRecord } from '@travel/core/schema/capture/records.ts';
import { AREAS as TRAIL_AREAS, TRAIL_TYPE, cleanNote } from './trail-places';
import { publicSentences } from './dateless';
import { TRIP_SLUGS, kebab } from './slugs';
import { folderVisibility, type Sources } from './sources';
import type { AreaRef, PlaceKind, Point } from './types';

// A page for every capture place, route and offer that a public trip holds and that has none yet (backlog 3.48). The records come
// from the capture world (data/capture/<trip>/*.json); this module only decides WHICH record gets a page and with what name, area,
// point and kind. The page body (the 14 sections, Who it suits, relevance) is built from the record by the S1 modules, the same way
// as for every other place. Nothing here invents a point: a record has one only when data/relevance/inputs/points.json holds an
// OpenStreetMap or Wikidata coordinate for its own ref.
//
// Which record gets a page (the type rule, documented in docs/v2/build/public-site/L4c-capture-pages.md):
//  - its layer is place, route or offer (an event is not a place), and the trip is public;
//  - its type is VISITABLE: the nearest node of the type tree with `marks` says `draw` is R or R? (a draw is expected: something to
//    see or do). Food, stays and access (`draw` N) are infrastructure and get no page. A settlement keeps `draw` R but is a base
//    here, not a sight, so the `settlement` domain is left out (BASE_DOMAINS);
//  - a trail route (`nature.trail.*`) is built by trail-places.ts, not here;
//  - an offer that sits at or on a place that has a page is shown under that place ("At this place you can also", the ticket under
//    a lift) and gets no page of its own; a standalone offer (a horse ride, a heli flight) is itself the place;
//  - a record whose name an existing place already carries is that place (no second page); a payoff part cut out of a trail that
//    carries the trail's name is the trail's own.

/** Domains of the type tree whose records are bases or services, not sights, although the type carries a draw. */
export const BASE_DOMAINS: ReadonlySet<string> = new Set(['settlement']);

export interface TypeInfo {
  id: string;
  label: string;
  /** `draw` is R or R? on the nearest node with marks, and the domain is not a base domain */
  visitable: boolean;
  kind: PlaceKind;
  subkind: string | null;
}

interface TypeNode { id: string; parent: string | null; level: string; label: string; legacy?: { kind: string; subkind?: string }[]; marks?: Record<string, string> }

/** Types with no `legacy` pair anywhere up their chain, mapped to a place kind. Everything else comes from the tree. */
const KIND_BY_TYPE: Record<string, PlaceKind> = {
  'nature.landform.valley': 'area',
  'nature.landform.mountain': 'viewpoint',
  'nature.landform.glacier_view': 'viewpoint',
  'nature.protected.state_provincial_park': 'area',
  'water.body.pond_reservoir': 'lake',
  'water.body.river': 'sight',
  'water.body.sea_bay_fjord': 'sight',
  'wheels.drive.mountain_pass': 'viewpoint',
  'culture.heritage.dam': 'sight',
  'snow.ski.nordic_centre': 'activity',
};
const LEGACY_KIND: Record<string, PlaceKind> = { swim_spot: 'sight', drive: 'sight' };
const PLACE_KIND_SET: ReadonlySet<string> = new Set(['trail', 'lake', 'viewpoint', 'waterfall', 'sight', 'town', 'area', 'activity', 'lift', 'stay', 'eatery']);

const typeTables = new Map<string, Map<string, TypeInfo>>();

/** Type id -> label, whether it is visitable and the place kind its page has. Read from data/vocab/types.json, so a new type is a data entry. */
export function typeTable(root: string): Map<string, TypeInfo> {
  const hit = typeTables.get(root);
  if (hit) return hit;
  const file = path.join(root, 'data', 'vocab', 'types.json');
  const nodes = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { nodes: TypeNode[] }).nodes : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, TypeInfo>();
  for (const n of nodes) {
    let marks: Record<string, string> | undefined;
    let legacy: { kind: string; subkind?: string }[] | undefined;
    for (let x: TypeNode | undefined = n; x; x = x.parent ? byId.get(x.parent) : undefined) {
      marks ??= x.marks;
      legacy ??= x.legacy;
    }
    const domain = n.id.split('.')[0]!;
    const draw = marks?.draw;
    const l = legacy?.[0];
    const raw = l ? (LEGACY_KIND[l.kind] ?? l.kind) : KIND_BY_TYPE[n.id];
    const kind: PlaceKind = raw && PLACE_KIND_SET.has(raw) ? (raw as PlaceKind) : 'activity';
    out.set(n.id, { id: n.id, label: n.label, visitable: (draw === 'R' || draw === 'R?') && !BASE_DOMAINS.has(domain), kind, subkind: l?.subkind ?? null });
  }
  typeTables.set(root, out);
  return out;
}

export interface CaptureSeed {
  /** Capture ref: the slug key and the join to the sidecars. */
  ref: string;
  /** Refs that used to name the record; they keep resolving to this page. */
  aliasRefs: string[];
  /** The page name: the record's name without a trailing parenthetical note. */
  name: string;
  /** Every name a trip may call the place by (the record name and the page name), for the name lookup. */
  names: string[];
  type: string;
  typeLabel: string;
  layer: string;
  kind: PlaceKind;
  subkind: string | null;
  tripFolder: string;
  areaChain: AreaRef[];
  areaLabel: string;
  point: Point | null;
  summary: string;
}

export interface SeedSkip { ref: string; name: string; type: string; trip: string; why: string }

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "Banff Gondola (Sulphur Mountain summit)" -> "Banff Gondola". A note in brackets is a working note, not part of the name. */
export function displayName(name: string): string {
  const cut = name.replace(/\s*\([^)]*(?:\)|$)/g, ' ').replace(/\s+/g, ' ').replace(/[\s,;:-]+$/, '').trim();
  return cut.length >= 3 ? cut : name.trim();
}

const country = (name: string, slug: string): AreaRef => ({ level: 'country', name, slug });
const area = (level: 'state' | 'district', name: string): AreaRef => ({ level, name, slug: kebab(name) });
const chain = (c: AreaRef, state: string, district: string): AreaRef[] => [c, area('state', state), area('district', district)];
const CA = country('Canada', 'ca');

const BC_PLACES = /^(Yoho|Kootenay|Mount Robson|Mount Assiniboine|Elk Lakes|Golden|Radium|Whiteswan)/;

/** The Rockies datasets name a park or town for each sight and adventure: that is the district. Alberta unless the park is in BC. */
export function rockiesDistrict(park: string): AreaRef[] {
  const first = (park.split('/')[0] ?? park).trim();
  const district = first.replace(/\s+(?:BC|Provincial Park|National Park|Wildland.*)$/, '').replace(/^Rockies$/, 'Banff').trim() || 'Banff';
  return chain(CA, BC_PLACES.test(first) ? 'British Columbia' : 'Alberta', district);
}

/**
 * Areas written out for the places of the trips that have no trails.json or Rockies dataset, keyed by the record's short ref
 * (the ref without `part/`, the trip prefix and the `#part`). A trail's area (trail-places.ts) is the area of its payoff.
 */
const IT = country('Italy', 'it');
const FR = country('France', 'fr');
const CH = country('Switzerland', 'ch');
const IS = country('Iceland', 'is');
const AR = country('Argentina', 'ar');
const US = country('United States', 'us');
const CHX = chain(FR, 'Auvergne-Rhone-Alpes', 'Chamonix Valley');
const MYVATN = chain(IS, 'Northeast Iceland', 'Myvatn');
const SNAEFELLSNES = chain(IS, 'West Iceland', 'Snaefellsnes');
const SOUTH_COAST = chain(IS, 'South Iceland', 'South Coast');
const GOLDEN_CIRCLE = chain(IS, 'South Iceland', 'Golden Circle');
const USHUAIA = chain(AR, 'Tierra del Fuego', 'Ushuaia');
const CALAFATE = chain(AR, 'Santa Cruz', 'El Calafate');
const SEED_AREAS: Record<string, AreaRef[]> = {
  'lift:aiguille du midi': CHX,
  'lake:lac des gaillands': CHX,
  'lake:lac du chatelard': CHX,
  'lift:montenvers train': CHX,
  'sight:emosson dam and dinosaur tracks': chain(CH, 'Valais', 'Emosson'),
  'sight:grotte de la mer de glace': CHX,
  'viewpoint:mont blanc reflection': CHX,
  'activity:myvatn nature baths': MYVATN,
  'sight:blue lagoon area lava fields': chain(IS, 'Southwest Iceland', 'Reykjanes'),
  'sight:borgarfjordur waterfalls': chain(IS, 'West Iceland', 'Borgarfjordur'),
  'sight:dettifoss': chain(IS, 'Northeast Iceland', 'Jokulsargljufur'),
  'sight:geysir': GOLDEN_CIRCLE,
  'sight:gullfoss': GOLDEN_CIRCLE,
  'sight:glaumbaer turf farm': chain(IS, 'Northwest Iceland', 'Skagafjordur'),
  'sight:godafoss': chain(IS, 'Northeast Iceland', 'Skjalfandi'),
  'sight:namaskard': MYVATN,
  'sight:seljalandsfoss': SOUTH_COAST,
  'sight:skogafoss': SOUTH_COAST,
  'town:akureyri botanical garden': chain(IS, 'North Iceland', 'Akureyri'),
  'trail:djupalonssandur': SNAEFELLSNES,
  'viewpoint:diamond beach': chain(IS, 'South Iceland', 'Vatnajokull'),
  'viewpoint:jokulsarlon': chain(IS, 'South Iceland', 'Vatnajokull'),
  'viewpoint:kirkjufell': SNAEFELLSNES,
  'viewpoint:reynisfjara beach': SOUTH_COAST,
  'viewpoint:snaefellsjokull view': SNAEFELLSNES,
  'lake:beagle channel boat': USHUAIA,
  'sight:penguin colony stop': USHUAIA,
  'viewpoint:lapataia bay': USHUAIA,
  'sight:perito moreno walkways': CALAFATE,
  'viewpoint:laguna nimez birds': CALAFATE,
  'viewpoint:evening fitz roy glow': chain(AR, 'Santa Cruz', 'El Chalten'),
  'sight:fruita orchards': chain(US, 'Utah', 'Capitol Reef'),
  'sight:goblin valley': chain(US, 'Utah', 'Goblin Valley'),
  'sight:temple square': chain(US, 'Utah', 'Salt Lake City'),
  'sight:zion canyon scenic drive by shuttle': chain(US, 'Utah', 'Zion'),
  'viewpoint:bryce amphitheatre rim': chain(US, 'Utah', 'Bryce Canyon'),
  'viewpoint:sunset point': chain(US, 'Utah', 'Bryce Canyon'),
  'viewpoint:dead horse point': chain(US, 'Utah', 'Moab'),
  'viewpoint:grand view point': chain(US, 'Utah', 'Canyonlands'),
  'sight:covered bridge loop': chain(US, 'Vermont', 'Lamoille County'),
  'viewpoint:burke mountain overlook': chain(US, 'Vermont', 'Burke'),
  'viewpoint:smugglers notch': chain(US, 'Vermont', 'Smugglers Notch'),
  'sight:ragged falls': chain(CA, 'Ontario', 'Algonquin Park'),
  'viewpoint:dorset lookout tower': chain(CA, 'Ontario', 'Lake of Bays'),
  'viewpoint:dwight beach sunset': chain(CA, 'Ontario', 'Lake of Bays'),
};

/** `part/trip/x/trail:laguna capri#payoff` -> `trail:laguna capri`; `legacy/canadian-rockies-sept-2029/sights/bow-lake` -> `sights/bow-lake`. */
export const shortRef = (ref: string): string => ref.replace(/^part\//, '').replace(/#.*$/, '').replace(/^(?:trip\/[^/]+\/|place\/|legacy\/[^/]+\/)/, '');

const POINT_OSM = /\bOSM\s+(node|way|relation)\s+(\d+)/i;
const POINT_OSM_SNAP = /\bosm_(node|way|relation)\s+(\d+)/i;
const POINT_WD = /\b(Q\d+)\s+P625\b/;

/**
 * A point only from the record's own OpenStreetMap or Wikidata coordinate. A derived trailhead ("trailhead ... at <ref>"), a
 * prototype approximation and a locations.json copy are not the place's own point, so they are not used.
 */
export function ownPoint(p: { lat: number; lon: number; coord_src?: string; point_source?: string } | undefined): Point | null {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  const s = p.point_source ?? '';
  const osm = POINT_OSM.exec(s) ?? POINT_OSM_SNAP.exec(s);
  if (osm && p.coord_src !== 'prototype') return { lat: p.lat, lon: p.lon, pointSource: `osm_${osm[1]!.toLowerCase()}:${osm[2]}`, pointChecked: null, sourceLicence: 'ODbL' };
  const wd = POINT_WD.exec(s);
  if (wd && p.coord_src === 'wikidata') return { lat: p.lat, lon: p.lon, pointSource: `wikidata:${wd[1]}`, pointChecked: null, sourceLicence: 'CC0' };
  return null;
}

interface RockiesRow { id: string; name?: string; park?: string; what?: string }

export interface SeedContext {
  src: Sources;
  world: World;
  /** normalised names of the pages that exist before the trail pages (locations and prototype places) */
  placeNames: ReadonlySet<string>;
  /** normalised names of the trail pages */
  trailNames: ReadonlySet<string>;
  /** the area chain of each existing page by normalised name, for a part cut out of a record that has a page */
  areaByName: ReadonlyMap<string, AreaRef[]>;
}

export interface SeedBuild { seeds: CaptureSeed[]; skipped: SeedSkip[] }

/** The seeds of every visitable capture record of a public trip that has no page. Order is by ref, so two builds agree. */
export function captureSeeds(ctx: SeedContext): SeedBuild {
  const { src, world } = ctx;
  const types = typeTable(src.root);
  const folderOfTrip = new Map(Object.entries(TRIP_SLUGS).map(([folder, slug]) => [slug, folder]));
  const rockies = {
    sights: new Map((src.rockies?.sights as unknown as RockiesRow[] | undefined)?.map((r) => [r.id, r]) ?? []),
    adventures: new Map((src.rockies?.adventures as unknown as RockiesRow[] | undefined)?.map((r) => [r.id, r]) ?? []),
    trails: new Map((src.rockies?.trails as unknown as RockiesRow[] | undefined)?.map((r) => [r.id, r]) ?? []),
  };
  const skipped: SeedSkip[] = [];
  const skip = (rec: CaptureRecord, trip: string, why: string) => skipped.push({ ref: rec.ref, name: rec.name ?? rec.ref, type: rec.type, trip, why });
  const publicTrip = (trip: string): string | null => {
    const folder = folderOfTrip.get(trip);
    const mf = folder ? src.manifest.get(folder) : undefined;
    return folder && mf?.served && folderVisibility(mf) !== 'private' ? folder : null;
  };

  // pass 1: the non-offer records that qualify
  const entries = [...world.cap.values()].sort((a, b) => a.rec.ref.localeCompare(b.rec.ref));
  const keep = new Map<string, { rec: CaptureRecord; trip: string; folder: string }>();
  const offers: { rec: CaptureRecord; trip: string; folder: string }[] = [];
  for (const { rec, trip } of entries) {
    if (rec.layer === 'event') continue;
    if (rec.layer === 'route' && TRAIL_TYPE.test(rec.type)) continue; // trail-places.ts
    const folder = publicTrip(trip);
    if (!folder) {
      skip(rec, trip, 'trip is not public');
      continue;
    }
    const info = types.get(rec.type);
    if (!info?.visitable) {
      skip(rec, trip, info ? (BASE_DOMAINS.has(rec.type.split('.')[0]!) ? 'base town, not a sight' : 'infrastructure: the type has no draw') : 'unknown type');
      continue;
    }
    const name = displayName(rec.name ?? '');
    const taken = ctx.placeNames.has(norm(name)) || ctx.placeNames.has(norm(rec.name ?? ''));
    if (taken) {
      skip(rec, trip, 'a place page with this name exists');
      continue;
    }
    if (rec.ref.startsWith('part/') && (ctx.trailNames.has(norm(name)) || ctx.trailNames.has(norm(rec.name ?? '')))) {
      skip(rec, trip, "the payoff of a trail that carries its name: the trail page is its page");
      continue;
    }
    (rec.layer === 'offer' ? offers : []).push({ rec, trip, folder });
    if (rec.layer !== 'offer') keep.set(rec.ref, { rec, trip, folder });
  }

  // pass 2: an offer at or on a place that has a page is shown there; a standalone offer is a place of its own
  const hasPage = (ref: string): boolean => {
    const r = primaryRef(world, ref);
    if (keep.has(r)) return true;
    const rec = world.cap.get(r)?.rec;
    const nm = rec?.name ? [norm(rec.name), norm(displayName(rec.name))] : [];
    return nm.some((n) => ctx.placeNames.has(n) || ctx.trailNames.has(n));
  };
  for (const o of offers) {
    const targets = [...(o.rec.at ?? []), ...(o.rec.on ?? []).map((x) => x.ref)];
    const folded = targets.find(hasPage);
    if (folded) {
      skip(o.rec, o.trip, `offer: shown under ${world.cap.get(primaryRef(world, folded))?.rec.name ?? folded}`);
      continue;
    }
    keep.set(o.rec.ref, o);
  }

  // build the seeds
  const seeds: CaptureSeed[] = [];
  const parentOf = (ref: string): string => ref.replace(/^part\//, '').replace(/#.*$/, '');
  // a part cut out of a record that already has a page sits in that page's area
  const parentArea = (rec: CaptureRecord): AreaRef[] | null => {
    const parent = world.cap.get(primaryRef(world, parentOf(rec.ref)))?.rec;
    return parent?.name ? (ctx.areaByName.get(norm(parent.name)) ?? ctx.areaByName.get(norm(displayName(parent.name))) ?? null) : null;
  };
  for (const { rec, trip, folder } of [...keep.values()].sort((a, b) => a.rec.ref.localeCompare(b.rec.ref))) {
    const info = types.get(rec.type)!;
    const rk = /legacy\/canadian-rockies-sept-2029\/(sights|adventures|trails)\/([^/#]+)/.exec(rec.ref);
    const row = rk ? rockies[rk[1] as 'sights' | 'adventures' | 'trails'].get(rk[2]!) : undefined;
    const short = shortRef(rec.ref);
    const chainOf = row?.park ? rockiesDistrict(row.park) : (SEED_AREAS[short] ?? SEED_AREAS[shortRef(parentOf(rec.ref))] ?? TRAIL_AREAS[short]?.[0] ?? TRAIL_AREAS[shortRef(parentOf(rec.ref))]?.[0] ?? parentArea(rec) ?? null);
    if (!chainOf) {
      skip(rec, trip, 'no area written for this record yet');
      continue;
    }
    const name = displayName(rec.name ?? '');
    const names = [...new Set([rec.name ?? '', name].filter(Boolean))];
    const what = row && 'what' in row ? publicSentences(cleanNote(String(row.what ?? ''))) : '';
    seeds.push({
      ref: rec.ref,
      aliasRefs: rec.aliases ?? [],
      name,
      names,
      type: rec.type,
      typeLabel: info.label,
      layer: rec.layer,
      kind: info.kind,
      subkind: info.subkind,
      tripFolder: folder,
      areaChain: chainOf,
      areaLabel: `${chainOf[2]!.name}, ${chainOf[0]!.name}`,
      point: ownPoint(world.points[rec.ref] as Parameters<typeof ownPoint>[0]),
      summary: what,
    });
  }
  return { seeds, skipped };
}

/** A slug stays readable: at most 60 characters, cut at a word. */
const shortBase = (slug: string): string => (slug.length <= 60 ? slug : slug.slice(0, 60).replace(/-[^-]*$/, ''));

/**
 * Slugs for the seeds, given the slugs already taken. Existing slugs never move (the public URLs are frozen), so the seeds only fill
 * free names, in ref order: the plain name; then name-district; then name-district-type; then a number.
 */
export function assignSeedSlugs(seeds: readonly CaptureSeed[], used: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  // a record that is itself a place takes the plain name before a part cut out of another record
  const rank = (s: CaptureSeed) => (s.ref.startsWith('part/') ? 1 : 0);
  for (const s of [...seeds].sort((a, b) => rank(a) - rank(b) || a.ref.localeCompare(b.ref))) {
    const base = shortBase(kebab(s.name)) || 'place';
    const district = s.areaChain[2]?.slug ?? '';
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
