// The property registry (capture contract CC6): every property a place, route or offer can carry, defined once.
//
// A property has a key, a group, a value type, a unit, a label, the wording for an honest gap, the page section that
// shows it, its display levels, its base mark (3.2) and, when it can split a result list, a filter role (section 7).
// `home` says where a value lives today, so the completeness engine knows where to read it: in the suitability block, in
// the relevance record, on the capture record, in the stored OSM tracks (data/tracks), or nowhere yet (then the property is always a gap and the page says
// "Not checked yet").
//
// What this file does NOT hold: which types need a property. That is data/vocab/types.json (marks per node). A new TYPE is
// a data entry; a new PROPERTY is a schema change, and starts here (CC6, 8.1 step 6).
//
// The suitability group is generated from the paths of core/src/suitability/paths.ts plus the label table below, so a
// new suitability field fails the registry test until it has a label (the same trick as the applicability file).
import type * as EnumsT from "../enums.ts";
import { APPLICABILITY_PATHS } from "../../suitability/paths.ts";

export type Mark = (typeof EnumsT.CAP_MARK)[number];
export type SectionId = (typeof EnumsT.CAP_SECTION)[number];
export type Display = "rest" | "rest!" | "card" | "detail" | "filter";
export type Group =
  | "identity" | "when" | "access" | "offer" | "relevance" | "safety" | "links" | "media" | "relations" | "type_facts"
  | "limits" | "suits" | "effort" | "time" | "facilities" | "water" | "participation" | "ext";

export type ValueType =
  | "text" | "enum" | "bool" | "number" | "range" | "duration" | "names" | "qid" | "point" | "ref" | "type_id"
  | "season_rows" | "hours" | "price_list" | "window" | "limit" | "grade" | "relation_list" | "link_list" | "photo_list"
  | "object" | "object_list" | "enum_list";

export type HomeIn = "suitability" | "relevance" | "capture" | "tracks" | "none";
export interface Home { in: HomeIn; path?: string }

export interface FilterDef {
  /** type ids (any depth) or intent names whose result lists get the facet */
  scopes: string[];
  control: "range" | "enum" | "bool";
  label: string;
  /** the derived list-row key it reads (7.3); absent when the facet reads a flag */
  band?: string;
  /** scope (a type id or intent) -> 1 or 2: the facet is promoted into the filter bar when the Kind narrows to that scope, in that order (7.2) */
  promote?: Record<string, 1 | 2>;
}

export interface PropertyDef {
  key: string;
  group: Group;
  label: string;
  value: ValueType;
  unit?: string;
  /** what the page says when every listed source was tried and found nothing (`searched_none`) */
  gap: string;
  section: SectionId;
  display: Display[];
  /** the base mark of 3.2 before layer, class and type deltas; N for a property whose marks come from a suitability profile */
  base: Mark;
  /** the named condition of an `R?` mark (core/src/capture/triggers.ts) */
  trigger?: string;
  home: Home;
  filter?: FilterDef;
  /** the record layers that can carry it; absent means all */
  layers?: ("place" | "route" | "offer" | "event")[];
}

const GAP_DEFAULT = "Not recorded";

interface Row {
  key: string; group: Group; label: string; value: ValueType; section: SectionId; display: Display[]; base: Mark;
  unit?: string; gap?: string; trigger?: string; home?: Home; filter?: FilterDef; layers?: PropertyDef["layers"];
}
const def = (r: Row): PropertyDef => ({
  key: r.key, group: r.group, label: r.label, value: r.value, ...(r.unit ? { unit: r.unit } : {}), gap: r.gap ?? GAP_DEFAULT,
  section: r.section, display: r.display, base: r.base, ...(r.trigger ? { trigger: r.trigger } : {}),
  home: r.home ?? { in: "none" }, ...(r.filter ? { filter: r.filter } : {}), ...(r.layers ? { layers: r.layers } : {}),
});
const cap = (field: string): Home => ({ in: "capture", path: field });
const rel = (field: string): Home => ({ in: "relevance", path: field });

// --------------------------------------------------------------------------------------------------------------------
// The base contract (3.2), plus the properties the per-type deltas of 3.5 name that no suitability field holds.
// --------------------------------------------------------------------------------------------------------------------
export const BASE_PROPERTIES: PropertyDef[] = [
  // Identity
  def({ key: "name", group: "identity", label: "Name", value: "text", section: "cover", display: ["rest", "card"], base: "R", gap: "Name not recorded yet", home: cap("name") }),
  def({ key: "names", group: "identity", label: "Names by language", value: "names", section: "cover", display: ["detail"], base: "A", gap: "Local name not recorded", home: cap("names") }),
  def({ key: "type", group: "identity", label: "Type", value: "type_id", section: "cover", display: ["rest", "card", "filter"], base: "R", gap: "Type not recorded yet", home: cap("type") }),
  def({ key: "point", group: "identity", label: "Location", value: "point", section: "access", display: ["rest"], base: "R", gap: "Location approximate", home: cap("point") }),
  def({ key: "area_id", group: "identity", label: "Area", value: "ref", section: "cover", display: ["rest", "card"], base: "R", home: cap("area_id") }),
  def({ key: "wikidata", group: "identity", label: "Wikidata", value: "qid", section: "sources", display: ["detail"], base: "R", gap: "Not linked to Wikidata yet", home: rel("wikidata") }),
  def({ key: "osm_ref", group: "identity", label: "OpenStreetMap", value: "text", section: "links", display: ["detail"], base: "A", gap: "Not linked to OpenStreetMap yet", home: cap("osm_ref") }),
  def({ key: "summary", group: "identity", label: "Summary", value: "text", section: "cover", display: ["rest", "card"], base: "R", gap: "Summary not written yet", home: rel("why") }),

  // When
  def({ key: "season", group: "when", label: "Operating season", value: "season_rows", section: "when", display: ["rest", "card", "filter"], base: "R?", trigger: "operates", gap: "Season not published; ask the operator", home: cap("season"), filter: { scopes: ["play", "snow", "intent:do"], control: "enum", label: "Season", band: "season_band" } }),
  def({ key: "best_window", group: "when", label: "Best weeks", value: "season_rows", section: "when", display: ["rest"], base: "A", gap: "Best weeks not recorded", home: cap("best_window") }),
  def({ key: "best_time", group: "when", label: "Best time of day", value: "object_list", section: "when", display: ["rest", "filter"], base: "A", gap: "Best time of day not recorded", home: cap("best_time"), filter: { scopes: ["nature.viewpoint", "nature.summit"], control: "enum", label: "Best time of day" } }),
  def({ key: "hours", group: "when", label: "Opening hours", value: "hours", section: "when", display: ["rest", "filter"], base: "R?", trigger: "operates", gap: "Hours not published; check before you go", home: cap("hours"), filter: { scopes: ["culture", "animals.see"], control: "enum", label: "Open on" } }),
  def({ key: "duration_min", group: "when", label: "Door-to-door time", value: "range", unit: "min", section: "options", display: ["rest", "card", "filter"], base: "N", gap: "Time not published; our estimate", layers: ["offer"], filter: { scopes: ["intent:do"], control: "range", label: "Duration", promote: { "intent:do": 2 }, band: "time_band" } }),
  def({ key: "activity_min", group: "when", label: "Time on the activity", value: "range", unit: "min", section: "options", display: ["detail"], base: "N", layers: ["offer"] }),
  def({ key: "check_in_out", group: "when", label: "Check-in and check-out", value: "object", section: "options", display: ["rest"], base: "N", layers: ["offer"] }),

  // Access
  def({ key: "access_points", group: "access", label: "Trailhead and parking", value: "relation_list", section: "access", display: ["rest"], base: "R?", trigger: "no_door_access", gap: "Parking or stop not recorded", home: { in: "none" } }),
  def({ key: "transit", group: "access", label: "Public transport", value: "relation_list", section: "access", display: ["detail"], base: "A", gap: "Public transport not checked yet" }),
  def({ key: "access_cost", group: "access", label: "Permit or booking", value: "object_list", section: "warnings", display: ["rest!"], base: "R", gap: "Permit or booking not checked yet", home: rel("access_cost") }),
  def({ key: "price", group: "access", label: "Price", value: "price_list", section: "options", display: ["rest", "card", "filter"], base: "R?", trigger: "sells", gap: "Price not published", home: cap("price"), filter: { scopes: ["intent:do", "culture", "play", "snow"], control: "enum", label: "Price band", promote: { "culture": 2, "animals.see": 2, "play": 2 }, band: "price_band" } }),
  def({ key: "window", group: "access", label: "Booking window", value: "window", section: "options", display: ["rest!", "filter"], base: "R?", trigger: "bookable", gap: "Booking window not published; book as early as possible", home: cap("window"), filter: { scopes: ["intent:do", "culture"], control: "enum", label: "Booking needed", band: "booking" } }),
  def({ key: "book_url", group: "access", label: "Booking page", value: "text", section: "links", display: ["detail"], base: "N", layers: ["offer"] }),
  def({ key: "reservation", group: "access", label: "Reservation", value: "enum", section: "options", display: ["rest"], base: "N", layers: ["offer", "place"] }),
  def({ key: "cost_band", group: "access", label: "Cost band", value: "enum", section: "options", display: ["card"], base: "N" }),
  def({ key: "included", group: "access", label: "What is included", value: "text", section: "options", display: ["detail"], base: "N", layers: ["offer"] }),
  def({ key: "cancellation", group: "access", label: "Cancellation", value: "text", section: "options", display: ["detail"], base: "N", layers: ["offer"] }),
  def({ key: "deposit", group: "access", label: "Deposit or ID rule", value: "text", section: "options", display: ["detail"], base: "N", layers: ["offer"] }),
  def({ key: "variants", group: "offer", label: "Variants", value: "object_list", section: "options", display: ["rest"], base: "N", gap: "Variants not recorded", layers: ["offer"] }),

  // Relevance (relevance/1)
  def({ key: "class_key", group: "relevance", label: "Class", value: "enum", section: "cover", display: ["rest"], base: "R", gap: "Not judged yet", home: rel("class_key"), layers: ["place", "route", "offer"] }),
  def({ key: "draw", group: "relevance", label: "Draw", value: "enum", section: "cover", display: ["rest", "card"], base: "R", gap: "Not judged yet", home: rel("draw"), layers: ["place", "route", "offer"] }),
  def({ key: "standing", group: "relevance", label: "Standing", value: "enum", section: "cover", display: ["detail"], base: "R", home: rel("standing"), layers: ["place", "route", "offer"] }),
  def({ key: "distinction", group: "relevance", label: "Distinction", value: "enum", section: "cover", display: ["detail"], base: "R", home: rel("distinction"), layers: ["place", "route", "offer"] }),
  def({ key: "easy_payoff", group: "relevance", label: "Easy payoff", value: "enum", section: "cover", display: ["detail"], base: "R", home: rel("easy_payoff"), layers: ["place", "route", "offer"] }),
  def({ key: "weather", group: "relevance", label: "Weather", value: "enum", section: "cover", display: ["detail"], base: "R", home: rel("weather"), layers: ["place", "route", "offer"] }),
  def({ key: "why", group: "relevance", label: "Why go", value: "text", section: "cover", display: ["rest", "card"], base: "R", gap: "Not judged yet", home: rel("why"), layers: ["place", "route", "offer"] }),
  def({ key: "signals", group: "relevance", label: "Evidence of fame", value: "object", section: "sources", display: ["detail"], base: "R", home: rel("signals"), layers: ["place", "route", "offer"] }),
  def({ key: "pairs_with", group: "relevance", label: "Nearby, worth adding", value: "object_list", section: "pairs", display: ["rest"], base: "A", gap: "Nearby pairs not checked yet", home: rel("pairs_with") }),

  // Safety
  def({ key: "closures", group: "safety", label: "Closures and conditions", value: "object_list", section: "warnings", display: ["rest!"], base: "R?", trigger: "status_page", gap: "Closures not checked yet" }),

  // Links and media
  def({ key: "links", group: "links", label: "Links", value: "link_list", section: "links", display: ["detail"], base: "R", gap: "Links not checked yet", home: cap("links") }),
  def({ key: "photos", group: "media", label: "Photos", value: "photo_list", section: "photos", display: ["rest", "card"], base: "A", gap: "Licensed photo not found yet", home: cap("photos") }),

  // Relations (2.5). `reached_by` is derived and is not a property.
  def({ key: "reaches", group: "relations", label: "Reaches", value: "relation_list", section: "access", display: ["rest"], base: "N", gap: "Payoff not recorded", home: cap("reaches"), layers: ["route"] }),
  def({ key: "passes", group: "relations", label: "Passes", value: "relation_list", section: "access", display: ["rest"], base: "N", home: cap("passes"), layers: ["route"] }),
  def({ key: "part_of", group: "relations", label: "Part of", value: "relation_list", section: "around", display: ["rest"], base: "A", trigger: "part_of_something", home: cap("part_of") }),
  def({ key: "starts_at", group: "relations", label: "Starts at", value: "relation_list", section: "access", display: ["rest"], base: "N", gap: "Parking or stop not recorded", home: cap("starts_at"), layers: ["route", "offer"] }),
  def({ key: "ends_at", group: "relations", label: "Ends at", value: "relation_list", section: "access", display: ["detail"], base: "N", home: cap("ends_at"), layers: ["route"] }),
  def({ key: "on", group: "relations", label: "On the route", value: "relation_list", section: "around", display: ["rest"], base: "N", home: cap("on"), layers: ["offer"] }),
  def({ key: "at", group: "relations", label: "At the place", value: "relation_list", section: "around", display: ["rest"], base: "N", home: cap("at"), layers: ["offer"] }),
  def({ key: "run_by", group: "relations", label: "Run by", value: "ref", section: "options", display: ["rest"], base: "N", gap: "Operator not recorded", home: cap("run_by"), layers: ["offer"] }),
  def({ key: "parks_for", group: "relations", label: "Parking for", value: "relation_list", section: "access", display: ["rest"], base: "N", home: cap("parks_for"), layers: ["place"] }),
  def({ key: "serves", group: "relations", label: "Serves", value: "relation_list", section: "access", display: ["rest"], base: "N", home: cap("serves"), layers: ["place"] }),
  def({ key: "combo_with", group: "relations", label: "Combines with", value: "relation_list", section: "around", display: ["detail"], base: "N", home: cap("combo_with") }),
  def({ key: "alternative_to", group: "relations", label: "Alternative to", value: "relation_list", section: "around", display: ["detail"], base: "N", home: cap("alternative_to") }),
  def({ key: "variant_of", group: "relations", label: "Variant of", value: "relation_list", section: "options", display: ["detail"], base: "N", home: cap("variant_of"), layers: ["offer"] }),

  // Route facts no suitability field holds
  def({ key: "geometry", group: "type_facts", label: "Track", value: "object", section: "activity", display: ["detail"], base: "N", gap: "Track not recorded yet", home: { in: "tracks", path: "data/tracks" }, layers: ["route"] }),
  def({ key: "high_point_m", group: "type_facts", label: "High point", value: "number", unit: "m", section: "activity", display: ["detail"], base: "N", layers: ["route"] }),
  def({ key: "gpx_licence", group: "type_facts", label: "Track licence", value: "text", section: "links", display: ["detail"], base: "N", layers: ["route"] }),
  def({ key: "snow_free_window", group: "type_facts", label: "Snow-free window", value: "season_rows", section: "when", display: ["rest"], base: "N", layers: ["route"] }),
  def({ key: "turnaround_points", group: "type_facts", label: "Turnaround points", value: "object_list", section: "activity", display: ["detail"], base: "N", layers: ["route"] }),

  // Per-type facts of 3.5 that are not suitability fields
  def({ key: "bearing", group: "type_facts", label: "Faces", value: "text", section: "glance", display: ["detail"], base: "N" }),
  def({ key: "crowds", group: "type_facts", label: "Crowds", value: "text", section: "when", display: ["detail"], base: "N" }),
  def({ key: "photo_spot", group: "type_facts", label: "Photo spot", value: "text", section: "glance", display: ["detail"], base: "N" }),
  def({ key: "visit_mode", group: "type_facts", label: "How you visit", value: "enum", section: "glance", display: ["rest"], base: "N" }),
  def({ key: "indoor", group: "type_facts", label: "Indoor", value: "bool", section: "glance", display: ["card", "filter"], base: "N", filter: { scopes: ["culture", "play", "intent:do"], control: "bool", label: "Indoor or rainy-day" } }),
  def({ key: "dress_code", group: "type_facts", label: "Dress code", value: "text", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "photo_rules", group: "type_facts", label: "Photo rules", value: "text", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "languages", group: "type_facts", label: "Languages", value: "enum_list", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "queue_note", group: "type_facts", label: "Queue", value: "text", section: "glance", display: ["detail"], base: "N" }),
  def({ key: "seat_side", group: "type_facts", label: "Best seat side", value: "text", section: "glance", display: ["detail"], base: "N" }),
  def({ key: "fills_by", group: "type_facts", label: "Fills by", value: "text", section: "access", display: ["rest"], base: "N" }),
  def({ key: "capacity", group: "type_facts", label: "Capacity", value: "number", section: "access", display: ["detail"], base: "N" }),
  def({ key: "rv_limits", group: "type_facts", label: "RV limits", value: "text", section: "access", display: ["detail"], base: "N" }),
  def({ key: "ev_charging", group: "type_facts", label: "EV charging", value: "bool", section: "access", display: ["detail"], base: "N" }),
  def({ key: "overflow", group: "type_facts", label: "Overflow parking", value: "text", section: "access", display: ["detail"], base: "N" }),
  def({ key: "kids_menu", group: "type_facts", label: "Kids menu", value: "bool", section: "facilities", display: ["detail", "filter"], base: "N", filter: { scopes: ["food"], control: "bool", label: "Kids menu" } }),
  def({ key: "high_chairs", group: "type_facts", label: "High chairs", value: "bool", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "dietary", group: "type_facts", label: "Dietary options", value: "enum_list", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "family_rooms", group: "type_facts", label: "Family rooms", value: "bool", section: "facilities", display: ["detail", "filter"], base: "N", filter: { scopes: ["stay"], control: "bool", label: "Family rooms" } }),
  def({ key: "pitches", group: "type_facts", label: "Pitches and hookups", value: "object", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "quiet_hours", group: "type_facts", label: "Quiet hours", value: "text", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "why_stay", group: "type_facts", label: "Why stay here", value: "text", section: "cover", display: ["rest"], base: "N" }),
  def({ key: "groceries", group: "type_facts", label: "Groceries", value: "text", section: "facilities", display: ["detail"], base: "N" }),
  def({ key: "last_transport", group: "type_facts", label: "Last transport", value: "text", section: "access", display: ["detail"], base: "N" }),
  def({ key: "tourist_tax", group: "type_facts", label: "Tourist tax", value: "text", section: "options", display: ["detail"], base: "N" }),
  def({ key: "sun_loss", group: "type_facts", label: "Sun loss", value: "text", section: "when", display: ["detail"], base: "N" }),
];

// --------------------------------------------------------------------------------------------------------------------
// The suitability group: one entry per path of the applicability file. Tuple: [label, group, value, section, display, filter?]
// --------------------------------------------------------------------------------------------------------------------
type SuitRow = [string, Group, ValueType, SectionId, Display[], FilterDef?, string?, string?];
const LIM: Display[] = ["rest!"];
const D: Display[] = ["detail"];
const SUIT_ROWS: Record<string, SuitRow> = {
  min_age: ["Minimum age", "limits", "limit", "suits", LIM, undefined, "years"],
  max_age: ["Maximum age", "limits", "limit", "suits", LIM, undefined, "years"],
  min_height_cm: ["Minimum height", "limits", "limit", "suits", LIM, undefined, "cm"],
  max_height_cm: ["Maximum height", "limits", "limit", "suits", LIM, undefined, "cm"],
  min_weight_kg: ["Minimum weight", "limits", "limit", "suits", LIM, undefined, "kg"],
  max_weight_kg: ["Maximum weight", "limits", "limit", "suits", LIM, undefined, "kg"],
  limit_reason: ["Why the limit", "limits", "enum", "suits", D],
  adult_required: ["Adult required", "limits", "limit", "suits", LIM],
  solo: ["Ride without an adult", "limits", "limit", "suits", LIM],
  group_min: ["Group minimum", "limits", "limit", "suits", LIM],
  age_band: ["Who it suits (ages)", "suits", "range", "suits", ["rest", "card", "filter"], { scopes: ["intent:do", "play", "snow"], control: "range", label: "Ages from", promote: { "intent:do": 1, "play": 1, "snow": 2 }, band: "kids_from" }, "years"],
  kid_note: ["Note for families", "suits", "text", "suits", ["rest"]],
  carrier_ok: ["Baby carrier", "suits", "bool", "suits", D],
  stroller: ["Stroller surface", "suits", "enum", "suits", ["rest", "filter"], { scopes: ["nature.trail", "nature.viewpoint", "nature.summit", "culture"], control: "bool", label: "Stroller" }],
  stroller_extent: ["Stroller: how far", "suits", "object", "suits", D],
  stroller_on_board: ["Stroller aboard", "suits", "enum", "suits", ["rest"]],
  wheelchair: ["Wheelchair", "suits", "enum", "suits", ["rest", "filter"], { scopes: ["culture", "stay"], control: "bool", label: "Step-free" }],
  access_detail: ["Access detail", "suits", "object", "suits", D],
  accessible_toilet: ["Accessible toilet", "suits", "bool", "suits", D],
  accessible_parking: ["Accessible parking", "suits", "bool", "suits", D],
  limited_capacity_note: ["Limited capacity", "suits", "text", "suits", D],
  "effort.source_grade": ["Published grade", "effort", "grade", "activity", ["rest", "card", "filter"], { scopes: ["nature.trail", "nature.trek", "snow.ski", "intent:do"], control: "enum", label: "Effort", promote: { "nature.trail": 1, "nature.trek": 1, "snow": 1 }, band: "effort" }],
  "effort.drivers.distance_km": ["Distance", "effort", "number", "activity", ["rest", "card", "filter"], { scopes: ["nature.trail", "nature.trek"], control: "range", label: "Length", promote: { "nature.trail": 2, "nature.trek": 2 }, band: "length_band" }, "km"],
  "effort.drivers.gain_m": ["Climb", "effort", "number", "activity", ["rest", "filter"], { scopes: ["nature.trail", "nature.trek"], control: "range", label: "Climb", band: "climb_band" }, "m"],
  "effort.drivers.surface": ["Surface", "effort", "enum_list", "activity", D],
  "effort.drivers.scrambling": ["Scrambling", "effort", "enum", "activity", D],
  "effort.drivers.fixed_aids": ["Fixed aids", "effort", "enum_list", "activity", D],
  "effort.drivers.loss_m": ["Descent", "effort", "number", "activity", D, undefined, "m"],
  "effort.drivers.max_grade_pct": ["Steepest gradient", "effort", "number", "activity", D, undefined, "%"],
  adult_time_min: ["Time (adult)", "time", "range", "glance", ["rest", "card", "filter"], { scopes: ["nature.trail", "nature.trek"], control: "range", label: "Time", band: "time_band" }, "min"],
  child_time_min: ["Time (child)", "time", "object_list", "glance", ["rest"], undefined, "min"],
  on_site_min: ["Time on site", "time", "range", "glance", ["rest", "card", "filter"], { scopes: ["culture", "animals.see"], control: "range", label: "Time on site", promote: { "culture": 1, "animals.see": 1 }, band: "time_band" }, "min"],
  toilets: ["Toilets", "facilities", "enum_list", "facilities", ["detail", "filter"], { scopes: ["water", "play"], control: "bool", label: "Toilets" }],
  water: ["Drinking water", "facilities", "enum", "facilities", D],
  food: ["Food", "facilities", "enum", "facilities", D],
  shade: ["Shade", "facilities", "enum", "facilities", D],
  bail_out: ["Bail-out points", "safety", "object_list", "activity", D],
  signal: ["Phone signal", "facilities", "enum", "facilities", D],
  change_rooms: ["Change rooms", "facilities", "bool", "facilities", ["detail", "filter"], { scopes: ["water.swim", "water.thermal"], control: "bool", label: "Change rooms" }],
  showers: ["Showers", "facilities", "bool", "facilities", D],
  picnic: ["Picnic area", "facilities", "bool", "facilities", D],
  baby_change: ["Baby change", "facilities", "bool", "facilities", D],
  exposure: ["Exposure and fencing", "safety", "object", "warnings", ["rest!", "filter"], { scopes: ["nature.viewpoint", "nature.summit", "play"], control: "bool", label: "Fenced" }],
  altitude_m: ["Altitude", "safety", "number", "warnings", D, undefined, "m"],
  hazards: ["Hazards", "safety", "object_list", "warnings", ["rest!"]],
  walk_m: ["Walk from the car", "time", "number", "access", ["rest", "card", "filter"], { scopes: ["nature.viewpoint", "nature.summit", "water"], control: "range", label: "Walk from the car", promote: { "nature.viewpoint": 1, "nature.summit": 1, "water.body": 2, "water.falls": 2, "water.swim": 2 }, band: "walk_band" }, "m"],
  "water_safety.class": ["Water class", "water", "grade", "activity", D],
  "water_safety.lifejacket": ["Life jackets", "water", "enum", "activity", ["rest!"]],
  "water_safety.child_sizes_from_kg": ["Child sizes from", "water", "number", "activity", D, undefined, "kg"],
  "water_safety.swim_ability": ["Swimming ability", "water", "enum", "activity", ["rest"]],
  "water_safety.lifeguard": ["Lifeguard", "water", "bool", "activity", ["rest", "filter"], { scopes: ["water.swim", "water.thermal"], control: "bool", label: "Lifeguard" }],
  "water_safety.entry": ["Water entry", "water", "enum", "activity", D],
  "water_safety.water_temp_c": ["Water temperature", "water", "range", "activity", ["detail", "filter"], { scopes: ["water.swim"], control: "enum", label: "Water temperature" }, "C"],
  "water_safety.current_or_tide": ["Current or tide", "water", "enum", "activity", D],
  access_season: ["Access season", "when", "season_rows", "when", ["rest", "rest!"]],
  "participation.guide": ["Guide", "participation", "enum", "activity", ["rest", "filter"], { scopes: ["mountain", "intent:do"], control: "enum", label: "Guided or self-guided" }],
  "participation.kit_provided": ["Kit provided", "participation", "enum_list", "activity", D],
  "participation.wear": ["What to wear", "participation", "enum_list", "activity", D],
  "participation.min_shoe_eu": ["Smallest shoe size", "participation", "limit", "activity", D, undefined, "EU"],
  "participation.fitness": ["Fitness", "participation", "text", "activity", D],
  "participation.medical": ["Medical", "participation", "object", "activity", ["rest"]],
  "participation.pregnancy": ["Pregnancy", "participation", "enum", "activity", ["rest"]],
  "participation.waiver": ["Waiver", "participation", "object", "activity", D],
  "participation.weigh_in": ["Weigh-in", "participation", "bool", "activity", D],
  "participation.weather_cancel": ["Weather cancellation", "participation", "object", "activity", ["rest", "filter"], { scopes: ["intent:do"], control: "bool", label: "Weather dependent" }],
  "participation.driver": ["Who may drive", "participation", "limit", "activity", ["rest!"]],
};

const EXT_ROW_DEFAULT: SuitRow = ["", "ext", "text", "activity", D];
/** Extension paths with a filter role or a display level above Detail. */
const EXT_ROWS: Record<string, Partial<SuitRow>> = {
  "ext.trail.shape": ["Shape", "ext", "enum", "activity", ["rest", "filter"], { scopes: ["nature.trail", "nature.trek"], control: "enum", label: "Shape" }],
  "ext.trail.dogs": ["Dogs", "ext", "enum", "facilities", ["detail", "filter"], { scopes: ["nature.trail", "nature.trek"], control: "bool", label: "Dogs" }],
  "ext.water.swimming": ["Swimming", "ext", "enum", "activity", ["rest", "card", "filter"], { scopes: ["water.body", "water.falls", "water.swim"], control: "enum", label: "Swimming", promote: { "water.body": 1, "water.falls": 1, "water.swim": 1 } }],
  "ext.lift.last_up": ["Last ride up", "ext", "object_list", "when", ["rest!"]],
  "ext.lift.last_down": ["Last ride down", "ext", "object_list", "when", ["rest!"]],
  "ext.lift.ride_min": ["Ride time", "ext", "range", "glance", ["rest"]],
  "ext.snow.magic_carpet": ["Magic carpet", "ext", "bool", "activity", ["detail", "filter"], { scopes: ["snow"], control: "bool", label: "Magic carpet" }],
  "ext.snow.ski_school_min_age": ["Ski school from", "ext", "limit", "suits", ["rest"]],
  "ext.wildlife.min_distance_m": ["Distance rules", "ext", "limit", "warnings", ["rest!"]],
  "ext.wildlife.stay_in_vehicle": ["Stay in the vehicle", "ext", "enum", "warnings", ["rest!"]],
  "ext.wildlife.best_time": ["Best time (wildlife)", "ext", "enum_list", "when", ["rest"]],
  "ext.boat.vessel": ["Vessel", "ext", "enum", "activity", ["rest"]],
  "ext.zip.braking": ["Braking", "ext", "enum", "activity", ["rest"]],
  "ext.coaster.driver_rule": ["Driver rule", "ext", "limit", "activity", ["rest!"]],
  "ext.drive.road_surface": ["Road surface", "ext", "enum", "activity", ["rest"]],
  "ext.ride.traffic": ["Traffic", "ext", "enum", "activity", ["rest"]],
  "ext.area.pass": ["Pass or permit", "ext", "enum", "warnings", ["rest!"]],
};

function suitProperty(path: string): PropertyDef {
  const known = SUIT_ROWS[path];
  const row: SuitRow = known ?? ((EXT_ROWS[path] ? { ...EXT_ROW_DEFAULT, ...EXT_ROWS[path] } : EXT_ROW_DEFAULT) as SuitRow);
  const label = row[0] !== "" ? row[0] : path.split(".").slice(1).join(" ").replace(/_/g, " ");
  return def({
    key: path, group: row[1], label: label[0]!.toUpperCase() + label.slice(1), value: row[2], section: row[3], display: row[4], base: "N",
    ...(row[5] ? { filter: row[5] } : {}), ...(row[6] ? { unit: row[6] } : {}), home: { in: "suitability", path },
  });
}

export const SUITABILITY_PROPERTIES: PropertyDef[] = APPLICABILITY_PATHS.map(suitProperty);

/** Every property, base contract first. Keys are unique (the registry test pins it). */
export const PROPERTIES: PropertyDef[] = [...BASE_PROPERTIES, ...SUITABILITY_PROPERTIES];

export const PROPERTY_BY_KEY: ReadonlyMap<string, PropertyDef> = new Map(PROPERTIES.map((p) => [p.key, p]));
export const isSuitabilityProperty = (key: string): boolean => PROPERTY_BY_KEY.get(key)?.home.in === "suitability";

/** The paths of SUIT_ROWS that APPLICABILITY_PATHS does not know: a typo guard for the registry test. */
export const UNKNOWN_SUIT_ROWS: string[] = [...Object.keys(SUIT_ROWS), ...Object.keys(EXT_ROWS)].filter((k) => !APPLICABILITY_PATHS.includes(k));
