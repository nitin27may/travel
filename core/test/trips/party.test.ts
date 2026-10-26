import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHILD_AGE, adultsText, childrenText, cleanParty, copyChildren, hasPartyKeys, landingFor, partyLine, partyOfProfile, partyShortText, partyText,
  profileForParty, sameParty, youngestOf, type Party,
} from "../../src/trips/party.ts";
import { parseTimelineUrl, serialiseTimelineUrl } from "../../src/schedule/profileCodec.ts";
import { DEFAULT_PROFILE, type Profile } from "../../src/schedule/types.ts";
import { travellers } from "../../src/schema/trip-custom.ts";

const ROCKIES: Profile = { party: "family", youngest: 10, pace: "standard", adults: 2, walkKm: null, split: false };

describe("the party in words (spec 5.2, W3)", () => {
  it("says adults and children with each age, in the order entered", () => {
    expect(adultsText(1)).toBe("1 adult");
    expect(partyText({ adults: 2, children: [] })).toBe("2 adults");
    expect(partyText({ adults: 2, children: [7] })).toBe("2 adults · 1 child (7)");
    expect(partyText({ adults: 2, children: [7, 10] })).toBe("2 adults · 2 children (7, 10)");
    expect(partyText({ adults: 1, children: [12, 4, 7] })).toBe("1 adult · 3 children (12, 4, 7)");
    expect(childrenText([null])).toBe("1 child (age not set)");
    expect(childrenText([7, null])).toBe("2 children (7, age not set)");
    expect(childrenText([])).toBe("");
  });
  it("has the bar's line with the pace, long and short", () => {
    expect(partyLine({ adults: 2, children: [10] }, "standard")).toBe("2 adults · 1 child (10) · Standard pace");
    expect(partyLine({ adults: 2, children: [7, 10] }, "standard", true)).toBe("2 adults · 2 children (7, 10) · Standard");
    expect(partyLine({ adults: 3, children: [] }, "relaxed", true)).toBe("3 adults · Relaxed");
  });
  it("has the short form for the day rail and the offer, without ages", () => {
    expect(partyShortText({ adults: 2, children: [7, 10] })).toBe("2 adults, 2 children");
    expect(partyShortText({ adults: 1, children: [3] })).toBe("1 adult, 1 child");
    expect(partyShortText({ adults: 2, children: [] })).toBe("2 adults");
  });
});

describe("the party model (D6, FAMAGE10)", () => {
  it("cleans to adults 1..12, at most 8 children, ages 0..17 or null", () => {
    expect(cleanParty({ adults: 0, children: [] })).toEqual({ adults: 1, children: [] });
    expect(cleanParty({ adults: 40, children: [-3, 25, 7.5, "x", null, 9] })).toEqual({ adults: 12, children: [0, 17, null, null, null, 9] });
    expect(cleanParty({ adults: 2, children: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })!.children).toHaveLength(8);
    expect(cleanParty({ adults: "2" })).toBeNull();
    expect(cleanParty(null)).toBeNull();
    expect(cleanParty([])).toBeNull();
  });
  it("plans an unset age as 10 and takes the lowest age as the youngest", () => {
    expect(DEFAULT_CHILD_AGE).toBe(10);
    expect(youngestOf({ adults: 2, children: [] })).toBeNull();
    expect(youngestOf({ adults: 2, children: [null] })).toBe(10);
    expect(youngestOf({ adults: 2, children: [12, null] })).toBe(10);
    expect(youngestOf({ adults: 2, children: [7, 10] })).toBe(7);
    expect(copyChildren({ adults: 2, children: [7, null] })).toEqual([7, 10]);
  });
  it("children 0 means adults only; the profile keeps its pace, walk and split", () => {
    const base: Profile = { ...ROCKIES, pace: "relaxed", walkKm: 8, split: true };
    expect(profileForParty({ adults: 3, children: [] }, base)).toEqual({ ...base, party: "adults", youngest: null, adults: 3 });
    expect(profileForParty({ adults: 1, children: [12, 6] }, base)).toEqual({ ...base, party: "family", youngest: 6, adults: 1 });
  });
  it("fits the unchanged copies/1 and trip-custom/1 travellers shape", () => {
    const p: Party = { adults: 4, children: [7, null, 15] };
    expect(travellers.safeParse({ adults: p.adults, children: copyChildren(p) }).success).toBe(true);
  });
  it("tells two parties apart by every age", () => {
    expect(sameParty({ adults: 2, children: [7, 10] }, { adults: 2, children: [7, 10] })).toBe(true);
    expect(sameParty({ adults: 2, children: [7, 10] }, { adults: 2, children: [10, 7] })).toBe(false);
    expect(sameParty({ adults: 2, children: [null] }, { adults: 2, children: [10] })).toBe(false);
  });
});

describe("links carry the youngest and the adult count, never the ages (Q296)", () => {
  it("writes p=family-<youngest> and a=<n> through the codec, and nothing else of the party", () => {
    const party: Party = { adults: 3, children: [13, 7, 11] };
    const q = serialiseTimelineUrl({ profile: profileForParty(party, ROCKIES), overrides: {}, added: [] }, ROCKIES);
    expect(q).toBe("p=family-7&a=3");
    expect(q).not.toMatch(/13|11/);
    expect(serialiseTimelineUrl({ profile: profileForParty({ adults: 2, children: [] }, ROCKIES), overrides: {}, added: [] }, ROCKIES)).toBe("p=adults");
    expect(serialiseTimelineUrl({ profile: profileForParty({ adults: 2, children: [null] }, ROCKIES), overrides: {}, added: [] }, ROCKIES)).toBe("");
  });
  it("reads back what a shared plan is for", () => {
    expect(partyOfProfile(parseTimelineUrl("p=family-6&a=4", ROCKIES).profile)).toEqual({ adults: 4, youngest: 6 });
    expect(partyOfProfile(parseTimelineUrl("p=adults", ROCKIES).profile)).toEqual({ adults: 2, youngest: null });
  });
});

describe("the landing rule (Q295)", () => {
  const device: Party = { adults: 2, children: [7, 10] };
  it("knows which keys are the party's", () => {
    expect(hasPartyKeys("p=family-6")).toBe(true);
    expect(hasPartyKeys("?a=1")).toBe(true);
    expect(hasPartyKeys("pace=relaxed&d=5C&view=day")).toBe(false);
    expect(hasPartyKeys(new URLSearchParams(""))).toBe(false);
  });
  it("applies the kept party when the link has none", () => {
    const l = landingFor({ query: "pace=relaxed&view=day", device, defaults: ROCKIES, urlProfile: { ...ROCKIES, pace: "relaxed" } });
    expect(l).toEqual({ mode: "device", apply: { party: "family", youngest: 7, adults: 2 }, offer: null });
  });
  it("plans as written with no party kept, or after 'Plan as written' on this trip", () => {
    expect(landingFor({ query: "", device: null, defaults: ROCKIES, urlProfile: ROCKIES }).mode).toBe("written");
    expect(landingFor({ query: "", device, defaults: ROCKIES, urlProfile: ROCKIES, asWritten: true })).toEqual({ mode: "written", apply: null, offer: null });
  });
  it("lets a shared link win and offers the kept party only when it differs", () => {
    const shared = parseTimelineUrl("p=family-6", ROCKIES).profile;
    expect(landingFor({ query: "p=family-6", device, defaults: ROCKIES, urlProfile: shared })).toEqual({ mode: "shared", apply: null, offer: device });
    const same = parseTimelineUrl("p=family-7", ROCKIES).profile;
    expect(landingFor({ query: "p=family-7", device, defaults: ROCKIES, urlProfile: same }).offer).toBeNull();
    expect(landingFor({ query: "a=1", device: null, defaults: DEFAULT_PROFILE, urlProfile: { ...DEFAULT_PROFILE, adults: 1 } })).toEqual({ mode: "shared", apply: null, offer: null });
  });
});
