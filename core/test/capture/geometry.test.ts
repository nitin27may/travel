import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completeness } from "../../src/capture/engine.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { GEOMETRY_GAP_REASON, tracksByRef } from "../../src/capture/tracks.ts";
import { PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import { REPO } from "./helpers.ts";

// geometry reads data/tracks: a confirmed line is done, a held-back one is a gap with the reason "route not confirmed",
// and a route with no stored line is a plain gap. Derived from the files, so new tracks never break it.
describe("geometry reads the stored tracks", () => {
  const world = loadWorld(REPO);
  const tracks = tracksByRef(world);
  const routeRefs = [...tracks.keys()].filter((r) => world.cap.get(r)?.rec.layer === "route");

  it("has a home in the tracks folder", () => {
    expect(PROPERTY_BY_KEY.get("geometry")!.home).toEqual({ in: "tracks", path: "data/tracks" });
  });

  it("indexes every track file that names a capture ref", () => {
    const files = readdirSync(join(REPO, "data", "tracks")).filter((n) => n.endsWith(".json") && n !== "inputs.json");
    const named = files.filter((n) => (JSON.parse(readFileSync(join(REPO, "data", "tracks", n), "utf8")) as { refs?: string[] }).refs?.length);
    expect(tracks.size).toBeGreaterThanOrEqual(named.length);
  });

  it("a route with a confirmed stitched line does not miss geometry", () => {
    const ref = routeRefs.find((r) => tracks.get(r)!.confirmed && tracks.get(r)!.stitched);
    expect(ref, "some route has a confirmed track").toBeTruthy();
    const c = completeness(world, ref!)!;
    expect(c.missingBase).not.toContain("geometry");
    expect(c.gapReasons.geometry).toBeUndefined();
  });

  it("a route whose line is held back misses geometry and says why", () => {
    const ref = routeRefs.find((r) => !tracks.get(r)!.confirmed);
    expect(ref, "some route has a held-back track").toBeTruthy();
    const c = completeness(world, ref!)!;
    expect(c.missingBase).toContain("geometry");
    expect(c.gapReasons.geometry).toBe(GEOMETRY_GAP_REASON);
  });

  it("a route with no stored line misses geometry without a held-back reason", () => {
    const ref = [...world.cap.keys()].find((r) => world.cap.get(r)!.rec.layer === "route" && !tracks.has(r))!;
    const c = completeness(world, ref)!;
    expect(c.missingBase).toContain("geometry");
    expect(c.gapReasons.geometry).toBeUndefined();
  });
});
