// Shared enumerations (plan 2.3, 2.3A). Plain tuples so they can feed z.enum and the validator.
export const RESERVED_SLUGS = [
  "places", "trips", "trails", "activities", "stays", "eateries", "offers", "areas", "adventures",
  "bookings", "globe", "locations", "inbox", "api", "mcp", "data", "assets", "geo", "_next", "legacy",
  "new", "edit", "review", "backlog", "plan", "schema", "about", "fonts", "icons",
] as const;

export const TRIP_STATUS = ["idea", "researching", "planned", "booked", "travelled", "dropped"] as const;
export const PRIMARY_STYLE = [
  "adventure", "active-nature", "scenic-relaxed", "luxury-relax", "relax", "city-culture", "road-trip", "mixed",
] as const;
export const DURATION_SHAPE = ["day-trip", "weekend", "short-break", "week", "multi-week"] as const;
export const MOVEMENT_SHAPE = [
  "single-base", "two-bases", "multi-base", "road-trip", "hut-to-hut", "camper", "cruise",
] as const;
export const PARTY_SHAPE = [
  "solo", "couple", "family-young", "family-teen", "family-mixed", "friends", "multi-gen",
] as const;
export const VISIBILITY = ["public", "unlisted", "private"] as const;
export const COMFORT = ["lean", "mid", "comfortable", "splurge"] as const;
export const WEATHER_RAIN = ["low", "medium", "high"] as const;
export const BASE_PREFERENCE = ["few-long", "balanced", "many-short", "campsite-only"] as const;
export const TRANSPORT = [
  "own-car", "rental-car", "camper", "train", "bus", "domestic-flight", "ferry", "bike", "taxi-app", "walk",
] as const;
export const KIDS_MODE = ["none", "young", "mid", "teen", "mixed"] as const;
export const EARLY_STARTS = ["never", "sometimes", "fine"] as const;
export const TRAVELLER_ROLE = ["adult", "child", "infant"] as const;
export const EDITION_STATUS = ["candidate", "chosen", "booked", "travelled", "cancelled"] as const;
export const DAY_KIND = ["travel", "hike", "sightseeing", "city", "rest", "buffer", "mixed"] as const;
export const TRACK = ["A", "B", "C", "P"] as const;
export const TRACK_AUDIENCE = ["adult-only", "family", "less-walking", "plan-b"] as const;
export const ITEM_TYPE = [
  "activity", "trail", "sight", "meal", "transfer", "checkin", "checkout", "buffer", "rest", "flight", "break",
] as const;
export const LEG_MODE = [
  "drive", "walk", "bus", "shuttle", "train", "ferry", "boat", "flight", "taxi", "bike", "none",
] as const;
export const LEG_BASIS = ["routed", "timetable", "matrix", "estimate", "inference"] as const;
export const COST_PER = ["person", "group", "vehicle"] as const;
export const LINK_KIND = [
  "official", "operator", "alltrails", "google-maps", "osm", "komoot", "outdooractive", "wikiloc",
  "waymarked", "webcam", "other",
] as const;
export const DAY_LINK_KIND = ["closures", "forecast", "parking", "tel", "webcam"] as const;
export const TRAIL_ROLE = ["track-a", "track-b", "track-c", "optional", "listed", "rejected"] as const;
export const KID_FIT = ["yes", "strong-kid", "no", "unknown"] as const;
export const ACTIVITY_VERDICT = ["in", "optional", "swap", "cut"] as const;
export const BOOK_BY_BASIS = ["computed", "owner", "inference"] as const;
export const BOOKING_PRIORITY = ["urgent", "must", "should", "optional"] as const;
export const BOOKING_STATUS = [
  "todo", "held", "booked", "paid", "walk-up", "sold-out", "cancelled", "not-needed",
] as const;
export const OFFER_CATEGORY = [
  "flight-intl", "flight-domestic", "lodging", "hut", "car", "ferry", "tour", "activity", "permit",
  "parking", "timed-entry", "restaurant", "spa", "pass", "insurance", "transport", "other",
] as const;
export const PLACE_KIND = [
  "trail", "viewpoint", "waterfall", "lake", "mountain", "park", "town", "city", "island", "beach", "canyon",
  "valley", "activity", "lodge", "drive", "museum", "lighthouse", "region", "place",
] as const;
export const CUSTOM_KIND = [...PLACE_KIND, "break", "fuel", "rest-area"] as const;
export const PROPOSED = ["no", "proposed", "accepted", "rejected"] as const;
export const NOTE_SCOPE = ["trip", "day", "item", "place"] as const;
export const NOTE_VISIBILITY = ["private", "shared"] as const;
export const ROUTE_PROFILE = ["car", "camper"] as const;
export const ROUTE_PROVIDER = ["ors", "osrm", "graphhopper", "estimate"] as const;
export const HAZARD_CATEGORY = [
  "wind", "cold", "heat", "water", "glacier", "wildlife", "terrain", "altitude", "crime", "health", "road",
  "remoteness", "other",
] as const;
export const WEATHER_METRIC = [
  "gust_kmh", "wind_kmh", "precip_mm", "precip_prob", "temp_max_c", "temp_min_c", "snowline_m", "visibility",
] as const;
export const WEATHER_OP = [">", ">=", "<", "<="] as const;
export const BUDGET_CATEGORY = [
  "getting-there", "local-transport", "lodging", "food", "activities", "passes", "insurance", "misc",
] as const;
export const BUDGET_BASIS = ["fare-read", "snapshot", "operator", "inference", "gap"] as const;
export const FX_SOURCE = ["frankfurter", "assumption"] as const;
export const FARE_KIND = ["flight-intl", "flight-domestic", "lodging", "car"] as const;
export const FARE_METHOD = ["playwright-tfs", "playwright-tfs-oneway", "playwright-booking", "manual"] as const;
export const DOC_ITEM = [
  "passport-validity", "visa", "eta", "minors-consent", "insurance", "idp", "park-pass", "vaccination", "other",
] as const;
export const PACKING_REASON = ["hut", "van", "glacier", "kids", "rain", "cold", "altitude", "boat", "city"] as const;
export const KNOWLEDGE_STATUS = ["verified", "inference", "gap", "conflict"] as const;
export const QUESTION_STATUS = ["open", "answered", "dropped"] as const;
export const SOURCE_KIND = [
  "official", "operator", "reseller", "press", "blog", "community", "video", "computed",
] as const;
export const CONFIDENCE = ["verified", "stated", "inference", "gap", "conflict"] as const;

// catalog
export const REVIEW_STATUS = ["raw", "proposed", "verified", "stale", "retired"] as const;
export const ACCESSIBILITY = ["step-free", "partial", "none", "unknown"] as const;
export const LICENCE = ["own-words", "odbl", "ogl-ca", "cc-by-4.0", "public-domain"] as const;
export const TRAIL_SHAPE = ["out-and-back", "loop", "point-to-point", "network"] as const;
export const HOUSE_BASIS = ["technical", "effort", "effort-only"] as const;
export const LOCAL_SYSTEM = ["sac", "parks-canada", "sepaq", "nps", "yds", "uk", "apn", "dnt", "other"] as const;
export const GEOMETRY_SOURCE = ["osm", "parks-canada", "nps", "usfs", "swisstopo", "manual-gpx"] as const;
export const ACTIVITY_TYPE = [
  "boat-tour", "cruise", "kayak", "canoe", "rafting", "glacier-walk", "ice-trek", "guided-hike", "via-ferrata",
  "climbing", "canyoning", "zipline", "gondola", "train", "heli", "scenic-flight", "horse", "cycling", "wildlife",
  "hot-springs", "spa", "snorkel-dive", "ski", "dog-sled", "cave", "4x4", "food-tour", "show", "museum-tour",
  "other",
] as const;
export const STAY_KIND = ["hotel", "lodge", "cabin", "apartment", "hut", "campsite", "hostel"] as const;
export const RESERVATION = ["required", "recommended", "walk-in"] as const;
export const SUBJECT_ENTITY = ["activity", "stay", "trail", "place", "leg"] as const;
export const LIMITS_STATUS = ["verified", "stated-by-reseller", "none-stated", "gap"] as const;
export const OPENS_KIND = [
  "always-open", "rolling-lead", "fixed-date", "monthly-release", "lottery", "on-arrival", "unknown",
] as const;
export const SELLOUT_KIND = ["never", "minutes-after-release", "days", "weeks", "months", "unknown"] as const;
export const SAME_DAY = ["yes", "no", "sometimes", "unknown"] as const;
export const PRICE_PER = ["person", "adult", "child", "group", "vehicle", "night", "room"] as const;
export const CATALOG_OP = ["add", "edit", "merge", "retire", "verify"] as const;
export const BACKLOG_REASON = ["gap", "stale", "low-coverage", "conflict", "user-request"] as const;
export const BACKLOG_STATUS = ["open", "claimed", "done", "wont-do"] as const;

// locations v2
export const PLACE_STATUS = ["idea", "shortlisted", "planned", "visited", "dropped"] as const;
export const LOCATION_STATUS = ["resolved", "unconfirmed"] as const;
export const RESOLVERS = ["wikidata", "nominatim", "manual", "none"] as const;
export const LOCATION_SOURCE_TYPES = [
  "instagram", "facebook", "tiktok", "youtube", "reddit", "blog", "article", "official", "guidebook", "friend",
  "note",
] as const;

// suitability/1 (docs/v2/research/suitability.md). Append only.
export const SUIT_BASIS = [
  "operator_rule", "official_rule", "official_grade", "official_info", "community", "our_inference",
] as const;
export const SUIT_STATE = ["value", "none_stated", "searched_none", "not_applicable", "gap"] as const;
/** Every published scale a source_grade can name. The first nine are the difficulty-map v1 ids. */
export const GRADE_SYSTEM = [
  "sac", "parks-canada", "sepaq", "nps", "yds", "uk", "apn", "dnt", "other",
  "cai", "schall", "huesler", "cai-ferrata", "osm-ferrata",
  "imba", "sts", "trailforks", "whistler", "bike-path",
  "whitewater", "flatwater",
  "piste-eu", "piste-at-ch", "piste-na", "piste-jp",
  "local", "operator",
] as const;
export const STROLLER = ["smooth", "all_terrain", "none"] as const;
export const WHEELCHAIR = ["step_free", "partial", "none"] as const;
export const LIMIT_REASON = ["harness", "seat", "equipment", "insurance", "law", "policy"] as const;
export const SUIT_KIND = [
  "trail", "viewpoint", "waterfall", "lake", "sight", "town", "activity", "lift", "swim_spot", "stay", "eatery",
  "drive",
] as const;

// suitability applicability (docs/v2/research/suitability-applicability.md section 6.1). Append only.
/** The profiles of data/schema/suitability-applicability.json. `river_hike` is the 35th: owner decision on Q1 (a hike with water fields). */
export const SUIT_PROFILE = [
  "hike", "river_hike", "walk", "viewpoint", "lake", "swim", "waterfall", "beach", "drive", "town", "sight", "lift", "boat",
  "canoe_kayak", "sup", "rafting", "float", "zipline", "bungee", "ferrata", "mtb_lift", "mtb_xc", "cycle_path",
  "horse", "show_cave", "caving", "glacier", "snow", "wildlife", "hot_spring", "coaster", "paraglide", "air_tour",
  "stay", "eatery",
] as const;
/** Closed subkind vocabulary; the applicability file maps each (kind, subkind) pair to exactly one profile. */
export const SUIT_SUBKIND = [
  "hike", "river_hike", "scramble", "trek_stage", "walk", "guided-hike", "heli-hike",
  "viewpoint", "summit", "pullout", "lake", "swim_spot", "beach", "hot_spring", "waterfall", "canyon", "gorge",
  "scenic_drive", "town", "village", "city",
  "museum", "castle", "landmark", "historic_site", "visitor_centre", "attraction", "cave",
  "gondola", "cable_car", "chairlift", "funicular", "rack_railway", "scenic_train",
  "boat-tour", "cruise", "zodiac", "boat-shuttle", "canoe", "kayak", "sup", "rafting", "float",
  "zipline", "bungee", "swing", "via-ferrata", "bike-park", "mtb", "cycling", "horse", "caving",
  "glacier-walk", "ice-trek", "ski", "snowshoe", "sled", "wildlife", "wildlife_viewing",
  "hot-springs", "thermal-bath", "spa", "coaster", "paragliding", "heli", "scenic-flight", "vehicle-tour",
  ...STAY_KIND, "restaurant", "cafe", "bakery", "teahouse", "bar", "market", "grocery", "hut_kitchen",
] as const;
export const APPLICABILITY = ["R", "A", "N", "op"] as const;
export const SUIT_LEVEL = ["draft", "usable", "complete"] as const;
export const MEDICAL = [
  "heart", "high_blood_pressure", "epilepsy", "neurological", "back_neck", "recent_surgery", "dislocation",
  "asthma", "diabetes", "mobility", "balance", "lung",
] as const;
export const KIT = [
  "pfd", "helmet", "wetsuit", "booties", "spray_jacket", "fleece", "harness", "lanyard", "crampons",
  "microspikes", "ice_axe", "boots", "gloves", "headlamp", "body_armour", "full_face_helmet", "bike",
] as const;
export const WEAR = [
  "closed_shoes", "hiking_boots", "long_trousers", "layers", "swimwear", "change_of_clothes", "sun_hat",
  "warm_hat", "rain_shell",
] as const;
export const WEATHER_CAUSE = [
  "wind", "lightning", "rain", "river_level", "sea_state", "visibility", "heat", "snow", "fog", "maintenance",
] as const;
