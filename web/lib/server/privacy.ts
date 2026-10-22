import { nearHome } from '@/lib/public/origin';

// The privacy DETECTOR of respond() (store.ts A18, review R-15). The scrub itself runs where the data is built (lib/public: scrubOrigin,
// TextScrub, the party rules); this only LOOKS at a body before it leaves and reports what it finds. respond() then fails closed: a
// body with a hit is never sent and never rewritten, so a page and the API cannot differ and the ETag always describes the bytes sent.

/** The home town and the household's planning notes, as the privacy test lists them (web/tests/privacy.test.ts). */
const HOME_NAME = /whitby/i;
/**
 * The planning notes the scrub drops whole (lib/public/dateless.ts HOUSEHOLD_TEXT): a plan link, a stay idea, a base camp. The street
 * address rule is case-sensitive here: the scrub's case-insensitive form reads "30 min each way" as an address, which a detector that
 * blocks a response cannot afford.
 */
const PLANNING_NOTE = /\bplanned as\b|\b(?:hotel|stay|lodging|airbnb|accommodation|campsite|hut)\s+(?:idea|ideas|choice|pick|booked)\b|\bbase camp:/i;
const STREET_ADDRESS = /\b\d{2,5}\s+[A-Z][\w'. -]{2,30}\s(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Blvd)\b/;
/** The place status a household sets (idea, planned ...): never published, whatever the key's other uses. */
const STATUS_WORDS = new Set(['idea', 'shortlisted', 'planned', 'visited', 'dropped']);
/** Keys that carry household data when they appear in any output (the owner's save metadata since PRIV1, traveller details, payments). */
const PRIVATE_KEYS = new Set(['height_cm', 'weight_kg', 'age_years', 'citizenship', 'confirmation', 'contact', 'price_paid_amount', 'insurer_tel', 'stayStatus', 'location_status', 'sourceTypes', 'added']);

export interface Hit {
  where: string;
  why: string;
}

/** What a body must not hold, with the JSON path of each hit. Empty when clean. */
export function privacyHits(body: unknown): Hit[] {
  const hits: Hit[] = [];
  const walk = (x: unknown, at: string): void => {
    if (hits.length >= 20) return;
    if (typeof x === 'string') {
      if (HOME_NAME.test(x)) hits.push({ where: at, why: 'the home town' });
      else if (PLANNING_NOTE.test(x) || STREET_ADDRESS.test(x)) hits.push({ where: at, why: 'a household planning note' });
    } else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${at}[${i}]`));
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.lat === 'number' && typeof o.lon === 'number' && nearHome(o.lat, o.lon)) hits.push({ where: at, why: 'a point near the home town' });
      for (const [k, y] of Object.entries(o)) {
        if (PRIVATE_KEYS.has(k) || (k === 'status' && typeof y === 'string' && STATUS_WORDS.has(y))) hits.push({ where: `${at}.${k}`, why: 'a private key' });
        walk(y, `${at}.${k}`);
      }
    }
  };
  walk(body, '$');
  return hits;
}

/** The first key outside the allowlist in any row of a paged answer, or null: rows carry exactly the contract's keys (P8, case K2). */
export function rowOutsideAllowlist(items: unknown, allowed: ReadonlySet<string>): string | null {
  if (!Array.isArray(items)) return null;
  for (const row of items) {
    if (row && typeof row === 'object') for (const k of Object.keys(row)) if (!allowed.has(k)) return k;
  }
  return null;
}
