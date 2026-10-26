import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Review NAV-C C2: the raw zod objects of copies/1 and trip-custom/1 do not hold the cross-field rules (size, 60 overrides, unique
// ids, one copy per trip, unique op ids), so a bare `.parse` or `.safeParse` on them skips those rules. Every caller goes through
// parseCopy, parseCopyList, parseEnvelope, readCopies, parseTripCustom or readTripCustom. This test fails on a bare call, or on an
// aliased import of a raw schema, anywhere in core/src or web/ outside the two files that define the helpers.
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCAN = ["core/src", "web"];
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".og-cache", "data-snapshots", "public", ".turbo"]);
const ALLOWED = new Set(["core/src/schema/copies.ts", "core/src/schema/trip-custom.ts"]);

const RAW = "copyItem|copiesEnvelope|tripCustom|copyAdded|customAdded";
/** `copyItem.parse(`, `tripCustom .safeParse(`, `copiesEnvelope.parseAsync(`, `.decode(` and friends. */
export const BARE_CALL = new RegExp(`\\b(?:${RAW})\\s*\\.\\s*(?:safeParse|parse|parseAsync|safeParseAsync|spa|decode|safeDecode|decodeAsync|safeDecodeAsync)\\s*\\(`);
/** `import { copyItem as x }`: an alias would hide the call from BARE_CALL. */
export const ALIASED = new RegExp(`\\b(?:${RAW})\\s+as\\s+\\w`);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

describe("copies/1 and trip-custom/1 are parsed only through their helpers", () => {
  it("the patterns catch what they must and spare the helpers", () => {
    for (const bad of ["copyItem.parse(x)", "copiesEnvelope.safeParse(x)", "tripCustom .safeParse(x)", "copyItem.parseAsync(x)", "tripCustom.decode(x)"]) expect(BARE_CALL.test(bad), bad).toBe(true);
    expect(ALIASED.test("import { copyItem as item } from '@travel/core/schema/copies.ts'")).toBe(true);
    for (const ok of ["parseCopy(x)", "parseEnvelope(x)", "parseTripCustom(x)", "readCopies(raw)", "z.toJSONSchema(copyItem)", "tripCustomRules(d)", "myCopyItem.parse(x)"]) {
      expect(BARE_CALL.test(ok), ok).toBe(false);
    }
  });

  it("no file in core/src or web/ calls .parse or .safeParse on a raw schema, or aliases one", () => {
    const hits: string[] = [];
    const seen: Record<string, number> = {};
    for (const dir of SCAN) {
      const list = files(path.join(ROOT, dir));
      seen[dir] = list.length;
      for (const f of list) {
        const rel = path.relative(ROOT, f).split(path.sep).join("/");
        if (ALLOWED.has(rel)) continue;
        const text = readFileSync(f, "utf8");
        text.split("\n").forEach((line, i) => {
          if (BARE_CALL.test(line) || ALIASED.test(line)) hits.push(`${rel}:${i + 1}`);
        });
      }
    }
    // the scan reached both trees (a wrong ROOT would pass vacuously)
    expect(seen["core/src"]).toBeGreaterThan(100);
    expect(seen["web"]).toBeGreaterThan(100);
    expect(hits, "use parseCopy, parseCopyList, parseEnvelope, readCopies, parseTripCustom or readTripCustom").toEqual([]);
  });
});
