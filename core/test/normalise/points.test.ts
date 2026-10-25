// capture-points/1 to /2 (RIS-N): the free-text point_source becomes point_src and a meta block, with nothing dropped silently.
import { describe, expect, it } from "vitest";
import { parsePointSource } from "../../src/normalise/points.ts";
import { capturePointsFile } from "../../src/schema/capture/points.ts";
import { rowMeta } from "../../src/schema/rowMeta.ts";
import { run } from "./helpers.ts";

const parse = (t: string | undefined, c = "osm", pinned = false) => parsePointSource(t, c, { pinned, readDefault: "2026-10-18", run: "TEST-1" });

describe("parsePointSource", () => {
  it("takes the element, read date, lane and review state out of the text", () => {
    const p = parse("OSM way 1125504165 Warner Stables (horse riding); read 2026-10-19 (lane CS7d); agent checked, needs a person's check");
    expect(p.point_src).toEqual({ provider: "OpenStreetMap", element: "way/1125504165", read: "2026-10-19", quote: "OSM way 1125504165 Warner Stables (horse riding)" });
    expect(p.meta).toEqual({ schema_version: 1, run_id: "CS7d", review_state: "agent_checked", basis: "community" });
    expect(p.imputed).toBe(false);
  });

  it("imputes the read date when the text names none, and says so in a work tag", () => {
    const p = parse("OSM node 10809307066 Banff Gondola Lower Terminal; agent checked, needs a person's check");
    expect(p.point_src.read).toBe("2026-10-18");
    expect(p.imputed).toBe(true);
    expect(p.meta.work_tags).toEqual(["read-date-imputed"]);
    expect(p.meta.run_id).toBe("TEST-1");
  });

  it("a Wikidata row names its QID as the element; a text that opens otherwise names none", () => {
    expect(parse("Wikidata Q3364703 P625 (Beauvais Lake); read 2026-10-25 (lane DATA-D1)", "wikidata").point_src.element).toBe("Q3364703");
    const mean = parse("mean of five Montgomery covered bridges in OSM (Longley way 1038791200, Fuller way 967879573); read 2026-10-25 (lane DATA-D1)");
    expect(mean.point_src.element).toBeUndefined();
    expect(mean.point_src.quote).toContain("mean of five");
  });

  it("an official row takes the provider from the host and the first URL", () => {
    const p = parse("Alberta Parks trail report Elbow Falls https://www.albertaparks.ca/parks/elbow/ (its map's trailhead point)", "official");
    expect(p.point_src.provider).toBe("Alberta Parks");
    expect(p.point_src.url).toBe("https://www.albertaparks.ca/parks/elbow/");
    expect(p.point_src.element).toBeUndefined();
  });

  it("a pinned row keeps the whole old string in legacy", () => {
    const text = "OSM node 263473399 Jasper Skytram station; the lower of the two; agent checked, needs a person's check";
    const p = parse(text, "osm", true);
    expect(p.point_src.legacy).toBe(text);
    expect(p.point_src.quote).toBe("OSM node 263473399 Jasper Skytram station; the lower of the two");
  });

  it("text that does not fit the 300-character quote is kept whole in legacy, never cut", () => {
    const long = `OSM node 1 ${"a long explanation of the choice ".repeat(12)}; read 2026-10-25 (lane DATA-D1b)`;
    const p = parse(long);
    expect(p.point_src.quote).toBeUndefined();
    expect(p.point_src.legacy).toBe(long);
    expect(p.point_src.read).toBe("2026-10-25");
  });

  it("two read dates: the later one", () => {
    expect(parse("OSM node 5 x; read 2026-10-19; read 2026-10-25").point_src.read).toBe("2026-10-25");
  });

  it("a row with no point_source at all still gets a valid point_src", () => {
    const p = parse(undefined, "manual");
    expect(p.point_src).toEqual({ provider: "Manual entry", read: "2026-10-18" });
    expect(p.meta.basis).toBe("our_inference");
  });
});

const v1 = (rows: Record<string, unknown>) => ({ schema: "capture-points/1", note: "n", points: rows });

describe("normalising a points file", () => {
  const rows = {
    "legacy/a/b/pinned": { lat: 51.1, lon: -115.5, coord_src: "osm", point_source: "OSM node 1 Pinned thing; agent checked, needs a person's check" },
    "legacy/a/b/free": { lat: 51.2, lon: -115.6, coord_src: "osm", point_source: "OSM way 2 Free thing; read 2026-10-20 (lane CS7d)", point_role: "trailhead", approx: false },
  };

  it("bumps the schema to /2, converts every row, and the result validates", () => {
    const r = run("points", v1(rows), { pinned: ["legacy/a/b/pinned"] });
    expect(r.out.schema).toBe("capture-points/2");
    expect(capturePointsFile.safeParse(r.out).success).toBe(true);
    for (const row of Object.values<any>(r.out.points)) {
      expect(row.point_source).toBeUndefined();
      expect(rowMeta.safeParse(row.meta).success).toBe(true);
    }
    expect(r.out.points["legacy/a/b/pinned"].point_src.legacy).toContain("Pinned thing");
    expect(r.out.points["legacy/a/b/free"].point_src.legacy).toBeUndefined();
    expect(Object.keys(r.out.points["legacy/a/b/free"])).toEqual(["lat", "lon", "coord_src", "point_src", "point_role", "approx", "meta"]);
    expect(r.changes.filter((c) => c.rule === "point_src")).toHaveLength(2);
    expect(r.changes.filter((c) => c.rule === "points_schema")).toHaveLength(1);
  });

  it("never changes a coordinate", () => {
    const r = run("points", v1(rows));
    expect(r.out.points["legacy/a/b/pinned"]).toMatchObject({ lat: 51.1, lon: -115.5, coord_src: "osm" });
  });

  it("is idempotent: a /2 file is left alone", () => {
    const once = run("points", v1(rows));
    const twice = run("points", once.text);
    expect(twice.changes).toEqual([]);
    expect(twice.text).toBe(once.text);
  });

  it("refuses the file (stays on /1) when a row's text holds a private-list key, and the check reports it", () => {
    const bad = v1({ "legacy/a/b/x": { lat: 51.1, lon: -115.5, coord_src: "osm", point_source: "OSM node 1 x; saved from loc:wl-12345 on the owner's list" } });
    const r = run("points", bad);
    expect(r.out.schema).toBe("capture-points/1");
    expect(r.changes).toEqual([]);
    expect(r.findings.map((f) => f.code)).toEqual(expect.arrayContaining(["E_NORM_REFUSED", "E_NORM_PRIVACY"]));
  });

  it("a business street address in the text is a warning, not a refusal (the planning-note rule also reads addresses)", () => {
    const ok = v1({ "legacy/a/b/x": { lat: 51.1, lon: -115.5, coord_src: "osm", point_source: "OSM way 9 River Base (2750 Beaverfoot Road, the address on the operator's contact page); read 2026-10-25 (lane DATA-D1)" } });
    const r = run("points", ok);
    expect(r.out.schema).toBe("capture-points/2");
    expect(r.findings.map((f) => f.code)).toContain("W_NORM_PRIVACY");
  });

  it("leaves a v2 file with free-text rows untouched and does not throw on a row that is not an object", () => {
    const r = run("points", v1({ a: "not an object" }));
    expect(r.findings.some((f) => f.code === "E_NORM_REFUSED")).toBe(true);
    expect(r.out.schema).toBe("capture-points/1");
  });
});
