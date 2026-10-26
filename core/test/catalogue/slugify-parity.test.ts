// SLUG-FIX: the two slugifiers (kebab here, slugify in tools/locations.py) transliterate the letters NFKD cannot decompose and agree
// on every name. Before, both dropped æ, ð and þ, and AREA-2 pinned `sn-fellsjokull` for Snæfellsjökull.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSLITERATION, asciiFold, kebab } from "../../src/catalogue/slugs.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const SAMPLES = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "slugify-samples.json"), "utf8")) as { samples: { lang: string; name: string; slug: string }[] };

/** tools/locations.py's TRANSLITERATION dict, read from its source text (one `"x": "y"` pair per entry). */
function pythonTable(): Record<string, string> {
  const src = readFileSync(join(ROOT, "tools", "locations.py"), "utf8");
  const body = /^TRANSLITERATION = \{([\s\S]*?)^\}/m.exec(src)?.[1];
  if (!body) throw new Error("TRANSLITERATION not found in tools/locations.py");
  return Object.fromEntries([...body.matchAll(/"([^"]+)":\s*"([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
}

/** Runs tools/locations.py's slugify over the names; null when python3 is not on PATH. */
function pythonSlugs(names: string[]): string[] | null {
  const code = "import json, sys; sys.path.insert(0, 'tools'); import locations as L; print(json.dumps([L.slugify(n) for n in json.load(sys.stdin)]))";
  const run = spawnSync("python3", ["-c", code], { cwd: ROOT, input: JSON.stringify(names), encoding: "utf8" });
  if (run.error) return null;
  if (run.status !== 0) throw new Error(run.stderr);
  return JSON.parse(run.stdout) as string[];
}

describe("kebab transliterates before it drops (SLUG-FIX)", () => {
  for (const s of SAMPLES.samples) it(`${s.lang}: ${s.name.trim()} -> ${s.slug}`, () => expect(kebab(s.name)).toBe(s.slug));

  it("asciiFold keeps case and spells every table letter out", () => {
    expect(asciiFold("Þórsmörk")).toBe("Thorsmork");
    expect(asciiFold("Ærø")).toBe("Aero");
    for (const [from, to] of Object.entries(TRANSLITERATION)) expect(asciiFold(from)).toBe(to);
  });
  it("still folds accents, ampersands and apostrophes as before", () => {
    expect(kebab("Lac d’Émeraude & Co's")).toBe("lac-demeraude-and-cos");
  });
});

describe("parity with tools/locations.py slugify", () => {
  it("the two transliteration tables are the same", () => {
    expect(pythonTable()).toEqual({ ...TRANSLITERATION });
  });
  it("both give the shared samples and agree on every wishlist name and area (no & or apostrophe)", () => {
    const store = JSON.parse(readFileSync(join(ROOT, "data", "locations", "locations.json"), "utf8")) as { areas: { name: string }[]; places: { name: string }[]; regions: { name: string }[] };
    const real = [...store.areas, ...store.places, ...store.regions].map((r) => r.name).filter((n) => !/[&'’]/.test(n) && kebab(n) !== "");
    const names = [...SAMPLES.samples.map((s) => s.name), ...real];
    const py = pythonSlugs(names);
    if (!py) return; // no python3 here; tools/tests/test_slugify_parity.py holds the Python side to the same samples
    expect(py.slice(0, SAMPLES.samples.length)).toEqual(SAMPLES.samples.map((s) => s.slug));
    expect(py).toEqual(names.map(kebab));
  });
});
