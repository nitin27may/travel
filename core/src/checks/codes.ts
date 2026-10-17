// Day-check warning codes (plan 2.4). Warnings are shown and never block a write. Every code needs a fixture in
// core/test/fixtures/warn/<CODE>.json; core/test/checks/codes.test.ts fails when one is missing.
export const WARN_CODES = {
  W_ORDER: "items sorted by seq have a decreasing effective start",
  W_OVERLAP: "an item ends (plus the next leg) after the next item starts",
  W_LEG_MISSING: "consecutive items more than 300 m apart without leg_mode and leg_minutes",
  W_DAYLIGHT: "an item that needs daylight ends after sunset",
  W_HOURS: "an item falls outside opening hours or on a closed weekday",
  W_BOOKING_DAY: "an item's booking is not used on this day",
  W_PACE: "active time on a track is over the pace budget",
  W_CEILING: "a trail is over the hiking ceiling or the house grade for its track",
  W_EARLY: "an item starts before 06:00 when early starts are never",
  W_DEADLINE: "a booking's book-by date has passed and it is still todo",
  W_NO_COORDS: "an item resolves to no coordinates",
  W_TZ_MISSING: "consecutive items sit in different base zones and neither sets tz",
  W_LEG_DRIFT: "leg values differ from the catalog leg by more than 20%",
  W_DRIVE_LIMIT: "driving on a day is over the profile limit",
  W_FIT: "a traveller fails an offer's or activity's limits",
  W_FIT_UNKNOWN: "the limits of an offer or activity are not known",
} as const;

export type WarnCode = keyof typeof WARN_CODES;
export const WARN_CODE_LIST = Object.keys(WARN_CODES) as WarnCode[];

/** a warning from the day checks; `accepted` is true when the day lists the code in accepted_warnings (still shown) */
export interface DayWarning {
  code: WarnCode;
  /** JSON pointer inside trip.json, e.g. /items/3 */
  path: string;
  message: string;
  day: number | null;
  track: string | null;
  accepted: boolean;
}
