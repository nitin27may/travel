// The Mailer contract (EML-M; email spec 12). Every mail the app sends goes through one `Mailer`; adapters (Resend over HTTP, the
// test-only outbox) implement it, and `ownerOnly` wraps any adapter with the Phase 1 recipient guard. A send never throws for a
// delivery problem: it returns a result with a fixed reason code, so a caller can log the code and nothing else. No result, error or
// log line carries the API key, the recipient address or the body.
import { sameAddress, canonicalAddress } from "./address.ts";

/** One plain-text message (Phase 1 sends no HTML). */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Sent as `Idempotency-Key`: a retry with the same key never sends twice (Resend keeps it 24 h). */
  idempotencyKey?: string;
}

/**
 * Why a send did not go out. `quota` is Resend's daily cap (429 `daily_quota_exceeded`); `rate_limited` its per-second limit;
 * `recipient` our own guard; `rejected` a 4xx from the provider (bad key, sandbox recipient, invalid payload); `unavailable` a 5xx;
 * `timeout` and `network` a call that never got an answer; `config` a mailer that is not configured (fail closed); `invalid` a message
 * that failed our own checks before any call.
 */
export type MailFailure =
  | "quota"
  | "rate_limited"
  | "recipient"
  | "rejected"
  | "conflict"
  | "unavailable"
  | "timeout"
  | "network"
  | "config"
  | "invalid";

export type SendResult = { ok: true; id: string } | { ok: false; reason: MailFailure; status?: number };

export interface Mailer {
  /** Which adapter this is, for logs (`resend`, `outbox`, `disabled`). */
  readonly kind: string;
  send(message: MailMessage): Promise<SendResult>;
}

/** A mailer that refuses everything: what adapter selection returns when the configuration is missing (fail closed). */
export function disabledMailer(): Mailer {
  return { kind: "disabled", send: async () => ({ ok: false, reason: "config" }) };
}

/** Checks every adapter runs before a network call: one canonical recipient, a one-line subject, a body. */
export function invalidMessage(m: MailMessage): boolean {
  if (!canonicalAddress(m.to)) return true;
  if (typeof m.subject !== "string" || !m.subject.trim() || /[\r\n]/.test(m.subject)) return true;
  if (typeof m.text !== "string" || !m.text.trim()) return true;
  if (m.idempotencyKey !== undefined && (typeof m.idempotencyKey !== "string" || !/^[\x21-\x7e]{1,256}$/.test(m.idempotencyKey))) return true;
  return false;
}

export interface RecipientPolicy {
  /** The Resend account's own address: the only recipient the sandbox delivers to (R4). */
  ownerEmail: string | undefined;
  /** Our verified sender. Unset in Phase 1: the sandbox sender, so only the owner may be mailed. */
  mailFrom: string | undefined;
}

/**
 * The Phase 1 recipient guard (Decision 25 Oct): while `MAIL_FROM` is unset, any recipient other than `OWNER_EMAIL` is refused before
 * the adapter is called, so a bug can never mail a visitor from the sandbox. With no `OWNER_EMAIL` every send is refused.
 */
export function ownerOnly(inner: Mailer, policy: RecipientPolicy): Mailer {
  return {
    kind: inner.kind,
    async send(message) {
      if (!policy.mailFrom?.trim()) {
        if (!policy.ownerEmail || !sameAddress(message.to, policy.ownerEmail)) return { ok: false, reason: "recipient" };
      }
      return inner.send(message);
    },
  };
}
