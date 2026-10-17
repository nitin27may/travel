import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCATION_TABLES } from "../../src/schema/locations.ts";
import { columnsOf } from "./helpers.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function pythonColumns(): Record<string, [string, string, boolean][]> {
  const code = `import sys,json; sys.path.insert(0,${JSON.stringify(ROOT + "tools")}); import locations as D; print(json.dumps(D.COLUMNS))`;
  const r = spawnSync("python3", ["-c", code], { encoding: "utf8" });
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout);
}

describe("locations v2 parity with tools/locations.py COLUMNS", () => {
  const py = pythonColumns();

  it("has the same tables", () => {
    expect(LOCATION_TABLES.map((t) => t.name).sort()).toEqual(Object.keys(py).sort());
  });

  for (const t of LOCATION_TABLES) {
    it(`${t.name}: same column names, order, types and nullability`, () => {
      const zod = columnsOf(t).map((c) => [c.name, c.type, c.nullable]);
      expect(zod).toEqual(py[t.name]);
    });
  }
});
