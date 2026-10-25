// The guard and the contract are pure so the local target resolver, the seed engine and a server can import them: only io.ts may
// read the machine, and nothing under core/src/seed opens a database connection.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../src/seed/", import.meta.url));
const IMPURE = new Set(["io.ts"]);
const imports = (src: string): string[] => [...src.matchAll(/\bfrom\s*(['"])([^'"\n]+)\1|\bimport\s*\(\s*(['"])([^'"\n]+)\3/g)].map((m) => m[2] ?? m[4]!);

describe("core/src/seed purity", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".ts"));

  it("only io.ts touches the filesystem, processes or the OS", () => {
    for (const f of files) {
      if (IMPURE.has(f)) continue;
      const bad = imports(readFileSync(DIR + f, "utf8")).filter((s) => /^(node:)?(fs|child_process|os|path|net|tls)(\/|$)/.test(s));
      expect(bad, f).toEqual([]);
    }
  });

  it("no module imports the database client or reads the environment", () => {
    for (const f of files) {
      const src = readFileSync(DIR + f, "utf8");
      expect(imports(src).filter((s) => /db\/client|(^|\/)pg$/.test(s)), f).toEqual([]);
      expect(src, f).not.toMatch(/process\.env/);
    }
  });
});
