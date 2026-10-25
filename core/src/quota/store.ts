// The quota contract (EML-Q; email spec 5.2 and 12): fixed, UTC-aligned windows over the `quota_bucket` table. A take is atomic and
// all-or-nothing: every rule of one call is checked under row locks, and either all are counted or none is. Two implementations share
// these semantics and the window maths below: `pg.ts` (the real store, through `quota_take()`) and `memory.ts` (tests).
//
// Keys are never raw: an address or an IP is an HMAC (keys.ts), and the table's CHECK constraint refuses anything that is not 32 hex
// characters or empty, so a bug cannot store a raw value.

export interface QuotaRule {
  /** `auth:send:addr`, `mail:alert`, ...: lower case, digits, `:`, `_`, `-`, at most 64 characters. */
  bucket: string;
  /** A 32-hex HMAC (keys.ts), or "" for a global counter. */
  key: string;
  windowS: number;
  /** null: count only, never refuse (monitoring counters). */
  limit: number | null;
}

export type TakeResult =
  | { allowed: true; counts: number[] }
  | { allowed: false; /** index of the first full rule */ failed: number; /** seconds until the latest full window ends */ retryAfterS: number; counts: number[] };

export interface QuotaStore {
  /** Check and count every rule at once. At most 8 rules. Throws when the store is unreachable (callers fail closed). */
  take(rules: readonly QuotaRule[]): Promise<TakeResult>;
  /** The count of a global ("" key) counter in the window that holds `at`. Keyed rows cannot be read this way. */
  peek(bucket: string, windowS: number, at: Date): Promise<number>;
}

export const BUCKET_RE = /^[a-z][a-z0-9:_-]{0,63}$/;
export const KEY_RE = /^(?:[0-9a-f]{32})?$/;
export const WINDOW_MIN_S = 60;
export const WINDOW_MAX_S = 30 * 86400;
export const MAX_RULES = 8;

/** Start of the fixed window of `windowS` seconds that holds `epochS` (UTC-aligned: a 86400 s window is the UTC day). */
export function windowStart(epochS: number, windowS: number): number {
  return Math.floor(epochS / windowS) * windowS;
}

/** Whole seconds until the window that holds `epochS` ends (at least 1). */
export function secondsLeft(epochS: number, windowS: number): number {
  return Math.max(1, Math.ceil(windowStart(epochS, windowS) + windowS - epochS));
}

/** Throws a fixed message for a rule the database would refuse, before any round trip. */
export function assertRules(rules: readonly QuotaRule[]): void {
  if (rules.length < 1 || rules.length > MAX_RULES) throw new RangeError("quota: 1 to 8 rules per take");
  for (const r of rules) {
    if (!BUCKET_RE.test(r.bucket)) throw new RangeError("quota: bad bucket name");
    if (!KEY_RE.test(r.key)) throw new RangeError("quota: key must be a 32-hex hash or empty");
    if (!Number.isInteger(r.windowS) || r.windowS < WINDOW_MIN_S || r.windowS > WINDOW_MAX_S) throw new RangeError("quota: bad window");
    if (r.limit !== null && (!Number.isInteger(r.limit) || r.limit < 0)) throw new RangeError("quota: bad limit");
  }
}
