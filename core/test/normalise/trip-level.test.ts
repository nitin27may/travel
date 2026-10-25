// Windows, base plans and seasons (RIS-N; spec 4.2): one basis vocabulary, the season shape as a Val, W_KEEP_UNREAD.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapBasis } from "../../src/normalise/tripLevel.ts";
import { SUIT_BASIS } from "../../src/schema/enums.ts";
import { FIX, run } from "./helpers.ts";

const claim = (basis: string, text = "A plain statement", extra: Record<string, unknown> = {}) => ({ text, factor: "access", basis, src: ["s-0000000001"], on: "2026-10-25", ...extra });
const win = (over: Record<string, unknown>) => ({
  schema: "trip-windows/1", trip: "t", researched: "2026-10-25", agent: "x", model: "n", length_days: 15, default: "w1",
  sources: [{ id: "s-0000000001", url: "https://example.org/a", title: "A", publisher: "P", kind: "official", read: "2026-10-25" }],
  windows: [{ id: "w1", label: "W", start: { month: 7, week: 1 }, verdict: "good", best_for: "x", plus: [], minus: [], events: [], affects: [], unknown: [], ...over }],
});

describe("the basis vocabulary", () => {
  it("official and operator become *_info, or *_rule when the text states a rule", () => {
    expect(mapBasis("official", claim("official")).to).toBe("official_info");
    expect(mapBasis("official", claim("official", "A Parks Canada pass is required to stop")).to).toBe("official_rule");
    expect(mapBasis("official", claim("official", "The road is closed to traffic until June")).to).toBe("official_rule");
    expect(mapBasis("operator", claim("operator", "Open daily with a first departure at 08:00")).to).toBe("operator_info");
    expect(mapBasis("operator", claim("operator", "Booking is required at least a day ahead")).to).toBe("operator_rule");
  });

  it("computed and plan become our_inference, with the method; searched_none becomes a state", () => {
    expect(mapBasis("computed", {})).toEqual({ to: "our_inference", method: "computed" });
    expect(mapBasis("plan", {})).toEqual({ to: "our_inference", method: "owner" });
    expect(mapBasis("searched_none", {})).toEqual({ to: null, searchedNone: true });
  });

  it("every target is a SUIT_BASIS value", () => {
    for (const from of ["official", "operator", "computed", "plan"]) for (const text of ["x", "is required", "closed", "maximum 8"]) {
      const to = mapBasis(from, { text }).to;
      expect(SUIT_BASIS as readonly string[]).toContain(to);
    }
  });

  it("rewrites claims in place, adds method for computed, and writes the file-level meta", () => {
    const r = run("windows", win({ plus: [claim("official"), claim("computed", "Sunrise 05:40", { src: ["s-0000000001"] })], minus: [claim("operator", "Maximum 8 riders")] }));
    const w = r.out.windows[0];
    expect(w.plus[0].basis).toBe("official_info");
    expect(w.plus[1]).toMatchObject({ basis: "our_inference", method: "computed" });
    expect(w.minus[0].basis).toBe("operator_rule");
    expect(r.out.meta).toEqual({ schema_version: 1, run_id: "TEST-1" });
    expect(r.changes.filter((c) => c.rule === "basis")).toHaveLength(3);
  });

  it("names the tool from the source row when the claim has no note, and flags it when it cannot", () => {
    const doc = win({ plus: [claim("computed", "Sunrise 05:40")] });
    (doc.sources as any[])[0].url = "core/bin/sun.ts";
    expect(run("windows", doc).out.windows[0].plus[0].note).toBe("Computed with core/bin/sun.ts.");
    const unknown = run("windows", win({ plus: [claim("computed", "Drive 1 h 10")] }));
    expect(unknown.out.windows[0].plus[0].note).toBeUndefined();
    expect(unknown.findings.map((f) => f.code)).toContain("W_NORM_COMPUTED_TOOL");
  });

  it("leaves a basis that is already SUIT_BASIS, and a second run changes nothing", () => {
    const once = run("windows", win({ plus: [claim("our_inference", "x", { note: "why" }), claim("official")] }));
    const twice = run("windows", once.text);
    expect(twice.changes).toEqual([]);
    expect(twice.text).toBe(once.text);
  });

  it("reports a basis it does not know and leaves it", () => {
    const r = run("windows", win({ plus: [claim("hearsay")] }));
    expect(r.out.windows[0].plus[0].basis).toBe("hearsay");
    expect(r.findings.map((f) => f.code)).toContain("W_NORM_BASIS");
  });
});

describe("W_KEEP_UNREAD", () => {
  it("lists the trip-level keys no adapter reads, once per pattern and key", () => {
    const doc: any = win({});
    doc.batch = "DATA-D7R";
    doc.validation_note = "n";
    doc.sources[0].note = "x";
    const r = run("windows", doc);
    const unread = r.findings.filter((f) => f.code === "W_KEEP_UNREAD").map((f) => f.path).sort();
    expect(unread).toEqual(["/batch", "/sources/0/note", "/validation_note"]);
    expect(r.findings.every((f) => f.level !== "error")).toBe(true);
  });

  it("is a warning, never an error, and reads nothing in a family it does not know", () => {
    expect(run("tracks", { schema: "trail-track/1", place: "x", odd: 1 }).findings.filter((f) => f.code === "W_KEEP_UNREAD")).toEqual([]);
  });
});

describe("seasons", () => {
  const text = readFileSync(join(FIX, "season-switzerland-2027.json"), "utf8");

  it("turns {value, basis, src, on} into a Val and maps every basis (the real Switzerland file)", () => {
    const r = run("seasons", text);
    const s = r.out.season;
    expect(s.months).toEqual({ v: [7, 8], state: "value", basis: "our_inference", src: [], note: "The plan's own months." });
    expect(s.why).toMatchObject({ state: "value", basis: "official_info", read: "2026-10-25" });
    expect(s.weather.daylight).toMatchObject({ basis: "our_inference", state: "value" });
    expect(s.weather.daylight.value).toBeUndefined();
    expect(r.changes.filter((c) => c.rule === "season_shape").length).toBe(6);
    expect(r.out.points[3].lat).toBeUndefined(); // a station with no coordinates stays one
  });

  it("keeps the file's own layout outside the changed values", () => {
    const r = run("seasons", text);
    expect(r.text).toContain('{ "id": "s-24abfa0c03", "url":'); // the inline source rows are byte-identical
    const sourcesLine = text.split("\n").find((l) => l.includes("s-c7ec1ea1c4"));
    expect(r.text.split("\n")).toContain(sourcesLine);
  });

  it("a {value, basis: 'searched_none'} becomes a Val in state searched_none", () => {
    const doc: any = { schema: "trip-season-basic/1", trip: "t", researched: "2026-10-25", agent: "x", model: "n", length_days: 3, default: "plan", sources: [], season: { label: { value: null, basis: "searched_none", on: "2026-10-25" } } };
    const r = run("seasons", doc);
    expect(r.out.season.label).toEqual({ v: null, state: "searched_none", basis: null, src: [], on: "2026-10-25" });
  });
});
