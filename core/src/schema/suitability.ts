// suitability/1 (docs/v2/research/suitability.md sections 1, 2 and 5.1): who a place suits, with provenance per value.
//
// Subset rule (meta.ts): no refine, transform or lazy schemas here, so the whole file exports to JSON Schema.
// Cross-field rules (a hard limit needs an operator or official basis, min <= max, units in quotes, refs) live in
// core/src/validate/suitability.ts. Family effort is never an input: terrain, band and family_effort are computed by
// core/src/suitability/derive.ts, so they are absent from `effort` below on purpose.
import { z } from "zod";
import * as E from "./enums.ts";
import { json, pattern, table, text, date } from "./meta.ts";

const isoDate = z.iso.date();
const srcIds = z.array(z.string());
const basis = z.enum(E.SUIT_BASIS);
const int = z.number().int();
const mmdd = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

/** The value wrapper of spec 1.1, as a factory over the value type. */
export function val<T extends z.ZodType>(inner: T) {
  return z.strictObject({
    v: inner.nullable(),
    state: z.enum(E.SUIT_STATE),
    basis: basis.nullable(),
    src: srcIds,
    read: isoDate.optional(),
    quote: z.string().max(300).optional(),
    note: z.string().optional(),
    tried: z.array(z.string()).optional(),
    on: isoDate.optional(),
    applies_to: z.string().regex(/^\d{4}$/).optional(),
    conflicts: z.array(z.strictObject({ v: inner, basis, src: srcIds, note: z.string().optional() })).optional(),
  });
}

const range = z.tuple([int.min(0), int.min(0)]);

export const gradeValue = z.strictObject({ system: z.enum(E.GRADE_SYSTEM), value: z.string().min(1) });

const adultRequired = z.union([
  z.literal("none"),
  z.strictObject({ under: int.min(0) }),
  z.strictObject({ ratio: int.min(1) }),
]);

const drivers = z.strictObject({
  distance_km: val(z.number().min(0)).optional(),
  gain_m: val(z.number().min(0)).optional(),
  loss_m: val(z.number().min(0)).optional(),
  surface: val(z.array(z.enum(["paved", "boardwalk", "gravel", "dirt", "roots", "rock", "scree", "snow", "water"]))).optional(),
  scrambling: val(z.enum(["none", "hands_occasional", "hands_needed", "climbing"])).optional(),
  fixed_aids: val(z.array(z.enum(["chains", "cables", "ladders", "steps"]))).optional(),
  max_grade_pct: val(z.number().min(0)).optional(),
});

/** Inputs only. `terrain`, `band`, `effort_km` and `family_effort` are computed (derive.ts) and rejected if typed. */
const effort = z.strictObject({
  source_grade: val(gradeValue).optional(),
  override: z.strictObject({ grade: int.min(1).max(5), reason: z.string().min(1), by: z.string().min(1), on: isoDate }).optional(),
  drivers: drivers.optional(),
});

const exposure = z.strictObject({
  level: z.enum(["none", "some", "significant", "serious"]),
  fenced: z.enum(["fenced", "partly", "unfenced"]).nullable(),
  where: z.string().optional(),
});

const waterSafety = z.strictObject({
  class: val(z.strictObject({ system: z.enum(["whitewater", "flatwater"]), value: z.string().min(1) })).optional(),
  lifejacket: val(z.enum(["provided_all_sizes", "provided_adult_only", "bring_own", "not_provided"])).optional(),
  child_sizes_from_kg: val(z.number().min(0)).optional(),
  swim_ability: val(z.enum(["none_needed", "comfortable", "tested"])).optional(),
  lifeguard: val(z.boolean()).optional(),
  entry: val(z.enum(["shallow_gradual", "steps_or_ladder", "drop_off"])).optional(),
  water_temp_c: val(range).optional(),
  current_or_tide: val(z.enum(["none", "some", "strong"])).optional(),
});

const accessSeason = z.strictObject({
  from: mmdd,
  to: mmdd,
  status: z.enum(["open", "limited", "closed"]),
  via: z.enum(["road", "lift", "shuttle", "trail", "boat"]),
  note: z.string().optional(),
});

const seasonTime = z.strictObject({ from: mmdd, to: mmdd, time: z.string().regex(/^\d\d:\d\d$/) });

/**
 * Adventure rules that apply only to operated activities (applicability spec A4). Offers carry it too: the rules differ
 * by product. `min_shoe_eu` is a limit (K3) and so needs a rule basis.
 */
const participation = z.strictObject({
  guide: val(z.enum(["required", "recommended", "none"])).optional(),
  kit_provided: val(z.array(z.enum(E.KIT))).optional(),
  wear: val(z.array(z.enum(E.WEAR))).optional(),
  min_shoe_eu: val(z.number().min(15).max(50)).optional(),
  fitness: val(z.string().min(1)).optional(),
  medical: val(z.strictObject({ excluded: z.array(z.enum(E.MEDICAL)), ask_doctor: z.array(z.enum(E.MEDICAL)) })).optional(),
  pregnancy: val(z.enum(["allowed", "ask_doctor", "not_allowed"])).optional(),
  waiver: val(z.strictObject({ required: z.boolean(), guardian_signs_under: int.min(0).nullable(), guardian_present: z.boolean().nullable() })).optional(),
  weigh_in: val(z.boolean()).optional(),
  weather_cancel: val(z.strictObject({
    causes: z.array(z.enum(E.WEATHER_CAUSE)),
    policy: z.enum(["refund", "rebook", "credit", "none"]).nullable(),
    status: z.string().optional(),
  })).optional(),
});

/** The shared block, valid on every kind and on every offer. All fields optional: a record may be sparse. */
export const suitabilityBlock = z.strictObject({
  // hard limits
  min_age: val(int.min(0)).optional(),
  max_age: val(int.min(0)).optional(),
  age_rule: z.enum(["rule", "recommendation"]).optional(),
  min_height_cm: val(int.min(0)).optional(),
  max_height_cm: val(int.min(0)).optional(),
  min_weight_kg: val(z.number().min(0)).optional(),
  max_weight_kg: val(z.number().min(0)).optional(),
  limit_reason: z.enum(E.LIMIT_REASON).nullable().optional(),
  adult_required: val(adultRequired).optional(),
  group_min: val(z.strictObject({ n: int.min(1), season: z.string().optional() })).optional(),
  /** age or height to ride without an adult (chairlift, coaster, ski lift): a limit (K3) */
  solo: val(z.strictObject({ min_age: int.min(0).optional(), min_height_cm: int.min(0).optional() })).optional(),
  // who it suits
  age_band: val(z.strictObject({ from: int.min(0), to: int.min(0).nullable() })).optional(),
  kid_note: z.string().optional(),
  carrier_ok: val(z.boolean()).optional(),
  stroller: val(z.enum(E.STROLLER)).optional(),
  stroller_extent: z.strictObject({ scope: z.enum(["whole", "part"]), part_note: z.string().optional(), part_km: z.number().min(0).optional() }).optional(),
  /** a carriage rule (may you bring it aboard); `stroller` is a surface */
  stroller_on_board: val(z.enum(["yes", "folded", "no", "leave_at_dock"])).optional(),
  wheelchair: val(z.enum(E.WHEELCHAIR)).optional(),
  access_detail: z.strictObject({
    surface: val(z.string()).optional(),
    max_gradient_pct: val(z.number().min(0)).optional(),
    steps: val(int.min(0)).optional(),
    width_min_cm: val(z.number().min(0)).optional(),
    length_m: val(z.number().min(0)).optional(),
  }).optional(),
  accessible_toilet: val(z.boolean()).optional(),
  accessible_parking: val(z.boolean()).optional(),
  limited_capacity_note: z.string().optional(),
  // effort
  effort: effort.optional(),
  // time
  adult_time_min: val(range).optional(),
  child_time_min: val(z.array(z.strictObject({ from_age: int.min(0), to_age: int.min(0).nullable(), range }))).optional(),
  on_site_min: val(range).optional(),
  // facilities
  toilets: val(z.array(z.enum(["start", "route", "payoff", "none", "on_board", "station"]))).optional(),
  water: val(z.enum(["potable", "treat", "none"])).optional(),
  food: val(z.enum(["hut", "cafe", "none"])).optional(),
  shade: val(z.enum(["full", "partial", "none"])).optional(),
  bail_out: val(z.union([
    z.literal("committing"),
    z.array(z.strictObject({ name: z.string().min(1), at_km: z.number().min(0), note: z.string().optional() })),
  ])).optional(),
  signal: val(z.enum(["good", "patchy", "none"])).optional(),
  // hazards that decide age
  exposure: val(exposure).optional(),
  altitude_m: val(int).optional(),
  /** typed hazards that decide the day; moved here from the trail extension */
  hazards: val(z.array(z.strictObject({ category: z.enum(E.HAZARD_CATEGORY), note: z.string().min(1), season: z.string().optional() }))).optional(),
  /** metres from the car or the stop to the place; moved here from the trail extension so one record can also carry a water extension */
  walk_m: val(z.number().min(0)).optional(),
  water_safety: waterSafety.optional(),
  participation: participation.optional(),
  // access season (of the access, not the place)
  access_season: val(z.array(accessSeason)).optional(),
});

/** Per-kind extensions, a discriminated union on `kind` (spec 2.1 to 2.7; applicability spec 6.3). */
export const ext = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("trail"),
    shape: z.enum(["out-and-back", "loop", "point-to-point", "network"]).optional(),
    navigation: val(z.enum(["waymarked", "signed_junctions", "cairns", "route_finding"])).optional(),
    water_crossings: val(int.min(0)).optional(),
    snowfields_until: val(mmdd).optional(),
    dogs: val(z.enum(["allowed", "leash", "banned"])).optional(),
  }),
  z.strictObject({
    kind: z.literal("ride"),
    bike_hire: val(z.array(z.enum(["child_seat", "trailer", "tag_along", "e_bike"]))).optional(),
    traffic: val(z.enum(["none", "crossings", "sections"])).optional(),
    min_rider_age: val(int.min(0)).optional(),
    one_way_return: val(z.strictObject({ mode: z.string().min(1), bikes_allowed: z.boolean().nullable() })).optional(),
    lift_served: val(z.boolean()).optional(),
    e_bike: val(z.enum(["allowed", "not_on_lift_trails", "banned"])).optional(),
    kids_bike_sizes: val(z.array(z.enum(["12in", "14in", "16in", "20in", "24in", "26in"]))).optional(),
    skills_park: val(z.strictObject({ lift_served: z.boolean().nullable(), note: z.string().optional() })).optional(),
    trail_mix: val(z.strictObject({ white: int.min(0), green: int.min(0), blue: int.min(0), black: int.min(0), double_black: int.min(0), pro: int.min(0) })).optional(),
  }),
  z.strictObject({
    kind: z.literal("paddle"),
    craft: val(z.enum(["canoe", "kayak", "raft", "float_raft", "sup"])).optional(),
    class_at_level: val(z.array(z.strictObject({ month: int.min(1).max(12), class: z.string().min(1), section: z.string().optional(), note: z.string().optional() }))).optional(),
    sections: val(z.array(z.strictObject({ name: z.string().min(1), class: z.string().min(1), km: z.number().min(0).optional() }))).optional(),
    on_water_min: val(range).optional(),
    wind_exposure: val(z.enum(["sheltered", "some", "exposed", "offshore_risk"])).optional(),
    portages: val(z.strictObject({ count: int.min(0), longest_m: z.number().min(0) })).optional(),
    craft_capacity: val(z.strictObject({ adults: int.min(0), children: int.min(0), child_max_kg: z.number().min(0).nullable() })).optional(),
    guided: val(z.enum(["guided", "self", "either"])).optional(),
    trip_style: val(z.enum(["family_float", "whitewater", "flatwater"])).optional(),
  }),
  z.strictObject({
    kind: z.literal("ferrata"),
    kit: val(z.enum(["provided", "rent", "own"])).optional(),
    kit_weight_note: z.string().optional(),
    child_harness: val(z.strictObject({ type: z.enum(["full_body", "sit"]), to_kg: z.number().min(0).optional() })).optional(),
    approach_min: val(range).optional(),
    descent: val(z.enum(["walk", "lift", "same_way"])).optional(),
  }),
  z.strictObject({
    kind: z.literal("water"),
    note: z.string().optional(),
    swimming: val(z.enum(["allowed", "banned", "unsafe", "seasonal"])).optional(),
    clarity: val(z.enum(["clear", "cloudy"])).optional(),
    /** the age under which flotation is required: a limit (K3) */
    floats_required_under: val(int.min(0)).optional(),
  }),
  z.strictObject({
    kind: z.literal("cave"),
    air_temp_c: val(range).optional(),
    steps: val(int.min(0)).optional(),
    squeeze: val(z.enum(["none", "some", "crawl"])).optional(),
    darkness: val(z.enum(["lit", "partly_lit", "headlamp"])).optional(),
    wet: val(z.enum(["dry", "damp", "wading", "swimming"])).optional(),
    carry_child: val(z.enum(["allowed", "carrier_only", "not_allowed"])).optional(),
    tour_m: val(z.number().min(0)).optional(),
  }),
  z.strictObject({
    kind: z.literal("snow"),
    ski_school_min_age: val(int.min(0)).optional(),
    magic_carpet: val(z.boolean()).optional(),
    lift_child_rules: val(z.string()).optional(),
  }),
  z.strictObject({
    kind: z.literal("lift"),
    cabin: val(z.enum(["enclosed", "open_chair", "train", "mixed"])).optional(),
    last_up: val(z.array(seasonTime)).optional(),
    last_down: val(z.array(seasonTime)).optional(),
    ride_min: val(range).optional(),
  }),
  z.strictObject({
    kind: z.literal("boat"),
    vessel: val(z.enum(["enclosed", "part_open", "open", "rib"])).optional(),
    sea_state: val(z.enum(["sheltered", "some_swell", "open_sea"])).optional(),
    seasick_risk: val(z.enum(["low", "some", "high"])).optional(),
    landing: val(z.strictObject({ where: z.string().min(1), min: int.min(0) })).optional(),
  }),
  z.strictObject({
    kind: z.literal("zip"),
    braking: val(z.enum(["self", "guide", "automatic"])).optional(),
    lines: val(z.strictObject({ count: int.min(1), longest_m: z.number().min(0), max_kmh: z.number().min(0).optional() })).optional(),
    tandem_under_kg: val(z.number().min(0)).optional(),
    kids_course: val(z.boolean()).optional(),
    between_lines: val(z.enum(["flat", "stairs", "hike"])).optional(),
  }),
  z.strictObject({
    kind: z.literal("jump"),
    height_m: val(z.number().min(0)).optional(),
    tandem: val(z.boolean()).optional(),
    harness: val(z.enum(["ankle", "body", "both"])).optional(),
  }),
  z.strictObject({
    kind: z.literal("coaster"),
    max_riders: val(int.min(1)).optional(),
    /** a limit (K3) */
    max_load_kg: val(z.number().min(0)).optional(),
    /** a limit (K3) */
    driver_rule: val(z.strictObject({ min_age: int.min(0).optional(), min_height_cm: int.min(0).optional() })).optional(),
    brake: val(z.enum(["rider", "automatic"])).optional(),
  }),
  z.strictObject({
    kind: z.literal("horse"),
    lead_rein: val(z.enum(["available", "only", "not_offered"])).optional(),
    share_horse: val(z.boolean()).optional(),
    pace: val(z.enum(["walk_only", "trot", "canter"])).optional(),
    pony_option: val(z.strictObject({ min_age: int.min(0), max_age: int.min(0) })).optional(),
  }),
  z.strictObject({
    kind: z.literal("glacier"),
    traction: val(z.enum(["crampons", "instep_crampons", "microspikes"])).optional(),
    boots: val(z.enum(["provided", "rent", "own"])).optional(),
    ice_min: val(range).optional(),
  }),
  z.strictObject({
    kind: z.literal("flight"),
    flight_min: val(range).optional(),
    /** a limit by time slot (K3) */
    weight_by_slot: val(z.array(z.strictObject({ slot: z.string().min(1), min_kg: z.number().min(0).optional(), max_kg: z.number().min(0) }))).optional(),
    takeoff_run_m: val(z.number().min(0)).optional(),
    seat_weight_rule: val(z.string().min(1)).optional(),
  }),
  z.strictObject({
    kind: z.literal("wildlife"),
    /** a distance rule by species: a limit (K3) */
    min_distance_m: val(z.array(z.strictObject({ species: z.string().min(1), m: int.min(0) }))).optional(),
    stay_in_vehicle: val(z.enum(["required", "advised", "no"])).optional(),
    best_time: val(z.array(z.enum(["dawn", "morning", "midday", "evening", "dusk", "night"]))).optional(),
    sightings: val(z.enum(["likely", "possible", "rare"])).optional(),
    quiet_needed: val(z.boolean()).optional(),
    peak_months: val(z.array(int.min(1).max(12))).optional(),
  }),
  z.strictObject({
    kind: z.literal("area"),
    /** the pass, permit or timed entry the area needs */
    pass: val(z.enum(["none", "pass", "permit", "timed_entry"])).optional(),
    access_road: val(z.enum(["paved", "gravel", "mixed", "four_wd"])).optional(),
    stay_on_site: val(z.array(z.enum(["camping", "lodge", "hut", "none"]))).optional(),
    /** refs of the trail records inside the area; they carry the effort */
    child_trails: val(z.array(z.string().min(1))).optional(),
  }),
  z.strictObject({
    kind: z.literal("drive"),
    vehicle_limits: val(z.strictObject({
      max_length_m: z.number().min(0).optional(),
      max_width_m: z.number().min(0).optional(),
      max_height_m: z.number().min(0).optional(),
      two_wd: z.enum(["ok", "banned"]).optional(),
    })).optional(),
    road_surface: val(z.enum(["paved", "gravel", "mixed"])).optional(),
    drive_min: val(range).optional(),
    fuel_gap_km: val(z.number().min(0)).optional(),
    winding: val(z.enum(["low", "some", "high"])).optional(),
  }),
]);

/** What the plan data said that a migration may not turn into a value (spec 7.2): a pointer for the research lane. */
export const hint = z.strictObject({
  field: z.string().min(1),
  text: z.string().min(1),
  src: srcIds,
});

/** The flat catalogue columns, a computed copy (K9). `derive --write` regenerates it; `check` fails on drift. */
export const flat = z.strictObject({
  min_age: int.nullable(),
  max_age: int.nullable(),
  min_height_cm: int.nullable(),
  max_height_cm: int.nullable(),
  min_weight_kg: z.number().nullable(),
  max_weight_kg: z.number().nullable(),
  house_grade: int.min(1).max(5).nullable(),
  kid_fit: z.enum(E.KID_FIT),
  accessibility: z.enum(E.ACCESSIBILITY),
  walk_km: z.number().nullable(),
  walk_gain_m: z.number().nullable(),
  /** computed from the applicability file: draft until every R field is answered, complete when the A fields are too */
  suit_level: z.enum(E.SUIT_LEVEL),
});

const offer = z.strictObject({ name: z.string().min(1), suitability: suitabilityBlock, ext: ext.optional() });

export const record = z.strictObject({
  ref: z.string().min(1),
  kind: z.enum(E.SUIT_KIND),
  /** closed vocabulary (E.SUIT_SUBKIND), required; checked as E_SUIT_SUBKIND so the error is specific, not E_SUIT_SCHEMA */
  subkind: z.string().min(1).optional(),
  /** the operator layer for profiles that are sometimes self-guided (applicability spec A3) */
  operated: z.boolean().optional(),
  suitability: suitabilityBlock,
  ext: ext.optional(),
  offers: z.array(offer).optional(),
  hints: z.array(hint).optional(),
  flat: flat.optional(),
});

export const sourceRow = z.strictObject({
  id: z.string().regex(/^src-\d{4,}$/),
  url: z.string().min(1),
  title: z.string(),
  publisher: z.string(),
  kind: z.enum(E.SOURCE_KIND),
  read: isoDate,
});

export const SUITABILITY_SCHEMA_ID = "suitability/1";

export const suitability = table("suitability", {
  schema: pattern(/^suitability\/1$/),
  trip: text({ pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/ }),
  lane: text({ min: 1 }),
  researched: date(),
  agent: text({ min: 1 }),
  model: text({ min: 1 }),
  sources: json(z.array(sourceRow)),
  records: json(z.array(record)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Suitability" } });

export type SuitVal<T> = {
  v: T | null;
  state: (typeof E.SUIT_STATE)[number];
  basis: (typeof E.SUIT_BASIS)[number] | null;
  src: string[];
  read?: string;
  quote?: string;
  note?: string;
  tried?: string[];
  on?: string;
  applies_to?: string;
  conflicts?: { v: T; basis: (typeof E.SUIT_BASIS)[number]; src: string[]; note?: string }[];
};
export type SuitabilityBlock = z.infer<typeof suitabilityBlock>;
export type SuitabilityRecord = z.infer<typeof record>;
export type SuitabilityExt = z.infer<typeof ext>;
export type SuitabilitySource = z.infer<typeof sourceRow>;
export type SuitabilityDoc = { schema: "suitability/1"; trip: string; lane: string; researched: string; agent: string; model: string; sources: SuitabilitySource[]; records: SuitabilityRecord[] };
export type SuitFlat = z.infer<typeof flat>;
