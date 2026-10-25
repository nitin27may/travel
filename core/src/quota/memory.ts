// An in-memory QuotaStore with the same semantics as `quota_take()` (store.ts), for tests and for the alert and guard maths. Not for
// production: a serverless deployment has many processes, so only the Postgres store bounds anything there.
import { assertRules, secondsLeft, windowStart, type QuotaRule, type QuotaStore, type TakeResult } from "./store.ts";

export interface MemoryQuotaStore extends QuotaStore {
  /** Every stored row, for assertions: bucket, key, window and count (keys are already hashes). */
  rows(): { bucket: string; key: string; windowS: number; windowStart: number; count: number }[];
}

export function createMemoryQuotaStore(clock: () => Date = () => new Date()): MemoryQuotaStore {
  const rows = new Map<string, { bucket: string; key: string; windowS: number; windowStart: number; count: number }>();
  const id = (bucket: string, key: string, windowS: number, start: number) => `${bucket}\u0000${key}\u0000${windowS}\u0000${start}`;
  return {
    async take(rules: readonly QuotaRule[]): Promise<TakeResult> {
      assertRules(rules);
      const t = clock().getTime() / 1000;
      const slots = rules.map((r) => {
        const start = windowStart(t, r.windowS);
        const k = id(r.bucket, r.key, r.windowS, start);
        let row = rows.get(k);
        if (!row) rows.set(k, (row = { bucket: r.bucket, key: r.key, windowS: r.windowS, windowStart: start, count: 0 }));
        return row;
      });
      let failed = -1;
      let retryAfterS = 0;
      rules.forEach((r, i) => {
        if (r.limit !== null && slots[i].count >= r.limit) {
          if (failed < 0) failed = i;
          retryAfterS = Math.max(retryAfterS, secondsLeft(t, r.windowS));
        }
      });
      if (failed >= 0) return { allowed: false, failed, retryAfterS, counts: slots.map((s) => s.count) };
      for (const s of slots) s.count++;
      return { allowed: true, counts: slots.map((s) => s.count) };
    },
    async peek(bucket, windowS, at) {
      return rows.get(id(bucket, "", windowS, windowStart(at.getTime() / 1000, windowS)))?.count ?? 0;
    },
    rows: () => [...rows.values()].map((r) => ({ ...r })),
  };
}
