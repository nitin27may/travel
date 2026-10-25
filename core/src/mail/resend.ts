// The Resend adapter (EML-M): plain `fetch`, no SDK, a 3 s timeout and an `Idempotency-Key` header. Answers map to the fixed reason
// codes of mailer.ts; the key, the recipient and the body never appear in a result or a thrown error (nothing here throws).
import { RESEND } from "../config/mail.ts";
import { invalidMessage, type Mailer, type MailFailure, type SendResult } from "./mailer.ts";

export interface ResendOptions {
  apiKey: string;
  /** The From line: `SANDBOX_FROM` in Phase 1, `MAIL_FROM` after a verified domain. */
  from: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  url?: string;
}

/** Resend's error body: `{ name, message, statusCode }`. Only `name` is read, and only as one of a few known codes. */
async function errorName(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { name?: unknown };
    return typeof body?.name === "string" ? body.name : "";
  } catch {
    return "";
  }
}

function failure(status: number, name: string): MailFailure {
  if (status === 429) return name === "daily_quota_exceeded" ? "quota" : "rate_limited";
  if (status === 409) return "conflict";
  if (status >= 500) return "unavailable";
  return "rejected";
}

export function createResendMailer(opts: ResendOptions): Mailer {
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? RESEND.timeoutMs;
  const url = opts.url ?? RESEND.url;
  return {
    kind: "resend",
    async send(message): Promise<SendResult> {
      if (!opts.apiKey || !opts.from) return { ok: false, reason: "config" };
      if (invalidMessage(message)) return { ok: false, reason: "invalid" };
      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      };
      if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey.slice(0, RESEND.idempotencyKeyMax);
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ from: opts.from, to: [message.to.trim()], subject: message.subject, text: message.text }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        const name = (e as { name?: string } | null)?.name;
        return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
      }
      if (res.ok) {
        try {
          const body = (await res.json()) as { id?: unknown };
          return { ok: true, id: typeof body?.id === "string" ? body.id : "" };
        } catch {
          return { ok: true, id: "" };
        }
      }
      return { ok: false, reason: failure(res.status, await errorName(res)), status: res.status };
    },
  };
}
