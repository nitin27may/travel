// THE PRIVACY DETECTOR: what no served output may hold, in one place (audit G-B, GB-A-7). `respond()` runs it on every API body and fails
// closed; the contract kit's K7 and the web privacy test run it too, so the three lists cannot drift. It only LOOKS: the scrub that
// removes these things runs where the data is built (origin.ts, party.ts, dateless.ts). Hits name a path and a reason, never the value,
// and never a coordinate.
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

export interface Hit {
  where: string;
  why: string;
}

const NUM_PAIR = /(-?\d{1,3}\.\d{2,})\D{1,12}?(-?\d{1,3}\.\d{2,})/g;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** True when a pair of numbers is a point near home, in either order (lat, lon or lon, lat). */
const pairNearHome = (a: number, b: number): boolean => nearHome(a, b) || nearHome(b, a);

/** Text and number pairs inside a string: an export body (GPX attributes, KML coordinates, CSV, the print JSON) is one string. */
function textHits(text: string, at: string, hits: Hit[]): void {
  if (ORIGIN_REF.test(text)) hits.push({ where: at, why: "a private origin key (wishlist or prototype id)" });
  if (HOME_TOWN_RE.test(text)) hits.push({ where: at, why: "the home town" });
  else if (PLANNING_NOTE.test(text) || STREET_ADDRESS.test(text)) hits.push({ where: at, why: "a household planning note" });
  if (text.length > 40) {
    let near = 0;
    for (const m of text.matchAll(NUM_PAIR)) if (pairNearHome(Number(m[1]), Number(m[2]))) near++;
    if (near) hits.push({ where: at, why: `${near} point(s) near the home town in text` });
  }
}

/** What a body must not hold, with the JSON path of each hit. Empty when clean. */
export function privacyHits(body: unknown, limit = 20): Hit[] {
  const hits: Hit[] = [];
  const walk = (x: unknown, at: string): void => {
    if (hits.length >= limit) return;
    if (typeof x === "string") textHits(x, at, hits);
    else if (Array.isArray(x)) {
      // a coordinate: [lon, lat] or [lat, lon], with an optional height
      if ((x.length === 2 || x.length === 3) && isNum(x[0]) && isNum(x[1]) && pairNearHome(x[0], x[1])) hits.push({ where: at, why: "a coordinate near the home town" });
      else x.forEach((y, i) => walk(y, `${at}[${i}]`));
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (isNum(o.lat) && isNum(o.lon) && nearHome(o.lat, o.lon)) hits.push({ where: at, why: "a point near the home town" });
      for (const [k, y] of Object.entries(o)) {
        if (PRIVATE_KEYS.includes(k) || (k === "status" && typeof y === "string" && STATUS_WORDS.includes(y))) hits.push({ where: `${at}.${k}`, why: "a private key" });
        // a map keyed by ref (refSlugs, citations) would carry an origin key as a key; the path omits the key so the hit cannot leak it
        if (ORIGIN_REF.test(k)) hits.push({ where: `${at}[key]`, why: "a private origin key (wishlist or prototype id)" });
        walk(y, `${at}.${k}`);
      }
    }
  };
  walk(body, "$");
  return hits;
}
