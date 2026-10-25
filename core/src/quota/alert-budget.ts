// The owner-alert budget over quota_bucket (EML-M's AlertBudget; email spec 9): one slot per alert kind per window, then the shared
// `mail:alert` cap of 20 a day. A refused alert is counted in `mail:alert:dropped`, and the first alert of the next day reads yesterday's
// count so it can say how many were not sent. Counters are global ("" key): they hold no address and no hash.
import { ALERT_BUDGET } from "../config/mail.ts";
import type { AlertBudget, AlertKind, BudgetClaim } from "../mail/alert.ts";
import type { QuotaStore } from "./store.ts";

const DAY_S = 86400;

export function quotaAlertBudget(store: QuotaStore, clock: () => Date = () => new Date()): AlertBudget {
  return {
    async claim(kind: AlertKind, windowS: number): Promise<BudgetClaim> {
      const once = await store.take([{ bucket: `${ALERT_BUDGET.oncePrefix}${kind}`, key: "", windowS, limit: 1 }]);
      if (!once.allowed) return { allowed: false, reason: "duplicate" };
      const day = await store.take([{ bucket: ALERT_BUDGET.bucket, key: "", windowS: DAY_S, limit: ALERT_BUDGET.perDay }]);
      if (!day.allowed) {
        await store.take([{ bucket: ALERT_BUDGET.droppedBucket, key: "", windowS: DAY_S, limit: null }]);
        return { allowed: false, reason: "cap" };
      }
      const firstToday = day.counts[0] === 1;
      const droppedYesterday = firstToday ? await store.peek(ALERT_BUDGET.droppedBucket, DAY_S, new Date(clock().getTime() - DAY_S * 1000)) : 0;
      return { allowed: true, firstToday, droppedYesterday };
    },
  };
}
