// The named conditions of an `R?` mark (capture contract 12: "R? triggers must be data, not prose"). A mark `R?` in types.json
// or in the registry names one of these; the engine evaluates it on the record. A condition the engine cannot decide from the
// data it has comes back `null` (unknown), and an unknown R? is listed but not counted against the record.
export const TRIGGERS = [
  /** the place or offer operates: it has hours, staff, a lift */
  "operates",
  /** anything is sold: a price is stated, or an offer on or at the record sells */
  "sells",
  /** the booking window matters: a permit, timed entry, lottery or a reservable offer */
  "bookable",
  /** the manager publishes a status or conditions page */
  "status_page",
  /** the record is part of something */
  "part_of_something",
  /** you cannot drive to the door: a walk, shuttle, lift or boat comes first */
  "no_door_access",
  /** the product is cancelled or changed by weather */
  "weather_dependent",
  /** a wildlife area with distance rules */
  "wildlife_area",
  /** the value is computed by a derive step that exists and has an input (near_town: the towns layer and a non-approximate point; META-2) */
  "derived",
  /** a route with a distinct start and end: its shape is point-to-point, or it starts and ends at different records (ends_at; 3.7.2) */
  "point_to_point",
  /** a GPX download is offered: a filled `gpx_download` link (gpx_licence; never offer a file without a stated licence, D5) */
  "gpx_offered",
  /** no condition is named: the mark is advisory */
  "conditional",
] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const isTrigger = (x: string): x is Trigger => (TRIGGERS as readonly string[]).includes(x);
