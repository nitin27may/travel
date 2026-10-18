// Trail records keyed by place id. Field names follow docs/v2/research/lanes/trails.md and
// travel/docs/research/trails-and-media-2026-10-18.md section 1 (fallback chain, link-only platforms).
// Every researched value carries a source and the date it was read. A value typed in by a person carries
// `you: true` instead and waits for review (in the real app research proposes and review verifies).
import { useSyncExternalStore } from "react";

export type Conf = "official" | "operator" | "community" | "inferred";
export interface Fact { v: string; src?: string; conf?: Conf; read?: string; you?: boolean; added?: string; sent?: boolean }

export type LinkKind =
  | "official" | "alltrails" | "komoot" | "wikiloc" | "outdooractive" | "waymarked" | "gpx" | "conditions" | "weather"
  | "webcam" | "booking" | "transit" | "video" | "report" | "other";
export interface TrailLink { id: string; kind: LinkKind; url: string; label: string; checked_at?: string; note?: string; opened?: boolean; you?: boolean; sent?: boolean }

export type GeomSource = "osm_relation" | "osm_ways" | "parks_canada" | "nps" | "usfs" | "manual" | "none";
export interface TrailRecord {
  facts: Record<string, Fact>;   // keyed by FIELD key, see FIELDS
  hazards: Fact[];
  links: TrailLink[];
}

export type FieldType = "num" | "text" | "url" | "select" | "range" | "lat" | "lon";
export interface FieldDef { key: string; label: string; type: FieldType; unit?: string; options?: string[]; group: GroupKey; hint?: string; wide?: boolean }
export type GroupKey = "numbers" | "route" | "who" | "when" | "trailhead" | "parking" | "permit";

export const GROUPS: { key: GroupKey; title: string }[] = [
  { key: "numbers", title: "Distance and climb" },
  { key: "route", title: "Route and ground" },
  { key: "who", title: "Who it suits" },
  { key: "when", title: "When to go" },
  { key: "trailhead", title: "Trailhead" },
  { key: "parking", title: "Parking" },
  { key: "permit", title: "Permits and booking" },
];

export const DIFFICULTY: Record<string, string> = {
  easy: "Easy: well made path, little climbing, no hands needed",
  moderate: "Moderate: sustained climbing or rough ground, sure footing",
  hard: "Hard: long or steep, some exposure, good fitness",
  expert: "Expert: scrambling or protected sections, experience needed",
};

export const FIELDS: FieldDef[] = [
  { key: "distance_km", label: "Distance", type: "num", unit: "km", group: "numbers" },
  { key: "elevation_gain_m", label: "Climb", type: "num", unit: "m", group: "numbers" },
  { key: "elevation_loss_m", label: "Descent", type: "num", unit: "m", group: "numbers" },
  { key: "max_elevation_m", label: "High point", type: "num", unit: "m", group: "numbers" },
  { key: "duration_hours", label: "Time", type: "range", unit: "h", group: "numbers", hint: "e.g. 3.5-4.5" },
  { key: "difficulty", label: "Difficulty", type: "select", options: Object.keys(DIFFICULTY), group: "route", hint: "" },
  { key: "route_shape", label: "Shape", type: "select", options: ["loop", "out-and-back", "point-to-point"], group: "route" },
  { key: "surface", label: "Surface", type: "text", group: "route" },
  { key: "exposure", label: "Exposure", type: "select", options: ["none", "some", "significant"], group: "route" },
  { key: "water_toilets_huts", label: "Water, toilets, huts", type: "text", group: "route", wide: true },
  { key: "min_age", label: "Minimum age", type: "num", unit: "years", group: "who" },
  { key: "kid_notes", label: "Kids", type: "text", group: "who", wide: true },
  { key: "dog_policy", label: "Dogs", type: "text", group: "who", wide: true },
  { key: "season", label: "Season", type: "text", group: "when", wide: true, hint: "months open and a note" },
  { key: "best_time_of_day", label: "Best time of day", type: "text", group: "when", wide: true, hint: "and why" },
  { key: "th_name", label: "Name", type: "text", group: "trailhead" },
  { key: "th_lat", label: "Latitude", type: "lat", group: "trailhead" },
  { key: "th_lon", label: "Longitude", type: "lon", group: "trailhead" },
  { key: "th_elev", label: "Elevation", type: "num", unit: "m", group: "trailhead" },
  { key: "pk_name", label: "Lot", type: "text", group: "parking" },
  { key: "pk_fee", label: "Fee", type: "text", group: "parking" },
  { key: "pk_capacity", label: "Capacity", type: "text", group: "parking" },
  { key: "pk_fills_by", label: "Fills by", type: "text", group: "parking" },
  { key: "pk_booking_url", label: "Booking page", type: "url", group: "parking", wide: true },
  { key: "pk_shuttle", label: "Shuttle", type: "text", group: "parking", wide: true },
  { key: "permit_what", label: "What", type: "text", group: "permit", wide: true },
  { key: "permit_opens", label: "Opens", type: "text", group: "permit", hint: "e.g. 30 days before" },
  { key: "permit_url", label: "Booking page", type: "url", group: "permit", wide: true },
  { key: "geometry_source", label: "Route data", type: "select", options: ["osm_relation", "osm_ways", "parks_canada", "nps", "usfs", "manual", "none"], group: "route" },
  { key: "geometry_ids", label: "Route ids", type: "text", group: "route", hint: "OSM relation or way ids" },
];
export const FIELD: Record<string, FieldDef> = Object.fromEntries(FIELDS.map(f => [f.key, f]));

/** Validation for one field; returns an error message or "" */
export function validate(def: FieldDef, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (def.type === "num") return /^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? "" : "Enter a number above zero";
  if (def.type === "range") return /^\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?$/.test(v) ? "" : "Use a number or a range such as 3.5-4.5";
  if (def.type === "lat") return Math.abs(Number(v)) <= 90 && v !== "" && !isNaN(Number(v)) ? "" : "Latitude is between -90 and 90";
  if (def.type === "lon") return Math.abs(Number(v)) <= 180 && !isNaN(Number(v)) ? "" : "Longitude is between -180 and 180";
  if (def.type === "url") return isHttp(v) ? "" : "Must start with http:// or https://";
  if (def.type === "select") return def.options!.includes(v) ? "" : "Pick one of the options";
  return "";
}
export function isHttp(u: string): boolean { try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; } }

export const LINK_KINDS: { kind: LinkKind; label: string; group: string }[] = [
  { kind: "official", label: "Official (park or operator)", group: "Official" },
  { kind: "alltrails", label: "AllTrails", group: "Maps and tracks" },
  { kind: "komoot", label: "Komoot", group: "Maps and tracks" },
  { kind: "wikiloc", label: "Wikiloc", group: "Maps and tracks" },
  { kind: "outdooractive", label: "Outdooractive", group: "Maps and tracks" },
  { kind: "waymarked", label: "Waymarked Trails (OSM relation)", group: "Maps and tracks" },
  { kind: "gpx", label: "GPX file", group: "Maps and tracks" },
  { kind: "conditions", label: "Trail conditions and status", group: "Conditions and weather" },
  { kind: "weather", label: "Mountain forecast", group: "Conditions and weather" },
  { kind: "webcam", label: "Webcam", group: "Conditions and weather" },
  { kind: "booking", label: "Parking or permit booking", group: "Parking and transport" },
  { kind: "transit", label: "Bus, train or shuttle", group: "Parking and transport" },
  { kind: "video", label: "Video", group: "Reports and videos" },
  { kind: "report", label: "Blog or trip report", group: "Reports and videos" },
  { kind: "other", label: "Other", group: "Reports and videos" },
];
export const LINK_GROUPS = ["Official", "Maps and tracks", "Conditions and weather", "Parking and transport", "Reports and videos"];
export const KIND_GROUP: Record<string, string> = Object.fromEntries(LINK_KINDS.map(k => [k.kind, k.group]));

/** Guess the kind from a pasted URL's domain. */
export function guessKind(url: string): LinkKind | undefined {
  let h = ""; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return undefined; }
  if (/alltrails\.com$/.test(h)) return "alltrails";
  if (/komoot\.(com|de)$/.test(h)) return "komoot";
  if (/wikiloc\.com$/.test(h)) return "wikiloc";
  if (/outdooractive\.com$/.test(h)) return "outdooractive";
  if (/waymarkedtrails\.org$/.test(h) || /openstreetmap\.org$/.test(h)) return "waymarked";
  if (/youtube\.com$|youtu\.be$|vimeo\.com$/.test(h)) return "video";
  if (/\.gpx($|\?)/i.test(url)) return "gpx";
  if (/weather|meteo|wetter|mountain-forecast|yr\.no/.test(h) || /meteo|weather|wetter/.test(url)) return "weather";
  if (/webcam/.test(url)) return "webcam";
  return undefined;
}
export function domainOf(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
export const TODAY = "18 Oct 2026";

// ---- seed data ---------------------------------------------------------------------------------------------

const R = "18 Oct 2026";
const f = (v: string, src: string, conf: Conf, read = R): Fact => ({ v, src, conf, read });
const plan = (v: string): Fact => ({ v, src: "PLAN.md", conf: "operator", read: "Aug 2026" });
let n = 0;
const L = (kind: LinkKind, label: string, url: string, note?: string, opened = true): TrailLink => ({ id: `s${++n}`, kind, label, url, checked_at: R, note, opened });
const AT = (label: string, path: string, note?: string) => L("alltrails", label, `https://www.alltrails.com/trail/${path}`, note, false);
const WEATHER = L("weather", "South Tyrol mountain weather", "https://weather.province.bz.it/en/mountain-weather", "Provincial forecast by valley and altitude");
const METEO = L("conditions", "Provincia di Bolzano meteo portal", "https://meteo.provincia.bz.it/it", "Stations, webcams and bulletins; Italian");
const w = () => ({ ...WEATHER, id: `s${++n}` });
const m = () => ({ ...METEO, id: `s${++n}` });

export const TRAILS: Record<string, TrailRecord> = {
  "tre-cime": {
    facts: {
      distance_km: f("10", "Auronzo toll road site", "official"),
      elevation_gain_m: plan("450"),
      duration_hours: plan("3.5-4.5"),
      difficulty: f("moderate", "AllTrails listing: moderately challenging", "community"),
      route_shape: plan("loop"),
      surface: plan("Wide gravel, stony in places"),
      exposure: plan("none"),
      min_age: plan("6"),
      season: f("Jun-Oct; Rifugio Locatelli open in July", "AllTrails (best months) and PLAN.md", "community"),
      best_time_of_day: plan("Clockwise from a midday slot keeps the north faces lit at Locatelli"),
      water_toilets_huts: plan("Rifugio Auronzo, Lavaredo and Locatelli huts on the loop"),
      th_name: plan("Rifugio Auronzo"), th_elev: plan("2320"),
      pk_name: plan("Rifugio Auronzo toll road and car park"), pk_fee: f("EUR 40 per car, valid 12 h from the slot", "pass.auronzo.info", "official"),
      pk_capacity: plan("not published"), pk_fills_by: plan("Midday slots sell out"), pk_booking_url: f("https://pass.auronzo.info", "pass.auronzo.info", "official"),
      pk_shuttle: f("Bus 444 from Dobbiaco to Rifugio Auronzo", "fullsuitcase.com guide", "community"),
      permit_what: plan("Toll road slot, no same-day sales"), permit_opens: plan("30 days before"), permit_url: f("https://pass.auronzo.info", "pass.auronzo.info", "official"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026; no single loop relation, a person must pick the sections", "official"),
      geometry_ids: f("paths 101 (rel 1116663, 8.5 km) and 104 (rel 1657833, 4 km) are nearby", "OpenStreetMap", "official"),
    },
    hazards: [plan("Afternoon thunderstorms in July; be off the loop by 14:00 if unsettled"), plan("Crowded 09:00-12:00 at Forcella Lavaredo")],
    links: [
      L("official", "Tre Cime and Hochpustertal tourism", "https://tre-cime.info/en", "Regional tourism office"),
      L("official", "Dreizinnen Dolomites (Sesto, Tre Cime)", "https://www.dreizinnen.com/en", "Tourism office, route and webcam pages"),
      L("waymarked", "OpenStreetMap relation 1116663 (path 101)", "https://www.openstreetmap.org/relation/1116663", "One section near the loop, not the whole loop"),
      L("official", "Auronzo municipality and toll road", "https://auronzo.info/", "Home of the toll road"),
      L("booking", "Toll road slot booking", "https://pass.auronzo.info", "Slots open 30 days ahead"),
      AT("AllTrails: Three Peaks of Lavaredo", "italy/veneto/tre-cime-di-lavaredo-drei-zinnen"),
      AT("AllTrails: Auronzo Refuge loop", "italy/south-tyrol/rifugio-auronzo-tre-cime-di-lavaredo"),
      L("komoot", "Komoot highlight: Tre Cime di Lavaredo", "https://www.komoot.com/highlight/7763769"),
      L("webcam", "Dreizinnen webcams", "https://www.dreizinnen.com/en/webcams"),
      w(), m(),
      L("report", "Circular hike Tre Cime (hiwio)", "https://www.hiwio.com/en/Article/Circular-hike-Tre-Cime-di-Lavaredo-975", "Route write-up"),
    ],
  },
  sorapis: {
    facts: {
      distance_km: plan("11"), elevation_gain_m: plan("550"), duration_hours: plan("4.5-6"),
      difficulty: f("hard", "AllTrails reviewers rate it hard", "community"),
      route_shape: f("out-and-back", "trail 215 from Passo Tre Croci", "community"),
      surface: f("Path with ladders, boards and cabled ledges", "PLAN.md", "operator", "Aug 2026"),
      exposure: f("significant", "ladders, boards, cables", "operator", "Aug 2026"),
      min_age: plan("10"),
      season: f("May-Oct on AllTrails; snow-free from late June", "AllTrails and PLAN.md", "community"),
      best_time_of_day: plan("Water is most turquoise 09:00-11:00"),
      water_toilets_huts: f("Rifugio Vandelli at the lake: lunch 11:30-14:30, cash only", "PLAN.md", "operator", "Aug 2026"),
      th_name: plan("Passo Tre Croci"), th_elev: plan("1805"),
      pk_name: plan("Passo Tre Croci roadside lot"), pk_fee: plan("Free"), pk_capacity: plan("about 20 cars"), pk_fills_by: plan("06:00-06:30 in July"),
      pk_shuttle: f("DolomitiBus line 30/31 Cortina - Misurina stops at the pass", "moonhoneytravel.com / europe.stripes.com", "community"),
      geometry_source: f("osm_relation", "Overpass query near the lake, 18 Oct 2026", "official"), geometry_ids: f("3985745 (path 215, 10.7 km)", "OpenStreetMap", "official"),
    },
    hazards: [plan("Exposure: ladders, boards and cabled ledges (Cengia del Banco)"), plan("Do not use trail 216 as a return loop")],
    links: [
      L("official", "Cortina d'Ampezzo Dolomiti tourism", "https://www.cortinadolomiti.it/", "Regional tourism office; no page for this trail found yet"),
      L("waymarked", "Waymarked Trails: path 215, Passo Tre Croci", "https://hiking.waymarkedtrails.org/#route?id=3985745", "OSM relation 3985745, 10.7 km, CAI Belluno"),
      AT("AllTrails: Lake Sorapis, Vandelli Refuge", "italy/veneto/lago-sorapis-rifugio-vandelli-rifugio-e-lago-d-antorno"),
      AT("AllTrails: Rifugio Cristallo, Sorapis loop", "italy/veneto/anello-rifugio-cristallo-lago-di-sorapis"),
      w(), m(),
      L("report", "Lake Sorapis hike guide (fullsuitcase)", "https://fullsuitcase.com/lake-sorapis-hike-italy/", "Distance and parking notes"),
    ],
  },
  braies: {
    facts: {
      distance_km: plan("3.7"), elevation_gain_m: plan("30"), max_elevation_m: f("1528", "Suedtirol Guide listing", "official"),
      duration_hours: plan("1-1.5"), difficulty: f("easy", "Komoot rates the loop easy", "community"),
      route_shape: plan("loop"), surface: f("West shore wide and flat; east shore narrow with rock-cut steps", "hoehenrausch.de report", "community"),
      exposure: f("some", "east shore passes close to the wall", "community"),
      kid_notes: f("Not suitable for pushchairs (steps on the east side)", "hoehenrausch.de", "community"),
      season: plan("Access limited in July-Sept: online reservation for parking or transit"),
      best_time_of_day: plan("First light: sunrise 05:32, alpenglow on the Seekofel; boats moored before 08:00"),
      water_toilets_huts: plan("Toilets, cafe and boat rental at the lake"),
      th_name: plan("Lago di Braies hotel"), th_elev: plan("1496"),
      pk_name: plan("P4, Lago di Braies"), pk_fee: plan("EUR 44 incl. a EUR 22 voucher"), pk_fills_by: plan("Before 09:00 without a booking"),
      pk_shuttle: plan("Bus 442 from Villabassa (check 2027 times)"), pk_booking_url: f("https://www.prags.bz/en", "prags.bz", "official"),
      permit_what: plan("Parking P4 online, before the day"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026", "official"), geometry_ids: f("12043472 (Seeweg, the lake path)", "OpenStreetMap", "official"),
    },
    hazards: [plan("Crowds: 17,000 visitors on peak summer days, per AllTrails summary"), plan("East shore steps are wet early in the morning")],
    links: [
      L("official", "Prags tourism: Braies access rules", "https://www.prags.bz/en", "Parking and access"),
      L("komoot", "Komoot: Lago di Braies loop", "https://www.komoot.com/smarttour/319390", "3.84 km, 70 m, easy"),
      AT("AllTrails: Lake Braies Loop", "italy/south-tyrol/lago-di-braies-pragser-wildsee"),
      L("waymarked", "OpenStreetMap relation 12043472 (Seeweg)", "https://www.openstreetmap.org/relation/12043472", "The lake path"),
      L("booking", "Prags: parking and access booking", "https://www.prags.bz/en", "Same site; look for the booking page"),
      w(), m(),
      L("report", "Walk around Lago di Braies (hoehenrausch)", "https://www.hoehenrausch.de/en/hikes/italy/south-tyrol/dolomites/pragser-wildsee-lake-prags-lago-di-braies/", "Route report"),
    ],
  },
  fiscalina: {
    facts: {
      distance_km: f("4.7", "dreizinnen.com listing, one way from Sesto", "official"), elevation_gain_m: f("190", "dreizinnen.com listing", "official"),
      duration_hours: plan("1"), difficulty: f("easy", "dreizinnen.com: wide, very easy path", "official"),
      route_shape: f("out-and-back", "Talschlusshutte is the turning point", "inferred"),
      surface: f("Asphalt or gravel, wide", "dreizinnen.com", "official"), exposure: f("none", "dreizinnen.com", "official"),
      kid_notes: f("Winter walks with a buggy are listed, so a pushchair works on this track", "dreizinnen.com", "official"),
      dog_policy: f("Dogs welcome on a leash", "AllTrails listing", "community"),
      season: f("Year-round walk; shuttle 440 runs 14 Jun - 11 Oct 2026, line 446 otherwise", "volpidelvajolet.it", "community"),
      water_toilets_huts: plan("Fischleinbodenhutte and Talschlusshutte (1548 m)"),
      th_name: plan("Piano Fiscalina / Moso car park"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026", "official"), geometry_ids: f("1116674 (path 102, named by dreizinnen.com)", "OpenStreetMap", "official"),
      pk_name: plan("Piano Fiscalina"), pk_fee: plan("Paid"), pk_shuttle: f("Line 440 Sesto - Val Fiscalina in season, 446 outside it", "volpidelvajolet.it", "community"),
    },
    hazards: [plan("Cars restricted in the valley in season; use the shuttle")],
    links: [
      L("official", "Dreizinnen: Sexten - Val Fiscalina - Talschlusshutte", "https://www.dreizinnen.com/en/activity/hiking-path-sexten-val-fiscalina-rif-fondo-valle-moos_442", "Official route sheet"),
      L("waymarked", "OpenStreetMap relation 1116674 (path 102)", "https://www.openstreetmap.org/relation/1116674", "Path 102 to the Fischleinbodenhutte"),
      L("komoot", "Komoot: Fischleintal loop", "https://www.komoot.com/smarttour/12334747", "About 12 km, moderate"),
      AT("AllTrails: Moos - Talschlusshutte", "italy/south-tyrol/moos-val-fiscalina-rifugio-fondo-valle"),
      L("webcam", "Dreizinnen webcams", "https://www.dreizinnen.com/en/webcams"),
      w(), m(),
    ],
  },
  seceda: {
    facts: {
      distance_km: plan("3"), elevation_gain_m: plan("100"), duration_hours: plan("1.5"),
      route_shape: f("out-and-back", "ridge from the top station", "inferred"), exposure: f("some", "guide notes steep drops either side", "inferred"),
      season: f("Lifts run late May - early Nov", "bookatrekking.com / AllTrails summaries", "community"),
      best_time_of_day: plan("The view is along the ridge toward the Fermeda towers, not at the top station"),
      th_name: plan("Seceda top station"), th_elev: f("2457", "AllTrails listing", "community"),
      pk_name: plan("Ortisei valley station"), pk_fee: f("About EUR 30 a day reported", "AllTrails reviewer", "community"),
      permit_what: plan("Lift slots pre-booked, 30 min, non-refundable; EUR 74 return"),
      geometry_source: f("none", "no ridge relation found near the top station, 18 Oct 2026", "inferred"),
    },
    hazards: [f("Wild camping is forbidden on the ridge and in Puez-Odle Nature Park", "bookatrekking.com", "community"), f("Forcella Pana is often blocked by rockfall", "AllTrails summary", "community")],
    links: [
      L("official", "Seceda summer lift page and slots", "https://www.seceda.it/en/summer"),
      L("official", "Val Gardena: Seceda ridge line", "https://www.valgardena.it/en/summer-holidays-dolomites/trekking/seceda/ridge-line-1/", "Official route description"),
      L("booking", "Seceda lift slots", "https://www.seceda.it/en/summer", "Pre-booked slots"),
      L("webcam", "Seceda webcams", "https://www.seceda.it/en/webcam"),
      L("webcam", "Val Gardena webcams", "https://www.valgardena.it/en/webcams"),
      AT("AllTrails: Seceda - Pieralongia Hut", "italy/south-tyrol/seceda-malga-pieralongia"),
      AT("AllTrails: Seceda panoramic trail to Ortisei", "italy/south-tyrol/seceda-rifugio-firenze-san-giacomo-ortisei"),
      w(), m(),
    ],
  },
  "cinque-torri": {
    facts: {
      distance_km: f("2", "Audley Travel short loop from Scoiattoli", "community"), duration_hours: f("1", "Audley Travel", "community"),
      difficulty: f("easy", "guide: virtually flat", "community"), route_shape: f("loop", "loop around the towers", "community"),
      exposure: plan("none"), min_age: plan("10"),
      season: f("Chairlift runs June-Oct", "AllTrails summary", "community"),
      water_toilets_huts: f("Rifugio Cinque Torri and Scoiattoli; WWI open-air museum on the loop", "AllTrails summary", "community"),
      th_name: f("Baita Bai de Dones (chairlift lower station)", "Audley Travel", "community"),
      pk_name: f("Bai de Dones", "Audley Travel", "community"), pk_fee: f("Free at the lower station", "Audley Travel", "community"),
      geometry_source: f("osm_ways", "ways only per the 17 Oct research", "official", "17 Oct 2026"),
      geometry_ids: f("ways 229103971, 318733621, 363006574", "trails-and-media research", "official", "17 Oct 2026"),
    },
    hazards: [plan("Beginner via ferrata at the towers needs comfort with heights"), f("Descent on trail 440 is sparsely marked", "Audley Travel", "community")],
    links: [
      L("official", "5 Torri lifts and huts", "https://www.5torri.it", "Chairlift dates and prices"),
      L("komoot", "Komoot highlight: Cinque Torri", "https://www.komoot.com/highlight/6877013"),
      AT("AllTrails: Cinque Torri Loop", "italy/veneto/giro-cinque-torri"),
      AT("AllTrails: Cinque Torri via Bai de Dones", "italy/veneto/baita-bai-de-dones-cinque-torri"),
      w(), m(),
    ],
  },
  "fanes-falls": {
    facts: {
      distance_km: f("6", "existing prototype catalogue", "inferred", "Aug 2026"), elevation_gain_m: f("300", "existing prototype catalogue", "inferred", "Aug 2026"),
      season: f("Jun-Sep on AllTrails", "AllTrails summary", "community"),
      kid_notes: f("A via ferrata runs through the gorge; not for small children", "AllTrails summary", "community"),
    },
    hazards: [],
    links: [
      AT("AllTrails: Rifugio Fanes via Cascate Fanes", "italy/veneto/rifugio-fanes-via-cascate-fanes"),
      L("official", "Cortina d'Ampezzo Dolomiti tourism", "https://www.cortinadolomiti.it/", "No page for the falls found yet"),
      w(), m(),
    ],
  },
  federa: {
    facts: {
      distance_km: f("9", "existing prototype catalogue", "inferred", "Aug 2026"), elevation_gain_m: f("750", "existing prototype catalogue", "inferred", "Aug 2026"),
      season: f("Jun-Oct; frozen and snowy in April", "AllTrails reviews", "community"),
      th_name: f("Ponte di Ru Curto, Passo Giau road", "AllTrails summary", "community"),
      pk_name: f("Ru Curto", "AllTrails summary", "community"), pk_capacity: f("Small and often full", "AllTrails summary", "community"),
      pk_shuttle: f("Summer shuttle from Cortina suggested", "AllTrails summary", "community"),
    },
    hazards: [],
    links: [AT("AllTrails: Lake Federa via Pian del Pantan", "italy/veneto/lago-federa-via-pian-del-pantan"), L("official", "Cortina d'Ampezzo Dolomiti tourism", "https://www.cortinadolomiti.it/"), w(), m()],
  },
  nuvolau: {
    facts: {
      distance_km: f("4", "existing prototype catalogue", "inferred", "Aug 2026"), elevation_gain_m: f("350", "existing prototype catalogue", "inferred", "Aug 2026"),
      max_elevation_m: f("2575", "Nuvolau hut altitude, AllTrails summary", "community"),
      season: f("Lifts closed Nov and Apr; Nuvolau hut not always open", "AllTrails summaries", "community"),
      permit_what: plan("Lunch at Averau, +39 0436 4660"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026", "official"), geometry_ids: f("436 Sentiero delle Trincee (rel 15791396) nearby", "OpenStreetMap", "official"),
    },
    hazards: [],
    links: [L("official", "5 Torri lifts and huts", "https://www.5torri.it", "Fedare and Giau chairlift dates"), AT("AllTrails: Nuvolau via Rifugio Averau", "italy/veneto/rifugio-nuvolau-via-rifugio-averau"), AT("AllTrails: Fedare - Averau - Nuvolau", "italy/veneto/rifugio-fedare-rifugio-averau-rifugio-nuvolau"), w(), m()],
  },
  lagazuoi: {
    facts: {
      distance_km: f("3", "existing prototype catalogue", "inferred", "Aug 2026"), elevation_loss_m: plan("647"), duration_hours: plan("2-2.5"), min_age: plan("10"),
      exposure: f("some", "tunnels are dark, slippery and steep", "community"),
      season: f("Cable car early June to mid-October", "AllTrails summary", "community"),
      pk_name: plan("Passo Falzarego"), pk_fee: plan("Free all summer"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026", "official"), geometry_ids: f("2282556 (Kaiserjager Steig, the way up, not the tunnels)", "OpenStreetMap", "official"),
    },
    hazards: [plan("Tunnels are pitch black; headlamp mandatory"), plan("Cold, damp, steep rock-cut stairs")],
    links: [L("official", "Rifugio Lagazuoi", "https://www.rifugiolagazuoi.com/en"), L("waymarked", "OpenStreetMap relation 2282556 (Kaiserjager Steig)", "https://www.openstreetmap.org/relation/2282556", "The via ferrata path, not the tunnels"), AT("AllTrails: Lagazuoi tunnels", "italy/veneto/monte-lagazuoi-le-gallerie-dell-anticima-del-lagazuoi"), w(), m()],
  },
  siusi: {
    facts: {
      distance_km: f("6.8", "existing prototype catalogue", "inferred", "Aug 2026"), elevation_gain_m: f("200", "existing prototype catalogue", "inferred", "Aug 2026"),
      permit_what: plan("Cable car from Siusi, EUR 30 return; driving banned 09:00-17:00"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026", "official"), geometry_ids: f("9485181 (Seiser-Alm-Steig, path 12)", "OpenStreetMap", "official"),
    },
    hazards: [],
    links: [
      L("waymarked", "OpenStreetMap relation 9485181 (Seiser-Alm-Steig)", "https://www.openstreetmap.org/relation/9485181", "Plateau path 12"),
      L("official", "Seiser Alm tourism", "https://www.seiser-alm.it/en/"), L("official", "Alpe di Siusi Marketing", "https://www.alpedisiusi.com/"),
      AT("AllTrails: Alpe di Siusi family tour", "italy/south-tyrol/giro-per-famiglie-alpe-di-siusi-val-gardena"), w(), m(),
    ],
  },
  munkel: {
    facts: {
      distance_km: f("8", "existing prototype catalogue", "inferred", "Aug 2026"), elevation_gain_m: f("420", "existing prototype catalogue", "inferred", "Aug 2026"),
      exposure: plan("none"),
      th_name: plan("Zannes (Zanser Alm)"), th_elev: plan("1680"),
      pk_name: plan("Zannes / Zanser Alm"), pk_fee: plan("Pay on arrival when the light is green"), pk_fills_by: plan("Traffic light turns red when full: pre-booked only"),
      pk_shuttle: plan("Bus 330 from Ranui"),
      geometry_source: f("osm_relation", "Overpass query 18 Oct 2026, exact name match", "official"), geometry_ids: f("2442695 Adolf Munkel Weg - Via delle Odle", "OpenStreetMap", "official"),
    },
    hazards: [],
    links: [L("waymarked", "OpenStreetMap relation 2442695", "https://www.openstreetmap.org/relation/2442695", "Adolf Munkel Weg - Via delle Odle"), AT("AllTrails: Via delle Odle (Adolf Munkel Weg)", "italy/south-tyrol/via-delle-odle-adolf-munkel-weg-alpe-di-funes"), w(), m()],
  },
};

const EMPTY = (): TrailRecord => ({ facts: {}, hazards: [], links: [] });

// ---- session store: edits survive navigating away and back ---------------------------------------------------------
let state: Record<string, TrailRecord> = {};
const subs = new Set<() => void>();
const emit = () => { state = { ...state }; subs.forEach(s => s()); };
export function getTrail(id: string): TrailRecord { return state[id] ?? TRAILS[id] ?? EMPTY(); }
function mutate(id: string, fn: (r: TrailRecord) => TrailRecord) {
  const base = state[id] ?? TRAILS[id] ?? EMPTY();
  state[id] = fn({ facts: { ...base.facts }, hazards: [...base.hazards], links: [...base.links] });
  emit();
}
export function useTrail(id: string): TrailRecord {
  useSyncExternalStore(s => { subs.add(s); return () => { subs.delete(s); }; }, () => state);
  return getTrail(id);
}
export const mine = (v: string): Fact => ({ v, you: true, added: "today" });
export function saveFacts(id: string, changes: Record<string, string>) {
  mutate(id, r => {
    for (const [k, v] of Object.entries(changes)) {
      const old = r.facts[k];
      if (v.trim() === "") { delete r.facts[k]; continue; }
      if (old && old.v === v.trim()) continue;
      r.facts[k] = mine(v.trim());
    }
    return r;
  });
}
export function addLink(id: string, l: Omit<TrailLink, "id" | "you" | "checked_at">) {
  mutate(id, r => ({ ...r, links: [...r.links, { ...l, id: `u${Date.now()}`, you: true }] }));
}
export function removeLink(id: string, linkId: string) { mutate(id, r => ({ ...r, links: r.links.filter(l => l.id !== linkId) })); }
export function addHazard(id: string, text: string) { mutate(id, r => ({ ...r, hazards: [...r.hazards, mine(text)] })); }
export function removeHazard(id: string, i: number) { mutate(id, r => ({ ...r, hazards: r.hazards.filter((_, j) => j !== i) })); }
export function sendFactForReview(id: string, key: string) { mutate(id, r => { if (r.facts[key]) r.facts[key] = { ...r.facts[key], sent: true }; return r; }); }
export function sendHazardForReview(id: string, i: number) { mutate(id, r => { r.hazards[i] = { ...r.hazards[i], sent: true }; return r; }); }
export function sendLinkForReview(id: string, linkId: string) { mutate(id, r => ({ ...r, links: r.links.map(l => l.id === linkId ? { ...l, sent: true } : l) })); }
