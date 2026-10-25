// The shared mail module (EML-M, Phase 1): the Mailer contract, the Resend and outbox adapters, the owner-only recipient guard, the
// address normaliser and plain-text owner alerts. Phase 2 (EML-M2) adds the split budget, headers and HTML parts; FBK-M adds intake
// templates beside this module.
export { disabledMailer, invalidMessage, ownerOnly } from "./mailer.ts";
export type { Mailer, MailFailure, MailMessage, RecipientPolicy, SendResult } from "./mailer.ts";
export { createResendMailer } from "./resend.ts";
export type { ResendOptions } from "./resend.ts";
export { createOutboxMailer, OutboxRefusedError } from "./outbox.ts";
export type { Outbox } from "./outbox.ts";
export { ADDRESS_MAX, addressKey, canonicalAddress, sameAddress } from "./address.ts";
export { ALERT_WINDOW_S, renderAlert, sendOwnerAlert } from "./alert.ts";
export type { AlertBudget, AlertDeps, AlertEvent, AlertKind, AlertResult, BudgetClaim } from "./alert.ts";
