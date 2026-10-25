// The auth guard's numbers (EML-Q; email spec 5.2 and 5.3, Phase 1 values sized for Neon's shared sender and about 30 users). The one
// home of these limits: web/lib/auth/guard.ts and core/src/quota read them from here. Changing a limit is a change to this file only.
//
// Windows are fixed and UTC-aligned (a 24 h window is the UTC day). Each bucket lists its windows; a call is refused when ANY window of
// ANY of its buckets is full, and then nothing is counted (core/src/quota: one atomic take per call).

/** One fixed window: at most `limit` calls per `windowS` seconds. */
export interface Window {
  windowS: number;
  limit: number;
}

const MINUTE = 60;
const QUARTER = 15 * 60;
const HOUR = 3600;
const DAY = 86400;

/** Phase 1 buckets (spec 5.2). `addr` buckets key on the hashed address, `ip` on the hashed client IP, `global` on nothing. */
export const AUTH_LIMITS = {
  /** Every call that makes Neon send a code: per address 1 a minute, 4 an hour, 8 a day. */
  sendAddr: { bucket: "auth:send:addr", windows: [{ windowS: MINUTE, limit: 1 }, { windowS: HOUR, limit: 4 }, { windowS: DAY, limit: 8 }] },
  /** Per client IP: 6 an hour, 20 a day. */
  sendIp: { bucket: "auth:send:ip", windows: [{ windowS: HOUR, limit: 6 }, { windowS: DAY, limit: 20 }] },
  /** Every visitor together: 10 an hour, 30 a day, far below any plausible shared-sender limit (set to at most half of it if found). */
  sendGlobal: { bucket: "auth:send:global", windows: [{ windowS: HOUR, limit: 10 }, { windowS: DAY, limit: 30 }] },
  /** Code checks (sign in by code, verify, reset): 10 an hour per address, 20 per IP. Neon also deletes a code after 3 wrong tries. */
  verifyAddr: { bucket: "auth:verify:addr", windows: [{ windowS: HOUR, limit: 10 }] },
  verifyIp: { bucket: "auth:verify:ip", windows: [{ windowS: HOUR, limit: 20 }] },
  /** Password sign-in: 10 per 15 minutes per address, 20 per IP. No lockout: a lockout would let anyone lock out a victim. */
  passwordAddr: { bucket: "auth:password:addr", windows: [{ windowS: QUARTER, limit: 10 }] },
  passwordIp: { bucket: "auth:password:ip", windows: [{ windowS: QUARTER, limit: 20 }] },
  /** Password sign-up per IP: 5 an hour, 20 a day. */
  signupIp: { bucket: "auth:signup:ip", windows: [{ windowS: HOUR, limit: 5 }, { windowS: DAY, limit: 20 }] },
} as const satisfies Record<string, { bucket: string; windows: readonly Window[] }>;

/**
 * Sender monitoring (Decision 25 Oct): counts per UTC day that never refuse. `failed` is per hour, for the "three failures in an hour"
 * owner alert. `node core/bin/quota.ts stats` prints the daily three.
 */
export const AUTH_METRICS = {
  sent: { bucket: "auth:metric:sent", windowS: DAY },
  refused: { bucket: "auth:metric:refused", windowS: DAY },
  verified: { bucket: "auth:metric:verified", windowS: DAY },
  failed: { bucket: "auth:metric:failed", windowS: HOUR },
  /** Resets whose older sessions could not be signed out, per hour (owner alert `auth-revoke-failed`). */
  revokeFailed: { bucket: "auth:metric:revoke_failed", windowS: HOUR },
} as const;

/** Owner alert thresholds (spec 9): the first Neon refusal of a day, and this many send failures in one hour. */
export const ALERT_AFTER = { refusalsToday: 1, failuresPerHour: 3 } as const;

/** The deliverability signal of the stats command: a week with at least this many sends and fewer than this share verified (Q148). */
export const DELIVERY_SIGNAL = { days: 7, minSends: 10, minVerifiedShare: 0.5 } as const;

/** How long quota rows live: hashed rows 48 h after their window ends (spec 5.6); content-free counters 35 days, for the weekly signal. */
export const QUOTA_RETENTION = { keyedHours: 48, counterDays: 35 } as const;

/** The guard's request limits. */
export const AUTH_GUARD = {
  /** Largest body the guard reads on a guarded auth call (spec 4.2: body cap 4 KB). */
  bodyMaxBytes: 4096,
  /** Neon's own limiter answers 429 with `x-retry-after: 10` (EML-0 R1), which the SDK proxy drops; the guard sends this instead. */
  upstreamRetryAfterS: 10,
} as const;

/** Cloudflare Turnstile (spec 5.3). */
export const TURNSTILE = {
  url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  timeoutMs: 3000,
  /** The widget script the sign-in card loads on first focus (explicit rendering). */
  widgetScript: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  /** How long the card waits for a widget token before sending without one (the guard then refuses with a clear message). */
  tokenWaitMs: 15000,
  /** The widget's action on every mail-sending call and on sign-up. */
  action: "auth_send",
  /**
   * Cloudflare's published test secrets (always pass, always fail, token already spent). Their answers carry hostname `example.com`
   * and no action (probed 25 Oct 2026), so the guard skips those two checks for them, and refuses them outright in production.
   */
  testSecrets: ["1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"],
} as const;

/**
 * The emailed code as the sign-in card presents it (EML-1). Neon's codes are 6 digits and live 5 minutes (EML-0 U9: the row TTL is
 * 300 s, not the 15 minutes of Neon's docs) and die after 3 wrong tries. The card waits `resendAfterS` before offering a new one,
 * the same as the per-address send window, so the button never offers a send the guard would refuse.
 */
export const EMAIL_CODE = { length: 6, lifetimeMin: 5, resendAfterS: 60, attempts: 3 } as const;

/** Passwords the card accepts (Better Auth's defaults: at least 8, at most 128 characters). */
export const PASSWORD = { minLength: 8, maxLength: 128 } as const;
