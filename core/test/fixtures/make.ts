// Regenerates every fixture under core/test/fixtures/{root,valid,broken}:
//   node core/test/fixtures/make.ts
// The files are committed. Edit this script, regenerate, and review the diff.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tableToJsonSchema } from "../../src/schema/export.ts";
import { legId } from "../../src/validate/catalog.ts";
import { tableOf } from "../../src/schema/index.ts";
import { TRIP_TABLES } from "../../src/schema/trip.ts";
import { LOCATION_TABLES } from "../../src/schema/locations.ts";
import type { Family, Table } from "../../src/schema/meta.ts";

type Row = Record<string, any>;
const HERE = dirname(fileURLToPath(import.meta.url));

// ----------------------------------------------------------------------------- defaults
function enumValues(prop: any): any[] | null {
  if (Array.isArray(prop.enum)) return prop.enum;
  if (Array.isArray(prop.anyOf)) for (const b of prop.anyOf) if (Array.isArray(b.enum)) return b.enum;
  return null;
}

const GENERIC = ["", "x", 0, 1, false, [], {}, "2027-01-01", "2027-01-01T00:00:00Z", "09:00", "America/Toronto", "CAD", "CA"];

/** a full row with every column present and valid by construction, then `over` applied */
function row(t: Table, over: Row = {}): Row {
  const props = tableToJsonSchema(t).properties as Record<string, any>;
  const out: Row = {};
  for (const [col, schema] of Object.entries(t.shape)) {
    if (col in over) continue;
    if (schema.safeParse(null).success) {
      out[col] = null;
      continue;
    }
    const en = enumValues(props[col]);
    const candidates = en ?? GENERIC;
    const pick = candidates.find((c) => schema.safeParse(c).success);
    if (pick === undefined) throw new Error(`no default for ${t.key}.${col}; pass it in the fixture`);
    out[col] = pick;
  }
  for (const k of Object.keys(over)) if (!(k in t.shape)) throw new Error(`${t.key} has no column ${k}`);
  return { ...out, ...over };
}

const tr = (name: string, over: Row = {}) => row(tableOf("trip", name), over);
const loc = (name: string, over: Row = {}) => row(tableOf("locations", name), over);
const cat = (name: string, over: Row = {}) => row(tableOf("catalog", name), over);

// ----------------------------------------------------------------------------- writing
function serialize(doc: Row): string {
  const lines = ["{"];
  const keys = Object.keys(doc);
  keys.forEach((k, i) => {
    const comma = i < keys.length - 1 ? "," : "";
    const v = doc[k];
    if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object")) {
      lines.push(`${JSON.stringify(k)}: [`);
      v.forEach((r, j) => lines.push(JSON.stringify(r) + (j < v.length - 1 ? "," : "")));
      lines.push(`]${comma}`);
    } else lines.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
  });
  lines.push("}");
  return lines.join("\n") + "\n";
}

function write(rel: string, doc: Row | string): void {
  const path = join(HERE, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof doc === "string" ? doc : serialize(doc));
}

// ----------------------------------------------------------------------------- root: locations
const places = {
  chalten: "AR/santa-cruz/el-chalten/el-chalten",
  ushuaia: "AR/tierra-del-fuego/ushuaia/ushuaia",
  niagara: "CA/ON/niagara/niagara-falls",
};
const TAGS = ["adventure", "active-nature", "scenic-relaxed", "luxury-relax", "relax", "city-culture", "road-trip", "mixed", "hiking", "waterfall", "glaciers", "penguins"];

function locationsStore(): Row {
  const place = (id: string, area: string, name: string, kind: string, lat: number, lon: number): Row =>
    loc("places", { id, area_id: area, name, resolved_name: name, kind, status: "idea", trip: null, lat, lon, elevation_m: null,
      location_status: "resolved", resolver: "manual", wikidata: null, image: null, season_months: [2, 3, 8], kid_fit: "yes",
      stats: {}, stats_verified: false, notes: "", added: "2026-10-17" });
  return {
    schema_version: 2,
    updated: "2026-10-17",
    layout: "single",
    countries: [
      loc("countries", { code: "AR", a3: "ARG", name: "Argentina" }),
      loc("countries", { code: "CA", a3: "CAN", name: "Canada" }),
      loc("countries", { code: "US", a3: "USA", name: "United States" }),
    ],
    regions: [
      loc("regions", { id: "AR/santa-cruz", country: "AR", code: "santa-cruz", name: "Santa Cruz", iso_3166_2: null }),
      loc("regions", { id: "AR/tierra-del-fuego", country: "AR", code: "tierra-del-fuego", name: "Tierra del Fuego", iso_3166_2: null }),
      loc("regions", { id: "CA/ON", country: "CA", code: "ON", name: "Ontario", iso_3166_2: "CA-ON" }),
      loc("regions", { id: "CA/QC", country: "CA", code: "QC", name: "Quebec", iso_3166_2: "CA-QC" }),
    ],
    areas: [
      loc("areas", { id: "AR/santa-cruz/el-chalten", region_id: "AR/santa-cruz", slug: "el-chalten", name: "El Chalten" }),
      loc("areas", { id: "AR/tierra-del-fuego/ushuaia", region_id: "AR/tierra-del-fuego", slug: "ushuaia", name: "Ushuaia" }),
      loc("areas", { id: "CA/ON/niagara", region_id: "CA/ON", slug: "niagara", name: "Niagara" }),
    ],
    places: [
      place(places.chalten, "AR/santa-cruz/el-chalten", "El Chalten", "town", -49.3315, -72.8863),
      place(places.ushuaia, "AR/tierra-del-fuego/ushuaia", "Ushuaia", "city", -54.8019, -68.303),
      place(places.niagara, "CA/ON/niagara", "Niagara Falls", "waterfall", 43.0896, -79.0849),
    ],
    place_tags: [loc("place_tags", { place_id: places.niagara, tag_id: "waterfall" })],
    tags: TAGS.map((id) => loc("tags", { id, label: id, alias_of: null })).concat([loc("tags", { id: "waterfalls", label: "Waterfalls", alias_of: "waterfall" })]),
    sources: [loc("sources", { id: "src-00001", place_id: places.niagara, collection_id: null, type: "note", url: null, note: "fixture", screenshot: null, post_date: null, saved: "2026-10-17" })],
    visits: [],
    collections: [],
    collection_places: [],
  };
}

// ----------------------------------------------------------------------------- catalog
const A = "AR/santa-cruz/el-chalten";
const trailIds = {
  tres: `${A}/laguna-de-los-tres`,
  capri: `${A}/laguna-capri-mirador-fitz-roy`,
  salto: `${A}/chorrillo-del-salto`,
  rim: "CA/ON/niagara/niagara-gorge-rim-trail",
};
const ids = {
  piratour: "AR/tierra-del-fuego/ushuaia/piratour-harberton",
  journey: "CA/ON/niagara/journey-behind-the-falls",
  stay: `${A}/hosteria-fixture`,
  cafe: `${A}/cafe-fixture`,
  lunch: "CA/ON/niagara/lunch-fixture",
  offer: "of-piratour-harberton-martillo",
  offerCA: "of-niagara-journey-behind-the-falls",
};

function source(id: string, over: Row = {}): Row {
  return cat("sources", { id, url: "https://example.org/fixture", title: "Fixture source", publisher: "Example", kind: "official", read: "2026-10-13", ...over });
}

function common(over: Row): Row {
  return { sources: ["src-0001"], field_meta: {}, contributed_by: ["agent:fixture"], merged_from: [], updated: "2026-10-17", tags: [], season_months: [], ...over };
}

function catalogFile(country: string, entityTables: Record<string, Row[]>, sources: Row[]): Row {
  return { schema_version: 1, country, ...entityTables, sources };
}

function trail(id: string, name: string, extra: Row = {}): Row {
  return cat("trails", common({ id, area_id: id.startsWith("CA") ? "CA/ON/niagara" : A, name, house_grade: 3, kid_fit: "yes", trailhead_lat: -49.3226, trailhead_lon: -72.8889, hazards: [], notes: "", ...extra }));
}

function rootCatalog(): Record<string, Row> {
  const s = [source("src-0001")];
  return {
    "trails/AR.json": catalogFile("AR", { trails: [
      trail(trailIds.tres, "Laguna de los Tres", { km: 21.5, gain_m: 950, house_grade: 4, shape: "out-and-back", place_id: places.chalten }),
      trail(trailIds.capri, "Laguna Capri and Mirador Fitz Roy", { km: 11.7, gain_m: 390 }),
      trail(trailIds.salto, "Chorrillo del Salto", { km: 2, gain_m: 60, house_grade: 1 }),
    ] }, s),
    "trails/CA.json": catalogFile("CA", { trails: [trail(trailIds.rim, "Niagara Gorge Rim Trail", { km: 5, gain_m: 20, house_grade: 1, trailhead_lat: 43.1, trailhead_lon: -79.06 })] }, s),
    "activities/AR.json": catalogFile("AR", { activities: [cat("activities", common({ id: ids.piratour, area_id: "AR/tierra-del-fuego/ushuaia", name: "Harberton estancia boat tour", type: "boat-tour", operator: "Piratour", place_id: places.ushuaia, indoor: false, weather_sensitive: true, adventure_level: 2, notes: "" }))] }, s),
    "activities/CA.json": catalogFile("CA", { activities: [cat("activities", common({ id: ids.journey, area_id: "CA/ON/niagara", name: "Journey Behind the Falls", type: "gondola", operator: "Niagara Parks", place_id: places.niagara, indoor: false, weather_sensitive: false, notes: "" }))] }, s),
    "stays/AR.json": catalogFile("AR", { stays: [cat("stays", common({ id: ids.stay, area_id: A, name: "Hosteria Fixture", lat: -49.33, lon: -72.89, kind: "lodge", car_free_access: true, notes: "" }))] }, s),
    "eateries/AR.json": catalogFile("AR", { eateries: [cat("eateries", common({ id: ids.cafe, area_id: A, name: "Cafe Fixture", lat: -49.331, lon: -72.886, hours: { "1": [["08:00", "20:00"]] }, notes: "" }))] }, s),
    "eateries/CA.json": catalogFile("CA", { eateries: [cat("eateries", common({ id: ids.lunch, area_id: "CA/ON/niagara", name: "Lunch Fixture", lat: 43.09, lon: -79.08, hours: {}, notes: "" }))] }, s),
    "offers/AR.json": catalogFile("AR", {
      offers: [cat("offers", common({ id: ids.offer, area_id: "AR/tierra-del-fuego/ushuaia", name: "Piratour Harberton and Martillo", subject_entity: "activity", subject_id: ids.piratour, category: "tour", provider: "Piratour", book_url: "https://example.org/piratour", reseller_urls: [], limits_status: "gap", opens_kind: "rolling-lead", opens_lead_days: 120, sellout_kind: "weeks", sellout_lead_days: 30, same_day: "no", notes: "" }))],
      offer_prices: [cat("offer_prices", { id: `${ids.offer}#1`, offer_id: ids.offer, amount: 140, currency: "USD", per: "adult", valid_months: [], read: "2026-10-13", source_id: "src-0001" })],
    }, s),
    "offers/CA.json": catalogFile("CA", {
      offers: [cat("offers", common({ id: ids.offerCA, area_id: "CA/ON/niagara", name: "Journey Behind the Falls ticket", subject_entity: "activity", subject_id: ids.journey, category: "timed-entry", provider: "Niagara Parks", book_url: "https://example.org/niagara", reseller_urls: [], limits_status: "none-stated", opens_kind: "always-open", sellout_kind: "never", same_day: "yes", notes: "" }))],
      offer_prices: [],
    }, s),
    "legs/CA.json": catalogFile("CA", { legs: [cat("legs", { id: legId(places.niagara, ids.journey, "walk"), from_id: places.niagara, to_id: ids.journey, mode: "walk", km: 0.5, minutes: 8, basis: "estimate", seasonal_notes: "", symmetric: true, sources: ["src-0001"], field_meta: {}, contributed_by: ["agent:fixture"], merged_from: [], updated: "2026-10-17" })] }, s),
    "areas/AR.json": catalogFile("AR", { area_guides: [cat("area_guides", { id: A, summary: "A fixture guide.", best_months: [2, 3], getting_there: "", hidden_gems: [{ place_id: places.chalten, line: "Walk up at dawn." }], what_to_know: "", safety: "", sources: ["src-0001"], field_meta: {}, contributed_by: ["agent:fixture"], merged_from: [], updated: "2026-10-17" })] }, s),
  };
}

// valid/ catalog files: extra rows with their own ids and source ids, one file per entity
function validCatalog(): Record<string, Row> {
  const s = [source("src-0101")];
  const own = (o: Row) => ({ ...o, sources: ["src-0101"] });
  return {
    "catalog-trails.json": catalogFile("AR", { trails: [own(trail(`${A}/cerro-torre-mirador`, "Cerro Torre mirador", { km: 18, gain_m: 300, house_grade: 3 }))] }, s),
    "catalog-activities.json": catalogFile("AR", { activities: [own(cat("activities", common({ id: "AR/santa-cruz/el-chalten/glacier-trek", area_id: A, name: "Glacier trek", type: "glacier-walk", indoor: false, weather_sensitive: true, adventure_level: 4, notes: "", operator: null })))] }, s),
    "catalog-stays.json": catalogFile("AR", { stays: [own(cat("stays", common({ id: `${A}/camp-fixture`, area_id: A, name: "Camp Fixture", lat: -49.34, lon: -72.9, kind: "campsite", car_free_access: true, notes: "" })))] }, s),
    "catalog-eateries.json": catalogFile("AR", { eateries: [own(cat("eateries", common({ id: `${A}/bakery-fixture`, area_id: A, name: "Bakery Fixture", lat: -49.332, lon: -72.887, hours: {}, notes: "" })))] }, s),
    "catalog-offers.json": catalogFile("AR", {
      offers: [own(cat("offers", common({ id: "of-fixture-glacier-trek", area_id: A, name: "Glacier trek ticket", subject_entity: "activity", subject_id: "AR/santa-cruz/el-chalten/glacier-trek", category: "activity", provider: "Fixture Tours", reseller_urls: [], limits_status: "gap", opens_kind: "rolling-lead", opens_lead_days: 5, sellout_kind: "unknown", same_day: "unknown", notes: "" })))],
      offer_prices: [cat("offer_prices", { id: "of-fixture-glacier-trek#1", offer_id: "of-fixture-glacier-trek", amount: 200, currency: "ARS", per: "person", valid_months: [], read: "2026-10-13", source_id: "src-0101" })],
    }, s),
    "catalog-legs.json": catalogFile("AR", { legs: [cat("legs", { id: legId(places.chalten, places.ushuaia, "flight"), from_id: places.chalten, to_id: places.ushuaia, mode: "flight", km: 1500, minutes: 210, basis: "timetable", seasonal_notes: "", symmetric: true, sources: ["src-0101"], field_meta: {}, contributed_by: ["agent:fixture"], merged_from: [], updated: "2026-10-17" })] }, s),
    "catalog-areas.json": catalogFile("AR", { area_guides: [cat("area_guides", { id: "AR/tierra-del-fuego/ushuaia", summary: "Ushuaia fixture guide.", best_months: [1, 2], getting_there: "", hidden_gems: [], what_to_know: "", safety: "", sources: ["src-0101"], field_meta: {}, contributed_by: ["agent:fixture"], merged_from: [], updated: "2026-10-17" })] }, s),
  };
}

// ----------------------------------------------------------------------------- trips
function emptyTrip(slug: string): Row {
  const doc: Row = { schema_version: 1, id: slug, updated: "2026-10-17" };
  for (const t of TRIP_TABLES) doc[t.name] = t.meta.single ? null : [];
  return doc;
}

function itemRow(id: string, day: number, track: string | null, seq: number, over: Row): Row {
  return tr("items", { id, day, track, seq, duration_min: 30, title: "item", leg_notes: "", closed_weekdays: [], needs_daylight: false, notes: "", links: [], optional: false, pinned: false, ...over });
}

function dayRow(n: number, title: string, kind: string, base: string | null, over: Row = {}): Row {
  return tr("days", { n, title, kind, base_id: base, summary: title, decision_rules: [], plan_b_title: "", day_of_links: [], accepted_warnings: [], ...over });
}

function patagonia(): Row {
  const d = emptyTrip("patagonia-fixture");
  d.trip = tr("trip", { slug: "patagonia-fixture", title: "Argentine Patagonia (fixture)", subtitle: "Ten days, three bases", status: "planned", primary_style: "adventure", duration_shape: "week", movement_shape: "multi-base", party_shape: "family-teen", countries: ["AR"], region_label: "Patagonia, Argentina", season_months: [2, 3], season_note: "Late summer", nights: 9, origin: "Toronto (YYZ)", origin_tz: "America/Toronto", base_currency: "CAD", theme: "alpine-snow", web_published: false, visibility: "private", owner_id: "u_owner", shared_with: [], created: "2026-10-17" });
  d.profile = tr("profile", { pace: 3, budget_target_amount: 12000, budget_target_currency: "CAD", must_do: [{ text: "Laguna de los Tres", ref: trailIds.tres }], avoid: [], weather_wind_gust_kmh: 50, transport: ["domestic-flight", "bus"], daily_max_drive_min: 240, break_every_min: 120, kids_mode: "teen", early_starts: "sometimes", night_driving: false, lanes_extra: [], lanes_skip: [], notes: "" });
  d.travellers = [
    tr("travellers", { id: "t1", label: "Adult 1", role: "adult", age_years: 45, age_as_of: "2026-10-17", height_cm: 175, weight_kg: 78, fitness: 4, citizenship: ["CA"], notes: "" }),
    tr("travellers", { id: "t2", label: "Adult 2", role: "adult", citizenship: ["CA"], notes: "" }),
    tr("travellers", { id: "t3", label: "Child (13)", role: "child", age_years: 13, age_as_of: "2026-10-17", height_cm: 160, citizenship: ["CA"], notes: "" }),
  ];
  d.trip_tags = ["adventure", "hiking", "glaciers"].map((tag_id) => tr("trip_tags", { tag_id }));
  d.editions = [tr("editions", { id: "e2027", label: "Feb-Mar 2027", year: 2027, start: "2027-02-26", end: "2027-03-07", status: "chosen", why: "Penguins a week earlier, walking ramps up", fare_window_id: "fw-2027" })];
  d.bases = [
    tr("bases", { id: "ushuaia", name: "Ushuaia", place_id: places.ushuaia, night_from: 1, nights: 2, tz: "America/Argentina/Ushuaia", why: "Beagle Channel and Harberton", why_not: "" }),
    tr("bases", { id: "el-chalten", name: "El Chalten", place_id: places.chalten, stay_id: ids.stay, night_from: 3, nights: 6, tz: "America/Argentina/Rio_Gallegos", elevation_m: 400, why: "Fitz Roy trailheads from the door", why_not: "" }),
    tr("bases", { id: "el-calafate", name: "El Calafate", lodging: "Hotel near the airport", night_from: 9, nights: 1, lat: -50.34, lon: -72.26, tz: "America/Argentina/Rio_Gallegos", why: "Last domestic flight leaves from here", why_not: "" }),
  ];
  const bases = ["ushuaia", "ushuaia", "el-chalten", "el-chalten", "el-chalten", "el-chalten", "el-chalten", "el-chalten", "el-calafate", null];
  d.days = bases.map((b, i) => dayRow(i + 1, i === 7 ? "Laguna de los Tres" : `Day ${i + 1}`, i === 7 ? "hike" : "mixed", b,
    i === 7 ? { prose: "prose/day-08.md", flexible_group: "chalten-weather", decision_rules: ["At Poincenot camp by 11:00, otherwise everyone turns back via Laguna Capri"], plan_b_title: "Wind over 50 km/h or cloud on Fitz Roy", plan_b_text: "Swap with Day 9 or walk Chorrillo del Salto", sun_note: "Sunrise 07:28", day_of_links: [{ label: "Chalten wind forecast", url: "https://www.windy.com/-49.33/-72.89", kind: "forecast" }], accepted_warnings: ["W_PACE"] } : {}));
  d.day_tracks = [
    tr("day_tracks", { day: 8, track: "A", audience: "adult-only", title: "Laguna de los Tres", notes: "One adult and a strong teen", split: true }),
    tr("day_tracks", { day: 8, track: "B", audience: "family", title: "Laguna Capri loop", notes: "", split: true }),
    tr("day_tracks", { day: 8, track: "C", audience: "less-walking", title: "Mirador de los Condores", notes: "", split: true }),
    tr("day_tracks", { day: 8, track: "P", audience: "plan-b", title: "Chorrillo del Salto", notes: "", split: false }),
  ];
  d.items = [
    itemRow("d01-i01", 1, null, 1, { type: "flight", title: "Fly to Ushuaia", start: "09:00", duration_min: 240, leg_mode: "flight", leg_basis: "timetable" }),
    itemRow("d03-i01", 3, null, 1, { type: "activity", title: "Harberton and Martillo boat tour", start: "08:00", duration_min: 480, activity_id: ids.piratour, booking_id: "bk-piratour", place_id: places.ushuaia, lat: -54.8019, lon: -68.303, needs_daylight: true }),
    itemRow("d08-i01", 8, null, 1, { type: "meal", title: "Breakfast and packed lunch", start: "06:30", base_id: "el-chalten", leg_mode: "none" }),
    itemRow("d08-i09", 8, null, 2, { type: "meal", title: "Dinner together", start: "19:30", duration_min: 90, lat: -49.3315, lon: -72.8863, address: "El Chalten centre", leg_mode: "walk", leg_km: 0.5, leg_minutes: 8, leg_basis: "inference", cost_amount: 30, cost_currency: "USD", cost_per: "person", open_from: "19:00", open_to: "23:00" }),
    itemRow("d08-i02", 8, "A", 1, { type: "trail", title: "Laguna de los Tres and back", start: "07:15", duration_min: 540, trail_id: trailIds.tres, booking_id: "bk-glaciares-flexipass", lat: -49.3226, lon: -72.8889, address: "Trailhead at the north end of Av. San Martin", leg_mode: "walk", leg_km: 0.8, leg_minutes: 12, leg_basis: "inference", needs_daylight: true, plan_b_item_id: "d08-p01", notes: "21.5 km, about 950 m" }),
    itemRow("d08-i02b", 8, "B", 1, { type: "trail", title: "Laguna Capri and Mirador Fitz Roy loop", start: "08:30", duration_min: 270, trail_id: trailIds.capri, booking_id: "bk-glaciares-flexipass", lat: -49.3226, lon: -72.8889, leg_mode: "walk", leg_km: 0.8, leg_minutes: 12, leg_basis: "inference", needs_daylight: true, plan_b_item_id: "d08-p01", notes: "11.7 km, 390 m" }),
    itemRow("d08-i03b", 8, "B", 2, { type: "rest", title: "Back in town: cafe, rest", start: "14:00", duration_min: 120, eatery_id: ids.cafe, lat: -49.331, lon: -72.886, leg_mode: "walk", leg_km: 0.8, leg_minutes: 12, leg_basis: "inference" }),
    itemRow("d08-p01", 8, "P", 1, { type: "trail", title: "Chorrillo del Salto", start: "10:00", duration_min: 180, trail_id: trailIds.salto, leg_mode: "walk", leg_km: 1, leg_minutes: 15, leg_basis: "inference", needs_daylight: true }),
    itemRow("d10-i01", 10, null, 1, { type: "checkout", title: "Check out and fly home", start: "07:00", base_id: "el-calafate", leg_mode: "none" }),
  ];
  d.trip_trails = [
    tr("trip_trails", { trail_id: trailIds.tres, role: "track-a", turnaround_rule: "Poincenot camp by 11:00", party_note: "", kid_fit: "strong-kid", verdict: "Strong teen only" }),
    tr("trip_trails", { trail_id: trailIds.capri, role: "track-b", party_note: "", kid_fit: "yes", verdict: "Family loop" }),
    tr("trip_trails", { trail_id: trailIds.salto, role: "optional", alternative_of: trailIds.tres, party_note: "", kid_fit: "yes", verdict: "Plan B" }),
  ];
  d.trip_activities = [tr("trip_activities", { activity_id: ids.piratour, day: 3, verdict: "in", why: "Penguins at Martillo", offer_id: ids.offer })];
  d.trip_bookings = [
    tr("trip_bookings", { id: "bk-piratour", offer_id: ids.offer, used_days: [3], book_by_offset: -88, book_by_basis: "computed", priority: "must", status: "todo", found_by: "research-activities", notes: "", src: ["src-0001"] }),
    tr("trip_bookings", { id: "bk-glaciares-flexipass", item: "Glaciares flexi pass", category: "permit", used_days: [8], book_by_basis: "inference", priority: "should", status: "booked", price_paid_amount: 80, price_paid_currency: "USD", confirmation: "ABC123", contact: "ops@example.org", found_by: "owner", notes: "", src: [] }),
    tr("trip_bookings", { id: "bk-chalten-lodging", item: "Hosteria Fixture", category: "lodging", base_id: "el-chalten", used_days: [3, 4, 5, 6, 7, 8], book_by_basis: "inference", edition_id: "e2027", priority: "urgent", status: "held", found_by: "owner", notes: "", src: [] }),
  ];
  d.custom_items = [tr("custom_items", { id: "cx-fuel-stop", name: "Fuel stop", kind: "fuel", notes: "", proposed: "no" })];
  d.notes = [tr("notes", { id: "n1", scope: "trip", text: "Check wind before committing to Day 8.", visibility: "private", links: [], attachments: [], author: "u_owner", created: "2026-10-17T12:00:00Z", updated: "2026-10-17T12:00:00Z" })];
  d.routes = [tr("routes", { id: "r1", days: [10], waypoints: ["d10-i01", { lat: -50.34, lon: -72.26 }], profile: "car", break_every_min: 120, daily_max_drive_min: 240, corridor_km: 5, break_types: ["viewpoint"], avoid: [] })];
  d.hazards = [tr("hazards", { id: "h-wind", category: "wind", title: "Wind on the lake shore", text: "Gusts over 50 km/h are common.", severity: 2, days: [8], trail_ids: [trailIds.tres], place_ids: [places.chalten], mitigation: "Plan B on Day 8", src: ["src-0001"] })];
  d.weather_rules = [tr("weather_rules", { id: "wr-08", day: 8, metric: "gust_kmh", op: ">", value: 50, at: "06:00", action: "Do Plan B or swap with Day 9", plan_b_day: 9 })];
  d.budget = [tr("budget", { id: "b-flights", category: "getting-there", item: "Flights", currency: "CAD", per_person_amount: 1800, group_low_amount: 5000, group_high_amount: 6000, basis: "fare-read", read_date: "2026-10-13", fare_window_id: "fw-2027", src: ["src-0002"] })];
  d.fx = [tr("fx", { currency: "USD", rate_to_base: 1.37, as_of: "2026-10-13", source: "frankfurter" })];
  d.fare_windows = [tr("fare_windows", { id: "fw-2027", label: "Feb-Mar 2027", depart: "2027-02-25", return: "2027-03-08", nights_away: 11, party: { adults: 2, children: [13] }, school_break: false, notes: "" })];
  d.fare_quotes = [tr("fare_quotes", { id: "fq-1", window_id: "fw-2027", kind: "flight-intl", leg: "YYZ-EZE", date_from: "2027-02-25", date_to: "2027-03-08", total_amount: 5400, total_currency: "CAD", provider: "Air Canada", method: "manual", read_at: "2026-10-13T10:00:00Z", filters: "", confidence: "stated", notes: "" })];
  d.documents = [tr("documents", { id: "doc-passport", item: "passport-validity", applies_to: "all", rule: "Valid 6 months after return", status: "todo", src: [] })];
  d.emergency = [tr("emergency", { base_id: "el-chalten", number: "107", hospital_name: "Hospital Fixture", hospital_lat: -49.33, hospital_lon: -72.89, insurer_tel: "+1-555-0100", src: ["src-0001"] })];
  d.packing = [tr("packing", { id: "p1", item: "Windproof shell", reason: "cold", qty: 1 })];
  d.knowledge = [tr("knowledge", { id: "k1", claim: "Gusts above 50 km/h close the lake shore path.", status: "inference", src: ["src-0001"] })];
  d.questions = [tr("questions", { id: "q1", text: "Does Piratour take children under 8?", status: "open", asked: "2026-10-13" })];
  d.gotchas = [tr("gotchas", { id: "g1", text: "Cash only at the trailhead kiosk.", src: [] })];
  d.research_refs = [tr("research_refs", { id: "rr-1", path: "research/trips/patagonia-fixture/trails.md", sidecar: "research/trips/patagonia-fixture/trails.json", lane: "trails", title: "Trails lane", added: "2026-10-13", sha256: TRAILS_MD_SHA })];
  d.sources = [
    tr("sources", { id: "src-0001", url: "https://example.org/fixture", title: "Fixture source", publisher: "Example", kind: "official", checked: "2026-10-13", research_ref: "rr-1" }),
    tr("sources", { id: "src-0002", url: "https://example.org/fares", title: "Fare read", publisher: "Example", kind: "reseller", checked: "2026-10-13" }),
  ];
  d.changelog = [tr("changelog", { seq: 1, at: "2026-10-17T12:00:00Z", actor_id: "u_owner", actor_via: "import", op: "trip.create", summary: "Fixture created", refs: [] })];
  return d;
}

function quebec(): Row {
  const d = emptyTrip("quebec-roadtrip-fixture");
  d.trip = tr("trip", { slug: "quebec-roadtrip-fixture", title: "Quebec to Vermont (fixture)", subtitle: "Road-trip day with a border crossing", status: "planned", primary_style: "road-trip", duration_shape: "short-break", movement_shape: "road-trip", party_shape: "couple", countries: ["CA", "US"], region_label: "Quebec and Vermont", season_months: [9, 10], season_note: "", nights: 3, origin: "Whitby, ON", origin_tz: "America/Toronto", base_currency: "CAD", web_published: false, visibility: "private", owner_id: "u_owner", shared_with: [], created: "2026-10-17" });
  d.profile = tr("profile", { pace: 2, transport: ["own-car"], must_do: [], avoid: [], daily_max_drive_min: 240, break_every_min: 120, kids_mode: "none", night_driving: false, lanes_extra: [], lanes_skip: [], notes: "" });
  d.travellers = [tr("travellers", { id: "t1", label: "Adult 1", role: "adult", citizenship: [], notes: "" })];
  d.trip_tags = [tr("trip_tags", { tag_id: "road-trip" })];
  d.bases = [
    tr("bases", { id: "ile-d-orleans", name: "Ile d'Orleans", night_from: 1, nights: 2, lat: 46.9, lon: -70.9, tz: "America/Toronto", why: "Two nights on the island", why_not: "" }),
    tr("bases", { id: "hyde-park", name: "Hyde Park, VT", night_from: 3, nights: 1, lat: 44.594, lon: -72.616, tz: "America/New_York", why: "Night stop before Stowe", why_not: "" }),
  ];
  d.days = [dayRow(1, "Drive to the island", "travel", "ile-d-orleans"), dayRow(2, "Island day", "sightseeing", "ile-d-orleans"), dayRow(3, "Border and Vermont", "travel", "hyde-park"), dayRow(4, "Stowe and home", "travel", null)];
  d.items = [
    itemRow("d03-i01", 3, null, 1, { type: "checkout", title: "Check out", start: "08:30", duration_min: 15, base_id: "ile-d-orleans", leg_mode: "none" }),
    itemRow("d03-i02", 3, null, 2, { type: "transfer", title: "Border crossing at Stanstead / Derby Line", window_start: "11:15", window_end: "12:00", duration_min: 45, lat: 45.005, lon: -72.099, leg_mode: "drive", leg_km: 240, leg_minutes: 165, leg_basis: "matrix", leg_notes: "Fuel before the border; wait times on the CBSA page" }),
    itemRow("d03-i03", 3, null, 3, { type: "meal", title: "Lunch in Newport, VT", start: "12:30", duration_min: 60, lat: 44.936, lon: -72.205, leg_mode: "drive", leg_km: 15, leg_minutes: 20, leg_basis: "matrix" }),
    itemRow("d03-i04", 3, null, 4, { type: "checkin", title: "Check in, Hyde Park", start: "15:00", base_id: "hyde-park", lat: 44.594, lon: -72.616, leg_mode: "drive", leg_km: 75, leg_minutes: 70, leg_basis: "matrix", leg_notes: "Cell coverage patchy on VT-100 (GAP)" }),
    itemRow("d04-i01", 4, null, 1, { type: "checkout", title: "Check out", start: "09:00", base_id: "hyde-park", leg_mode: "none" }),
  ];
  d.changelog = [tr("changelog", { seq: 1, at: "2026-10-17T12:00:00Z", actor_id: "u_owner", actor_via: "cli", op: "trip.create", summary: "Fixture created", refs: [] })];
  return d;
}

function niagara(): Row {
  const d = emptyTrip("niagara-day-fixture");
  d.trip = tr("trip", { slug: "niagara-day-fixture", title: "Niagara day (fixture)", subtitle: "Falls and the gorge rim", status: "idea", primary_style: "scenic-relaxed", duration_shape: "day-trip", movement_shape: "single-base", party_shape: "couple", countries: ["CA"], region_label: "Niagara, Ontario", season_months: [8, 9], season_note: "Any Saturday in late summer", nights: 0, origin: "Whitby, ON", origin_tz: "America/Toronto", base_currency: "CAD", web_published: false, visibility: "unlisted", owner_id: "u_owner", shared_with: [], created: "2026-10-17" });
  d.profile = tr("profile", { pace: 2, transport: ["own-car"], must_do: [], avoid: [], daily_max_drive_min: 240, break_every_min: 120, kids_mode: "none", night_driving: false, lanes_extra: [], lanes_skip: [], notes: "" });
  d.travellers = [tr("travellers", { id: "t1", label: "Adult 1", role: "adult", citizenship: [], notes: "" })];
  d.trip_tags = [tr("trip_tags", { tag_id: "scenic-relaxed" })];
  d.days = [dayRow(1, "Niagara Falls and the gorge rim", "sightseeing", null)];
  d.items = [
    itemRow("d01-i01", 1, null, 1, { type: "transfer", title: "Drive to Niagara", start: "08:00", duration_min: 90, place_id: places.niagara, lat: 43.0896, lon: -79.0849, leg_mode: "drive", leg_km: 130, leg_minutes: 90, leg_basis: "estimate", leg_notes: "From Whitby; parking at the falls" }),
    itemRow("d01-i02", 1, null, 2, { type: "trail", title: "Gorge rim walk", start: "10:00", duration_min: 120, trail_id: trailIds.rim, lat: 43.1, lon: -79.06, leg_mode: "drive", leg_km: 5, leg_minutes: 12, leg_basis: "estimate", needs_daylight: true }),
    itemRow("d01-i03", 1, null, 3, { type: "meal", title: "Lunch", start: "12:30", duration_min: 60, eatery_id: ids.lunch, lat: 43.09, lon: -79.08, leg_mode: "drive", leg_km: 5, leg_minutes: 10, leg_basis: "estimate" }),
    itemRow("d01-i04", 1, null, 4, { type: "activity", title: "Journey Behind the Falls", start: "14:00", duration_min: 90, activity_id: ids.journey, lat: 43.0896, lon: -79.0849, leg_mode: "walk", leg_km: 0.5, leg_minutes: 8, leg_basis: "estimate" }),
    itemRow("d01-i05", 1, null, 5, { type: "transfer", title: "Drive home", start: "16:30", duration_min: 90, leg_mode: "drive", leg_km: 130, leg_minutes: 90, leg_basis: "estimate" }),
  ];
  d.changelog = [tr("changelog", { seq: 1, at: "2026-10-17T12:00:00Z", actor_id: "u_owner", actor_via: "cli", op: "trip.create", summary: "Fixture created", refs: [] })];
  return d;
}

// ----------------------------------------------------------------------------- research file and documents
const TRAILS_MD = "# Trails lane (fixture)\n\nLaguna de los Tres is 21.5 km with about 950 m of gain.\n";
const TRAILS_MD_SHA = createHash("sha256").update(TRAILS_MD).digest("hex");

function sidecar(): Row {
  return {
    schema: "research-sidecar/1", lane: "trails", subject: { kind: "trip", id: "patagonia-fixture" }, researched: "2026-10-13",
    agent: "research-trails", model: "fixture", md: "research/trips/patagonia-fixture/trails.md",
    geo: { countries: ["AR"], regions: ["AR/santa-cruz"], areas: [A] },
    trip_type: { duration_shape: "week", movement_shape: "multi-base", styles: ["adventure"] }, tags: ["hiking"],
    sources: [{ id: "src-0001", url: "https://example.org/fixture", title: "Fixture source", publisher: "Example", kind: "official", read: "2026-10-13" }],
    facts: [
      { key: "laguna-de-los-tres.km", value: 21.5, unit: "km", confidence: "stated", src: ["src-0001"], gap_reason: null, subject_ref: trailIds.tres },
      { key: "piratour.min_age", value: null, unit: null, confidence: "gap", src: [], gap_reason: "not stated on operator or resellers, checked 2026-10-13", subject_ref: null },
    ],
    records: { trails: [{ match: { name: "Laguna de los Tres" }, src: ["src-0001"], name: "Laguna de los Tres", km: 21.5, gain_m: 950 }] },
  };
}

function encodePolyline(points: [number, number][]): string {
  let out = "";
  let pLat = 0;
  let pLon = 0;
  const enc = (n: number): string => {
    let v = n < 0 ? ~(n << 1) : n << 1;
    let s = "";
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lat, lon] of points) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lon * 1e6);
    out += enc(la - pLat) + enc(lo - pLon);
    pLat = la;
    pLon = lo;
  }
  return out;
}

function routeGeometry(): Row {
  const pts: [number, number][] = [[51.0447, -114.0719], [51.1784, -115.5708], [51.4254, -116.1773]];
  return {
    schema: "route-geometry/1", polyline: encodePolyline(pts), precision: 6, t_s: [0, 4200, 6000], d_m: [0, 130000, 180000],
    flags: [{ from_vertex: 1, to_vertex: 2, kind: "pass", label: "Seasonal closures possible (fixture)", source: "hand" }],
    provider: "ors", profile: "driving-car", fetched: "2026-10-13", licence: "ODbL 1.0, route geometry derived from OpenStreetMap data via openrouteservice (fixture)",
  };
}

// ----------------------------------------------------------------------------- broken fixtures
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
const find = (rows: Row[], key: string, value: unknown): Row => {
  const r = rows.find((x) => x[key] === value);
  if (!r) throw new Error(`no row with ${key}=${String(value)}`);
  return r;
};

function brokenTrips(): Record<string, Row> {
  const base = patagonia();
  const out: Record<string, Row> = {};
  const m = (code: string, fn: (d: Row) => Row | void): void => {
    const d = clone(base);
    out[code] = fn(d) ?? d;
  };
  m("E_SCHEMA", (d) => { find(d.items, "id", "d08-i09").cost_amount = { amount: 30, currency: "USD" }; });
  m("E_KEY_ORDER", (d) => {
    const keys = Object.keys(d);
    const bi = keys.indexOf("bases");
    keys.splice(bi, 1);
    keys.splice(keys.indexOf("days") + 1, 0, "bases");
    const o: Row = {};
    for (const k of keys) o[k] = d[k];
    return o;
  });
  m("E_PK_DUP", (d) => { d.packing.push(tr("packing", { id: "p1", item: "Second row with the same id", reason: "rain", qty: 1 })); });
  m("E_FK", (d) => { find(d.items, "id", "d08-i02").trail_id = `${A}/does-not-exist`; });
  m("E_SRC", (d) => { find(d.knowledge, "id", "k1").src = ["src-9999"]; });
  m("E_DAYS_CONTIGUOUS", (d) => {
    d.days = d.days.filter((x: Row) => x.n !== 5);
    d.editions[0].end = "2027-03-06"; // nine days, so only the gap is wrong
  });
  m("E_SEQ_CONTIGUOUS", (d) => { find(d.items, "id", "d08-i03b").seq = 4; });
  m("E_BASE_COVER", (d) => {
    find(d.bases, "id", "el-chalten").nights = 5;
    d.trip.nights = 8; // keeps nights equal to the bases and the shape at "week"
  });
  m("E_NIGHTS_SUM", (d) => { d.trip.nights = 8; });
  m("E_DURATION_SHAPE", (d) => { d.trip.duration_shape = "multi-week"; });
  m("E_EDITION_LENGTH", (d) => { d.editions[0].end = "2027-03-08"; });
  m("E_EDITION_CHOSEN", (d) => {
    d.editions.push(tr("editions", { id: "e2028", label: "Feb-Mar 2028", year: 2028, start: "2028-02-25", end: "2028-03-05", status: "chosen", why: "Second choice", fare_window_id: null }));
  });
  m("E_STYLE_TAG", (d) => { d.trip_tags = d.trip_tags.filter((x: Row) => x.tag_id !== "adventure"); });
  m("E_ITEM_REF", (d) => { find(d.items, "id", "d08-i02").trail_id = null; });
  m("E_ITEM_TIME", (d) => { const i = find(d.items, "id", "d08-i01"); i.window_start = "06:00"; i.window_end = "07:00"; });
  m("E_PLAN_B", (d) => { find(d.items, "id", "d08-i02").plan_b_item_id = "d08-i02b"; });
  m("E_COST_PAIR", (d) => { find(d.items, "id", "d08-i09").cost_currency = null; });
  m("E_BOOKING_OFFER", (d) => { find(d.trip_bookings, "id", "bk-glaciares-flexipass").category = null; });
  m("E_TZ", (d) => { find(d.bases, "id", "ushuaia").tz = "Mars/Olympus_Mons"; });
  m("E_RESEARCH_PATH", (d) => { d.research_refs[0].path = "research/trips/patagonia-fixture/missing.md"; });
  m("E_SLUG", (d) => { d.id = "places"; d.trip.slug = "places"; });
  m("E_VISIBILITY", (d) => { d.trip.web_published = true; });
  return out;
}

function brokenCatalog(): Record<string, Row> {
  const v = validCatalog();
  const out: Record<string, Row> = {};
  const offers = clone(v["catalog-offers.json"]!);
  offers.offers[0].opens_lead_days = null;
  out.E_OFFER_WINDOW = offers;
  const trails = clone(v["catalog-trails.json"]!);
  trails.trails[0].id = `${A}/cerro__torre`;
  out.E_ID_ENCODING = trails;
  const legs = clone(v["catalog-legs.json"]!);
  legs.legs[0].id = "lg-0000000000";
  out.E_LEG_ID = legs;
  return out;
}

// ----------------------------------------------------------------------------- main
function clean(dir: string): void {
  rmSync(join(HERE, dir), { recursive: true, force: true });
}

function main(): void {
  for (const d of ["root", "valid", "broken"]) clean(d);
  write("root/data/locations/locations.json", locationsStore());
  for (const [rel, doc] of Object.entries(rootCatalog())) write(`root/data/catalog/${rel}`, doc);
  write("root/research/trips/patagonia-fixture/trails.md", TRAILS_MD);
  write("root/research/trips/patagonia-fixture/trails.json", sidecar());

  write("valid/niagara-day.json", niagara());
  write("valid/patagonia-multi-base.json", patagonia());
  write("valid/quebec-road-trip.json", quebec());
  for (const [name, doc] of Object.entries(validCatalog())) write(`valid/${name}`, doc);
  write("valid/documents/route-geometry.json", routeGeometry());
  write("valid/documents/research-sidecar.json", sidecar());

  const broken = { ...brokenTrips(), ...brokenCatalog() };
  for (const [code, doc] of Object.entries(broken)) {
    write(`broken/${code}.json`, doc);
    write(`broken/${code}.expect`, code + "\n");
  }
  const n = readdirSync(join(HERE, "broken")).filter((f) => f.endsWith(".json")).length;
  process.stdout.write(`wrote root, valid and ${n} broken fixtures\n`);
}

void LOCATION_TABLES;
void (null as unknown as Family);
main();
