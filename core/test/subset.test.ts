import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// These Zod features do not export to JSON Schema, so schema files must not use them (plan 2.5).
// Cross-field rules belong in `meta.rules`, implemented by the validator.
const BANNED = [".transform(", ".refine(", ".superRefine(", ".preprocess(", "z.lazy(", "z.custom("];
const SCHEMA_DIR = fileURLToPath(new URL("../src/schema/", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("schema subset rule", () => {
  const all = files(SCHEMA_DIR);

  it("finds the schema files", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  for (const word of BANNED) {
    it(`no schema file uses ${word}`, () => {
      const hits = all.filter((f) => readFileSync(f, "utf8").includes(word)).map((f) => f.slice(SCHEMA_DIR.length));
      expect(hits, `${word} does not export to JSON Schema; use meta.rules and the validator`).toEqual([]);
    });
  }
});
