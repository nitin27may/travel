import { describe, expect, it } from "vitest";
import { isChanged, parseTimelineUrl, serialiseTimelineUrl } from "../../src/schedule/profileCodec.ts";
import { DEFAULT_PROFILE, type Profile } from "../../src/schedule/types.ts";

const ROCKIES: Profile = { party: "family", youngest: 6, pace: "standard", adults: 2, walkKm: null, split: false };

describe("profileCodec (spec 3.8)", () => {
  it("round-trips every key", () => {
    const state = {
      profile: { party: "family", youngest: 4, pace: "relaxed", adults: 1, walkKm: 8, split: true } as Profile,
      overrides: { 5: "C", 9: "A" },
      added: [{ day: 5, slug: "moraine-lake" }, { day: 5, slug: "lake-agnes-teahouse" }],
    };
    const q = serialiseTimelineUrl(state, ROCKIES);
    expect(q).toBe("p=family-4&pace=relaxed&a=1&walk=8&split=1&d=5C,9A&add=5.moraine-lake,5.lake-agnes-teahouse");
    expect(parseTimelineUrl(q, ROCKIES)).toEqual(state);
  });
  it("omits defaults and writes keys in the fixed order p, pace, a, walk, split, d, add", () => {
    expect(serialiseTimelineUrl({ profile: ROCKIES, overrides: {}, added: [] }, ROCKIES)).toBe("");
    const q = serialiseTimelineUrl({ profile: { ...ROCKIES, pace: "full" }, overrides: { 5: "C" }, added: [{ day: 5, slug: "pyramid-lake" }] }, ROCKIES);
    expect(q).toBe("pace=full&d=5C&add=5.pyramid-lake");
    expect(q.split("&").map((p) => p.split("=")[0])).toEqual(["pace", "d", "add"]);
  });
  it("reads adults and a family age", () => {
    expect(parseTimelineUrl("p=adults", ROCKIES).profile).toMatchObject({ party: "adults", youngest: null });
    expect(parseTimelineUrl("p=family-14", ROCKIES).profile).toMatchObject({ party: "family", youngest: 14 });
    expect(serialiseTimelineUrl({ profile: { ...ROCKIES, party: "adults", youngest: null }, overrides: {}, added: [] }, ROCKIES)).toBe("p=adults");
  });
  it("falls back to the defaults on garbage, without throwing", () => {
    const s = parseTimelineUrl("p=family-99&pace=turbo&a=7&walk=abc&split=yes&d=xx,5Z,,&add=%%,5.Bad Slug,,", ROCKIES);
    expect(s.profile).toEqual(ROCKIES);
    expect(s.overrides).toEqual({});
    expect(s.added).toEqual([]);
    expect(parseTimelineUrl("", DEFAULT_PROFILE).profile).toEqual(DEFAULT_PROFILE);
    expect(parseTimelineUrl("p=family-18", ROCKIES).profile.youngest).toBe(6);
  });
  it("accepts URLSearchParams and ignores keys it does not own", () => {
    expect(parseTimelineUrl(new URLSearchParams("view=category&pace=full"), ROCKIES).profile.pace).toBe("full");
  });
  it("tells when anything differs from the defaults (the Reset link)", () => {
    expect(isChanged({ profile: ROCKIES, overrides: {}, added: [] }, ROCKIES)).toBe(false);
    expect(isChanged({ profile: ROCKIES, overrides: { 2: "C" }, added: [] }, ROCKIES)).toBe(true);
  });
});
