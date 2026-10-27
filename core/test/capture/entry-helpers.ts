// PA-C test helpers: a scratch root with the Rockies parks of protected-area-entry 2.4 and 11 (synthetic store, real shapes) and the
// D8-R proposal records (research/runs/D8R-rockies-bookings.md) reshaped per section 11. Prices are illustrative, not research.
import { join } from "node:path";
import { validateDoc } from "../../src/validate/index.ts";
import { capDoc, scope, scratchRoot } from "./helpers.ts";

export const LANE = "data/capture/fixture-trip/pa.json";
export const PLACES = ["banff-national-park", "yoho-national-park", "kananaskis-country", "lake-louise", "waterton-lakes", "peace-park"];
export const MORAINE = "legacy/canadian-rockies-sept-2029/sights/moraine-lake";
export const PASS = "offer/operator/parks-canada#discovery-pass";
export const OHARA = "part/place/yoho-national-park#lake-ohara";

const OPERATORS = [
  { ref: "operator/parks-canada", name: "Parks Canada", url: "https://parks.canada.ca/" },
  { ref: "operator/roam-transit", name: "Roam Transit", url: "https://roamtransit.com/" },
  { ref: "operator/alberta-parks", name: "Alberta Parks", url: "https://albertaparks.ca/" },
];

const LOCATIONS = {
  countries: [{ code: "CA" }],
  regions: [{ id: "CA/AB" }, { id: "CA/BC" }],
  areas: [
    { id: "CA/AB/banff-national-park", region_id: "CA/AB" },
    { id: "CA/BC/yoho-national-park", region_id: "CA/BC" },
    { id: "CA/AB/kananaskis-country", region_id: "CA/AB" },
    { id: "CA/AB/waterton-lakes", region_id: "CA/AB" },
  ],
  places: [],
};

/** The place records the requirements hang on: pinned, so their own tier and placement gaps warn and the offers are what is judged. */
export const PLACE_RECORDS = [
  { ref: "place/banff-national-park", type: "nature.protected.national_park", layer: "place", name: "Banff National Park", area_id: "CA/AB/banff-national-park", covers_areas: ["CA/AB/banff-national-park"], run_by: "operator/parks-canada" },
  { ref: "place/yoho-national-park", type: "nature.protected.national_park", layer: "place", name: "Yoho National Park", area_id: "CA/BC/yoho-national-park", covers_areas: ["CA/BC/yoho-national-park"], run_by: "operator/parks-canada" },
  { ref: OHARA, type: "nature.protected.zone", layer: "place", name: "Lake O'Hara", area_id: "CA/BC/yoho-national-park", part_of: ["place/yoho-national-park"], run_by: "operator/parks-canada" },
  { ref: "place/kananaskis-country", type: "nature.protected.conservation_area", layer: "place", name: "Kananaskis Country", area_id: "CA/AB/kananaskis-country", covers_areas: ["CA/AB/kananaskis-country"], run_by: "operator/alberta-parks" },
  { ref: MORAINE, type: "water.body.lake", layer: "place", name: "Moraine Lake", area_id: "CA/AB/banff-national-park" },
  { ref: "place/lake-louise", type: "water.body.lake", layer: "place", name: "Lake Louise", area_id: "CA/AB/banff-national-park" },
];

export const SOURCES = [
  { id: "src-0001", url: "https://parks.canada.ca/voyage-travel/admission", title: "Admission and passes", publisher: "Parks Canada", kind: "official", read: "2026-10-26", method: "read" },
  { id: "src-0002", url: "https://roamtransit.com/fares/reservations/super-pass-reservations/", title: "Super Pass Reservations", publisher: "Roam Transit", kind: "operator", read: "2026-10-26", method: "read" },
  { id: "src-0003", url: "https://www.alberta.ca/kananaskis-conservation-pass", title: "Kananaskis Conservation Pass", publisher: "Government of Alberta", kind: "official", read: "2026-10-26", method: "read" },
  { id: "src-0004", url: "https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/ohara/visit", title: "Visiting Lake O'Hara", publisher: "Parks Canada", kind: "official", read: "2026-10-26", method: "read" },
];

const v = <T>(value: T, src = "src-0001", basis = "official_info") => ({ v: value, state: "value", basis, src: [src], read: "2026-10-26" });
const allYear = (src?: string) => v([{ from: "01-01", to: "12-31", status: "open" }], src);
const official = (url: string, src = "src-0001") => [{ kind: "official", url, state: "filled", src: [src] }];

/** An access.pass requirement with every key of its required tier answered. */
export function requirement(ref: string, type: string, over: Record<string, unknown> = {}, src = "src-0001"): Record<string, unknown> {
  return {
    ref, type, layer: "offer", name: ref.split("#")[1], summary: `The ${ref.split("#")[1]} requirement, in our words.`,
    season: allYear(src),
    price: v([{ amount: 11, currency: "CAD", per: "adult", age_from: 18 }, { amount: 0, currency: "CAD", per: "child", age_to: 17 }], src),
    window: v({ rule: "anytime" }, src),
    entry: v({ required: "always", needed_for: ["day", "overnight_front", "overnight_back"], unit: "person", channel: ["online", "gate"] }, src),
    links: official("https://parks.canada.ca/voyage-travel/admission", src),
    ...over,
  };
}

/** The six D8-R proposals, reshaped per protected-area-entry 11 (the frontcountry campsite is a lodging offer, kept separate). */
export const D8R_OFFERS = [
  requirement(PASS, "access.pass.park_pass", {
    run_by: "operator/parks-canada",
    entry: v({ required: "always", needed_for: ["day", "overnight_front", "overnight_back"], unit: "group", valid: { span: 12, unit: "month", from: "purchase" }, channel: ["online", "gate", "visitor_centre"], proof: "display" }),
    price: v([{ amount: 151.25, currency: "CAD", per: "family" }, { amount: 75.25, currency: "CAD", per: "adult", age_from: 18, age_to: 64 }]),
  }),
  requirement("offer/place/banff-national-park#daily-admission", "access.pass.entry_fee", {
    at: ["place/banff-national-park"], covered_by: [PASS], run_by: "operator/parks-canada",
    entry: v({ required: "always", needed_for: ["day", "overnight_front", "overnight_back"], unit: "person", valid: { span: 1, unit: "day", from: "calendar" }, channel: ["online", "gate", "visitor_centre"], exemptions: [{ who: "through_traffic", note: "no stop on the Trans-Canada Highway" }] }),
  }),
  requirement(`offer/${MORAINE}#roam-super-pass`, "access.pass.shuttle_seat", {
    at: [MORAINE, "place/lake-louise"], run_by: "operator/roam-transit",
    season: v([{ from: "06-01", to: "10-12", status: "open", applies_to: "2026" }], "src-0002", "operator_info"),
    window: v({ rule: "monthly_release", month_lead_days: 35, opens_time: "09:00", tz: "America/Edmonton" }, "src-0002", "operator_info"),
    entry: v({ required: "in_season", needed_for: ["day"], unit: "person", channel: ["online"], cancel: { refund: "partial", until_hours: 48 } }, "src-0002", "operator_info"),
    links: official("https://roamtransit.com/fares/reservations/super-pass-reservations/", "src-0002"),
  }, "src-0002"),
  requirement("offer/place/kananaskis-country#conservation-pass", "access.pass.vehicle_permit", {
    at: ["place/kananaskis-country"], run_by: "operator/alberta-parks",
    price: v([{ amount: 15, currency: "CAD", per: "vehicle_day" }, { amount: 90, currency: "CAD", per: "vehicle", note: "annual, two plates" }], "src-0003"),
    window: v({ rule: "anytime", closes_days_before: 0, closes_time: "23:59", tz: "America/Edmonton" }, "src-0003"),
    entry: v({ required: "always", needed_for: ["day", "overnight_front", "overnight_back"], unit: "vehicle", channel: ["online", "phone", "visitor_centre"], proof: "plate_registered", exemptions: [{ who: "through_traffic" }] }, "src-0003"),
    links: official("https://www.alberta.ca/kananaskis-conservation-pass", "src-0003"),
  }, "src-0003"),
  requirement("offer/place/yoho-national-park#lake-ohara-day-use-bus", "access.pass.shuttle_seat", {
    at: [OHARA], run_by: "operator/parks-canada",
    season: v([{ from: "06-19", to: "10-04", status: "open", applies_to: "2026" }], "src-0004"),
    window: v({ rule: "lottery", opens_from: "03-01", opens_to: "03-21", opens_time: "08:00", tz: "America/Edmonton", then: { rule: "rolling", closes_days_before: 1, closes_time: "15:30", share_pct: 100 } }, "src-0004"),
    entry: v({ required: "in_season", needed_for: ["day"], unit: "person", channel: ["online"], quota: { per: "day" }, change: { allowed: "no" } }, "src-0004"),
    links: official("https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/ohara/visit", "src-0004"),
  }, "src-0004"),
];

/** The D8-R frontcountry campsite, a lodging offer at Banff NP with a launch day and its month band (stay contract: PA-3C). */
export const D8R_CAMPSITE = {
  ref: "offer/place/banff-national-park#frontcountry-campsite", type: "stay.camp.campground", layer: "offer", name: "Frontcountry campsite",
  summary: "A front-country campsite in Banff National Park, booked on the yearly launch day.", at: ["place/banff-national-park"], run_by: "operator/parks-canada",
  price: v([{ amount: 33, currency: "CAD", per: "night" }]),
  window: v({ rule: "fixed_date", opens_from: "01-15", opens_to: "02-28", opens_time: "08:00", tz: "America/Edmonton" }),
  check_in_out: v({ check_in: "14:00", check_out: "11:00" }),
  links: official("https://parks.canada.ca/voyage-travel/admission"),
};

export function parksRoot(opts: { pinned?: string[]; known?: unknown[]; extra?: Record<string, unknown>; locations?: unknown } = {}): string {
  return scratchRoot({
    "data/suitability/scope.json": scope(PLACES),
    "legacy/canadian-rockies-sept-2029/data/sights.json": [{ id: "moraine-lake" }],
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-26", operators: OPERATORS },
    "data/locations/locations.json": opts.locations ?? LOCATIONS,
    "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-26", strict: [], counts: {}, raised: [], ...(opts.known ? { known: opts.known } : {}), pinned: { on: "2026-10-21", note: "", refs: opts.pinned ?? PLACE_RECORDS.map((p) => p.ref) } },
    ...(opts.extra ?? {}),
  });
}

/** Validate a document as a lane file in the store (a new record errors). */
export const inLane = (root: string, doc: unknown, lane = LANE) => validateDoc(doc, "sidecar", root, { kind: "capture" }, join(root, lane));
export const doc = (records: unknown[]) => capDoc(records, { sources: SOURCES });
export const codesOf = (list: { code: string }[]) => [...new Set(list.map((e) => e.code))].sort();
export const at = (list: { code: string; path: string }[], code: string) => list.filter((e) => e.code === code).map((e) => e.path);
