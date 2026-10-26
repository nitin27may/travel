import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { weatherLinksFile } from "../../src/schema/weatherLinks.ts";
import { allFiles, detect, validateDoc, validateFile } from "../../src/validate/index.ts";
import { knownTripIds } from "../../src/validate/weatherLinks.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FILE = join(REPO, "data/reference/weather-links.json");
const load = () => JSON.parse(readFileSync(FILE, "utf8"));
const run = (doc: unknown) => validateDoc(doc, "sidecar", REPO, { family: "sidecar", kind: "weather-links" });
const codes = (doc: unknown) => run(doc).errors.map((e) => e.code);
const msgs = (doc: unknown) => run(doc).errors.map((e) => `${e.path} ${e.message}`).join("\n");

describe("weather-links/1 (data/reference/weather-links.json)", () => {
  it("the real file parses, is detected by path and by schema id, and --all reads it", () => {
    expect(weatherLinksFile.safeParse(load()).success).toBe(true);
    expect(detect(FILE, null, REPO)).toMatchObject({ family: "sidecar", kind: "weather-links" });
    expect(detect(null, { schema: "weather-links/1" }, REPO)).toMatchObject({ kind: "weather-links" });
    expect(allFiles(REPO)).toContain(FILE);
  });
  it("validates with no errors; the only warnings are the known Patagonia gap and the unused ARPAV placeholder", () => {
    const r = validateFile(FILE, REPO);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code).sort()).toEqual(["W_WX_NO_DRAWABLE", "W_WX_PUBLISHER_UNUSED"]);
  });
  it("every trip id is a known trip", () => {
    const ids = knownTripIds(REPO);
    for (const t of load().trips) expect(ids.has(t.trip)).toBe(true);
  });

  it("rejects an unknown trip id and a duplicate trip", () => {
    const a = load();
    a.trips[0].trip = "no-such-trip";
    expect(codes(a)).toContain("E_FK");
    const b = load();
    b.trips[1] = { ...structuredClone(b.trips[0]) };
    expect(codes(b)).toContain("E_PK_DUP");
  });
  it("rejects a publisher key that is not in publishers", () => {
    const a = load();
    a.trips[0].links[0].publisher = "nobody";
    expect(msgs(a)).toMatch(/publisher "nobody" is not a key/);
  });
  it("rejects a url that is not https, one with credentials, and one with a personal query parameter", () => {
    const http = load();
    http.trips[0].links[0].url = "http://weather.gc.ca/x";
    expect(msgs(http)).toMatch(/must be https/);
    const cred = load();
    cred.trips[0].links[0].url = "https://me:pw@weather.gc.ca/x";
    expect(msgs(cred)).toMatch(/credentials/);
    const q = load();
    q.trips[0].fallback.url = "https://weather.gc.ca/x?adults=2&coords=1,2";
    expect(msgs(q)).toMatch(/"adults" could carry personal data/);
  });
  it("rejects an email address in a url and anywhere else in the file", () => {
    const u = load();
    u.trips[0].links[0].url = "https://weather.gc.ca/x?q=someone%40example.com";
    expect(msgs(u)).toMatch(/email address/);
    const n = load();
    n.trips[0].links[0].note = "ask nitin@example.com";
    expect(msgs(n)).toMatch(/the file contains an email address/);
  });
  it("rejects a kind outside forecast, climate, mountain and aurora", () => {
    const a = load();
    a.trips[0].links[0].kind = "radar";
    expect(codes(a)).toContain("E_SCHEMA");
  });
  it("allows reachable:false, but warns when a trip has no reachable forecast and its fallback is unreachable too", () => {
    const ok = load();
    const t = ok.trips.find((x: { trip: string }) => x.trip === "quebec-2026");
    t.links.forEach((l: { kind: string; check: { reachable: boolean; http: number; content: string } }) => {
      if (l.kind === "forecast") Object.assign(l.check, { reachable: false, http: 403, content: "blocked" });
    });
    let r = run(ok);
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w) => w.path === `/trips/${ok.trips.indexOf(t)}`)).toEqual([]);
    t.fallback.check.reachable = false;
    r = run(ok);
    expect(r.warnings.some((w) => w.code === "W_WX_NO_DRAWABLE" && w.message.includes("quebec-2026"))).toBe(true);
  });
  it("rejects a trip with no fallback, and a reachable row whose http status is an error", () => {
    const a = load();
    delete a.trips[0].fallback;
    expect(codes(a)).toContain("E_SCHEMA");
    const b = load();
    b.trips[0].links[0].check.http = 404;
    expect(msgs(b)).toMatch(/reachable is true but the read got HTTP 404/);
  });
  it("rejects an unknown key and a missing schema id", () => {
    const a = load();
    a.trips[0].links[0].price = 1;
    expect(codes(a)).toContain("E_SCHEMA");
    const b = load();
    b.schema = "weather-links/2";
    expect(codes(b)).toContain("E_SCHEMA");
  });
  it("a used publisher with no home is an error", () => {
    const a = load();
    a.publishers.eccc.home = null;
    expect(msgs(a)).toMatch(/needs a home url/);
  });
});

describe("knownTripIds", () => {
  const dir = mkdtempSync(join(tmpdir(), "wx-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  it("reads folders of data/capture, data/trips and the season file names, not the shared folders", () => {
    mkdirSync(join(dir, "data/capture/a-2027"), { recursive: true });
    mkdirSync(join(dir, "data/capture/runs"), { recursive: true });
    mkdirSync(join(dir, "data/seasons"), { recursive: true });
    writeFileSync(join(dir, "data/seasons/b-2028.json"), "{}");
    expect([...knownTripIds(dir)].sort()).toEqual(["a-2027", "b-2028"]);
  });
});
