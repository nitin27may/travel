import { describe, expect, it } from "vitest";
import { icsText } from "../../src/export/ics.ts";
import { accountPlanPut } from "../../src/schema/api/account-plans.ts";
import { copyItem } from "../../src/schema/copies.ts";
import { parsePlanDraft } from "../../src/schema/plan-draft.ts";
import { sampleDraft } from "./helpers.ts";

// Review STEP2-ES ES-009: a title goes into calendar names (X-WR-CALNAME) and file names, so it holds no control character, and the
// ICS text escape turns every line break, a lone CR included, into `\n` so no title can start a property of its own.
describe("titles hold no control characters (ES-009)", () => {
  const bad = ["Rockies\rX-INJECT:1", "Rockies\nX", "Rockies\u0000", "Rockies\u001b[31m", "Rockies\u007f"];

  it("plan-draft/1 refuses one in the title and keeps a plain one", () => {
    expect(parsePlanDraft(sampleDraft({ title: "Rockies with Emma: 2029, part 1" })).success).toBe(true);
    for (const t of bad) expect(parsePlanDraft(sampleDraft({ title: t })).success, JSON.stringify(t)).toBe(false);
  });

  it("copies/1 and the account PUT refuse one", () => {
    const item = {
      id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", slug: "dolomites-2027", title: "Dolomites", days: 14, cc: "IT", photo: null, start: "2027-07-03",
      adults: 2, children: [6], profile: null, overrides: {}, added: [], copiedAt: "2026-10-20T10:00:00.000Z",
    };
    expect(copyItem.safeParse(item).success).toBe(true);
    for (const t of bad) expect(copyItem.safeParse({ ...item, title: t }).success, JSON.stringify(t)).toBe(false);
    const put = { base: 0, title: "Dolomites", doc: { schema: "plan-draft/1" } };
    expect(accountPlanPut.safeParse(put).success).toBe(true);
    for (const t of bad) expect(accountPlanPut.safeParse({ ...put, title: t }).success, JSON.stringify(t)).toBe(false);
  });
});

describe("icsText (ES-009)", () => {
  it("escapes CRLF, a lone CR and a lone LF as \\n, and drops other control characters", () => {
    expect(icsText("a\r\nb\rc\nd")).toBe("a\\nb\\nc\\nd");
    expect(icsText("Rockies\rX-INJECT:1")).not.toMatch(/[\r\n]/);
    expect(icsText("a\u0000b\u001bc\u007fd")).toBe("abcd");
    expect(icsText("tab\there")).toBe("tab\there");
    expect(icsText("a;b,c\\d")).toBe("a\\;b\\,c\\\\d");
  });
});
