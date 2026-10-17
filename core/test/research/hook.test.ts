import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FIXROOT, REPO } from "../catalog/util.ts";

const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), "p4b-hook-"));
  tmp.push(root);
  mkdirSync(join(root, "tools/hooks"), { recursive: true });
  cpSync(join(REPO, "tools/hooks/research_changed.sh"), join(root, "tools/hooks/research_changed.sh"));
  chmodSync(join(root, "tools/hooks/research_changed.sh"), 0o755);
  symlinkSync(join(REPO, "core"), join(root, "core"));
  cpSync(join(FIXROOT, "research"), join(root, "research"), { recursive: true });
  cpSync(join(FIXROOT, "data"), join(root, "data"), { recursive: true });
  return root;
}

const run = (root: string, file: string) =>
  spawnSync("bash", [join(root, "tools/hooks/research_changed.sh")], { input: JSON.stringify({ tool_input: { file_path: file } }), encoding: "utf8" });

describe("research_changed.sh", () => {
  it("validates a sidecar, passes, and refreshes research/INDEX.json", () => {
    const root = sandbox();
    const r = run(root, join(root, "research/trips/patagonia-fixture/trails.json"));
    expect([r.status, r.stdout]).toEqual([0, ""]);
    expect(JSON.parse(readFileSync(join(root, "research/INDEX.json"), "utf8")).sidecars.length).toBe(10);
  });

  it("exits 2 with the validator's ERROR lines for a broken sidecar, and does not index it", () => {
    const root = sandbox();
    const f = join(root, "research/trips/patagonia-fixture/trails.json");
    const doc = JSON.parse(readFileSync(f, "utf8"));
    delete doc.lane;
    writeFileSync(f, JSON.stringify(doc));
    const r = run(root, f);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/research sidecar failed validation/);
    expect(r.stdout).toMatch(/^ERROR /m);
    expect(existsSync(join(root, "research/INDEX.json"))).toBe(false);
  });

  it("is silent for files it does not own: other JSON, the inbox, INDEX.json, markdown", () => {
    const root = sandbox();
    mkdirSync(join(root, "research/inbox"), { recursive: true });
    writeFileSync(join(root, "research/inbox/x.json"), "{}");
    writeFileSync(join(root, "research/trips/rockies-fixture/photos.json"), "{\"photos\": []}");
    for (const p of [join(root, "research/inbox/x.json"), join(root, "research/trips/rockies-fixture/photos.json"), join(root, "research/INDEX.json"), join(root, "research/trips/x/trails.md"), "/x/data/trips/x/trip.json", ""]) {
      const r = run(root, p);
      expect([p, r.status, r.stdout]).toEqual([p, 0, ""]);
    }
  });
});
