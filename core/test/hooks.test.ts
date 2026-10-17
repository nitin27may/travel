import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { removedRows } from "../src/validate/removed.ts";
import { validateDoc } from "../src/validate/index.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const DATA_HOOK = join(REPO, "tools/hooks/data_changed.sh");
const SCHEMA_HOOK = join(REPO, "tools/hooks/schema_changed.sh");
const FIX = join(REPO, "core/test/fixtures");
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

const hook = (script: string, filePath: string) =>
  spawnSync("bash", [script], { input: JSON.stringify({ tool_input: { file_path: filePath } }), encoding: "utf8" });

/** a throwaway repository with the hooks, a symlink to the real core and the fixture data, under git */
function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), "p2a-hook-"));
  tmp.push(root);
  mkdirSync(join(root, "tools/hooks"), { recursive: true });
  for (const h of ["data_changed.sh", "schema_changed.sh"]) {
    cpSync(join(REPO, "tools/hooks", h), join(root, "tools/hooks", h));
    chmodSync(join(root, "tools/hooks", h), 0o755);
  }
  symlinkSync(join(REPO, "core"), join(root, "core"));
  cpSync(join(FIX, "root/data"), join(root, "data"), { recursive: true });
  cpSync(join(FIX, "root/research"), join(root, "research"), { recursive: true });
  const git = (...a: string[]) => spawnSync("git", ["-C", root, "-c", "user.email=t@example.org", "-c", "user.name=t", ...a], { encoding: "utf8" });
  git("init", "-q");
  git("add", "data", "research");
  git("commit", "-q", "-m", "fixture");
  return root;
}

describe("data_changed.sh", () => {
  it("exits 2 with ERROR lines for a broken trip", () => {
    const dir = mkdtempSync(join(tmpdir(), "p2a-hook-trip-"));
    tmp.push(dir);
    const f = join(dir, "data/trips/x/trip.json");
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, readFileSync(join(FIX, "broken/E_FK.json")));
    const r = hook(DATA_HOOK, f);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR E_FK /m);
  });

  it("is silent and exits 0 for files it does not own", () => {
    for (const p of ["/x/README.md", join(REPO, "data/locations/locations.json"), join(REPO, "core/test/fixtures/broken/E_FK.json"), "/x/data/trips/x/prose/day-01.md", ""]) {
      const r = hook(DATA_HOOK, p);
      expect([p, r.status, r.stdout]).toEqual([p, 0, ""]);
    }
  });

  it("passes a valid catalog file in a repository", () => {
    const root = sandbox();
    const r = hook(join(root, "tools/hooks/data_changed.sh"), join(root, "data/catalog/trails/AR.json"));
    expect([r.status, r.stdout]).toEqual([0, ""]);
  });

  it("refuses a write that deletes catalog rows and names them", () => {
    const root = sandbox();
    const f = join(root, "data/catalog/trails/AR.json");
    const doc = JSON.parse(readFileSync(f, "utf8"));
    const removed = doc.trails.pop();
    writeFileSync(f, JSON.stringify(doc));
    const r = hook(join(root, "tools/hooks/data_changed.sh"), f);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("deleting catalog rows is catalog.retire, confirmed by the owner");
    expect(r.stdout).toContain(`trails:${removed.id}`);
  });

  it("allows adding catalog rows", () => {
    const root = sandbox();
    const f = join(root, "data/catalog/trails/AR.json");
    const doc = JSON.parse(readFileSync(f, "utf8"));
    doc.trails.push({ ...doc.trails[0], id: "AR/santa-cruz/el-chalten/new-trail", name: "New trail" });
    writeFileSync(f, JSON.stringify(doc));
    const r = hook(join(root, "tools/hooks/data_changed.sh"), f);
    expect([r.status, r.stdout]).toEqual([0, ""]);
  });

  it("tells the user to install dependencies when core/node_modules is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "p2a-hook-nodeps-"));
    tmp.push(root);
    mkdirSync(join(root, "tools/hooks"), { recursive: true });
    mkdirSync(join(root, "data/trips/x"), { recursive: true });
    cpSync(DATA_HOOK, join(root, "tools/hooks/data_changed.sh"));
    writeFileSync(join(root, "data/trips/x/trip.json"), "{}");
    const r = hook(join(root, "tools/hooks/data_changed.sh"), join(root, "data/trips/x/trip.json"));
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("core dependencies missing: run pnpm --dir");
  });
});

describe("schema_changed.sh", () => {
  // runs in a sandbox so the real data/schema/generated is never rewritten while other tests read it
  it("regenerates and exits 0 for an unchanged schema source", () => {
    const root = sandbox();
    const r = hook(join(root, "tools/hooks/schema_changed.sh"), join(REPO, "core/src/schema/trip.ts"));
    expect([r.status, r.stdout]).toEqual([0, ""]);
    expect(readFileSync(join(root, "data/schema/generated/schema.sql"), "utf8")).toBe(readFileSync(join(REPO, "data/schema/generated/schema.sql"), "utf8"));
  });
  it("ignores other files", () => {
    expect(hook(SCHEMA_HOOK, join(REPO, "core/src/validate/trip.ts"))).toMatchObject({ status: 0, stdout: "" });
  });
});

describe("removedRows", () => {
  it("lists rows present before and absent after, per table", () => {
    const before = { trails: [{ id: "a" }, { id: "b" }], sources: [{ id: "src-0001" }] };
    expect(removedRows(before, { trails: [{ id: "a" }], sources: [] })).toEqual(["trails:b"]);
    expect(removedRows(before, { trails: [{ id: "a" }, { id: "b" }, { id: "c" }] })).toEqual([]);
    expect(removedRows(null, before)).toEqual([]);
  });
});

describe("tag vocabulary", () => {
  it("accepts canonical tags and rejects an alias that points at an alias", () => {
    const t = (id: string, alias_of: string | null) => ({ id, label: id, kind: "feature", alias_of });
    const ok = { schema_version: 1, tags: [t("waterfall", null), t("waterfalls", "waterfall")] };
    expect(validateDoc(ok, "sidecar", FIX, { kind: "vocab" }).errors).toEqual([]);
    const bad = { schema_version: 1, tags: [t("a", null), t("b", "a"), t("c", "b")] };
    const r = validateDoc(bad, "sidecar", FIX, { kind: "vocab" });
    expect(r.errors.map((e) => e.code)).toEqual(["E_FK"]);
  });
});
