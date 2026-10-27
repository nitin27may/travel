import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { slugNamesMonthYear } from "../src/validate/trip.ts";
import { ERROR_CODE_LIST, allFiles, detect, validateDoc, validateFile } from "../src/validate/index.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const FIX = join(REPO, "core", "test", "fixtures");
const ROOT = join(FIX, "root");
const BIN = join(REPO, "core", "bin", "validate.ts");

function walk(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const tmp: string[] = [];
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), "p2a-val-"));
  tmp.push(d);
  return d;
};
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("valid fixtures", () => {
  const files = [...walk(join(FIX, "valid"), ".json"), ...walk(join(ROOT, "data"), ".json"), join(ROOT, "research/trips/patagonia-fixture/trails.json")];

  it("includes a day trip, a multi-base trip with Plan B, a road trip and one file per catalog entity", () => {
    const names = files.map((f) => f.slice(FIX.length + 1));
    expect(names).toEqual(expect.arrayContaining([
      "valid/niagara-day.json", "valid/patagonia-multi-base.json", "valid/quebec-road-trip.json",
      "valid/catalog-trails.json", "valid/catalog-activities.json", "valid/catalog-stays.json", "valid/catalog-eateries.json",
      "valid/catalog-offers.json", "valid/catalog-legs.json", "valid/catalog-areas.json",
    ]));
    const patagonia = read(join(FIX, "valid/patagonia-multi-base.json"));
    expect(new Set(patagonia.day_tracks.map((t: { track: string }) => t.track))).toEqual(new Set(["A", "B", "C", "P"]));
    expect(patagonia.bases.length).toBe(3);
  });

  for (const f of files) {
    it(`${f.slice(FIX.length + 1)} has zero errors`, () => {
      const r = validateFile(f, ROOT);
      expect(r.errors, JSON.stringify(r.errors, null, 1)).toEqual([]);
    });
  }
});

describe("broken fixtures", () => {
  const dir = join(FIX, "broken");
  const broken = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();

  it("has exactly one fixture per E_* code declared in codes.ts", () => {
    expect(broken).toEqual([...ERROR_CODE_LIST].sort());
    expect(ERROR_CODE_LIST.length).toBe(25);
  });

  for (const code of broken) {
    it(`${code} yields that code and no other E_* code`, () => {
      expect(readFileSync(join(dir, `${code}.expect`), "utf8").trim()).toBe(code);
      const r = validateFile(join(dir, `${code}.json`), ROOT);
      expect(codes(r), JSON.stringify(r.errors, null, 1)).toEqual([code]);
    });
  }

  it("gives every error a path and a message that says how to fix it", () => {
    for (const code of broken) {
      const r = validateFile(join(dir, `${code}.json`), ROOT);
      for (const e of r.errors) {
        expect(e.path.startsWith("/") || e.path === "", `${code} path ${e.path}`).toBe(true);
        expect(e.message.length, `${code} message`).toBeGreaterThan(30);
        expect(/Example|should be|"[^"]+"/.test(e.message), `${code}: ${e.message}`).toBe(true);
      }
    }
  });
});

describe("messages", () => {
  const trip = () => read(join(FIX, "valid/patagonia-multi-base.json"));
  it("names an unknown column and a missing column in plain English", () => {
    const d = trip();
    d.items[0].bogus = 1;
    delete d.items[1].tz;
    const r = validateDoc(d, "trip", ROOT);
    const text = r.errors.map((e) => e.message).join("\n");
    expect(text).toContain('unknown column "bogus"');
    expect(text).toContain('column "tz" is missing');
    expect(text).toContain("null");
  });

  it("shows a valid example for a bad time and a bad enum", () => {
    const d = trip();
    d.items[0].start = "9am";
    d.items[1].type = "hike";
    const msgs = validateDoc(d, "trip", ROOT).errors.map((e) => e.message);
    expect(msgs.some((m) => m.includes('"start"') && m.includes('Example: "07:15"'))).toBe(true);
    expect(msgs.some((m) => m.includes('"type" must be one of "activity"'))).toBe(true);
  });

  it("rejects a file written by newer code and says so", () => {
    const d = trip();
    d.schema_version = 2;
    const r = validateDoc(d, "trip", ROOT);
    expect(r.errors[0]!.message).toContain("schema version 2");
  });

  it("rejects a money object with the two-column hint (pitfall 3)", () => {
    const d = trip();
    d.items[3].cost_amount = { amount: 5 };
    expect(validateDoc(d, "trip", ROOT).errors.some((e) => e.code === "E_SCHEMA" && e.message.includes("<name>_currency"))).toBe(true);
  });
});

describe("references", () => {
  it("rejects a tag alias in trip_tags and points at the canonical tag", () => {
    const d = read(join(FIX, "valid/niagara-day.json"));
    d.trip_tags.push({ tag_id: "waterfalls" });
    const r = validateDoc(d, "trip", ROOT);
    expect(codes(r)).toEqual(["E_FK"]);
    expect(r.errors[0]!.message).toContain('"waterfall"');
  });

  it("uses data/vocab/tags.json when it exists, instead of the tags table in the store", () => {
    const root = scratch();
    cpSync(ROOT, root, { recursive: true });
    mkdirSync(join(root, "data/vocab"), { recursive: true });
    writeFileSync(join(root, "data/vocab/tags.json"), JSON.stringify({ tags: [{ id: "scenic-relaxed", alias_of: null }] }));
    const r = validateDoc(read(join(FIX, "valid/niagara-day.json")), "trip", root);
    expect(r.errors).toEqual([]);
    const d = read(join(FIX, "valid/patagonia-multi-base.json"));
    expect(validateDoc(d, "trip", root).errors.some((e) => e.code === "E_FK" && e.path.startsWith("/trip_tags"))).toBe(true);
  });

  it("E_SLUG refuses a trip id with a month and a year; a year or a season is fine (public-ref-aliases 2, REF-C A11)", () => {
    const root = scratch();
    cpSync(ROOT, root, { recursive: true });
    mkdirSync(join(root, "data/vocab"), { recursive: true });
    writeFileSync(join(root, "data/vocab/tags.json"), JSON.stringify({ tags: [{ id: "scenic-relaxed", alias_of: null }] }));
    const withSlug = (slug: string) => {
      const d = read(join(FIX, "valid/niagara-day.json"));
      d.id = slug;
      d.trip.slug = slug;
      return validateDoc(d, "trip", root);
    };
    for (const bad of ["niagara-day-aug-2026", "patagonia-feb-mar-2027", "rockies-september-2029", "sept-2029", "rockies-sept2029", "rockies-2029-09"]) {
      const r = withSlug(bad);
      expect(codes(r), bad).toEqual(["E_SLUG"]);
      expect(r.errors[0]!.message).toMatch(/month and a year/);
    }
    for (const good of ["niagara-day-2026", "vermont-fall-2026", "norway-summer-2028"]) expect(withSlug(good).errors, good).toEqual([]);
  });

  it("S4: slugNamesMonthYear reads every spelling of a month next to a year, and leaves years and seasons alone", () => {
    for (const bad of ["sept-2029", "rockies-sept2029", "rockies-2029-09", "rockies_sept_2029", "rockies sept 2029", "rockies-septembre-2029", "dolomiten-juli-2027", "alpes-juillet-2027", "peru-agosto-2028", "rockies\u2011sept\u20112029", "rockies\u2013sept\u20132029", "rockies-09-2029", "2029-sept-rockies", "Rockies.Sept.2029", "rockies-feb-mar-2027", "mai-2029"]) {
      expect(slugNamesMonthYear(bad), bad).toBe(true);
    }
    for (const good of ["niagara-day-2026", "vermont-fall-2026", "norway-summer-2028", "canadian-rockies-2029", "march-madness-trail-2026", "marco-polo-2028", "decor-2027", "utah-five-parks", "route-66-2027"]) {
      expect(slugNamesMonthYear(good), good).toBe(false);
    }
  });

  it("checks the folder name for files under data/trips/<slug>/trip.json", () => {
    const root = scratch();
    cpSync(ROOT, root, { recursive: true });
    const dest = join(root, "data/trips/not-the-slug/trip.json");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(join(FIX, "valid/niagara-day.json")));
    const r = validateFile(dest, root);
    expect(codes(r)).toEqual(["E_SLUG"]);
    expect(r.errors[0]!.message).toContain("not-the-slug");
  });

  it("flags a catalog row whose foreign key misses the locations store", () => {
    const d = read(join(FIX, "valid/catalog-stays.json"));
    d.stays[0].area_id = "AR/santa-cruz/nowhere";
    expect(codes(validateDoc(d, "catalog", ROOT, { entity: "stays" }))).toEqual(["E_FK"]);
  });

  it("flags a catalog source id missing from the file's sources table", () => {
    const d = read(join(FIX, "valid/catalog-stays.json"));
    d.stays[0].sources = ["src-0999"];
    expect(codes(validateDoc(d, "catalog", ROOT, { entity: "stays" }))).toEqual(["E_SRC"]);
  });
});

describe("other families", () => {
  it("detects the family from the path and from the content", () => {
    expect(detect(join(ROOT, "data/trips/x/trip.json"), null, ROOT)).toMatchObject({ family: "trip", folder: "x" });
    expect(detect(join(ROOT, "data/catalog/trails/AR.json"), null, ROOT)).toMatchObject({ family: "catalog", entity: "trails", fileCC: "AR" });
    expect(detect(join(ROOT, "data/catalog/changes/2026-10.jsonl"), null, ROOT)).toMatchObject({ kind: "changes" });
    expect(detect(join(ROOT, "data/trips/x/routes/r1.json"), null, ROOT)).toMatchObject({ kind: "route-geometry" });
    expect(detect(join(ROOT, "data/locations/locations.json"), null, ROOT)).toMatchObject({ family: "locations" });
    expect(detect(join(ROOT, "research/trips/p/trails.json"), {}, ROOT)).toMatchObject({ kind: "research-sidecar" });
    expect(detect("/elsewhere/a.json", read(join(FIX, "valid/niagara-day.json")), ROOT)).toMatchObject({ family: "trip" });
    expect(detect("/elsewhere/a.json", { nothing: 1 }, ROOT)).toBeNull();
  });

  it("checks route geometry vertex arrays against the polyline", () => {
    const d = read(join(FIX, "valid/documents/route-geometry.json"));
    d.t_s.pop();
    const r = validateDoc(d, "sidecar", ROOT, { kind: "route-geometry" });
    expect(r.errors[0]!.message).toContain("one entry per polyline vertex");
  });

  it("checks sidecar source ids", () => {
    const d = read(join(FIX, "valid/documents/research-sidecar.json"));
    d.facts[0].src = ["src-0404"];
    expect(codes(validateDoc(d, "sidecar", ROOT, { kind: "research-sidecar" }))).toEqual(["E_SRC"]);
  });

  it("validates catalog_changes JSONL line by line", () => {
    const root = scratch();
    const f = join(root, "data/catalog/changes/2026-10.jsonl");
    mkdirSync(dirname(f), { recursive: true });
    const good = { seq: 1, at: "2026-10-17T12:00:00Z", actor_id: "u_owner", actor_via: "cli", entity: "trails", id: "AR/x/y/z", op: "add", before: null, after: { name: "z" }, reason: null, proposal_id: null, sources: [] };
    writeFileSync(f, JSON.stringify(good) + "\n" + JSON.stringify({ ...good, seq: 2, op: "delete" }) + "\nnot json\n");
    const r = validateFile(f, root);
    expect(r.errors.map((e) => e.path).sort()).toEqual(["/1/op", "/2"]);
  });

  it("agrees with tools/locations.py validate on the real store and on a broken copy", () => {
    const py = (root: string) => spawnSync("python3", [join(REPO, "tools/locations.py"), "validate"], { encoding: "utf8", env: { ...process.env, LOCATIONS_ROOT: root } });
    const real = validateFile(join(REPO, "data/locations/locations.json"), REPO);
    expect(real.errors).toEqual([]);
    expect(py(REPO).status).toBe(0);

    const root = scratch();
    mkdirSync(join(root, "data/locations"), { recursive: true });
    const store = read(join(REPO, "data/locations/locations.json"));
    store.places[0].area_id = "ZZ/none/nowhere";
    writeFileSync(join(root, "data/locations/locations.json"), JSON.stringify(store));
    expect(codes(validateFile(join(root, "data/locations/locations.json"), root))).toEqual(["E_FK"]);
    expect(py(root).status).toBe(1);
  });
});

describe("cli", () => {
  const run = (...a: string[]) => spawnSync("node", [BIN, ...a], { encoding: "utf8" });
  it("prints one ERROR line and exits 1 for a broken fixture", () => {
    const r = run(join(FIX, "broken/E_FK.json"), "--root", ROOT);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^ERROR E_FK \S+E_FK\.json#\/items\/\d+\/trail_id: /m);
  });
  it("exits 0 on a valid fixture", () => {
    const r = run(join(FIX, "valid/niagara-day.json"), "--root", ROOT);
    expect(r.status).toBe(0);
  });
  it("--all passes on the real repository", () => {
    const r = run("--all", "--root", REPO);
    expect(r.status, r.stdout).toBe(0);
    expect(allFiles(REPO).some((f) => f.endsWith("data/locations/locations.json"))).toBe(true);
  });
  it("--json prints machine-readable results", () => {
    const r = run(join(FIX, "broken/E_TZ.json"), "--root", ROOT, "--json");
    expect(JSON.parse(r.stdout)[0].errors[0].code).toBe("E_TZ");
  });
  it("exits 2 with a hint when no file is given", () => {
    expect(existsSync(BIN)).toBe(true);
    expect(run("--root", ROOT).status).toBe(2);
  });
});
