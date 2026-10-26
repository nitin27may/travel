// Review NAV-C C2, mirrored for favourites/1: the raw zod objects of ../../src/schema/favourites.ts do not hold the cross-field rules
// (one row per page and per ref, a trip has no kind, the byte bound, MERGED_MAX), so a bare `.parse` or `.safeParse` on them accepts what
// the rules refuse. Only the parsing entry points may call them: core/src/favourites/envelope.ts and core/src/favourites/resolve.ts.
// Tests are exempt (they check the raw schemas on purpose).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const RAW = ["favItem", "favPending", "favouritesEnvelope", "favRef", "mergeItem", "mergeInput", "accountFavourite", "mergeAnswer", "resolveRow", "resolveAnswer", "resolveQuery", "resolveInput"];
const ALLOWED = new Set(["core/src/favourites/envelope.ts", "core/src/favourites/resolve.ts"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".og-cache", "tests", "e2e", "test"]);

/** `name.parse(`, `name.safeParse(` and the async forms, also through a wrapper such as `z.array(name).max(500).safeParse(`. */
export const BARE = new RegExp(
  `\\b(?:${RAW.join("|")})\\b(?:\\s*\\))?(?:\\s*\\.\\s*(?:max|min|nullable|optional|array)\\([^()]*\\))*(?:\\s*\\))?\\s*\\.\\s*(?:safeParse|parse|safeParseAsync|parseAsync|decode|safeDecode)\\s*\\(`,
);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...files(p));
    else if (/\.(?:ts|tsx|mts|js|mjs)$/.test(name) && !/\.test\.|\.spec\./.test(name)) out.push(p);
  }
  return out;
}

describe("favourites schemas are parsed only through their entry points (review C2)", () => {
  it("the pattern catches the forms it must", () => {
    for (const bad of ["favItem.parse(x)", "favouritesEnvelope.safeParse(x)", "z.array(mergeItem).max(500).safeParse(body)", "mergeAnswer .safeParseAsync(a)", "accountFavourite.parse (r)"]) expect(BARE.test(bad), bad).toBe(true);
    for (const fine of ["parseFavourites(x)", "parseMergeItems(body)", "favItemCount.parse(x)", "JSON.parse(raw)"]) expect(BARE.test(fine), fine).toBe(false);
  });

  it("no file in core/src or web calls one bare", () => {
    const hits: string[] = [];
    for (const top of ["core/src", "web"]) {
      for (const f of files(join(ROOT, top))) {
        const rel = relative(ROOT, f);
        if (ALLOWED.has(rel)) continue;
        const text = readFileSync(f, "utf8");
        text.split("\n").forEach((line, i) => {
          if (BARE.test(line)) hits.push(`${rel}:${i + 1}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
