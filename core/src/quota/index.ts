// Quotas over `quota_bucket` (EML-Q): the contract and window maths, the Postgres and in-memory stores, HMAC keys, the owner-alert
// budget and the sender-monitoring stats. Limits live in core/src/config/auth-limits.ts.
export { assertRules, BUCKET_RE, KEY_RE, MAX_RULES, secondsLeft, windowStart } from "./store.ts";
export type { QuotaRule, QuotaStore, TakeResult } from "./store.ts";
export { createMemoryQuotaStore } from "./memory.ts";
export type { MemoryQuotaStore } from "./memory.ts";
export { createPgQuotaStore, QuotaUnavailableError } from "./pg.ts";
export { addressHash, addressIpHash, assertSecret, ipHash, userHash, utcDay } from "./keys.ts";
export { quotaAlertBudget } from "./alert-budget.ts";
export { dailyCounts, deliverySignal, formatStats, statsQuery } from "./stats.ts";
export type { DayCounts, Signal, StatsRow } from "./stats.ts";
