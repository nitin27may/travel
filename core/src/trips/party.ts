// The party as the trip page's "Plan it for" bar holds it (trip-and-places-ux-fixes.md 5.2 to 5.4, D6; Q295, Q296). Pure, with no
// runtime import: the collapsed bar reads it in the trip page's start chunk.
//
// The party is household data. It lives on this device only (`travel.party`, web/lib/storage/keys.ts) and in a copy's `adults` and
// `children[]` (`copies/1`, `trip-custom/1` `travellers`: shapes unchanged). A link carries two numbers derived from it and nothing
// else: the youngest age (`p=family-<n>`) and the adult count (`a=<n>`, 1 to 12). Children's ages never enter a URL, the export,
// the share text or analytics (navigation-and-mine.md 2.3; spec 15 "Party storage is household data").
import type { Pace, Profile } from "../schedule/types.ts";

/** Adults 1 to 12 (the codec's `a`, the copies schema's MAX_ADULTS). */
export const PARTY_MIN_ADULTS = 1;
export const PARTY_MAX_ADULTS = 12;
/** Children 0 to 8 in the editor (the copy sheet's cap; `copies/1` itself allows 12, unchanged). */
export const PARTY_MAX_CHILDREN = 8;
export const CHILD_MAX_AGE = 17;
/** FAMAGE10 (PLAN R-121): a child whose age is not set plans as 10. */
export const DEFAULT_CHILD_AGE = 10;

export interface Party {
  adults: number;
  /** One entry per child, in the order entered; null while the age is not set (the plan uses DEFAULT_CHILD_AGE). */
  children: (number | null)[];
}

export const DEFAULT_PARTY: Party = { adults: 2, children: [] };

const int = (x: unknown): number | null => (typeof x === "number" && Number.isInteger(x) ? x : null);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * A party from anything (a stored value, an old copy): adults clamped to 1..12, at most 8 children, each age 0..17 or null.
 * Null when the input has no usable adult count, so a broken stored value reads as "no party kept".
 */
export function cleanParty(raw: unknown): Party | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as { adults?: unknown; children?: unknown };
  const a = int(o.adults);
  if (a === null) return null;
  const kids = Array.isArray(o.children) ? o.children : [];
  const children = kids.slice(0, PARTY_MAX_CHILDREN).map((c) => {
    const n = int(c);
    return n === null ? null : clamp(n, 0, CHILD_MAX_AGE);
  });
  return { adults: clamp(a, PARTY_MIN_ADULTS, PARTY_MAX_ADULTS), children };
}

/** The age a child plans as: its own, or 10 when not set (FAMAGE10). */
export const planAge = (age: number | null): number => age ?? DEFAULT_CHILD_AGE;

/** The youngest age the plan uses: the lowest age entered (an unset age counts as 10); null with no children (adults only). */
export function youngestOf(p: Party): number | null {
  return p.children.length ? Math.min(...p.children.map(planAge)) : null;
}

/** The profile a party plans as: children 0 means adults only (no "Adults only / Family" toggle, finding I5). Pace, walk and split stay. */
export function profileForParty(p: Party, base: Profile): Profile {
  const youngest = youngestOf(p);
  return { ...base, party: youngest === null ? "adults" : "family", youngest, adults: p.adults };
}

/** The ages a copy stores (`copies/1` `children` is number[]): an unset age is stored as the age it plans as. */
export const copyChildren = (p: Party): number[] => p.children.map(planAge);

/** Two parties are the same household for the bar (the shared-link offer is not drawn when they match). */
export const sameParty = (a: Party, b: Party): boolean => a.adults === b.adults && a.children.length === b.children.length && a.children.every((c, i) => c === b.children[i]);

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "1 adult", "2 adults". */
export const adultsText = (n: number): string => count(n, "adult", "adults");

/** "1 child (7)", "2 children (7, 10)", "1 child (age not set)", "2 children (7, age not set)"; "" with no children. Ages in the order entered. */
export function childrenText(children: readonly (number | null)[]): string {
  if (!children.length) return "";
  const ages = children.map((a) => (a === null ? "age not set" : String(a))).join(", ");
  return `${count(children.length, "child", "children")} (${ages})`;
}

/** The party in words (5.2), one function for the bar, Mine's rows and the copy sheet: "2 adults · 2 children (7, 10)". */
export function partyText(p: Party, sep = " · "): string {
  return [adultsText(p.adults), childrenText(p.children)].filter(Boolean).join(sep);
}

/** The short form, without ages, for the sticky day rail and the offer button: "2 adults, 1 child". */
export function partyShortText(p: Party): string {
  return [adultsText(p.adults), p.children.length ? count(p.children.length, "child", "children") : ""].filter(Boolean).join(", ");
}

export const PACE_WORD: Readonly<Record<Pace, string>> = { relaxed: "Relaxed", standard: "Standard", full: "Full" };

/**
 * The collapsed bar's line: "2 adults · 1 child (10) · Standard pace"; `short` drops "pace" (phones, the day rail):
 * "2 adults · 1 child (10) · Standard".
 */
export function partyLine(p: Party, pace: Pace, short = false): string {
  return `${partyText(p)} · ${PACE_WORD[pace]}${short ? "" : " pace"}`;
}

/**
 * The party a profile from a URL implies, for the words of a shared plan: the adult count and the youngest only (a link never
 * carries the other ages). "Shared plan: family, youngest 6" is the bar's job; this gives the numbers.
 */
export function partyOfProfile(p: Pick<Profile, "party" | "youngest" | "adults">): { adults: number; youngest: number | null } {
  return { adults: p.adults, youngest: p.party === "family" ? (p.youngest ?? DEFAULT_CHILD_AGE) : null };
}

// ---- the landing rule (Q295) ----------------------------------------------------------------------------------------------

/** The codec keys that describe the party. Pace, walk, split and the per-day keys do not, so they never block the device party. */
export const PARTY_URL_KEYS = ["p", "a"] as const;

export const hasPartyKeys = (query: URLSearchParams | string): boolean => {
  const q = typeof query === "string" ? new URLSearchParams(query.replace(/^\?/, "")) : query;
  return PARTY_URL_KEYS.some((k) => q.has(k));
};

export type LandingMode =
  /** No party in the link and none kept (or storage blocked): the trip's own default. The bar reads "Plan as written". */
  | "written"
  /** No party in the link, a party kept on this device: it is applied after hydration and the bar reads "Your party". */
  | "device"
  /** The link carries a party: the URL wins; a kept party that differs is offered ("Use my party: 2 adults, 2 children"). */
  | "shared";

export interface Landing {
  mode: LandingMode;
  /** The profile patch to apply after hydration (mode `device` only). */
  apply: Pick<Profile, "party" | "youngest" | "adults"> | null;
  /** The kept party to offer over a shared link, when it differs from what the link plans for. */
  offer: Party | null;
}

/**
 * Q295: a trip opened with no party keys in its link applies the party kept on this device; a link with party keys wins and the kept
 * party is offered. `asWritten` is the per-trip "Plan as written" choice (`travel.tripui`): after it, the device party is not applied
 * again to that trip until the visitor edits the party or uses the offer.
 */
export function landingFor(i: { query: URLSearchParams | string; device: Party | null; defaults: Profile; urlProfile: Profile; asWritten?: boolean }): Landing {
  if (hasPartyKeys(i.query)) {
    if (!i.device) return { mode: "shared", apply: null, offer: null };
    const mine = profileForParty(i.device, i.urlProfile);
    const same = mine.party === i.urlProfile.party && mine.youngest === i.urlProfile.youngest && mine.adults === i.urlProfile.adults;
    return { mode: "shared", apply: null, offer: same ? null : i.device };
  }
  if (!i.device || i.asWritten) return { mode: "written", apply: null, offer: null };
  const { party, youngest, adults } = profileForParty(i.device, i.defaults);
  return { mode: "device", apply: { party, youngest, adults }, offer: null };
}
