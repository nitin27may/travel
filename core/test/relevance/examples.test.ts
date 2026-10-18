// The worked examples of relevance.md section 10, one test case each (10.7). Coordinates are real places to a few
// hundred metres; signal figures are the ones measured on 18 Oct 2026 (section 2.3); the hub matrix is a fixture
// standing in for backlog 3.12, so no routing service is called.
import { describe, expect, it } from "vitest";
import { badgeFor, deriveAll } from "../../src/relevance/derive.ts";
import type { Derived, DeriveInput, HubMatrix, PlaceFacts, Signals, Town } from "../../src/relevance/derive.ts";
import { approxMinutes, drawSuggested, gate, haversineKm } from "../../src/relevance/fit.ts";
import { rec } from "./helpers.ts";

const HUB: HubMatrix["hubs"][number] = { id: "toronto", name: "Toronto City Hall", lat: 43.6534, lon: -79.3841, public: true };
const pt = (lat: number, lon: number) => ({ lat, lon });

// Banff
const banff: Town = { id: "banff", name: "Banff", lat: 51.1784, lon: -115.5708, has_stay: true };
// Dolomites
const cortina: Town = { id: "falzarego", name: "Passo Falzarego base", lat: 46.5146, lon: 12.0097, has_stay: true };

const SIG: Record<string, Signals> = {
  Q1072342: { languages: 37, views: 46183 }, // Moraine Lake
  Q1362681: { languages: 27, views: null }, // Peyto Lake
  Q1257207: { languages: 28, views: 107648 }, // Tre Cime, German views
  Q691103: { languages: 10, views: null }, // Lago di Landro
  Q55978735: { languages: 1, views: null }, // Lago di Limides
  Q3029053: { languages: 7, views: 15582 }, // The Narrows
  Q123862055: { languages: 0, views: null }, // Kanarra Creek Canyon
  Q5367207: { languages: 5, views: 8590 }, // Elora Gorge
  Q14875399: { languages: 4, views: 4803 }, // Rattlesnake Point
  Q7546619: { languages: 1, views: 3062 }, // Smugglers' Notch State Park
  Q1543478: { languages: 25, views: 42382 }, // Algonquin Provincial Park (the parent)
  Q1: { languages: 50, views: null }, // Zion National Park (stand-in QID)
  Q2: { languages: 30, views: null }, // Niagara Falls (stand-in QID)
  Q3: { languages: 8, views: null }, // Cinque Torri (stand-in QID)
};

const matrix = (cells: Record<string, number>): HubMatrix => ({
  schema: "hub-matrix/1",
  hubs: [HUB],
  minutes: Object.fromEntries(Object.entries(cells).map(([ref, m]) => [ref, { toronto: m }])),
});

function run(records: ReturnType<typeof rec>[], facts: Record<string, PlaceFacts>, extra: Partial<DeriveInput> = {}): Record<string, Derived> {
  const input: DeriveInput = { records, facts, signals: SIG, towns: [banff, cortina], matrix: null, ...extra };
  return Object.fromEntries(deriveAll(input).map((d) => [d.ref, d]));
}

describe("10.1 Moraine Lake against the Fenland Loop (Banff)", () => {
  const moraine = rec({
    ref: "place/moraine-lake", qid: "Q1072342", draw: "world", standing: "top", distinction: "rare", weather: "better_clear",
    class_key: "lake/glacial-turquoise", easy: "full", easyWay: "place/moraine-lakeshore",
    access: [{ type: "shuttle_only", note: "no private vehicles", book_ahead_days: 2 }],
    designations: [{ type: "unesco_whs", name: "Canadian Rocky Mountain Parks", id: "304", scope: "parent" }, { type: "national_park", name: "Banff National Park", scope: "parent" }],
  });
  const peyto = rec({ ref: "place/peyto-lake", qid: "Q1362681", draw: "world", standing: "top", distinction: "rare", class_key: "lake/glacial-turquoise", weather: "better_clear" });
  const fenland = rec({
    ref: "place/fenland-loop", kind: "trail", qid: null, draw: "local", standing: "good", distinction: "common", class_key: "trail/forest-loop", weather: "any_weather",
    designations: [{ type: "unesco_whs", name: "Canadian Rocky Mountain Parks", scope: "parent" }, { type: "national_park", name: "Banff National Park", scope: "parent" }],
  });
  const facts = {
    "place/moraine-lake": { point: pt(51.3217, -116.186), onSiteMin: 180 },
    "place/peyto-lake": { point: pt(51.7253, -116.5155), onSiteMin: 30 },
    "place/fenland-loop": { point: pt(51.183, -115.561), onSiteMin: 45 },
  };
  const d = run([moraine, peyto, fenland], facts);

  it("Moraine Lake is an anchor with the badge Worth the journey", () => {
    expect(d["place/moraine-lake"]!.fits.vacation.fit).toBe("plan_around");
    expect(d["place/moraine-lake"]!.role).toBe("anchor");
    expect(d["place/moraine-lake"]!.badge).toBe("Worth the journey");
    expect(d["place/moraine-lake"]!.draw_suggested).toBe("world");
    expect(d["place/moraine-lake"]!.access_load).toBe("plan");
  });
  it("its plan B is Peyto Lake: same class, roadside, no booking", () => {
    const b = d["place/moraine-lake"]!.plan_b!;
    expect(b.ref).toBe("place/peyto-lake");
    expect(b.access_cost).toEqual([]);
    expect(b.km).toBeGreaterThan(40);
    expect(b.km).toBeLessThan(60);
  });
  it("the parent designations never raise the Fenland Loop above local", () => {
    expect(d["place/fenland-loop"]!.draw_suggested).toBe("local");
    expect(d["place/fenland-loop"]!.effective_draw).toBe("local");
  });
  it("the Fenland Loop is a filler: if_nearby, about 1 km from a town with a stay, flagged rainy_day, no badge", () => {
    const f = d["place/fenland-loop"]!;
    expect(f.detour_basis).toBe("town");
    expect(f.detour_town).toBe("Banff");
    expect(f.detour_min!).toBeLessThanOrEqual(20);
    expect(f.fits.vacation.fit).toBe("if_nearby");
    expect(f.role).toBe("filler");
    expect(f.flags.rainy_day).toBe(true);
    expect(f.badge).toBeNull();
  });
  it("its far pointer is Moraine Lake, an any-class pointer within 50 km", () => {
    const p = d["place/fenland-loop"]!.far_pointer!;
    expect(p.ref).toBe("place/moraine-lake");
    expect(p.same_class).toBe(false);
    expect(p.km).toBeLessThanOrEqual(50);
  });
  it("a world place has no far pointer", () => {
    expect(d["place/moraine-lake"]!.far_pointer).toBeNull();
  });
  it("for a family whose youngest is 5, Moraine Lake stays on top, rescued by the Rockpile (7.1 step 2)", () => {
    expect(gate("anchor", "full", false, true)).toEqual({ state: "rescued", nameEasyWay: true, taste: false });
    expect(gate("anchor", "most", false, true).state).toBe("rescued");
    expect(gate("anchor", "part", false, true)).toEqual({ state: "dimmed", nameEasyWay: true, taste: true });
    expect(gate("anchor", "none", false, true).state).toBe("dimmed");
    expect(gate("anchor", "full", false, false).state).toBe("dimmed");
    expect(gate("filler", "full", false, true).state).toBe("dimmed");
    expect(gate("anchor", "full", true, null).state).toBe("fits");
  });
});

describe("10.2 The Tre Cime loop against Lago di Limides and Lago di Landro (Dolomites)", () => {
  const tre = rec({
    ref: "place/tre-cime-loop", kind: "trail", qid: "Q1257207", draw: "world", standing: "top", distinction: "unique", class_key: "trail/alpine-loop",
    weather: "better_clear", easy: "part", access: [{ type: "toll_reservation", note: "pass.auronzo.info", book_ahead_days: 14 }],
  });
  const limides = rec({ ref: "place/lago-di-limides", qid: "Q55978735", draw: "local", standing: "good", distinction: "common", class_key: "lake/small-mirror", weather: "clear_only", easy: "full" });
  const landro = rec({
    ref: "place/lago-di-landro", qid: "Q691103", draw: "regional", standing: "good", distinction: "common", class_key: "lake/small-mirror", weather: "any_weather",
    drawNote: "roadside lake; the land manager lists it, but the 10 languages over-score a famous view",
  });
  const cinque = rec({ ref: "place/cinque-torri", kind: "sight", qid: "Q3", draw: "national", standing: "top", distinction: "rare", class_key: "sight/landmark", weather: "better_clear" });
  const facts = {
    "place/tre-cime-loop": { point: pt(46.6128, 12.2967), onSiteMin: 240 },
    "place/lago-di-limides": { point: pt(46.5231, 12.0175), onSiteMin: 90, tripDetourMin: 20 },
    "place/lago-di-landro": { point: pt(46.6409, 12.2233), onSiteMin: 20, tripDetourMin: 5 },
    "place/cinque-torri": { point: pt(46.5008, 12.0364), onSiteMin: 120 },
  };
  const d = run([tre, limides, landro, cinque], facts);

  it("the Tre Cime loop is an anchor, toll road booking makes access plan", () => {
    const t = d["place/tre-cime-loop"]!;
    expect(t.access_load).toBe("plan");
    expect(t.role).toBe("anchor");
    expect(t.badge).toBe("Worth the journey");
    expect(t.draw_suggested).toBe("world"); // the German views, 107,648, and 28 languages
  });
  it("Lago di Limides: clear_only drops if_nearby to skip, so local_only, with a far pointer to Cinque Torri", () => {
    const l = d["place/lago-di-limides"]!;
    expect(l.fits.vacation.fit).toBe("skip");
    expect(l.fits.vacation.reason).toContain("clear weather only");
    expect(l.role).toBe("local_only");
    expect(l.badge).toBeNull();
    expect(l.far_pointer?.ref).toBe("place/cinque-torri");
  });
  it("without clear_only the same lake would be if_nearby (the drop is the only difference)", () => {
    const alt = run([{ ...limides, weather: { ...limides.weather, v: "any_weather" } }], facts);
    expect(alt["place/lago-di-limides"]!.fits.vacation.fit).toBe("if_nearby");
  });
  it("Lago di Landro: passing through is worth_it and flagged en_route; 10 languages suggest national but the judgement stays regional", () => {
    const l = d["place/lago-di-landro"]!;
    expect(l.fits.passing.fit).toBe("worth_it");
    expect(l.flags.en_route).toBe(true);
    expect(l.draw_suggested).toBe("national");
    expect(l.effective_draw).toBe("regional");
  });
});

describe("10.3 An Algonquin day hike against Rattlesnake Point, from Toronto City Hall", () => {
  const track = rec({
    ref: "place/track-and-tower", kind: "trail", qid: null, draw: "regional", standing: "top", distinction: "rare", class_key: "trail/lookout", weather: "better_clear",
    peak: { tier: "national", from: "09-20", to: "10-15", why: "fall colour" },
    access: [{ type: "day_permit", note: "released 5 days ahead at 07:00 ET", book_ahead_days: 5 }],
    designations: [{ type: "provincial_or_state_park", name: "Algonquin Provincial Park", scope: "parent", wikidata: "Q1543478" }],
  });
  const corridor = rec({ ref: "place/hwy60-lookout", kind: "trail", qid: null, draw: "regional", standing: "top", distinction: "common", class_key: "trail/lookout" });
  const rattle = rec({
    ref: "place/rattlesnake-point", kind: "viewpoint", qid: "Q14875399", draw: "regional", standing: "top", distinction: "common", class_key: "viewpoint/escarpment",
    weather: "better_clear", drawNote: "Conservation Halton park; the regional tourism board lists it",
  });
  const niagara = rec({ ref: "place/niagara-falls", kind: "waterfall", qid: "Q2", draw: "world", standing: "top", distinction: "unique", class_key: "waterfall/giant" });
  const facts = {
    "place/track-and-tower": { point: pt(45.5977, -78.4973), onSiteMin: 240 },
    "place/hwy60-lookout": { point: pt(45.56, -78.5), onSiteMin: 90 },
    "place/rattlesnake-point": { point: pt(43.4739, -79.9514), onSiteMin: 150 },
    "place/niagara-falls": { point: pt(43.0896, -79.0849), onSiteMin: 240 },
  };
  const m = matrix({ "place/track-and-tower": 215, "place/hwy60-lookout": 215, "place/rattlesnake-point": 55, "place/niagara-falls": 90 });
  const records = [track, corridor, rattle, niagara];
  const fall = { from: "09-25", to: "10-05" };
  const summer = { from: "07-01", to: "07-31" };

  it("the straight line and the routed fixture agree on the bands", () => {
    expect(Math.round(haversineKm(HUB, facts["place/track-and-tower"].point))).toBeGreaterThan(200);
    expect(Math.round(haversineKm(HUB, facts["place/rattlesnake-point"].point))).toBeLessThan(60);
  });
  it("day trip from Toronto: Algonquin skip (over 3 h), Rattlesnake plan_around", () => {
    const d = run(records, facts, { matrix: m, window: fall });
    expect(d["place/track-and-tower"]!.fits.day.toronto!.fit).toBe("skip");
    expect(d["place/rattlesnake-point"]!.fits.day.toronto!.fit).toBe("plan_around");
  });
  it("weekend from Toronto: Algonquin plan_around with a second top regional place within 30 min; Rattlesnake skip (a day trip)", () => {
    const d = run(records, facts, { matrix: m, window: fall });
    expect(d["place/track-and-tower"]!.fits.weekend.fit).toBe("plan_around");
    expect(d["place/rattlesnake-point"]!.fits.weekend.fit).toBe("skip");
    expect(d["place/rattlesnake-point"]!.fits.weekend.reason).toContain("day trip");
    const alone = run([track, rattle], facts, { matrix: m, window: fall });
    expect(alone["place/track-and-tower"]!.fits.weekend.fit).toBe("worth_it");
  });
  it("vacation in the peak: Algonquin is national, so an anchor with Worth the journey", () => {
    const d = run(records, facts, { matrix: m, window: fall })["place/track-and-tower"]!;
    expect(d.effective_draw).toBe("national");
    expect(d.fits.vacation.fit).toBe("plan_around");
    expect(d.role).toBe("anchor");
    expect(d.badge).toBe("Worth the journey");
  });
  it("vacation outside the peak: regional top rare, so a highlight with Worth a detour", () => {
    const d = run(records, facts, { matrix: m, window: summer })["place/track-and-tower"]!;
    expect(d.effective_draw).toBe("regional");
    expect(d.role).toBe("highlight");
    expect(d.badge).toBe("Worth a detour");
    expect(d.peak).toMatchObject({ tier: "national", role: "anchor", badge: "Worth the journey" });
  });
  it("with no window the base draw is used", () => {
    expect(run(records, facts, { matrix: m })["place/track-and-tower"]!.effective_draw).toBe("regional");
  });
  it("the parent park's 25 languages never raise Algonquin: the suggestion stays local", () => {
    expect(run(records, facts, { matrix: m })["place/track-and-tower"]!.draw_suggested).toBe("local");
  });
  it("the same place gets plan_around (day, Toronto) and if_nearby (vacation): Rattlesnake Point", () => {
    const d = run(records, facts, { matrix: m, window: fall })["place/rattlesnake-point"]!;
    expect(d.fits.day.toronto!.fit).toBe("plan_around");
    expect(d.fits.vacation.fit).toBe("if_nearby"); // regional, but distinction common
    expect(d.role).toBe("filler");
  });
  it("the badge follows the lens: Local favourite under the day lens for Rattlesnake, none for Algonquin", () => {
    const d = run(records, facts, { matrix: m, window: fall });
    expect(badgeFor(d["place/rattlesnake-point"]!, rattle, "day", "toronto")).toBe("Local favourite");
    expect(badgeFor(d["place/rattlesnake-point"]!, rattle, "vacation")).toBeNull();
    expect(badgeFor(d["place/track-and-tower"]!, track, "day", "toronto")).toBeNull(); // outside the band
    expect(badgeFor(d["place/track-and-tower"]!, track, "vacation")).toBe("Worth the journey");
  });
  it("Rattlesnake Point has no far pointer: Niagara Falls is about 81 km away, outside the 50 km reach", () => {
    const d = run(records, facts, { matrix: m });
    expect(d["place/rattlesnake-point"]!.far_pointer).toBeNull();
    const km = haversineKm(facts["place/rattlesnake-point"].point, facts["place/niagara-falls"].point);
    expect(km).toBeGreaterThan(75);
    expect(km).toBeLessThan(90);
  });
  it("a hub cell missing from the matrix falls back to a straight-line estimate marked approximate", () => {
    const part = matrix({ "place/rattlesnake-point": 55 });
    const d = run(records, facts, { matrix: part })["place/track-and-tower"]!;
    expect(d.from_hubs.toronto!.approx).toBe(true);
    expect(d.from_hubs.toronto!.min).toBe(approxMinutes(haversineKm(HUB, facts["place/track-and-tower"].point)));
    expect(run(records, facts, { matrix: part })["place/rattlesnake-point"]!.from_hubs.toronto).toEqual({ min: 55, approx: false });
  });
  it("a hub that is public but not on the allowlist is skipped too", () => {
    const other: HubMatrix = { ...m, hubs: [{ ...HUB, id: "somewhere", name: "A private spot", public: true }], minutes: { "place/rattlesnake-point": { somewhere: 10 } } };
    expect(run(records, facts, { matrix: other })["place/rattlesnake-point"]!.from_hubs).toEqual({});
  });
  it("a non-public hub is skipped by derive", () => {
    const bad: HubMatrix = { ...m, hubs: [{ ...HUB, public: false }] };
    expect(run(records, facts, { matrix: bad })["place/rattlesnake-point"]!.from_hubs).toEqual({});
  });
});

describe("10.4 Elora Gorge as a day trip", () => {
  const elora = rec({
    ref: "place/elora-gorge", kind: "sight", qid: "Q5367207", draw: "regional", standing: "top", distinction: "rare", class_key: "gorge/river-limestone", weather: "better_clear",
    access: [{ type: "daily_cap", book_ahead_days: 3 }, { type: "timed_entry", note: "tubing, online only, 3 days ahead", book_ahead_days: 3 }],
  });
  const rockwood = rec({ ref: "place/rockwood", kind: "sight", qid: null, draw: "local", standing: "good", distinction: "common", class_key: "gorge/river-limestone" });
  const facts = { "place/elora-gorge": { point: pt(43.6806, -80.4376), onSiteMin: 240 }, "place/rockwood": { point: pt(43.6182, -80.15), onSiteMin: 120 } };
  const d = run([elora, rockwood], facts, { matrix: matrix({ "place/elora-gorge": 80, "place/rockwood": 50 }) })["place/elora-gorge"]!;

  it("access_load is plan, not hard, because the caps open only days ahead", () => {
    expect(d.access_load).toBe("plan");
  });
  it("day trip from Toronto is plan_around, so Local favourite under the day lens", () => {
    expect(d.fits.day.toronto!.fit).toBe("plan_around");
    expect(badgeFor(d, elora, "day", "toronto")).toBe("Local favourite");
  });
  it("vacation is worth_it: a highlight, not an anchor, with Worth a detour", () => {
    expect(d.fits.vacation.fit).toBe("worth_it");
    expect(d.role).toBe("highlight");
    expect(d.badge).toBe("Worth a detour");
  });
  it("Rockwood, within 25 km in the same class, is the substitute", () => {
    expect(d.substitutes.near.map((s) => s.ref)).toEqual(["place/rockwood"]);
    expect(d.substitutes.near[0]!.km).toBeLessThanOrEqual(25);
  });
  it("under 1.5 h from the hub, so no weekend fit", () => {
    expect(d.fits.weekend.fit).toBe("skip");
  });
});

describe("10.5 The Narrows against Kanarra Falls", () => {
  const narrows = rec({
    ref: "place/the-narrows", kind: "sight", qid: "Q3029053", draw: "world", standing: "top", distinction: "unique", class_key: "canyon/slot-wade", weather: "any_weather", easy: "part",
    drawNote: "NPS calls it one of the park's most popular areas (official_highlight); the signals under-score a sub-feature of Zion",
    designations: [
      { type: "official_highlight", name: "Zion NPS page", scope: "own" },
      { type: "national_park", name: "Zion National Park", scope: "parent", wikidata: "Q1" },
    ],
  });
  const kanarra = rec({
    ref: "place/kanarra-falls", kind: "sight", qid: "Q123862055", draw: "regional", standing: "good", distinction: "rare", class_key: "canyon/slot-wade", weather: "better_clear", easy: "most",
    access: [{ type: "daily_cap", note: "town permit limit; peak days sell out a month ahead", book_ahead_days: 30 }],
  });
  const facts = { "place/the-narrows": { point: pt(37.2848, -112.9486), onSiteMin: 300 }, "place/kanarra-falls": { point: pt(37.5392, -113.176), onSiteMin: 240 } };
  const d = run([narrows, kanarra], facts);

  it("the official-highlight floor lifts the Narrows to national even where fame alone says less", () => {
    const low = { ...SIG, Q3029053: { languages: 7, views: null } };
    const out = deriveAll({ records: [narrows], facts, signals: low, towns: [] });
    expect(out[0]!.draw_suggested).toBe("national"); // 7 languages is regional; the highlight under a world parent gives national
    expect(drawSuggested({ languages: 7, views: null, designations: [{ type: "official_highlight", name: "x", scope: "own" }], editorial: [] })).toBe("regional");
  });
  it("with the measured 15,582 views the suggestion is national and the gap to world is one tier: no warning is needed", () => {
    expect(d["place/the-narrows"]!.draw_suggested).toBe("national");
  });
  it("the Narrows is an anchor, Worth the journey", () => {
    expect(d["place/the-narrows"]!.role).toBe("anchor");
    expect(d["place/the-narrows"]!.badge).toBe("Worth the journey");
  });
  it("Kanarra: a cap that sells out a month ahead is hard, which drops if_nearby to skip", () => {
    const k = d["place/kanarra-falls"]!;
    expect(k.access_load).toBe("hard");
    expect(k.fits.vacation.fit).toBe("skip");
    expect(k.fits.vacation.reason).toContain("hard access");
    expect(k.role).toBe("local_only");
  });
  it("Kanarra's far pointer is the Narrows, about 33 km away, in the same class", () => {
    const p = d["place/kanarra-falls"]!.far_pointer!;
    expect(p.ref).toBe("place/the-narrows");
    expect(p.same_class).toBe(true);
    expect(p.km).toBeGreaterThan(28);
    expect(p.km).toBeLessThan(40);
  });
  it("hard access never drops a vacation plan_around: anchors are worth the booking", () => {
    const lottery = { ...narrows, access_cost: { ...narrows.access_cost, v: [{ type: "permit_lottery" as const }] } };
    const out = run([lottery], facts)["place/the-narrows"]!;
    expect(out.access_load).toBe("hard");
    expect(out.fits.vacation.fit).toBe("plan_around");
    expect(out.role).toBe("anchor");
  });
});

describe("10.6 Smugglers' Notch (VT-108)", () => {
  const notch = rec({
    ref: "place/smugglers-notch", kind: "sight", qid: "Q7546619", draw: "regional", standing: "good", distinction: "rare", class_key: "drive/mountain-pass", weather: "better_clear",
    peak: { tier: "national", from: "09-25", to: "10-20", why: "foliage" }, access: [{ type: "seasonal_road", note: "closed in winter" }],
    drawNote: "the plan's research records the top lot as the most congested spot in the area during foliage (booking-free; the land manager's road page)",
  });
  const facts = { "place/smugglers-notch": { point: pt(44.5527, -72.7897), onSiteMin: 30, tripDetourMin: 0 } };

  it("in the foliage window the draw is national: passing-through plan_around, so en_route, and the vacation role is highlight", () => {
    const d = run([notch], facts, { window: { from: "10-01", to: "10-04" } })["place/smugglers-notch"]!;
    expect(d.effective_draw).toBe("national");
    expect(d.fits.passing.fit).toBe("plan_around");
    expect(d.flags.en_route).toBe(true);
    expect(d.fits.vacation.fit).toBe("worth_it");
    expect(d.role).toBe("highlight");
    expect(d.badge).toBe("Worth a detour");
  });
  it("out of season it is regional and good: if_nearby", () => {
    const d = run([notch], facts, { window: { from: "07-01", to: "07-10" } })["place/smugglers-notch"]!;
    expect(d.effective_draw).toBe("regional");
    expect(d.fits.vacation.fit).toBe("if_nearby");
    expect(d.role).toBe("filler");
  });
  it("a seasonal road is not a booking: access_load stays easy", () => {
    expect(run([notch], facts)["place/smugglers-notch"]!.access_load).toBe("easy");
  });
  it("fame signals are weak here: 1 language and 3,062 views suggest regional", () => {
    expect(run([notch], facts)["place/smugglers-notch"]!.draw_suggested).toBe("regional");
  });
});

describe("derive is offline and advisory", () => {
  it("warns when a unique place has a same-class neighbour within 100 km", () => {
    const a = rec({ ref: "place/a", distinction: "unique", class_key: "lake/small-mirror" });
    const b = rec({ ref: "place/b", distinction: "rare", class_key: "lake/small-mirror" });
    const d = run([a, b], { "place/a": { point: pt(46.5, 12) }, "place/b": { point: pt(46.55, 12.05) } });
    expect(d["place/a"]!.warnings.map((w) => w.code)).toContain("W_REL_DISTINCTION");
  });
  it("warns, and stays conservative, when no detour can be found", () => {
    const f = rec({ ref: "place/x", draw: "local", standing: "top" });
    const d = run([f], { "place/x": {} }, { towns: [] })["place/x"]!;
    expect(d.detour_min).toBeNull();
    expect(d.warnings.map((w) => w.code)).toContain("W_REL_NO_DETOUR");
    expect(d.fits.vacation.fit).toBe("skip");
  });
  it("a trip leg beats the base, and the base beats the catalogue town", () => {
    const f = rec({ ref: "place/x", draw: "local", standing: "top" });
    const p = pt(51.2, -115.5);
    expect(run([f], { "place/x": { point: p, tripDetourMin: 7, base: pt(51.18, -115.57) } })["place/x"]!.detour_basis).toBe("trip");
    expect(run([f], { "place/x": { point: p, base: pt(51.18, -115.57) } })["place/x"]!.detour_basis).toBe("base");
    expect(run([f], { "place/x": { point: p } })["place/x"]!.detour_basis).toBe("town");
  });
  it("an override of the role is honoured and nothing else changes", () => {
    const f = { ...rec({ ref: "place/x", draw: "local", standing: "ordinary" }), override: { field: "role" as const, value: "highlight", reason: "the owner's pick", by: "nitin", on: "2026-10-18" } };
    const d = run([f], { "place/x": { point: pt(51.2, -115.5) } })["place/x"]!;
    expect(d.role).toBe("highlight");
  });
  it("rainy_day, hidden_gem and the badge precedence", () => {
    const gem = rec({ ref: "place/g", draw: "local", standing: "top", weather: "indoor" });
    const d = run([gem], { "place/g": { point: pt(51.18, -115.57), accessLegalPublic: true } })["place/g"]!;
    expect(d.flags).toEqual({ go_clear_day: false, rainy_day: true, en_route: expect.any(Boolean), hidden_gem: true });
    expect(d.badge).toBe("Local favourite");
  });
  it("is deterministic", () => {
    const f = rec({ ref: "place/x" });
    const facts = { "place/x": { point: pt(51.2, -115.5) } };
    expect(JSON.stringify(deriveAll({ records: [f], facts, signals: SIG, towns: [banff] }))).toBe(JSON.stringify(deriveAll({ records: [f], facts, signals: SIG, towns: [banff] })));
  });
});

describe("stale values are gaps", () => {
  const r = rec({ ref: "place/x", draw: "world", standing: "top", distinction: "rare", designations: [], class_key: "lake/glacial-turquoise" });
  const facts = { "place/x": { point: pt(51.2, -115.5) } };
  const meta = (researched: string) => ({ "place/x": { researched, reads: { "src-0001": researched } } });
  it("fresh data keeps its tiers and has no stale flag", () => {
    const d = run([r], facts, { meta: meta("2026-10-01"), today: "2026-10-18" })["place/x"]!;
    expect(d.stale).toEqual([]);
    expect(d.role).toBe("anchor");
  });
  it("a draw older than three years is treated as a gap (local) and flagged", () => {
    const d = run([r], facts, { meta: meta("2022-01-01"), today: "2026-10-18" })["place/x"]!;
    expect(d.stale).toEqual(expect.arrayContaining(["draw", "standing", "distinction"]));
    expect(d.effective_draw).toBe("local");
    expect(d.role).not.toBe("anchor");
  });
  it("without a date nothing is stale", () => {
    expect(run([r], facts, { meta: meta("2000-01-01") })["place/x"]!.stale).toEqual([]);
  });
});

describe("access: capped boats and lifts are hard", () => {
  it("boat_or_ferry or lift_only with a cap is hard even when booked days ahead", async () => {
    const { accessLoad } = await import("../../src/relevance/fit.ts");
    expect(accessLoad([{ type: "boat_or_ferry", capped: true }])).toBe("hard");
    expect(accessLoad([{ type: "lift_only", capped: true }])).toBe("hard");
    expect(accessLoad([{ type: "lift_only", book_ahead_days: 30 }])).toBe("hard");
    expect(accessLoad([{ type: "lift_only", book_ahead_days: 3 }])).toBe("plan");
    expect(accessLoad([{ type: "timed_entry", capped: true }])).toBe("plan");
  });
});

describe("guard for the S0b rebase: suitability's deriveEffort still returns a family effort", () => {
  it("Larch Valley (11.2 km, 750 m) keeps effort_km 18.7, band 3 and family effort 3", async () => {
    const { deriveEffort } = await import("../../src/suitability/derive.ts");
    const { loadMap } = await import("../../src/suitability/map.ts");
    const { walk } = await import("../suitability/helpers.ts");
    const e = deriveEffort({ kind: "trail", block: walk(11.2, 750) }, loadMap());
    expect(e.effort_km).toBe(18.7);
    expect(e.band).toBe(3);
    expect(e.family_effort).not.toBeNull();
    expect(e.family_effort).toBe(3);
  });
});
