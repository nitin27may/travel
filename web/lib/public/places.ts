import { PUBLIC_TRIP_FOLDER, TRIP_SLUGS, assignPlaceSlugs, kebab } from './slugs';
import { computeCompleteness, type CompletenessInput } from './completeness';
import { UNCONFIRMED_TRAIL_DATA } from './honesty-overrides';
import { honesty, uniqueHonesty } from './honesty';
import { fileFromUrl, makePhoto } from './photos';
import { CATEGORY_OF_KIND, PROTOTYPE_AREAS, kindLabel, mapLocationKind, mapPrototypeKind } from './taxonomy';
import { undatedTitle } from './dateless';
import { groupLinks, trailSeeds, type TrailSeed } from './trail-places';
import { assignSeedSlugs, captureSeeds, ownPoint, type CaptureSeed, type SeedSkip } from './seeds';
import { primaryRef } from '@travel/core/capture/records.ts';
import { loadPoints, type PointRow } from '@travel/core/capture/placementBlock.ts';
import { haversineM } from '@travel/core/geo/distance.ts';
import { ORIGIN_KEYS_PATH, SLUG_REGISTRY_PATH, emptyOriginKeys, emptyRegistry, parseOriginKeys, parseRegistry, placeRefOf, type OriginKeys, type SlugRegistry } from '@travel/core/catalogue/slugs.ts';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { publicWorld } from './world';
import deferred from './join-deferred.json';
import { applyLegacySupersedes } from './superseded';
import { loadTracks, readDate, totalsDiffer, withTrack } from './tracks';
import { folderVisibility, type ProtoFact, type ProtoPlace, type ProtoTrail, type Sources } from './sources';
import type { AccessPoint, AreaRef, Fact, Honesty, LinkGroup, LinkNone, Photo, Point, PlaceKind, PlaceLine, PublicPlace, TripRef } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface PlaceBuild {
  places: PublicPlace[];
  bySlug: Map<string, PublicPlace>;
  /** prototype place id -> slug (merged places included) */
  byProtoId: Map<string, string>;
  byLocationId: Map<string, string>;
  /** capture route ref -> slug, for the trail pages built from capture records (they have no prototype or location id) */
  byCaptureRef: Map<string, string>;
  /** normalised name -> slugs, for resolving trip stops by name */
  byName: Map<string, string[]>;
  /** old /places/<cc>/<region>/<area>/<place>/ path -> slug */
  legacyPaths: Map<string, string>;
  /** Capture records that look like places but got no page, and why (backlog 3.48). For the build report and the tests. */
  seedSkips: SeedSkip[];
  /** page slug -> its `ref` (D-B2, A24): the capture ref, else `place/<slug>`. Kept for the API; never put on a public page. */
  refBySlug: Map<string, string>;
  /** every identity key that got a slug -> the slug, merged records included: what data/catalogue/slugs.json pins (D-B1) */
  slugByRef: Map<string, string>;
  /**
   * PRIVATE (A24): the origin key (`loc:<id>`, `proto:<id>`) of every page with no capture record -> its `place/<slug>` ref. Only the
   * slug snapshot dump reads it, to maintain the private origin keys file; nothing served or published may.
   */
  originRefs: Map<string, string>;
  /** merged record ref -> the surviving page's ref (`same_place_as`): what the registry's `places.merged` pins (R-1) */
  mergedRefs: Map<string, string>;
}

/** The private origin keys (A24): which `place/<slug>` ref a wishlist or prototype page holds. A root without the file mints them. */
export function readOriginKeys(root: string): OriginKeys {
  const file = path.join(root, ORIGIN_KEYS_PATH);
  return existsSync(file) ? parseOriginKeys(readFileSync(file, 'utf8')) : emptyOriginKeys();
}

/** The pinned slug registry (D-B1). A root without one (a test fixture) assigns every slug as before the registry. */
export function readSlugRegistry(root: string): SlugRegistry {
  const file = path.join(root, SLUG_REGISTRY_PATH);
  return existsSync(file) ? parseRegistry(readFileSync(file, 'utf8')) : emptyRegistry();
}

const pointRows = new Map<string, Map<string, PointRow>>();

/**
 * Records the join holds back, with the reason on each row of join-deferred.json: three for the S13 size gate (a point adds the map card,
 * the directions links and the export waypoint, about 3.7 kB, drawn twice; the median of the place pages sits at +24.97% against +25%, and
 * these pages would tip it or pass +50%), and one whose row is a car park, not the place. Keyed by capture ref, never by slug.
 */
export const JOIN_HELD_BACK: ReadonlySet<string> = new Set(deferred.rows.map((r) => r.ref));

/**
 * The one place a page gets a point from the capture sidecars (META-1, collision E1; capture contract 3.7.1). Read order:
 *   1. the page's own builder: a point it already holds (a locations-store row, a prototype trailhead, a trail's payoff) is kept as it is,
 *      so no pin that is on a page today moves;
 *   2. data/capture/points.json, by the record's ref, then by any alias of it;
 *   3. data/relevance/inputs/points.json, by the same refs (core's `loadPoints` merges the two, the capture file first).
 * A row marked `approx` never gives a page point (an approximate point counts for Where, never for a pin or a distance, T5), and a row
 * counts only when `ownPoint` accepts its source: the record's own OpenStreetMap node, way or relation, or its Wikidata P625. A derived
 * trailhead ("trailhead ... at <ref>"), a prototype guess and a locations copy are not the record's own point. The locations store itself
 * is step 0 of `buildPlaces`: a place that has a store row carries the store's point already. `JOIN_HELD_BACK` holds back four records.
 */
export function joinPoint(root: string, ref: string, held: Point | null): Point | null {
  if (held || JOIN_HELD_BACK.has(ref)) return held;
  let rows = pointRows.get(root);
  if (!rows) pointRows.set(root, (rows = loadPoints(root).points));
  const world = publicWorld(root);
  const primary = primaryRef(world, ref);
  for (const r of [ref, primary, ...(world.cap.get(primary)?.rec.aliases ?? [])]) {
    const row = rows.get(r);
    if (!row || row.approx) continue;
    const p = ownPoint(row);
    if (p) return p;
  }
  return null;
}

export const normName = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "Jun-Oct; Rifugio open in July" -> [6..10]. Empty when no month range is written. */
export function parseSeasonMonths(text: string): number[] {
  const m = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s*(?:-|–|to|until)\\s*(${MONTHS.join('|')})`, 'i').exec(text);
  if (!m) return [];
  const a = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  const b = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const out: number[] = [];
  for (let x = a; ; x = (x % 12) + 1) {
    out.push(x);
    if (x === b || out.length > 12) break;
  }
  return out;
}

interface Rec extends Omit<PublicPlace, 'slug' | 'completeness' | 'sections' | 'suitability' | 'relevance' | 'refSlugs'> {
  locationId: string | null;
  protoId: string | null;
  checklistComplete: boolean | null;
  hasDatedSource: boolean;
  hasTrailheadPoint: boolean;
  durationMin: number | null;
  timeHours: string | null;
  tripFolders: Set<string>;
  /** Capture ref of a page built from a capture record (a trail route, or a seeded place, route or offer). */
  captureRef?: string | null;
  /** Refs that used to name the capture record, and other names a trip calls the place by: they keep resolving to this page. */
  aliasRefs?: string[];
  altNames?: string[];
}

function provenance(f: { src?: string; read?: string; conf?: string }): string {
  return [f.src, f.read ? `read ${f.read}` : null, f.conf ? `(${f.conf})` : null].filter(Boolean).join(', ');
}

/** "osm_node 123" -> "osm_node:123", "official https://x" -> "official:https://x", "manual_pin ..." -> "manual_pin". */
export function normalizePointSource(s: string): string {
  const osm = /^(osm_(?:node|way|relation))[\s:]+(\d+)/.exec(s);
  if (osm) return `${osm[1]}:${osm[2]}`;
  const off = /^official[\s:]+(\S+)/.exec(s);
  if (off) return `official:${off[1]}`;
  if (s.startsWith('manual_pin')) return 'manual_pin';
  if (s.startsWith('gps')) return 'gps';
  return s;
}

function accessPoint(p: { lat: number; lon: number; point_source: string; point_checked: string; name: string; elev_m?: number; note?: string; fee?: string; capacity?: string }): AccessPoint {
  return {
    lat: p.lat,
    lon: p.lon,
    pointSource: normalizePointSource(p.point_source),
    pointChecked: /needs a person/i.test(p.point_checked) ? null : p.point_checked,
    sourceLicence: p.point_source.startsWith('osm_') ? 'ODbL' : 'unknown',
    name: p.name,
    note: p.note ?? null,
    elevationM: p.elev_m ?? null,
    fee: p.fee ?? null,
    capacity: p.capacity ?? null,
  };
}

/**
 * Platforms whose terms allow a link only: we never show a value, rating or difficulty copied from them (backlog 2.31).
 * A fact whose source names one of these is dropped at this boundary; the platform stays available as a link.
 */
const LINK_ONLY_SOURCE = /\b(alltrails|komoot|gaia(?:\s*gps)?|outdooractive|wikiloc|strava|google|tripadvisor)\b/i;
export function citesLinkOnlyPlatform(source: string | undefined): boolean {
  return !!source && LINK_ONLY_SOURCE.test(source);
}

/**
 * The source line to show for a fact, or null when the fact has to go. A source made only of link-only platforms drops
 * the fact; "AllTrails (best months) and PLAN.md" keeps it, sourced to "PLAN.md" alone. A value that itself names a
 * platform ("May-Oct on AllTrails") is a copied statement and goes too.
 */
export function publicSource(source: string | undefined, value: string): string | null | undefined {
  if (citesLinkOnlyPlatform(value)) return null;
  if (!citesLinkOnlyPlatform(source)) return source;
  const own = (source ?? '').split(/\s+(?:and|\/)\s+/).filter((part) => part.trim() && !citesLinkOnlyPlatform(part));
  return own.length ? own.join(' and ') : null;
}

function linkOnly(kind: string): boolean {
  return kind === 'alltrails' || kind === 'komoot' || kind === 'wikiloc' || kind === 'gaia' || kind === 'fatmap';
}

function buildLinks(src: Sources, trail: ProtoTrail | undefined, place: ProtoPlace): LinkGroup[] {
  const kinds = new Map(src.snapshot.linkKinds.map((k) => [k.kind, k]));
  const rows: { kind: string; label: string; url: string; linkOnly: boolean }[] = [];
  const seen = new Set<string>();
  const push = (kind: string, label: string, url: string, only?: boolean) => {
    if (!/^https?:\/\//.test(url) || seen.has(url)) return;
    seen.add(url);
    rows.push({ kind, label, url, linkOnly: only ?? linkOnly(kind) });
  };
  for (const l of trail?.links ?? []) push(l.kind, l.label, l.url);
  for (const l of place.links ?? []) push(l.kind, l.label, l.url, l.linkOnly);
  const groups = new Map<string, LinkGroup>();
  for (const r of rows) {
    const g = kinds.get(r.kind)?.group ?? 'Reports and videos';
    if (!groups.has(g)) groups.set(g, { group: g, links: [] });
    groups.get(g)!.links.push(r);
  }
  return src.snapshot.linkGroups.filter((g) => groups.has(g)).map((g) => groups.get(g)!);
}

function buildLinksNone(src: Sources, trail: ProtoTrail | undefined): LinkNone[] {
  const kinds = new Map(src.snapshot.linkKinds.map((k) => [k.kind, k]));
  return Object.entries(trail?.none ?? {}).map(([kind, n]) => ({ group: kinds.get(kind)?.group ?? 'Reports and videos', kind, label: kinds.get(kind)?.label ?? kind, date: n.date }));
}

function checklistComplete(src: Sources, trail: ProtoTrail): boolean {
  return src.snapshot.checkKinds.every((c) => {
    if (c.optional) return true;
    return trail.links.some((l) => c.links.includes(l.kind)) || !!trail.none?.[c.kind];
  });
}

function buildLines(trail: ProtoTrail | undefined, placeId: string): PlaceLine[] {
  const source = trail?.facts.geometry_source?.v;
  const ids = trail?.facts.geometry_ids?.v ?? '';
  if (!trail || !source || source === 'none') return [];
  const confirmed = !(placeId in UNCONFIRMED_TRAIL_DATA);
  const type = source === 'osm_ways' ? 'osm_way' : 'osm_relation';
  const found = [...ids.matchAll(/(?:rel(?:ation)?\s+)?(\d{5,})/g)].map((m) => m[1]);
  return [...new Set(found)].map((id) => ({
    ref: `${type}:${id}`,
    label: ids.trim(),
    source: provenance(trail.facts.geometry_source),
    // OSM-derived with an osm_ref; held back until a person confirms the route
    exportable: confirmed,
  }));
}

export function buildPlaces(src: Sources): PlaceBuild {
  const snap = src.snapshot;
  const folderTrips = new Map<string, TripRef>();
  const folderIsPrivate = (f: string) => folderVisibility(src.manifest.get(f)) === 'private';
  const publicTripTitle = (folder: string) => {
    const t = snap.publicTrips.find((x) => PUBLIC_TRIP_FOLDER[x.id] === folder)?.title;
    return t ? undatedTitle(t) : undefined;
  };
  for (const folder of Object.keys(TRIP_SLUGS)) {
    if (!folderIsPrivate(folder)) folderTrips.set(folder, { slug: TRIP_SLUGS[folder], title: publicTripTitle(folder) ?? undatedTitle(src.hub.get(folder)?.title ?? folder) });
  }
  const recs: Rec[] = [];
  const tracks = loadTracks(src.root);

  // ---- locations.json ----
  for (const row of src.locationRows) {
    const raw = src.locationRaw.get(row.id) ?? {};
    const km = mapLocationKind(row.kind, row.id);
    const resolver = String(raw.resolver ?? '');
    const hasPoint = row.lat !== null && row.lon !== null && row.location_status !== 'none';
    const pointSource = resolver === 'wikidata' && row.wikidata ? `wikidata:${row.wikidata}` : resolver === 'manual' ? 'manual_pin' : resolver === 'nominatim' ? 'osm_nominatim' : 'unknown';
    const verifiedBy = raw.verified_by as string | null | undefined;
    const lastVerified = raw.last_verified as string | null | undefined;
    const chain: AreaRef[] = [
      { level: 'country', name: row.country_name, slug: row.country.toLowerCase() },
      { level: 'state', name: row.region_name, slug: kebab(row.region_name) },
      { level: 'district', name: row.area_name, slug: row.area },
    ];
    const file = fileFromUrl(row.image);
    const photo = file ? makePhoto(file, src.credits, { caption: row.name }) : null;
    const trips = [...(src.locationTrips.get(row.id) ?? [])].filter((f) => folderTrips.has(f));
    // The store's `note` is the owner's capture note ("Stop 9 of the road trip post", "Owner pick for autumn colour"). It is a
    // working note, not published copy: it never becomes a summary or a note. Researched places get theirs from the prototype
    // and trail data below. Text that does come through is still scrubbed at render time (second guard).
    const unverifiedNote = /unverified|from memory/i.test(row.note);
    const h: Honesty[] = [];
    if (row.location_status !== 'resolved') h.push(honesty('location_unconfirmed', 'The place name matches several features and the pin is not settled.'));
    if (unverifiedNote || (Object.keys(row.stats).length > 0 && !row.stats_verified)) h.push(honesty('unverified', 'No source has confirmed these facts yet.'));
    if (row.sources.length === 0 && !row.wikidata) h.push(honesty('no_source', 'No source is recorded for this place.'));
    const season = row.season;
    recs.push({
      locationId: row.id,
      protoId: null,
      name: row.name,
      kind: km.kind,
      kindLabel: kindLabel(km.kind, km.subkind),
      subkind: km.subkind,
      category: CATEGORY_OF_KIND[km.kind],
      areaChain: chain,
      areaLabel: `${row.area_name}, ${row.country_name}`,
      point: hasPoint ? { lat: row.lat!, lon: row.lon!, pointSource, pointChecked: verifiedBy && lastVerified ? `${verifiedBy}, ${lastVerified}` : null, sourceLicence: resolver === 'wikidata' ? 'CC0' : resolver === 'manual' ? 'own' : 'ODbL' } : null,
      season,
      kidFit: row.kid_fit,
      summary: '',
      photo,
      trips: trips.map((f) => folderTrips.get(f)!),
      tags: row.tags.map((t) => t.label),
      honesty: h,
      stats: { distanceKm: numOrNull(row.stats.km), gainM: numOrNull(row.stats.gain_m), hours: row.stats.hours !== undefined ? String(row.stats.hours) : null },
      sources: ['locations'],
      elevationM: row.elevation_m,
      access: null,
      lines: [],
      facts: [],
      hazards: [],
      links: [],
      linksNone: [],
      seasonNote: null,
      photos: photo ? [photo] : [],
      wikidata: row.wikidata,
      notes: '',
      minAge: numOrNull(raw.min_age),
      booking: null,
      checklistComplete: null,
      hasDatedSource: row.sources.some((s) => s.url && s.post_date),
      hasTrailheadPoint: false,
      durationMin: numOrNull(raw.duration_min),
      timeHours: null,
      tripFolders: new Set(trips),
    });
  }

  // ---- prototype places (+ trail research) ----
  const protoRecs: Rec[] = [];
  for (const p of snap.places) {
    const km = mapPrototypeKind(p.kind);
    if (!km) continue; // airports, parking and example stays are not places
    const area = PROTOTYPE_AREAS[p.area];
    if (!area) throw new Error(`prototype area "${p.area}" has no entry in PROTOTYPE_AREAS (taxonomy.ts)`);
    const trail = snap.trails[p.id];
    const acc = snap.access[p.id];
    const chain: AreaRef[] = [
      { level: 'country', name: 'Italy', slug: 'it' },
      { level: 'state', name: area.state, slug: area.stateSlug },
      { level: 'district', name: p.area, slug: kebab(p.area) },
    ];
    const th = acc ? accessPoint(acc.trailhead) : null;
    const point: Point =
      th && km.kind === 'trail'
        ? { lat: th.lat, lon: th.lon, pointSource: th.pointSource, pointChecked: th.pointChecked, sourceLicence: th.sourceLicence }
        : { lat: p.lat, lon: p.lng, pointSource: 'prototype_approx', pointChecked: null, sourceLicence: 'own' };
    // facts, in the field order of the trail editor; trailhead coordinates live in `access`
    const facts: Fact[] = [];
    if (trail) {
      for (const f of snap.fields) {
        if (['th_lat', 'th_lon', 'th_name', 'th_elev', 'geometry_source', 'geometry_ids'].includes(f.key)) continue;
        const v = trail.facts[f.key];
        const src = v ? publicSource(v.src, v.v) : null;
        if (!v || src === null) continue;
        facts.push({
          label: f.label,
          value: f.unit ? `${v.v} ${f.unit}` : v.v,
          provenance: provenance({ ...v, src }),
          conflicts: (v.conflict ?? []).flatMap((c) => {
            const cs = publicSource(c.src, c.v);
            return cs === null ? [] : [{ value: c.v, provenance: provenance({ ...c, src: cs }) }];
          }),
        });
      }
    }
    for (const f of p.facts ?? []) {
      const fsrc = publicSource(f.source, f.value);
      if (fsrc === null) continue;
      if (!facts.some((x) => x.label.toLowerCase() === f.label.toLowerCase())) facts.push({ label: f.label, value: f.value, provenance: [fsrc, f.read ? `read ${f.read}` : null].filter(Boolean).join(', '), conflicts: [] });
    }
    // A trail fact read from a link-only platform is not used for the figures either (stats, season, age).
    const tf = (key: string) => {
      const v = trail?.facts[key];
      return v && publicSource(v.src, v.v) !== null ? v.v : undefined;
    };
    const track = tracks.get(p.id);
    if (track && track.stitched && track.totals.gain_m !== null) {
      const km0 = numOrNull(tf('distance_km')) ?? p.km ?? null;
      const gain0 = numOrNull(tf('elevation_gain_m')) ?? (p.gain !== undefined && p.gain > 0 ? p.gain : null);
      if (totalsDiffer(track.totals.km, track.totals.gain_m, km0, gain0)) {
        facts.push({ label: 'Track', value: `${track.totals.km} km, ${track.totals.gain_m} m up`, provenance: `OpenStreetMap line and AWS Terrain Tiles elevation, read ${readDate(track.fetched)}`, conflicts: [] });
      }
    }
    const seasonFact = tf('season') ?? '';
    const months = parseSeasonMonths(seasonFact);
    const h: Honesty[] = [];
    if (p.id in UNCONFIRMED_TRAIL_DATA) h.push(honesty('location_unconfirmed', UNCONFIRMED_TRAIL_DATA[p.id]));
    if (point.pointSource === 'prototype_approx') h.push(honesty('unverified', 'Approximate position, not yet checked against OpenStreetMap.'));
    const hasFacts = facts.length > 0 || (trail?.links.length ?? 0) > 0 || (p.links?.length ?? 0) > 0;
    if (!hasFacts) h.push(honesty('no_source', 'No fact or link is recorded for this place yet.'));
    if (facts.some((f) => /2026/.test(f.provenance))) h.push(honesty('pattern_2026', 'Figures were read in 2026 and are used as a pattern for 2027.'));
    const datedSource = facts.some((f) => f.provenance.includes('read')) || (trail?.links.some((l) => l.checked_at) ?? false);
    const accessParking = (acc?.parking ?? []).map(accessPoint);
    const rec: Rec = {
      locationId: null,
      protoId: p.id,
      name: p.name,
      kind: km.kind,
      kindLabel: kindLabel(km.kind, km.subkind),
      subkind: km.subkind,
      category: CATEGORY_OF_KIND[km.kind],
      areaChain: chain,
      areaLabel: `${p.area}, Italy`,
      point,
      season: months,
      kidFit: 'unknown',
      summary: p.summary ?? '',
      photo: null,
      trips: [],
      tags: [],
      honesty: h,
      stats: {
        distanceKm: numOrNull(tf('distance_km')) ?? p.km ?? null,
        gainM: numOrNull(tf('elevation_gain_m')) ?? (p.gain !== undefined && p.gain > 0 ? p.gain : null),
        hours: tf('duration_hours') ?? p.hours ?? null,
      },
      sources: trail ? ['prototype', 'trail'] : ['prototype'],
      elevationM: th?.elevationM ?? null,
      access: acc ? { trailhead: th, parking: accessParking } : null,
      lines: withTrack(buildLines(trail, p.id), tracks.get(p.id), p.id in UNCONFIRMED_TRAIL_DATA),
      facts,
      hazards: (trail?.hazards ?? []).map((x) => x.v),
      links: buildLinks(src, trail, p),
      linksNone: buildLinksNone(src, trail),
      seasonNote: seasonFact || null,
      photos: [],
      wikidata: null,
      notes: '',
      minAge: p.minAge ?? numOrNull(tf('min_age')),
      booking: p.booking ?? null,
      checklistComplete: trail ? checklistComplete(src, trail) : null,
      hasDatedSource: datedSource,
      hasTrailheadPoint: !!th,
      durationMin: p.durationMin ?? null,
      timeHours: tf('duration_hours') ?? null,
      tripFolders: new Set(['dolomites-july-2027'].filter((f) => !folderIsPrivate(f))),
    };
    if (p.trailhead && !rec.access) rec.access = null;
    protoRecs.push(rec);
  }

  // ---- de-duplicate: same Wikidata id, or the same normalised name within 300 m ----
  for (const pr of protoRecs) {
    const twin = recs.find(
      (r) => r.locationId && ((pr.wikidata && r.wikidata === pr.wikidata) || (normName(r.name) === normName(pr.name) && r.point && pr.point && haversineM(r.point, pr.point) <= 300)),
    );
    if (!twin) {
      recs.push(pr);
      continue;
    }
    twin.protoId = pr.protoId;
    twin.sources = [...new Set([...twin.sources, ...pr.sources])];
    twin.facts = pr.facts;
    twin.access = pr.access;
    twin.lines = pr.lines;
    twin.hazards = pr.hazards;
    twin.links = pr.links;
    twin.seasonNote = pr.seasonNote;
    twin.hasTrailheadPoint = pr.hasTrailheadPoint;
    twin.checklistComplete = pr.checklistComplete;
    twin.hasDatedSource = twin.hasDatedSource || pr.hasDatedSource;
    twin.booking = pr.booking;
    twin.durationMin = twin.durationMin ?? pr.durationMin;
    twin.timeHours = pr.timeHours;
    twin.summary = twin.summary || pr.summary;
    if (twin.season.length === 0) twin.season = pr.season;
    twin.stats = { distanceKm: twin.stats.distanceKm ?? pr.stats.distanceKm, gainM: twin.stats.gainM ?? pr.stats.gainM, hours: twin.stats.hours ?? pr.stats.hours };
    twin.honesty = [...twin.honesty, ...pr.honesty.filter((x) => x.id !== 'unverified' && x.id !== 'no_source')];
    for (const f of pr.tripFolders) twin.tripFolders.add(f);
  }

  // ---- trail routes of public trips that have no page yet (capture records, backlog 3.8) ----
  const taken = new Set(recs.map((r) => normName(r.name)));
  const placeNames = new Set(taken);
  const trailNames = new Set<string>();
  const notByName = new Set<string>();
  for (const seed of trailSeeds(src)) {
    if (taken.has(normName(seed.name)) || !folderTrips.has(seed.tripFolder)) continue;
    taken.add(normName(seed.name));
    trailNames.add(normName(seed.name));
    recs.push(recFromSeed(seed, src, folderTrips.get(seed.tripFolder)!));
    if (seed.ambiguous) notByName.add(seed.ref);
  }

  // ---- places, routes and offers of public trips that only the capture records hold (backlog 3.48) ----
  const areaByName = new Map(recs.map((r) => [normName(r.name), r.areaChain]));
  const sb = captureSeeds({ src, world: publicWorld(src.root), placeNames, trailNames, areaByName });
  const world = publicWorld(src.root);
  logSkippedShells(sb.skipped);
  const seedOf = new Map<string, CaptureSeed>();
  for (const seed of sb.seeds) {
    if (!folderTrips.has(seed.tripFolder)) continue;
    seedOf.set(seed.ref, seed);
    recs.push(recFromCapture(seed, folderTrips.get(seed.tripFolder)!, src.root));
  }
  // ---- second records of a place that already has a page (`same_place_as`, backlog 3.55): one page, the second slug redirects to it ----
  const merged = collapseDuplicates(recs, [...seedOf.values()], world);
  for (const r of merged.dropped) recs.splice(recs.indexOf(r), 1);
  const isSeed = (r: Rec) => !!r.captureRef && seedOf.has(r.captureRef);

  // ---- slugs: the pages that existed before keep theirs; the seeds fill free names ----
  // the identity key is the page's ref (D-B2): the capture ref, else the `place/<slug>` the private origin keys pin (A24). An origin not
  // pinned yet is assigned under its origin key, in memory only, and its ref is minted from the slug it gets. `order` keeps the key form
  // of before the registry, so an empty registry gives the same slugs.
  const originOf = (r: Rec): string => (r.locationId ? `loc:${r.locationId}` : `proto:${r.protoId}`);
  const origins = readOriginKeys(src.root).keys;
  const keyOf = (r: Rec): string => r.captureRef ?? origins[originOf(r)] ?? originOf(r);
  const orderOf = (r: Rec): string => (r.captureRef ? `trail:${r.captureRef}` : originOf(r));
  const registry = readSlugRegistry(src.root);
  const slugs = assignPlaceSlugs(recs.filter((r) => !isSeed(r)).map((r) => ({ key: keyOf(r), order: orderOf(r), name: r.name, areaSlug: r.areaChain[2]?.slug ?? '' })), registry);
  const seedSlugs = assignSeedSlugs([...seedOf.values()], new Set(slugs.values()), registry);
  const slugOf = (r: Rec): string => (isSeed(r) ? seedSlugs.get(r.captureRef!)! : slugs.get(keyOf(r))!);
  const refOf = (r: Rec): string => r.captureRef ?? origins[originOf(r)] ?? placeRefOf(slugOf(r));
  const duplicateRedirects = merged.pairs.map((m) => ({ from: `/places/${seedSlugs.get(m.seed.ref)!}/`, slug: slugOf(m.survivor), seed: m.seed }));

  applyLegacySupersedes(recs, publicWorld(src.root), normName);
  const places: PublicPlace[] = recs.map((r) => {
    const tripRefs = [...r.tripFolders].filter((f) => folderTrips.has(f)).map((f) => folderTrips.get(f)!);
    const input: CompletenessInput = {
      kind: r.kind,
      name: r.name,
      hasArea: r.areaChain.length >= 3,
      point: r.point,
      hasDatedSource: r.hasDatedSource,
      hasSummary: r.summary.length > 0,
      hasSeason: r.season.length > 0 || !!r.seasonNote,
      hasOsmOrWikidata: !!r.wikidata || r.lines.length > 0 || (r.access?.trailhead?.pointSource.startsWith('osm_') ?? false),
      checklistComplete: r.checklistComplete,
      hasCreditedPhoto: r.photos.length > 0,
      distanceKm: r.stats.distanceKm,
      gainM: r.stats.gainM,
      timeHours: r.timeHours ?? r.stats.hours,
      hasTrailheadPoint: r.hasTrailheadPoint,
      hasAccess: !!r.access,
      durationMin: r.durationMin,
    };
    const { locationId: _l, protoId: _p, checklistComplete: _c, hasDatedSource: _d, hasTrailheadPoint: _t, durationMin: _m, timeHours: _h, tripFolders: _f, captureRef: _r, aliasRefs: _a, altNames: _n, ...pub } = r;
    void [_l, _p, _c, _d, _t, _m, _h, _f, _r, _a, _n];
    return { ...pub, slug: slugOf(r), trips: tripRefs, honesty: uniqueHonesty(r.honesty), completeness: computeCompleteness(input), sections: null, suitability: null, relevance: null, refSlugs: {} };
  });
  places.sort((a, b) => a.slug.localeCompare(b.slug));

  const bySlug = new Map(places.map((p) => [p.slug, p]));
  const byProtoId = new Map<string, string>();
  const byLocationId = new Map<string, string>();
  const byCaptureRef = new Map<string, string>();
  const legacyPaths = new Map<string, string>();
  for (const m of duplicateRedirects) {
    legacyPaths.set(m.from, m.slug);
    byCaptureRef.set(m.seed.ref, m.slug);
    for (const a of m.seed.aliasRefs) byCaptureRef.set(a, m.slug);
  }
  for (const r of recs) {
    const slug = slugOf(r);
    if (r.protoId) byProtoId.set(r.protoId, slug);
    if (r.captureRef) byCaptureRef.set(r.captureRef, slug);
    for (const a of r.aliasRefs ?? []) byCaptureRef.set(a, slug);
    if (r.locationId) {
      byLocationId.set(r.locationId, slug);
      legacyPaths.set(`/places/${r.locationId.split('/').map(encodeURIComponent).join('/')}/`, slug);
    }
  }
  // a slug retired by `slugs.ts rename` answers with the slug its key holds now (D-B1)
  for (const [slug, k] of Object.entries(registry.places.retired)) {
    const target = registry.places.merged[k] ?? k;
    const now = slugs.get(target) ?? seedSlugs.get(target);
    if (now && bySlug.has(now)) legacyPaths.set(`/places/${slug}/`, now);
  }
  const refBySlug = new Map(recs.map((r) => [slugOf(r), refOf(r)]));
  const slugByRef = new Map<string, string>([...recs.filter((r) => !isSeed(r)).map((r): [string, string] => [refOf(r), slugOf(r)]), ...seedSlugs]);
  const mergedRefs = new Map(merged.pairs.map((m) => [m.seed.ref, refOf(m.survivor)]));
  const originRefs = new Map(recs.filter((r) => !r.captureRef).map((r) => [originOf(r), refOf(r)]));
  assertRefsDistinct(refBySlug, slugByRef, byCaptureRef);
  const byName = new Map<string, string[]>();
  const skipName = new Set([...notByName].map((ref) => byCaptureRef.get(ref)));
  const altNames = new Map(recs.map((r) => [slugOf(r), r.altNames ?? []]));
  const seedSlugSet = new Set(recs.filter(isSeed).map(slugOf));
  const isSeedSlug = (slug: string) => seedSlugSet.has(slug);
  const addName = (name: string, slug: string) => {
    const k = normName(name);
    const cur = byName.get(k) ?? [];
    if (!cur.includes(slug)) byName.set(k, [...cur, slug]);
  };
  for (const p of places) {
    if (skipName.has(p.slug)) continue;
    // a seeded page that shares a trail's name stays out of the name lookup, as the trail does: the trip page cannot tell the two apart by name
    if (isSeedSlug(p.slug) && (trailNames.has(normName(p.name)) || (altNames.get(p.slug) ?? []).some((n) => trailNames.has(normName(n))))) continue;
    addName(p.name, p.slug);
    for (const n of altNames.get(p.slug) ?? []) addName(n, p.slug);
  }
  // the second record of a merged pair has no page of its own: its name finds the surviving page, so a trip stop that uses it keeps its link (TRP)
  for (const m of duplicateRedirects) {
    for (const n of [m.seed.name, ...m.seed.names]) addName(n, m.slug);
  }
  return { places, bySlug, byProtoId, byLocationId, byCaptureRef, byName, legacyPaths, seedSkips: sb.skipped, refBySlug, slugByRef, mergedRefs, originRefs };
}

/**
 * A24's invariants, checked on every build: one ref per page and one page per ref (a `place/<slug>` ref is never the capture ref of
 * another page, nor of a merged record), and no private origin key as a ref. A failure names slugs and refs, never an origin key.
 */
function assertRefsDistinct(refBySlug: Map<string, string>, slugByRef: Map<string, string>, byCaptureRef: Map<string, string>): void {
  const problems: string[] = [];
  const pageOf = new Map<string, string>();
  for (const [slug, ref] of refBySlug) {
    if (/^(?:loc|proto):/.test(ref)) problems.push(`${slug}: its ref is a private origin key`);
    const had = pageOf.get(ref);
    if (had) problems.push(`${had} and ${slug} share the ref ${ref}`);
    pageOf.set(ref, slug);
    const capturePage = byCaptureRef.get(ref);
    if (capturePage !== undefined && capturePage !== slug) problems.push(`${slug}: its ref ${ref} is the capture ref of ${capturePage}`);
    if (slugByRef.get(ref) !== slug) problems.push(`${slug}: the ref ${ref} pins ${slugByRef.get(ref) ?? 'no slug'}`);
  }
  if (problems.length) throw new Error(`place refs are not distinct (store.ts A24): ${problems.join('; ')}`);
}

let shellsLogged = false;
/** One build-log line naming the records that got no page because they hold nothing but a name (3.58). Only `next build` prints it. */
function logSkippedShells(skipped: readonly SeedSkip[]): void {
  const shells = skipped.filter((x) => x.why.startsWith('empty shell'));
  if (shellsLogged || shells.length === 0 || process.env.NEXT_PHASE !== 'phase-production-build') return;
  shellsLogged = true;
  console.info(`places: ${shells.length} capture record(s) have no page, empty shells for CS7d: ${shells.map((x) => x.name).join(', ')}`);
}

/**
 * A seed that carries `same_place_as` is the second record of a place whose first record has a page (backlog 3.55). Its own Rec is
 * dropped; the refs it answered to move to the first page, so a link by ref still finds it. Its NAME does not join the first page's
 * name lookup: the trip builder merges stops that resolve to one page, which would drop a trip item the suitability scope (and core's
 * pinned count of 207) still holds. The stop keeps its own item until the trip and core lanes re-pin it. When the first record has no
 * page the second keeps its own (nothing is lost). The caller redirects the dropped seed's slug to the survivor's.
 */
export function collapseDuplicates(
  recs: readonly Rec[],
  seeds: readonly CaptureSeed[],
  world: Parameters<typeof primaryRef>[0],
): { dropped: Rec[]; pairs: { seed: CaptureSeed; survivor: Rec }[] } {
  const dropped: Rec[] = [];
  const pairs: { seed: CaptureSeed; survivor: Rec }[] = [];
  const byRef = new Map<string, Rec>();
  for (const r of recs) if (r.captureRef) byRef.set(primaryRef(world, r.captureRef), r);
  const dupRecs = new Map<string, CaptureSeed>(seeds.filter((s) => s.duplicateOf).map((s) => [primaryRef(world, s.ref), s]));
  // follow a chain (c is a copy of b, b of a) to the page that stays; a loop keeps every member
  const target = (ref: string): Rec | null => {
    let cur = ref;
    for (let i = 0; i < 8; i++) {
      const dup = dupRecs.get(cur);
      if (!dup) return byRef.get(cur) ?? null;
      cur = dup.duplicateOf!;
    }
    return null;
  };
  for (const seed of seeds) {
    if (!seed.duplicateOf) continue;
    const own = byRef.get(primaryRef(world, seed.ref));
    const survivor = target(seed.duplicateOf);
    if (!own || !survivor || survivor === own) continue;
    survivor.aliasRefs = [...new Set([...(survivor.aliasRefs ?? []), seed.ref, ...seed.aliasRefs])];
    dropped.push(own);
    pairs.push({ seed, survivor });
  }
  return { dropped, pairs };
}

function recFromSeed(seed: TrailSeed, src: Sources, trip: TripRef): Rec {
  const h: Honesty[] = [];
  if (!seed.hasFacts) h.push(honesty('no_source', 'No fact or link is recorded for this trail yet.'));
  if (seed.datedSource) h.push(honesty('pattern_2026', 'Figures were read in 2026 and are used as a pattern for the trip.'));
  const facts = [...seed.facts, ...(seed.payoff ? [{ label: 'Payoff', value: seed.payoff, provenance: 'Our research', conflicts: [] }] : [])];
  return {
    locationId: null,
    protoId: null,
    captureRef: seed.ref,
    name: seed.name,
    kind: 'trail',
    kindLabel: kindLabel('trail', seed.subkind),
    subkind: seed.subkind,
    category: CATEGORY_OF_KIND.trail,
    areaChain: seed.areaChain,
    areaLabel: seed.areaLabel,
    point: joinPoint(src.root, seed.ref, seed.point),
    season: [],
    kidFit: 'unknown',
    summary: '',
    photo: null,
    trips: [trip],
    tags: [],
    honesty: h,
    stats: seed.stats,
    sources: ['trail'],
    elevationM: null,
    access: null,
    lines: [],
    facts,
    hazards: seed.hazards,
    links: groupLinks(src, seed.links),
    linksNone: seed.none,
    seasonNote: seed.seasonNote,
    photos: [],
    wikidata: null,
    notes: '',
    minAge: null,
    booking: null,
    checklistComplete: null,
    hasDatedSource: seed.datedSource,
    hasTrailheadPoint: false,
    durationMin: null,
    timeHours: seed.stats.hours,
    tripFolders: new Set([seed.tripFolder]),
  };
}

/** A page for a capture record that no older source covers: its sections, suitability and relevance come from the record (S1), so only the identity is set here. */
function recFromCapture(seed: CaptureSeed, trip: TripRef, root: string): Rec {
  return {
    locationId: null,
    protoId: null,
    captureRef: seed.ref,
    aliasRefs: seed.aliasRefs,
    altNames: seed.names,
    name: seed.name,
    kind: seed.kind,
    kindLabel: seed.typeLabel,
    subkind: seed.subkind,
    category: CATEGORY_OF_KIND[seed.kind],
    areaChain: seed.areaChain,
    areaLabel: seed.areaLabel,
    point: joinPoint(root, seed.ref, seed.point),
    season: [],
    kidFit: 'unknown',
    summary: seed.summary,
    photo: null,
    trips: [trip],
    tags: [],
    honesty: [],
    stats: { distanceKm: null, gainM: null, hours: null },
    sources: ['capture'],
    elevationM: null,
    access: null,
    lines: [],
    facts: [],
    hazards: [],
    links: [],
    linksNone: [],
    seasonNote: null,
    photos: [],
    wikidata: null,
    notes: '',
    minAge: null,
    booking: null,
    checklistComplete: null,
    hasDatedSource: false,
    hasTrailheadPoint: false,
    durationMin: null,
    timeHours: null,
    tripFolders: new Set([seed.tripFolder]),
  };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export type { PlaceKind, Photo, ProtoFact };
