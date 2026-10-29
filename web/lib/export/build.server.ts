import { getPlace, getTrip, placeSlugs, tripSlugs } from '@/lib/public';
import type { PublicPlace, PublicTrip } from '@/lib/public';
import { exportAddress } from '@/lib/public/address';
import { absoluteUrl } from '@/lib/site';
import { tripBookings, withStopBookings } from '@travel/core/export/bookings.ts';
import { forTimeline } from '@travel/core/export/plan.ts';
import { EXPORT_MODEL_VERSION } from '@travel/core/export/types.ts';
import { checkPoint, lineExportable } from './licence';
import { zoneByName, zoneNear } from './tz';
import type { ExportLine, ExportStop, ExportWaypoint, PlaceExport, TripExport } from './types';

// Server-side only: turns what the data adapter returns into the plain model the browser generators use.
// It takes `getTrip` / `getPlace` output and nothing else, so a trip the adapter did not build cannot be exported.

const lineOf = (l: PublicPlace['lines'][number]): ExportLine => ({
  ref: l.ref,
  label: l.label,
  exportable: lineExportable({ ref: l.ref, exportable: l.exportable, licence: l.ref.startsWith('osm_') ? 'ODbL' : 'unknown' }),
  licence: l.ref.startsWith('osm_') ? 'ODbL' : 'unknown',
  geometry: l.geometry ?? [],
});

const placeUrl = (slug: string) => absoluteUrl(`/places/${slug}/`);
export const tripUrl = (slug: string) => absoluteUrl(`/trips/${slug}/`);

function tripZone(trip: PublicTrip): string | null {
  const pin = trip.bases.find((x) => x.point)?.point;
  return (pin ? zoneNear(pin.lat, pin.lon) : null) ?? zoneByName(`${trip.region} ${trip.title} ${trip.bases.map((b) => b.name).join(' ')}`);
}

export function buildTripExport(trip: PublicTrip, lookup: (slug: string) => PublicPlace | null = getPlace): TripExport {
  let skipped = 0;
  const waypoints: ExportWaypoint[] = [];
  const lines: ExportLine[] = [];
  const seenLines = new Set<string>();
  const stops: ExportStop[] = [];
  const seenWp = new Set<string>();

  const add = (w: Omit<ExportWaypoint, 'id'> & { key: string }) => {
    const id = `${w.role}:${w.day ?? 0}:${w.key}`;
    if (seenWp.has(id)) return;
    seenWp.add(id);
    if (!checkPoint(w.point).ok) {
      skipped += 1;
      return;
    }
    const { key: _k, ...rest } = w;
    void _k;
    waypoints.push({ id, ...rest });
  };

  let order = 0;
  for (const day of trip.days) {
    const lanes = [{ lane: null as string | null, items: day.items }, ...(day.tracks ?? []).map((t) => ({ lane: t.label, items: t.items }))];
    for (const { lane, items } of lanes) {
      for (const it of items) {
        const place = it.placeSlug ? lookup(it.placeSlug) : null;
        const links = [place ? placeUrl(place.slug) : null, ...(place?.links.flatMap((g) => g.links.map((l) => l.url)) ?? [])].filter((x): x is string => !!x);
        stops.push({
          day: day.n,
          order: order++,
          id: it.id,
          name: it.name,
          kind: it.kind,
          category: it.category,
          area: place?.areaLabel ?? null,
          time: it.time,
          durationMin: it.durationMin,
          lane: it.variant ? `Lane ${it.variant}` : lane,
          note: it.note,
          placeSlug: it.placeSlug,
          links: [...new Set(links)].slice(0, 4),
          point: place?.point ?? null,
          ...(place?.sections?.address ? { address: exportAddress(place.sections.address, place.sections.ref ?? null) } : {}),
        });
        if (!place) continue;
        if (place.point) add({ key: place.slug, name: it.name, kind: it.kind, role: 'stop', day: day.n, note: it.note, url: placeUrl(place.slug), point: place.point });
        if (place.access?.trailhead) add({ key: `${place.slug}:th`, name: place.access.trailhead.name, kind: 'trailhead', role: 'trailhead', day: day.n, note: place.access.trailhead.note, url: placeUrl(place.slug), point: place.access.trailhead });
        for (const [i, p] of (place.access?.parking ?? []).entries()) add({ key: `${place.slug}:p${i}`, name: p.name, kind: 'parking', role: 'parking', day: day.n, note: p.note, url: placeUrl(place.slug), point: p });
        for (const l of place.lines) {
          if (seenLines.has(l.ref)) continue;
          seenLines.add(l.ref);
          lines.push(lineOf(l));
        }
      }
    }
  }
  // `order` is the stop's place in the file (types.ts): the plan's authored HH:MM in clock order, then the plan's order, an untimed stop
  // after the timed ones of its day. The CSV and the print sort by it; `forTimeline` renumbers it in a timeline's order.
  const clockOf = (t: string | null): string => t?.match(/\b\d{2}:\d{2}\b/)?.[0] ?? '99:99';
  [...stops].sort((a, b) => a.day - b.day || clockOf(a.time).localeCompare(clockOf(b.time)) || a.order - b.order).forEach((s, i) => {
    s.order = i;
  });
  for (const b of trip.bases) {
    if (b.point) add({ key: b.id, name: b.name, kind: 'base', role: 'base', day: b.days[0] ?? null, note: `${b.nights} night${b.nights === 1 ? '' : 's'}`, url: null, point: b.point });
  }
  const rows = Object.values(trip.categories).flat();
  const tz = rows.map((c) => c.bookRule?.tz).find((t): t is string => !!t) ?? null;
  return {
    type: 'trip',
    version: EXPORT_MODEL_VERSION,
    slug: trip.slug,
    title: trip.title,
    url: tripUrl(trip.slug),
    depth: trip.depth,
    nights: trip.nights ?? Math.max(0, trip.days.length - 1),
    days: trip.days.map((d) => ({ n: d.n, title: d.title, base: d.base })),
    // the booking windows as the page's category rows hold them (MUST-6): the trip's list, and each on the stop whose place it names
    stops: withStopBookings(stops, rows),
    bookings: tripBookings(rows),
    waypoints,
    lines,
    tz: tz ?? tripZone(trip),
    seasonLabel: trip.season?.label ?? null,
    ...(trip.season?.months?.length ? { seasonMonths: [...trip.season.months] } : {}),
    skipped,
  };
}

/**
 * The trip's export as its default profile shows it (BACKLOG 15.223a; TRP-GL-C review F4): the default-profile timelines the page opens
 * with, through core's `forTimeline`, the same function the page's Export menu calls. One row per row of that timeline (a Rockies stop
 * is no longer repeated once per track) and the print's wording of each time ("~08:45" suggested). For the API's `csv` and `print`; the
 * `json` model stays whole, because the client reads it as the page's model and applies the visitor's own profile
 * (web/lib/client/api.ts loadExport). The page's display marks (zone lines, flight-tied "about") are not applied yet: 15.223a.
 */
export function buildTripExportForDefaultProfile(trip: PublicTrip, lookup: (slug: string) => PublicPlace | null = getPlace): TripExport {
  const model = buildTripExport(trip, lookup);
  return forTimeline(model, trip.schedule ? { timelines: trip.schedule.timelines } : null);
}

export function buildPlaceExport(place: PublicPlace): PlaceExport {
  let skipped = 0;
  const waypoints: ExportWaypoint[] = [];
  const add = (key: string, name: string, kind: string, role: ExportWaypoint['role'], note: string | null, point: ExportWaypoint['point']) => {
    if (!checkPoint(point).ok) {
      skipped += 1;
      return;
    }
    waypoints.push({ id: `${role}:0:${key}`, name, kind, role, day: null, note, url: placeUrl(place.slug), point });
  };
  if (place.point) add(place.slug, place.name, place.kind, 'place', null, place.point);
  if (place.access?.trailhead) add('th', place.access.trailhead.name, 'trailhead', 'trailhead', place.access.trailhead.note, place.access.trailhead);
  for (const [i, p] of (place.access?.parking ?? []).entries()) add(`p${i}`, p.name, 'parking', 'parking', p.note, p);
  return { type: 'place', version: EXPORT_MODEL_VERSION, slug: place.slug, title: place.name, url: placeUrl(place.slug), kind: place.kind, waypoints, lines: place.lines.map(lineOf), skipped };
}

export const tripExportFor = (slug: string): TripExport | null => {
  const t = getTrip(slug);
  return t ? buildTripExport(t) : null;
};
export const placeExportFor = (slug: string): PlaceExport | null => {
  const p = getPlace(slug);
  return p ? buildPlaceExport(p) : null;
};
export { tripSlugs, placeSlugs };
