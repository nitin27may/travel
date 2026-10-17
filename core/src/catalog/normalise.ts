// Step 2 of the flywheel (plan 0A.2): sidecar records to catalog-shaped rows. Units go to metric, currencies stay as ISO
// codes, enums are mapped through an explicit table, tags through the vocabulary, local difficulty to the house grade
// (plan 3A), dates to ISO, ids from the area hierarchy. Nothing is dropped silently: every surprise is a warning.
import * as E from "../schema/enums.ts";
import { tableOf } from "../schema/index.ts";
import { fold, legId, nameKey, slugify } from "./common.ts";
import type { Deps, Entity, Evidence, Row } from "./common.ts";

export interface Warning {
  code: string;
  message: string;
  field?: string;
}

export interface NormRecord {
  entity: Entity | "places";
  /** the proposed id, null when it cannot be built (no area) */
  id: string | null;
  /** only the fields the record supplied or this step derived; defaults are added when a row is created */
  row: Row;
  /** the external ids and keys the matcher uses (wikidata, osm_relation, book_url, provider, product, area_id) */
  match: Row;
  /** sidecar source ids */
  src: string[];
  /** a hint from the researcher; never "verified" */
  confidence: "stated" | "inference" | "gap";
  /** fields the researcher marked as not found */
  gaps: { field: string; reason: string }[];
  warnings: Warning[];
}

export interface Normalised {
  lane: string;
  researched: string;
  sidecar: string;
  evidence: Map<string, Evidence>;
  records: NormRecord[];
  warnings: Warning[];
  unknownTags: string[];
  /** record kinds this step does not turn into catalog rows */
  skipped: Record<string, number>;
}

// ----------------------------------------------------------------------------- units
const MI = 1.609344;
const FT = 0.3048;
/** raw field -> [catalog field, factor]. Distances round to 0.01 km, everything else to a whole unit. */
export const UNIT_FIELDS: Record<string, [string, number]> = {
  distance_mi: ["km", MI], length_mi: ["km", MI], miles: ["km", MI], distance_km: ["km", 1], length_km: ["km", 1],
  gain_ft: ["gain_m", FT], loss_ft: ["loss_m", FT], elevation_ft: ["elevation_m", FT],
  walk_mi: ["walk_km", MI], walk_gain_ft: ["walk_gain_m", FT],
  min_height_in: ["min_height_cm", 2.54], max_height_in: ["max_height_cm", 2.54],
  min_weight_lb: ["min_weight_kg", 0.45359237], max_weight_lb: ["max_weight_kg", 0.45359237],
};
const KM_FIELDS = new Set(["km", "walk_km"]);

export const round = (v: number, field: string): number => (KM_FIELDS.has(field) ? Math.round(v * 100) / 100 : Math.round(v));

// ----------------------------------------------------------------------------- enums
/** "Guided_Hike" and "guided hike" and "Guided-Hike" are one key */
export const enumKey = (v: string): string => fold(String(v)).toLowerCase().trim().replace(/&/g, "-and-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** table.field -> the allowed values */
const ALLOWED: Record<string, readonly string[]> = {
  "activities.type": E.ACTIVITY_TYPE,
  "stays.kind": E.STAY_KIND,
  "trails.shape": E.TRAIL_SHAPE,
  "trails.local_system": E.LOCAL_SYSTEM,
  "trails.geometry_source": E.GEOMETRY_SOURCE,
  "eateries.reservation": E.RESERVATION,
  "offers.category": E.OFFER_CATEGORY,
  "offers.subject_entity": E.SUBJECT_ENTITY,
  "offers.limits_status": E.LIMITS_STATUS,
  "offers.opens_kind": E.OPENS_KIND,
  "offers.sellout_kind": E.SELLOUT_KIND,
  "offers.same_day": E.SAME_DAY,
  "offer_prices.per": E.PRICE_PER,
  "legs.mode": E.LEG_MODE,
  "legs.basis": E.LEG_BASIS,
  "*.kid_fit": E.KID_FIT,
  "*.accessibility": E.ACCESSIBILITY,
};

/** The explicit mapping table: a researcher's word (as an enum key) to the catalog value. Identity entries are implied. */
export const ENUM_MAP: Record<string, Record<string, string>> = {
  "activities.type": {
    "guided-hike": "guided-hike", "guided-walk": "guided-hike", "boat": "boat-tour", "boat-trip": "boat-tour", "boat-cruise": "cruise",
    "kayaking": "kayak", "canoeing": "canoe", "white-water-rafting": "rafting", "whitewater-rafting": "rafting",
    "glacier-hike": "glacier-walk", "glacier-trek": "ice-trek", "ice-hiking": "ice-trek", "big-ice": "ice-trek",
    "zip-line": "zipline", "zip-lining": "zipline", "ziplining": "zipline",
    "cable-car": "gondola", "aerial-tramway": "gondola", "tram": "gondola", "sky-tram": "gondola",
    "sightseeing-flight": "scenic-flight", "helicopter": "heli", "helicopter-tour": "heli",
    "horseback-riding": "horse", "horseback": "horse", "horse-riding": "horse",
    "bike": "cycling", "biking": "cycling", "mountain-biking": "cycling", "bike-tour": "cycling",
    "wildlife-viewing": "wildlife", "wildlife-tour": "wildlife", "whale-watching": "wildlife", "penguin-colony": "wildlife",
    "hot-spring": "hot-springs", "thermal-pools": "hot-springs", "snorkeling": "snorkel-dive", "snorkelling": "snorkel-dive",
    "scuba": "snorkel-dive", "diving": "snorkel-dive", "skiing": "ski", "snowboarding": "ski",
    "dogsled": "dog-sled", "dog-sledding": "dog-sled", "caving": "cave", "cave-tour": "cave",
    "atv": "4x4", "jeep-tour": "4x4", "off-road": "4x4", "climb": "climbing", "rock-climbing": "climbing",
    "canyoneering": "canyoning", "train-ride": "train", "scenic-train": "train", "museum": "museum-tour", "food": "food-tour", "tasting": "food-tour",
  },
  "stays.kind": {
    "refugio": "hut", "refuge": "hut", "mountain-hut": "hut", "camping": "campsite", "campground": "campsite", "camp": "campsite",
    "cabana": "cabin", "chalet": "cabin", "cottage": "cabin", "b-and-b": "hotel", "bed-and-breakfast": "hotel", "inn": "hotel",
    "motel": "hotel", "resort": "hotel", "guesthouse": "hotel", "guest-house": "hotel", "pension": "hotel",
    "aparthotel": "apartment", "apart-hotel": "apartment", "vacation-rental": "apartment", "airbnb": "apartment", "flat": "apartment",
  },
  "trails.shape": {
    "return": "out-and-back", "there-and-back": "out-and-back", "round-trip": "out-and-back", "circuit": "loop", "circular": "loop",
    "one-way": "point-to-point", "traverse": "point-to-point",
  },
  "trails.local_system": {
    "sac-scale": "sac", "sac": "sac", "pc": "parks-canada", "parks-canada": "parks-canada", "us": "nps", "us-nps": "nps", "usda": "nps",
    "sepaq": "sepaq", "apn": "apn", "dnt": "dnt", "yds": "yds", "uk": "uk",
  },
  "eateries.reservation": {
    "reservations-required": "required", "booking-required": "required", "reservations-recommended": "recommended",
    "no-reservation": "walk-in", "first-come": "walk-in", "walk-up": "walk-in",
  },
  "offers.category": {
    "flight": "flight-intl", "international-flight": "flight-intl", "domestic-flight": "flight-domestic",
    "excursion": "activity", "ticket": "activity", "lodge": "lodging", "hotel": "lodging", "accommodation": "lodging",
    "rental-car": "car", "car-rental": "car", "entry": "timed-entry", "timed-entry-ticket": "timed-entry", "park-pass": "pass",
    "shuttle": "transport", "bus": "transport", "train": "transport", "boat-tour": "tour",
  },
  "offer_prices.per": {
    "pp": "person", "per-person": "person", "each": "person", "per-adult": "adult", "per-child": "child", "per-night": "night",
    "per-room": "room", "per-group": "group", "per-vehicle": "vehicle", "per-car": "vehicle",
  },
  "legs.mode": { "car": "drive", "driving": "drive", "walking": "walk", "coach": "bus", "plane": "flight", "cab": "taxi", "cycle": "bike" },
  "*.kid_fit": { "kid-friendly": "yes", "family-friendly": "yes", "not-suitable": "no", "not-for-kids": "no" },
  "*.accessibility": { "wheelchair": "step-free", "accessible": "step-free", "partly-accessible": "partial", "not-accessible": "none" },
};

/** map one value; unknown values become "other" when the enumeration has one, else stay as given, with a warning */
export function mapEnum(table: string, field: string, value: unknown, warnings: Warning[]): unknown {
  if (typeof value !== "string") return value;
  const k = `${table}.${field}`;
  const allowed = ALLOWED[k] ?? ALLOWED[`*.${field}`];
  if (!allowed) return value;
  const key = enumKey(value);
  const synonyms = ENUM_MAP[k] ?? ENUM_MAP[`*.${field}`] ?? {};
  const mapped = synonyms[key] ?? (allowed.includes(key) ? key : null);
  if (mapped) return mapped;
  if (allowed.includes("other")) {
    warnings.push({ code: "W_ENUM_UNKNOWN", field, message: `${table}.${field}: "${value}" is not a known value; stored as "other". Add it to ENUM_MAP in core/src/catalog/normalise.ts if it recurs.` });
    return "other";
  }
  warnings.push({ code: "W_ENUM_UNKNOWN", field, message: `${table}.${field}: "${value}" is not one of ${allowed.join(", ")} and there is no "other"; kept as written, so the validator will refuse it until it is mapped.` });
  return value;
}

// ----------------------------------------------------------------------------- dates, currencies
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number): string => String(n).padStart(2, "0");
const validYmd = (y: number, m: number, d: number): boolean => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

/** a date written in any of the usual ways to YYYY-MM-DD, or null when it cannot be read */
export function toIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m: RegExpExecArray | null;
  let y: number;
  let mo: number;
  let d: number;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s))) [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!];
  else if ((m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/.exec(s))) [y, mo, d] = [+m[3]!, MONTHS.indexOf(m[2]!.toLowerCase()) + 1, +m[1]!];
  else if ((m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s))) [y, mo, d] = [+m[3]!, MONTHS.indexOf(m[1]!.toLowerCase()) + 1, +m[2]!];
  else return null;
  return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

const CURRENCY_SYMBOLS: Record<string, string> = { "C$": "CAD", "CA$": "CAD", "CAD$": "CAD", "US$": "USD", "USD$": "USD", "AR$": "ARS", "ARS$": "ARS", "€": "EUR", "£": "GBP", "CHF": "CHF" };

export function toCurrency(v: unknown, warnings: Warning[]): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (/^[A-Z]{3}$/.test(s)) return s;
  if (/^[a-z]{3}$/i.test(s)) return s.toUpperCase();
  if (CURRENCY_SYMBOLS[s]) return CURRENCY_SYMBOLS[s];
  warnings.push({ code: "W_CURRENCY", field: "currency", message: `"${v}" is not an ISO 4217 code and a bare symbol is ambiguous; kept as written. Use CAD, USD, ARS, EUR.` });
  return s;
}

// ----------------------------------------------------------------------------- difficulty (plan 3A)
export interface Grade {
  house: number | null;
  basis: "technical" | "effort" | "effort-only" | null;
  technical: number | null;
  effort: number | null;
  effort_km: number | null;
}

export function effortGrade(effortKm: number, bands: { below: number | null; grade: number }[]): number {
  for (const b of bands) if (b.below === null || effortKm < b.below) return b.grade;
  return bands[bands.length - 1]?.grade ?? 4;
}

export function houseGrade(km: number | null, gainM: number | null, local: { system: string | null; grade: string | null }, difficulty: Row, warnings: Warning[]): Grade {
  let technical: number | null = null;
  if (local.grade) {
    const sys = (difficulty.systems as Row[]).find((s) => s.id === local.system);
    const hit = sys?.mappings.find((m: Row) => nameKey(m.local) === nameKey(local.grade!));
    if (hit) technical = hit.house;
    else {
      warnings.push({ code: "W_GRADE_UNMAPPED", field: "local_grade", message: `local grade "${local.grade}" (${local.system ?? "no system"}) is not in data/schema/difficulty-map.json; the house grade falls back to the effort grade. Extend the map when this label recurs.` });
    }
  }
  let effortKm: number | null = null;
  let effort: number | null = null;
  if (km !== null) {
    effortKm = Math.round((km + (gainM ?? 0) / 100) * 100) / 100;
    effort = effortGrade(effortKm, difficulty.effort.bands);
  }
  if (effort === null) return { house: technical, basis: technical === null ? null : "technical", technical, effort, effort_km: effortKm };
  if (technical === null) return { house: effort, basis: "effort-only", technical, effort, effort_km: effortKm };
  return { house: Math.max(technical, effort), basis: technical >= effort ? "technical" : "effort", technical, effort, effort_km: effortKm };
}

// ----------------------------------------------------------------------------- one record
const PROVENANCE = new Set(["review_status", "verified_by", "last_verified", "contributed_by", "licence", "merged_from", "updated", "sources", "field_meta"]);
const HELPERS = new Set(["match", "src", "local", "product", "offer", "confidence", "gaps", "id"]);
const ENTITY_OF: Record<string, Entity | "places"> = {
  places: "places", trails: "trails", activities: "activities", stays: "stays", eateries: "eateries", offers: "offers",
  offer_prices: "offer_prices", legs: "legs", area_facts: "area_guides",
};
const DATE_FIELDS = new Set(["read", "geometry_fetched"]);

interface Ctx {
  deps: Deps;
  sidecarAreas: string[];
  researched: string;
  srcIds: Set<string>;
}

export function normaliseRecord(kind: string, raw: Row, ctx: Ctx): NormRecord {
  const entity = ENTITY_OF[kind]!;
  const warnings: Warning[] = [];
  const row: Row = {};
  const match: Row = { ...(raw.match ?? {}) };
  const table = entity === "places" ? "places" : entity;

  // plain copy with unit conversion
  for (const [k, v] of Object.entries(raw)) {
    if (HELPERS.has(k)) continue;
    if (PROVENANCE.has(k)) {
      warnings.push({ code: "W_FIELD_IGNORED", field: k, message: `"${k}" is set by the pipeline (review status, provenance), not by research; ignored.` });
      continue;
    }
    const unit = UNIT_FIELDS[k];
    if (unit) {
      if (typeof v === "number") {
        const [target, factor] = unit;
        if (target in raw) warnings.push({ code: "W_UNIT_CONFLICT", field: target, message: `both ${k} and ${target} given; ${target} is used.` });
        else row[target] = round(v * factor, target);
      } else if (v !== null) warnings.push({ code: "W_NOT_NUMBER", field: k, message: `${k} must be a number, got ${JSON.stringify(v)}.` });
      continue;
    }
    row[k] = v;
  }

  // enums, dates, currency
  for (const k of Object.keys(row)) {
    row[k] = mapEnum(table, k, row[k], warnings);
    if (DATE_FIELDS.has(k) && row[k] !== null) {
      const iso = toIsoDate(row[k]);
      if (iso) row[k] = iso;
      else warnings.push({ code: "W_DATE", field: k, message: `${k}: "${row[k]}" is not a date I can read; use YYYY-MM-DD.` });
    }
  }
  if ("currency" in row) row.currency = toCurrency(row.currency, warnings);

  // tags through the vocabulary
  if (Array.isArray(row.tags)) {
    const kept = new Set<string>();
    for (const t of row.tags as string[]) {
      const canon = ctx.deps.tags.get(enumKey(String(t)));
      if (canon) kept.add(canon);
      else {

        warnings.push({ code: "W_TAG_UNKNOWN", field: "tags", message: `tag "${t}" is not in data/vocab/tags.json (and no alias); left off the row. Add it with tag.add if it is real.` });
      }
    }
    row.tags = [...kept].sort();
  }

  // ids and area
  const areaId: string | null = raw.area_id ?? match.area_id ?? (ctx.sidecarAreas.length === 1 ? ctx.sidecarAreas[0]! : null);
  if (entity !== "legs" && entity !== "offer_prices" && entity !== "area_guides" && areaId) row.area_id = areaId;
  let id: string | null = typeof raw.id === "string" ? raw.id : typeof match.id === "string" ? match.id : null;

  if (entity === "area_guides") {
    id = areaId;
    if (id) row.id = id;
    if (!areaId) warnings.push({ code: "W_NO_AREA", message: "an area fact needs area_id (or the sidecar geo.areas with exactly one area)." });
  } else if (entity === "legs") {
    for (const k of ["from_id", "to_id", "mode"] as const) if (!row[k]) warnings.push({ code: "W_LEG_FIELD", field: k, message: `a leg needs ${k}.` });
    if (row.from_id && row.to_id && row.mode) id = legId(row.from_id, row.to_id, row.mode);
    if (id) row.id = id;
  } else if (entity === "offers") {
    const product = raw.product ?? row.name;
    if (!row.name && raw.product) row.name = raw.product;
    if (row.provider && product) id = id ?? `of-${slugify(row.provider)}-${slugify(product)}`;
    else warnings.push({ code: "W_OFFER_FIELD", message: "an offer needs provider and a product (or name)." });
    match.provider ??= row.provider;
    match.product ??= product;
    if (id) row.id = id;
    if (!row.area_id) warnings.push({ code: "W_NO_AREA", message: `offer ${id ?? ""} has no area_id; give it one or a sidecar with a single area.` });
  } else if (entity === "offer_prices") {
    const o = raw.offer ?? {};
    const offerId: string | null = raw.offer_id ?? match.offer_id ?? o.id ?? (o.provider && (o.product ?? o.name) ? `of-${slugify(o.provider)}-${slugify(o.product ?? o.name)}` : match.provider && match.product ? `of-${slugify(match.provider)}-${slugify(match.product)}` : null);
    if (offerId) row.offer_id = offerId;
    else warnings.push({ code: "W_PRICE_OFFER", message: "a price needs offer_id, or offer {provider, product}." });
    row.read ??= ctx.researched;
    row.valid_months ??= [];
    row.age_from ??= null;
    row.age_to ??= null;
    row.basis_year ??= null;
    row.window ??= null;
    id = null; // numbered when it is written
  } else {
    if (!row.name) warnings.push({ code: "W_NAME", message: `a ${kind.replace(/s$/, "")} record needs a name.` });
    if (!areaId) warnings.push({ code: "W_NO_AREA", message: `"${row.name ?? "?"}" has no area_id; give it one or a sidecar with a single area.` });
    if (!id && areaId && row.name) id = `${areaId}/${slugify(String(row.name))}`;
    if (id) row.id = id;
  }

  // trails: house grade
  if (entity === "trails") {
    const loc = raw.local ?? {};
    const system = (mapEnum("trails", "local_system", loc.system ?? row.local_system ?? null, warnings) as string | null) ?? null;
    const grade: string | null = loc.grade ?? row.local_grade ?? null;
    if (loc.system !== undefined || row.local_system !== undefined) row.local_system = system;
    if (grade !== null) row.local_grade = String(grade);
    if (loc.source_url) row.local_source_url = loc.source_url;
    const g = houseGrade(typeof row.km === "number" ? row.km : null, typeof row.gain_m === "number" ? row.gain_m : null, { system, grade: grade === null ? null : String(grade) }, ctx.deps.difficulty, warnings);
    if (typeof row.km === "number" && typeof row.gain_m !== "number") warnings.push({ code: "W_GAIN_MISSING", field: "gain_m", message: "gain is missing, so the effort grade counts distance only and may read too easy." });
    if (raw.house_grade !== undefined && g.house !== null && raw.house_grade !== g.house) {
      warnings.push({ code: "W_GRADE_OVERRIDDEN", field: "house_grade", message: `research gave house_grade ${raw.house_grade}; the rule of plan 3A gives ${g.house} (technical ${g.technical ?? "none"}, effort ${g.effort}). The rule wins.` });
    }
    if (g.house !== null) {
      row.house_grade = g.house;
      row.house_basis = g.basis;
    }
  }

  // confidence hint and gaps
  let confidence: NormRecord["confidence"] = "stated";
  if (raw.confidence === "inference" || raw.confidence === "gap") confidence = raw.confidence;
  else if (raw.confidence === "verified") warnings.push({ code: "W_CONFIDENCE", field: "confidence", message: "research cannot claim verified; the row lands as stated. Verification is catalog.verify." });

  // unknown columns
  if (entity !== "places") {
    const cols = new Set(Object.keys(tableOf("catalog", entity).shape));
    for (const k of Object.keys(row)) {
      if (!cols.has(k)) {
        warnings.push({ code: "W_FIELD_UNKNOWN", field: k, message: `"${k}" is not a column of ${entity}; dropped. Known units: ${Object.keys(UNIT_FIELDS).join(", ")}.` });
        delete row[k];
      }
    }
  }

  const src = (raw.src as string[] | undefined ?? []).filter((s) => {
    if (ctx.srcIds.has(s)) return true;
    warnings.push({ code: "W_SRC_UNKNOWN", message: `source ${s} is not in the sidecar's sources; ignored.` });
    return false;
  });
  const gaps = ((raw.gaps as Row[] | undefined) ?? []).map((g) => ({ field: String(g.field), reason: String(g.reason ?? "") }));
  return { entity, id, row, match, src, confidence, gaps, warnings };
}

// ----------------------------------------------------------------------------- the whole sidecar
export function normaliseSidecar(sidecar: Row, path: string, deps: Deps): Normalised {
  const evidence = new Map<string, Evidence>();
  const warnings: Warning[] = [];
  for (const s of sidecar.sources as Row[]) {
    const read = toIsoDate(s.read) ?? s.read;
    evidence.set(s.id, { url: s.url, kind: s.kind, read, title: s.title, publisher: s.publisher });
  }
  const researched = toIsoDate(sidecar.researched) ?? sidecar.researched;
  const ctx: Ctx = { deps, sidecarAreas: sidecar.geo?.areas ?? [], researched, srcIds: new Set(evidence.keys()) };
  const records: NormRecord[] = [];
  const skipped: Record<string, number> = {};
  const seen = new Set<string>();
  const unknownTags: string[] = [];
  for (const kind of ["places", "trails", "activities", "stays", "eateries", "offers", "offer_prices", "legs", "area_facts"]) {
    for (const raw of ((sidecar.records ?? {})[kind] ?? []) as Row[]) {
      const rec = normaliseRecord(kind, raw, ctx);
      for (const w of rec.warnings) if (w.code === "W_TAG_UNKNOWN") unknownTags.push(w.message.split('"')[1]!);
      if (rec.id) {
        const key = `${rec.entity}:${rec.id}`;
        if (seen.has(key)) {
          warnings.push({ code: "W_DUPLICATE_RECORD", message: `${key} appears twice in ${path}; the first one is used.` });
          continue;
        }
        seen.add(key);
      }
      records.push(rec);
    }
  }
  for (const kind of ["items"]) {
    const n = ((sidecar.records ?? {})[kind] ?? []).length;
    if (n) skipped[kind] = n;
  }
  return { lane: sidecar.lane, researched, sidecar: path, evidence, records, warnings, unknownTags: [...new Set(unknownTags)].sort(), skipped };
}
