import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import snapshotJson from '../../data-snapshots/prototype.json';
import creditsJson from '../../data-snapshots/photo-credits.json';
import { loadPlaces, readStore } from '../data/places';
import { loadLegacyTrips } from '../data/trips';
import { travelRoot, buildToday } from '../data/root';
import type { PlaceRow, TripRecord } from '../data/types';
import { parseVisibility, type Visibility } from '../visibility';
import type { Credits } from './photos';

// ---- the prototype snapshot (web/data-snapshots/prototype.json), typed loosely on purpose ----
export interface ProtoFact { v: string; src?: string; conf?: string; read?: string; conflict?: { v: string; src: string; conf: string; read?: string }[] }
export interface ProtoPoint { lat: number; lon: number; point_source: string; point_checked: string; name: string; kind?: string; elev_m?: number; note?: string; fee?: string; capacity?: string }
export interface ProtoPlace {
  id: string; name: string; aka?: string[]; kind: string; area: string; lng: number; lat: number; summary?: string; minAge?: number;
  km?: number; gain?: number; hours?: string; durationMin?: number; parking?: string; trailhead?: string; booking?: string;
  facts?: { label: string; value: string; source?: string; read?: string }[]; links?: { kind: string; label: string; url: string; linkOnly?: boolean }[];
}
export interface ProtoTrail {
  facts: Record<string, ProtoFact>; hazards: ProtoFact[];
  links: { id: string; kind: string; url: string; label: string; checked_at?: string; note?: string; opened?: boolean }[];
  trailhead?: ProtoPoint; parking?: ProtoPoint[];
  none?: Record<string, { date: string; query: string }>;
}
export interface ProtoStop { name: string; kind: string; durationMin: number; note?: string }
export interface ProtoPubDay { n: number; title: string; base: string; stops: ProtoStop[]; driveMin: number }
export interface ProtoPubTrip {
  id: string; title: string; summary: string; nights: number; region: string; country: string; group: string; ageFit: number;
  season: { months: number[]; label: string; why: string; weather: { tempC: string; rain: string; daylight: string; notes: string[] } };
  effort: string; driveAvgMin: number; days: ProtoPubDay[];
}
export interface ProtoSnapshot {
  trip: {
    id: string; title: string; start: string; nights: number; zone: string;
    days: { n: number; title: string; baseTown: string | null; items: { id: string; placeId: string; time?: string; variant?: string; note?: string }[] }[];
    logistics: { id: string; kind: string; dayN: number | null; label: string; bookNote?: string }[];
  };
  places: ProtoPlace[];
  trails: Record<string, ProtoTrail>;
  access: Record<string, { trailhead: ProtoPoint; parking: ProtoPoint[] }>;
  checkKinds: { kind: string; label: string; links: string[]; optional?: boolean }[];
  linkKinds: { kind: string; label: string; group: string }[];
  linkGroups: string[];
  fields: { key: string; label: string; unit?: string; group: string }[];
  groups: { key: string; title: string }[];
  difficulty: Record<string, string>;
  publicTrips: ProtoPubTrip[];
}

export interface ManifestFolder { slug: string; served?: boolean; kind?: string; private?: unknown; visibility?: unknown }

export interface RockiesData {
  itinerary: {
    recommended: { nights: number; start: string; end: string };
    bases: { base_id: string; nights: number; dates: string; why: string }[];
    days: RockiesDay[];
  };
  bases: { id: string; name: string; park_or_area: string }[];
  trails: Record<string, unknown>[];
  sights: Record<string, unknown>[];
  adventures: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
}
export interface RockiesTrack { title: string; trail_ids?: string[]; sight_ids?: string[]; adventure_ids?: string[]; notes?: string }
export interface RockiesDay {
  n: number; date: string; base_id: string; drive: string; summary: string;
  track_a: RockiesTrack | null; track_b: RockiesTrack | null; track_c: RockiesTrack | null; booking_ids: string[];
}

export interface GalleryDoc { sections: { place: string; blurb?: string; photos: { file: string; caption?: string; author?: string; license?: string }[] }[] }

export interface Sources {
  root: string;
  today: string;
  snapshot: ProtoSnapshot;
  credits: Credits;
  manifest: Map<string, ManifestFolder>;
  /** Hub rows (title, dates, hero) by legacy folder. */
  hub: Map<string, TripRecord>;
  /** locations.json rows joined with area chain, tags, sources. */
  locationRows: PlaceRow[];
  /** Raw locations.json places by id (review and licence fields the row view drops). */
  locationRaw: Map<string, Record<string, unknown>>;
  /** locations.json trip links by place id, as legacy folder names. Filter with visibility before use. */
  locationTrips: Map<string, Set<string>>;
  rockies: RockiesData | null;
  galleries: Map<string, GalleryDoc>;
}

export function folderVisibility(folder: ManifestFolder | undefined): Visibility {
  if (!folder) return 'private'; // fail closed: not in the manifest, not built
  if (folder.private !== undefined && folder.private !== false) return 'private';
  return parseVisibility(folder.visibility ?? 'public');
}

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

export interface SourceOptions {
  root?: string;
  today?: string;
  /** Replaces the hub rows (tests). */
  hubRows?: TripRecord[];
}

export function loadSources(opts: SourceOptions = {}): Sources {
  const root = opts.root ?? travelRoot();
  const today = opts.today ?? buildToday();
  const manifestDoc = readJson<{ folders: ManifestFolder[] }>(path.join(root, 'legacy', 'MANIFEST.json'));
  const manifest = new Map((manifestDoc?.folders ?? []).map((f) => [f.slug, f]));

  // Only folders the manifest lets through are read any further.
  const allowed = new Set([...manifest.values()].filter((f) => folderVisibility(f) !== 'private' && f.served && f.kind !== 'site-page').map((f) => f.slug));
  const hubRows = opts.hubRows ?? loadLegacyTrips(root, today);
  const hub = new Map(hubRows.filter((t) => allowed.has(t.slug)).map((t) => [t.slug, t]));

  const store = readStore(root);
  const locationRaw = new Map(store.places.map((p) => [p.id, p as unknown as Record<string, unknown>]));
  const locationTrips = new Map<string, Set<string>>();
  const add = (id: string, trip?: string | null) => {
    if (!trip) return;
    locationTrips.set(id, (locationTrips.get(id) ?? new Set()).add(trip));
  };
  for (const p of store.places) add(p.id, p.trip);
  for (const v of store.visits) add(v.place_id, v.trip);

  const rdir = path.join(root, 'legacy', 'canadian-rockies-sept-2029', 'data');
  let rockies: RockiesData | null = null;
  if (allowed.has('canadian-rockies-sept-2029') && existsSync(path.join(rdir, 'itinerary.json'))) {
    rockies = {
      itinerary: readJson(path.join(rdir, 'itinerary.json'))!,
      bases: readJson(path.join(rdir, 'bases.json')) ?? [],
      trails: readJson(path.join(rdir, 'trails.json')) ?? [],
      sights: readJson(path.join(rdir, 'sights.json')) ?? [],
      adventures: readJson(path.join(rdir, 'adventures.json')) ?? [],
      bookings: readJson(path.join(rdir, 'bookings.json')) ?? [],
    };
  }
  const galleries = new Map<string, GalleryDoc>();
  for (const folder of allowed) {
    const g = readJson<GalleryDoc>(path.join(root, 'legacy', folder, 'gallery', 'gallery.json'));
    if (g) galleries.set(folder, g);
  }

  return {
    root,
    today,
    snapshot: snapshotJson as unknown as ProtoSnapshot,
    credits: (creditsJson as { files: Credits }).files,
    manifest,
    hub,
    locationRows: loadPlaces(root),
    locationRaw,
    locationTrips,
    rockies,
    galleries,
  };
}
