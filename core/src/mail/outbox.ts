// The outbox adapter (EML-M): keeps messages in memory instead of sending them, for tests and local runs. It is refused on a production
// deployment: a Vercel production build that selected it would silently swallow every mail, so construction throws there and the web
// adapter selection falls back to the disabled mailer (fail closed).
import { invalidMessage, type MailMessage, type Mailer } from "./mailer.ts";

export class OutboxRefusedError extends Error {
  constructor() {
    super("the outbox mail adapter is for tests only and is refused when VERCEL_ENV is production");
    this.name = "OutboxRefusedError";
  }
}

export interface Outbox extends Mailer {
  /** Every accepted message, oldest first. */
  readonly sent: readonly MailMessage[];
  clear(): void;
}

/** `env` is the process environment (or a test copy); only `VERCEL_ENV` is read. */
export function createOutboxMailer(env: Readonly<Record<string, string | undefined>> = process.env): Outbox {
  if (env.VERCEL_ENV === "production") throw new OutboxRefusedError();
  const sent: MailMessage[] = [];
  const seen = new Set<string>();
  return {
    kind: "outbox",
    sent,
    clear() {
      sent.length = 0;
      seen.clear();
    },
    async send(message) {
      if (invalidMessage(message)) return { ok: false, reason: "invalid" };
      // Same idempotency semantics as Resend: a repeated key is accepted once.
      if (message.idempotencyKey) {
        if (seen.has(message.idempotencyKey)) return { ok: true, id: `outbox-${message.idempotencyKey}` };
        seen.add(message.idempotencyKey);
      }
      sent.push({ ...message });
      return { ok: true, id: `outbox-${sent.length}` };
    },
  };
}
