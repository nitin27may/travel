import { describe, expect, it } from "vitest";
import { AUTH_METRICS } from "../../src/config/auth-limits.ts";
import { dailyCounts, deliverySignal, formatReadiness, formatStats, readinessProblems, readinessQuery, statsQuery } from "../../src/quota/stats.ts";

const today = new Date("2026-10-25T15:00:00Z");
const row = (bucket: string, day: string, count: number) => ({ bucket, window_start: new Date(`${day}T00:00:00Z`), count });

describe("quota stats", () => {
  it("zero-fills the last N UTC days and sums the three counters", () => {
    const days = dailyCounts(
      [
        row(AUTH_METRICS.sent.bucket, "2026-10-25", 3),
        row(AUTH_METRICS.refused.bucket, "2026-10-25", 1),
        row(AUTH_METRICS.verified.bucket, "2026-10-24", "2" as unknown as number),
        row(AUTH_METRICS.sent.bucket, "2026-10-01", 99), // outside the range
      ],
      today,
      7,
    );
    expect(days.map((d) => d.day)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(days.at(-1)).toEqual({ day: "2026-10-25", sent: 3, refused: 1, verified: 0 });
    expect(days.at(-2)?.verified).toBe(2);
  });

  it("raises the signal for 10 or more sends with fewer than half verified, and not otherwise", () => {
    const mk = (sent: number, verified: number) => dailyCounts([row(AUTH_METRICS.sent.bucket, "2026-10-25", sent), row(AUTH_METRICS.verified.bucket, "2026-10-25", verified)], today, 7);
    expect(deliverySignal(mk(10, 4)).warn).toBe(true);
    expect(deliverySignal(mk(10, 5)).warn).toBe(false);
    expect(deliverySignal(mk(9, 0)).warn).toBe(false);
    expect(formatStats(mk(10, 4))).toContain("SIGNAL");
    expect(formatStats(mk(2, 2))).toContain("no deliverability signal");
  });

  it("queries only the global daily counters from the first day of the range", () => {
    const q = statsQuery(7, today);
    expect(q.sql).toContain("key = ''");
    expect(q.params[1]).toBe("2026-10-19T00:00:00.000Z");
    expect(q.params[0]).toEqual([AUTH_METRICS.sent.bucket, AUTH_METRICS.refused.bucket, AUTH_METRICS.verified.bucket]);
  });
});

describe("quota readiness (quota.ts check, review EML-S SF7)", () => {
  const ready = { table_ok: true, take_ok: true, peek_ok: true, role_ok: true, grant_ok: true };

  it("is ready only with the table, both functions, the role and its grant", () => {
    expect(readinessProblems(ready)).toEqual([]);
    expect(formatReadiness([])).toMatch(/^quota store ready/);
  });

  it("names the missing migration when nothing of 0011 is there", () => {
    const p = readinessProblems({ table_ok: false, take_ok: false, peek_ok: false, role_ok: true, grant_ok: null });
    expect(p).toHaveLength(3);
    expect(p[0]).toContain("0011_quota.sql");
    expect(formatReadiness(p)).toContain("503 GUARD_UNAVAILABLE");
  });

  it("names a missing grant or role, and an empty answer", () => {
    expect(readinessProblems({ ...ready, grant_ok: false })).toEqual(["the app role cannot execute quota_take (0011_quota.sql grants)"]);
    expect(readinessProblems({ ...ready, role_ok: false, grant_ok: null })).toEqual(["the app role is missing (an earlier migration)"]);
    expect(readinessProblems(undefined)).toEqual(["no answer from the database"]);
  });

  it("passes the role as a parameter and reads only the catalogue", () => {
    const q = readinessQuery("travel_app");
    expect(q.params).toEqual(["travel_app"]);
    expect(q.sql).not.toContain("travel_app");
    expect(q.sql).not.toMatch(/from quota_bucket/);
  });
});
