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

/**
 * Phase 1 buckets (spec 5.2). `addr` buckets key on the hashed address, `addr_ip` on the hash of the address and the client IP
 * together, `ip` on the hashed client IP, `global` on nothing. An IP is keyed on its network: IPv4 as is, IPv6 on its /64
 * (core/src/quota/keys.ts, review GSI-S S3).
 *
 * Checks (code and password) key the tight per-address limit on address + IP (review EML-S SF3): someone guessing from their own
 * network renews only their own lockout, never the owner's of that address on another network. The address-only bucket is a ceiling
 * well above what one IP may try (`verifyIp`, `passwordIp`), so locking a victim out takes several networks at once, while a guesser
 * spread over many networks still stops there.
 */
export const AUTH_LIMITS = {
  /** Every call that makes Neon send a code: per address 1 a minute, 4 an hour, 8 a day. */
  sendAddr: { bucket: "auth:send:addr", windows: [{ windowS: MINUTE, limit: 1 }, { windowS: HOUR, limit: 4 }, { windowS: DAY, limit: 8 }] },
  /** Per client IP: 6 an hour, 20 a day. */
  sendIp: { bucket: "auth:send:ip", windows: [{ windowS: HOUR, limit: 6 }, { windowS: DAY, limit: 20 }] },
  /** Every visitor together: 10 an hour, 30 a day, far below any plausible shared-sender limit (set to at most half of it if found). */
  sendGlobal: { bucket: "auth:send:global", windows: [{ windowS: HOUR, limit: 10 }, { windowS: DAY, limit: 30 }] },
  /**
   * Code checks (sign in by code, verify, reset): 10 an hour and 30 a day per address from one network, 20 an hour per network, and a
   * ceiling per address from every network together of 60 an hour (three networks at their full rate) and 150 a day (five networks at
   * their full day, review GSI-S S4). Neon also deletes a code after 3 wrong tries, and every new code draws from `sendAddr`.
   */
  verifyAddrIp: { bucket: "auth:verify:addr_ip", windows: [{ windowS: HOUR, limit: 10 }, { windowS: DAY, limit: 30 }] },
  verifyAddr: { bucket: "auth:verify:addr", windows: [{ windowS: HOUR, limit: 60 }, { windowS: DAY, limit: 150 }] },
  verifyIp: { bucket: "auth:verify:ip", windows: [{ windowS: HOUR, limit: 20 }] },
  /**
   * Password sign-in: 10 per 15 minutes and 40 a day per address from one network, 20 per 15 minutes per network, and a ceiling per
   * address from every network together of 60 per 15 minutes (three networks at their full rate) and 200 a day (review GSI-S S4: the
   * quarter ceiling alone allowed 5,760 guesses a day at one address). The day ceiling is five networks' full day, so one network can
   * never use it up and lock the owner out (SF3); a guesser on many networks stops at 200 a day.
   */
  passwordAddrIp: { bucket: "auth:password:addr_ip", windows: [{ windowS: QUARTER, limit: 10 }, { windowS: DAY, limit: 40 }] },
  passwordAddr: { bucket: "auth:password:addr", windows: [{ windowS: QUARTER, limit: 60 }, { windowS: DAY, limit: 200 }] },
  passwordIp: { bucket: "auth:password:ip", windows: [{ windowS: QUARTER, limit: 20 }] },
  /** Password sign-up per IP: 5 an hour, 20 a day. */
  signupIp: { bucket: "auth:signup:ip", windows: [{ windowS: HOUR, limit: 5 }, { windowS: DAY, limit: 20 }] },
  /**
   * The Google start (`sign-in/social`, review GSI-S B2) per network: 10 a minute, 40 an hour. It sends no mail, but every call makes
   * Neon write an OAuth state row in our project and wakes the compute, and Neon's own limiter sees only Vercel's egress address, so
   * one abuser would trip it for every visitor. No Turnstile: the button stays one press.
   */
  socialIp: { bucket: "auth:social:ip", windows: [{ windowS: MINUTE, limit: 10 }, { windowS: HOUR, limit: 40 }] },
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
  /**
   * Every answer of a send or sign-up route is held until at least `answerMinMs` plus a random share of `answerJitterMs` after the
   * guard started on it (review EML-S SF5): Neon answers faster when it sends nothing (an unknown address on a reset request, an
   * existing one on sign-up), and the hold hides that. Neon's answer time is not measured yet (EML-V); if it is often above
   * `answerMinMs`, raise it here.
   */
  answerMinMs: 1200,
  answerJitterMs: 300,
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

/**
 * Continue with Google (GSI-1; Google spec 3, 7.4 and the copy page 2026-10-26, section 8). The card asks the guard's `sign-in/social`
 * route for Google's address and leaves the site; Neon returns to `/account/` (the only path whose proxy exchanges the verifier) or,
 * on an error, to the page that started.
 */
export const GOOGLE_SIGN_IN = {
  /** Better Auth's provider id; the only social provider the guard forwards. */
  provider: "google",
  /** The card follows Neon's answer only to this host, over HTTPS (anything else reads "We couldn't open Google"). */
  authorizeHost: "accounts.google.com",
  /**
   * Neon Auth's managed service answers `sign-in/social` with its own first hop, `https://<id>.neonauth.<region>.aws.neon.tech/<db>/auth/sign-in/social/init?token=...`,
   * which then sends the browser on to Google (seen on production, 27 Oct 2026). The card follows that hop only on a Neon host and that path.
   */
  neonInitHostSuffix: ".neon.tech",
  neonInitPathSuffix: "/auth/sign-in/social/init",
  /** Where every Google sign-in lands: `proxy.ts` runs the verifier exchange on `/account/*` only (spec 3, gotcha 16). */
  landingPath: "/account/",
  /** The pages that may start it, and so may be its `errorCallbackURL`. */
  startPaths: ["/sign-in/", "/sign-up/"],
  /** The pending mark (`sessionStorage`, a timestamp only) counts for this long after the press; later it is ignored. */
  pendingMaxMs: 10 * 60 * 1000,
  /** The longest `error` code read from the return address; anything longer is the fallback banner. */
  errorCodeMaxLength: 64,
  /**
   * The stop on `/account/` (GSI-2; copy page W3, Q-GC3, strings 23 to 27), decided from the account rows, never from the address:
   * - new: the Google row is the only row and the user was created at most `landingWindowMs` ago, within `linkGapMs` of that row;
   * - linked: the Google row was created at most `landingWindowMs` ago and more than `linkGapMs` after the user.
   * `clockSkewMs` is how far in the future (Neon's clock against ours) a time may be and still count as now.
   */
  landingWindowMs: 10 * 60 * 1000,
  linkGapMs: 60 * 1000,
  clockSkewMs: 2 * 60 * 1000,
  /**
   * User agents of in-app browsers Google refuses (`disallowed_useragent`): Instagram, Facebook (FBAN/FBAV), Line, TikTok. The check
   * only adds a notice; the button stays enabled, since a user agent can be wrong.
   */
  inAppAgents: ["Instagram", "FBAN/", "FBAV/", "FB_IAB", " Line/", "musical_ly", "BytedanceWebview", "TikTok"],
} as const;

// ----- Ways to sign in on Account (GSI-WAYS) ---------------------------------------------------------------------------------------------

/**
 * The guard's three Account routes for "Ways to sign in" (GSI-WAYS; copy page 2.5, strings 29 to 51): `list-accounts` (GET),
 * `link-social` and `unlink-account` (POST). Each needs a signed-in session, so the buckets key on the client IP only (an address is
 * never read here). Reads are what the section does after a change; writes are an Add Google press (each makes Neon store an OAuth
 * state row, review GSI-S B2) or a removal.
 */
export const AUTH_WAYS = {
  /** `list-accounts`: 30 a minute, 300 an hour per client IP. */
  readIp: { bucket: "auth:ways_read:ip", windows: [{ windowS: MINUTE, limit: 30 }, { windowS: HOUR, limit: 300 }] },
  /** `link-social` and `unlink-account` together: 5 a minute, 20 an hour per client IP. */
  writeIp: { bucket: "auth:ways_write:ip", windows: [{ windowS: MINUTE, limit: 5 }, { windowS: HOUR, limit: 20 }] },
  /**
   * Removing Google needs a sign-in at most this long ago (the re-authentication; Better Auth's own `freshAge` default is one day, and
   * Neon refuses an older session with SESSION_NOT_FRESH anyway). Older: "sign out and sign in again" first.
   */
  removeFreshS: DAY,
  /** The SDK's session cookie (`@neondatabase/auth` NEON_AUTH_SESSION_COOKIE_NAME): without it the routes answer 401 before Neon. */
  sessionCookie: "__Secure-neon-auth.session_token",
  /** The return of Add Google lands on `/account/?added=google`; it only chooses the wording (string 35 over 25), never whether to tell. */
  addedParam: "added",
  /** Most Google rows one removal clears (normally one; more would be two Google accounts with the same address). */
  maxGoogleRows: 3,
  /** Most rows read from `list-accounts`; more is not an answer we understand (fail closed). */
  maxRows: 50,
} as const;

/**
 * Display-name changes on the Account page (ACCT-P1; docs/v2/features/account-profile-and-travellers.md 4.2 and 4.3): 10 an hour per
 * signed-in user. The key is the HMAC of the user id (web/lib/account/name-quota.ts), never the id itself. A separate block: nothing
 * in the sign-in guard reads it.
 */
export const PROFILE_NAME = { bucket: "account:profile_name", windows: [{ windowS: HOUR, limit: 10 }] } as const satisfies { bucket: string; windows: readonly Window[] };

/**
 * "Download my data" (`GET /api/account/profile/export/`, ACCT-P3): 5 a hour per signed-in user. Keyed on an HMAC of the user id
 * (web/lib/account/export-quota.ts), never the id. A separate block: nothing in the sign-in guard or the name limit reads it.
 */
export const PROFILE_EXPORT = { bucket: "account:profile_export", windows: [{ windowS: HOUR, limit: 5 }] } as const satisfies { bucket: string; windows: readonly Window[] };

// ----- Account plans (EM-1) --------------------------------------------------------------------------------------------------------------

/**
 * The account plan routes' write bucket (edit-my-trip 4.1; route contract core/src/schema/api/account-plans.ts). Every PUT, DELETE and
 * merge of `/api/account/plans/**` takes one from it, keyed on the HMAC of the verified session's user id (`userHash`), never on an IP:
 * a household behind one address shares nothing. The limit is PLAN_SYNC.writesPerMinute (core/src/config/plans.ts, pinned equal by
 * web/tests/account/plans-route.test.ts). Reads (the list, one document) take nothing: the device refetches on focus and every 60 s (EM7).
 */
export const PLANS_LIMITS = {
  write: { bucket: "plans:write", windows: [{ windowS: MINUTE, limit: 120 }] },
} as const satisfies Record<string, { bucket: string; windows: readonly Window[] }>;
