import { describe, expect, it, vi } from "vitest";
import { disabledMailer, invalidMessage, ownerOnly, type Mailer } from "../../src/mail/mailer.ts";
import { createOutboxMailer, OutboxRefusedError } from "../../src/mail/outbox.ts";

const OWNER = "owner@example.test";
const msg = (to: string) => ({ to, subject: "Hello", text: "Body" });

function spy(): Mailer & { calls: number } {
  const m = { kind: "spy", calls: 0, send: vi.fn(async () => ({ ok: true as const, id: "x" })) };
  m.send.mockImplementation(async () => {
    m.calls++;
    return { ok: true as const, id: "x" };
  });
  return m;
}

describe("ownerOnly recipient guard", () => {
  it("refuses any recipient other than OWNER_EMAIL while MAIL_FROM is unset, before the adapter is called", async () => {
    const inner = spy();
    const guarded = ownerOnly(inner, { ownerEmail: OWNER, mailFrom: undefined });
    for (const to of ["visitor@example.test", "owner+x@example.test", "OWNER@example.test.evil", "delivered@resend.dev"]) {
      expect(await guarded.send(msg(to))).toEqual({ ok: false, reason: "recipient" });
    }
    expect(inner.calls).toBe(0);
  });

  it("lets the owner through, in any case and with spaces", async () => {
    const inner = spy();
    const guarded = ownerOnly(inner, { ownerEmail: ` ${OWNER.toUpperCase()} `, mailFrom: "  " });
    expect((await guarded.send(msg(OWNER))).ok).toBe(true);
    expect(inner.calls).toBe(1);
  });

  it("refuses everything when OWNER_EMAIL is unset", async () => {
    const inner = spy();
    const guarded = ownerOnly(inner, { ownerEmail: undefined, mailFrom: undefined });
    expect(await guarded.send(msg(OWNER))).toEqual({ ok: false, reason: "recipient" });
    expect(inner.calls).toBe(0);
  });

  it("allows other recipients once MAIL_FROM (a verified sender) is set (Phase 2)", async () => {
    const inner = spy();
    const guarded = ownerOnly(inner, { ownerEmail: OWNER, mailFrom: "Trip Plans <no-reply@mail.example.test>" });
    expect((await guarded.send(msg("visitor@example.test"))).ok).toBe(true);
  });
});

describe("invalidMessage", () => {
  it("refuses header injection in the subject, empty parts and a bad idempotency key", () => {
    expect(invalidMessage({ to: OWNER, subject: "a\r\nBcc: x@y.z", text: "b" })).toBe(true);
    expect(invalidMessage({ to: OWNER, subject: " ", text: "b" })).toBe(true);
    expect(invalidMessage({ to: OWNER, subject: "a", text: "" })).toBe(true);
    expect(invalidMessage({ to: "a@b.com, c@d.com", subject: "a", text: "b" })).toBe(true);
    expect(invalidMessage({ to: OWNER, subject: "a", text: "b", idempotencyKey: "has space" })).toBe(true);
    expect(invalidMessage({ to: OWNER, subject: "a", text: "b", idempotencyKey: "k".repeat(257) })).toBe(true);
    expect(invalidMessage({ to: OWNER, subject: "a", text: "b", idempotencyKey: "alert-x-1" })).toBe(false);
  });
});

describe("disabledMailer", () => {
  it("refuses with config", async () => {
    expect(await disabledMailer().send(msg(OWNER))).toEqual({ ok: false, reason: "config" });
  });
});

describe("outbox adapter", () => {
  it("is refused when VERCEL_ENV is production", () => {
    expect(() => createOutboxMailer({ VERCEL_ENV: "production" })).toThrow(OutboxRefusedError);
  });

  it("is allowed on preview and outside Vercel", () => {
    expect(createOutboxMailer({ VERCEL_ENV: "preview" }).kind).toBe("outbox");
    expect(createOutboxMailer({}).kind).toBe("outbox");
  });

  it("keeps messages and honours idempotency keys", async () => {
    const box = createOutboxMailer({});
    await box.send({ ...msg(OWNER), idempotencyKey: "k1" });
    await box.send({ ...msg(OWNER), idempotencyKey: "k1" });
    await box.send(msg(OWNER));
    expect(box.sent).toHaveLength(2);
    box.clear();
    expect(box.sent).toHaveLength(0);
  });

  it("refuses an invalid message", async () => {
    expect(await createOutboxMailer({}).send({ to: "x", subject: "s", text: "t" })).toEqual({ ok: false, reason: "invalid" });
  });
});
