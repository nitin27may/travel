// Sender monitoring (EML-Q; email spec "Decision 25 Oct" point 5): the daily counts of code sends Neon accepted, sends Neon refused, and
// codes verified, and the deliverability signal: a week with at least 10 sends and fewer than half verified means mail is landing in
// spam or not arriving, which is the trigger for a mail domain (Q148). Counts only; the rows read here carry no key.
import { AUTH_METRICS, DELIVERY_SIGNAL } from "../config/auth-limits.ts";

export interface DayCounts {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  sent: number;
  refused: number;
  verified: number;
}

export interface StatsRow {
  bucket: string;
  window_start: Date | string;
  count: number | string;
}

/** The SQL the owner connection runs (the CLI): the three daily counters for the last `days` UTC days. */
export function statsQuery(days: number, today: Date): { sql: string; params: unknown[] } {
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const from = new Date(t0 - Math.max(0, days - 1) * 86_400_000).toISOString();
  return {
    sql:
      "select bucket, window_start, count from quota_bucket where key = '' and window_s = 86400 " +
      "and bucket = any($1::text[]) and window_start >= $2::timestamptz order by window_start",
    params: [[AUTH_METRICS.sent.bucket, AUTH_METRICS.refused.bucket, AUTH_METRICS.verified.bucket], from],
  };
}

/** One entry per UTC day from `days - 1` days before `today` to `today`, zero-filled. */
export function dailyCounts(rows: readonly StatsRow[], today: Date, days: number): DayCounts[] {
  const out = new Map<string, DayCounts>();
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(t0 - i * 86_400_000).toISOString().slice(0, 10);
    out.set(day, { day, sent: 0, refused: 0, verified: 0 });
  }
  for (const r of rows) {
    const day = new Date(r.window_start).toISOString().slice(0, 10);
    const d = out.get(day);
    if (!d) continue;
    const n = Number(r.count) || 0;
    if (r.bucket === AUTH_METRICS.sent.bucket) d.sent += n;
    else if (r.bucket === AUTH_METRICS.refused.bucket) d.refused += n;
    else if (r.bucket === AUTH_METRICS.verified.bucket) d.verified += n;
  }
  return [...out.values()];
}

export interface Signal {
  sends: number;
  verified: number;
  /** True when the week shows the spam-or-missing pattern. */
  warn: boolean;
}

/** The weekly deliverability signal over the last DELIVERY_SIGNAL.days entries. */
export function deliverySignal(days: readonly DayCounts[]): Signal {
  const week = days.slice(-DELIVERY_SIGNAL.days);
  const sends = week.reduce((s, d) => s + d.sent, 0);
  const verified = week.reduce((s, d) => s + d.verified, 0);
  return { sends, verified, warn: sends >= DELIVERY_SIGNAL.minSends && verified < sends * DELIVERY_SIGNAL.minVerifiedShare };
}

/** The printed report. */
export function formatStats(days: readonly DayCounts[]): string {
  const lines = ["day         sent  refused  verified"];
  for (const d of days) lines.push(`${d.day}  ${String(d.sent).padStart(4)}  ${String(d.refused).padStart(7)}  ${String(d.verified).padStart(8)}`);
  const s = deliverySignal(days);
  lines.push("");
  lines.push(`last ${Math.min(DELIVERY_SIGNAL.days, days.length)} days: ${s.sends} sent, ${s.verified} verified`);
  lines.push(
    s.warn
      ? `SIGNAL: fewer than half of the codes were used. Mail may be landing in spam or not arriving (email spec Q148).`
      : `no deliverability signal (needs ${DELIVERY_SIGNAL.minSends} or more sends with fewer than half verified)`,
  );
  return lines.join("\n");
}

// ----- readiness (review EML-S SF7) ------------------------------------------------------------------------------------------------
// Release A deployed the guard with "no database migrations", so production may lack 0011_quota.sql; then every guarded call answers
// 503 GUARD_UNAVAILABLE, password sign-in included. `quota.ts check` reads only the catalogue (no row of quota_bucket) and says which
// part is missing. Read only.

export interface ReadinessRow {
  table_ok: boolean;
  take_ok: boolean;
  peek_ok: boolean;
  role_ok: boolean;
  grant_ok: boolean | null;
}

/** The catalogue query: the table, both functions, the app role and its execute grant on quota_take. `appRole` is a parameter. */
export function readinessQuery(appRole: string): { sql: string; params: unknown[] } {
  const take = "to_regprocedure('public.quota_take(text[],text[],integer[],integer[])')";
  return {
    sql:
      "select to_regclass('public.quota_bucket') is not null as table_ok, " +
      `${take} is not null as take_ok, ` +
      "to_regprocedure('public.quota_peek(text,integer,timestamptz)') is not null as peek_ok, " +
      "exists (select 1 from pg_roles where rolname = $1) as role_ok, " +
      `case when ${take} is not null and exists (select 1 from pg_roles where rolname = $1) ` +
      `then has_function_privilege($1, ${take}::oid, 'execute') end as grant_ok`,
    params: [appRole],
  };
}

/** What is missing, in fixed words; empty when the quota store is ready. */
export function readinessProblems(row: ReadinessRow | undefined): string[] {
  if (!row) return ["no answer from the database"];
  const out: string[] = [];
  if (!row.table_ok) out.push("table quota_bucket is missing (apply core/src/db/migrations/0011_quota.sql)");
  if (!row.take_ok) out.push("function quota_take is missing (0011_quota.sql)");
  if (!row.peek_ok) out.push("function quota_peek is missing (0011_quota.sql)");
  if (!row.role_ok) out.push("the app role is missing (an earlier migration)");
  else if (row.take_ok && row.grant_ok !== true) out.push("the app role cannot execute quota_take (0011_quota.sql grants)");
  return out;
}

/** The printed readiness report. */
export function formatReadiness(problems: readonly string[]): string {
  return problems.length === 0
    ? "quota store ready: quota_bucket, quota_take and quota_peek exist and the app role may call them"
    : ["quota store NOT ready; every guarded sign-in call answers 503 GUARD_UNAVAILABLE until this is fixed:", ...problems.map((p) => `- ${p}`)].join("\n");
}
