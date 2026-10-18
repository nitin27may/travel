// Builders for relevance tests. Values here are synthetic fixtures: they check the code, they are not data.
import type { RelevanceDoc, RelevanceRecord } from "../../src/schema/relevance.ts";

type B = "operator_rule" | "official_rule" | "official_grade" | "official_info" | "community" | "our_inference" | "editorial";
export interface RVal<T> { v: T | null; state: "value" | "none_stated" | "searched_none" | "not_applicable" | "gap"; basis: B | null; src: string[]; note?: string; read?: string; on?: string; tried?: string[] }

export function rv<T>(value: T, note = "fixture judgement", basis: B = "our_inference", src: string[] = []): RVal<T> {
  return { v: value, state: "value", basis, src, ...(note ? { note } : {}) };
}
export const gapv = <T>(): RVal<T> => ({ v: null, state: "gap", basis: null, src: [] });

export interface RecOpts {
  ref?: string;
  kind?: string;
  qid?: string | null;
  class_key?: string;
  draw?: RelevanceRecord["draw"]["v"];
  drawNote?: string;
  standing?: RelevanceRecord["standing"]["v"];
  distinction?: RelevanceRecord["distinction"]["v"];
  weather?: RelevanceRecord["weather"]["v"];
  easy?: RelevanceRecord["easy_payoff"]["v"];
  peak?: { tier: "local" | "regional" | "national" | "world"; from: string; to: string; why: string } | null;
  access?: { type: string; note?: string; book_ahead_days?: number }[];
  designations?: RelevanceRecord["signals"]["designations"]["v"];
  editorial?: RelevanceRecord["signals"]["editorial"]["v"];
  easyWay?: string;
}

export function rec(o: RecOpts = {}): RelevanceRecord {
  return {
    ref: o.ref ?? "place/lago-di-braies",
    kind: o.kind ?? "lake",
    wikidata: o.qid === null ? gapv<string>() : rv(o.qid ?? "Q1072342", "checked by coordinates and description"),
    class_key: o.class_key ?? "lake/glacial-turquoise",
    draw: rv(o.draw ?? "regional", o.drawNote ?? "inside a national park (designation, parent scope); the land manager lists it"),
    ...(o.peak ? { draw_peak: rv(o.peak, "fall colour, official page") } : {}),
    standing: rv(o.standing ?? "good"),
    standing_scope: "within 1 h",
    distinction: rv(o.distinction ?? "common"),
    easy_payoff: rv(o.easy ?? "full"),
    ...(o.easyWay ? { easy_way: o.easyWay } : {}),
    weather: rv(o.weather ?? "any_weather"),
    why: "A fixture place.",
    access_cost: rv((o.access ?? []) as never, "fixture"),
    signals: {
      designations: rv(o.designations ?? [], "fixture", "official_info", ["src-0001"]),
      editorial: rv(o.editorial ?? [], "fixture", "editorial", ["src-0001"]),
    },
  } as RelevanceRecord;
}

export function doc(records: RelevanceRecord[], over: Partial<RelevanceDoc> = {}): RelevanceDoc {
  return {
    schema: "relevance/1",
    trip: "fixture-trip",
    lane: "t",
    researched: "2026-10-18",
    sources: [{ id: "src-0001", url: "https://parks.canada.ca/x", title: "t", publisher: "Parks Canada", kind: "official", read: "2026-10-12" }],
    records,
    ...over,
  };
}
