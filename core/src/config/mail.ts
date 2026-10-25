// Mail settings that are not secrets (EML-M; email spec "Decision 25 Oct" and sections 9 and 12). The one home of these numbers and
// hosts: core/src/mail/** and web/lib/server/mailer.ts read them from here. Secrets (RESEND_API_KEY) and the owner's address
// (OWNER_EMAIL) are environment variables, never values in this file.

/** Resend's HTTP API (R1 to R7 of the email spec). */
export const RESEND = {
  /** The send endpoint. */
  url: "https://api.resend.com/emails",
  /** A send that takes longer is abandoned and reported as `timeout` (spec 5.5 step 6: Neon's per-attempt budget needs it short). */
  timeoutMs: 3000,
  /** Resend keeps an idempotency key for 24 h and accepts at most 256 characters (R7). */
  idempotencyKeyMax: 256,
} as const;

/**
 * Phase 1 sender: Resend's sandbox address, which delivers only to the Resend account's own address (R4). While `MAIL_FROM` is unset
 * this is the From line, and the recipient guard refuses every address other than `OWNER_EMAIL`.
 */
export const SANDBOX_FROM = "Trip Plans <onboarding@resend.dev>";

/** Owner alerts (spec 9): the `mail:alert` bucket allows this many a day, well inside Resend free's 100 a day. */
export const ALERT_BUDGET = {
  bucket: "mail:alert",
  /** Alerts refused by the daily cap are counted here, and the next day's first alert says how many. */
  droppedBucket: "mail:alert:dropped",
  /** One slot per alert kind and window: the same event never mails twice in its window. */
  oncePrefix: "mail:alert:once:",
  perDay: 20,
} as const;

/** The subject prefix of every owner alert, so a mail filter can catch them. */
export const ALERT_SUBJECT_PREFIX = "[Trip Plans alert]";

/** The longest subject an alert may have (spec 8.2 invariant: at most 60 characters). */
export const SUBJECT_MAX = 60;
