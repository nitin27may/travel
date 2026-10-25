import { describe, expect, it } from "vitest";
import { RESEND, SANDBOX_FROM } from "../../src/config/mail.ts";
import { createResendMailer } from "../../src/mail/resend.ts";

const KEY = "re_test_SECRET_value_123";
const OWNER = "owner@example.test";

type Call = { url: string; init: RequestInit };

function fakeFetch(answer: (call: Call) => Response | Promise<Response>): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return answer(call);
  }) as typeof fetch;
  return { fetch: f, calls };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Resend adapter", () => {
  it("posts one plain-text message with the bearer key and the idempotency key", async () => {
    const f = fakeFetch(() => json(200, { id: "msg_1" }));
    const m = createResendMailer({ apiKey: KEY, from: SANDBOX_FROM, fetch: f.fetch });
    const res = await m.send({ to: ` ${OWNER} `, subject: "Hi", text: "Body", idempotencyKey: "alert-x-1" });
    expect(res).toEqual({ ok: true, id: "msg_1" });
    expect(f.calls).toHaveLength(1);
    const { url, init } = f.calls[0];
    expect(url).toBe(RESEND.url);
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${KEY}`);
    expect(h["Idempotency-Key"]).toBe("alert-x-1");
    expect(JSON.parse(String(init.body))).toEqual({ from: SANDBOX_FROM, to: [OWNER], subject: "Hi", text: "Body" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("omits the idempotency header when no key is given", async () => {
    const f = fakeFetch(() => json(200, { id: "msg_2" }));
    await createResendMailer({ apiKey: KEY, from: SANDBOX_FROM, fetch: f.fetch }).send({ to: OWNER, subject: "a", text: "b" });
    expect((f.calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();
  });

  it.each([
    [429, { name: "daily_quota_exceeded" }, "quota"],
    [429, { name: "rate_limit_exceeded" }, "rate_limited"],
    [409, { name: "invalid_idempotent_request" }, "conflict"],
    [403, { name: "validation_error", message: `You can only send testing emails to your own email address (${OWNER})` }, "rejected"],
    [401, { name: "missing_api_key" }, "rejected"],
    [422, { name: "validation_error" }, "rejected"],
    [500, { name: "internal_server_error" }, "unavailable"],
    [503, "not json", "unavailable"],
  ] as const)("maps HTTP %i %j to %s", async (status, body, reason) => {
    const f = fakeFetch(() => (typeof body === "string" ? new Response(body, { status }) : json(status, body)));
    const res = await createResendMailer({ apiKey: KEY, from: SANDBOX_FROM, fetch: f.fetch }).send({ to: OWNER, subject: "a", text: "b" });
    expect(res).toEqual({ ok: false, reason, status });
    // No secret, recipient or provider message in the result.
    expect(JSON.stringify(res)).not.toMatch(/re_test|owner@|testing emails/);
  });

  it("times out after the configured budget", async () => {
    const f = fakeFetch(
      (call) =>
        new Promise<Response>((_, reject) => {
          call.init.signal?.addEventListener("abort", () => reject(call.init.signal?.reason));
        }),
    );
    const started = Date.now();
    const res = await createResendMailer({ apiKey: KEY, from: SANDBOX_FROM, fetch: f.fetch, timeoutMs: 50 }).send({ to: OWNER, subject: "a", text: "b" });
    expect(res).toEqual({ ok: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("uses a 3 s timeout by default", () => {
    expect(RESEND.timeoutMs).toBe(3000);
  });

  it("reports a network failure without the error text", async () => {
    const f = fakeFetch(() => {
      throw new TypeError(`fetch failed for ${KEY}`);
    });
    const res = await createResendMailer({ apiKey: KEY, from: SANDBOX_FROM, fetch: f.fetch }).send({ to: OWNER, subject: "a", text: "b" });
    expect(res).toEqual({ ok: false, reason: "network" });
  });

  it("refuses without a key or sender, and an invalid message, without calling fetch", async () => {
    const f = fakeFetch(() => json(200, { id: "x" }));
    expect(await createResendMailer({ apiKey: "", from: SANDBOX_FROM, fetch: f.fetch }).send({ to: OWNER, subject: "a", text: "b" })).toEqual({ ok: false, reason: "config" });
    expect(await createResendMailer({ apiKey: KEY, from: "", fetch: f.fetch }).send({ to: OWNER, subject: "a", text: "b" })).toEqual({ ok: false, reason: "config" });
    expect(await createResendMailer({ apiKey: KEY, from: SANDBOX_FROM, fetch: f.fetch }).send({ to: "a@b.com\nBcc: c@d.com", subject: "a", text: "b" })).toEqual({ ok: false, reason: "invalid" });
    expect(f.calls).toHaveLength(0);
  });
});
