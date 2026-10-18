// Regenerates the committed fixtures under core/test/fixtures/suitability:
//   node core/test/fixtures/suitability/make.ts
// root/    a tiny repository the validator resolves refs against (scope.json and three legacy datasets)
// valid/   files that validate with no error (a warning or two is fine)
// broken/  one file per E_SUIT_* code; each yields that code and no other error
// warn/    one file per W_SUIT_* code; each yields that warning and no error
// The values are synthetic: they exercise the code and are not data.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projectFlat } from "../../../src/suitability/derive.ts";
import type { SuitabilityDoc, SuitabilityRecord } from "../../../src/schema/suitability.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
type Any = Record<string, any>;

function put(rel: string, doc: unknown): void {
  const p = join(HERE, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
}
function clear(rel: string): void {
  const p = join(HERE, rel);
  mkdirSync(p, { recursive: true });
  for (const n of readdirSync(p)) if (n.endsWith(".json")) rmSync(join(p, n));
}

const val = (v: unknown, basis: string, extra: Any = {}): Any => ({ v, state: "value", basis, src: basis === "our_inference" ? [] : ["src-0001"], ...(basis === "our_inference" ? { note: "fixture method" } : {}), ...extra });
const src = (over: Any = {}): Any => ({ id: "src-0001", url: "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking/lakelouise", title: "Lake Louise area hikes", publisher: "Parks Canada", kind: "official", read: "2026-10-12", ...over });

function doc(records: Any[], over: Any = {}): Any {
  return { schema: "suitability/1", trip: "fixture-trip", lane: "fixture", researched: "2026-10-18", agent: "make.ts", model: "none", sources: [src()], records, ...over };
}
/** adds the flat copy the way `derive --write` would */
function flat(records: Any[]): Any[] {
  return records.map((r) => ({ ...r, flat: projectFlat(r as SuitabilityRecord) }));
}
const braies = (suitability: Any = {}, over: Any = {}): Any => ({ ref: "place/lago-di-braies", kind: "lake", suitability, ...over });

// ---------------------------------------------------------------- root
clear("root/data/suitability");
put("root/data/suitability/scope.json", {
  schema: "suitability-scope/1",
  places: ["lago-di-braies", "funbob-monte-baranci"],
  items: [
    { ref: "place/lago-di-braies", key: "lago-di-braies", trip: "fixture-trip", kind: "lake", name: "Lago di Braies", days: [], source: {} },
    { ref: "trip/fixture-trip/trail:tre cime", key: "trail:tre cime", trip: "fixture-trip", kind: "trail", name: "Tre Cime", days: [1], source: {} },
    { ref: "legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass", key: "trail:larch", trip: "fixture-trip", kind: "trail", name: "Larch Valley", days: [2], source: { legacy: { folder: "canadian-rockies-sept-2029", dataset: "trails", id: "larch-valley-sentinel-pass" } } },
  ],
});
put("root/legacy/canadian-rockies-sept-2029/data/trails.json", [{ id: "larch-valley-sentinel-pass", name: "Larch Valley" }, { id: "lake-agnes", name: "Lake Agnes" }]);
put("root/legacy/canadian-rockies-sept-2029/data/sights.json", [{ id: "moraine-lake", name: "Moraine Lake" }]);
put("root/legacy/canadian-rockies-sept-2029/data/adventures.json", [{ id: "kicking-horse-family-float", name: "Kicking Horse family float" }]);

// ---------------------------------------------------------------- valid
clear("valid");
const trail = (): Any => ({
  ref: "legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass", kind: "trail", subkind: "hike",
  suitability: {
    age_band: val({ from: 10, to: null }, "our_inference", { note: "11.2 km and 750 m (effort_km 18.7) is over the 6-7 and 8-9 ceilings" }),
    kid_note: "Too long and steep for a 6-year-old; the meadow is a natural turnaround.",
    stroller: val("none", "our_inference", { src: ["src-0001"] }),
    stroller_extent: { scope: "whole" },
    group_min: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-18", tried: ["parks.canada.ca Moraine Lake page", "Banff trail conditions"] },
    effort: {
      source_grade: { v: null, state: "gap", basis: null, src: [] },
      drivers: { distance_km: val(11.2, "official_info"), gain_m: val(750, "official_info") },
    },
    exposure: val({ level: "some", fenced: "partly", where: "Sentinel Pass scree" }, "community"),
  },
  ext: { kind: "trail", shape: "out-and-back", navigation: val("waymarked", "official_info") },
});
const rafting = (): Any => ({
  ref: "legacy/canadian-rockies-sept-2029/adventures/kicking-horse-family-float", kind: "activity", subkind: "rafting",
  suitability: { limit_reason: "seat" },
  ext: { kind: "paddle", craft: val("raft", "operator_rule") },
  offers: [
    { name: "Family float", suitability: { min_age: val(8, "operator_rule"), min_weight_kg: val(22.7, "operator_rule", { quote: "50 lb", note: "50 lb = 22.7 kg, a minimum" }), water_safety: { lifejacket: val("provided_all_sizes", "operator_rule"), class: val({ system: "whitewater", value: "II" }, "official_grade") } } },
    { name: "Class III", suitability: { min_age: val(12, "operator_rule"), effort: { source_grade: val({ system: "whitewater", value: "III" }, "official_grade") } } },
  ],
});
const lake = (): Any => braies({
  stroller: val("smooth", "official_info"),
  stroller_extent: { scope: "part", part_note: "west shore only; steps on the east side" },
  wheelchair: val("partial", "official_info"),
  water_safety: { lifejacket: val("bring_own", "official_info"), swim_ability: val("none_needed", "official_info"), lifeguard: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-18", tried: ["lake operator page", "municipality page"] } },
  access_season: val([{ from: "06-15", to: "09-30", status: "open", via: "road", note: "booking-only access 09:00-16:00 in summer" }], "official_info", { applies_to: "2026" }),
}, { ext: { kind: "water" } });
put("valid/trail-and-activity.json", doc(flat([trail(), rafting()])));
put("valid/lake.json", doc(flat([lake(), { ref: "trip/fixture-trip/trail:tre cime", kind: "trail", suitability: {} }]), { trip: "fixture-trip", lane: "fixture-lake" }));

// ---------------------------------------------------------------- broken
clear("broken");
const broken: Record<string, Any> = {};
const one = (suitability: Any, over: Any = {}): Any[] => flat([braies(suitability, over)]);
broken.E_SUIT_SCHEMA = doc(one({ stroller: val("wobbly", "official_info") }));
broken.E_SUIT_REF = doc(flat([braies({}, { ref: "place/does-not-exist" })]));
broken.E_SUIT_DUP_REF = doc(flat([braies(), braies()]));
broken.E_SUIT_SRC = doc(one({ shade: val("full", "community", { src: ["src-9999"] }) }));
broken.E_SUIT_SRC_READ = doc(one({}), { sources: [{ ...src(), read: undefined }] });
broken.E_SUIT_LINK_ONLY_SRC = doc(one({}), { sources: [src({ url: "https://www.alltrails.com/trail/canada/alberta/sentinel-pass-trail-2", publisher: "AllTrails", kind: "community" })] });
broken.E_SUIT_LIMIT_BASIS = doc(one({ min_age: val(8, "community") }));
broken.E_SUIT_SEARCHED_NONE = doc(one({ min_height_cm: { v: null, state: "searched_none", basis: null, src: [] } }));
broken.E_SUIT_UNIT = doc(one({ min_weight_kg: val(22.7, "operator_rule", { quote: "minimum 50 lb" }) }));
broken.E_SUIT_RANGE = doc(one({ min_weight_kg: val(50, "operator_rule"), max_weight_kg: val(40, "operator_rule") }));
broken.E_SUIT_GRADE = doc(one({ effort: { source_grade: val({ system: "cai", value: "Z" }, "official_grade") } }));
broken.E_SUIT_TYPED_EFFORT = doc(one({ effort: { family_effort: 3, drivers: { distance_km: val(5, "official_info"), gain_m: val(100, "official_info") } } }).map((r) => ({ ...r, flat: undefined })));
broken.E_SUIT_STEP_FREE = doc(one({ wheelchair: val("step_free", "community") }));
{
  const recs = one({ min_age: val(8, "operator_rule") });
  recs[0]!.flat.min_age = 9;
  broken.E_SUIT_FLAT_DRIFT = doc(recs);
}
for (const [code, d] of Object.entries(broken)) put(`broken/${code}.json`, d);

// ---------------------------------------------------------------- warnings
clear("warn");
const warn: Record<string, Any> = {};
warn.W_SUIT_STALE = doc(one({ min_age: val(8, "operator_rule") }), { sources: [src({ read: "2020-01-15" })] });
warn.W_SUIT_CONFLICT = doc(one({ effort: { drivers: { distance_km: val(7.8, "official_info", { conflicts: [{ v: 7.4, basis: "official_info", src: ["src-0001"], note: "second official figure (synthetic)" }] }) } } }));
warn.W_SUIT_COMMUNITY_ONLY = doc(one({ shade: val("partial", "community") }));
warn.W_SUIT_MARGINAL_CONVERSION = doc(one({ min_height_cm: val(112, "operator_rule", { quote: "44 in", note: "44 in = 112 cm" }) }));
warn.W_SUIT_FLAT_MISSING = doc([braies({ min_age: val(8, "operator_rule") })]);
for (const [code, d] of Object.entries(warn)) put(`warn/${code}.json`, d);

void ({} as SuitabilityDoc);
