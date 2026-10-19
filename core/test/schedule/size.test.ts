import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The scheduler ships in the trip page bundle (spec D2): under 13 kB gzipped, fully minified (an iife build, because Vite
// keeps whitespace in ES library output). browser.ts is the entry the page imports; the planner mapping stays out of it.
// The limit went from 12 to 13 kB once, for lanes, the sun anchor and the leg ladder (design review L3c). Do not raise it again:
// trim the scheduler first, and only then argue for more.
describe("bundle size", () => {
  it("the page entry of core/src/schedule is under 13 kB gzip", async () => {
    const req = createRequire(import.meta.url);
    const vite = createRequire(req.resolve("vitest/package.json"))("vite") as { build(config: unknown): Promise<unknown> };
    const entry = fileURLToPath(new URL("../../src/schedule/browser.ts", import.meta.url));
    const out = (await vite.build({
      logLevel: "silent",
      configFile: false,
      build: { write: false, minify: true, lib: { entry, formats: ["iife"], name: "schedule", fileName: "schedule" } },
    })) as { output: { code: string }[] }[] | { output: { code: string }[] };
    const chunks = Array.isArray(out) ? out.flatMap((o) => o.output) : out.output;
    const code = chunks.map((c) => c.code).join("\n");
    const gz = gzipSync(code).length;
    expect(code.length).toBeGreaterThan(5000);
    expect(gz, `schedule bundle is ${gz} bytes gzipped`).toBeLessThan(13 * 1024);
  }, 60000);
});
