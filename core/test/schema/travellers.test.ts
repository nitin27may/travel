// travellers/1 (ACCT-PC; account-profile-and-travellers.md 5.1, amended 27 Oct 2026: ages with the date entered, an optional date of
// birth). The one age rule, the strict shape, the rules that need today, and the party both ways.
import { describe, expect, it } from "vitest";
import {
  addDays,
  ageNeedsCheck,
  ageNow,
  ageOn,
  grownUp,
  isoDay,
  monthsBetween,
  parseTravellers,
  partyOf,
  refreshAges,
  sameAsParty,
  travellersFromParty,
  TRAVELLERS_SCHEMA,
  type Travellers,
} from "../../src/schema/travellers.ts";
import { TRAVELLERS } from "../../src/config/account.ts";
import { CHILD_MAX_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN } from "../../src/trips/party.ts";
import { privacyHits } from "../../src/privacy/detect.ts";

const TODAY = "2026-10-27";
const kid = (age: number, age_as_of = TODAY, dob?: string) => (dob ? { age, age_as_of, dob } : { age, age_as_of });
const doc = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: TRAVELLERS_SCHEMA,
  adults: 2,
  children: [kid(7), kid(9)],
  ...over,
});
const ok = (x: unknown, today = TODAY) => parseTravellers(x, today);
const issues = (x: unknown, today = TODAY): string[] => {
  const r = parseTravellers(x, today);
  return r.success ? [] : r.issues;
};

describe("ageOn: whole years between two days", () => {
  it.each([
    ["2019-03-15", "2026-10-27", 7],
    ["2019-10-27", "2026-10-27", 7],
    ["2019-10-28", "2026-10-27", 6],
    ["2019-11-01", "2026-10-27", 6],
    ["2026-10-01", "2026-10-27", 0],
    ["2026-10-27", "2026-10-27", 0],
    ["2026-10-28", "2026-10-27", -1],
  ])("ageOn(%s, %s) = %i", (dob, date, want) => expect(ageOn(dob, date)).toBe(want));

  it("counts a 29 February birthday on 1 March in a common year, and on the day in a leap year", () => {
    expect(ageOn("2016-02-29", "2027-02-28")).toBe(10);
    expect(ageOn("2016-02-29", "2027-03-01")).toBe(11);
    expect(ageOn("2016-02-29", "2028-02-29")).toBe(12);
    expect(ageOn("2016-02-29", "2028-02-28")).toBe(11);
  });
});

describe("ageNow: the one age rule", () => {
  it("is exact from a date of birth, whatever age was stored", () => {
    expect(ageNow(kid(6, "2026-01-10", "2019-11-02"), TODAY)).toBe(6);
    expect(ageNow(kid(6, "2026-01-10", "2019-11-02"), "2026-11-02")).toBe(7);
  });

  it("rolls an age without a date of birth on at each anniversary of the day it was entered", () => {
    const e = kid(6, "2026-01-10");
    expect(ageNow(e, "2026-10-27")).toBe(6);
    expect(ageNow(e, "2027-01-09")).toBe(6);
    expect(ageNow(e, "2027-01-10")).toBe(7);
    expect(ageNow(e, "2036-01-10")).toBe(16);
  });

  it("never goes below the entered age, even for a date before it was entered", () => {
    expect(ageNow(kid(6, "2026-01-10"), "2025-06-01")).toBe(6);
  });

  it("is a lower bound: a child entered as 6 the day before turning 7 still reads 6 for the next year (documented lag)", () => {
    const dob = "2019-10-28";
    const entered = kid(ageOn(dob, TODAY), TODAY);
    expect(entered.age).toBe(6);
    expect(ageNow(entered, "2026-10-28")).toBe(6);
    expect(ageOn(dob, "2026-10-28")).toBe(7);
    for (const d of ["2027-03-01", "2027-10-27", "2027-10-28", "2030-01-01"]) expect(ageNow(entered, d)).toBeLessThanOrEqual(ageOn(dob, d));
  });
});

describe("the date helpers", () => {
  it("isoDay is the UTC day; addDays crosses months and years", () => {
    expect(isoDay(new Date("2026-10-27T23:30:00-05:00"))).toBe("2026-10-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("monthsBetween counts whole months", () => {
    expect(monthsBetween("2025-10-27", "2026-10-27")).toBe(12);
    expect(monthsBetween("2025-10-28", "2026-10-27")).toBe(11);
    expect(monthsBetween("2026-10-27", "2025-01-01")).toBe(0);
  });
});

describe("parseTravellers: the shape (strict)", () => {
  it("accepts 2 adults and 2 children, with or without a date of birth and adults' ages", () => {
    expect(ok(doc()).success).toBe(true);
    expect(ok(doc({ children: [kid(7, TODAY, "2019-03-15"), kid(0, TODAY, "2026-10-01")] })).success).toBe(true);
    expect(ok(doc({ adult_ages: [kid(44), { age: 41, age_as_of: TODAY, dob: "1985-05-05" }] })).success).toBe(true);
    expect(ok(doc({ children: [] })).success).toBe(true);
  });

  it.each([
    ["13 adults", doc({ adults: PARTY_MAX_ADULTS + 1 })],
    ["0 adults", doc({ adults: 0 })],
    ["2.5 adults", doc({ adults: 2.5 })],
    ["9 children", doc({ children: Array.from({ length: PARTY_MAX_CHILDREN + 1 }, () => kid(5)) })],
    ["a child of 18", doc({ children: [kid(CHILD_MAX_AGE + 1)] })],
    ["a negative age", doc({ children: [kid(-1)] })],
    ["a fractional age", doc({ children: [kid(6.5)] })],
    ["an adult of 17", doc({ adult_ages: [kid(17)] })],
    ["an adult of 121", doc({ adult_ages: [kid(121)] })],
    ["a missing age", doc({ children: [{ age_as_of: TODAY }] })],
    ["a missing age_as_of", doc({ children: [{ age: 5 }] })],
    ["an impossible date", doc({ children: [kid(5, "2026-02-30")] })],
    ["a month-and-year date of birth", doc({ children: [{ age: 7, age_as_of: TODAY, dob: "2019-03" }] })],
    ["a name on a child", doc({ children: [{ ...kid(5), name: "Kai" }] })],
    ["a born field (the first draft)", doc({ children: [{ ...kid(5), born: "2019-03" }] })],
    ["an unknown top-level key", doc({ note: "x" })],
    ["another schema", doc({ schema: "travellers/2" })],
    ["no schema", (({ schema: _s, ...rest }) => rest)(doc())],
    ["an array", [doc()]],
    ["null", null],
  ])("refuses %s", (_what, x) => {
    expect(ok(x).success).toBe(false);
  });

  it("names a path and a rule, never a value", () => {
    const out = issues(doc({ children: [{ ...kid(5), name: "Kai Example" }] }));
    expect(out.length).toBeGreaterThan(0);
    for (const i of out) {
      expect(i).toMatch(/^\$[^ ]*: \w+$/);
      expect(i).not.toContain("Kai");
    }
  });
});

describe("parseTravellers: the rules that need today", () => {
  it("refuses a date of birth in the future, but allows one day ahead of UTC (a person east of UTC)", () => {
    const tomorrow = addDays(TODAY, TRAVELLERS.dateSkewDays);
    expect(ok(doc({ children: [kid(0, tomorrow, tomorrow)] })).success).toBe(true);
    expect(issues(doc({ children: [kid(0, TODAY, addDays(TODAY, 2))] }))).toContain("$.children[0].dob: future");
  });

  it("refuses an age_as_of in the future", () => {
    expect(issues(doc({ children: [kid(5, addDays(TODAY, 2))] }))).toContain("$.children[0].age_as_of: future");
  });

  it("refuses a date of birth that disagrees with the age on age_as_of (in either direction)", () => {
    expect(issues(doc({ children: [kid(6, TODAY, "2019-03-15")] }))).toContain("$.children[0].age: dob_mismatch");
    expect(issues(doc({ children: [kid(8, TODAY, "2019-03-15")] }))).toContain("$.children[0].age: dob_mismatch");
    expect(issues(doc({ adult_ages: [kid(40, TODAY, "1990-01-01")] }))).toContain("$.adult_ages[0].age: dob_mismatch");
  });

  it("refuses a date of birth that makes a child 18 on the day entered (the shape cap, through the age)", () => {
    expect(ok(doc({ children: [kid(18, TODAY, "2008-10-27")] })).success).toBe(false);
    expect(ok(doc({ children: [kid(17, TODAY, "2008-10-28")] })).success).toBe(true);
  });

  it("refuses an entry whose rolled age is over 120 today", () => {
    expect(issues(doc({ adult_ages: [kid(119, "2024-01-01")] }))).toContain("$.adult_ages[0].age: too_old");
  });

  it("refuses more adults' ages than adults", () => {
    expect(issues(doc({ adults: 1, adult_ages: [kid(40), kid(41)] }))).toContain("$.adult_ages: more_than_adults");
  });

  it("refuses a document over the byte cap", () => {
    // the largest legal document fits: 12 adults' and 8 children's ages, each with a date of birth
    const full = doc({
      adults: PARTY_MAX_ADULTS,
      adult_ages: Array.from({ length: PARTY_MAX_ADULTS }, () => kid(100, TODAY, "1926-10-27")),
      children: Array.from({ length: PARTY_MAX_CHILDREN }, () => kid(17, TODAY, "2009-10-27")),
    });
    expect(ok(full).success).toBe(true);
    expect(TRAVELLERS.maxBytes).toBeGreaterThan(new TextEncoder().encode(JSON.stringify(full)).length);
  });

  it("keeps a stored child who has turned 18 since (valid on read, flagged by grownUp)", () => {
    const t = doc({ children: [kid(17, "2025-06-01"), kid(4)] });
    const r = ok(t);
    expect(r.success).toBe(true);
    if (r.success) expect(grownUp(r.data, TODAY)).toEqual([0]);
  });
});

describe("the party, both ways", () => {
  const t = ok(doc({ children: [kid(7, TODAY, "2019-03-15"), kid(9, "2025-10-27")] }));
  if (!t.success) throw new Error("fixture");
  const saved = t.data;

  it("partyOf gives ages now, never a date", () => {
    expect(partyOf(saved, TODAY)).toEqual({ adults: 2, children: [7, 10] });
    expect(JSON.stringify(partyOf(saved, TODAY))).not.toMatch(/\d{4}-\d{2}/);
  });

  it("partyOf clamps a grown-up child to 17 (Keep as a child plans as 17)", () => {
    const old = ok(doc({ children: [kid(17, "2024-01-01")] }));
    if (!old.success) throw new Error("fixture");
    expect(partyOf(old.data, TODAY).children).toEqual([CHILD_MAX_AGE]);
  });

  it("travellersFromParty enters each age today, and refuses a party with an unset age", () => {
    expect(travellersFromParty({ adults: 3, children: [4, 0] }, TODAY)).toEqual({
      schema: TRAVELLERS_SCHEMA,
      adults: 3,
      children: [kid(4), kid(0)],
    });
    expect(travellersFromParty({ adults: 2, children: [4, null] }, TODAY)).toBeNull();
    const back = travellersFromParty({ adults: 3, children: [4, 0] }, TODAY)!;
    expect(ok(back).success).toBe(true);
    expect(partyOf(back, TODAY)).toEqual({ adults: 3, children: [4, 0] });
  });

  it("sameAsParty compares on the given day", () => {
    expect(sameAsParty(saved, { adults: 2, children: [7, 10] }, TODAY)).toBe(true);
    expect(sameAsParty(saved, { adults: 2, children: [7, 9] }, TODAY)).toBe(false);
    expect(sameAsParty(saved, { adults: 2, children: [10, 7] }, TODAY)).toBe(false);
  });
});

describe("the yearly check and Looks right", () => {
  it("asks after 12 months for an age with no date of birth, never for one with a date of birth", () => {
    const a = ok(doc({ children: [kid(6, "2025-10-27")] }));
    const b = ok(doc({ children: [kid(6, "2025-10-28")] }));
    const c = ok(doc({ children: [kid(4, "2024-01-01", "2019-03-15")] }));
    const d = ok(doc({ children: [], adult_ages: [kid(40, "2025-01-01")] }));
    if (!a.success || !b.success || !c.success || !d.success) throw new Error("fixture");
    expect(ageNeedsCheck(a.data, TODAY)).toBe(true);
    expect(ageNeedsCheck(b.data, TODAY)).toBe(false);
    expect(ageNeedsCheck(c.data, TODAY)).toBe(false);
    expect(ageNeedsCheck(d.data, TODAY)).toBe(true);
  });

  it("refreshAges re-bases every entry to today, keeps a date of birth, leaves a grown-up child as stored, and parses", () => {
    const r = ok(doc({ children: [kid(6, "2025-01-10"), kid(5, "2025-01-10", "2019-12-01"), kid(17, "2024-01-01")], adult_ages: [kid(40, "2024-05-05")] }));
    if (!r.success) throw new Error("fixture");
    const out = refreshAges(r.data, TODAY);
    expect(out.children).toEqual([kid(7), kid(6, TODAY, "2019-12-01"), kid(17, "2024-01-01")]);
    expect(out.adult_ages).toEqual([kid(42)]);
    expect(ok(out).success).toBe(true);
    expect(ageNeedsCheck(out, TODAY)).toBe(true); // only the grown-up child, still as stored
  });
});

describe("privacy: the document never passes the detector", () => {
  it.each([
    ["the document under travellers", { travellers: doc() }],
    ["the document anywhere", { profile: doc() }],
    ["a date of birth", { child: { dob: "2019-03-15" } }],
    ["a born field", { born: "2019-03" }],
    ["a birth key", { birthDate: "2019-03-15" }],
    ["a birth_year", { kids: [{ birth_year: 2019 }] }],
    ["age_as_of", { x: { age_as_of: TODAY } }],
    ["a list of ages", { ages: [7, 9] }],
    ["adults' ages", { adult_ages: [] }],
    ["the consent time", { travellers_consented_at: "2026-10-27T10:00:00Z" }],
    ["the schema name alone", { kind: "travellers/1" }],
  ])("flags %s", (_what, body) => {
    expect(privacyHits(body).length).toBeGreaterThan(0);
  });

  it("does not flag a party of plain ages under children (the device party, a copy)", () => {
    const r = ok(doc());
    if (!r.success) throw new Error("fixture");
    expect(privacyHits({ party: partyOf(r.data, TODAY) })).toEqual([]);
  });
});
