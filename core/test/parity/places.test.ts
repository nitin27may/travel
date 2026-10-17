// The one parity pair the plan keeps (1.5): place validation in core and in tools/locations.py must reach the
// same verdict on the real store and on every locations fixture. Each case is copied to a tmp root as
// data/locations/locations.json beside data/vocab/tags.json, then both implementations run against that root.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = join(REPO, "core/test/fixtures");
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

interface Verdict {
  pass: boolean;
  out: string;
}

function rootWith(store: string, vocab: string, trips: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "p2b-parity-"));
  tmp.push(root);
  mkdirSync(join(root, "data/locations"), { recursive: true });
  mkdirSync(join(root, "data/vocab"), { recursive: true });
  cpSync(store, join(root, "data/locations/locations.json"));
  cpSync(vocab, join(root, "data/vocab/tags.json"));
  for (const slug of trips) mkdirSync(join(root, "legacy", slug), { recursive: true }); // Python checks the trip folder exists
  return root;
}

function core(root: string): Verdict {
  const r = spawnSync("node", [join(REPO, "core/bin/validate.ts"), join(root, "data/locations/locations.json"), "--root", root], { encoding: "utf8" });
  return { pass: r.status === 0, out: r.stdout + r.stderr };
}

function python(root: string): Verdict {
  const r = spawnSync("python3", [join(REPO, "tools/locations.py"), "validate"], { encoding: "utf8", env: { ...process.env, LOCATIONS_ROOT: root } });
  return { pass: r.status === 0, out: r.stdout + r.stderr };
}

function tripsOf(store: string): string[] {
  const doc = JSON.parse(readFileSync(store, "utf8")) as { places?: { trip?: string | null }[] };
  return [...new Set((doc.places ?? []).map((p) => p.trip).filter((t): t is string => typeof t === "string"))];
}

describe("place validation parity (core vs tools/locations.py)", () => {
  it("agrees that the real store is valid", () => {
    const store = join(REPO, "data/locations/locations.json");
    const root = rootWith(store, join(REPO, "data/vocab/tags.json"), tripsOf(store));
    const [c, p] = [core(root), python(root)];
    expect({ core: c.pass, python: p.pass }, `${c.out}\n${p.out}`).toEqual({ core: true, python: true });
  });

  const vocab = join(FIX, "root/data/vocab/tags.json");
  const names = (d: string) => readdirSync(join(FIX, "locations", d)).filter((f) => f.endsWith(".json")).sort();

  for (const f of names("valid")) {
    it(`valid/${f}: both accept`, () => {
      const store = join(FIX, "locations/valid", f);
      const root = rootWith(store, vocab, tripsOf(store));
      const [c, p] = [core(root), python(root)];
      expect({ core: c.pass, python: p.pass }, `${c.out}\n${p.out}`).toEqual({ core: true, python: true });
    });
  }

  for (const f of names("broken")) {
    it(`broken/${f}: both reject`, () => {
      const store = join(FIX, "locations/broken", f);
      const root = rootWith(store, vocab, tripsOf(store));
      const [c, p] = [core(root), python(root)];
      expect({ core: c.pass, python: p.pass }, `${c.out}\n${p.out}`).toEqual({ core: false, python: false });
    });
  }

  it("has a broken fixture for each shared rule", () => {
    expect(names("broken").map((f) => f.replace(/\.json$/, ""))).toEqual(expect.arrayContaining([
      "missing-area", "unknown-tag", "lat-without-lon", "duplicate-id", "bad-screenshot-path", "unknown-kind",
    ]));
  });

  it("each broken fixture fails for its own reason in both implementations", () => {
    const why: Record<string, [RegExp, RegExp]> = {
      "missing-area": [/area_id/, /area_id/],
      "unknown-tag": [/tag_id/, /tag_id/],
      "lat-without-lon": [/lat/, /lat and lon/],
      "duplicate-id": [/E_PK_DUP|same id/, /duplicate key/],
      "bad-screenshot-path": [/research\/inbox/, /research\/inbox/],
      "unknown-kind": [/kind/, /kind/],
      "unknown-review-status": [/review_status/, /review_status/],
    };
    for (const [name, [rc, rp]] of Object.entries(why)) {
      const store = join(FIX, "locations/broken", `${name}.json`);
      const root = rootWith(store, vocab, tripsOf(store));
      expect(core(root).out, `core on ${name}`).toMatch(rc);
      expect(python(root).out, `python on ${name}`).toMatch(rp);
    }
  });
});

