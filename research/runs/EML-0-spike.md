# EML-0: Neon Managed Better Auth email features on the child branch

Run id: `EML-0-spike` · 25 Oct 2026, 18:10 to 18:25 UTC · model: Opus 5.5 (`claude-opus-5-5`) · lane: spike, no
product code · plan: [email-sign-in-and-account-emails.md](../../docs/v2/features/email-sign-in-and-account-emails.md)
section 13 (EML-0) · owner actions: [EML-0-spike-wait.md](EML-0-spike-wait.md).

Scope: Neon project `damp-queen-64719841`, child branch `br-damp-breeze-b41mtvn5` (`srv-migrate-verify`) only. The
production branch `br-soft-glade-b4mkqyvd` got read-only `get`/`list` calls only. Calls went to the child's Neon Auth
base URL (`https://<host>.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth`) with `Origin: http://localhost:3000`,
and to the app's own `/api/auth/*` proxy on `next dev` at `http://localhost:3100`, run from this worktree with an
env file that held only child values. Port 3000 was held by another process (PID 59748, not this run; left alone), and
Allow Localhost covers any localhost port. Secrets stayed in a mode-600 scratchpad outside the repo. Addresses are
shown as their plus alias only (`+eml0-N` = the owner's Gmail plus address). No mailbox was read.

## Summary

- **CVE-2026-67327 (gate M1): the version evidence passes; the behavioural test needs the owner.** Neon's server
  publishes its OpenAPI schema. That schema contains description strings that first appear in upstream
  `better-auth` v1.7.0-rc.2 and are missing from every 1.6.x tag and from 1.7.0-beta.9. It also lacks strings that
  1.7.0 removed. So the server runs 1.7.0-rc.2 or later, which is after both fixed versions (1.6.22 and
  1.7.0-beta.10). Every tag from rc.0 on contains `revokeUnprovenAccountAccess` (the CVE-2026-67327 fix) and
  `requireLocalEmailVerified` (the CVE-2026-53516 fix). This is strong but indirect: Neon could patch its fork. M1
  itself needs a real sign-in code (wait file W2).
- **Email OTP is live although `plugins list` shows no `email_otp` entry.** All `/email-otp/*` routes and
  `/sign-in/email-otp` exist (400 validation on `{}`), sends answer `{"success":true}` and write a code row. Magic
  link is 404 (plugin off).
- **Codes last 5 minutes, not the 15 minutes Neon's docs say.** The row TTL was 300 s for all three types. Codes are
  stored hashed (43 characters), so the database cannot leak them. 3 wrong codes, then the 4th call gets 403
  `TOO_MANY_ATTEMPTS` and the code is deleted.
- **Enumeration leak in the opaque sign-up answer.** With Require Verification on, sign-up for an existing address
  returns 200 `{"token":null,"user":{...}}` like a new one, but the synthetic user has `"role":null` while a real new
  user has `"role":"user"`. With Require Verification off, an existing address gets 422
  `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. EML-Q must rewrite the sign-up response body (never forward Neon's).
- **Disable Sign Up does not cover code sign-in.** With it on, password sign-up is refused (400
  `EMAIL_PASSWORD_SIGN_UP_DISABLED`), but a sign-in code is still issued to an unknown address. Whether verifying that
  code then creates an account is owner-needed (W2).
- **Require Verification sends a code at sign-up even with "send on sign-up" off.** So turning on O-E1 alone starts
  sending codes from the shared sender.
- **`neon neon-auth user create` makes an unverified user with a password-less credential account** and no session.
- **A rate limiter is active**: `/sign-in/email` answered 429 on the 5th wrong attempt within about 1 s, with
  `x-retry-after: 10` and body `{"message":"Too many requests. Please try again later."}` (no `code`).
- Settings changed on the child were restored and checked by diff; the 4 test users were deleted. Production
  unchanged (diff of `get` output, start against end).
- Emails: 5 code mails were most likely sent (a code row was written), and at most 10 in total if Neon also sends
  notices that leave no row. Cap 12.

## Settings baseline (child, before any change; restored at the end)

| Setting | Value | Command |
|---|---|---|
| Email and password | `enabled` true, `email_verification_method` otp, `require_email_verification` false, `auto_sign_in_after_verification` true, `send_verification_email_on_sign_up` false, `send_verification_email_on_sign_in` false, `disable_sign_up` false | `neon neon-auth config email-password get` |
| Email provider | `shared`, `auth@mail.myneon.app`, "Neon Auth" | `config email-provider get` |
| Webhook | `enabled` false, `enabled_events` [], `timeout_seconds` 5 | `config webhook get` |
| Plugins | `organization` on (limit 10, membership 100, creator owner, no invitation mail); `magic_link` off (`expires_in` 5, `disable_sign_up` false); `phone_number` off (`otp_expires_in` 300); `oauth_provider` off; `email_and_password` as above; `allow_localhost` true; no `email_otp` key | `plugins list` |
| Trusted domains | none | `domain list` |
| OAuth | `google`, type `standard` (own client) | `oauth-provider list` |
| Users | 0 | `neon_auth.user` count |

What the CLI (8.11.1) can change: every email-password flag above (`config email-password update`), the email provider
(`config email-provider update`, plus `test` for custom SMTP), webhooks (`config webhook update --enabled
--url --enabled-events user.before_create|user.created|send.otp|send.magic_link --timeout 1-10`), organization
settings, trusted domains, OAuth providers, and users (`user create --email --name`, `user delete <id>`,
`user set-role`; no `list` or `get`). Read only: `plugins get|list`. **Not in the CLI:** the magic link plugin (console
toggle or API `PATCH .../auth/plugins/magic-link`) and Allow Localhost.

## Changes made on the child, in order (all UTC, 25 Oct)

| Time | Change | Restored |
|---|---|---|
| 18:12:58 | `user create` +eml0-6 | user deleted 18:23 |
| 18:14:23 | `--require-email-verification true` | 18:16:43 |
| 18:16:05 | `--disable-sign-up true` | 18:16:43 |
| 18:16:43 | `--send-verification-email-on-sign-up true` (with require false, disable false) | 18:22:52 (all seven flags set back to the baseline) |
| 18:12 to 18:17 | test users +eml0-1, +eml0-2, +eml0-3, +eml0-6 created | all 4 deleted 18:23; users, sessions, accounts all 0 |

End check: the full `get`/`list` output of the child equals the baseline (`diff` empty). Code rows left in
`neon_auth.verification` expire on their own (5 minutes).

## 1. Version fingerprint (U3, L1)

- `GET /open-api/generate-schema` and `GET /reference` answer 200 with no session: the Better Auth OpenAPI plugin is
  on and public. `info.version` is the plugin's constant "1.1.0", not the package version. 79 paths, including
  `admin/*`, `organization/*`, `email-otp/*`, `/verify-password`, `/update-session`, and `/token/anonymous` (not in
  upstream; Neon's own).
- A blobless clone of `better-auth/better-auth` was checked with `git grep` only (nothing executed). Neon's schema
  holds "The Better Auth account ID", "Select the current OAuth account from its signed cookie" and "Return the
  provider logout URL without redirecting". Present in tags v1.7.0-rc.2 through v1.7.13, absent in v1.7.0-rc.1,
  v1.7.0-beta.9 and v1.6.33 (the newest 1.6). Neon's schema lacks "The provider ID for the OAuth provider", which
  1.7.0 removed.
- Fix markers by tag: `revokeUnprovenAccountAccess` (GHSA-qq9h-g4jm-xgf3, CVE-2026-67327; commit c06a56d (private history)) absent in
  v1.6.21 and v1.7.0-beta.9, present from v1.6.22, v1.7.0-beta.10 and every rc. `requireLocalEmailVerified`
  (GHSA-g38m-r43w-p2q7, CVE-2026-53516) present in every 1.7.0-rc and 1.7.x tag.
- `/forget-password` (the old link reset) is 404 while `/request-password-reset` exists, consistent with the above.
- Advisory facts (GitHub advisory API, read 25 Oct): GHSA-qq9h-g4jm-xgf3 affects `>=1.1.3 <1.6.22` and
  `>=1.7.0-beta.0 <1.7.0-beta.10`. The fix removes the password (`credential` account) and revokes sessions when
  a magic link or sign-in OTP adopts an account whose email was never verified.

## 2. Mailbox-free checks

Responses are shown with ids and tokens redacted.

| # | Request | Status, body | Notes |
|---|---|---|---|
| E1 | `POST /email-otp/send-verification-otp` `{}` | 400 `VALIDATION_ERROR`, `type` one of `email-verification`, `sign-in`, `forget-password`, `change-email` | route exists |
| E2 | `POST /sign-in/email-otp` `{}` | 400 `VALIDATION_ERROR` (email, otp) | exists; OpenAPI body: email, otp, name, image |
| E3 | `POST /forget-password/email-otp`, `/email-otp/request-password-reset`, `/email-otp/reset-password`, `/email-otp/verify-email`, `/email-otp/check-verification-otp`, `/request-password-reset`, `/send-verification-email` `{}` | 400 `VALIDATION_ERROR` each | exist (`/forget-password/email-otp` is marked deprecated) |
| E4 | `POST /sign-in/magic-link` `{}`; `GET /magic-link/verify?token=x` | 404 empty | magic link off |
| E5 | `POST /forget-password` `{}` | 404 | old route gone |
| E6 | `GET /ok`, `/get-session` | 200 `{"ok":true}`, `null` | no rate-limit headers on success |
| S1 | sign-up new +eml0-3, require off | 200 `{token, user{emailVerified:false, role:"user"}}`, sets `__Secure-neon-auth.session_token` (7 days) | **session before verification** when not required |
| S2 | sign-up +eml0-3 again, require off | 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | enumeration |
| S3 | same, upper-case address | 422, same | lower-cased |
| S4 | same, address with spaces around | 400 `[body.email] Invalid email address` | not trimmed: the proxy must trim |
| S5 | sign-in +eml0-3 correct password, unverified, require off | 200, token, cookie | |
| S6 | sign-in wrong password / unknown address | 401 `INVALID_EMAIL_OR_PASSWORD` both | no enumeration |
| R1 | 5 wrong sign-ins in about 1 s | 401 x4, then 429 `x-retry-after: 10`, `{"message":"Too many requests. Please try again later."}` | limiter on; key (IP or IP+address) not determined |
| C1 | `neon neon-auth user create` +eml0-6 | user `emailVerified` false, `credential` account with `password` null, 0 sessions, no code row | U10 |
| V1 | require **on**: sign-in +eml0-3 correct password | 403 `EMAIL_NOT_VERIFIED`, no cookie, `get-session` null | A correct password is distinguishable (403 against 401) |
| V2 | require on: sign-in wrong password | 401 `INVALID_EMAIL_OR_PASSWORD` | |
| V3 | require on: sign-up existing +eml0-3 | 200 `{"token":null,"user":{... "role":null ...}}`, no cookie, no code row | **`role` null gives it away** |
| V4 | require on: sign-up new +eml0-2 | 200 `{"token":null,"user":{... "role":"user" ...}}`, no cookie; **code row `email-verification-otp`** written although send-on-sign-up was false | |
| V5 | require on: sign-up +eml0-2 again | 200, `role` null | repeat of V3 |
| O1 | send sign-in code to unknown +eml0-4 | 200 `{"success":true}`; row `sign-in-otp-...`, TTL 5:00; no user row at send | |
| O2 | reset code to unknown +eml0-5 | 200 `{"success":true}`; no row (nothing sent) | same answer as O5: no enumeration |
| D1 | disable-sign-up **on**: sign-in code to unknown +eml0-4 | 200 `{"success":true}`; **new** row (the earlier row was kept, not replaced) | Disable Sign Up does not stop the send |
| D2 | disable-sign-up on: password sign-up +eml0-8 | 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` | |
| O4 | send-on-sign-up **on**, require off: sign-up +eml0-1 | 200, token and cookie, row `email-verification-otp` | the flag works |
| O5 | reset code to known +eml0-1 | 200 `{"success":true}`, row `forget-password-otp`, TTL 5:00 | |
| A1 to A4 | wrong sign-in code for +eml0-4, 21 s apart | 400 `INVALID_OTP` x3, then 403 `TOO_MANY_ATTEMPTS`; the stored attempt counter went 1, 2, 3, then the row was deleted; no user created | U9 |
| A5 | sign-in code for an address with no code issued | 400 `INVALID_OTP` | same as a wrong code |
| A6 | wrong code on `verify-email`, `reset-password`, `check-verification-otp` | 400 `INVALID_OTP` each | |
| A7 | wrong code after expiry (+eml0-2) | 400 `OTP_EXPIRED` | expiry is distinguishable from wrong |

Code storage: the `value` column holds a 43-character hash plus `:<attempts>`; only the length and the counter were
read, never the value.

Through the app proxy (`next dev`, `http://localhost:3100`, child env):

| # | Request | Result |
|---|---|---|
| P0 | any path without a trailing slash | 308 to the slashed path (`trailingSlash: true`) |
| P1 | `POST /api/auth/email-otp/send-verification-otp/` `{}` | 400 `VALIDATION_ERROR`: forwarded |
| P2 | `POST /api/auth/sign-in/email-otp/` `{}`, then a wrong code | 400 `VALIDATION_ERROR`, 400 `INVALID_OTP`: forwarded |
| P3 | `POST /api/auth/sign-in/magic-link/` | 404 |
| P4 | `POST /api/auth/sign-in/email/` correct password | 200; sets `__Secure-neon-auth.session_token` (SameSite Lax) and `__Secure-neon-auth.local.session_data` (Max-Age 299); `get-session` through the proxy returns the session |
| P5 | same with `Origin: https://evil.example` | 403 `INVALID_ORIGIN` |

The dev server (PID 39831) was stopped by PID; the worktree stayed clean.

## 3. Account-takeover gates

- **M1 (CVE-2026-67327):** version evidence passes (section 1). The behavioural test is designed and waits for one
  code (wait file W2). Setup: password sign-up of a fresh alias (the "attacker"), keep its session cookie; request a
  sign-in code for that address; the owner pastes the code within 5 minutes; `POST /api/auth/sign-in/email-otp/`.
  Pass: (1) password sign-in with the attacker's password gets 401; (2) the attacker's cookie gets `get-session` null;
  (3) the `credential` account row is gone and `emailVerified` is true; (4) the same code again gets
  `INVALID_OTP`. Any other result fails the gate, and R-100 and R-102 stop.
- **L1 (CVE-2026-53516):** version evidence passes (the fix is in every 1.7.0-rc). The behavioural test needs a human
  Google login (wait file W3).

## 4. Delivery (budgeted)

Code rows written, each most likely one mail from the shared sender (times UTC, 25 Oct): +eml0-2 verification
18:14:52; +eml0-4 sign-in 18:15:39 and 18:16:27; +eml0-1 verification 18:17:10; +eml0-1 reset 18:17:13. No row, so
no mail expected unless Neon sends notices: +eml0-6 (CLI create 18:12:58), +eml0-3 (refused sign-in 18:14:51,
existing sign-up 18:14:52), +eml0-2 (existing sign-up 18:15:05), +eml0-5 (reset for unknown 18:15:39). Every code
has expired and its account is deleted, so the owner only reports what arrived (W1). Wrong-code, reuse and resend
tests with a real code wait for W2.

## 5. Webhooks (read only; nothing enabled)

From the CLI help and Neon's Webhooks guide (`neon.com/docs/auth/guides/webhooks.md`, read 25 Oct):

- Enabling `send.otp` or `send.magic_link` makes them **blocking**. They **replace** Neon's mail for every flow on that
  branch: sign-in, email-verification and forget-password for codes; the same three `link_type`s for links. There is
  no fallback. If 3 attempts fail, or the 15 s global budget runs out, the auth call fails and the user sees an error.
- Retry: 3 attempts (1 + 2), immediate, no backoff. The per-attempt timeout is the lesser of `timeout_seconds` (1 to
  10, default 5) and the time left. Retries on 5xx, 408, 429 and network errors; not on other 4xx. Each retry
  carries the same `X-Neon-Event-Id`.
- URL rules: HTTPS only, a hostname (no IP), no localhost or private or metadata targets, **no redirects**, DNS
  pinned during delivery. No test events, logs or redelivery. A tunnel is the documented local route.
- Disabling (`--enabled false`) restores Neon's own mail.
- Gaps: the guide lists `otp_type` as sign-in, email-verification or forget-password, but the server also accepts
  `change-email` (and has `/email-otp/request-email-change`). `user.created` lists `auth_provider` as credential,
  google, github or vercel, with no value for code sign-ups (U12 stays open for the EML-W rehearsal).

## 6. Not verified

M1, L1, M2, a successful code sign-in, account creation by code (with and without Disable Sign Up), reset by code
and session revocation on reset, resend behaviour (whether the first code stays valid), the shared sender's limits,
Resend sandbox (U11: the key exists only in the production env file, out of bounds here), `user.created`
`auth_provider` (U12), and Vercel protection (U13: the alias answers `DEPLOYMENT_NOT_FOUND`).
