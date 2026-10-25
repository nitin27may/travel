// The Postgres QuotaStore (EML-Q): one transaction per call, dropped to the non-owner `travel_app` role, calling the SECURITY DEFINER
// functions of migration 0011. The app role has no grant on `quota_bucket` itself, so it can count through `quota_take()` and read a
// global counter through `quota_peek()`, but it can never select, change or enumerate a hashed row.
import { getPool, pgErrorCode, type PgClientLike } from "../db/client.ts";
import { APP_ROLE } from "../db/tx.ts";
import { assertRules, BUCKET_RE, type QuotaRule, type QuotaStore, type TakeResult } from "./store.ts";

export class QuotaUnavailableError extends Error {
  constructor(sqlstate: string) {
    // Only the SQLSTATE: never SQL, parameters or connection details.
    super(`quota store unavailable (sqlstate=${sqlstate})`);
    this.name = "QuotaUnavailableError";
  }
}

async function inAppRole<T>(url: string | undefined, fn: (c: PgClientLike) => Promise<T>): Promise<T> {
  let client: PgClientLike | undefined;
  try {
    const pool = await getPool(url);
    client = await pool.connect();
    await client.query("begin");
    await client.query(`set local role "${APP_ROLE}"`);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client?.query("rollback").catch(() => {});
    throw new QuotaUnavailableError(pgErrorCode(e));
  } finally {
    client?.release();
  }
}

/** `url` defaults to DATABASE_URL (the pooled runtime connection). */
export function createPgQuotaStore(url?: string): QuotaStore {
  return {
    async take(rules: readonly QuotaRule[]): Promise<TakeResult> {
      assertRules(rules);
      const row = await inAppRole(url, async (c) => {
        const { rows } = await c.query<{ allowed: boolean; failed: number | null; retry_after: number; counts: number[] }>(
          "select allowed, failed, retry_after, counts from quota_take($1::text[], $2::text[], $3::int[], $4::int[])",
          [rules.map((r) => r.bucket), rules.map((r) => r.key), rules.map((r) => r.windowS), rules.map((r) => r.limit)],
        );
        return rows[0];
      });
      const counts = (row.counts ?? []).map(Number);
      return row.allowed
        ? { allowed: true, counts }
        : { allowed: false, failed: Number(row.failed) - 1, retryAfterS: Math.max(1, Number(row.retry_after)), counts };
    },
    async peek(bucket: string, windowS: number, at: Date): Promise<number> {
      if (!BUCKET_RE.test(bucket)) throw new RangeError("quota: bad bucket name");
      return inAppRole(url, async (c) => {
        const { rows } = await c.query<{ n: number }>("select quota_peek($1, $2, $3) as n", [bucket, windowS, at.toISOString()]);
        return Number(rows[0]?.n ?? 0);
      });
    },
  };
}
