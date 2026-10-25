import { describe, expect, it } from "vitest";
import { ALERT_BUDGET, SUBJECT_MAX } from "../../src/config/mail.ts";
import { renderAlert, sendOwnerAlert, type AlertBudget, type AlertEvent, type AlertKind, type BudgetClaim } from "../../src/mail/alert.ts";
import { ownerOnly } from "../../src/mail/mailer.ts";
import { createOutboxMailer } from "../../src/mail/outbox.ts";

const OWNER = "owner@example.test";

/** A budget with the documented semantics, over a clock the test moves: once per kind per window, 20 a day, dropped counted. */
function testBudget(clock: { now: number }): AlertBudget & { dropped: Map<number, number> } {
  const once = new Map<string, number>();
  const perDay = new Map<number, number>();
  const dropped = new Map<number, number>();
  return {
    dropped,
    async claim(kind: AlertKind, windowS: number): Promise<BudgetClaim> {
      const t = Math.floor(clock.now / 1000);
      const slot = `${kind}:${Math.floor(t / windowS)}`;
      if (once.has(slot)) return { allowed: false, reason: "duplicate" };
      const day = Math.floor(t / 86400);
      const used = perDay.get(day) ?? 0;
      if (used >= ALERT_BUDGET.perDay) {
        dropped.set(day, (dropped.get(day) ?? 0) + 1);
        return { allowed: false, reason: "cap" };
      }
      once.set(slot, 1);
      perDay.set(day, used + 1);
      return { allowed: true, firstToday: used === 0, droppedYesterday: dropped.get(day - 1) ?? 0 };
    },
  };
}

const events: AlertEvent[] = [
  { kind: "auth-sender-refused", status: 429, refusedToday: 1 },
  { kind: "auth-send-failures", failures: 3 },
  { kind: "auth-global-cap", limit: 30, window: "day" },
];

describe("renderAlert", () => {
  it.each(events)("renders %j as plain text with a short subject", (e) => {
    const r = renderAlert(e);
    expect(r).not.toBeNull();
    expect(r!.subject.length).toBeLessThanOrEqual(SUBJECT_MAX);
    expect(r!.subject).toMatch(/^\[Trip Plans alert\] /);
    expect(r!.text).not.toMatch(/<[a-z]/i);
    expect(r!.text).toContain("quota stats");
  });

  it("refuses fields that are not whole numbers, so no string can ride in a count", () => {
    const planted = "visitor@example.test 482913";
    expect(renderAlert({ kind: "auth-sender-refused", status: planted as unknown as number, refusedToday: 1 })).toBeNull();
    expect(renderAlert({ kind: "auth-send-failures", failures: 1.5 })).toBeNull();
    expect(renderAlert({ kind: "auth-global-cap", limit: 30, window: planted as "day" })).toBeNull();
    expect(renderAlert({ kind: "nope" } as unknown as AlertEvent)).toBeNull();
  });

  it("never holds a planted visitor address, name or code, even when one is smuggled into the event object", () => {
    const smuggled = { kind: "auth-send-failures", failures: 3, email: "visitor@example.test", name: "Click here http://evil", otp: "482913" } as unknown as AlertEvent;
    const r = renderAlert(smuggled)!;
    for (const s of ["visitor@example.test", "Click here", "evil", "482913"]) {
      expect(r.subject + r.text).not.toContain(s);
    }
  });
});

describe("sendOwnerAlert", () => {
  const setup = () => {
    const clock = { now: Date.UTC(2026, 9, 25, 10, 0, 0) };
    const box = createOutboxMailer({});
    const mailer = ownerOnly(box, { ownerEmail: OWNER, mailFrom: undefined });
    const budget = testBudget(clock);
    const deps = () => ({ mailer, budget, ownerEmail: OWNER, now: new Date(clock.now) });
    return { clock, box, budget, deps };
  };

  it("mails the owner once per kind and window", async () => {
    const { box, deps, clock } = setup();
    expect(await sendOwnerAlert(events[0], deps())).toEqual({ sent: true });
    expect(await sendOwnerAlert(events[0], deps())).toEqual({ sent: false, reason: "duplicate" });
    expect(box.sent).toHaveLength(1);
    expect(box.sent[0].to).toBe(OWNER);
    expect(box.sent[0].idempotencyKey).toMatch(/^alert-auth-sender-refused-\d+$/);
    // The hourly kind mails again in the next hour.
    expect(await sendOwnerAlert(events[1], deps())).toEqual({ sent: true });
    clock.now += 3600_000;
    expect(await sendOwnerAlert(events[1], deps())).toEqual({ sent: true });
    expect(box.sent).toHaveLength(3);
  });

  it("stops at 20 a day and reports yesterday's dropped count in the first alert of the next day", async () => {
    const { box, deps, clock } = setup();
    let sent = 0;
    let capped = 0;
    for (let h = 0; h < 24; h++) {
      clock.now = Date.UTC(2026, 9, 25, h, 5, 0);
      const r = await sendOwnerAlert(events[1], deps());
      if (r.sent) sent++;
      else if (r.reason === "cap") capped++;
    }
    expect(sent).toBe(ALERT_BUDGET.perDay);
    expect(capped).toBe(24 - ALERT_BUDGET.perDay);
    clock.now = Date.UTC(2026, 9, 26, 0, 5, 0);
    expect(await sendOwnerAlert(events[1], deps())).toEqual({ sent: true });
    const first = box.sent[box.sent.length - 1];
    expect(first.text).toContain(`${24 - ALERT_BUDGET.perDay} alerts were not sent yesterday`);
    // Only the first alert of the day carries the line.
    clock.now = Date.UTC(2026, 9, 26, 1, 5, 0);
    await sendOwnerAlert(events[1], deps());
    expect(box.sent[box.sent.length - 1].text).not.toContain("were not sent yesterday");
  });

  it("refuses without OWNER_EMAIL, and when the budget is unavailable", async () => {
    const { deps } = setup();
    expect(await sendOwnerAlert(events[0], { ...deps(), ownerEmail: undefined })).toEqual({ sent: false, reason: "config" });
    const broken: AlertBudget = { claim: async () => Promise.reject(new Error("db down")) };
    expect(await sendOwnerAlert(events[0], { ...deps(), budget: broken })).toEqual({ sent: false, reason: "budget_unavailable" });
  });

  it("passes the recipient guard's refusal through when OWNER_EMAIL is not the guard's owner", async () => {
    const { deps } = setup();
    const r = await sendOwnerAlert(events[2], { ...deps(), ownerEmail: "someone-else@example.test" });
    expect(r).toEqual({ sent: false, reason: "recipient" });
  });
});
