// Trail records keyed by place id. Field names follow research/method/lanes/trails.md and
// travel/research/reports/trails-and-media-2026-10-18.md section 1 (fallback chain, link-only platforms).
// Every researched value carries a source and the date it was read. A value typed in by a person carries
// `you: true` instead and waits for review (in the real app research proposes and review verifies).
import { useSyncExternalStore } from "react";

export type Conf = "official" | "operator" | "community" | "inferred";
export interface Conflict { v: string; src: string; conf: Conf; read: string }
export interface Fact { v: string; src?: string; conf?: Conf; read?: string; you?: boolean; added?: string; sent?: boolean; conflict?: Conflict[] }

export type LinkKind =
  | "official" | "alltrails" | "komoot" | "wikiloc" | "outdooractive" | "gaia" | "fatmap" | "osm" | "waymarked" | "gpx" | "map_sheet"
  | "conditions" | "weather" | "webcam" | "booking" | "transit" | "video" | "report" | "other";
export interface TrailLink { id: string; kind: LinkKind; url: string; label: string; checked_at?: string; note?: string; opened?: boolean; you?: boolean; sent?: boolean }

export type GeomSource = "osm_relation" | "osm_ways" | "parks_canada" | "nps" | "usfs" | "manual" | "none";
/** A stored point (trails lane section 4). Never copied from Google Maps; navigation links are generated from it. */
export interface Point { lat: number; lon: number; point_source: string; point_checked: string }
export interface Trailhead extends Point { name: string; kind?: "guidepost" | "path_start" | "lift_top" | "trailhead"; elev_m?: number; note?: string }
export interface ParkingLot extends Point { name: string; fee?: string; capacity?: string; note?: string }

/** Link checklist (trails lane section 3): every kind is filled, found in search, or searched with nothing found. */
export type CheckKind =
  | "official" | "conditions" | "osm" | "gpx_download" | "alltrails" | "komoot" | "outdooractive" | "wikiloc" | "gaia" | "fatmap"
  | "trip_report" | "webcam" | "map_sheet" | "video" | "booking";
export const CHECK_KINDS: { kind: CheckKind; label: string; links: LinkKind[]; optional?: boolean }[] = [
  { kind: "official", label: "Official", links: ["official"] },
  { kind: "conditions", label: "Conditions", links: ["conditions"] },
  { kind: "osm", label: "OpenStreetMap", links: ["osm", "waymarked"] },
  { kind: "gpx_download", label: "GPX download", links: ["gpx"] },
  { kind: "alltrails", label: "AllTrails", links: ["alltrails"] },
  { kind: "komoot", label: "Komoot", links: ["komoot"] },
  { kind: "outdooractive", label: "Outdooractive", links: ["outdooractive"] },
  { kind: "wikiloc", label: "Wikiloc", links: ["wikiloc"] },
  { kind: "gaia", label: "Gaia GPS", links: ["gaia"], optional: true },
  { kind: "fatmap", label: "FATMAP", links: ["fatmap"], optional: true },
  { kind: "trip_report", label: "Trip report", links: ["report"] },
  { kind: "webcam", label: "Webcam", links: ["webcam"] },
  { kind: "map_sheet", label: "Map sheet", links: ["map_sheet"] },
  { kind: "video", label: "Video", links: ["video"] },
  { kind: "booking", label: "Booking", links: ["booking"] },
];
export interface SearchedNone { date: string; query: string; note?: string }
export type CheckState =
  | { state: "url"; count: number }
  | { state: "found_in_search"; count: number; date: string }
  | { state: "searched_none"; date: string; query: string; note?: string }
  | { state: "not_checked" };

export interface TrailRecord {
  facts: Record<string, Fact>;   // keyed by FIELD key, see FIELDS
  hazards: Fact[];
  links: TrailLink[];
  trailhead?: Trailhead;
  parking?: ParkingLot[];
  none?: Partial<Record<CheckKind, SearchedNone>>;
}

/** The checklist state per kind, derived from the links so a link added by a person fills its kind at once. */
export function checklist(rec: TrailRecord): { kind: CheckKind; label: string; optional?: boolean; st: CheckState }[] {
  return CHECK_KINDS.map(c => {
    const ls = rec.links.filter(l => c.links.includes(l.kind));
    if (ls.length && ls.every(l => l.opened === false && !l.you)) return { ...c, st: { state: "found_in_search", count: ls.length, date: ls[0].checked_at ?? R } };
    if (ls.length) return { ...c, st: { state: "url", count: ls.length } };
    const n = rec.none?.[c.kind];
    return { ...c, st: n ? { state: "searched_none", ...n } : { state: "not_checked" } };
  });
}

/** "osm_node 123" -> "OpenStreetMap node 123"; "official <url>" -> "official map <domain>". */
export function sourceLabel(src: string): string {
  const m = src.match(/^osm_(node|way|relation)\s+(\d+)/);
  if (m) return `OpenStreetMap ${m[1]} ${m[2]}`;
  if (src.startsWith("official ")) return `official map, ${domainOf(src.slice(9).trim())}`;
  if (src.startsWith("manual_pin")) return "pinned by a person";
  if (src.startsWith("gps")) return "a recorded GPS track";
  return src;
}
export function osmUrl(src: string): string | undefined {
  const m = src.match(/^osm_(node|way|relation)\s+(\d+)/);
  return m ? `https://www.openstreetmap.org/${m[1]}/${m[2]}` : undefined;
}
/** "agent: checked ..., 2026-10-18; needs a person's check" -> "checked by agent 18 Oct 2026". */
export function checkedLabel(c: string): { who: string; needsPerson: boolean } {
  const d = c.match(/(\d{4})-(\d{2})-(\d{2})/);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = d ? `${Number(d[3])} ${mon[Number(d[2]) - 1]} ${d[1]}` : "";
  const who = c.startsWith("agent") ? "agent" : c.split(":")[0];
  return { who: `checked by ${who}${date ? " " + date : ""}`, needsPerson: /needs a person/.test(c) };
}
/** Navigation deep links built from our point at render time (never stored). */
export const nav = (p: { lat: number; lon: number }) => ({
  google: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`,
  apple: `https://maps.apple.com/?daddr=${p.lat},${p.lon}`,
});
export const fmtPoint = (p: { lat: number; lon: number }) => `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;

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
  { kind: "gaia", label: "Gaia GPS", group: "Maps and tracks" },
  { kind: "fatmap", label: "FATMAP", group: "Maps and tracks" },
  { kind: "osm", label: "OpenStreetMap", group: "Maps and tracks" },
  { kind: "waymarked", label: "Waymarked Trails (OSM relation)", group: "Maps and tracks" },
  { kind: "gpx", label: "GPX file", group: "Maps and tracks" },
  { kind: "map_sheet", label: "Map sheet", group: "Maps and tracks" },
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
  if (/waymarkedtrails\.org$/.test(h)) return "waymarked";
  if (/openstreetmap\.org$/.test(h)) return "osm";
  if (/gaiagps\.com$/.test(h)) return "gaia";
  if (/tabaccoeditrice\.(it|com)$|kompass\.(de|at|it)$/.test(h)) return "map_sheet";
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

// ---- trailheads and parking (trails lane section 4) ---------------------------------------------------------
// Every point is WGS84 to 5 decimals from OpenStreetMap via Overpass (queried 18 Oct 2026, within ~2 km of the
// place), never from Google. A person still confirms each point against the map before publishing.
const CHK = "agent: checked against OSM features nearby, 2026-10-18; needs a person's check";
const th = (name: string, lat: number, lon: number, point_source: string, extra: Partial<Trailhead> = {}): Trailhead => ({ name, lat, lon, point_source, point_checked: CHK, ...extra });
const lot = (name: string, lat: number, lon: number, point_source: string, extra: Partial<ParkingLot> = {}): ParkingLot => ({ name, lat, lon, point_source, point_checked: CHK, ...extra });

export const ACCESS: Record<string, { trailhead: Trailhead; parking: ParkingLot[] }> = {
  "tre-cime": {
    trailhead: th("Rifugio Auronzo, start of path 101", 46.61203, 12.29648, "osm_node 2430381561", { kind: "guidepost", elev_m: 2320, note: "Signpost east of the hut where path 101 leaves for Rifugio Lavaredo" }),
    parking: [
      lot("Parcheggio Rifugio Auronzo P1", 46.61285, 12.29267, "osm_way 1109742730", { fee: "Toll road fee covers parking (OSM: fee=yes)", note: "Reached only by the Auronzo toll road from Misurina" }),
      lot("Parcheggio Rifugio Auronzo P2", 46.61335, 12.29239, "osm_way 1109742731", { fee: "Toll road fee covers parking (OSM: fee=yes)" }),
      lot("Parcheggio Rifugio Auronzo P3", 46.6143, 12.29222, "osm_way 1220017592", { fee: "Toll road fee covers parking (OSM: fee=yes)" }),
      lot("Parcheggio Rifugio Auronzo P4", 46.61356, 12.29439, "osm_way 74709399", { fee: "Toll road fee covers parking (OSM: fee=yes)", note: "Closest named lot to the hut" }),
    ],
  },
  sorapis: {
    trailhead: th("Passo Tre Croci, start of path 215", 46.55605, 12.20487, "osm_node 14166465331", { kind: "guidepost", elev_m: 1805, note: "Signpost 11 m from the first node of path 215 (OSM relation 3985745)" }),
    parking: [
      lot("Passo Tre Croci roadside parking", 46.5562, 12.20437, "osm_node 4243966568", { fee: "Free", capacity: "about 20 cars (PLAN.md)", note: "OSM: parking=street_side on the SR48 at the pass" }),
      lot("Unsigned lot 600 m west of the pass", 46.55625, 12.19861, "osm_way 624331260", { note: "Untagged lot in OSM; walk 6-8 min east along the road to the trailhead" }),
    ],
  },
  braies: {
    trailhead: th("Hotel Lago di Braies, north shore", 46.69898, 12.08554, "osm_node 2984514849", { kind: "guidepost", elev_m: 1496, note: "Signpost 6 m from the Seeweg lake path (OSM relation 12043472)" }),
    parking: [
      lot("P4, Lago di Braies", 46.70039, 12.0847, "osm_way 442280371", { fee: "Sources disagree: EUR 44 booked online (PLAN.md) or EUR 15/day (OSM); see Parking fee", note: "Closest lot, 3-4 min walk" }),
      lot("P3, Lago di Braies", 46.70176, 12.08502, "osm_way 26323119", { fee: "Paid (OSM: fee=yes)", note: "5 min walk" }),
      lot("P2, Lago di Braies", 46.70554, 12.08668, "osm_way 1416686228", { fee: "OSM note: EUR 40 incl. parking, access permit and EUR 20 voucher", note: "Operator Tourismusverein Prags; 12 min walk" }),
      lot("P1 (name not tagged in OSM)", 46.70059, 12.08572, "osm_way 985152978", { fee: "Paid (OSM: fee=yes)", note: "Unnamed lot beside the bus stop 'Lago di Braies P1' (OSM node 12106651301); confirm this is P1" }),
    ],
  },
  fiscalina: {
    trailhead: th("Piano Fiscalina / Fischleinboden", 46.66684, 12.35448, "osm_node 12456211537", { kind: "guidepost", note: "Signpost at the car park; path 102 runs from here (OSM relation 1116674 passes 24 m away)" }),
    parking: [
      lot("Fischleinboden car park", 46.66739, 12.35342, "osm_way 98002215", { fee: "Paid (OSM: fee=yes)", note: "End of the public road from Moos; shuttle 440 stops here in season" }),
    ],
  },
  seceda: {
    trailhead: th("Seceda top station", 46.59794, 11.72435, "osm_node 296550944", { kind: "lift_top", elev_m: 2493, note: "The ridge walk starts at the top of the Ortisei - Furnes - Seceda lift; drive to a valley station, not here" }),
    parking: [
      lot("Ortisei, Seceda lift multi-storey", 46.57669, 11.67574, "osm_way 689203858", { fee: "2.80 EUR/hour (OSM)", capacity: "250 (OSM)", note: "Beside the Ortisei - Furnes valley station (OSM node 1638308249)" }),
      lot("Col Raiser P1, Santa Cristina", 46.56474, 11.73624, "osm_way 29748660", { fee: "10 EUR/24 h (OSM)", capacity: "120 (OSM)", note: "The cheaper door: Col Raiser gondola, then about 1 h walk to Seceda" }),
      lot("Col Raiser P2", 46.56595, 11.73672, "osm_way 42303633", { fee: "10 EUR/24 h (OSM)", capacity: "62 (OSM)" }),
    ],
  },
  "cinque-torri": {
    trailhead: th("Bai de Dones, 5 Torri chairlift base", 46.51839, 12.03797, "osm_node 908679868", { kind: "guidepost", elev_m: 1889, note: "The loop itself starts at Rifugio Scoiattoli at the top (signpost 46.50780, 12.04668, OSM node 12080164274)" }),
    parking: [
      lot("Seggiovia 5 Torri car park", 46.51882, 12.03741, "osm_way 900787870", { fee: "Free (OSM: fee=no)", note: "Operator Seggiovia 5 Torri, on the Falzarego road" }),
    ],
  },
  "fanes-falls": {
    trailhead: th("Sant'Uberto", 46.60263, 12.10671, "osm_node 7920730765", { kind: "guidepost", elev_m: 1425, note: "Road to Pian de Loa is closed to cars from here; falls signpost 'Cascata di Fanes' at 46.59358, 12.08482 (OSM node 12881191290)" }),
    parking: [
      lot("Parcheggio Sant'Uberto", 46.60283, 12.10656, "osm_relation 11641747", { fee: "EUR 8/day, 6 Jul - 6 Sep 2026 (park office); OSM agrees", note: "Off the SS51 north of Fiames" }),
    ],
  },
  federa: {
    trailhead: th("Ponte de Rucurto, Passo Giau road", 46.50584, 12.07888, "osm_node 3637916764", { kind: "guidepost", elev_m: 1700, note: "Start of path 437 to Lago Federa" }),
    parking: [
      lot("Ru Curto roadside parking", 46.5061, 12.0795, "osm_way 1553888264", { fee: "Free (OSM: fee=no)", capacity: "Small and often full (AllTrails summary)" }),
      lot("Ru Curto roadside, west side", 46.50577, 12.07846, "osm_node 2444691902", { note: "OSM: parking=street_side by the bridge" }),
    ],
  },
  nuvolau: {
    trailhead: th("Passo Giau", 46.48248, 12.05386, "osm_node 5760644179", { kind: "guidepost", elev_m: 2236, note: "Walk start for Averau and Nuvolau; the Fedare chairlift is the shorter way up" }),
    parking: [
      lot("Passo Giau car park", 46.48238, 12.05468, "osm_way 961430249", { note: "OSM: parking=surface, fee not tagged" }),
      lot("Rifugio Fedare, chairlift base", 46.4873, 12.03454, "osm_way 323507231", { note: "Beside the Fedare - Nuvolau chairlift (OSM node 361227706), 2 km west of the pass" }),
    ],
  },
  lagazuoi: {
    trailhead: th("Lagazuoi cable car top station", 46.52751, 12.00892, "osm_node 360633381", { kind: "lift_top", elev_m: 2733, note: "The tunnels descend from here to Passo Falzarego; drive to the valley station (OSM node 360633380)" }),
    parking: [
      lot("Passo Falzarego, cable car lot", 46.51949, 12.00841, "osm_way 31355241", { fee: "Sources disagree: free in summer 2026 (operator) or EUR 5/day (OSM); see Parking fee", note: "Next to the valley station" }),
      lot("Passo Falzarego, free lot", 46.51861, 12.00922, "osm_way 171636522", { fee: "Free (OSM: fee=no)" }),
    ],
  },
  siusi: {
    trailhead: th("Compatsch, cable car top station", 46.54236, 11.617, "osm_node 102561714", { kind: "lift_top", elev_m: 1857, note: "Seiser Alm Bahn top; the plateau walks start here" }),
    parking: [
      lot("Seis / Siusi cable car multi-storey", 46.54096, 11.56553, "osm_way 262028695", { fee: "Paid (OSM: fee=yes)", capacity: "250 (OSM)", note: "Valley station (OSM node 102561253); the road to Compatsch is closed 09:00-17:00" }),
      lot("Compatsch P2", 46.53988, 11.61696, "osm_way 96095936", { fee: "28.50 EUR/day (OSM)", note: "Only if you drive up before 09:00 or after 17:00, or with a hotel permit" }),
    ],
  },
  munkel: {
    trailhead: th("Zanser Alm / Malga Zannes", 46.63567, 11.76576, "osm_node 9812786780", { kind: "guidepost", elev_m: 1680, note: "Puez-Odle park signpost; the Munkel Weg (OSM relation 2442695) is joined about 1.5 km up" }),
    parking: [
      lot("Zanserhutte - Rifugio Zannes car park", 46.63554, 11.76508, "osm_relation 14247240", { fee: "10 EUR/day (OSM)", note: "Traffic light on the access road: green = drive up and pay; red = full" }),
    ],
  },
  "monte-piana": {
    trailhead: th("Lago d'Antorno, start of path 122", 46.59684, 12.26652, "osm_node 277726421", { kind: "path_start", note: "Node of path 122 (OSM relation 1657839) nearest the lake" }),
    parking: [
      lot("Misurina toll booth roadside", 46.59937, 12.26998, "osm_way 1293387808", { fee: "Free (OSM: fee=no)", capacity: "15 (OSM)", note: "Before the Tre Cime toll booth, 5 min walk to the trailhead" }),
      lot("Misurina, jeep shuttle lot", 46.5886, 12.25722, "osm_way 178559094", { fee: "2 EUR/hour, 14 EUR/day, 1 May - 31 Oct (OSM)", note: "Next to the Monte Piana shuttle stop (OSM node 7952330370)" }),
    ],
  },
  seekofel: {
    trailhead: th("Hotel Lago di Braies, north shore", 46.69898, 12.08554, "osm_node 2984514849", { kind: "guidepost", elev_m: 1496, note: "Path 1 runs along the west shore, then up the Forno valley (OSM relation 1155861)" }),
    parking: [
      lot("P4, Lago di Braies", 46.70039, 12.0847, "osm_way 442280371", { fee: "Booked online in season (see Lago di Braies)" }),
      lot("P3, Lago di Braies", 46.70176, 12.08502, "osm_way 26323119", { fee: "Paid (OSM: fee=yes)" }),
      lot("P2, Lago di Braies", 46.70554, 12.08668, "osm_way 1416686228", { fee: "OSM note: EUR 40 incl. access permit" }),
    ],
  },
  vallunga: {
    trailhead: th("Vallunga car park, Selva", 46.56395, 11.77359, "osm_node 6635822140", { kind: "guidepost", note: "Signpost at the east end of the car park; path 14 (OSM relation 2465034) runs up the valley" }),
    parking: [
      lot("Val - Langental - Vallunga", 46.56408, 11.77287, "osm_way 255994108", { fee: "1 EUR/30 min (OSM)", capacity: "90 (OSM)" }),
      lot("Vallunga roadside", 46.56412, 11.77162, "osm_way 255994109", { fee: "1 EUR/hour, 8 EUR/day (OSM)", capacity: "20 (OSM)" }),
    ],
  },
  pordoi: {
    trailhead: th("Sass Pordoi top station", 46.50028, 11.80775, "osm_node 29916900", { kind: "lift_top", elev_m: 2950, note: "Piz Boe is reached from here on path 627; valley station at Passo Pordoi (OSM node 29916899)" }),
    parking: [
      lot("Passo Pordoi, by the cable car", 46.48777, 11.81106, "osm_way 167968216", { fee: "Paid (OSM: fee=yes)" }),
      lot("Passo Pordoi, west lot", 46.48796, 11.81008, "osm_way 255228203", { fee: "Paid (OSM: fee=yes)" }),
      lot("Passo Pordoi, east lot", 46.48771, 11.81414, "osm_way 38279672", { fee: "Paid (OSM: fee=yes)" }),
    ],
  },
  "viel-dal-pan": {
    trailhead: th("Passo Pordoi, start of path 601", 46.48742, 11.81296, "osm_node 469726063", { kind: "path_start", elev_m: 2239, note: "First node of path 601 Viel del Pan (OSM relation 7302436) at the pass" }),
    parking: [
      lot("Passo Pordoi, east lot", 46.48771, 11.81414, "osm_way 38279672", { fee: "Paid (OSM: fee=yes)" }),
      lot("Passo Pordoi, by the cable car", 46.48777, 11.81106, "osm_way 167968216", { fee: "Paid (OSM: fee=yes)" }),
    ],
  },
  puflatsch: {
    trailhead: th("Puflatsch lift top station", 46.55184, 11.61718, "osm_node 625195493", { kind: "lift_top", elev_m: 2104, note: "The round walk PU (OSM relation 9483250) passes 47 m away; the lift base is at Compatsch (OSM node 625195488)" }),
    parking: [
      lot("Seis / Siusi cable car multi-storey", 46.54096, 11.56553, "osm_way 262028695", { fee: "Paid (OSM: fee=yes)", capacity: "250 (OSM)", note: "Cable car to Compatsch, then the Puflatsch lift" }),
      lot("Compatsch P2", 46.53988, 11.61696, "osm_way 96095936", { fee: "28.50 EUR/day (OSM)", note: "Driving up only before 09:00 or after 17:00" }),
      lot("Compatsch P3", 46.5398, 11.61838, "osm_way 427624142", { fee: "24 EUR/day (OSM)" }),
    ],
  },
};

// ---- link research, 18 Oct 2026 (generated from the lane's link checklist run) -----------------------------------
// Every "url" link loaded (HTTP 200, or the right page through a fetch where curl was bot-blocked); AllTrails links were
// found in search and not opened. A kind with nothing found records the query, so a gap is never mistaken for "not looked".
const RESEARCH: Record<string, { links: TrailLink[]; none: Partial<Record<CheckKind, SearchedNone>> }> = {
  "tre-cime": {
    links: [
      L("official", "Drei Zinnen tourism: Three Peaks", "https://www.dreizinnen.com/en/region/highlights/three-peaks", "https://tre-cime.info/en redirects to https://www.dreizinnen.com/en (re-checked 200)", true),
      L("conditions", "South Tyrol mountain weather: Dolomites", "https://weather.province.bz.it/en/mountain-weather/dolomites", "Route is in Veneto; ARPAV Dolomiti Meteo (meteo.arpa.veneto.it/?page=DM) seen in search but unreachable from here (curl timeout, WebFetch ECONNREFUSED), so not accepted. Toll road status: pass.auronzo.info", true),
      L("osm", "OSM relation 1116663 (path 101)", "https://www.openstreetmap.org/relation/1116663", "Rifugio Lunelli to Rifugio Auronzo, 8.5 km; one section of the loop"),
      L("osm", "OSM relation 1657833 (path 104)", "https://www.openstreetmap.org/relation/1657833", "Above Rifugio Lavaredo to Forcella Pian di Cengia, 4 km"),
      L("gpx", "Drei Zinnen GPX: walk around Tre Cime", "https://www.dreizinnen.com/tours/download_gpx/569", "Returned text/xml GPX (CONTWISE MAPS). Tour page: https://www.dreizinnen.com/en/activity/summer-walk-around-the-drei-zinnen-tre-cime-three-peaks-_569 (200)", true),
      L("alltrails", "AllTrails: Three Peaks of Lavaredo", "https://www.alltrails.com/trail/italy/veneto/tre-cime-di-lavaredo-drei-zinnen", undefined, false),
      L("komoot", "Komoot highlight: Tre Cime", "https://www.komoot.com/highlight/7763769", "Re-checked 2026-10-18", true),
      L("outdooractive", "Outdooractive: Around the Tre Cime", "https://www.outdooractive.com/en/route/hiking-trail/dolomiti-d-ampezzo-dolomiti-bellunesi/around-the-tre-cime-di-lavaredo/123624926/", "curl 404 (bot block); WebFetch shows 11.2 km, 468 m ascent, start Rifugio Auronzo", true),
      L("gaia", "Gaia GPS: Rifugio Locatelli Tre Cime loop", "https://www.gaiagps.com/hike/471869/dreizinnenhutte-rifugio-locatelli-alle-tre-cime-loop/", undefined, true),
      L("report", "Hiwio report (2023-04-14)", "https://www.hiwio.com/en/Article/Circular-hike-Tre-Cime-di-Lavaredo-975", "datePublished 2023-04-14", true),
      L("webcam", "Drei Zinnen webcams", "https://www.dreizinnen.com/en/webcams", undefined, true),
      L("map_sheet", "Tabacco 010 Dolomiti di Sesto", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/010_en/", "Search hit https://tabaccoeditrice.it/?p=4628 redirects here. Retail alt: https://www.bergzeit.de/p/tabacco-sextener-dolomiten-010-wanderkarte/5002526/ (200)", true),
      L("video", "YouTube: loop to Locatelli from Auronzo", "https://www.youtube.com/watch?v=8HMd_VBqcew", "Confirmed via YouTube oEmbed (channel TRAVEL AROUND THE WORLD)", true),
      L("booking", "Auronzo toll road booking", "https://pass.auronzo.info/", "Reservation for the toll road from Misurina to Rifugio Auronzo", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "wikiloc giro Tre Cime di Lavaredo Rifugio Auronzo Locatelli", "note": "Candidate https://www.wikiloc.com/hiking-trails/giro-delle-tre-cime-di-lavaredo-cai-101-105-81889146 returned 403 to curl and WebFetch; not verified"}, fatmap: {"date": "2026-10-18", "query": "not searched", "note": "FATMAP closed in 2024 (merged into Strava)"}},
  },
  "sorapis": {
    links: [
      L("official", "Cortina tourism: To Lago Sorapis", "https://cortina.dolomiti.org/en/escursioni/to-lago-sorapis-en/", "10.5 km, 4 h, +434 m, 'For Experts', start Passo Tre Croci. Existing https://www.cortinadolomiti.it/ still 200 (generic home page). Also https://www.dolomiti.it/en/itineraries/rivers-lakes-waterfalls/lake-sorapis (200)", true),
      L("conditions", "South Tyrol mountain weather: Dolomites", "https://weather.province.bz.it/en/mountain-weather/dolomites", "Covers the whole Dolomites. Preferred Veneto source ARPAV Dolomiti Meteo (https://meteo.arpa.veneto.it/?page=DM) appears in search but connection is refused from this host (curl and WebFetch), so not verified", true),
      L("osm", "OSM relation 3985745 (path 215)", "https://www.openstreetmap.org/relation/3985745", "Passo Tre Croci to Forcella Faloria, 10.7 km, CAI"),
      L("osm", "Waymarked Trails: path 215", "https://hiking.waymarkedtrails.org/#route?id=3985745", "Same relation on a hiking map"),
      L("alltrails", "AllTrails: Sorapis - Vandelli - Antorno", "https://www.alltrails.com/trail/italy/veneto/lago-sorapis-rifugio-vandelli-rifugio-e-lago-d-antorno", "existing app link; search snippet describes it as a long loop via Lake Antorno, not the plain 215 out-and-back", false),
      L("komoot", "Komoot: Trail 215 to Lake Sorapis", "https://www.komoot.com/smarttour/e994341570/trail-215-to-lake-sorapis", undefined, true),
      L("outdooractive", "Outdooractive: Sorapis Lake (215)", "https://www.outdooractive.com/en/route/hiking-trail/dolomiti-d-ampezzo-dolomiti-bellunesi/sorapis-lake/40247381/", "by alpenvereinaktiv.com; 12.7 km, 3:45 h, +639 m from Passo Tre Croci; curl 404 bot block", true),
      L("report", "Fullsuitcase: Lake Sorapis hike (upd. 2025)", "https://fullsuitcase.com/lake-sorapis-hike-italy/", "published 2020-07-30, modified 2025-06-29", true),
      L("webcam", "Cortina webcams (Faloria/Tre Croci view)", "https://cortina.dolomiti.org/en/summer/info/webcam/", "list includes 'Faloria - Vitelli Slope, Passo Tre Croci'; no cam at the lake itself found", true),
      L("map_sheet", "Tabacco 03 Cortina d'Ampezzo 1:25k", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/03_en/", "publisher page, found via the publisher's 1:25k category listing", true),
      L("video", "YouTube: Sorapis from Passo Tre Croci, 215", "https://www.youtube.com/watch?v=QbPMTN2I3-A", "Confirmed via YouTube oEmbed (channel Paolino Iltecnico)", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "Cortina Lago di Sorapis hike official tourism page trail 215 | Lago di Sorapis sentiero 215 GPX download Cortina Dolomiti ufficiale", "note": "no GPX/KML link on cortina.dolomiti.org or dolomiti.it Sorapis pages (checked HTML); only third-party GPX found (roads-and-rivers.com/en/hiking-lago-di-sorapis/, blog), not official, so not used"}, wikiloc: {"date": "2026-10-18", "query": "Lago di Sorapis Passo Tre Croci (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/passo-tre-croci-lago-sorapis-10927368 seen in WebSearch, but wikiloc returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "Lago di Sorapis Passo Tre Croci 215 site:wikiloc.com", "note": "candidate https://www.gaiagps.com/public/9mabXaQXXq66mWpzKejhrB8H appeared in search but curl redirects to Outside login (302); not verified"}, fatmap: {"date": "2026-10-18", "query": "", "note": "FATMAP shut down in 2024; no live pages exist"}, booking: {"date": "2026-10-18", "query": "Lago di Sorapis 2026 accesso numero chiuso prenotazione Passo Tre Croci parcheggio", "note": "no booking needed: no reservation or quota system found; roadside parking at Passo Tre Croci fills early"}},
  },
  "braies": {
    links: [
      L("official", "Drei Zinnen: walk around Lago di Braies", "https://www.dreizinnen.com/en/activity/summer-walk-around-the-lake-lago-di-braies-pragser-wildsee-_644", "3.6 km, ~1 h, markers 1 and 19. Existing https://www.prags.bz/en still 200 (lake home page)", true),
      L("conditions", "Drei Zinnen weather & snow conditions", "https://www.dreizinnen.com/en/weather", "South Tyrol avalanche bulletin: https://avalanche.report/bulletin/latest (200); east shore can be icy in winter", true),
      L("osm", "OSM relation 12043472 (Seeweg)", "https://www.openstreetmap.org/relation/12043472", "The lake path, 3.5 km in OSM"),
      L("gpx", "Drei Zinnen official GPX", "https://www.dreizinnen.com/tours/download_gpx/644", "text/xml GPX, 472 trackpoints", true),
      L("alltrails", "AllTrails: Lake Braies Loop", "https://www.alltrails.com/trail/italy/south-tyrol/lago-di-braies-pragser-wildsee", undefined, false),
      L("komoot", "Komoot: Pragser Wildsee loop", "https://www.komoot.com/smarttour/319390", "title: 'View of the Seekofel - Pragser Wildsee/Lago di Braies loop from Schmieden - Ferrara' (starts at Schmieden, not the lake)", true),
      L("outdooractive", "Outdooractive: Seerundweg Pragser Wildsee", "https://www.outdooractive.com/de/route/wanderung/hochpustertal/seerundweg-pragser-wildsee/111408794/", "community author; 3.6 km, 1:02 h, +48 m; curl 404 bot block", true),
      L("gaia", "Gaia GPS: Pragser Wildsee loop", "https://www.gaiagps.com/hike/257013/pragser-wildsee-lago-di-braies-loop/", undefined, true),
      L("report", "Volpi del Vajolet: Braies guide (Jun 2026)", "https://www.volpidelvajolet.it/2026/06/lago-di-braies-guida-completa.html", "Italian; published 2026-06-01. Existing https://www.hoehenrausch.de/en/hikes/italy/south-tyrol/dolomites/pragser-wildsee-lake-prags-lago-di-braies/ still 200 (undated)", true),
      L("webcam", "Drei Zinnen webcams (Prags/Braies cams)", "https://www.dreizinnen.com/en/webcams", "page lists 'Prags / Braies' cams (Ferrara, Prato Piazza, Skilift Braies). Also https://www.feratel.com/en/webcams/italy/south-tyrol/prags-skilifte-prags-6199 (200)", true),
      L("map_sheet", "Tabacco 031 Dolomiti di Braies 1:25k", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/031_en/", "publisher page, found via the publisher's 1:25k category listing", true),
      L("video", "YouTube: Pragser Wildsee loop walk (DE)", "https://www.youtube.com/watch?v=MGzE1dHsrIE", "Confirmed via YouTube oEmbed (channel Bregenzerwald Fan)", true),
      L("booking", "Lago di Braies parking booking", "https://www.pragsparking.com/en", "summer access restriction: 2026 window 1 Jul-15 Sep, 9:00-16:00, car access only with online booking (per search results; confirm yearly). pragsparking.mts-online.com redirects here", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Lago di Braies Pragser Wildsee lake loop (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/lago-di-braies-pragser-wildsee-241629480 seen in WebSearch, but wikiloc returns 403 to curl and WebFetch, so not verified"}, fatmap: {"date": "2026-10-18", "query": "", "note": "FATMAP shut down in 2024; no live pages exist"}},
  },
  "fiscalina": {
    links: [
      L("official", "Drei Zinnen: Moos - Talschlusshütte", "https://www.dreizinnen.com/en/activity/hike-moos-fischleintal-valley-talschlussh-tte-hut_507", "replaces broken existing link ..._442, which now redirects to a 404 overview. 10 km, ~2:35 h, easy", true),
      L("conditions", "Drei Zinnen weather & snow conditions", "https://www.dreizinnen.com/en/weather", "avalanche bulletin: https://avalanche.report/bulletin/latest (200)", true),
      L("osm", "OSM relation 1116674 (path 102)", "https://www.openstreetmap.org/relation/1116674", "Path 102, AVS; passes the Fischleinboden car park"),
      L("gpx", "Drei Zinnen official GPX", "https://www.dreizinnen.com/tours/download_gpx/507", "text/xml GPX, 245 trackpoints", true),
      L("alltrails", "AllTrails: Moos - Talschlusshütte", "https://www.alltrails.com/trail/italy/south-tyrol/moos-val-fiscalina-rifugio-fondo-valle", undefined, false),
      L("komoot", "Komoot: Val Fiscalina loop", "https://www.komoot.com/smarttour/12334747", undefined, true),
      L("outdooractive", "Outdooractive: Sexten - Talschlusshütte", "https://www.outdooractive.com/en/route/hiking-trail/hochpustertal/hiking-path-sexten-fischleintal-valley-talschlusshuette-hut/16420034/", "content by Sesto/Sexten tourism; 6.6 km, 1:50 h, +228 m, starts in Sexten centre; curl 404 bot block", true),
      L("gaia", "Gaia GPS: Alta Via 5 stage I list", "https://www.gaiagps.com/hike/trail/italy/park/naturpark-drei-zinnen-parco-naturale-tre-cime/alta-via-n-5-delle-dolomiti-i-tappa/", "List page, not a single route; includes 'Talschlusshütte - Rifugio Fondo Valle via 1A' (easy, 4.1 mi)", true),
      L("report", "Anywhere We Roam: Val Fiscalina (2025)", "https://anywhereweroam.com/val-fiscalina-hike/", "published 2025-09-16, modified 2026-02-22; describes the longer 17.8 km four-rifugio loop", true),
      L("webcam", "Drei Zinnen webcams (Fischleintal cam)", "https://www.dreizinnen.com/en/webcams", "page lists a 'Fischleintal valley' cam and 'Sexten Moos' cam. Alt: https://www.yesalps.com/en/webcams/sesto/croda-rossa-meadows-sesto-moso-fiscalina-valley.html (200)", true),
      L("map_sheet", "Tabacco 010 Dolomiti di Sesto 1:25k", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/010_en/", "publisher page; 2023 edition ISBN 9788883151552", true),
      L("video", "YouTube: Val Fiscalina trail run", "https://www.youtube.com/watch?v=j5V7sxGGb_s", "Confirmed via YouTube oEmbed (channel RunVirtual)", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Val Fiscalina Fischleintal Talschlusshütte (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/sexten-fischleintal-talschlusshutte-150318732 seen in WebSearch, but wikiloc returns 403 to curl and WebFetch, so not verified"}, fatmap: {"date": "2026-10-18", "query": "", "note": "FATMAP shut down in 2024; no live pages exist"}, booking: {"date": "2026-10-18", "query": "dreizinnen.com Fischleintal highlight page (WebFetch)", "note": "no booking needed: paid parking at Fischleinboden, no reservation mentioned; buses from Toblach/Innichen"}},
  },
  "monte-piana": {
    links: [
      L("official", "Drei Zinnen: Lake Antorno - Monte Piano", "https://www.dreizinnen.com/en/activity/summer-hiking-tour-lake-antorno-misurina-monte-piano_22272", "path 122 from Lago d'Antorno to Rifugio Bosi. Museum info: https://www.pustertal.org/en/highlights/museums-and-exhibitions/outdoor-museum-monte-piana/ (200)", true),
      L("conditions", "Drei Zinnen weather & snow conditions", "https://www.dreizinnen.com/en/weather", "Monte Piana sits on the Veneto border; ARPAV Dolomiti Meteo (https://meteo.arpa.veneto.it/?page=DM) found in search but unreachable from this host", true),
      L("osm", "OSM relation 1657839 (path 122)", "https://www.openstreetmap.org/relation/1657839", "Lago d'Antorno to Capanna Carducci, 4.8 km, CAI"),
      L("alltrails", "AllTrails: Monte Piana via Lake d'Antorno", "https://www.alltrails.com/trail/italy/veneto/monte-piana-via-lago-d-antorno", undefined, false),
      L("komoot", "Komoot: Monte Piana Open-Air Museum Trail", "https://www.komoot.com/smarttour/e996514132/vom-lago-d-antorno-zum-monte-piana", undefined, true),
      L("outdooractive", "Outdooractive: Monte Piana open-air museum", "https://www.outdooractive.com/en/route/hiking-trail/dolomiti-d-ampezzo-dolomiti-bellunesi/monte-piana-2325-m-monte-piano-2305-m-open-air-museum-of-world-war-i/39713273/", "by DAV Sektion München; plateau loop from Rifugio Bosi, 5.4 km, 3:00 h, +174 m; curl 404 bot block", true),
      L("report", "Volpi del Vajolet: Monte Piana (2026)", "https://www.volpidelvajolet.it/2026/01/monte-piana-escursione-da-misurina.html", "Italian; published 2026-01-06, modified 2026-07-28. Also https://www.hiwio.com/en/Article/Monte-Piana-hike-Misurina-1131 (2023, 200)", true),
      L("webcam", "Windfinder: webcams near Monte Piana", "https://it.windfinder.com/webcams/monte_piana", "aggregator listing nearby cams (Drei Zinnen view ~3 km); no cam on the plateau found", true),
      L("map_sheet", "Tabacco 010 Dolomiti di Sesto 1:25k", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/010_en/", "publisher page; 2023 edition ISBN 9788883151552", true),
      L("video", "YouTube: Monte Piana museum from Misurina", "https://www.youtube.com/watch?v=E28wf0cP4Wc", "Confirmed via YouTube oEmbed (channel Paolo Nalesso)", true),
      L("booking", "Monte Piana jeep shuttle fares 2026", "http://www.montepiana.com/tariffe.htm", "no booking needed: 'Corse continuate ogni massimo 20 minuti senza prenotazione'; early June to end October, 9:00-17:00, from Bar Genzianella, Misurina; 2026 fares EUR 17 one way / EUR 25 return, tickets at departure", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "checked dreizinnen.com _22272/_22273 HTML and /tours/download_gpx/ ids", "note": "the dreizinnen Monte Piano pages have no GPX link (download_gpx/22272 returns 404); no other official GPX found"}, wikiloc: {"date": "2026-10-18", "query": "Monte Piana Misurina (allowed_domains wikiloc.com)", "note": "candidate https://it.wikiloc.com/percorsi-escursionismo/lago-di-antorno-monte-piana-136175851 seen in WebSearch, but wikiloc returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Monte Piana Misurina", "note": "no Monte Piana route on gaiagps.com in results"}, fatmap: {"date": "2026-10-18", "query": "", "note": "FATMAP shut down in 2024; no live pages exist"}},
  },
  "seekofel": {
    links: [
      L("official", "Drei Zinnen: Lago di Braies - Seekofel", "https://www.dreizinnen.com/en/activity/summer-hiking-tour-lago-di-braies-pragser-wildsee-mountain-croda-del-becco-seekofel-_544", "status shown 'open' on fetch; also on suedtirol.info (200)", true),
      L("conditions", "Euregio avalanche bulletin (South Tyrol)", "https://avalanche.report/bulletin/latest", "summit 2,810 m; summit sits on the Veneto border, so ARPAV Dolomiti also relevant (unreachable from this host). Weather: https://www.dreizinnen.com/en/weather", true),
      L("osm", "OSM relation 1155861 (path 1)", "https://www.openstreetmap.org/relation/1155861", "AVS path 1 from Lago di Braies"),
      L("gpx", "Drei Zinnen official GPX", "https://www.dreizinnen.com/tours/download_gpx/544", "text/xml GPX, 1650 trackpoints", true),
      L("alltrails", "AllTrails: Lake Braies - Seekofel", "https://www.alltrails.com/trail/italy/south-tyrol/lago-di-braies-croda-del-becco", undefined, false),
      L("komoot", "Komoot: Croda del Becco summit highlight", "https://www.komoot.com/highlight/278668", "user tour alternative: https://www.komoot.com/tour/32222428 (200)", true),
      L("outdooractive", "Outdooractive: Pragser Wildsee - Seekofel", "https://www.outdooractive.com/de/route/wanderung/hochpustertal/sommerwanderung-pragser-wildsee-seekofel/17276369/", "content by Prags tourism; curl 404 bot block", true),
      L("report", "Bookatrekking: Braies, Biella, Seekofel", "https://bookatrekking.com/en/blog/lago-di-braies/", "Operator guide, not a personal report; page metadata dateModified 2025-09-04 (datePublished field reads 2026-10-03). Covers lake to Rifugio Biella and the Croda del Becco summit option", true),
      L("webcam", "Drei Zinnen webcams (Prags/Braies cams)", "https://www.dreizinnen.com/en/webcams", "no cam at Rifugio Biella or the summit found; nearest are the Braies valley cams on this page", true),
      L("map_sheet", "Tabacco 031 Dolomiti di Braies 1:25k", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/031_en/", "publisher page, found via the publisher's 1:25k category listing", true),
      L("video", "YouTube: Croda del Becco from Braies", "https://www.youtube.com/watch?v=O8iyx5h5dq8", "Confirmed via YouTube oEmbed (channel NELYA & DANI)", true),
      L("booking", "Lago di Braies parking booking", "https://www.pragsparking.com/en", "summer access restriction: 2026 window 1 Jul-15 Sep, 9:00-16:00, car access only with online booking (per search results; confirm yearly). pragsparking.mts-online.com redirects here", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Croda del Becco Seekofel Braies (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/lago-di-braies-oberhaus-rifugio-biella-2327-mt-croda-del-becco-2800-mt-55643157 seen in WebSearch, but wikiloc returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Seekofel Croda del Becco", "note": "no Seekofel route; nearest is Braies-Pederü AV1 stage https://www.gaiagps.com/hike/319326/ucia-pederu-berggasthaus-pederu-rifugio-pederu-via-6a/ (not verified)"}, fatmap: {"date": "2026-10-18", "query": "", "note": "FATMAP shut down in 2024; no live pages exist"}},
  },
  "cinque-torri": {
    links: [
      L("official", "5 Torri lifts and huts (operator)", "https://5torri.it/", "Tourism-board route page: https://cortina.dolomiti.org/en/escursioni/giro-delle-cinque-torri-en/ (200) - Easy, 2 h, 4.7 km, Rif. Scoiattoli to Bai de Dones", true),
      L("conditions", "Cortina summer lifts (dates/status)", "https://cortina.dolomiti.org/en/summer/plan/lifts/", "2026 season: 5 Torri chairlift provisional 6 Jun - 25 Sep per https://www.rifugioaverau.it/en/news/about-us/opening-summer-2026/ (200). ARPAV Dolomiti Meteo (meteo.arpa.veneto.it/?page=DM) found in search but unreachable from here (curl timeout, WebFetch ECONNREFUSED)", true),
      L("osm", "OSM way 229103971", "https://www.openstreetmap.org/way/229103971", "Ways only, no route relation (17 Oct research)"),
      L("alltrails", "AllTrails: Cinque Torri Loop", "https://www.alltrails.com/trail/italy/veneto/giro-cinque-torri", "Also in search: /trail/italy/veneto/baita-bai-de-dones-cinque-torri (from Bai de Dones) and /trail/italy/veneto/giro-breve-cinque-torri", false),
      L("komoot", "Komoot highlight: Cinque Torri", "https://www.komoot.com/highlight/6877013", undefined, true),
      L("outdooractive", "Outdooractive: 5 Torri open-air museum", "https://www.outdooractive.com/en/route/hiking-trail/dolomiti-d-ampezzo-dolomiti-bellunesi/5-torri-open-air-museum-route/14442251/", "curl returned 404 (bot block); WebFetch showed the route page, 1 km, easy", true),
      L("report", "Earth Trekkers: Cinque Torri hike", "https://www.earthtrekkers.com/cinque-torri-hike-dolomites/", "Blog post, updated 2026 per search snippet", true),
      L("webcam", "5 Torri webcams (operator)", "https://5torri.it/IT/p34-Webcam", "Linked from 5torri.it nav. Area index: https://cortina.dolomiti.org/en/summer/info/webcam/ (200)", true),
      L("map_sheet", "Tabacco 03 Cortina d'Ampezzo 1:25,000", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/03_en/", undefined, true),
      L("video", "YouTube: Museo all'aperto 5 Torri", "https://www.youtube.com/watch?v=PsZBNkv9Fho", undefined, true),
      L("booking", "5 Torri chairlift online tickets", "https://5torri.it/IT/p37-Biglietteria-Online", "Linked from 5torri.it nav; museum itself is free", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "Cinque Torri giro sentiero GPX download Cortina", "note": "No official/tourism-board GPX file found; cortina.dolomiti.org embeds an Outdooractive map (id 50597598) without a direct GPX link. Third-party free GPX exists at visorando.com and it.wikivoyage.org (not verified)"}, wikiloc: {"date": "2026-10-18", "query": "Cinque Torri giro museo grande guerra wikiloc (site:wikiloc.com)", "note": "Tracks found in search (e.g. giro-delle-cinque-torri-38493448) but wikiloc.com returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Cortina d'Ampezzo Cinque Torri Lagazuoi Nuvolau Federa Fanes hike (site:gaiagps.com)", "note": "Only a generic Cortina area page and unrelated tracks"}, fatmap: {"date": "2026-10-18", "query": "n/a", "note": "FATMAP was shut down by Strava in 2024"}},
  },
  "fanes-falls": {
    links: [
      L("official", "Cortina: Botanical path to Fanes falls", "https://cortina.dolomiti.org/en/escursioni/botanical-path-to-the-cascate-di-fanes-en/", "Park area page: https://www.dolomitiparco.com/Ita/Esplora/area.php?area=Fanes-ColBechei (200)", true),
      L("conditions", "Ampezzo Park news (closures)", "https://www.dolomitiparco.com/Ita/Misc/listNews.php", "Search snippet: trail 401 (Val Travenanzes, Cengia Paolina) closed by Ordinance 171 of 4 Oct 2026. ARPAV Dolomiti Meteo unreachable from here", true),
      L("osm", "OSM relation 1641053 (path 10)", "https://www.openstreetmap.org/relation/1641053", "Path 10 up the Fanes valley past the falls signpost; check it is the route you want"),
      L("alltrails", "AllTrails: Fanes Waterfalls - Pian di Loa", "https://www.alltrails.com/trail/italy/veneto/cascate-di-fanes-pian-di-loa", "Existing link https://www.alltrails.com/trail/italy/veneto/rifugio-fanes-via-cascate-fanes confirmed in search ('Rifugio Fanes via Cascate di Fanes trail'), but it is a ~7 mi point-to-point to Rifugio Fanes; Pian di Loa listing is the closer match. Also seen: /cascate-di-fanes, /cascate-di-fanes-via-fiames", false),
      L("komoot", "Komoot: Cascate di Fanes loop", "https://www.komoot.com/smarttour/e996512633/cascate-di-fanes-loop-hike-in-the-regional-natural-park-of-the-ampezzo-dolomites", "Highlight page: https://www.komoot.com/highlight/961521 (200)", true),
      L("outdooractive", "Outdooractive: Fanes Waterfalls", "https://www.outdooractive.com/en/route/hiking-trail/dolomiti-d-ampezzo-dolomiti-bellunesi/fanes-waterfalls/27824585/", "curl 404 (bot block); WebFetch: 10.1 km, 4:45 h, difficult, from Ponte Felizon, via ferrata variant", true),
      L("report", "Ciao Cortina: Lower Fanes Falls", "https://www.ciaocortina.com/en/hike-cortina-lower-fanes-falls.html", "Local blog route report; also https://www.horizonrando.fr/en/hiking-dolomites/fanes-waterfalls-hike/ (200)", true),
      L("webcam", "Webcam Fiames Nordic Centre", "https://www.snow-online.com/cross-country/cortina-dampezzo/webcam/cortina-d-ampezzo--fiames-sport-cortina-dampezzo-fiames.htm", "Near trailhead (Fiames, 1,300 m); feed freshness unclear. Official index: https://cortina.dolomiti.org/en/summer/info/webcam/", true),
      L("map_sheet", "Tabacco 03 Cortina d'Ampezzo 1:25,000", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/03_en/", "Park route booklet PDF with map: https://www.dolomitiparco.com/Materiali/Testi/LibrettoCanyoninglese.pdf (200)", true),
      L("video", "YouTube: Giro delle Cascate di Fanes", "https://www.youtube.com/watch?v=M1eaS8N8FBs", "Starts from Sant'Uberto car park", true),
      L("booking", "Park: S. Uberto parking + shuttle", "https://www.dolomitiparco.com/Eng/Misc/visNews.php?idNews=69", "No reservation needed. Park states S. Uberto parking paid 6 Jul - 6 Sep 2026, 7:30-15:30, EUR 8/day", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "Cascate di Fanes GPX download traccia", "note": "No official/tourism-board GPX; only blogs (montagnadiviaggi.it, horizonrando.fr) and visugpx.com"}, wikiloc: {"date": "2026-10-18", "query": "Cascate di Fanes wikiloc Pian de Loa (site:wikiloc.com)", "note": "Tracks found (e.g. cascata-di-fanes-no-ferrata-26413544) but wikiloc.com returns 403 to curl/WebFetch, not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Cortina d'Ampezzo Cinque Torri Lagazuoi Nuvolau Federa Fanes hike (site:gaiagps.com)", "note": "Only a Via Ferrata Giovanni Barbara loop and generic Cortina page; no matching hike"}, fatmap: {"date": "2026-10-18", "query": "n/a", "note": "FATMAP was shut down by Strava in 2024"}},
  },
  "federa": {
    links: [
      L("official", "Rif. Croda da Lago: how to get there", "https://www.crodadalago.it/en/how-to-get-to-croda-da-lago/", "Hut operator page; describes path 437 from Rucurto Bridge (1,708 m) on SP 638 to Cason di Formin, then 434. Tourism-board route (Belluno DMO) on Outdooractive, see outdooractive", true),
      L("conditions", "Ampezzo Park news (roads/trails)", "https://www.dolomitiparco.com/Ita/Misc/listNews.php", "Park forest-road notices cover the Malga Federa road. Hut site links ARPAV forecast (arpa.veneto.it) but that host is unreachable from here", true),
      L("osm", "OSM relation 3170182 (path 437)", "https://www.openstreetmap.org/relation/3170182", "CAI path 437 from Ru Curto toward Lago Federa"),
      L("gpx", "Hut GPX: Rucurto to Croda da Lago (zip)", "https://www.crodadalago.it/wp-content/uploads/gpx/da-rucurto.zip", "Linked as 'Download GPS track' on the hut page; zip contains da-rucurto.gpx, one-way ~4.7 km, 1,701 to 2,040 m", true),
      L("alltrails", "AllTrails: Lake Federa via Pian del Pantan", "https://www.alltrails.com/trail/italy/veneto/lago-federa-via-pian-del-pantan", "Existing link confirmed in search; Pian del Pantan car park is at Ru Curto", false),
      L("komoot", "Komoot: Rifugio Croda da Lago loop", "https://www.komoot.com/smarttour/e995588868/rifugio-croda-da-lago-tour-en-boucle", undefined, true),
      L("outdooractive", "Outdooractive: Ru Curto to Lago Federa", "https://www.outdooractive.com/en/route/hiking-trail/dolomiti-d-ampezzo-dolomiti-bellunesi/from-ru-curto-to-lago-federa-croda-da-lago-refuge-/809246743/", "curl 404 (bot block); WebFetch: by Dolomiti Bellunesi - The Mountains of Venice (verified partner), 7.9 km, 3:05 h, 466 m, T2 Moderate", true),
      L("report", "inalto report: Rif. Palmieri from Pantan", "https://www.inalto.org/en/reports/hiking/rifugio-palmieri-alla-croda-da-lago-da-pantan", "Dated user report (page shows 13/11/2025). Blog alt: https://thephotohikes.com/the-lago-di-federa-hike/ (200)", true),
      L("webcam", "Cortina webcams (Croda da Lago view)", "https://cortina.dolomiti.org/en/summer/info/webcam/", "No cam at the lake/hut found; Cortina index lists 'Pelmo, Becco di Mezzodi, Croda da Lago, Lastoi de Formin' cam", true),
      L("map_sheet", "Tabacco 03 Cortina d'Ampezzo 1:25,000", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/03_en/", "Hut page: area is on Tabacco maps 03, 25 or 15", true),
      L("video", "YouTube: Lago Federa from Ru Curto", "https://www.youtube.com/watch?v=E0n2OMkx6Kc", undefined, true),
      L("booking", "Rif. Croda da Lago bed booking", "https://www.crodadalago.it/en/booking/", "Only for overnight stays; day hike needs no booking. Hut FAQ: Cortina-Giau bus early Jul to ~10 Sep stops at Rucurto", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Lago Federa Ru Curto wikiloc (site:wikiloc.com)", "note": "Tracks found (e.g. lago-federa-da-ponte-ru-curto-139981697) but wikiloc.com returns 403 to curl/WebFetch, not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Cortina d'Ampezzo Cinque Torri Lagazuoi Nuvolau Federa Fanes hike (site:gaiagps.com)", "note": "No Federa-specific track"}, fatmap: {"date": "2026-10-18", "query": "n/a", "note": "FATMAP was shut down by Strava in 2024"}},
  },
  "lagazuoi": {
    links: [
      L("official", "Lagazuoi SpA: The Lagazuoi Tunnels", "https://lagazuoi.it/EN/percorso6-The-Lagazuoi-Tunnels", "Existing https://lagazuoi.it/ (200) and https://www.rifugiolagazuoi.com/en (200, now redirects to https://rifugiolagazuoi.com/index.php). Tourism board: https://cortina.dolomiti.org/en/vie-ferrate/gallerie-del-lagazuoi-en/ (200)", true),
      L("conditions", "Lagazuoi cable car dates and times", "https://lagazuoi.it/EN/Information-Prices-and-useful-information-page20-Lagazuoi-cable-car", "Summer 2026: 6 June - 18 October; every 15 min, 9:00 to last up 16:40 / last down 17:00. Operator news: https://lagazuoi.it/EN/listNews.php (200). Rifugio site links the ARPAV Dolomiti Meteo PDF, but arpa.veneto.it is unreachable from here", true),
      L("osm", "OSM relation 2282556 (Kaiserjager Steig)", "https://www.openstreetmap.org/relation/2282556", "The via ferrata, not the tunnels"),
      L("alltrails", "AllTrails: Mount Lagazuoi - Lagazuoi Tunnels", "https://www.alltrails.com/trail/italy/veneto/monte-lagazuoi-le-gallerie-dell-anticima-del-lagazuoi", "Existing link confirmed in search", false),
      L("komoot", "Komoot: Lagazuoi Tunnels loop", "https://www.komoot.com/smarttour/1655970", "Page title: 'View from Lagazuoi - Lagazuoi Tunnels loop from Falzarego Pass'", true),
      L("outdooractive", "Outdooractive: Lagazuoi War Tunnels VF4-2", "https://www.outdooractive.com/en/route/via-ferrata/dolomiti-d-ampezzo-dolomiti-bellunesi/vf4-2-lagazuoi-war-tunnels-and-lagazuoi-via-ferrata-kaiserjaegersteig/45286981/", "curl 404 (bot block); WebFetch: Alpenventures, 4.2 km, 4:15 h, tunnels down to Falzarego then Kaiserjaeger back up (round trip)", true),
      L("report", "Bookatrekking: Lagazuoi Tunnels blog", "https://bookatrekking.com/en/blog/lagazuoi-tunnels/", "datePublished 2026-10-04. Alt: https://www.horizonrando.fr/en/hiking-dolomites/monte-lagazuoi-and-lagazuoi-tunnels-hike/ (200)", true),
      L("webcam", "Cortina webcams (Col Gallina, Averau)", "https://cortina.dolomiti.org/en/summer/info/webcam/", "No working Lagazuoi cam found (bergfex/tourispo listings report offline). Nearest on Cortina index: Col Gallina (by Falzarego), 'Rozes and 5 Torri from Averau'", true),
      L("map_sheet", "Tabacco 03 Cortina d'Ampezzo 1:25,000", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/03_en/", "Operator map PDF: https://lagazuoi.it/Pdf20/cartina-Lagazuoi.pdf (200), linked as 'Map of Mt. Lagazuoi'", true),
      L("video", "YouTube: Galleria del Lagazuoi", "https://www.youtube.com/watch?v=X7j-W2TH3WI", undefined, true),
      L("booking", "Lagazuoi cable car online tickets", "https://lagazuoi.it/EN/Information-Prices-and-useful-information-page83-ONLINE-TICKET-SHOP", "Optional; operator says online/card purchase skips the queue (5% card discount summer 2026). Refuge beds: https://rifugiolagazuoi.com/index.php", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "Galleria Lagazuoi GPX download", "note": "No official/tourism-board GPX found; only Komoot/Wikiloc user tracks"}, wikiloc: {"date": "2026-10-18", "query": "Lagazuoi galleria wikiloc discesa Falzarego (site:wikiloc.com)", "note": "Tracks found (e.g. galleria-lagazuoi-40144132) but wikiloc.com returns 403 to curl/WebFetch, not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Cortina d'Ampezzo Cinque Torri Lagazuoi Nuvolau Federa Fanes hike (site:gaiagps.com)", "note": "Only Lech de Lagacio (Lagazuoi lake) tracks, not the tunnels"}, fatmap: {"date": "2026-10-18", "query": "n/a", "note": "FATMAP was shut down by Strava in 2024"}},
  },
  "nuvolau": {
    links: [
      L("official", "Cortina: To Rifugio Nuvolau", "https://cortina.dolomiti.org/en/escursioni/to-rifugio-nuvolau-en/", "Hut access page: https://rifugionuvolau.it/en/how-to-reach-us/ (200); Averau: https://www.rifugioaverau.it/en/contacts-how-to-get-there/ (200)", true),
      L("conditions", "Averau: Fedare chairlift 2026 dates", "https://www.rifugioaverau.it/en/news/experiences/fedare-chairlift-opening-2/", "Posted 15 Apr 2026: from 12 July, daily 9:00-16:45, open until 13 September (page says 'Saturday 12 July', which is a Sunday in 2026). Lifts index: https://cortina.dolomiti.org/en/summer/plan/lifts/. Hut site links ARPAV Dolomiti Meteo (meteo.arpa.veneto.it/?page=DM), unreachable from here", true),
      L("osm", "OSM relation 15791396 (path 436)", "https://www.openstreetmap.org/relation/15791396", "Sentiero delle Trincee nearby, not the hut path itself"),
      L("alltrails", "AllTrails: Nuvolau via Rifugio Averau", "https://www.alltrails.com/trail/italy/veneto/rifugio-nuvolau-via-rifugio-averau", "Existing link confirmed; it is only the ~1 mi Averau-Nuvolau leg (chairlift approach). Also: /trail/italy/veneto/rifugio-fedare-rifugio-averau-rifugio-nuvolau, /trail/italy/veneto/passo-giau-rifugio-averau", false),
      L("komoot", "Komoot: Passo Giau to Rifugio Nuvolau", "https://www.komoot.com/smarttour/e994999272/vom-passo-giau-zum-rifugio-nuvolau", "Loop alt: https://www.komoot.com/smarttour/e994999010/nuvolau-averau-loop-trail (200)", true),
      L("outdooractive", "Outdooractive: 5 Torri tour from Giau", "https://www.outdooractive.com/en/route/hiking-trail/belluno/five-towers-tour-averau-nuvolau-and-scoiattoli-refuges-from-giau-pass/802807536/", "curl 404 (bot block); WebFetch: Dolomiti Bellunesi DMO, 10.6 km, 4:30 h, 629 m, moderate", true),
      L("report", "Earth Trekkers: Averau and Nuvolau hike", "https://www.earthtrekkers.com/rifugio-averau-rifugio-nuvolau-hike-dolomites/", undefined, true),
      L("webcam", "Rifugio Averau webcams", "https://www.rifugioaverau.it/en/webcam/", "Linked from the Averau site nav. Nuvolau hut links a still image: https://www.montagnaitalia.it/webcam/original/nuvolau.jpg (200)", true),
      L("map_sheet", "Tabacco 03 Cortina d'Ampezzo 1:25,000", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/03_en/", undefined, true),
      L("video", "YouTube: Rifugio Nuvolau da Passo Giau", "https://www.youtube.com/watch?v=n0Hm2dPck04", undefined, true),
      L("booking", "Rifugio Nuvolau booking", "https://rifugionuvolau.it/en/booking/", "Overnight only; Fedare chairlift needs no reservation per Averau news. Passo Giau parking reported free (Outdooractive via ferrata page, not official)", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "Rifugio Nuvolau Passo Giau GPX download traccia ufficiale", "note": "No official/tourism-board GPX; only Komoot, SummitPost, VisuGPX, horizonrando user tracks"}, wikiloc: {"date": "2026-10-18", "query": "Nuvolau Averau Passo Giau wikiloc (site:wikiloc.com)", "note": "Tracks found (e.g. rifugio-averau-e-rifugio-nuvolau-da-passo-giau-182530056) but wikiloc.com returns 403 to curl/WebFetch, not verified"}, gaia: {"date": "2026-10-18", "query": "gaiagps Cortina d'Ampezzo Cinque Torri Lagazuoi Nuvolau Federa Fanes hike (site:gaiagps.com)", "note": "No Nuvolau track in results"}, fatmap: {"date": "2026-10-18", "query": "n/a", "note": "FATMAP was shut down by Strava in 2024"}},
  },
  "seceda": {
    links: [
      L("official", "Val Gardena: Seceda Ridge Line", "https://www.valgardena.it/en/summer-holidays-dolomites/trekking/seceda/ridge-line/", "Existing app link .../seceda/ridge-line-1/ now redirects to an unrelated early-skiing page; replace with this URL. Page notes EUR 5 turnstile east of summit cross on trail 6; Panascharte saddle not accessible", true),
      L("conditions", "Seceda lifts summer status", "https://www.seceda.it/en/summer", "Lifts 22 May-2 Nov 2026, 08:30-17:00; Fermeda chairlift listed closed. Mountain weather: https://weather.province.bz.it/en/mountain-weather", true),
      L("osm", "OSM node 296550944 (Seceda top station)", "https://www.openstreetmap.org/node/296550944", "No ridge route relation found; the top station only"),
      L("gpx", "Val Gardena tour page with GPX/KML", "https://www.valgardena.it/en/outdoor/base/outdoor/seceda-ridge-line-from-s-cristina-via-col-raiser-valley-station-rifugio-firenze/808744765/", "Page has GPX/KML buttons (outdooractive download endpoint, blocked to curl). Route: Col Raiser valley station via Rif. Firenze to ridge start, 7.9 km, 983 m. The Col Raiser mountain-station variant (808737535) returns 410", true),
      L("alltrails", "AllTrails: Seceda - Pieralongia Hut", "https://www.alltrails.com/trail/italy/south-tyrol/seceda-malga-pieralongia", "existing app link; confirmed in search", false),
      L("komoot", "komoot: Seceda Mountain Station", "https://www.komoot.com/highlight/917410", "highlight page, not a single route", true),
      L("outdooractive", "Outdooractive: circular hike on Seceda", "https://www.outdooractive.com/en/route/hiking-trail/santa-cristina-val-gardena/exciting-circular-hike-on-the-seceda-in-the-dolomites/807544998/", "curl gets 404 (bot block). Loop from Col Raiser area, 10.2 km, 523 m; WebFetch could not confirm it walks the ridge", true),
      L("report", "Tripwis Seceda guide (upd. 2026-06-14)", "https://tripwis.com/my-guide-to-hiking-seceda-dolomites/", "published 2026-03-07, modified 2026-06-14; covers the summer-2025 turnstile and free detour", true),
      L("webcam", "Seceda webcams", "https://www.seceda.it/en/webcam", undefined, true),
      L("map_sheet", "Tabacco 05 Val Gardena-Alpe di Siusi", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/05_en/", "search URL /125000-coast/05_en/ redirects here", true),
      L("video", "YouTube: Seceda Ridgeline Hiking Trail", "https://www.youtube.com/watch?v=CaD0u-g04ng", "channel Mohammad Iqbal (oEmbed checked)", true),
      L("booking", "Seceda lift online tickets", "https://seceda.axess.shop/en", "Official seceda.it page recommends buying online in advance (limited parking in Ortisei) but does not say it is mandatory; some blogs claim mandatory time slots from 2026 - trust the official page. EUR 5 turnstile on ridge is paid on the spot", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Seceda site:wikiloc.com", "note": "candidate https://it.wikiloc.com/percorsi-escursionismo/seceda-230611122 seen in search but returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "Seceda Col Raiser ridge (allowed_domains gaiagps.com)", "note": "Only Gaia hit nearby is 'Juef de Pana - Panascharte - Forcella Pana via 2B' (https://www.gaiagps.com/hike/356423/juf-de-pana-panascharte-forcella-pana-via-2b/, 200), not the ridge walk; Forcella Pana is closed"}, fatmap: {"date": "2026-10-18", "query": "Dolomites Piz Boe Seceda Puflatsch (allowed_domains fatmap.com)", "note": "FATMAP shut down in 2024; old fatmap.com route URLs now redirect to strava.com routes"}},
  },
  "siusi": {
    links: [
      L("official", "Seiser Alm: Hans and Paula Steger Trail", "https://www.seiser-alm.it/en/leisure-activities/mountains-and-hiking/hans-and-paula-steger-trail/", "Closest official family walk from Compatsch (path 30, Compaccio-Saltria). Existing app links https://www.seiser-alm.it/en/ and https://www.alpedisiusi.com/ both still 200", true),
      L("conditions", "South Tyrol mountain weather", "https://weather.province.bz.it/en/mountain-weather", "Italian version https://meteo.provincia.bz.it/it also 200", true),
      L("osm", "OSM relation 9485181 (path 12)", "https://www.openstreetmap.org/relation/9485181", "Seiser-Alm-Steig, plateau path 12"),
      L("gpx", "GPX: Hans-und-Paula-Steger-Weg", "https://www.seiser-alm.it/external/gpx/?id=3704&lang_id=12", "application/gpx+xml; track name 'Hans-und-Paula-Steger-Weg'", true),
      L("alltrails", "AllTrails: Alpe di Siusi Family Tour", "https://www.alltrails.com/trail/italy/south-tyrol/giro-per-famiglie-alpe-di-siusi-val-gardena", "existing app link; confirmed in search. Snippet says ~4.1 mi/636 ft and that it starts at Monte Pana car park, not Compatsch - check trailhead", false),
      L("komoot", "komoot: Compatsch-Tirler Schwaige", "https://www.komoot.com/tour/53332659", "curl 200; Compatsch start, 6.79 km, 160 m up, moderate", true),
      L("outdooractive", "Outdooractive: circular hike Seiser Alm", "https://www.outdooractive.com/en/route/hiking-trail/seiser-alm/circular-hike-on-the-seiser-alm/58397247/", "curl gets 404 (bot block); Compatsch start, 9.1 km, 183 m", true),
      L("report", "Moon & Honey: Steger Trail (2026-04)", "https://www.moonhoneytravel.com/hans-and-paula-steger-trail/", "published 2024-01-17, modified 2026-04-22", true),
      L("webcam", "Seiser Alm webcams (incl. Compatsch)", "https://www.seiser-alm.it/en/webcam/", undefined, true),
      L("map_sheet", "Tabacco 05 Val Gardena-Alpe di Siusi", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/05_en/", "search URL /125000-coast/05_en/ redirects here", true),
      L("video", "YouTube: Compatsch-Saltria loop", "https://www.youtube.com/watch?v=K0qiT9ZLjOI", "channel BavariaHikingGirl (oEmbed checked)", true),
      L("booking", "Seiser Alm cable car (summer)", "https://www.seiseralm.it/en/info-service/mobility/seiser-alm-aerial-cableway-summer.html", "Road to Compatsch closed to private cars 09:00-17:00 while the cable car runs; season 22 May-2 Nov 2026. Page links an online ticket shop on shop.dolomitisuperski.com (403 to curl). https://www.seiseralm.it/en/info/current-information.html redirects here", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Compatsch Alpe di Siusi (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/alpe-di-siusi-compatch-dolomitas-137294720 seen in search but returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "", "note": "web search budget exhausted before this kind was searched; not searched"}, fatmap: {"date": "2026-10-18", "query": "Dolomites Piz Boe Seceda Puflatsch (allowed_domains fatmap.com)", "note": "FATMAP shut down in 2024; old fatmap.com route URLs now redirect to strava.com routes"}},
  },
  "munkel": {
    links: [
      L("official", "Odles Dolomites: Adolf Munkel Trail", "https://www.odlesdolomites.com/en/activities/84A3EDE0EBE349019877D7C478965A60", "villnoess.com has rebranded to odlesdolomites.com; the old villnoess.com Munkel URL now redirects to a generic region page. Shorter 9 km loop described at https://www.odlesdolomites.com/en/blog/the-adolf-munkel-trail/ (200)", true),
      L("conditions", "South Tyrol weather bulletin", "https://weather.province.bz.it/en", "Official tour page also shows a trail Status field (open/closed)", true),
      L("osm", "OSM relation 2442695 (Munkel Weg)", "https://www.openstreetmap.org/relation/2442695", "Adolf Munkel Weg - Via delle Odle, 6.1 km of ways"),
      L("gpx", "Odles Dolomites tour page (GPX buttons)", "https://www.odlesdolomites.com/en/activities/84A3EDE0EBE349019877D7C478965A60", "Page has 'GPX Download (original, 55.0 KB)' and '(reduced)' buttons; JS-driven, no static file URL", true),
      L("alltrails", "AllTrails: Adolf Munkel Trail (Zans loop)", "https://www.alltrails.com/trail/italy/south-tyrol/via-delle-odle-zanser-alm-rifugio-delle-odle-malga-dusler", "Existing link via-delle-odle-adolf-munkel-weg-alpe-di-funes appeared in search only as prod.alltrails.com/... and starts at St. Peter; this listing (4,197 reviews) starts at the Zans car park", false),
      L("komoot", "Komoot: Adolf Munkel Trail", "https://www.komoot.com/smarttour/e1239517945/adolf-munkel-trail", undefined, true),
      L("outdooractive", "Outdooractive: Adolf Munkel Trail", "https://www.outdooractive.com/en/route/hiking-trail/alto-adige/adolf-munkel-trail/810054360/", "curl gets bot-block 404; WebFetch showed Zans start, 12.4 km, 513 m, 4:12 h, author Villnoess tourism", true),
      L("gaia", "Gaia GPS: Adolf Munkel Weg loop via 36/6", "https://www.gaiagps.com/hike/355272/adolf-munkel-weg-loop-via-36-and-6/", undefined, true),
      L("report", "Salt in our Hair: Geisler Alm via Munkel", "https://www.saltinourhair.com/italy/geisler-alm-adolf-munkel-trail-dolomites/", "Published 2026-04-04, modified 2026-09-30 (page metadata); ~9 km loop from Zanser Alm", true),
      L("webcam", "Odles Dolomites weather and webcams", "https://www.odlesdolomites.com/en/weather-and-webcams/", "Linked from the official tour page; julian-alps.com aggregator result returned 404", true),
      L("map_sheet", "Tabacco 030 Bressanone / Val di Funes", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/030_en/", "Publisher page. Retailer: https://cartovia.com/en/products/carte-de-randonnee-n-30-bressanone-val-de-funes-italie-tabacco (200)", true),
      L("video", "YouTube: Hiking in Dolomites: Munkel Trail", "https://www.youtube.com/watch?v=4sGsWnH5BKQ", undefined, true),
      L("booking", "Zans car park online ticket", "https://suedtirol.live/en/store/car-park-zans-villoss-valley-p24061", "Official reservation page https://www.dolomitisuperski.com/en/experiences/events/Gitschberg-Jochtal-Brixen/2026/Parcheggio-Zannes-prenotazione-online-per-macchine returns 403 to curl and WebFetch, so not verified. Per search snippets: only part of the car park is bookable; when the Ranui traffic light is red, only reservation holders may drive up; fallback car parks in St. Magdalena + bus 330", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Adolf Munkel Weg (allowed_domains alltrails.com, wikiloc.com, gaiagps.com)", "note": "Candidate https://www.wikiloc.com/hiking-trails/adolf-munkel-weg-41418463 found in search, but Wikiloc returns 403 to curl and WebFetch; not verified"}, fatmap: {"date": "2026-10-18", "query": "none (FATMAP closed in 2024)", "note": "FATMAP shut down in 2024 after Strava acquisition"}},
  },
  "vallunga": {
    links: [
      L("official", "Val Gardena: Vallunga UNESCO", "https://www.valgardena.it/en/addresses/detail/base/poi/selva-di-val-gardena/vallunga-unesco-world-heritage/BFBA8869AE0DA035D9091AC707A8451A/", "search URL (wolkenstein-groeden/langental...) redirects here; summer walk also on suedtirol.info: https://www.suedtirol.info/en/en/experiences-and-events/plp-experiences/experiences-south-tyrol/pdp-experience.smgpoi992d7cf7e5257ade621f49ae987d331a.vallunga-langental-walk.selva-selva-wolkenstein-selva (200)", true),
      L("conditions", "South Tyrol mountain weather", "https://weather.province.bz.it/en/mountain-weather", "Italian version https://meteo.provincia.bz.it/it also 200", true),
      L("osm", "OSM relation 2465034 (path 14)", "https://www.openstreetmap.org/relation/2465034", "Path 14 up the Vallunga"),
      L("gpx", "Val Gardena tour page with GPX/KML", "https://www.valgardena.it/en/outdoor/base/outdoor/vallunga-langental-winter-walk/16420435/", "Page has GPX/KML/FIT buttons (outdooractive download endpoint 404s to curl). Listed as winter walk but 'best time' is all 12 months; same path 14 route", true),
      L("alltrails", "AllTrails: Vallunga La Ciajota", "https://www.alltrails.com/trail/italy/south-tyrol/vallunga-la-ciajota-plan-dala-ciajeies", "snippet: ~6.6 mi out-and-back on gravel road, stroller-suitable; longer than the chapel walk", false),
      L("komoot", "komoot: Vallunga Valley Walk", "https://www.komoot.com/smarttour/e2578846393/vallunga-valley-walk-through-puez-odle-nature-park", undefined, true),
      L("report", "Throne and Vine: Vallunga (2026-09)", "https://throneandvine.com/vallunga-langental/", "published 2026-09-07, modified 2026-09-08", true),
      L("webcam", "Val Gardena webcams", "https://www.valgardena.it/en/webcams/", "valley-wide index; no Vallunga-specific camera found", true),
      L("map_sheet", "Tabacco 05 Val Gardena-Alpe di Siusi", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/05_en/", "search URL /125000-coast/05_en/ redirects here", true),
      L("video", "YouTube: Walking in Vallunga", "https://www.youtube.com/watch?v=BQ-VSG5EgzM", "channel Chris Cross (oEmbed checked)", true),
    ],
    none: {outdooractive: {"date": "2026-10-18", "query": "Vallunga Langental hiking (allowed_domains outdooractive.com); \"Vallunga/Langental Walk\" outdooractive", "note": "Only winter/snowshoe/Puez-hut routes found; snowshoe page 404 and POI page 410 on check. Official summer listing links to outdooractive but URL not resolvable from here"}, wikiloc: {"date": "2026-10-18", "query": "Vallunga Selva (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/vallunga-langental-selva-di-gardena-38682424 seen in search but returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "", "note": "web search budget exhausted before this kind was searched; not searched"}, fatmap: {"date": "2026-10-18", "query": "Dolomites Piz Boe Seceda Puflatsch (allowed_domains fatmap.com)", "note": "FATMAP shut down in 2024; old fatmap.com route URLs now redirect to strava.com routes"}, booking: {"date": "2026-10-18", "query": "Vallunga Langental hike site:valgardena.it", "note": "no booking needed; paid car park at valley entrance or bus to stop 'Val'"}},
  },
  "pordoi": {
    links: [
      L("official", "Trentino: Sas Pordoi to Piz Boe", "https://www.trentino.com/en/leisure-activities/mountains-and-hiking/alpine-tours/from-mount-sas-pordoi-to-mount-piz-boe/", "search URL .../from-sass-pordoi-to-piz-boe/ redirects here. Alta Badia Sella traverse page now 404", true),
      L("conditions", "Val di Fassa summer lifts (Sass Pordoi)", "https://www.fassa.com/it/piste-e-impianti/impianti-estate", "Sass Pordoi cable car listed 14 May-1 Nov, 09:00-17:00 to 18 Oct then 09:00-16:30 (year not stated). Meteotrentino unreachable from this network (connection refused), not verified", true),
      L("osm", "OSM relation 7302480 (path 627)", "https://www.openstreetmap.org/relation/7302480", "Passo Pordoi to Rifugio Boe, 4.73 km, SAT"),
      L("gpx", "GPX: Sas Pordoi to Piz Boe", "https://www.trentino.com/external/gpx/?id=5484&lang_id=12", "application/gpx+xml; track 'Escursione dal Sas Pordoi al Piz Boe'", true),
      L("alltrails", "AllTrails: Sass Pordoi - Piz Boe", "https://www.alltrails.com/trail/italy/trentino/sasso-pordoi-piz-boe", "288 reviews; also piz-boe-via-sasso-pordoi", false),
      L("komoot", "komoot: Piz Boe from Passo Pordoi (627)", "https://www.komoot.com/smarttour/e2579070760/piz-boe-summit-trail-from-passo-pordoi-via-sentiero-627", undefined, true),
      L("outdooractive", "Outdooractive: Piz Boe with cable car", "https://www.outdooractive.com/en/route/mountain-hike/val-di-fassa/piz-boe-with-cable-car/58440529/", "curl 404 (bot block); 5.8 km, 343 m", true),
      L("report", "Mountains for Everybody: Piz Boe", "https://mountainsforeverybody.com/climbing-piz-boe-in-dolomites-mountains", "first-hand report; search snippet says updated January 2026 (no date metadata found on page)", true),
      L("webcam", "Val di Fassa webcam: Sass Pordoi", "https://www.fassa.com/en/webcam/canazei-belvedere-col-rodella-passo-pordoi/webcam-canazei-passo-pordoi", "camera on Sass Pordoi 2,950 m facing Forcella Pordoi", true),
      L("map_sheet", "Tabacco 07 Alta Badia-Arabba-Marmolada", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/07_en/", "covers Sella/Pordoi and Padon ridge; neighbouring sheet 06 Val di Fassa also covers Pordoi", true),
      L("video", "YouTube: Piz Boe Via Normale from Pordoi", "https://www.youtube.com/watch?v=c8zGIqErsT0", "channel NELYA & DANI (oEmbed checked)", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Piz Boe Sass Pordoi (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/piz-boe-3152mt-rifugio-forcella-pordoi-sass-pordoi-e-rifugio-boe-dal-passo-pordoi-27496451 seen in search but returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "", "note": "web search budget exhausted before this kind was searched; not searched"}, fatmap: {"date": "2026-10-18", "query": "Dolomites Piz Boe Seceda Puflatsch (allowed_domains fatmap.com)", "note": "FATMAP shut down in 2024; old fatmap.com route URLs now redirect to strava.com routes"}, booking: {"date": "2026-10-18", "query": "Sass Pordoi cable car tickets online purchase", "note": "no booking needed; no official online ticket page found, tickets at the Passo Pordoi valley station (blogs suggest buying online in summer to skip queues)"}},
  },
  "viel-dal-pan": {
    links: [
      L("official", "Val di Fassa: Viel dal Pan itinerary", "https://www.fassa.com/it/itinerari/alba-col-dei-rossi-viel-dal-pan-fedaia-alba", "ApT Val di Fassa page for the Pordoi-Fedaia path; recommends reaching Passo Pordoi by bus or lifts; only Col dei Rossi-Rif. Viel dal Pan suits families, not strollers. Arabba-side page: https://grandeguerra.dolomiti.org/en/arabba/experiences/trekking/trekking-trail-viel-dal-pan (200)", true),
      L("conditions", "Val di Fassa summer lifts", "https://www.fassa.com/it/piste-e-impianti/impianti-estate", "lift status for Belvedere/Col dei Rossi access; walking from Passo Pordoi needs no lift. Meteotrentino unreachable from this network, not verified", true),
      L("osm", "OSM relation 7302436 (path 601)", "https://www.openstreetmap.org/relation/7302436", "Viel del Pan, Passo Pordoi to Rifugio Castiglioni, 7.3 km, SAT"),
      L("alltrails", "AllTrails: Pordoi-Viel dal Pan-Fredarola", "https://www.alltrails.com/trail/italy/veneto/passo-pordoi-rifugio-viel-dal-pan-rifugio-fredarola", "snippet: 5.7 mi, 1,683 ft; also bindelweg-passo-pordoi-porta-vescovo", false),
      L("komoot", "komoot: Viel dal Pan from Passo Pordoi", "https://komoot.com/it-it/tour/1769454935", "user tour via Sentiero della Cresta, 7.3 km, 360 m; WebFetch could not confirm it reaches the hut", true),
      L("outdooractive", "Outdooractive: Viel dal Pan (Arabba)", "https://www.outdooractive.com/en/route/hiking-trail/livinallongo-del-col-di-lana/viel-dal-pan/46202650/", "curl 404 (bot block); by Arabba Fodom Turismo; starts Arabba/Porta Vescovo, 14.2 km, 985 m", true),
      L("report", "Andrew's Walks: Viel del Pan", "https://www.andrewswalks.co.uk/viel-del-pan.html", "published 2018-06-21, modified 2026-05-21; no 2025/26 first-hand report found", true),
      L("webcam", "Fassa webcam: Pordoi/Sass Bece refuge", "https://www.fassa.com/en/webcam/canazei-belvedere-col-rodella-passo-pordoi/webcam-canazei-passo-pordoi-sass-bece-refuge", "at Passo Pordoi near the start of path 601; no camera at Rif. Viel dal Pan found", true),
      L("map_sheet", "Tabacco 07 Alta Badia-Arabba-Marmolada", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/07_en/", "covers Sella/Pordoi and Padon ridge; neighbouring sheet 06 Val di Fassa also covers Pordoi", true),
      L("video", "YouTube: Sentiero Viel del Pan dal Pordoi", "https://www.youtube.com/watch?v=c2EphJwFNss", "channel Sara Lazzari (oEmbed checked)", true),
    ],
    none: {gpx_download: {"date": "2026-10-18", "query": "fassa.com Viel dal Pan escursione Passo Pordoi tour sentiero; GPX links checked on fassa.com, dolomiti.org, visittrentino.info pages", "note": "none of the official pages fetched expose a GPX file"}, wikiloc: {"date": "2026-10-18", "query": "Viel del Pan Passo Pordoi (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/passo-pordoi-rifugio-viel-del-pan-107300150 seen in search but returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "", "note": "web search budget exhausted before this kind was searched; not searched"}, fatmap: {"date": "2026-10-18", "query": "Dolomites Piz Boe Seceda Puflatsch (allowed_domains fatmap.com)", "note": "FATMAP shut down in 2024; 'Alta Via 2 - Rifugio Boe to Rifugio Viel dal Pan' URL now redirects to https://www.strava.com/routes/3254142878637768566"}, booking: {"date": "2026-10-18", "query": "Passo Pordoi Rifugio Viel dal Pan escursione", "note": "no booking needed; paid parking at Passo Pordoi, bus from Canazei"}},
  },
  "puflatsch": {
    links: [
      L("official", "Seiser Alm: Bullaccia round trail", "https://www.seiser-alm.it/en/leisure-activities/mountains-and-hiking/bullaccia-round-trail-and-witches-benches/", "Witches' Benches sight page: https://www.seiser-alm.it/en/highlights/sights/witches-benches/ (200)", true),
      L("conditions", "South Tyrol mountain weather", "https://weather.province.bz.it/en/mountain-weather", "Italian version https://meteo.provincia.bz.it/it also 200", true),
      L("osm", "OSM relation 9483250 (PU round walk)", "https://www.openstreetmap.org/relation/9483250", "Puflatschumrundung - Giro del Bulacia, 6.8 km of ways"),
      L("gpx", "GPX: Puflatsch-Rundweg Hexenbaenke", "https://www.seiser-alm.it/external/gpx/?id=3710&lang_id=12", "application/gpx+xml; track 'Wanderung auf dem Puflatsch-Rundweg zu den Hexenbaenken'", true),
      L("alltrails", "AllTrails: Bullaccia Tour Witches' Benches", "https://www.alltrails.com/trail/italy/south-tyrol/anello-della-bullaccia-panche-delle-streghe-hexenbanke", "704 reviews; ~5.4 mi, 1,177 ft", false),
      L("komoot", "komoot: Puflatsch Loop Trail", "https://www.komoot.com/smarttour/e2579399604/puflatsch-rundweg-mit-hexenbaenken-auf-der-seiser-alm", undefined, true),
      L("outdooractive", "Outdooractive: To the Hexenbaenke", "https://www.outdooractive.com/en/route/hiking-trail/seiser-alm/to-the-hexenbaenke/6842841/", "curl 404 (bot block); Compatsch cable car top station start, 8.3 km, 315 m", true),
      L("report", "Throne and Vine: Bullaccia (upd. 2026-09)", "https://throneandvine.com/bullaccia-puflatsch/", "search URL /mountain-witches-dolomites/ redirects here; published 2025-06-22, modified 2026-09-09", true),
      L("webcam", "Feratel webcam: Puflatsch top station", "https://www.feratel.com/en/webcams/italy/south-tyrol/seis-am-schlern-puflatsch-bergstation-6216", "search URL redirects here; official index also at https://www.seiser-alm.it/en/webcam/", true),
      L("map_sheet", "Tabacco 05 Val Gardena-Alpe di Siusi", "https://www.tabaccoeditrice.it/en/cartografie_en/125000-mountain/05_en/", "search URL /125000-coast/05_en/ redirects here", true),
      L("video", "YouTube: Puflatsch-Umrundung flyover", "https://www.youtube.com/watch?v=tYDRJysdCBs", "Outdooractive Flyover Videos channel (oEmbed checked)", true),
      L("booking", "Seiser Alm cable car (summer)", "https://www.seiseralm.it/en/info-service/mobility/seiser-alm-aerial-cableway-summer.html", "Road to Compatsch closed 09:00-17:00 while the cable car runs; Puflatsch gondola hours not on this page; online tickets on shop.dolomitisuperski.com (403 to curl)", true),
    ],
    none: {wikiloc: {"date": "2026-10-18", "query": "Bullaccia panche delle streghe (allowed_domains wikiloc.com)", "note": "candidate https://www.wikiloc.com/hiking-trails/giro-del-bullaccia-e-delle-panche-delle-streghe-compatch-alpe-di-siusi-107873163 seen in search but returns 403 to curl and WebFetch, so not verified"}, gaia: {"date": "2026-10-18", "query": "", "note": "web search budget exhausted before this kind was searched; not searched"}, fatmap: {"date": "2026-10-18", "query": "Dolomites Piz Boe Seceda Puflatsch (allowed_domains fatmap.com)", "note": "FATMAP shut down in 2024; search returned no Puflatsch route"}},
  },
};

// ---- researched facts from the same run (official or tourism-board pages, quoted in the research files) ----------
const OSM_F = (ids: string) => ({ geometry_source: f("osm_relation", "Overpass query 18 Oct 2026", "community"), geometry_ids: f(ids, "OpenStreetMap", "community") });
/** Two or more sources disagree: both are shown, neither is picked. */
const disagree = (v: string, ...c: { v: string; src: string; conf: Conf; read?: string }[]): Fact =>
  ({ v, src: "sources disagree", conf: "community", read: R, conflict: c.map(x => ({ read: R, ...x })) });
const RESEARCHED_FACTS: Record<string, Record<string, Fact>> = {
  "monte-piana": {
    distance_km: f("3.9", "dreizinnen.com tour 22272: Lago d'Antorno to Rifugio Bosi, one way on path 122", "official"),
    elevation_gain_m: f("368", "dreizinnen.com tour 22272", "official"),
    duration_hours: f("2.5", "dreizinnen.com tour 22272: 2 h 30 min one way", "official"),
    difficulty: f("moderate", "dreizinnen.com: Intermediate", "official"),
    route_shape: f("out-and-back", "one-way figures from the lake to the hut", "inferred"),
    season: f("Jeep shuttle daily early June to end of October, 09:00-17:00", "montepiana.com/tariffe.htm", "operator"),
    th_name: f("Lago d'Antorno", "OpenStreetMap relation 1657839 (from: Lago d'Antorno)", "community"),
    ...OSM_F("1657839 (path 122, 4.8 km to Capanna Carducci)"),
  },
  seekofel: {
    distance_km: f("7.3", "Prags tourism tour 17276369 on outdooractive.com, apparently one way lake to summit", "operator"),
    elevation_gain_m: f("1314", "same tour, as embedded on suedtirol.live", "operator"),
    duration_hours: f("3.5-4.5", "dreizinnen.com tour 544 gives 3 h 30 in the facts and 4.5 h in the text", "official"),
    difficulty: f("hard", "dreizinnen.com: Difficult; very demanding, vertigo and slip resistance required", "official"),
    route_shape: f("out-and-back", "summit and back by path 1", "inferred"),
    season: f("Summer route; no months stated. Car access to the lake booked on pragsparking.com 1 Jul - 15 Sep, 09:00-16:00", "dreizinnen.com / pragsparking.com", "official"),
    th_name: f("Lago di Braies", "dreizinnen.com tour 544", "official"),
    ...OSM_F("1155861 (AVS path 1)"),
  },
  vallunga: {
    distance_km: f("7.5", "valgardena.it Vallunga walk (winter listing); suedtirol.info summer listing says 6 km", "official"),
    elevation_gain_m: f("200", "valgardena.it Vallunga walk", "official"),
    duration_hours: f("2", "valgardena.it: 2:00 h", "official"),
    difficulty: f("easy", "valgardena.it: Easy", "official"),
    route_shape: f("out-and-back", "path 14 up the valley and back", "inferred"),
    th_name: f("Vallunga car park, Selva", "OpenStreetMap way 255994108", "community"),
    ...OSM_F("2465034 (path 14)"),
  },
  pordoi: {
    distance_km: f("7.8", "trentino.com: from the Sas Pordoi top station to Piz Boe", "official"),
    elevation_gain_m: f("561", "trentino.com", "official"),
    duration_hours: f("3.25", "trentino.com: 03:15 h", "official"),
    difficulty: f("moderate", "trentino.com: moderate summit route with lifts; fassa.com rates Piz Boe E/EE", "official"),
    max_elevation_m: f("3152", "Piz Boe summit, PLAN.md", "operator", "Aug 2026"),
    exposure: f("some", "fixed ropes on the steepest sections", "community"),
    th_name: f("Sass Pordoi top station", "OpenStreetMap node 29916900", "community"),
    ...OSM_F("7302480 (path 627 Passo Pordoi - Rifugio Boe, 4.73 km)"),
  },
  "viel-dal-pan": {
    difficulty: f("moderate", "grandeguerra.dolomiti.org: Medium (for the Porta Vescovo - Passo Pordoi traverse)", "official"),
    route_shape: f("out-and-back", "from Passo Pordoi to the hut and back", "inferred"),
    th_name: f("Passo Pordoi", "OpenStreetMap relation 7302436 (from: Passo Pordoi)", "community"),
    ...OSM_F("7302436 (path 601, 7.3 km to Rifugio Castiglioni)"),
  },
  puflatsch: {
    distance_km: f("9.1", "seiser-alm.it Bullaccia round trail and Witches' Benches, from Compatsch; seiseralm.it variant 8.4 km", "official"),
    elevation_gain_m: f("340", "seiser-alm.it", "official"),
    duration_hours: f("3.2", "seiser-alm.it: 03:10 h", "official"),
    difficulty: f("easy", "seiser-alm.it: easy (the 8.4 km variant is rated medium)", "official"),
    route_shape: f("loop", "round trail", "official"),
    th_name: f("Puflatsch lift top station", "OpenStreetMap node 625195493", "community"),
    ...OSM_F("9483250 (PU round walk)"),
  },
  "fanes-falls": {
    distance_km: f("7", "cortina.dolomiti.org botanical path from Pian de Loa; the full park loop from Sant'Uberto is 9-9.5 km", "official"),
    elevation_gain_m: f("249", "cortina.dolomiti.org", "official"),
    duration_hours: f("2.5", "cortina.dolomiti.org: 2 h 30'", "official"),
    difficulty: f("easy", "cortina.dolomiti.org: Easy", "official"),
    route_shape: f("loop", "botanical path loop via Ponte Outo", "official"),
    th_name: f("Sant'Uberto", "OpenStreetMap node 7920730765", "community"),
    ...OSM_F("1641053 (path 10, passes the falls signpost)"),
  },
  federa: {
    distance_km: f("7.9", "Belluno tourism board route from Ru Curto (outdooractive.com); the hut's GPX is about 4.7 km one way", "official"),
    elevation_gain_m: f("466", "same route; the hut FAQ says about 300 m and 2 h one way", "official"),
    duration_hours: f("3", "same route: 3:05 h", "official"),
    difficulty: f("moderate", "same route: T2, medium difficulty", "official"),
    ...OSM_F("3170182 (CAI path 437)"),
  },
  nuvolau: {
    distance_km: f("9.8", "cortina.dolomiti.org: to Rifugio Nuvolau, loop from Passo Giau", "official"),
    elevation_gain_m: f("612", "cortina.dolomiti.org", "official"),
    duration_hours: f("5", "cortina.dolomiti.org: 5 h; Fedare chairlift to Averau then 30 min (rifugionuvolau.it)", "official"),
    difficulty: f("hard", "cortina.dolomiti.org: For Experts", "official"),
    route_shape: f("loop", "443 and 439 via Scoiattoli and Averau", "official"),
    th_name: f("Passo Giau", "cortina.dolomiti.org", "official"),
  },
  lagazuoi: {
    elevation_loss_m: f("647", "cortina.dolomiti.org (the operator gives 639 m)", "official"),
    duration_hours: f("1.5", "lagazuoi.it: tunnel under an hour, then about half an hour to the pass", "operator"),
    difficulty: f("easy", "lagazuoi.it: easy, equipped tunnel; helmet, headlamp and gloves", "operator"),
    season: f("Cable car 6 Jun - 18 Oct 2026", "lagazuoi.it", "operator"),
    th_name: f("Lagazuoi cable car top station", "OpenStreetMap node 360633381", "community"),
    pk_fee: disagree("Free or EUR 5 a day: sources disagree",
      { v: "Free for the whole 2026 summer season", src: "lagazuoi.it page105 (cable car operator)", conf: "operator" },
      { v: "Car EUR 5/day, EUR 10/night", src: "OpenStreetMap way 31355241 charge tag", conf: "community" },
      { v: "Free all summer", src: "PLAN.md", conf: "operator", read: "Aug 2026" }),
  },
  braies: {
    pk_fee: disagree("EUR 44 booked online, or EUR 15 a day: sources disagree",
      { v: "EUR 44 incl. a EUR 22 voucher, booked online", src: "PLAN.md from prags.bz", conf: "operator", read: "Aug 2026" },
      { v: "EUR 15/day", src: "OpenStreetMap way 442280371 charge tag", conf: "community" },
      { v: "Car access booking-only 1 Jul - 15 Sep, 09:00-16:00", src: "pragsparking.com", conf: "official" }),
  },
  siusi: {
    distance_km: f("9.9", "seiser-alm.it Hans and Paula Steger Trail, Compatsch to Saltria (the same page also says 4.5 km)", "official"),
    elevation_gain_m: f("333", "seiser-alm.it Steger Trail", "official"),
    duration_hours: f("3", "seiser-alm.it: 03:00 h", "official"),
    difficulty: f("easy", "seiser-alm.it: easy, stroller-friendly", "official"),
    th_name: f("Compatsch", "seiser-alm.it", "official"),
  },
  munkel: {
    distance_km: f("12.4", "odlesdolomites.com: Zans to Ranui, point to point; the loop back to Zans is 9 km, 3 h", "official"),
    elevation_gain_m: f("593", "odlesdolomites.com", "official"),
    elevation_loss_m: f("876", "odlesdolomites.com", "official"),
    max_elevation_m: f("2045", "odlesdolomites.com", "official"),
    duration_hours: f("3.8", "odlesdolomites.com: 3:50 h", "official"),
    difficulty: f("moderate", "odlesdolomites.com: Intermediate", "official"),
    route_shape: f("point-to-point", "Zans to Ranui", "official"),
  },
  seceda: {
    distance_km: disagree("1 or 3 km: sources disagree",
      { v: "About 1 km, the ridge section, about 1 h", src: "valgardena.it ridge line page", conf: "official" },
      { v: "3 km, 100 m, 1.5 h", src: "PLAN.md", conf: "operator", read: "Aug 2026" }),
  },
};

// Merge: trailhead and parking points, researched links (weather links kept), checklist gaps and researched facts.
for (const id of new Set([...Object.keys(ACCESS), ...Object.keys(RESEARCH)])) {
  const base = TRAILS[id] ?? EMPTY();
  const a = ACCESS[id];
  const r = RESEARCH[id];
  const facts: Record<string, Fact> = { ...base.facts, ...(RESEARCHED_FACTS[id] ?? {}) };
  if (a) {
    const src = sourceLabel(a.trailhead.point_source);
    facts.th_lat = f(a.trailhead.lat.toFixed(5), src, "community");
    facts.th_lon = f(a.trailhead.lon.toFixed(5), src, "community");
    if (!facts.th_name) facts.th_name = f(a.trailhead.name, src, "community");
    if (!facts.th_elev && a.trailhead.elev_m) facts.th_elev = f(String(a.trailhead.elev_m), `${src} ele tag`, "community");
  }
  TRAILS[id] = {
    ...base, facts,
    links: r ? [...r.links, ...base.links.filter(l => l.kind === "weather")] : base.links,
    none: r?.none ?? base.none,
    trailhead: a?.trailhead ?? base.trailhead,
    parking: a?.parking ?? base.parking,
  };
}

// ---- session store: edits survive navigating away and back ---------------------------------------------------------
let state: Record<string, TrailRecord> = {};
const subs = new Set<() => void>();
const emit = () => { state = { ...state }; subs.forEach(s => s()); };
export function getTrail(id: string): TrailRecord { return state[id] ?? TRAILS[id] ?? EMPTY(); }
function mutate(id: string, fn: (r: TrailRecord) => TrailRecord) {
  const base = state[id] ?? TRAILS[id] ?? EMPTY();
  state[id] = fn({ ...base, facts: { ...base.facts }, hazards: [...base.hazards], links: [...base.links] });
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
