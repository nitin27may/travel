import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// HYG (48dca1d) deleted decision blocks A29 to A40 from store.ts while rewriting A16 and A28, and the code kept citing them.
// Every decision cited as `A<number>` in the catalogue and privacy sources must be defined in store.ts's own list.

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const STORE = join(ROOT, "core/src/catalogue/store.ts");
const SCAN = ["core/src/catalogue", "core/src/privacy"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const storeText = readFileSync(STORE, "utf8");
const defined = new Set([...storeText.matchAll(/^\/\/ (A\d{1,2})\s/gm)].map((m) => m[1]!));

describe("store.ts decision list", () => {
  it("defines A1 to A40 without a gap", () => {
    for (let i = 1; i <= 40; i++) expect(defined.has(`A${i}`), `A${i} is not defined in store.ts`).toBe(true);
  });
  it("defines every decision that a comment in catalogue or privacy cites", () => {
    const missing: string[] = [];
    for (const dir of SCAN) {
      for (const f of walk(join(ROOT, dir))) {
        for (const m of readFileSync(f, "utf8").matchAll(/\bA(\d{1,2})\b/g)) {
          if (!defined.has(`A${m[1]}`)) missing.push(`${f.slice(ROOT.length + 1)}: A${m[1]}`);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
