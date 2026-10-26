import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { travelRoot } from './root';
import type { TripRecord, TripRow } from './types';
import { listedOnly, parseVisibility } from '../visibility';

interface LegacyTrip {
  slug: string;
  title: string;
  sub: string;
  img: string;
  date: string;
  dates: string;
  dur: string;
  region: string;
}

interface TripFile {
  trip?: {
    slug?: string;
    title?: string;
    subtitle?: string;
    visibility?: string;
    web_published?: boolean;
    legacy_url?: string | null;
    region_label?: string;
    hero_image?: string | null;
    nights?: number;
  };
  editions?: { start?: string; end?: string; status?: string }[];
}

/** Where the generated legacy trip list lives (tools/hub.py --json writes it). */
export function legacyTripsPath(): string {
  return process.env.LEGACY_TRIPS_JSON || path.join(process.cwd(), '.generated', 'legacy-trips.json');
}

function readLegacyTrips(root: string): LegacyTrip[] {
  const file = legacyTripsPath();
  // `turbopackIgnore`: the path can come from LEGACY_TRIPS_JSON, so the bundler cannot bound it and would trace the whole project into
  // every server function (over Vercel's 250 MB limit). next.config.ts includes the generated file through lib/server/runtime-files.ts.
  if (!existsSync(/* turbopackIgnore: true */ file)) {
    const hub = path.join(root, 'tools', 'hub.py');
    // Standalone `pnpm build`: generate the list ourselves so the home page is never silently empty.
    if (process.env.LEGACY_TRIPS_JSON || !existsSync(hub)) return [];
    mkdirSync(path.dirname(file), { recursive: true });
    execFileSync('python3', [hub, '--json', file], { cwd: root, stdio: 'inherit' });
  }
  const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, 'utf8')) as LegacyTrip[] | { trips: LegacyTrip[] };
  return Array.isArray(parsed) ? parsed : parsed.trips;
}

function headline(title: string): string {
  return title.includes(' — ') ? title.split(' — ')[0] : title;
}

function formatRange(start?: string, end?: string): string {
  if (!start) return '';
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return end && end !== start ? `${fmt(start)} to ${fmt(end)}` : fmt(start);
}

/** Trips from data/trips/*, every visibility except private. Works with zero trips. */
export function loadDataTrips(root = travelRoot()): TripRecord[] {
  const dir = path.join(root, 'data', 'trips');
  if (!existsSync(dir)) return [];
  const out: TripRecord[] = [];
  for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name, 'trip.json');
    if (!existsSync(file)) continue;
    const doc = JSON.parse(readFileSync(file, 'utf8')) as TripFile;
    const t = doc.trip ?? {};
    const visibility = parseVisibility(t.visibility);
    if (visibility === 'private') continue; // never read further than the flag
    const slug = t.slug ?? name;
    const ed = (doc.editions ?? []).find((e) => e.status === 'chosen' || e.status === 'booked') ?? doc.editions?.[0];
    const date = ed?.start ?? '';
    const nights = typeof t.nights === 'number' ? t.nights : null;
    out.push({
      id: `trip:${slug}`,
      slug,
      title: headline(t.title ?? slug),
      subtitle: t.subtitle ?? '',
      img: t.hero_image ?? null,
      date,
      dates: formatRange(ed?.start, ed?.end),
      duration: nights ? `${nights} nights` : '',
      region: t.region_label ?? '',
      source: 'plan',
      href: t.web_published ? `/${slug}/` : (t.legacy_url ?? ''),
      visibility,
    });
  }
  return out;
}

export function loadLegacyTrips(root = travelRoot()): TripRecord[] {
  const manifestFile = path.join(root, 'legacy', 'MANIFEST.json');
  const served = new Set<string>();
  if (existsSync(manifestFile)) {
    const m = JSON.parse(readFileSync(manifestFile, 'utf8')) as { folders: { slug: string; served?: boolean; kind?: string }[] };
    for (const f of m.folders) if (f.served && f.kind !== 'site-page') served.add(f.slug);
  }
  return readLegacyTrips(root)
    .filter((t) => served.size === 0 || served.has(t.slug))
    .map((t) => ({
      id: `trip:${t.slug}`,
      slug: t.slug,
      title: headline(t.title),
      subtitle: t.sub,
      img: t.img || null,
      date: t.date,
      dates: t.dates,
      duration: t.dur,
      region: t.region,
      source: 'legacy' as const,
      href: `/${t.slug}/`,
      visibility: 'public' as const,
    }));
}

/** Every trip that may be built, data trips first; a data trip hides its legacy twin. */
export function loadTrips(root = travelRoot()): TripRecord[] {
  const data = loadDataTrips(root);
  const taken = new Set(data.map((t) => t.slug));
  const all = [...data, ...loadLegacyTrips(root).filter((t) => !taken.has(t.slug))];
  return all.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title));
}

/** Trips for lists, the home page, /data and the sitemap: public only. */
export function loadListedTrips(root = travelRoot()): TripRow[] {
  return listedOnly(loadTrips(root)).map(stripVisibility);
}

function stripVisibility(t: TripRecord): TripRow {
  const { visibility: _v, ...row } = t;
  void _v;
  return row;
}
