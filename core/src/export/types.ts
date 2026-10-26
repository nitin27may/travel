// The export model. Plain JSON, built from the public dataset only (lib/public), so a private trip has no way in:
// the builders in build.server.ts take what `getTrip()` / `getPlace()` return and nothing else.

import type { Depth, Point } from './publicTypes.ts';

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
  /**
   * Position inside the file: the CSV and the print sort by day, then this. `buildTripExport` numbers the plan's authored HH:MM
   * chronologically (then the plan's order); `forTimeline` (plan.ts) renumbers the kept stops in the timeline's order.
   */
  order: number;
  id: string;
  name: string;
  kind: string;
  category: string | null;
  area: string | null;
  /**
   * HH:MM as the plan writes it, or null. After `forPage` (web/lib/export/plan.ts) with the page's timeline, the time as the page and the
   * print say it for the chosen profile: "~08:45" suggested, "about 19:30" tied to the sun, "07:30 PT" over a zone line, or a part of the
   * day on a condensed plan (csv.ts header: the CSV time rule).
   */
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
  /**
   * What "Book ahead" says for this stop: each booking's window and note, as bookings.ts `bookAheadText` words them, when a booking row
   * names this stop's place on this day. Absent when none does (every real trip today: the logistics rows name no place, BACKLOG
   * 15.223b). Dateless: "Opens 30 days before Day 3; Non-refundable".
   */
  bookAhead?: string;
}

/**
 * One booking of the trip (MUST-6): a category row with a booking window or a booking note, worded as the page words it. Dateless: a
 * window is relative to a day, never a calendar date.
 */
export interface ExportBooking {
  /** The row's name on the page: "Tre Cime toll road slot". */
  name: string;
  /** The window, "Opens 30 days before Day 3"; null when the plan only has a note. */
  rule: string | null;
  /** The plan's note on booking it ("Pre-booked slots, non-refundable"), or null. */
  note: string | null;
  /** The day the window counts from (the rule's own day), else the first day it is for; null when the plan ties it to no day. */
  day: number | null;
  /**
   * The page's category row key ("logistics:r-auronzo"), so the print and the page can name the same row. Opaque: stable within one
   * revision of the trip only (today's keys are legacy and prototype ids that change at TD-3/TD-4); never parse it or store it.
   */
  ref: string;
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
  /** The trip's bookings in day order (bookings.ts `tripBookings`); empty when the plan has none. Never a calendar date. */
  bookings: ExportBooking[];
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
