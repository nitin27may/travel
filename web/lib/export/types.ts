// The export model. Plain JSON, built from the public dataset only (lib/public), so a private trip has no way in:
// the builders in build.server.ts take what `getTrip()` / `getPlace()` return and nothing else.

import type { Depth, Point } from '@/lib/public/types';

export type WaypointRole = 'stop' | 'trailhead' | 'parking' | 'base' | 'place';

export interface ExportWaypoint {
  /** Stable within the file: `<role>:<day>:<key>`. */
  id: string;
  name: string;
  kind: string;
  role: WaypointRole;
  /** Day number, or null for a place page. */
  day: number | null;
  note: string | null;
  /** Page URL of the place, when it has one. */
  url: string | null;
  point: Point;
}

export interface ExportLine {
  ref: string;
  label: string;
  /** From LD: true only for OSM-derived lines with an osm_ref, or official sources whose licence allows reuse. */
  exportable: boolean;
  /** Licence of the geometry, e.g. "ODbL". */
  licence: string;
  /** [lon, lat] pairs. The public dataset carries references today, so this is empty until geometry ships. */
  geometry: [number, number][];
}

export interface ExportStop {
  day: number;
  /** Position inside the file (chronological: day, then time, then order on the page). */
  order: number;
  id: string;
  name: string;
  kind: string;
  category: string | null;
  area: string | null;
  /** HH:MM, or null. */
  time: string | null;
  durationMin: number | null;
  /** "A" or "B" lane, or the track label on a split day. */
  lane: string | null;
  note: string | null;
  placeSlug: string | null;
  /** Page URLs: the place page, then the booking-style links of the place. */
  links: string[];
  /** The place's own point, with its source, so the CSV can apply the same licence guard as GPX. */
  point: Point | null;
}

export interface ExportDay {
  n: number;
  title: string;
  base: string | null;
}

export interface TripExport {
  type: 'trip';
  slug: string;
  title: string;
  /** Canonical page URL, no anchor. */
  url: string;
  depth: Depth;
  nights: number;
  days: ExportDay[];
  stops: ExportStop[];
  waypoints: ExportWaypoint[];
  lines: ExportLine[];
  /** IANA zone from the booking rules, when the trip has one. */
  tz: string | null;
  seasonLabel: string | null;
  /** Points left out of the file because their source is not ours to give (counted, never listed). */
  skipped: number;
}

export interface PlaceExport {
  type: 'place';
  slug: string;
  title: string;
  url: string;
  kind: string;
  waypoints: ExportWaypoint[];
  lines: ExportLine[];
  skipped: number;
}
