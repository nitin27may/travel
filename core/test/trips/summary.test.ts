import { describe, expect, it } from "vitest";
import { MAX_HIGHLIGHTS, nameCores, parkKind, parkShort, summaryLead, tripSummary, versionsText, type SummaryInput } from "../../src/trips/summary.ts";

const des = (type: string, name: string) => ({ type, name });
const WHS = des("unesco_whs", "Canadian Rocky Mountain Parks");
const input: SummaryInput = {
  depth: "full", nights: 3, days: 4, countries: ["Canada"],
  bases: [{ name: "Banff", nights: 2 }, { name: "Jasper", nights: 1 }],
  visited: [
    { slug: "a", region: "Alberta", designations: [des("national_park", "Banff National Park"), WHS, des("official_highlight", "top 10")] },
    { slug: "b", region: "Alberta", designations: [des("national_park", "Banff National Park"), WHS] },
    { slug: "c", region: "British Columbia", designations: [des("national_park", "Yoho National Park"), WHS] },
    { slug: "d", region: "British Columbia", designations: [des("provincial_or_state_park", "Mount Robson Provincial Park"), WHS, des("dark_sky", "x")] },
    { slug: "e", region: null, designations: [] },
  ],
  trails: [{ distanceKm: 10.2, gainM: 580 }, { distanceKm: 1.9, gainM: null }, { distanceKm: null, gainM: 0 }],
  sights: 5, activities: 2, food: 0,
  bookings: [
    { name: "Car", rule: null, day: 1, opensBeforeDay1: null },
    { name: "Slot", rule: "Opens 30 days before Day 3", day: 3, opensBeforeDay1: 32 },
    { name: "Lift", rule: "Opens 60 days ahead", day: 2, opensBeforeDay1: 61 },
  ],
  highlights: [
    { slug: "takakkaw-falls-walk", name: "Takakkaw Falls Walk", days: [9], payoffSlug: "takakkaw-falls", placePhoto: false },
    { slug: "takakkaw-falls", name: "Takakkaw Falls", days: [9], payoffSlug: null, placePhoto: false },
    { slug: "peyto-lake-lookout", name: "Peyto Lake Lookout", days: [4], payoffSlug: null, placePhoto: false },
    { slug: "peyto-lake-lookout-banff", name: "Peyto Lake Lookout", days: [8], payoffSlug: null, placePhoto: false },
    { slug: "lake-louise", name: "Lake Louise", days: [10, 3], payoffSlug: null, placePhoto: false },
    { slug: "moraine-lake", name: "Moraine Lake", days: [11], payoffSlug: null, placePhoto: true },
  ],
  gallery: { photos: 6, sections: [{ name: "Moraine Lake and the Valley of the Ten Peaks", first: 0 }, { name: "Lake Louise and Lake Agnes", first: 3 }] },
  versions: [{ audience: "family", days: 14 }, { audience: "adults", days: 1 }],
};

describe("trip summary (spec 3.5, W2)", () => {
  const s = tripSummary(input);
  it("names regions and parks only from visited places, in order of first appearance", () => {
    expect(s.regions).toEqual([{ name: "Alberta", places: 2 }, { name: "British Columbia", places: 2 }]);
    expect(s.parks).toEqual([
      { name: "Banff National Park", kind: "national", places: 2 },
      { name: "Yoho National Park", kind: "national", places: 1 },
      { name: "Mount Robson Provincial Park", kind: "provincial", places: 1 },
    ]);
    expect(s.heritage).toEqual([{ name: "Canadian Rocky Mountain Parks", places: 4, all: true }]);
  });
  it("counts with coverage: km and climb say how many trails they cover", () => {
    expect(s.counts.trails).toEqual({ count: 3, km: 12.1, kmKnown: 2, gainM: 580, gainKnown: 2 });
    expect(s.counts.bases).toBe(2);
    expect(s.counts.stays).toBe(2);
    expect(s.counts.bookings).toEqual({ count: 3, dated: 2, earliest: { name: "Lift", rule: "Opens 60 days ahead", day: 2 } });
  });
  it("folds a route into its payoff and two pages of one name into one card, with photo refs, in the gallery's own order (UXB-1F S2: Moraine Lake is the first section)", () => {
    expect(s.highlights).toEqual([
      { slug: "moraine-lake", days: [11], photo: "place" },
      { slug: "lake-louise", days: [3, 10], photo: 3 },
      { slug: "peyto-lake-lookout", days: [4, 8], photo: null },
      { slug: "takakkaw-falls", days: [9], photo: null },
    ]);
    expect(s.counts.highlights).toBe(4);
  });
  it("writes the lead line from the model only", () => {
    expect(summaryLead(s)).toBe("4 days through Alberta and British Columbia, in two national parks (Banff, Yoho) and one provincial park (Mount Robson), all in the Canadian Rocky Mountain Parks World Heritage Site");
    const partly = tripSummary({ ...input, visited: [...input.visited, { slug: "f", region: "Alberta", designations: [des("provincial_or_state_park", "Peter Lougheed Provincial Park")] }] });
    expect(summaryLead(partly)).toMatch(/two provincial parks \(Mount Robson, Peter Lougheed\), with four stops in the Canadian Rocky Mountain Parks World Heritage Site$/);
    const dolo = tripSummary({ ...input, visited: [{ slug: "x", region: "South Tyrol", designations: [des("unesco_whs", "The Dolomites"), des("provincial_or_state_park", "Puez-Odle Nature Park")] }] });
    expect(summaryLead(dolo)).toBe("4 days through South Tyrol, in one nature park (Puez-Odle), all in the Dolomites World Heritage Site");
  });
  it("degrades for an overview trip: no regions, counts, shape or bookings; gallery sections as highlights without days", () => {
    const o = tripSummary({ ...input, depth: "overview", days: 0, nights: 10, countries: ["Costa Rica"], trails: [], sights: 0, activities: 0, bookings: [] });
    expect(o.flags).toEqual({ days: false, regions: false, parks: false, counts: false, bookings: false, highlights: true, photos: true, shape: false });
    expect(o.regions).toEqual([]);
    expect(o.parks).toEqual([]);
    expect(o.highlights).toEqual([
      { slug: null, name: "Moraine Lake and the Valley of the Ten Peaks", days: [], photo: 0 },
      { slug: null, name: "Lake Louise and Lake Agnes", days: [], photo: 3 },
    ]);
    expect(o.versions).toEqual([]);
    expect(summaryLead(o)).toBe("10 nights in Costa Rica. This plan has not been converted to days yet.");
    expect(summaryLead(tripSummary({ ...input, depth: "overview", days: 0, nights: 0, countries: ["Canada"] }))).toBe("A day trip in Canada. This plan has not been converted to days yet.");
    expect(summaryLead(tripSummary({ ...input, depth: "overview", days: 0, nights: 1, countries: ["United States"] }))).toBe("1 night in the United States. This plan has not been converted to days yet.");
  });
  it("says who it suits by the audience of each day's version", () => {
    expect(versionsText(s.versions)).toBe("whole family on 14 days, adults' hike on 1");
    expect(versionsText([{ audience: "any", days: 12 }, { audience: "adults", days: 2 }])).toBe("everyone on 12 days, adults' hike on 2");
    expect(versionsText([{ audience: "any", days: 11 }])).toBe("");
  });
  it("caps the highlights at 13", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ slug: `p${i}`, name: `Place ${i}`, days: [i + 1], payoffSlug: null, placePhoto: false }));
    expect(tripSummary({ ...input, highlights: many }).highlights).toHaveLength(MAX_HIGHLIGHTS);
  });
  it("knows the park kinds by designation and name", () => {
    expect(parkKind("provincial_or_state_park", "Dead Horse Point State Park")).toBe("state");
    expect(parkKind("provincial_or_state_park", "Natural Park of the Ampezzo Dolomites")).toBe("nature");
    expect(parkKind("provincial_or_state_park", "Bow Valley Wildland")).toBe("regional");
    expect(parkKind("official_highlight", "top 10")).toBeNull();
    expect(parkShort("Natural Park of the Ampezzo Dolomites")).toBe("Ampezzo Dolomites");
    expect(parkShort("Fanes-Sennes-Prags Nature Park")).toBe("Fanes-Sennes-Prags");
  });
});

describe("highlight photos match on the place's core (UXB-1F S1, S2)", () => {
  const items = [
    { caption: "Moraine Lake, turquoise water", group: "Moraine Lake and the Valley of the Ten Peaks" },
    { caption: "Victoria Glacier above Lake Louise", group: "Lake Louise and Lake Agnes" },
    { caption: "Peyto Lake in summer", group: "Icefields Parkway: Bow Lake and Peyto Lake" },
    { caption: "Peyto Lake from the viewpoint", group: "Icefields Parkway: Bow Lake and Peyto Lake" },
    { caption: "Num-Ti-Jah Lodge at Bow Lake", group: "Icefields Parkway: Bow Lake and Peyto Lake" },
    { caption: "The Athabasca Glacier from the valley floor", group: "Columbia Icefield and the Athabasca Glacier" },
    { caption: "Spirit Island on Maligne Lake", group: "Jasper, Maligne Lake and Maligne Canyon" },
    { caption: "The Tre Cime from Monte Specie", group: "Tre Cime di Lavaredo" },
  ];
  const gallery = {
    photos: items.length,
    sections: [
      { name: "Moraine Lake and the Valley of the Ten Peaks", first: 0 },
      { name: "Lake Louise and Lake Agnes", first: 1 },
      { name: "Icefields Parkway: Bow Lake and Peyto Lake", first: 2 },
      { name: "Columbia Icefield and the Athabasca Glacier", first: 5 },
      { name: "Jasper, Maligne Lake and Maligne Canyon", first: 6 },
      { name: "Tre Cime di Lavaredo", first: 7 },
    ],
    items,
  };
  const c = (slug: string, name: string, day: number, placePhoto = false) => ({ slug, name, days: [day], payoffSlug: null, placePhoto });
  const hl = (cands: ReturnType<typeof c>[]) => tripSummary({ ...input, highlights: cands, gallery }).highlights;

  it("nameCores drops the tail word, a parenthesis and splits at 'and'", () => {
    expect(nameCores("Peyto Lake Lookout")).toEqual(["peyto lake"]);
    expect(nameCores("Athabasca Glacier and Columbia Icefield")).toEqual(["athabasca glacier", "columbia icefield"]);
    expect(nameCores("Tre Cime loop")).toEqual(["tre cime"]);
    expect(nameCores("Maligne Lake and Spirit Island (boat)")).toEqual(["maligne lake", "spirit island"]);
  });
  it("finds a photo by caption where the section does not name the whole place", () => {
    const r = hl([c("peyto", "Peyto Lake Lookout", 4), c("ath", "Athabasca Glacier and Columbia Icefield", 5), c("mal", "Maligne Lake and Spirit Island", 6), c("tc", "Tre Cime loop", 3)]);
    expect(Object.fromEntries(r.map((h) => [h.slug, h.photo]))).toEqual({ peyto: 2, ath: 5, mal: 6, tc: 7 });
  });
  it("a place named only by its section takes a photo of that section, and two places do not share one photo", () => {
    const r = hl([c("peyto", "Peyto Lake Lookout", 4), c("ice", "Icefields Parkway", 4)]);
    const photos = r.map((h) => h.photo);
    expect(photos).toContain(2);
    expect(new Set(photos).size).toBe(2);
    for (const p of photos) expect([2, 3, 4]).toContain(p);
  });
  it("ranks by the gallery's own order and draws in that order, not day order; a place with no photo comes last", () => {
    const r = hl([c("ice", "Icefields Parkway", 4), c("none", "Nowhere Fall", 1), c("moraine", "Moraine Lake", 11, true), c("louise", "Lake Louise", 3)]);
    expect(r.map((h) => h.slug)).toEqual(["moraine", "louise", "ice", "none"]);
    expect(r[0]!.photo).toBe("place");
    expect(r[3]!.photo).toBeNull();
  });
  it("without per-photo captions it still matches whole section names (older callers)", () => {
    const r = tripSummary({ ...input, highlights: [c("l", "Lake Louise", 3)], gallery: { ...gallery, items: undefined } }).highlights;
    expect(r[0]!.photo).toBe(1);
  });
});
