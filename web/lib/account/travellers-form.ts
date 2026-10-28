// The Travellers editor's form model (ACCT-P2; docs/v2/features/account-profile-and-travellers.md 2.3, 2.7 AP-25). Pure: no storage,
// no network, no clock (callers pass `today`). The editor holds a `TravellersForm`; Save turns it into a `travellers/1` document,
// or into the errors to show. An age or date of birth is never logged, put in a URL or sent anywhere but the save action.
import { CHILD_MAX_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS, type Party } from '@travel/core/trips/party.ts';
import { TRAVELLERS } from '@travel/core/config/account.ts';
import { TRAVELLERS_SCHEMA, ageNow, ageOn, parseTravellers, type AgeEntry, type Travellers } from '@travel/core/schema/travellers.ts';

/** One person in the form. `age` null = not chosen; `dob` '' = none; `dobOpen` = the date field is showing. */
export interface PersonForm {
  age: number | null;
  dob: string;
  dobOpen: boolean;
}

export interface TravellersForm {
  adults: number;
  /** null = "Add adults' ages" is closed; else one entry per adult (blank ones are dropped on save). */
  adultAges: PersonForm[] | null;
  children: PersonForm[];
}

export const blankPerson = (): PersonForm => ({ age: null, dob: '', dobOpen: false });

/** The date `d` as the person's local `YYYY-MM-DD` (the client's "today"; the server allows one day of skew). */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const clampAge = (n: number): number => Math.min(CHILD_MAX_AGE, Math.max(0, n));

function personFrom(e: AgeEntry, today: string, child: boolean): PersonForm {
  const age = ageNow(e, today);
  return { age: child ? clampAge(age) : age, dob: e.dob ?? '', dobOpen: !!e.dob };
}

/** The saved document as a form: every age as it reads today. */
export function formFromTravellers(t: Travellers, today: string): TravellersForm {
  return {
    adults: t.adults,
    adultAges: t.adult_ages?.length ? t.adult_ages.map((e) => personFrom(e, today, false)) : null,
    children: t.children.map((c) => personFrom(c, today, true)),
  };
}

/** A device party as a form (an unset age stays empty). */
export function formFromParty(p: Party): TravellersForm {
  return { adults: p.adults, adultAges: null, children: p.children.map((age) => ({ age, dob: '', dobOpen: false })) };
}

export const emptyForm = (adults = 2): TravellersForm => ({ adults, adultAges: null, children: [] });

/** The age a person's fields give: from the date of birth when there is one, else the chosen age. */
export const personAge = (p: PersonForm, today: string): number | null => (p.dob ? ageOn(p.dob, today) : p.age);

// ---- validation (AP-25) -----------------------------------------------------------------------------------------------------

export type PersonIssue = 'age' | 'future' | 'child_old' | 'adult_young' | 'adult_old';
export const PERSON_COPY: Record<PersonIssue, string> = {
  age: 'Choose an age.',
  future: "The date of birth can't be in the future.",
  child_old: 'A child is 17 or younger. Count older travellers as adults.',
  adult_young: 'An adult is 18 or older.',
  adult_old: `Enter an age from ${TRAVELLERS.adultMinAge} to ${TRAVELLERS.maxAge}.`,
};

/** A child's missing age while the date field is open: two ways to answer, both named (review ACCT-PR SF8). */
export const AGE_OR_DOB_COPY = 'Choose an age, or enter a date of birth.';

export interface FormIssues {
  children: (PersonIssue | null)[];
  adults: (PersonIssue | null)[];
}

function childIssue(p: PersonForm, today: string): PersonIssue | null {
  if (p.dob) {
    if (p.dob > today) return 'future';
    return ageOn(p.dob, today) > CHILD_MAX_AGE ? 'child_old' : null;
  }
  return p.age === null ? 'age' : null;
}

/** An adult's age is optional: a blank one is fine; one that is given must be 18 to 120. */
function adultIssue(p: PersonForm, today: string): PersonIssue | null {
  if (p.dob) {
    if (p.dob > today) return 'future';
    const a = ageOn(p.dob, today);
    return a < TRAVELLERS.adultMinAge ? 'adult_young' : a > TRAVELLERS.maxAge ? 'adult_old' : null;
  }
  if (p.age === null) return null;
  return p.age < TRAVELLERS.adultMinAge ? 'adult_young' : p.age > TRAVELLERS.maxAge ? 'adult_old' : null;
}

export function issuesOf(f: TravellersForm, today: string): FormIssues {
  return { children: f.children.map((c) => childIssue(c, today)), adults: (f.adultAges ?? []).map((a) => adultIssue(a, today)) };
}

export const hasIssues = (i: FormIssues): boolean => [...i.children, ...i.adults].some((x) => x !== null);

/** The form as a document entered on `today`, or null while any field has an issue. */
export function toTravellers(f: TravellersForm, today: string): Travellers | null {
  if (hasIssues(issuesOf(f, today))) return null;
  const entry = (p: PersonForm): AgeEntry => {
    const age = personAge(p, today) as number;
    return p.dob ? { age, age_as_of: today, dob: p.dob } : { age, age_as_of: today };
  };
  const given = (f.adultAges ?? []).filter((a) => a.dob || a.age !== null);
  const doc: Travellers = {
    schema: TRAVELLERS_SCHEMA,
    adults: Math.min(PARTY_MAX_ADULTS, Math.max(PARTY_MIN_ADULTS, f.adults)),
    children: f.children.slice(0, PARTY_MAX_CHILDREN).map(entry),
    ...(given.length ? { adult_ages: given.slice(0, f.adults).map(entry) } : {}),
  };
  // The server checks again; this keeps a form that cannot save from ever being sent.
  return parseTravellers(doc, today).success ? doc : null;
}
