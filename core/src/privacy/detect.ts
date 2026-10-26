// THE PRIVACY DETECTOR: what no served output may hold, in one place (audit G-B, GB-A-7). `respond()` runs it on every API body and fails
// closed; the contract kit's K7 and the web privacy test run it too, so the three lists cannot drift. It only LOOKS: the scrub that
// removes these things runs where the data is built (origin.ts, party.ts, dateless.ts). Hits name a path and a reason, never the value,
// and never a coordinate.
//
// Three liftings, each as narrow as it can be (store.ts A33, A39, A40; owner ruling Q87 of 23 Oct 2026):
//   1. PUBLIC TOWNS, by identity with the loaded gazetteer (`opts.gazetteer`, towns.ts). Without a gazetteer nothing is lifted.
//      - A point within the household radius is accepted only in an object whose `id` or `key` is a gazetteer town id AND whose
//        `lat`/`lon` are exactly that town's gazetteer point; a coordinate pair only inside such an object AND exactly a vertex of
//        that town's gazetteer outline. Anything else within the radius fails: a place, a moved centre, a planted point under a real
//        town id, an id the gazetteer does not hold.
//      - The home-town TEXT rule is lifted for a gazetteer town id under `id`, `key`, `value`, `nearTown` or `townId`, or in a `city`
//        array (the string itself only), and for a `name` or `label` of at most 80 characters with no digit in an object whose `id`,
//        `key`, `value` or chip `set.city` is a gazetteer id, when the label holds that town's gazetteer name (review API3-R-2: a place
//        row's `nearTown` makes nothing else exempt). The `city=<gazetteer id>` parameters of an `href` are not read as text.
//   2. ECHOES of the request (`opts.echo`, the request's own strings; review API3-R-1). A string under `query`, `q`, `unused`,
//      `notYet` or `terms` (or an array under one), or an `href` query parameter, whose folded text is contained in one of the
//      request's strings is not read as text: it carries nothing the request did not bring, and refusing it would make the search box
//      an oracle (one word answering 500). Every other field holding the same words is still read.
//   3. Nothing else. Encoded polylines under `geometry` are decoded (A34, A39), and a string that is JSON (the `json` export body) is
//      also parsed and walked, so a line or a point inside it is read like any other (review API3-R-6).
import { decodePolyline5, POLYLINE5_RE } from "../schema/api/legs.ts";
import { HOME_TOWN_RE, nearHome } from "./home.ts";
import type { PublicGazetteer } from "./towns.ts";
import { TRIPLESS_LANE } from "../capture/lane.ts";

/** The household's planning notes: a plan link, a stay idea, a base camp (dateless.ts HOUSEHOLD_TEXT, without its loose address rule). */
export const PLANNING_NOTE = /\bplanned as\b|\b(?:hotel|stay|lodging|airbnb|accommodation|campsite|hut)\s+(?:idea|ideas|choice|pick|booked)\b|\bbase camp:/i;
/** A street address, case-sensitive: the scrub's case-insensitive rule reads "30 min each way" as one. */
export const STREET_ADDRESS = /\b\d{2,5}\s+[A-Z][\w'. -]{2,30}\s(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Blvd)\b/;
/** The place status a household sets: the key `status` is private only with one of these values (an access window is also "open"). */
export const STATUS_WORDS: readonly string[] = ["idea", "shortlisted", "planned", "visited", "dropped"];
/**
 * A private origin key (store.ts A24): `loc:<locations id>` names the owner's wishlist and `proto:<prototype id>` the old prototype. No
 * served body or published file may hold one; a page with no capture record is `place/<slug>`. The word boundary keeps `wikiloc:` out.
 */
export const ORIGIN_REF = /\b(?:loc|proto):[^\s"]/;
/**
 * The trip-less capture lane (core/src/capture/lane.ts, DD-8) is internal: its id as a trip, or a `trip/<lane>` ref, would tell which
 * places have no trip, that is which came from the owner's list (PRIV1). No served body names it.
 */
export const TRIP_VALUE_KEYS: readonly string[] = ["trip", "trips", "tripId", "trip_id", "tripSlug", "trip_slug"];
export const TRIPLESS_REF = new RegExp(`\\btrip/${TRIPLESS_LANE}\\b`);
/**
 * Keys that carry household data in any output (the owner's save metadata since PRIV1, traveller details, payments), and the internal
 * research columns no served body may hold (RI-6, RIS-C): `meta` (RowMeta), `notes_private` (owner Q173) and `doc` (the verbatim
 * capture record of 0003, owner Q172). `notes` stays public (a trip or track note), so only `notes_private` is listed. A visitor's copy
 * (copies/1, trip-custom/1; NAV-C) adds `copiedAt` (when it was made), `travellers` (the party), `fromRef` (the visitor's origin, the
 * stored name of the URL's `from`; owner 26 Oct 2026) and `gw` (the airports picked, origin spec 10); `added` was already here.
 */
export const PRIVATE_KEYS: readonly string[] = ["height_cm", "weight_kg", "age_years", "citizenship", "confirmation", "contact", "price_paid_amount", "insurer_tel", "stayStatus", "location_status", "sourceTypes", "added", "meta", "notes_private", "doc", "copiedAt", "travellers", "fromRef", "gw", "favouredAt", "favourites"];
/**
 * The visitor's origin under the URL's name (origin spec 8.1 rule 1). Copies store it as `fromRef`, a private key whatever its value;
 * this rule stays as a second net. `from` is a common public key (a window `{from, to}`, an age band, a leg), so it is private only
 * when it holds an origin reference (`iata:`, `hub:`, `town:`, `gn:`). Server output never varies by origin (OR2), so no served body
 * carries one under `from`. Known misses, pinned in core/test/schema/copies.test.ts: the URL form (`bom`), a resolved label, a JSON
 * string under `from`, nesting deeper than three levels, and a reference under another key (`start.ref`, `origin`, `ref`).
 */
export const ORIGIN_VALUE_KEYS: readonly string[] = ["from"];
export const ORIGIN_REFERENCE_VALUE = /^\s*(?:iata|hub|town|gn):/i;

/**
 * Keys whose values never go into a server log (email spec 5.1, F17 item 14): sign-in codes, tokens, passwords, addresses, names, IPs,
 * cookies and signatures. The auth guard (web/lib/auth/guard.ts) drops these keys before it logs, and its log-scan test asserts that no
 * address, code or IP appears in the captured logs.
 */
export const LOG_DENY_KEYS: readonly string[] = [
  "otp",
  "otp_code",
  "token",
  "link_url",
  "password",
  "newPassword",
  "currentPassword",
  "email",
  "newEmail",
  "name",
  "ip",
  "x-real-ip",
  "x-forwarded-for",
  "x-turnstile-token",
  "cf-turnstile-response",
  "x-neon-signature",
  "cookie",
  "set-cookie",
  "authorization",
];

/** Keys whose gazetteer town id makes the object a town: its point, outline, `name` and `label` are read against that town (A33). */
export const TOWN_OWNER_KEYS: readonly string[] = ["id", "key", "value"];
/** Keys whose value may be a gazetteer town id, exempt for that string only (a row's nearest town, a reference): never an owner (R-2). */
export const TOWN_REF_KEYS: readonly string[] = ["nearTown", "townId"];
/** Keys whose value may be a town's name or a chip label naming it (A33). */
export const TOWN_NAME_KEYS: readonly string[] = ["name", "label"];
/** The longest town name or chip label the exemption lifts. */
export const TOWN_LABEL_MAX = 80;
/** Keys that echo the request's own words (search `query`, parse `q`, `unused`, `notYet`, card search `terms`; A40). */
export const ECHO_KEYS: readonly string[] = ["query", "q", "unused", "notYet", "terms"];

export interface Hit {
  where: string;
  why: string;
}

export interface DetectOptions {
  /** the loaded public gazetteer (towns.ts); absent or null: no town is exempt from anything */
  gazetteer?: PublicGazetteer | null;
  /** the request's own strings (query parameter values): what an echo key may repeat */
  echo?: readonly string[];
}

const NUM_PAIR = /(-?\d{1,3}\.\d{2,})\D{1,12}?(-?\d{1,3}\.\d{2,})/g;
/** How deep a JSON string inside a JSON string is followed. */
const JSON_DEPTH = 3;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
/** Letters and digits only, lower case, accents folded: how labels, names and echoes are compared. */
const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** An origin reference under `from`: the string itself, or one inside an object or array there (`{ref}`, a list). */
function isOriginValue(y: unknown, depth = 0): boolean {
  if (typeof y === "string") return ORIGIN_REFERENCE_VALUE.test(y);
  if (depth > 2 || !y || typeof y !== "object") return false;
  return (Array.isArray(y) ? y : Object.values(y as Record<string, unknown>)).some((v) => isOriginValue(v, depth + 1));
}

/** True when a pair of numbers is a point near home, in either order (lat, lon or lon, lat). */
const pairNearHome = (a: number, b: number): boolean => nearHome(a, b) || nearHome(b, a);

/** Text and number pairs inside a string: an export body (GPX attributes, KML coordinates, CSV, the json model) is one string. */
function textHits(text: string, at: string, hits: Hit[], homeTownText = true): void {
  if (ORIGIN_REF.test(text)) hits.push({ where: at, why: "a private origin key (wishlist or prototype id)" });
  if (TRIPLESS_REF.test(text)) hits.push({ where: at, why: "the trip-less lane id" });
  if (homeTownText && HOME_TOWN_RE.test(text)) hits.push({ where: at, why: "the home town" });
  else if (PLANNING_NOTE.test(text) || STREET_ADDRESS.test(text)) hits.push({ where: at, why: "a household planning note" });
  if (text.length > 40) {
    let near = 0;
    for (const m of text.matchAll(NUM_PAIR)) if (pairNearHome(Number(m[1]), Number(m[2]))) near++;
    if (near) hits.push({ where: at, why: `${near} point(s) near the home town in text` });
  }
}

/** The vertices of an encoded polyline near home (A39): a `geometry` string is a line, so it is read as one. False when it is not a polyline. */
function polylineHits(text: string, at: string, hits: Hit[]): boolean {
  if (text.length < 2 || !POLYLINE5_RE.test(text)) return false;
  const pts = decodePolyline5(text);
  if (!pts) return false;
  if (pts.some(([x, y]) => pairNearHome(x, y))) hits.push({ where: at, why: "a coordinate near the home town in an encoded line" });
  return true;
}

/** The parsed value of a string that is a JSON object or array (an export body), else undefined. */
function jsonOf(text: string): unknown {
  const t = text.trimStart();
  if (t[0] !== "{" && t[0] !== "[") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Where a string or array sits: the key it is under, the gazetteer towns of the object around it, and what it inherits from an array. */
interface Ctx {
  key: string | null;
  /** gazetteer town ids of the nearest enclosing town object, inherited by its geometry: what an outline vertex is read against */
  owners: readonly string[];
  /** gazetteer town ids of the object that holds this string directly (its id, key, value or chip set.city): what a label is read against */
  labelOwners: readonly string[];
  /** inside an array under `city` */
  city: boolean;
  /** inside an array under an echo key */
  echo: boolean;
  /** JSON strings followed so far */
  depth: number;
}

/** What a body must not hold, with the JSON path of each hit. Empty when clean. */
export function privacyHits(body: unknown, limit = 20, opts: DetectOptions = {}): Hit[] {
  const gz = opts.gazetteer ?? null;
  const echoes = (opts.echo ?? []).map(fold).filter(Boolean);
  const hits: Hit[] = [];
  const inGz = (x: unknown): x is string => !!gz && typeof x === "string" && gz.has(x);
  const isEcho = (s: string): boolean => {
    const f = fold(s);
    return echoes.some((e) => e.includes(f));
  };
  /** Is this string a town's own name or a short chip label holding it? */
  const isTownLabel = (text: string, owners: readonly string[]): boolean => {
    if (!owners.length || text.length > TOWN_LABEL_MAX || /\d/.test(text)) return false;
    const f = fold(text);
    return owners.some((id) => {
      const n = fold(gz?.name(id) ?? "");
      return n.length > 0 && f.includes(n);
    });
  };
  /** An href with the parameters that carry nothing of ours removed: `city=<gazetteer id>`, and any value the request itself sent. */
  const hrefText = (href: string): string =>
    href.replace(/([?&])([^=&#]*)=([^&#]*)/g, (all, sep: string, name: string, raw: string) => {
      let v = raw;
      try {
        v = decodeURIComponent(raw.replace(/\+/g, " "));
      } catch {
        return all;
      }
      return (name === "city" && inGz(v)) || (echoes.length && isEcho(v)) ? sep : all;
    });

  const walk = (x: unknown, at: string, c: Ctx): void => {
    if (hits.length >= limit) return;
    const { key } = c;
    if (typeof x === "string") {
      // an echo of the request's own words carries nothing the request did not bring (A40)
      if ((c.echo || (key !== null && ECHO_KEYS.includes(key))) && isEcho(x)) return;
      let homeTownText = true;
      let text = x;
      if ((c.city || (key !== null && (TOWN_OWNER_KEYS.includes(key) || TOWN_REF_KEYS.includes(key)))) && inGz(x)) homeTownText = false;
      else if (key !== null && TOWN_NAME_KEYS.includes(key) && isTownLabel(x, c.labelOwners)) homeTownText = false;
      else if (key === "href") text = hrefText(x);
      // a line is geometry, not words: its characters could spell anything, so it is decoded and never read as text
      if (key === "geometry" && polylineHits(x, at, hits)) return;
      // a JSON body (the json export) is read as the structure it is (R-6); the raw text is still read when that finds nothing, for
      // number pairs the structure holds in separate fields
      if (c.depth < JSON_DEPTH) {
        const parsed = jsonOf(x);
        const before = hits.length;
        if (parsed !== undefined) walk(parsed, `${at}<json>`, { key: null, owners: [], labelOwners: [], city: false, echo: false, depth: c.depth + 1 });
        if (hits.length > before) return;
      }
      textHits(text, at, hits, homeTownText);
    } else if (Array.isArray(x)) {
      // a coordinate: [lon, lat] or [lat, lon], with an optional height; public only as an exact vertex of the owning town's outline
      if ((x.length === 2 || x.length === 3) && isNum(x[0]) && isNum(x[1]) && pairNearHome(x[0], x[1])) {
        if (!(gz && c.owners.some((id) => gz.isVertex(id, x[0] as number, x[1] as number)))) hits.push({ where: at, why: "a coordinate near the home town" });
      } else {
        const inner: Ctx = { key: null, owners: c.owners, labelOwners: [], city: key === "city" || c.city, echo: (key !== null && ECHO_KEYS.includes(key)) || c.echo, depth: c.depth };
        x.forEach((y, i) => walk(y, `${at}[${i}]`, inner));
      }
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const own = TOWN_OWNER_KEYS.map((k) => o[k]).filter(inGz);
      const set = o.set as Record<string, unknown> | undefined;
      if (set && typeof set === "object" && Array.isArray(set.city)) own.push(...set.city.filter(inGz));
      // an object with no town of its own sits inside its parent's for outline vertices (a GeoJSON geometry inside a city outline),
      // never for labels or points
      const owners = own.length ? own : c.owners;
      if (isNum(o.lat) && isNum(o.lon) && nearHome(o.lat, o.lon) && !(gz && own.some((id) => gz.isPoint(id, o.lat as number, o.lon as number)))) {
        hits.push({ where: at, why: "a point near the home town" });
      }
      for (const [k, y] of Object.entries(o)) {
        if (PRIVATE_KEYS.includes(k) || (k === "status" && typeof y === "string" && STATUS_WORDS.includes(y))) hits.push({ where: `${at}.${k}`, why: "a private key" });
        if (ORIGIN_VALUE_KEYS.includes(k) && isOriginValue(y)) hits.push({ where: `${at}.${k}`, why: "a visitor's origin" });
        // a map keyed by ref (refSlugs, citations) would carry an origin key as a key; the path omits the key so the hit cannot leak it
        if (ORIGIN_REF.test(k)) hits.push({ where: `${at}[key]`, why: "a private origin key (wishlist or prototype id)" });
        if (TRIP_VALUE_KEYS.includes(k) && (y === TRIPLESS_LANE || (Array.isArray(y) && y.includes(TRIPLESS_LANE)))) hits.push({ where: `${at}.${k}`, why: "the trip-less lane id" });
        walk(y, `${at}.${k}`, { key: k, owners, labelOwners: own, city: false, echo: false, depth: c.depth });
      }
    }
  };
  walk(body, "$", { key: null, owners: [], labelOwners: [], city: false, echo: false, depth: 0 });
  return hits;
}
