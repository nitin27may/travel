// The StubStore's data: an invented catalogue, small enough to read, shaped to exercise every contract case (API brief step 12):
// 20 places across 3 countries, one retired slug, two places whose names share a sort key, one approximate point, 2 trips, 10 towns.
// Names, refs and slugs are made up; nothing here is a real trip, and nothing is household data.
import type {
  ApiCitation, ApiPoint, ApiVal, GlobeCity, GlobeFeature, GlobeLine, PlaceDetail, PlaceRow, SearchRecord, Town, TripDetail, TripRow,
} from "../../schema/api/index.ts";
import { aliasKey, assignPlaceSlugs, emptyRegistry, mergeKey, renameSlug, withdrawKey, type SlugRegistry } from "../slugs.ts";

export interface StubPlace {
  row: PlaceRow;
  detail: PlaceDetail;
}

export interface StubTrip {
  row: TripRow;
  detail: TripDetail;
  /** slugs of the places it visits, in day order */
  places: string[];
}

export interface StubData {
  places: StubPlace[];
  trips: StubTrip[];
  towns: Town[];
  registry: SlugRegistry;
  /** the source registry ids the data may cite (stands in for data/sources/registry.json) */
  sourceIds: string[];
  citations: Record<string, ApiCitation>;
  features: GlobeFeature[];
  lines: GlobeLine[];
  cities: GlobeCity[];
  continents: { slug: string; name: string; countries: string[] }[];
  countryNames: Record<string, string>;
  /** the feedback form; `report` answers `not_available` when null */
  reportUrl: string | null;
}

export const STUB_SOURCES: ApiCitation[] = [
  { id: "s-0a1b2c3d4e", url: "https://parks.example/larch-basin", title: "Larch Basin trail", publisher: "Example Parks", kind: "official", read: "2026-09-12" },
  { id: "s-1f2e3d4c5b", url: "https://lifts.example/summer", title: "Summer lift timetable", publisher: "Example Lifts", kind: "operator", read: "2026-08-30" },
];

const REGIONS: SlugRegistry["regions"] = {
  "ca/alberta": { name: "Alberta", aliases: ["AB", "Alberta", "Alta", "CA-AB", "alberta"] },
  "ca/british-columbia": { name: "British Columbia", aliases: ["BC", "British Columbia", "CA-BC", "british-columbia"] },
  "it/south-tyrol": { name: "South Tyrol", aliases: ["Alto Adige", "Highlands", "IT-32", "South Tyrol", "south-tyrol"] },
  "it/veneto": { name: "Veneto", aliases: ["IT-34", "Veneto", "veneto"] },
  "is/south-iceland": { name: "South Iceland", aliases: ["Highlands", "IS-8", "South Iceland", "south-iceland"] },
};

interface Spec {
  ref: string;
  name: string;
  kind: PlaceRow["kind"];
  type: string;
  cc: "CA" | "IT" | "IS";
  region: string;
  area: string;
  lat: number;
  lon: number;
  approx?: boolean;
  role?: ApiPoint["pointRole"];
  licence?: string;
  season?: number[];
  km?: number;
  gain?: number;
  badge?: string;
  trip?: string;
  /** a page built from no capture record (A24): its ref is `place/<first slug>`; the stub derives `sources` and `researched` from it */
  origin?: "wishlist" | "prototype";
}

const COUNTRY: Record<Spec["cc"], string> = { CA: "Canada", IT: "Italy", IS: "Iceland" };

/** The places. The two "Emerald Pool" names share a sort key; Black Sand Arch's point is approximate. */
const SPECS: Spec[] = [
  { ref: "route/larch-basin", name: "Larch Basin", kind: "trail", type: "nature.trail.hike", cc: "CA", region: "alberta", area: "bow-valley", lat: 51.3271, lon: -116.1858, role: "trailhead", licence: "ODbL", season: [7, 8, 9], km: 8.6, gain: 535, badge: "Worth the journey", trip: "stub-rockies-loop" },
  { ref: "place/glacier-lake", name: "Glacier Lake", kind: "lake", type: "water.body.lake", cc: "CA", region: "alberta", area: "bow-valley", lat: 51.3217, lon: -116.1860, role: "centre", licence: "ODbL", season: [6, 7, 8, 9], trip: "stub-rockies-loop" },
  { ref: "place/summit-gondola", name: "Summit Gondola", kind: "lift", type: "ride.lift.gondola", cc: "CA", region: "alberta", area: "bow-valley", lat: 51.1490, lon: -115.5732, role: "route_start", licence: "ODbL", trip: "stub-rockies-loop" },
  { ref: "place/canyon-walk", origin: "wishlist", name: "Canyon Walk", kind: "trail", type: "nature.trail.walk", cc: "CA", region: "alberta", area: "bow-valley", lat: 51.2453, lon: -115.8394, role: "trailhead", licence: "ODbL", km: 3.7, gain: 120 },
  { ref: "place/hoodoo-viewpoint", origin: "prototype", name: "Hoodoo Viewpoint", kind: "viewpoint", type: "nature.viewpoint", cc: "CA", region: "alberta", area: "bow-valley", lat: 51.1720, lon: -115.5402, role: null, licence: "unknown" },
  { ref: "place/emerald-pool-ab", name: "Émerald Pool", kind: "lake", type: "water.body.pool", cc: "CA", region: "alberta", area: "kananaskis", lat: 50.9010, lon: -115.1560, role: "centre", licence: "ODbL" },
  { ref: "place/emerald-pool-bc", name: "Emerald Pool", kind: "lake", type: "water.body.pool", cc: "CA", region: "british-columbia", area: "yoho", lat: 51.4433, lon: -116.5313, role: "centre", licence: "ODbL" },
  { ref: "route/spiral-falls", name: "Spiral Falls", kind: "waterfall", type: "water.falls", cc: "CA", region: "british-columbia", area: "yoho", lat: 51.4996, lon: -116.4573, role: "entrance", licence: "ODbL", trip: "stub-rockies-loop" },
  { ref: "place/natural-bridge-yoho", name: "Natural Bridge", kind: "sight", type: "nature.landform", cc: "CA", region: "british-columbia", area: "yoho", lat: 51.3990, lon: -116.5240, role: "parking", licence: "ODbL" },
  { ref: "place/river-raft", origin: "prototype", name: "River Raft", kind: "activity", type: "water.paddle.raft", cc: "CA", region: "british-columbia", area: "golden", lat: 51.2990, lon: -116.9640, role: "meeting", licence: "unknown" },
  { ref: "place/alpe-meadow", name: "Alpe Meadow", kind: "area", type: "nature.protected", cc: "IT", region: "south-tyrol", area: "val-gardena", lat: 46.5410, lon: 11.6260, role: "centre", licence: "ODbL", trip: "stub-alps-week" },
  { ref: "route/seceda-ridge", name: "Ridge Walk", kind: "trail", type: "nature.trail.hike", cc: "IT", region: "south-tyrol", area: "val-gardena", lat: 46.6000, lon: 11.7240, role: "trailhead", licence: "ODbL", km: 6.1, gain: 380, trip: "stub-alps-week" },
  { ref: "place/ortisei-church", name: "Parish Church", kind: "sight", type: "culture.heritage.church", cc: "IT", region: "south-tyrol", area: "val-gardena", lat: 46.5749, lon: 11.6720, role: "entrance", licence: "ODbL" },
  { ref: "place/lago-verde", name: "Lago Verde", kind: "lake", type: "water.body.lake", cc: "IT", region: "south-tyrol", area: "dolomites-east", lat: 46.6950, lon: 12.0850, role: "centre", licence: "ODbL", trip: "stub-alps-week" },
  { ref: "place/three-peaks-view", origin: "wishlist", name: "Three Peaks View", kind: "viewpoint", type: "nature.viewpoint", cc: "IT", region: "veneto", area: "cortina", lat: 46.6190, lon: 12.3020, role: "summit", licence: "ODbL", trip: "stub-alps-week" },
  { ref: "place/mountain-hut", origin: "prototype", name: "Mountain Hut", kind: "eatery", type: "food.eat.hut", cc: "IT", region: "veneto", area: "cortina", lat: 46.5480, lon: 12.1350, role: null, licence: "unknown" },
  { ref: "place/skogar-falls", name: "Skogar Falls", kind: "waterfall", type: "water.falls", cc: "IS", region: "south-iceland", area: "skogar", lat: 63.5321, lon: -19.5114, role: "parking", licence: "ODbL" },
  { ref: "place/black-sand-arch", name: "Black Sand Arch", kind: "sight", type: "nature.landform", cc: "IS", region: "south-iceland", area: "vik", lat: 63.4000, lon: -19.1000, approx: true, role: null, licence: "ODbL" },
  { ref: "route/glacier-tongue", name: "Glacier Tongue Walk", kind: "trail", type: "nature.trail.walk", cc: "IS", region: "south-iceland", area: "skaftafell", lat: 64.0160, lon: -16.9660, role: "trailhead", licence: "ODbL", km: 3.7, gain: 60 },
  { ref: "place/vik", origin: "wishlist", name: "Vik", kind: "town", type: "settlement.village", cc: "IS", region: "south-iceland", area: "vik", lat: 63.4186, lon: -19.0060, role: "centre", licence: "ODbL" },
];

/** The retired slug: Larch Basin was renamed once, so its first slug answers with the current one. */
export const STUB_RETIRED = { from: "larch-basin", to: "larch-basin-trail", ref: "route/larch-basin" } as const;
/** A trip renamed once: its first slug answers with the current one (R-18). */
export const STUB_TRIP_RETIRED = { from: "stub-alps-holiday", to: "stub-alps-week" } as const;
/** A key replaced by `alias` (R-2): a wishlist page (`place/<slug>`, A24) that gained a capture record; its former ref resolves to the same page. */
export const STUB_ALIASED = { former: "place/natural-bridge", now: "place/natural-bridge-yoho", slug: "natural-bridge" } as const;
/** Records with a slug but no page: one merged into Glacier Lake (R-1), one withdrawn (R-3). */
export const STUB_MERGED = { ref: "place/glacier-lake-shore", into: "place/glacier-lake", slug: "glacier-lake-shore", to: "glacier-lake" } as const;
export const STUB_WITHDRAWN = { ref: "place/old-lookout", slug: "old-lookout" } as const;
const STUB_GONE = [
  { ref: STUB_MERGED.ref, name: "Glacier Lake Shore", area: "bow-valley" },
  { ref: STUB_WITHDRAWN.ref, name: "Old Lookout", area: "bow-valley" },
];

const words = (s: string): string => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const val = (v: unknown, src: string[], basis: ApiVal["basis"] = "official_info"): ApiVal => ({ v, state: "value", basis, src, read: "2026-09-12" });

function detailOf(sp: Spec, slug: string, tripTitles: Map<string, string>): PlaceDetail {
  const point: ApiPoint = { lat: sp.lat, lon: sp.lon, pointRole: sp.role ?? null, approx: sp.approx === true, pointSource: sp.approx ? "prototype_approx" : "osm_node:1", pointChecked: null, sourceLicence: sp.licence ?? "unknown" };
  const trips = sp.trip ? [{ slug: sp.trip, title: tripTitles.get(sp.trip)! }] : [];
  const rich = sp.ref === "route/larch-basin";
  const citations = rich ? Object.fromEntries(STUB_SOURCES.map((s) => [s.id, s])) : {};
  return {
    ref: sp.ref,
    slug,
    name: sp.name,
    kind: sp.kind,
    kindLabel: words(sp.kind),
    subkind: null,
    category: sp.kind === "trail" ? "trails" : sp.kind === "eatery" ? "food" : sp.kind === "activity" || sp.kind === "lift" ? "activities" : "sights",
    type: sp.type,
    badge: sp.badge ?? null,
    areaChain: [
      { level: "country", name: COUNTRY[sp.cc], slug: sp.cc.toLowerCase() },
      { level: "state", name: REGIONS[`${sp.cc.toLowerCase()}/${sp.region}`]!.name, slug: sp.region },
      { level: "district", name: words(sp.area), slug: sp.area },
    ],
    areaLabel: `${words(sp.area)}, ${COUNTRY[sp.cc]}`,
    point,
    season: sp.season ?? [],
    kidFit: "unknown",
    summary: `${sp.name}, a ${sp.kind} in ${words(sp.area)}.`,
    photo: null,
    trips,
    tags: [],
    completeness: { level: rich ? "usable" : "draft", passed: rich ? 7 : 2, total: 11, notTracked: 13, failed: [], label: rich ? "Usable · 7 of 11" : "Basics only", tooltip: "" },
    honesty: sp.approx ? [{ id: "location_unconfirmed", label: "Location approximate", reason: "The pin is a centroid, not the spot." }] : [],
    stats: { distanceKm: sp.km ?? null, gainM: sp.gain ?? null, hours: null },
    sources: sp.origin === "wishlist" ? [] : [sp.origin === "prototype" ? "prototype" : "capture"],
    elevationM: null,
    access: rich ? { trailhead: { ...point, pointRole: "trailhead", name: "Larch Basin trailhead", note: null, elevationM: 1885 }, parking: [{ ...point, lat: 51.3262, pointRole: "parking", name: "Upper lot", note: null, elevationM: 1880, fee: null, capacity: "about 300 cars" }] } : null,
    lines: [],
    facts: [],
    hazards: [],
    links: [],
    linksNone: [],
    seasonNote: null,
    photos: [],
    wikidata: null,
    notes: "",
    minAge: null,
    booking: null,
    sections: rich
      ? {
          ref: sp.ref, type: sp.type, layer: "route", name: sp.name, typeLabel: "Hike",
          sections: [{
            n: 2, id: "facts", title: "Key facts", drawn: true, closing: null, empty: false, delegate: null, lines: [],
            rows: [{ key: "distance_km", label: "Distance", valueType: "km", mark: "R", home: "facts", echo: false, text: "8.6 km", value: 8.6, val: val(8.6, ["s-0a1b2c3d4e"]), state: "value", gap: false, gapWording: "", unit: "km", links: [], look: "info" }],
          }],
          glance: ["distance_km"], suitabilityRef: sp.ref, ticket: null, payoff: null, partOf: [], parts: [], ways: [], routeStops: [], accessPoints: [], offers: [], around: [], links: [],
          checks: { done: 7, total: 11, read: "2026-09-12", level: "usable" },
        }
      : null,
    suitability: rich
      ? {
          ref: sp.ref, chips: [null, null, null], warning: null,
          research: { done: 7, total: 11, read: "2026-09-12", level: "usable", levelLabel: "Usable", text: "7 of 11 key checks", softSafety: [] },
          groups: [{ id: "limits", title: "Limits", open: true, closing: null, rows: [{ key: "min_age", label: "Minimum age", text: "No minimum age", look: "rule", val: { v: null, state: "no_limit", basis: "operator_rule", src: ["s-1f2e3d4c5b"] }, gap: false, honesty: null, short: "none" }] }],
          card: { kids: null, effort: null }, accessChips: [], adultTime: null, kidsFrom: null, familyEffort: null, allMissing: false,
        }
      : null,
    relevance: null,
    refSlugs: {},
    citations,
  };
}

function rowOf(d: PlaceDetail, sp: Spec): PlaceRow {
  const regionKey = `${sp.cc.toLowerCase()}/${sp.region}`;
  return {
    ref: d.ref, id: d.slug, slug: d.slug, name: d.name, kind: d.kind, kindLabel: d.kindLabel, legacyKind: null,
    country: sp.cc, country_name: COUNTRY[sp.cc], region: sp.region, region_name: REGIONS[regionKey]!.name, regionAliases: REGIONS[regionKey]!.aliases,
    area: sp.area, area_name: words(sp.area), lat: d.point?.lat ?? null, lon: d.point?.lon ?? null, km: sp.km ?? null, gain_m: sp.gain ?? null,
    elevation_m: null, season: d.season, kid_fit: "unknown", tags: sp.ref === "place/glacier-lake" ? [{ id: "family", label: "Family", kind: "audience" }] : [], image: null, trips: d.trips, honesty: d.honesty.map((h) => ({ id: h.id, label: h.label })),
    completeness: { level: d.completeness.level, label: d.completeness.label }, statsState: sp.km ? "unverified" : null,
    researched: sp.origin !== "wishlist", type: sp.type, effort: null, kids_from: null, kids_basis: null, time_band: null, price_band: null,
    booking: null, flags: [], walk_band: null, shape: null, best_time: null, badge: d.badge, approx: d.point?.approx ?? false,
    // 3b (A35): the nearest fixture town within 50 km, as META-2 derives `near_town`; null until then
    nearTown: null,
  };
}

const TRIPS = [
  { slug: "stub-rockies-loop", title: "Rockies loop", cc: "CA", nights: 6 },
  { slug: "stub-alps-week", title: "Alps week", cc: "IT", nights: 7 },
] as const;

/**
 * The loop's two booking rows (MUST-6; TRP-GL-C review F6), so case K30 exercises the non-empty path on the stub too: a window on the
 * day-1 stop's own place (its "Book ahead" rides on that stop, as `withStopBookings` puts it), and a note with no rule and no place. The
 * Alps week has none, the `[]` case. Dateless, and worded like the real rows.
 */
function bookingRows(slug: string, mine: StubPlace[]): TripDetail["categories"]["logistics"] {
  if (slug !== "stub-rockies-loop") return [];
  const first = mine[0]!.detail;
  return [
    { key: "logistics:stub-shuttle", category: "logistics", name: "Lake shuttle seat", kind: "booking", placeSlug: first.slug, days: [1], time: null, areaLabel: null, detail: null, nights: null, bookRule: { daysBefore: 2, dayN: 1, time: "08:00", tz: "America/Edmonton" }, bookNote: "Seats not taken in the spring release open two days ahead." },
    { key: "logistics:stub-pass", category: "logistics", name: "Park pass", kind: "booking", placeSlug: null, days: [Math.min(2, mine.length)], time: null, areaLabel: null, detail: null, nights: null, bookRule: null, bookNote: "INFERENCE 2029: buy the pass online before the first park gate." },
  ];
}

function tripOf(t: (typeof TRIPS)[number], places: StubPlace[]): StubTrip {
  const mine = places.filter((p) => p.detail.trips.some((x) => x.slug === t.slug));
  const first = mine[0]!.detail.point!;
  const empty = { stays: [], trails: [], sights: [], activities: [], food: [], logistics: [] };
  const detail: TripDetail = {
    ref: `trip/${t.slug}`, slug: t.slug, title: t.title, subtitle: `${t.nights} nights`, depth: "full", visibility: "public", nights: t.nights, daysCount: t.nights + 1,
    seasonNotSet: false, region: COUNTRY[t.cc], cover: null,
    season: { basis: "researched", months: [7, 8], label: "July and August", why: "Lifts and high trails open.", weather: { tempC: "10 to 24", rain: "some", daylight: "15 h", notes: [] } },
    firstBase: "Base one", legacyUrl: `/trips/${t.slug}/`, honesty: [],
    tags: { countries: [t.cc.toLowerCase()], continents: [t.cc === "CA" ? "north-america" : "europe"], length: "4-8", when: [7, 8], kidsFrom: null, kidsBasis: null, hike: "moderate", hikeBasis: "plan", stroller: null, activities: [], highlights: [mine[0]!.detail.name], around: ["rental-car"], perDay: "1-2", perDayApprox: true, shape: "road-trip" },
    lengthClass: "multi-day", fromHubs: [], schedule: null,
    bases: [{ id: "base-one", name: "Base one", nights: t.nights, days: Array.from({ length: t.nights }, (_, i) => i + 1), point: { lat: first.lat, lon: first.lon, pointRole: "centre", approx: false, pointSource: "manual_pin", pointChecked: null, sourceLicence: "ours" } }],
    days: mine.map((p, i) => ({
      n: i + 1, title: p.detail.name, baseId: "base-one", base: "Base one", driveMin: null, driveIsEstimate: true, summary: null,
      items: [{ id: `${i + 1}-1`, name: p.detail.name, kind: p.detail.kind, subkind: null, category: p.detail.category, foldedInto: null, placeSlug: p.detail.slug, time: null, variant: null, durationMin: null, note: null, stats: null, access: null }],
      tracks: null, scheduleInput: null, variants: [], know: [], summaryProse: null, light: null,
    })),
    categories: { ...empty, trails: mine.filter((p) => p.detail.kind === "trail").map((p, i) => ({ key: p.detail.slug, category: "trails" as const, name: p.detail.name, kind: p.detail.kind, placeSlug: p.detail.slug, days: [i + 1], time: null, areaLabel: p.detail.areaLabel, detail: null, nights: null, bookRule: null, bookNote: null })), logistics: bookingRows(t.slug, mine) },
    gallery: [], effort: "moderate", ageFit: null, driveAvgMin: null,
  };
  const row: TripRow = {
    ref: detail.ref, id: t.slug, slug: t.slug, title: t.title, depth: "full", nights: t.nights, days: t.nights + 1, seasonNotSet: false,
    region: COUNTRY[t.cc], cover: null, seasonLabel: "July and August", seasonBasis: "researched", seasonMonths: [7, 8], country: t.cc, countryName: COUNTRY[t.cc],
    lat: first.lat, lon: first.lon, approx: false, ageFit: null, kidsBasis: null, effort: "moderate", firstBase: "Base one",
    countries: [{ code: t.cc, name: COUNTRY[t.cc] }], continents: detail.tags.continents, length: "4-8", lengthClass: "multi-day",
    hike: "moderate", hikeBasis: "plan", strollerDays: null, activities: [], highlights: detail.tags.highlights, around: ["rental-car"],
    perDay: "1-2", perDayApprox: true, shape: "road-trip", fromHubMin: null, fromHubApprox: true,
  };
  return { row, detail, places: mine.map((p) => p.detail.slug) };
}

const TOWNS: [string, string, number, number, number, string | null][] = [
  ["ca-ab-canmore", "Canmore", 51.0884, -115.3479, 15990, "alberta"],
  ["ca-ab-banff", "Banff", 51.1784, -115.5708, 8305, "alberta"],
  ["ca-ab-lake-louise", "Lake Louise", 51.4254, -116.1773, 1000, "alberta"],
  ["ca-ab-calgary", "Calgary", 51.0447, -114.0719, 1306784, "alberta"],
  ["ca-bc-field", "Field", 51.3955, -116.4894, 1000, "british-columbia"],
  ["ca-bc-golden", "Golden", 51.2981, -116.9631, 3986, "british-columbia"],
  ["it-32-ortisei", "Ortisei", 46.5749, 11.6720, 4744, "south-tyrol"],
  ["it-32-selva-di-val-gardena", "Selva di Val Gardena", 46.5560, 11.7590, 2700, "south-tyrol"],
  ["it-34-cortina-dampezzo", "Cortina d'Ampezzo", 46.5405, 12.1357, 5800, "veneto"],
  ["is-8-vik", "Vik", 63.4186, -19.0060, 318, "south-iceland"],
];

/** Builds the fixture. Deterministic: two calls give equal data, so two StubStores share a revision. */
export function stubData(): StubData {
  // Natural Bridge was first pinned under an older key, then aliased (R-2): the old ref still resolves through formerKeys
  const firstKey = (ref: string) => (ref === STUB_ALIASED.now ? STUB_ALIASED.former : ref);
  const keyed = [...SPECS.map((sp) => ({ key: firstKey(sp.ref), name: sp.name, areaSlug: sp.area })), ...STUB_GONE.map((g) => ({ key: g.ref, name: g.name, areaSlug: g.area }))];
  const first = assignPlaceSlugs(keyed);
  // A24: a page with no capture record holds `place/<the slug it was first pinned with>`
  for (const sp of SPECS) if (sp.origin && sp.ref !== `place/${first.get(sp.ref)}`) throw new Error(`stub: ${sp.ref} is not place/<its first slug>`);
  if (`place/${first.get(STUB_ALIASED.former)}` !== STUB_ALIASED.former) throw new Error("stub: the aliased page was not place/<its first slug>");
  let registry: SlugRegistry = {
    ...emptyRegistry(),
    places: { slugs: Object.fromEntries([...first].sort()), retired: {}, merged: {}, withdrawn: {} },
    trips: { slugs: Object.fromEntries(TRIPS.map((t) => [`trip/${t.slug}`, t.slug === STUB_TRIP_RETIRED.to ? STUB_TRIP_RETIRED.from : t.slug])), retired: {}, merged: {}, withdrawn: {} },
    regions: REGIONS,
  };
  registry = renameSlug(registry, STUB_RETIRED.ref, STUB_RETIRED.to);
  registry = renameSlug(registry, `trip/${STUB_TRIP_RETIRED.to}`, STUB_TRIP_RETIRED.to);
  registry = aliasKey(registry, STUB_ALIASED.former, STUB_ALIASED.now);
  registry = mergeKey(registry, STUB_MERGED.ref, STUB_MERGED.into);
  registry = withdrawKey(registry, STUB_WITHDRAWN.ref);
  const tripTitles = new Map<string, string>(TRIPS.map((t) => [t.slug, t.title]));
  const places = SPECS.map((sp) => {
    const detail = detailOf(sp, registry.places.slugs[sp.ref]!, tripTitles);
    return { detail, row: rowOf(detail, sp) };
  });
  const trips = TRIPS.map((t) => tripOf(t, places));
  const towns: Town[] = TOWNS.map(([id, name, lat, lon, pop, region]) => ({ id, name, lat, lon, pop, cc: id.slice(0, 2), region, places: null, distanceKm: null, bearing: null }));
  return {
    places,
    trips,
    towns,
    registry,
    sourceIds: STUB_SOURCES.map((s) => s.id),
    citations: Object.fromEntries(STUB_SOURCES.map((s) => [s.id, s])),
    features: [{ id: "ne-range-1", kind: "range", name: "Front Ranges", lon: -115.4, lat: 51.2, a3: "CAN", extra: null, rank: 3, population: null, aliases: [], bbox: [-116.2, 50.6, -114.8, 51.8], lineId: "ne-range-1" }],
    lines: [{ id: "ne-range-1", name: "Front Ranges", kind: "line", bbox: [-116.2, 50.6, -114.8, 51.8], geometry: { type: "MultiLineString", coordinates: [[[-116.2, 51.8], [-114.8, 50.6]]] }, credit: "Natural Earth" }],
    cities: [{ id: "ca-ab-canmore", name: "Canmore", geometry: null, credit: "OpenStreetMap contributors (ODbL)" }],
    continents: [{ slug: "north-america", name: "North America", countries: ["ca"] }, { slug: "europe", name: "Europe", countries: ["is", "it"] }],
    countryNames: { ca: "Canada", it: "Italy", is: "Iceland" },
    reportUrl: "https://forms.example/report",
  };
}

/** Search records the stub answers from. */
export function stubSearchRecords(d: StubData): SearchRecord[] {
  return [
    ...d.trips.map((t): SearchRecord => ({ k: "trip", h: `/trips/${t.row.slug}/`, n: t.row.title, s: t.row.region, x: t.row.countryName })),
    ...d.places.map((p): SearchRecord => ({ k: "place", h: `/places/${p.row.slug}/`, n: p.row.name, s: `${p.row.region_name} · ${p.row.kindLabel}`, x: `${p.row.area_name} ${p.row.country_name}`, kind: p.row.kind })),
  ];
}
