// The per-user quota key (`userHash`, EM-1's `plans:write` bucket): 32 hex, keyed by the secret, the scope and the UTC day, never the
// raw id, and never equal to another scope's key for the same text.
import { describe, expect, it } from "vitest";
import { ipHash, userHash } from "../../src/quota/keys.ts";
import { KEY_RE } from "../../src/quota/store.ts";

const S = "s".repeat(32);
const DAY = new Date("2026-10-27T12:00:00Z");

describe("userHash", () => {
  it("is a 32-hex key the quota table accepts, without the id in it", () => {
    const k = userHash(S, "user-123", DAY);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(KEY_RE.test(k)).toBe(true);
    expect(k).not.toContain("user");
  });

  it("is stable within a UTC day and changes with the day, the user and the secret", () => {
    expect(userHash(S, "u", DAY)).toBe(userHash(S, "u", new Date("2026-10-27T23:59:59Z")));
    expect(userHash(S, "u", DAY)).not.toBe(userHash(S, "u", new Date("2026-10-28T00:00:00Z")));
    expect(userHash(S, "u", DAY)).not.toBe(userHash(S, "v", DAY));
    expect(userHash(S, "u", DAY)).not.toBe(userHash("t".repeat(32), "u", DAY));
  });

  it("is scoped: the same text as an IP gives another key", () => {
    expect(userHash(S, "203.0.113.9", DAY)).not.toBe(ipHash(S, "203.0.113.9", DAY));
  });

  it("refuses a short secret and an empty id", () => {
    expect(() => userHash("short", "u", DAY)).toThrow(/AUTH_QUOTA_SECRET/);
    expect(() => userHash(S, "", DAY)).toThrow();
  });
});
