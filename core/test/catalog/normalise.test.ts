import { describe, expect, it } from "vitest";
import { ENUM_MAP, UNIT_FIELDS, effortGrade, houseGrade, mapEnum, normaliseSidecar, toCurrency, toIsoDate } from "../../src/catalog/normalise.ts";
import type { Warning } from "../../src/catalog/normalise.ts";
import { legId } from "../../src/catalog/common.ts";
import { SIDECARS, deps, sidecar } from "./util.ts";

const norm = async (path: string) => normaliseSidecar(sidecar(path), path, await deps());
const byName = (n: Awaited<ReturnType<typeof norm>>, name: string) => n.records.find((r) => r.row.name === name)!;

describe("house grade, the three worked examples of plan 3A", () => {
  it("Laguna de los Tres, 21.5 km and 950 m, is grade 4 (effort 31 km, no local grade: effort only)", async () => {
    const r = byName(await norm(SIDECARS.trails), "Laguna de los Tres");
    expect(r.row.km).toBe(21.5);
    expect(r.row.gain_m).toBe(950);
    expect(r.row.house_grade).toBe(4);
    expect(r.row.house_basis).toBe("effort-only");
  });

  it("Laguna Capri, 7.27 mi and 1280 ft (11.7 km, 390 m) with a local Moderate, is grade 3 (effort 15.6 beats technical 2)", async () => {
    const r = byName(await norm(SIDECARS.trails), "Laguna Capri and Mirador Fitz Roy");
    expect(r.row.km).toBe(11.7);
    expect(r.row.gain_m).toBe(390);
    expect(r.row.local_system).toBe("nps");
    expect(r.row.local_grade).toBe("Moderate");
    expect(r.row.house_grade).toBe(3);
    expect(r.row.house_basis).toBe("effort");
  });

  it("Senda Costera, 8 km and 70 m with APN Medium, is grade 2 (technical 2, effort 2)", async () => {
    const r = byName(await norm(SIDECARS.trails), "Senda Costera");
    expect(r.row.house_grade).toBe(2);
    expect(r.row.house_basis).toBe("technical");
    expect(r.row.local_system).toBe("apn");
  });

  it("the effort bands are the half-open ranges of the difficulty map", async () => {
    const d = (await deps()).difficulty.effort.bands;
    expect([5.99, 6, 11.99, 12, 19.99, 20, 29.99, 30, 80].map((v) => effortGrade(v, d))).toEqual([1, 2, 2, 3, 3, 4, 4, 4, 4]);
  });

  it("technical beats effort when higher (a short T4 scramble is 5), and an unmapped label falls back with a warning", async () => {
    const d = (await deps()).difficulty;
    const w: Warning[] = [];
    expect(houseGrade(2, 100, { system: "sac", grade: "T4" }, d, w)).toMatchObject({ house: 5, basis: "technical", technical: 5, effort: 1 });
    expect(houseGrade(2, 100, { system: "sac", grade: "T9" }, d, w)).toMatchObject({ house: 1, basis: "effort-only", technical: null });
    expect(w.map((x) => x.code)).toEqual(["W_GRADE_UNMAPPED"]);
    expect(houseGrade(null, null, { system: null, grade: null }, d, [])).toMatchObject({ house: null, basis: null });
  });

  it("research cannot set the house grade: the rule wins and says so", async () => {
    const s = sidecar(SIDECARS.trails);
    s.records.trails[2].house_grade = 5;
    const n = normaliseSidecar(s, "x", await deps());
    const r = byName(n, "Senda Costera");
    expect(r.row.house_grade).toBe(2);
    expect(r.warnings.map((w) => w.code)).toContain("W_GRADE_OVERRIDDEN");
  });
});

describe("units, dates, currency", () => {
  it("converts miles and feet to km and metres", async () => {
    expect(UNIT_FIELDS.distance_mi).toEqual(["km", 1.609344]);
    const r = byName(await norm(SIDECARS.trails), "Laguna Capri and Mirador Fitz Roy");
    expect(r.row.distance_mi).toBeUndefined();
    expect(r.row.gain_ft).toBeUndefined();
    // 7.27 mi = 11.6998 km, 1280 ft = 390.14 m
    expect([r.row.km, r.row.gain_m]).toEqual([11.7, 390]);
  });

  it("reads dates written in the usual ways", () => {
    expect(toIsoDate("13 Oct 2026")).toBe("2026-10-13");
    expect(toIsoDate("Oct 13, 2026")).toBe("2026-10-13");
    expect(toIsoDate("2026/10/13")).toBe("2026-10-13");
    expect(toIsoDate("2026-10-13T08:00:00Z")).toBe("2026-10-13");
    expect(toIsoDate("31 Feb 2026")).toBeNull();
    expect(toIsoDate("soon")).toBeNull();
  });

  it("keeps currencies as ISO codes and warns about a bare symbol", () => {
    const w: Warning[] = [];
    expect(toCurrency("C$", w)).toBe("CAD");
    expect(toCurrency("usd", w)).toBe("USD");
    expect(toCurrency("$", w)).toBe("$");
    expect(w.map((x) => x.code)).toEqual(["W_CURRENCY"]);
  });
});

describe("enum mapping", () => {
  it("maps the Rockies' guided_hike to guided-hike and Cable Car to gondola, per the table", async () => {
    const n = await norm(SIDECARS.adventure);
    expect(byName(n, "Guided Icewalk").row.type).toBe("guided-hike");
    expect(byName(n, "Banff Gondola").row.type).toBe("gondola");
    expect(ENUM_MAP["activities.type"]!["guided-hike"]).toBe("guided-hike");
  });

  it("an unknown value becomes other with a warning, never dropped", async () => {
    const r = byName(await norm(SIDECARS.adventure), "Quokka Walk");
    expect(r.row.type).toBe("other");
    expect(r.warnings.find((w) => w.code === "W_ENUM_UNKNOWN")?.message).toContain("Quokka Walk");
  });

  it("an unknown value of an enum with no other is kept and warned about", () => {
    const w: Warning[] = [];
    expect(mapEnum("stays", "kind", "yurt", w)).toBe("yurt");
    expect(w[0]!.message).toContain("no \"other\"");
    expect(mapEnum("stays", "kind", "Refugio", [])).toBe("hut");
    expect(mapEnum("offer_prices", "per", "per adult", [])).toBe("adult");
    expect(mapEnum("trails", "shape", "Out_and_Back", [])).toBe("out-and-back");
  });
});

describe("tags", () => {
  it("resolves aliases and reports the unknown", async () => {
    const n = await norm(SIDECARS.trails);
    expect(byName(n, "Laguna de los Tres").row.tags).toEqual(["hiking", "mountain"]);
    expect(byName(n, "Laguna Capri and Mirador Fitz Roy").row.tags).toEqual(["viewpoint"]);
    expect(n.unknownTags).toEqual(["Fitz Roy"]);
    const a = await norm(SIDECARS.adventure);
    expect(byName(a, "Guided Icewalk").row.tags).toEqual(["family-hike"]);
    expect(a.unknownTags).toEqual(["Ice Walking"]);
  });
});

describe("ids", () => {
  it("proposes <area_id>/<slug> and keeps explicit ids", async () => {
    const n = await norm(SIDECARS.trails);
    expect(byName(n, "Laguna de los Tres").id).toBe("AR/santa-cruz/el-chalten/laguna-de-los-tres");
    expect(byName(n, "Senda Costera").id).toBe("AR/tierra-del-fuego/ushuaia/senda-costera");
    const s = sidecar(SIDECARS.trails);
    s.records.trails[0].id = "AR/santa-cruz/el-chalten/lago-de-los-tres";
    expect(byName(normaliseSidecar(s, "x", await deps()), "Laguna de los Tres").id).toBe("AR/santa-cruz/el-chalten/lago-de-los-tres");
  });

  it("builds an offer id from provider and product, and a price points at it", async () => {
    const n = await norm(SIDECARS.adventure);
    const offer = n.records.find((r) => r.entity === "offers")!;
    expect(offer.id).toBe("of-banff-jasper-collection-banff-gondola");
    expect(offer.row.category).toBe("activity");
    const prices = n.records.filter((r) => r.entity === "offer_prices");
    expect(prices.map((p) => p.row.offer_id)).toEqual(["of-banff-jasper-collection-banff-gondola", "of-banff-jasper-collection-banff-gondola"]);
    expect(prices.map((p) => [p.row.amount, p.row.currency, p.row.per, p.row.read])).toEqual([[70, "CAD", "adult", "2026-10-13"], [35, "CAD", "child", "2026-10-13"]]);
  });

  it("a leg id is lg- plus the first 10 hex digits of sha256 of from|to|mode", () => {
    // sha256("a|b|drive") = known digest prefix
    expect(legId("a", "b", "drive")).toMatch(/^lg-[0-9a-f]{10}$/);
    expect(legId("a", "b", "drive")).toBe(legId("a", "b", "drive"));
    expect(legId("a", "b", "drive")).not.toBe(legId("b", "a", "drive"));
  });

  it("normalises a leg record to its id", async () => {
    const s = sidecar(SIDECARS.trails);
    s.records.legs = [{ match: {}, src: ["src-0001"], from_id: "AR/santa-cruz/el-chalten/el-chalten", to_id: "AR/santa-cruz/el-chalten/hosteria", mode: "Car", distance_km: 3, minutes: 6, basis: "estimate" }];
    const r = normaliseSidecar(s, "x", await deps()).records.find((x) => x.entity === "legs")!;
    expect(r.row.mode).toBe("drive");
    expect(r.id).toBe(legId("AR/santa-cruz/el-chalten/el-chalten", "AR/santa-cruz/el-chalten/hosteria", "drive"));
    expect(r.row.km).toBe(3);
    expect(r.warnings).toEqual([]);
  });
});

describe("hygiene", () => {
  it("drops provenance columns a researcher tried to set, with a warning", async () => {
    const s = sidecar(SIDECARS.trails);
    s.records.trails[0].review_status = "verified";
    s.records.trails[0].confidence = "verified";
    const r = byName(normaliseSidecar(s, "x", await deps()), "Laguna de los Tres");
    expect(r.row.review_status).toBeUndefined();
    expect(r.confidence).toBe("stated");
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["W_FIELD_IGNORED", "W_CONFIDENCE"]));
  });
});
