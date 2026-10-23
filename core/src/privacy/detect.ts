// THE PRIVACY DETECTOR: what no served output may hold, in one place (audit G-B, GB-A-7). `respond()` runs it on every API body and fails
// closed; the contract kit's K7 and the web privacy test run it too, so the three lists cannot drift. It only LOOKS: the scrub that
// removes these things runs where the data is built (origin.ts, party.ts, dateless.ts, towns.ts). Hits name a path and a reason, never
// the value, and never a coordinate.
//
// The typed exemption (D-E3, store.ts A33; owner decision Q87). The towns layer serves every town, the home town included, so its NAME
// may appear in the places where any town's name appears, and nowhere else. The exemption is by SHAPE, never by name, and lifts only
// the home-town TEXT rule; every other rule (coordinates, planning notes, addresses, private keys, origin refs) still runs there:
//   - a town id: a string matching TOWN_ID_RE held under `id`, `key`, `value`, `nearTown` or `townId`, or inside an array under `city`
//     (a towns row's id, a near centre's key, a city facet option, a row's nearest town, a parse's `city` facet);
//   - a town's name or chip label: a string under `name` or `label`, of at most 80 characters with no digit, in an object that holds a
//     town id as above (or a `set.city` town id, a parse chip), and whose folded text contains that town id's own name part;
//   - a link: the `city=<town id>` parameters of a string under `href` are not read as text.
// Encoded polylines (a string under `geometry`, store.ts A34, A39) are decoded and every vertex is tested like any coordinate.
import { TOWN_ID_RE } from "../schema/capture/points.ts";
import { decodePolyline5, POLYLINE5_RE } from "../schema/api/legs.ts";
import { HOME_TOWN_RE, nearHome } from "./home.ts";

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
/** Keys that carry household data in any output (the owner's save metadata since PRIV1, traveller details, payments). */
export const PRIVATE_KEYS: readonly string[] = ["height_cm", "weight_kg", "age_years", "citizenship", "confirmation", "contact", "price_paid_amount", "insurer_tel", "stayStatus", "location_status", "sourceTypes", "added"];

/** Keys whose value may be a town id (the typed exemption, A33). */
export const TOWN_ID_KEYS: readonly string[] = ["id", "key", "value", "nearTown", "townId"];
/** Keys whose value may be a town's name or a chip label naming it (A33). */
export const TOWN_NAME_KEYS: readonly string[] = ["name", "label"];
/** The longest town name or chip label the exemption lifts. */
export const TOWN_LABEL_MAX = 80;

export interface Hit {
  where: string;
  why: string;
}

export interface DetectOptions {
  /** the typed town exemption (A33); on by default, off to test the raw rules */
  townSlots?: boolean;
}

const NUM_PAIR = /(-?\d{1,3}\.\d{2,})\D{1,12}?(-?\d{1,3}\.\d{2,})/g;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isTownId = (x: unknown): x is string => typeof x === "string" && TOWN_ID_RE.test(x);
/** Letters and digits only, lower case, accents folded: how a label and a town id's name part are compared. */
const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** The name part of a town id `<cc>-<admin1>-<slug>`, folded. */
const townNamePart = (id: string): string => fold(id.split("-").slice(2).join("-"));

/** True when a pair of numbers is a point near home, in either order (lat, lon or lon, lat). */
const pairNearHome = (a: number, b: number): boolean => nearHome(a, b) || nearHome(b, a);

/** The town ids an object holds in an id slot or a parse chip's `set.city`: what makes its `name` and `label` a town label slot. */
function townIdsOf(o: Record<string, unknown>): string[] {
  const ids = TOWN_ID_KEYS.map((k) => o[k]).filter(isTownId);
  const set = o.set as Record<string, unknown> | undefined;
  if (set && typeof set === "object" && Array.isArray(set.city)) ids.push(...set.city.filter(isTownId));
  return ids;
}

/** Is this string the town's own name or a short chip label holding it (A33)? */
function isTownLabel(text: string, ids: readonly string[]): boolean {
  if (!ids.length || text.length > TOWN_LABEL_MAX || /\d/.test(text)) return false;
  const f = fold(text);
  return ids.some((id) => f.includes(townNamePart(id)));
}

/** Text and number pairs inside a string: an export body (GPX attributes, KML coordinates, CSV, the json model) is one string. */
function textHits(text: string, at: string, hits: Hit[], homeTownText = true): void {
  if (ORIGIN_REF.test(text)) hits.push({ where: at, why: "a private origin key (wishlist or prototype id)" });
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

/** What a body must not hold, with the JSON path of each hit. Empty when clean. */
export function privacyHits(body: unknown, limit = 20, opts: DetectOptions = {}): Hit[] {
  const slots = opts.townSlots !== false;
  const hits: Hit[] = [];
  const walk = (x: unknown, at: string, key: string | null, owner: string[] | null): void => {
    if (hits.length >= limit) return;
    if (typeof x === "string") {
      // owner: the town ids of the object holding this string (name and label slots), or of the `city` array it sits in
      let homeTownText = true;
      if (slots && key !== null) {
        if ((TOWN_ID_KEYS.includes(key) || key === "city") && isTownId(x)) homeTownText = false;
        else if (TOWN_NAME_KEYS.includes(key) && owner && isTownLabel(x, owner)) homeTownText = false;
        else if (key === "href") x = x.replace(/([?&])city=[^&#]*/g, "$1");
      }
      // a line is geometry, not words: its characters could spell anything, so it is decoded and never read as text
      if (key === "geometry" && polylineHits(x as string, at, hits)) return;
      textHits(x as string, at, hits, homeTownText);
    } else if (Array.isArray(x)) {
      // a coordinate: [lon, lat] or [lat, lon], with an optional height
      if ((x.length === 2 || x.length === 3) && isNum(x[0]) && isNum(x[1]) && pairNearHome(x[0], x[1])) hits.push({ where: at, why: "a coordinate near the home town" });
      else x.forEach((y, i) => walk(y, `${at}[${i}]`, key === "city" ? "city" : null, null));
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (isNum(o.lat) && isNum(o.lon) && nearHome(o.lat, o.lon)) hits.push({ where: at, why: "a point near the home town" });
      const ids = slots ? townIdsOf(o) : [];
      for (const [k, y] of Object.entries(o)) {
        if (PRIVATE_KEYS.includes(k) || (k === "status" && typeof y === "string" && STATUS_WORDS.includes(y))) hits.push({ where: `${at}.${k}`, why: "a private key" });
        // a map keyed by ref (refSlugs, citations) would carry an origin key as a key; the path omits the key so the hit cannot leak it
        if (ORIGIN_REF.test(k)) hits.push({ where: `${at}[key]`, why: "a private origin key (wishlist or prototype id)" });
        walk(y, `${at}.${k}`, k, ids);
      }
    }
  };
  walk(body, "$", null, null);
  return hits;
}
