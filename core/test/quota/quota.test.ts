import { describe, expect, it } from "vitest";
import { AUTH_LIMITS } from "../../src/config/auth-limits.ts";
import { ALERT_BUDGET } from "../../src/config/mail.ts";
import { sendOwnerAlert } from "../../src/mail/alert.ts";
import { ownerOnly } from "../../src/mail/mailer.ts";
import { createOutboxMailer } from "../../src/mail/outbox.ts";
import { quotaAlertBudget } from "../../src/quota/alert-budget.ts";
import { addressHash, addressIpHash, assertSecret, ipHash, ipNetwork, utcDay } from "../../src/quota/keys.ts";
import { createMemoryQuotaStore } from "../../src/quota/memory.ts";
import { assertRules, secondsLeft, windowStart, type QuotaRule } from "../../src/quota/store.ts";

const SECRET = "test-secret-0123456789abcdef";
const at = (iso: string) => new Date(iso);

describe("window maths", () => {
  it("aligns windows to UTC", () => {
    const t = Date.UTC(2026, 9, 25, 14, 37, 12) / 1000;
    expect(new Date(windowStart(t, 60) * 1000).toISOString()).toBe("2026-10-25T14:37:00.000Z");
    expect(new Date(windowStart(t, 3600) * 1000).toISOString()).toBe("2026-10-25T14:00:00.000Z");
    expect(new Date(windowStart(t, 900) * 1000).toISOString()).toBe("2026-10-25T14:30:00.000Z");
    expect(new Date(windowStart(t, 86400) * 1000).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });

  it("counts seconds left to the end of the window, at least 1", () => {
    const t = Date.UTC(2026, 9, 25, 14, 59, 30) / 1000;
    expect(secondsLeft(t, 3600)).toBe(30);
    expect(secondsLeft(t + 0.5, 60)).toBe(30);
    expect(secondsLeft(Date.UTC(2026, 9, 25, 15) / 1000, 3600)).toBe(3600);
  });

  it("validates rules before any round trip", () => {
    const ok: QuotaRule = { bucket: "auth:send:addr", key: "a".repeat(32), windowS: 60, limit: 1 };
    expect(() => assertRules([ok])).not.toThrow();
    expect(() => assertRules([])).toThrow();
    expect(() => assertRules(Array(9).fill(ok))).toThrow();
    expect(() => assertRules([{ ...ok, key: "visitor@example.test" }])).toThrow(/key/);
    expect(() => assertRules([{ ...ok, key: "203.0.113.7" }])).toThrow(/key/);
    expect(() => assertRules([{ ...ok, bucket: "Auth Send" }])).toThrow(/bucket/);
    expect(() => assertRules([{ ...ok, windowS: 30 }])).toThrow(/window/);
    expect(() => assertRules([{ ...ok, limit: -1 }])).toThrow(/limit/);
  });
});

describe("keys", () => {
  it("hashes the folded address with the UTC day, 32 hex characters", () => {
    const d = at("2026-10-25T10:00:00Z");
    const k = addressHash(SECRET, "First.Last+x@gmail.com", d);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(addressHash(SECRET, " firstlast@googlemail.com ", d)).toBe(k);
    expect(addressHash(SECRET, "firstlast@gmail.com", at("2026-10-26T10:00:00Z"))).not.toBe(k);
    expect(addressHash("another-secret-0123456789", "firstlast@gmail.com", d)).not.toBe(k);
    expect(addressHash(SECRET, "not an address", d)).toBeNull();
  });

  it("hashes IPs per day, with a shared key for an unknown IP", () => {
    const d = at("2026-10-25T10:00:00Z");
    expect(ipHash(SECRET, "203.0.113.7", d)).toMatch(/^[0-9a-f]{32}$/);
    expect(ipHash(SECRET, "203.0.113.7", d)).not.toContain("203");
    expect(ipHash(SECRET, "", d)).toBe(ipHash(SECRET, "unknown", d));
    expect(ipHash(SECRET, "2001:DB8::1", d)).toBe(ipHash(SECRET, "2001:db8::1", d));
  });

  it("hashes an address and an IP together, apart from either alone (review EML-S SF3)", () => {
    const d = at("2026-10-25T10:00:00Z");
    const k = addressIpHash(SECRET, "First.Last+x@gmail.com", "203.0.113.7", d);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(addressIpHash(SECRET, "firstlast@gmail.com", " 203.0.113.7 ", d)).toBe(k);
    expect(addressIpHash(SECRET, "firstlast@gmail.com", "203.0.113.8", d)).not.toBe(k);
    expect(addressIpHash(SECRET, "other@gmail.com", "203.0.113.7", d)).not.toBe(k);
    expect(addressIpHash(SECRET, "firstlast@gmail.com", "203.0.113.7", at("2026-10-26T10:00:00Z"))).not.toBe(k);
    expect(k).not.toBe(addressHash(SECRET, "firstlast@gmail.com", d));
    expect(k).not.toBe(ipHash(SECRET, "203.0.113.7", d));
    expect(addressIpHash(SECRET, "a@b.com", "", d)).toBe(addressIpHash(SECRET, "a@b.com", "unknown", d));
    expect(addressIpHash(SECRET, "not an address", "203.0.113.7", d)).toBeNull();
    expect(() => addressIpHash("", "a@b.com", "203.0.113.7", d)).toThrow();
  });

  it("keys an IPv6 address on its /64 and an IPv4-mapped one on its IPv4 address (review GSI-S S3)", () => {
    expect(ipNetwork("2001:db8:0:1::1")).toBe("2001:db8:0:1::/64");
    expect(ipNetwork(" 2001:0DB8:0000:0001:ffff:ffff:ffff:ffff ")).toBe("2001:db8:0:1::/64");
    expect(ipNetwork("2001:db8:0:1:a:b:192.0.2.1")).toBe("2001:db8:0:1::/64");
    expect(ipNetwork("2001:db8:0:2::1")).toBe("2001:db8:0:2::/64");
    expect(ipNetwork("fe80::1%en0")).toBe("fe80:0:0:0::/64");
    expect(ipNetwork("::")).toBe("0:0:0:0::/64");
    expect(ipNetwork("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipNetwork("::ffff:cb00:7107")).toBe("203.0.113.7");
    expect(ipNetwork("203.0.113.7")).toBe("203.0.113.7");
    for (const bad of ["", "unknown", "garbage", "2001:db8::1::2", "1:2:3:4:5:6:7:8:9", "203.0.113.256", "::ffff:999.0.0.1"]) expect(ipNetwork(bad), bad).toBe("unknown");
    const d = at("2026-10-25T10:00:00Z");
    // every address inside one /64 shares one key, for the IP bucket and the address-and-IP bucket alike
    const hosts = ["2001:db8:0:1::1", "2001:db8:0:1:dead:beef:0:7", "2001:DB8:0:1:FFFF::"];
    expect(new Set(hosts.map((h) => ipHash(SECRET, h, d))).size).toBe(1);
    expect(new Set(hosts.map((h) => addressIpHash(SECRET, "v@example.test", h, d))).size).toBe(1);
    expect(ipHash(SECRET, "2001:db8:0:2::1", d)).not.toBe(ipHash(SECRET, hosts[0], d));
    expect(ipHash(SECRET, "::ffff:203.0.113.7", d)).toBe(ipHash(SECRET, "203.0.113.7", d));
    expect(ipHash(SECRET, "203.0.113.8", d)).not.toBe(ipHash(SECRET, "203.0.113.7", d));
    expect(ipHash(SECRET, "garbage", d)).toBe(ipHash(SECRET, "unknown", d));
  });

  it("refuses a missing or short secret", () => {
    expect(() => assertSecret(undefined)).toThrow();
    expect(() => assertSecret("short")).toThrow();
    expect(() => addressHash("", "a@b.com", new Date())).toThrow();
    expect(utcDay(at("1970-01-02T00:00:00Z"))).toBe(1);
  });
});

describe("memory store (the semantics quota_take implements)", () => {
  const clock = { now: Date.UTC(2026, 9, 25, 10, 0, 0) };
  const store = createMemoryQuotaStore(() => new Date(clock.now));
  const key = "b".repeat(32);
  const send = (k = key) => AUTH_LIMITS.sendAddr.windows.map((w) => ({ bucket: AUTH_LIMITS.sendAddr.bucket, key: k, ...w }));

  it("admits 1 per 60 s, 4 per hour and 8 per day per address", async () => {
    clock.now = Date.UTC(2026, 9, 25, 10, 0, 0);
    const outcomes: boolean[] = [];
    for (let m = 0; m < 24 * 60; m += 1) {
      clock.now = Date.UTC(2026, 9, 25, 0, 0, 0) + m * 60_000;
      outcomes.push((await store.take(send())).allowed);
      if (m % 60 === 0) outcomes.push((await store.take(send())).allowed); // a second call in the same minute
    }
    // 4 per hour over 24 hours would be 96; the daily 8 wins.
    expect(outcomes.filter(Boolean)).toHaveLength(8);
  });

  it("rolls over at the window edge and reports when", async () => {
    const k = "c".repeat(32);
    clock.now = Date.UTC(2026, 9, 25, 10, 59, 50);
    expect((await store.take(send(k))).allowed).toBe(true);
    const second = await store.take(send(k));
    expect(second.allowed).toBe(false);
    if (!second.allowed) expect(second.retryAfterS).toBe(10);
    clock.now = Date.UTC(2026, 9, 25, 11, 0, 0);
    expect((await store.take(send(k))).allowed).toBe(true);
  });

  it("is all or nothing across buckets", async () => {
    const s = createMemoryQuotaStore(() => new Date(clock.now));
    const rules: QuotaRule[] = [
      { bucket: "a:b", key: "", windowS: 60, limit: 1 },
      { bucket: "a:c", key: "", windowS: 3600, limit: 5 },
    ];
    await s.take(rules);
    const r = await s.take(rules);
    expect(r).toMatchObject({ allowed: false, failed: 0, counts: [1, 1] });
    expect(s.rows().find((x) => x.bucket === "a:c")?.count).toBe(1);
  });

  it("counts null-limit rules without refusing", async () => {
    const s = createMemoryQuotaStore(() => new Date(clock.now));
    for (let i = 0; i < 50; i++) expect((await s.take([{ bucket: "m:x", key: "", windowS: 86400, limit: null }])).allowed).toBe(true);
    expect(await s.peek("m:x", 86400, new Date(clock.now))).toBe(50);
  });

  it("admits exactly the limit under 20 parallel calls", async () => {
    const s = createMemoryQuotaStore(() => new Date(clock.now));
    const res = await Promise.all(Array.from({ length: 20 }, () => s.take([{ bucket: "p:x", key: "", windowS: 3600, limit: 6 }])));
    expect(res.filter((r) => r.allowed)).toHaveLength(6);
  });
});

describe("quotaAlertBudget", () => {
  it("stops owner alerts at 20 a day and reports the dropped count the next day", async () => {
    const clock = { now: Date.UTC(2026, 9, 25, 0, 5, 0) };
    const store = createMemoryQuotaStore(() => new Date(clock.now));
    const budget = quotaAlertBudget(store, () => new Date(clock.now));
    const box = createOutboxMailer({});
    const mailer = ownerOnly(box, { ownerEmail: "owner@example.test", mailFrom: undefined });
    const deps = () => ({ mailer, budget, ownerEmail: "owner@example.test", now: new Date(clock.now) });
    let sent = 0;
    for (let h = 0; h < 24; h++) {
      clock.now = Date.UTC(2026, 9, 25, h, 5, 0);
      if ((await sendOwnerAlert({ kind: "auth-send-failures", failures: 3 }, deps())).sent) sent++;
    }
    expect(sent).toBe(ALERT_BUDGET.perDay);
    expect(await store.peek(ALERT_BUDGET.droppedBucket, 86400, new Date(clock.now))).toBe(4);
    clock.now = Date.UTC(2026, 9, 26, 0, 5, 0);
    expect((await sendOwnerAlert({ kind: "auth-global-cap", limit: 30, window: "day" }, deps())).sent).toBe(true);
    expect(box.sent.at(-1)?.text).toContain("4 alerts were not sent yesterday");
    // A duplicate in its window neither mails nor uses the budget.
    expect(await sendOwnerAlert({ kind: "auth-global-cap", limit: 30, window: "day" }, deps())).toEqual({ sent: false, reason: "duplicate" });
    expect(await store.peek(ALERT_BUDGET.bucket, 86400, new Date(clock.now))).toBe(1);
  });
});
