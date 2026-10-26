import { describe, expect, it } from "vitest";
import { privacyHits } from "../../src/privacy/detect.ts";
import { ORIGIN_REFERENCE, parseTripCustom, readTripCustom, TRIP_CUSTOM_MAX_BYTES, tripCustomRules, type TripCustom } from "../../src/schema/trip-custom.ts";

const mustDoc = (x: unknown): TripCustom => {
  const r = parseTripCustom(x);
  if (!r.success) throw new Error(r.issues.join("; "));
  return r.data;
};

// trip-custom/1 skeleton (NAV-C): what a device copy maps into, plus the reserved `fromRef`, `gw` (origin spec 10) and `rev`.
const DOC: TripCustom = {
  schema: "trip-custom/1",
  profile: { party: "family", youngest: 6, pace: "standard", adults: 2, walk: null, split: false },
  overrides: { "5": "C" },
  added: [{ op: "o-1", day: 5, ref: "place/pyramid-lake" }],
  start: "2027-07-03",
  travellers: { adults: 2, children: [6] },
  fromRef: "iata:BOM",
  gw: { in: "YEG", out: "YYC" },
  rev: "2026-10-20.a1b2",
};

describe("trip-custom/1", () => {
  it("round-trips a full doc through JSON", () => {
    const back = mustDoc(JSON.parse(JSON.stringify(DOC)));
    expect(back).toEqual(DOC);
  });

  it("keeps start, travellers, fromRef, gw and rev optional (an own plan with no date)", () => {
    const { start, travellers, fromRef, gw, rev, ...rest } = DOC;
    void start, void travellers, void fromRef, void gw, void rev;
    expect(parseTripCustom(rest).success).toBe(true);
    expect(parseTripCustom({ ...rest, profile: null, overrides: {}, added: [] }).success).toBe(true);
  });

  it("is strict: a key CUS-C has not added yet fails", () => {
    expect(parseTripCustom({ ...DOC, removed: [] }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, travellers: { adults: 2, children: [], names: ["x"] } }).success).toBe(false);
    // the stored field is fromRef (owner, 26 Oct 2026); the URL's name is refused as a stored key
    expect(parseTripCustom({ ...DOC, from: "iata:BOM" }).success).toBe(false);
  });

  it.each([
    ["iata:BOM", true],
    ["hub:toronto", true],
    ["town:in-mh-mumbai", true],
    ["gn:1275339", true],
    ["iata:bom", false],
    ["Mumbai", false],
    ["gn:0123", false],
    ["loc:CA/ON/x", false],
    ["43.6,-79.4", false],
  ])("fromRef %s valid: %s", (fromRef, ok) => {
    expect(ORIGIN_REFERENCE.test(fromRef)).toBe(ok);
    expect(parseTripCustom({ ...DOC, fromRef }).success).toBe(ok);
  });

  it("checks gw codes, children's ages, the start date and the household ref rule", () => {
    expect(parseTripCustom({ ...DOC, gw: { in: "yeg", out: "YYC" } }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, gw: { in: "YEG" } }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, travellers: { adults: 0, children: [] } }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, travellers: { adults: 2, children: [18] } }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, start: "2027-02-30" }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, added: [{ op: "o-1", day: 5, ref: "loc:CA/ON/secret" }] }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, added: [DOC.added[0], DOC.added[0]] })).toMatchObject({ success: false, issues: ["$.added: each added item has its own op id"] });
    expect(parseTripCustom({ ...DOC, rev: "" }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, overrides: { "5": "D" } }).success).toBe(false);
    expect(parseTripCustom({ ...DOC, overrides: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [String(i + 1), "A"])) })).toMatchObject({ success: false, issues: ["$.overrides: at most 60 overrides"] });
    expect(parseTripCustom({ ...DOC, added: [{ op: "o-1", day: 5, ref: "place/x y" }] }).success).toBe(false);
  });

  it("the 64 KB rule (review M6): the skeleton cannot reach it, so it is pinned on the rule function", () => {
    // the largest doc the skeleton allows: 30 maximal additions and 60 overrides, far under 64 KB
    const big: TripCustom = {
      ...DOC,
      overrides: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [String(i + 1), "A"])),
      added: Array.from({ length: 30 }, (_, i) => ({ op: `o-${i + 1}`, day: 99, ref: `place/${"x".repeat(194)}`, after: "y".repeat(120) })),
    };
    expect(JSON.stringify(big).length).toBeLessThan(TRIP_CUSTOM_MAX_BYTES / 4);
    expect(parseTripCustom(big).success).toBe(true);
    // over 30 additions the schema refuses first, on the count and not the size
    const doubled = parseTripCustom({ ...big, added: [...big.added, ...big.added.map((a, i) => ({ ...a, op: `o-${i + 31}` }))] });
    expect(doubled.success).toBe(false);
    expect(JSON.stringify(doubled)).not.toContain("65536");
    // the byte rule itself, on a doc built past the cap (what CUS-C's larger fields can reach)
    const huge = { ...big, added: Array.from({ length: 300 }, (_, i) => ({ op: `o-${i + 1}`, day: 1, ref: `place/${"x".repeat(194)}`, after: "y".repeat(120) })) };
    expect(JSON.stringify(huge).length).toBeGreaterThan(TRIP_CUSTOM_MAX_BYTES);
    expect(tripCustomRules(huge)).toEqual([`$: at most ${TRIP_CUSTOM_MAX_BYTES} bytes`]);
    expect(tripCustomRules(big)).toEqual([]);
  });

  it("reports a newer doc as newer and never coerces it", () => {
    expect(readTripCustom({ ...DOC, schema: "trip-custom/2", extra: 1 })).toMatchObject({ ok: false, reason: "newer" });
    expect(readTripCustom({ ...DOC, schema: "trip-custom/0" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(readTripCustom(DOC)).toEqual({ ok: true, doc: DOC });
  });

  it("issues name a path, never a value, a record key or an unknown key (review L4)", () => {
    const r = readTripCustom({ ...DOC, travellers: { adults: 2, children: [99] } });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("99");
    const k = readTripCustom({ ...DOC, overrides: { "Secret Day": "A" }, secretKey: 1 });
    expect(k.ok).toBe(false);
    expect(JSON.stringify(k)).not.toMatch(/secret/i);
  });

  it("the whole doc in a public payload fails the privacy detector, field by field", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    expect(privacyHits({ trip: DOC }).map((h) => h.where).sort()).toEqual(["$.trip.added", "$.trip.fromRef", "$.trip.gw", "$.trip.travellers"]);
    expect(whys({ fromRef: "iata:BOM" })).toEqual(["a private key"]);
    expect(whys({ travellers: { adults: 2, children: [] } })).toEqual(["a private key"]);
    expect(whys({ gw: { in: "YEG", out: "YYC" } })).toEqual(["a private key"]);
    expect(whys({ from: "iata:BOM" })).toEqual(["a visitor's origin"]);
  });
});
