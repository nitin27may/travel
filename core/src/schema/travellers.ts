// travellers/1: who usually travels with a signed-in person, saved to their account (ACCT-PC;
// docs/v2/features/account-profile-and-travellers.md 5.1, amended 27 Oct 2026 by the owner's answer to Q-AP1: ages, not birth months).
// One document per user in `account_profile.travellers` (migration 0012), read and written only through core/src/db/profile.ts.
//
// WHAT IT HOLDS: the adult count; each child's whole-year `age` with `age_as_of`, the day it was entered; an optional date of birth
// (`dob`) per person; optional adults' ages. NEVER a name, a label, an id, a passport or anything else about a person.
//
// THE ONE AGE RULE is `ageNow`: with a `dob` the exact age on a date; without one, the entered age plus the whole years since
// `age_as_of`. The rolled age is a lower bound (the birthday falls somewhere in the year after entry), so it can lag the real age by
// up to a year and never runs ahead of it; `ageNeedsCheck` drives the yearly "Are these ages still right?" notice.
//
// PRIVACY (spec 10.1): household data about minors. It never enters public output, a URL, a log line, analytics, a feedback report
// or a copy (copies hold plain ages). The privacy detector (core/src/privacy/detect.ts) refuses `dob`, `born`, `birth*`, `age_as_of`,
// `ages`, `travellers` and the value `travellers/1` in any served body. The device party (`travel.party`) gets ages only (`partyOf`).
//
// VALIDATION. The raw zod objects keep to the JSON Schema subset (strict, no refine or transform); the rules that need "today" or two
// fields live in `travellersRules`. Use `parseTravellers`, never `.parse` on the raw object. Issues name a path and a rule, never a
// value. Pure: no I/O, no clock (callers pass today; `isoDay` turns a Date into the UTC day).
import { z } from "zod";
import { TRAVELLERS } from "../config/account.ts";
import { CHILD_MAX_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS, sameParty, type Party } from "../trips/party.ts";

export const TRAVELLERS_SCHEMA = "travellers/1";

/** A real calendar date, `YYYY-MM-DD`. */
const isoDate = z.iso.date();

const entryShape = {
  /** whole years on `age_as_of` */
  age: z.int(),
  /** the day the age was entered or confirmed */
  age_as_of: isoDate,
  /** optional date of birth; when present the age is derived from it */
  dob: isoDate.optional(),
};

/** A child: 0 to 17 on the day the age was entered. */
export const childEntry = z.strictObject({ ...entryShape, age: z.int().min(0).max(CHILD_MAX_AGE) });
/** An adult whose age is saved: 18 to 120 on the day it was entered. */
export const adultEntry = z.strictObject({ ...entryShape, age: z.int().min(TRAVELLERS.adultMinAge).max(TRAVELLERS.maxAge) });

export const travellers = z.strictObject({
  schema: z.literal(TRAVELLERS_SCHEMA),
  adults: z.int().min(PARTY_MIN_ADULTS).max(PARTY_MAX_ADULTS),
  /** optional; at most `adults` entries, in the order entered; not read by any page yet */
  adult_ages: z.array(adultEntry).max(PARTY_MAX_ADULTS).optional(),
  children: z.array(childEntry).max(PARTY_MAX_CHILDREN),
});

export type AgeEntry = z.infer<typeof childEntry>;
export type Travellers = z.infer<typeof travellers>;
export type Checked<T> = { success: true; data: T } | { success: false; issues: string[] };

// ---- dates ------------------------------------------------------------------------------------------------------------------------

const parts = (d: string): [number, number, number] => {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
};
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The UTC day of a moment, `YYYY-MM-DD`: the server's "today". */
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** `d` plus `n` days. */
export function addDays(d: string, n: number): string {
  const [y, m, day] = parts(d);
  return isoDay(new Date(Date.UTC(y, m - 1, day + n)));
}

/**
 * Whole years from `dob` to `date` (negative when `date` is before `dob`). A 29 February birthday falls on 1 March in a common
 * year. Also the whole years between any two days (the anniversaries of `age_as_of`).
 */
export function ageOn(dob: string, date: string): number {
  const [by, bm, bd] = parts(dob);
  const [y, m, d] = parts(date);
  let [hm, hd] = [bm, bd];
  if (bm === 2 && bd === 29 && !isLeap(y)) [hm, hd] = [3, 1];
  return y - by - (m < hm || (m === hm && d < hd) ? 1 : 0);
}

/** Whole months from `from` to `to` (0 when `to` is not later). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0));
}

/** THE age rule: exact from a date of birth, else the entered age rolled on by the whole years since it was entered. */
export function ageNow(e: AgeEntry, date: string): number {
  if (e.dob) return ageOn(e.dob, date);
  return e.age + Math.max(0, ageOn(e.age_as_of, date));
}

// ---- validation -------------------------------------------------------------------------------------------------------------------

/** UTF-8 bytes of the document as JSON. */
export const travellersBytes = (t: unknown): number => new TextEncoder().encode(JSON.stringify(t)).length;

/** zod issues as `path: rule`, never a value (the document is a family's data). */
function issuesOf(e: z.ZodError): string[] {
  return e.issues.map((i) => `$${i.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("")}: ${i.code}`);
}

/** The rules a shape cannot say: dates against today, a date of birth against its age, the adult-age count, the size. */
export function travellersRules(t: Travellers, today: string): string[] {
  const out: string[] = [];
  const latest = addDays(today, TRAVELLERS.dateSkewDays);
  const entry = (e: AgeEntry, at: string): void => {
    if (e.age_as_of > latest) out.push(`${at}.age_as_of: future`);
    if (e.dob !== undefined) {
      if (e.dob > latest) out.push(`${at}.dob: future`);
      else if (ageOn(e.dob, e.age_as_of) !== e.age) out.push(`${at}.age: dob_mismatch`);
    }
    if (ageNow(e, today) > TRAVELLERS.maxAge) out.push(`${at}.age: too_old`);
  };
  t.children.forEach((e, i) => entry(e, `$.children[${i}]`));
  (t.adult_ages ?? []).forEach((e, i) => entry(e, `$.adult_ages[${i}]`));
  if ((t.adult_ages?.length ?? 0) > t.adults) out.push("$.adult_ages: more_than_adults");
  if (travellersBytes(t) > TRAVELLERS.maxBytes) out.push("$: too_big");
  return out;
}

/**
 * The one way in, for a read and for a write: the shape (strict), then the rules. `today` is the server's UTC day (`isoDay`). A
 * stored child who has turned 18 since is still valid (the rule is on `age_as_of`); `grownUp` flags it.
 */
export function parseTravellers(x: unknown, today: string): Checked<Travellers> {
  const r = travellers.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = travellersRules(r.data, today);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

// ---- the party, both ways ---------------------------------------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** The device party on `date`: the adult count and each child's age now, clamped to 0..17. Ages only, never a date. */
export function partyOf(t: Travellers, date: string): Party {
  return { adults: t.adults, children: t.children.map((c) => clamp(ageNow(c, date), 0, CHILD_MAX_AGE)) };
}

/** A document from a device party, each age entered on `date`; null while a child's age is unset (the editor asks first). */
export function travellersFromParty(p: Party, date: string): Travellers | null {
  if (p.children.some((c) => c === null)) return null;
  return { schema: TRAVELLERS_SCHEMA, adults: p.adults, children: p.children.map((age) => ({ age: age as number, age_as_of: date })) };
}

/** The saved travellers and a device party plan for the same people on `date`. */
export const sameAsParty = (t: Travellers, p: Party, date: string): boolean => sameParty(partyOf(t, date), p);

/** The indexes of children who are 18 or older on `date` (the "Count them as an adult?" notice). */
export const grownUp = (t: Travellers, date: string): number[] =>
  t.children.flatMap((c, i) => (ageNow(c, date) > CHILD_MAX_AGE ? [i] : []));

/** True when an age with no date of birth was entered at least `recheckMonths` ago (the "Are these ages still right?" notice). */
export const ageNeedsCheck = (t: Travellers, date: string): boolean =>
  [...t.children, ...(t.adult_ages ?? [])].some((e) => !e.dob && monthsBetween(e.age_as_of, date) >= TRAVELLERS.recheckMonths);

/**
 * "Looks right": every entry re-based to `date` with its age now. A child who is already 18 is left as stored (still valid, still
 * flagged), so the answer always parses.
 */
export function refreshAges(t: Travellers, date: string): Travellers {
  const rebase = (e: AgeEntry): AgeEntry => ({ age: ageNow(e, date), age_as_of: date, ...(e.dob ? { dob: e.dob } : {}) });
  const out: Travellers = {
    schema: TRAVELLERS_SCHEMA,
    adults: t.adults,
    children: t.children.map((c) => (ageNow(c, date) > CHILD_MAX_AGE ? c : rebase(c))),
  };
  if (t.adult_ages) out.adult_ages = t.adult_ages.map(rebase);
  return out;
}
