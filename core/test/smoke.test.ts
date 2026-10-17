import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

describe("core package", () => {
  it("runs the schema CLI help under type stripping with no warning", () => {
    const bin = fileURLToPath(new URL("../bin/schema.ts", import.meta.url));
    const r = spawnSync("node", [bin, "--help"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Usage");
    expect(r.stderr).toBe("");
  });
});
