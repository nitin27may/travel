// Owner alerts (EML-M; email spec 9 and "Decision 25 Oct"). Plain text to OWNER_EMAIL only, built from fixed sentences and whole numbers:
// an event carries codes and counts, never visitor text, a visitor address, a code or a token, so nothing a visitor typed can reach a
// mail. Each kind has a window: the same kind mails at most once per window, and all kinds share the `mail:alert` budget of 20 a day.
// At the cap the alert is dropped and counted, and the first alert of the next day says how many were not sent.
import { ALERT_BUDGET, ALERT_SUBJECT_PREFIX, SUBJECT_MAX } from "../config/mail.ts";
import type { Mailer, MailFailure } from "./mailer.ts";

const HOUR_S = 3600;
const DAY_S = 86400;

/** What can be alerted. FBK-M adds intake kinds here (new report, takedown, flood); each is codes and counts only. */
export type AlertEvent =
  /** Neon refused a code send (429 or 5xx) for the first time this UTC day. */
  | { kind: "auth-sender-refused"; status: number; refusedToday: number }
  /** Code sends failed (Neon refused, or never answered) this many times in the current hour. */
  | { kind: "auth-send-failures"; failures: number }
  /** Our own global cap on code sends was reached. */
  | { kind: "auth-global-cap"; limit: number; window: "hour" | "day" };

export type AlertKind = AlertEvent["kind"];

/** How long one alert of a kind silences the next one of the same kind. */
export const ALERT_WINDOW_S: Readonly<Record<AlertKind, number>> = {
  "auth-sender-refused": DAY_S,
  "auth-send-failures": HOUR_S,
  "auth-global-cap": DAY_S,
};

export type BudgetClaim = { allowed: true; firstToday: boolean; droppedYesterday: number } | { allowed: false; reason: "duplicate" | "cap" };

/** The `mail:alert` budget and the once-per-window slots. The quota module (EML-Q) implements it over `quota_bucket`. */
export interface AlertBudget {
  claim(kind: AlertKind, windowS: number): Promise<BudgetClaim>;
}

export interface AlertDeps {
  mailer: Mailer;
  budget: AlertBudget;
  ownerEmail: string | undefined;
  /** Used for the idempotency key only (the window the alert belongs to). */
  now?: Date;
}

export type AlertResult =
  | { sent: true }
  | { sent: false; reason: "duplicate" | "cap" | "config" | "invalid" | "budget_unavailable" | MailFailure };

const whole = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Subject and body for an event, or null when a field is not what its kind allows (refused before anything is sent). */
export function renderAlert(event: AlertEvent, droppedYesterday = 0): { subject: string; text: string } | null {
  let title: string;
  let lines: string[];
  switch (event.kind) {
    case "auth-sender-refused":
      if (!whole(event.status) || !whole(event.refusedToday)) return null;
      title = "Neon refused a sign-in email";
      lines = [
        `Neon Auth refused to send a sign-in email (HTTP ${event.status}). This is the first refusal today (UTC).`,
        `Refusals today so far: ${event.refusedToday}.`,
        "",
        "People can still sign in with a password or Google. If this repeats, the shared sender's limit may be reached.",
      ];
      break;
    case "auth-send-failures":
      if (!whole(event.failures)) return null;
      title = "Sign-in emails are failing";
      lines = [
        `${event.failures} sign-in emails failed to send in the last hour (Neon refused them or did not answer).`,
        "",
        "People can still sign in with a password or Google.",
      ];
      break;
    case "auth-global-cap":
      if (!whole(event.limit) || (event.window !== "hour" && event.window !== "day")) return null;
      title = "Sign-in email cap reached";
      lines = [
        `Our cap of ${event.limit} sign-in emails per ${event.window} was reached. Further code requests are refused until the window ends.`,
        "",
        "This is usually a bot that passed Turnstile. People can still sign in with a password or Google.",
      ];
      break;
    default:
      return null;
  }
  const subject = `${ALERT_SUBJECT_PREFIX} ${title}`;
  if (subject.length > SUBJECT_MAX) return null;
  const dropped = whole(droppedYesterday) && droppedYesterday > 0 ? [`${droppedYesterday} alerts were not sent yesterday (daily cap of ${ALERT_BUDGET.perDay}).`, ""] : [];
  const text = [
    ...lines,
    "",
    ...dropped,
    "Counts: run the quota stats command.",
    "",
    "Sent by the Trip Plans auth guard. Alerts carry counts only, never a visitor's address or text.",
    "",
  ].join("\n");
  return { subject, text };
}

/** Send one owner alert, inside the budget. Never throws; the result is a fixed code for the caller's log. */
export async function sendOwnerAlert(event: AlertEvent, deps: AlertDeps): Promise<AlertResult> {
  if (!deps.ownerEmail?.trim()) return { sent: false, reason: "config" };
  if (!renderAlert(event)) return { sent: false, reason: "invalid" };
  const windowS = ALERT_WINDOW_S[event.kind];
  let claim: BudgetClaim;
  try {
    claim = await deps.budget.claim(event.kind, windowS);
  } catch {
    // No budget, no mail: an unbounded alert loop is worse than a missed alert (the stats command still has the counts).
    return { sent: false, reason: "budget_unavailable" };
  }
  if (!claim.allowed) return { sent: false, reason: claim.reason };
  const rendered = renderAlert(event, claim.firstToday ? claim.droppedYesterday : 0);
  if (!rendered) return { sent: false, reason: "invalid" };
  const epoch = Math.floor((deps.now ?? new Date()).getTime() / 1000);
  const windowStart = Math.floor(epoch / windowS) * windowS;
  const result = await deps.mailer.send({
    to: deps.ownerEmail.trim(),
    subject: rendered.subject,
    text: rendered.text,
    idempotencyKey: `alert-${event.kind}-${windowStart}`,
  });
  return result.ok ? { sent: true } : { sent: false, reason: result.reason };
}
