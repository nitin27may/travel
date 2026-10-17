// Trip family (plan 2.2 and 2.3). Root key order is TRIP_TABLES order. Rows are flat; nested objects
// appear only inside `json` columns that are never filtered or joined.
import { z } from "zod";
import * as E from "./enums.ts";
import {
  SLUG_RE, bool, currency, date, datetime, enumOf, hhmm, idList, int, json, linkList,
  monthList, moneyPair, offset, pattern, real, strList, table, text, tz, weekdayList,
} from "./meta.ts";
import type { Rule, Table } from "./meta.ts";

const FAMILY = "trip" as const;
const srcCol = () => idList();
const pairRule = (code: string, columns: string[], describe: string): Rule => ({ code, kind: "pair", columns, describe });

export const trip = table("trip", {
  slug: pattern(SLUG_RE, { ui: { label: "Slug" } }),
  title: text({ min: 1, ui: { label: "Title" } }),
  subtitle: text(),
  status: enumOf(E.TRIP_STATUS, { ui: { label: "Status", facet: true } }),
  primary_style: enumOf(E.PRIMARY_STYLE, { ui: { label: "Style", facet: true } }),
  duration_shape: enumOf(E.DURATION_SHAPE, { ui: { label: "Length", facet: true } }),
  movement_shape: enumOf(E.MOVEMENT_SHAPE, { ui: { label: "Movement", facet: true } }),
  party_shape: enumOf(E.PARTY_SHAPE, { ui: { label: "Party", facet: true } }),
  countries: json(z.array(z.string().regex(/^[A-Z]{2}$/)), { fk: "countries.code" }),
  region_label: text(),
  season_months: monthList(),
  season_note: text(),
  nights: int({ min: 0 }),
  origin: text(),
  origin_tz: tz(),
  base_currency: currency(),
  theme: text({ null: true }),
  hero_image: text({ null: true }),
  answer_prose: text({ null: true }),
  orientation_prose: text({ null: true }),
  web_published: bool(),
  visibility: enumOf(E.VISIBILITY, { ui: { label: "Visibility", facet: true } }),
  owner_id: text({ min: 1 }),
  shared_with: idList(),
  generated_by: text({ null: true }),
  legacy_url: text({ null: true }),
  created: date(),
}, {
  family: FAMILY, pk: ["slug"], single: true,
  sql: { name: "trips", indexes: [["owner_id"], ["visibility"]] },
  ui: { label: "Trip" },
  rules: [
    { code: "E_SLUG", kind: "custom", describe: "slug pattern, not reserved, equals the root id and the folder name" },
    { code: "E_DURATION_SHAPE", kind: "custom", describe: "duration_shape matches nights" },
    { code: "E_NIGHTS_SUM", kind: "custom", describe: "nights equals the sum of bases.nights" },
    { code: "E_STYLE_TAG", kind: "custom", describe: "primary_style also appears in trip_tags" },
    { code: "E_VISIBILITY", kind: "custom", describe: "web_published is false on a private trip" },
  ],
});

export const profile = table("profile", {
  pace: int({ min: 1, max: 5 }),
  comfort: enumOf(E.COMFORT),
  ...moneyPair("budget_target", { null: true }),
  budget_tier: enumOf(E.COMFORT),
  must_do: json(z.array(z.strictObject({ text: z.string(), ref: z.string().nullable() }))),
  avoid: strList(),
  hiking_ceiling_km: real({ null: true, min: 0 }),
  hiking_ceiling_gain_m: int({ null: true, min: 0 }),
  max_house_grade: int({ null: true, min: 1, max: 5 }),
  weather_rain: enumOf(E.WEATHER_RAIN),
  weather_wind_gust_kmh: int({ null: true }),
  weather_cold_c: int({ null: true }),
  weather_heat_c: int({ null: true }),
  base_preference: enumOf(E.BASE_PREFERENCE),
  car_free: bool(),
  transport: json(z.array(z.enum(E.TRANSPORT))),
  daily_max_drive_min: int({ min: 0 }),
  break_every_min: int({ min: 0 }),
  kids_mode: enumOf(E.KIDS_MODE),
  early_starts: enumOf(E.EARLY_STARTS),
  night_driving: bool(),
  lanes_extra: strList(),
  lanes_skip: strList(),
  notes: text(),
}, {
  family: FAMILY, pk: [], single: true,
  sql: { name: "profile" },
  ui: { label: "Profile" },
  rules: [pairRule("E_COST_PAIR", ["budget_target_amount", "budget_target_currency"], "budget target amount and currency go together")],
});

export const travellers = table("travellers", {
  id: text({ min: 1 }),
  label: text({ min: 1 }),
  role: enumOf(E.TRAVELLER_ROLE),
  age_years: int({ null: true, min: 0, max: 120, private: true }),
  age_as_of: date({ null: true, private: true }),
  height_cm: int({ null: true, private: true }),
  weight_kg: int({ null: true, private: true }),
  fitness: int({ null: true, min: 1, max: 5, private: true }),
  citizenship: json(z.array(z.string().regex(/^[A-Z]{2}$/)), { private: true }),
  notes: text({ private: true }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Travellers" } });

export const trip_tags = table("trip_tags", {
  tag_id: text({ min: 1, fk: "tags.id" }),
}, { family: FAMILY, pk: ["tag_id"], ui: { label: "Tags" } });

export const editions = table("editions", {
  id: text({ min: 1 }),
  label: text(),
  year: int({ min: 2000, max: 2200 }),
  start: date(),
  end: date(),
  status: enumOf(E.EDITION_STATUS),
  why: text(),
  fare_window_id: text({ null: true, fk: "fare_windows.id" }),
  conditions_trigger: text({ null: true }),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Editions" },
  rules: [
    { code: "E_EDITION_LENGTH", kind: "custom", describe: "end - start + 1 equals the number of days with n >= 1" },
    { code: "E_EDITION_CHOSEN", kind: "custom", describe: "at most one edition is chosen or booked" },
  ],
});

export const bases = table("bases", {
  id: text({ min: 1 }),
  name: text({ min: 1 }),
  place_id: text({ null: true, fk: "places.id" }),
  stay_id: text({ null: true, fk: "stays.id" }),
  lodging: text({ null: true }),
  night_from: int({ min: 0 }),
  nights: int({ min: 1 }),
  lat: real({ null: true, min: -90, max: 90 }),
  lon: real({ null: true, min: -180, max: 180 }),
  tz: tz(),
  elevation_m: int({ null: true }),
  why: text(),
  why_not: text(),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Bases" },
  sql: { checks: ["CHECK ((lat IS NULL) = (lon IS NULL))"] },
  rules: [{ code: "E_BASE_COVER", kind: "custom", describe: "every night is covered by exactly one base" }],
});

export const days = table("days", {
  n: int({ min: 0 }),
  title: text(),
  kind: enumOf(E.DAY_KIND),
  base_id: text({ null: true, fk: "bases.id" }),
  summary: text(),
  prose: text({ null: true }),
  flexible_group: text({ null: true }),
  decision_rules: strList(),
  plan_b_title: text(),
  plan_b_text: text({ null: true }),
  sun_note: text({ null: true }),
  day_of_links: json(z.array(z.strictObject({ label: z.string(), url: z.string(), kind: z.enum(E.DAY_LINK_KIND) }))),
  accepted_warnings: strList(),
}, {
  family: FAMILY, pk: ["n"], ui: { label: "Days" },
  rules: [{ code: "E_DAYS_CONTIGUOUS", kind: "contiguous", columns: ["n"], describe: "n runs 0..N or 1..N without gaps" }],
});

export const day_tracks = table("day_tracks", {
  day: int({ min: 0, fk: "days.n" }),
  track: enumOf(E.TRACK),
  audience: enumOf(E.TRACK_AUDIENCE),
  title: text(),
  notes: text(),
  split: bool(),
}, { family: FAMILY, pk: ["day", "track"], ui: { label: "Day tracks" } });

export const items = table("items", {
  id: text({ min: 1 }),
  day: int({ min: 0, fk: "days.n" }),
  track: enumOf(E.TRACK, { null: true }),
  seq: int({ min: 1 }),
  start: hhmm({ null: true }),
  window_start: hhmm({ null: true }),
  window_end: hhmm({ null: true }),
  tz: tz({ null: true }),
  duration_min: int({ min: 0 }),
  type: enumOf(E.ITEM_TYPE, { ui: { label: "Type", facet: true } }),
  optional: bool(),
  pinned: bool(),
  title: text({ min: 1 }),
  place_id: text({ null: true, fk: "places.id" }),
  trail_id: text({ null: true, fk: "trails.id" }),
  activity_id: text({ null: true, fk: "activities.id" }),
  eatery_id: text({ null: true, fk: "eateries.id" }),
  custom_item_id: text({ null: true, fk: "custom_items.id" }),
  base_id: text({ null: true, fk: "bases.id" }),
  booking_id: text({ null: true, fk: "trip_bookings.id" }),
  lat: real({ null: true, min: -90, max: 90 }),
  lon: real({ null: true, min: -180, max: 180 }),
  address: text({ null: true }),
  leg_id: text({ null: true, fk: "legs.id" }),
  leg_mode: enumOf(E.LEG_MODE, { null: true }),
  leg_km: real({ null: true, min: 0 }),
  leg_minutes: int({ null: true, min: 0 }),
  leg_basis: enumOf(E.LEG_BASIS, { null: true }),
  leg_notes: text(),
  ...moneyPair("cost", { null: true }),
  cost_per: enumOf(E.COST_PER, { null: true }),
  open_from: hhmm({ null: true }),
  open_to: hhmm({ null: true }),
  closed_weekdays: weekdayList(),
  needs_daylight: bool(),
  plan_b_item_id: text({ null: true, fk: "items.id" }),
  override: json(z.record(z.string(), z.unknown()), { null: true }),
  notes: text(),
  links: json(z.array(z.strictObject({ label: z.string(), url: z.string(), kind: z.enum(E.LINK_KIND) }))),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Items" },
  sql: {
    checks: ["CHECK ((lat IS NULL) = (lon IS NULL))"],
    indexes: [["day", "track", "seq"]],
  },
  rules: [
    { code: "E_SEQ_CONTIGUOUS", kind: "contiguous", columns: ["seq"], groupBy: ["day", "track"], describe: "seq is 1..n per day and track" },
    { code: "E_ITEM_REF", kind: "custom", describe: "trail items name a trail, checkin and checkout items name a base, at most one of trail, activity, eatery, custom item" },
    { code: "E_ITEM_TIME", kind: "custom", describe: "start excludes a window, and window_end is not before window_start" },
    { code: "E_PLAN_B", kind: "custom", describe: "plan_b_item_id names a track P item on the same day" },
    pairRule("E_COST_PAIR", ["cost_amount", "cost_currency", "cost_per"], "cost amount, currency and cost_per go together"),
  ],
});

export const trip_trails = table("trip_trails", {
  trail_id: text({ min: 1, fk: "trails.id" }),
  role: enumOf(E.TRAIL_ROLE),
  alternative_of: text({ null: true, fk: "trip_trails.trail_id" }),
  turnaround_rule: text({ null: true }),
  party_note: text(),
  kid_fit: enumOf(E.KID_FIT),
  verdict: text(),
  override: json(z.record(z.string(), z.unknown()), { null: true }),
}, { family: FAMILY, pk: ["trail_id"], ui: { label: "Trails used" } });

export const trip_activities = table("trip_activities", {
  activity_id: text({ min: 1, fk: "activities.id" }),
  day: int({ null: true, min: 0 }),
  verdict: enumOf(E.ACTIVITY_VERDICT),
  why: text(),
  offer_id: text({ null: true, fk: "offers.id" }),
}, { family: FAMILY, pk: ["activity_id"], ui: { label: "Activities used" } });

export const trip_bookings = table("trip_bookings", {
  id: text({ min: 1 }),
  offer_id: text({ null: true, fk: "offers.id" }),
  item: text({ null: true }),
  category: enumOf(E.OFFER_CATEGORY, { null: true }),
  book_url: text({ null: true }),
  base_id: text({ null: true, fk: "bases.id" }),
  used_days: json(z.array(z.number().int())),
  book_by_offset: offset({ null: true }),
  book_by_basis: enumOf(E.BOOK_BY_BASIS),
  deadline_date: date({ null: true }),
  edition_id: text({ null: true, fk: "editions.id" }),
  priority: enumOf(E.BOOKING_PRIORITY),
  status: enumOf(E.BOOKING_STATUS, { ui: { label: "Status", facet: true } }),
  ...moneyPair("price_paid", { null: true, private: true }),
  confirmation: text({ null: true, private: true }),
  contact: text({ null: true, private: true }),
  found_by: text({ min: 1 }),
  notes: text(),
  src: srcCol(),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Bookings" },
  rules: [
    { code: "E_BOOKING_OFFER", kind: "custom", describe: "a booking names an offer, or an item and a category" },
    pairRule("E_COST_PAIR", ["price_paid_amount", "price_paid_currency"], "price paid amount and currency go together"),
  ],
});

export const custom_items = table("custom_items", {
  id: text({ min: 1 }),
  name: text({ min: 1 }),
  kind: enumOf(E.CUSTOM_KIND),
  lat: real({ null: true, min: -90, max: 90 }),
  lon: real({ null: true, min: -180, max: 180 }),
  address: text({ null: true }),
  osm_id: text({ null: true }),
  notes: text(),
  duration_min: int({ null: true, min: 0 }),
  open_from: hhmm({ null: true }),
  open_to: hhmm({ null: true }),
  proposed: enumOf(E.PROPOSED),
  catalog_id: text({ null: true }),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Custom items" },
  sql: { checks: ["CHECK ((lat IS NULL) = (lon IS NULL))"] },
});

export const notes = table("notes", {
  id: text({ min: 1 }),
  scope: enumOf(E.NOTE_SCOPE),
  ref: text({ null: true }),
  text: text(),
  visibility: enumOf(E.NOTE_VISIBILITY),
  links: linkList(),
  attachments: json(z.array(z.strictObject({ name: z.string(), local_key: z.string() }))),
  author: text({ min: 1 }),
  created: datetime(),
  updated: datetime(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Notes" } });

export const routes = table("routes", {
  id: text({ min: 1 }),
  days: json(z.array(z.number().int())),
  waypoints: json(z.array(z.union([z.string(), z.strictObject({ lat: z.number(), lon: z.number() })]))),
  profile: enumOf(E.ROUTE_PROFILE),
  break_every_min: int({ min: 0 }),
  daily_max_drive_min: int({ min: 0 }),
  corridor_km: real({ min: 0 }),
  break_types: strList(),
  avoid: json(z.array(z.enum(["ferries", "tolls", "unpaved"]))),
  geometry_file: text({ null: true }),
  provider: enumOf(E.ROUTE_PROVIDER, { null: true }),
  computed: datetime({ null: true }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Routes" } });

export const hazards = table("hazards", {
  id: text({ min: 1 }),
  category: enumOf(E.HAZARD_CATEGORY),
  title: text(),
  text: text(),
  severity: int({ min: 1, max: 3 }),
  days: json(z.array(z.number().int())),
  trail_ids: json(z.array(z.string()), { fk: "trails.id" }),
  place_ids: json(z.array(z.string()), { fk: "places.id" }),
  mitigation: text(),
  src: srcCol(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Hazards" } });

export const weather_rules = table("weather_rules", {
  id: text({ min: 1 }),
  day: int({ null: true, min: 0, fk: "days.n" }),
  metric: enumOf(E.WEATHER_METRIC),
  op: enumOf(E.WEATHER_OP),
  value: real(),
  at: hhmm(),
  action: text(),
  plan_b_day: int({ null: true, min: 0, fk: "days.n" }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Weather rules" } });

export const budget = table("budget", {
  id: text({ min: 1 }),
  category: enumOf(E.BUDGET_CATEGORY),
  item: text(),
  currency: currency(),
  per_person_amount: real({ null: true, min: 0 }),
  group_low_amount: real({ min: 0 }),
  group_high_amount: real({ min: 0 }),
  basis: enumOf(E.BUDGET_BASIS),
  read_date: date({ null: true }),
  booking_id: text({ null: true, fk: "trip_bookings.id" }),
  fare_window_id: text({ null: true, fk: "fare_windows.id" }),
  src: srcCol(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Budget" } });

export const fx = table("fx", {
  currency: currency(),
  rate_to_base: real({ min: 0 }),
  as_of: date(),
  source: enumOf(E.FX_SOURCE),
}, { family: FAMILY, pk: ["currency"], ui: { label: "Exchange rates" } });

export const fare_windows = table("fare_windows", {
  id: text({ min: 1 }),
  label: text(),
  depart: date(),
  return: date(),
  nights_away: int({ min: 0 }),
  party: json(z.strictObject({ adults: z.number().int(), children: z.array(z.number().int()) }), { private: true }),
  school_break: bool(),
  notes: text(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Fare windows" } });

export const fare_quotes = table("fare_quotes", {
  id: text({ min: 1 }),
  window_id: text({ min: 1, fk: "fare_windows.id" }),
  kind: enumOf(E.FARE_KIND),
  leg: text(),
  date_from: date(),
  date_to: date(),
  total_amount: real({ min: 0 }),
  total_currency: currency(),
  provider: text(),
  method: enumOf(E.FARE_METHOD),
  url: text({ null: true }),
  read_at: datetime(),
  filters: text(),
  confidence: enumOf(E.CONFIDENCE),
  notes: text(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Fare quotes" } });

export const documents = table("documents", {
  id: text({ min: 1 }),
  item: enumOf(E.DOC_ITEM),
  applies_to: text({ min: 1 }),
  rule: text(),
  deadline_offset: offset({ null: true }),
  computed_rule: text({ null: true }),
  status: text(),
  src: srcCol(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Documents" } });

export const emergency = table("emergency", {
  base_id: text({ min: 1, fk: "bases.id" }),
  number: text(),
  hospital_name: text(),
  hospital_lat: real({ null: true, min: -90, max: 90 }),
  hospital_lon: real({ null: true, min: -180, max: 180 }),
  hospital_tel: text({ null: true }),
  rescue_tel: text({ null: true }),
  embassy: text({ null: true }),
  insurer_tel: text({ null: true, private: true }),
  roadside_tel: text({ null: true }),
  src: srcCol(),
}, { family: FAMILY, pk: ["base_id"], ui: { label: "Emergency" } });

export const packing = table("packing", {
  id: text({ min: 1 }),
  item: text({ min: 1 }),
  reason: enumOf(E.PACKING_REASON),
  qty: int({ min: 1 }),
}, { family: FAMILY, pk: ["id"], ui: { label: "Packing" } });

export const knowledge = table("knowledge", {
  id: text({ min: 1 }),
  claim: text({ min: 1 }),
  status: enumOf(E.KNOWLEDGE_STATUS),
  src: srcCol(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Knowledge" } });

export const questions = table("questions", {
  id: text({ min: 1 }),
  text: text({ min: 1 }),
  status: enumOf(E.QUESTION_STATUS),
  answer: text({ null: true }),
  asked: date(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Questions" } });

export const gotchas = table("gotchas", {
  id: text({ min: 1 }),
  text: text({ min: 1 }),
  src: srcCol(),
}, { family: FAMILY, pk: ["id"], ui: { label: "Gotchas" } });

export const research_refs = table("research_refs", {
  id: text({ min: 1 }),
  path: text({ min: 1 }),
  sidecar: text({ null: true }),
  lane: text({ min: 1 }),
  title: text(),
  added: date(),
  sha256: pattern(/^[0-9a-f]{64}$/),
  synthesised: date({ null: true }),
}, {
  family: FAMILY, pk: ["id"], ui: { label: "Research" },
  rules: [{ code: "E_RESEARCH_PATH", kind: "custom", describe: "path (and sidecar) exist under the repository" }],
});

export const sources = table("sources", {
  id: pattern(/^src-\d{4,}$/),
  url: text({ min: 1 }),
  title: text(),
  publisher: text(),
  kind: enumOf(E.SOURCE_KIND),
  checked: date(),
  research_ref: text({ null: true, fk: "research_refs.id" }),
}, {
  family: FAMILY, pk: ["id"], sql: { name: "trip_sources" }, ui: { label: "Sources" },
  rules: [{ code: "E_SRC", kind: "custom", describe: "every id in a src column is in sources" }],
});

export const changelog = table("changelog", {
  seq: int({ min: 1 }),
  at: datetime(),
  actor_id: text({ min: 1 }),
  actor_via: text({ min: 1 }),
  op: text({ min: 1 }),
  summary: text(),
  refs: strList(),
}, { family: FAMILY, pk: ["seq"], ui: { label: "Change log" } });

/** root key order of trip.json after schema_version, id and updated (plan 2.2) */
export const TRIP_TABLES: Table[] = [
  trip, profile, travellers, trip_tags, editions, bases, days, day_tracks, items, trip_trails, trip_activities,
  trip_bookings, custom_items, notes, routes, hazards, weather_rules, budget, fx, fare_windows, fare_quotes,
  documents, emergency, packing, knowledge, questions, gotchas, research_refs, sources, changelog,
];

export const TRIP_SCHEMA_VERSION = 1;
