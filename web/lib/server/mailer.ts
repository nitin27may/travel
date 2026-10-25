import 'server-only';
import { SANDBOX_FROM } from '@travel/core/config/mail.ts';
import { createOutboxMailer, createResendMailer, disabledMailer, ownerOnly, type Mailer } from '@travel/core/mail/index.ts';

/**
 * Mail adapter selection from the environment (EML-M; email spec 12). Fails closed: anything missing or contradictory gives the
 * disabled mailer, which refuses every send with `config`, so a misconfigured deployment mails nobody rather than the wrong person.
 *
 *   NODE_ENV test, not a Vercel production deployment   the in-memory outbox (never in production: createOutboxMailer refuses it)
 *   RESEND_API_KEY and OWNER_EMAIL set                   Resend over fetch. From MAIL_FROM when set, else the sandbox sender;
 *                                                        always behind the recipient guard, which allows only OWNER_EMAIL while
 *                                                        MAIL_FROM is unset (Phase 1)
 *   anything else                                        disabled
 *
 * Read at first use, never at module scope (`next build` has no secrets). Nothing here logs a value.
 */
export type MailEnv = Readonly<Record<string, string | undefined>>;

export function selectMailer(env: MailEnv): Mailer {
  const ownerEmail = env.OWNER_EMAIL?.trim() || undefined;
  const mailFrom = env.MAIL_FROM?.trim() || undefined;
  const policy = { ownerEmail, mailFrom };
  if (env.NODE_ENV === 'test') {
    try {
      return ownerOnly(createOutboxMailer(env), policy);
    } catch {
      return disabledMailer();
    }
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey || !ownerEmail) return disabledMailer();
  return ownerOnly(createResendMailer({ apiKey, from: mailFrom ?? SANDBOX_FROM }), policy);
}

let cached: Mailer | undefined;

/** The process-wide mailer, chosen once from `process.env`. */
export function getMailer(): Mailer {
  return (cached ??= selectMailer(process.env));
}

/** The owner's address for alerts, or undefined (alerts then refuse with `config`). */
export function ownerEmail(): string | undefined {
  return process.env.OWNER_EMAIL?.trim() || undefined;
}
