import { PUBLIC_TRIP_FOLDER, TRIP_SLUGS, assignPlaceSlugs, kebab } from './slugs';
import { computeCompleteness, type CompletenessInput } from './completeness';
import { UNCONFIRMED_TRAIL_DATA } from './honesty-overrides';
import { honesty, uniqueHonesty } from './honesty';
import { fileFromUrl, makePhoto } from './photos';
import { CATEGORY_OF_KIND, PROTOTYPE_AREAS, kindLabel, mapLocationKind, mapPrototypeKind } from './taxonomy';
import { undatedTitle } from './dateless';
import { folderVisibility, type ProtoFact, type ProtoPlace, type ProtoTrail, type Sources } from './sources';
import type { AccessPoint, AreaRef, Fact, Honesty, LinkGroup, LinkNone, Photo, Point, PlaceKind, PlaceLine, PublicPlace, TripRef } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface PlaceBuild {
  places: PublicPlace[];
  bySlug: Map<string, PublicPlace>;
  /** prototype place id -> slug (merged places included) */
  byProtoId: Map<string, string>;
  byLocationId: Map<string, string>;
  /** normalised name -> slugs, for resolving trip stops by name */
  byName: Map<string, string[]>;
  /** old /places/<cc>/<region>/<area>/<place>/ path -> slug */
  legacyPaths: Map<string, string>;
}

export const normName = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

interface Rec extends Omit<PublicPlace, 'slug' | 'completeness'> {
  locationId: string | null;
  protoId: string | null;
  checklistComplete: boolean | null;
  hasDatedSource: boolean;
  hasTrailheadPoint: boolean;
  durationMin: number | null;
  timeHours: string | null;
  tripFolders: Set<string>;
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

  // ---- locations.json ----
  for (const row of src.locationRows) {
    const raw = src.locationRaw.get(row.id) ?? {};
    const km = mapLocationKind(row.kind);
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
    if (unverifiedNote || (Object.keys(row.stats).length > 0 && !row.stats_verified)) h.push(honesty('unverified', 'The facts were written from memory and no source has confirmed them.'));
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
      lines: buildLines(trail, p.id),
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
      (r) => r.locationId && ((pr.wikidata && r.wikidata === pr.wikidata) || (normName(r.name) === normName(pr.name) && r.point && pr.point && metres(r.point, pr.point) <= 300)),
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

  // ---- slugs ----
  const key = (r: Rec) => (r.locationId ? `loc:${r.locationId}` : `proto:${r.protoId}`);
  const slugs = assignPlaceSlugs(recs.map((r) => ({ key: key(r), name: r.name, areaSlug: r.areaChain[2]?.slug ?? '' })));

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
    const { locationId: _l, protoId: _p, checklistComplete: _c, hasDatedSource: _d, hasTrailheadPoint: _t, durationMin: _m, timeHours: _h, tripFolders: _f, ...pub } = r;
    void [_l, _p, _c, _d, _t, _m, _h, _f];
    return { ...pub, slug: slugs.get(key(r))!, trips: tripRefs, honesty: uniqueHonesty(r.honesty), completeness: computeCompleteness(input) };
  });
  places.sort((a, b) => a.slug.localeCompare(b.slug));

  const bySlug = new Map(places.map((p) => [p.slug, p]));
  const byProtoId = new Map<string, string>();
  const byLocationId = new Map<string, string>();
  const legacyPaths = new Map<string, string>();
  for (const r of recs) {
    const slug = slugs.get(key(r))!;
    if (r.protoId) byProtoId.set(r.protoId, slug);
    if (r.locationId) {
      byLocationId.set(r.locationId, slug);
      legacyPaths.set(`/places/${r.locationId.split('/').map(encodeURIComponent).join('/')}/`, slug);
    }
  }
  const byName = new Map<string, string[]>();
  for (const p of places) byName.set(normName(p.name), [...(byName.get(normName(p.name)) ?? []), p.slug]);
  return { places, bySlug, byProtoId, byLocationId, byName, legacyPaths };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export type { PlaceKind, Photo, ProtoFact };
