# Review: Continue with Google and the email-code fixes (GSI-S), release B+C

Reviewer: independent security review (Opus 5.5), 27 Oct 2026. Task GSI-S. Read-only on code; this file is the only change.
Scope: local `main` @ `94bbca1f`, which contains the GSI-1 merge `377f1909` and the EML-F merge `9b65552d`. Files read:
- `web/lib/auth/{guard,google,return-path,flags,answer-hold,oauth-errors,server}.ts`, `web/app/api/auth/[...path]/route.ts`, `web/proxy.ts`;
- `web/components/auth/{SignInCard.tsx,GoogleButton.tsx,api.ts,memory.ts}`, `web/app/sign-in/page.tsx`, `web/app/account/page.tsx`, `web/app/layout.tsx`;
- `web/lib/server/{same-origin,client-ip}.ts`, `web/lib/site.ts`;
- `core/src/quota/keys.ts`, `core/src/config/auth-limits.ts`;
- the SDK `@neondatabase/auth` 0.7.0-beta in `web/node_modules` (`dist/server-i57Km2d6.mjs`: proxy headers, verifier exchange, login redirect);
- `docs/v2/features/google-and-apple-sign-in.md` (sections 3 to 11, 16, 18), `docs/v2/build/review-eml-s-2026-10-27.md` (MF1 to MF4,
  SF1 to SF8), `research/runs/EML-0-spike.md`, `HANDOVER.md` (production settings line);
- the GSI-1 tests in `web/tests/auth/guard.test.ts` (the `sign-in/social` block) and `web/tests/auth/google.test.ts`.

How it was checked: code read line by line; `returnPath` fuzzed with 15 path-normalisation and encoding cases in a scratch script (all
results same-origin, see N5). No service was called, nothing in Neon, Google or Vercel was read or changed, no secret was read.
Vendor docs: Better Auth "Rate limit" and "Users and accounts" (read 27 Oct 2026, links at the end).

**Verdict: the GSI-1 code is sound; Google must stay OFF in production until B1 and B2 are closed and the list in section 4 is true.**
The `sign-in/social` branch is tight: allow-listed, flag-gated before any other work, Origin required, body capped, the body rebuilt
from scratch with both callback URLs built server-side from a checked `next`, only Neon's code passed on an error, and the card
follows Neon's answer only to `https://accounts.google.com`. MF1 to MF4 and SF1 to SF5 from EML-S are fixed as described. What stops
the switch-on is not in this code: account linking safety is still unproven against Neon's server, and the Google start is the one
unauthenticated, unthrottled route that writes to our database.

## 1. Blockers (before `NEXT_PUBLIC_SIGN_IN_GOOGLE=1` in production)

**B1. Linking safety is asserted, not demonstrated, and it matters today, not only at switch-on.**
- Spec 5.1 L2 and 7.1 rely on Neon refusing an implicit link to an unverified local account (CVE-2026-53516 fix,
  `requireLocalEmailVerified`). The only evidence is EML-0's version fingerprint on the child branch (`EML-0-spike.md:17-23`: server
  is 1.7.0-rc.2 or later). EML-0 itself calls it "strong but indirect: Neon could patch its fork". The behavioural gate L1 (spec 10.3,
  "Fail stops the plan") has not run: section 18 holds only the GSI-1 build notes.
- Better Auth's own docs do not promise a local `emailVerified` check for implicit linking; they say linking happens "if the provider
  confirms the user's email as verified" (Users and accounts). So the protection is version behaviour, not a documented contract.
- Production has **Require Verification off** (`HANDOVER.md:11`), so every password account created so far is unverified: every one of
  them is a pre-registered row if Neon links implicitly.
- The production branch already has the owner's Google client (`HANDOVER.md:11`, PLAN R-83). Neon's base URL is public (EML-S MF1),
  and `NEXT_PUBLIC_SIGN_IN_GOOGLE` only gates our proxy (`guard.ts:346`). An attacker can call Neon's `sign-in/social` directly with
  `callbackURL` on the trusted production origin, hand the resulting Google consent URL to a victim, and Neon runs its callback (user
  creation and implicit linking) whatever our flag says. The verifier exchange on our side does not matter for the linking side effect.
- GSI-2's "stop" on `/account/` after a new account or a link (`account/page.tsx:89-92`, section 18 "until then a link would be
  silent") is **not a security control**: it is shown to whoever just completed the Google flow, which in a takeover is the attacker.
  It helps an honest user understand what happened; it does not prevent anything.

Fix:
1. Run L1 now (child branch, settings identical to production: Require Verification off, then again with it on) and record it in
   section 18. Pass: Google sign-in for an address with an unverified password row is refused `account_not_linked`, no `account` row
   with `provider_id = 'google'` is created for that user, no session is issued.
2. Until L1 passes, delete the Google provider from the production branch (spec 11 rollback step 2; zero Google users exist, so it
   costs nothing). Re-add it when L1 passes.
3. Switch Require Verification on in production (O-E1) before Google, and record the count of existing unverified password accounts
   (owner SQL, no addresses printed). Those rows stay refused under L2 and are reached only through "Email me a code".
4. If Neon ever exposes `disableImplicitLinking` (spec U2; not in the CLI or console today), turn it on until an owner notice mail for
   "Google was added to your account" exists (Phase 2 sender). Better Auth documents that it returns `account_not_linked` for every
   same-email OAuth sign-in while `linkSocial()` from Account keeps working, which is exactly L4.

**B2. The Google start has no limit of ours, and Neon's limit cannot tell visitors apart.**
`guard.ts:343-389` (and the comment at `guard.ts:55-59`) takes no Turnstile and no quota because "it sends no mail and creates no
account". Both are true, but:
- Each call makes Neon write an OAuth state/verification row in the `neon_auth` schema of **our** Neon project and keeps the compute
  awake. A loop of same-origin-looking POSTs (`curl` sets any `Origin`; the origin check is a CSRF control, not a bot control) is a
  storage and compute-hours drain on the free tier, which takes the whole data layer (drafts, favourites) down when the hours run out.
- The SDK forwards only `user-agent`, `authorization`, `referer`, `content-type` and `x-neon-client-info`
  (`server-i57Km2d6.mjs:1142-1148`, `:1251-1258`): no `x-forwarded-for`. Better Auth keys its limiter on `x-forwarded-for` (Rate limit
  docs), so Neon sees Vercel's egress address. One abuser therefore trips Neon's limiter for every visitor sharing that egress, and the
  card shows string 14 ("Too many sign-in attempts") to everyone.
Fix: add one bucket in `core/src/config/auth-limits.ts`, `socialIp` (`auth:social:ip`, for example 10 a minute and 40 an hour), taken
in `social()` after the origin and body checks with the same fail-closed rule as the guarded routes (503 `GUARD_UNAVAILABLE` without the
store in production). No Turnstile: the button must stay one press. Add a route test for the 429 with Retry-After and one that the
bucket key is the IP hash, never the address.

## 2. Should-fix

**S1. The callback origin comes from the request, not from configuration** (`guard.ts:369`). `originOk` proves Origin equals Host, so
an attacker cannot point `callbackURL` at a foreign host. But on Vercel every deployment of the project answers on its own
`*.vercel.app` URL, so `callbackURL` follows whichever host the request used, and the only control left is Neon's trusted-domain list.
Defence in depth is cheap: in production build both URLs from `siteOrigin()` (`web/lib/site.ts:6-15`, already required on production
builds) and refuse the start with 403 when the request origin differs. Keep the request origin for `NODE_ENV` development and test.

**S2. Query strings reach Neon untouched on every proxied route.** `rebuild` (`guard.ts:175-180`) keeps `request.url`, and the SDK
copies `originalUrl.search` onto the upstream URL (`server-i57Km2d6.mjs:1243-1248`). The "body rebuilt, nothing else passes" rule (SF1,
and `google.ts:61` for social) therefore has a side door: Better Auth endpoints read some values from `query` (callback and current
URLs among them). No exploit was found, but the guarantee as written is false. Fix: rebuild POSTs with `new URL(request.url)` minus its
`search`; for `get-session` keep only `disableCookieCache` if anything. Test with `?callbackURL=https://evil.example/` on
`sign-in/social` and `sign-up/email`.

**S3. IPv6 makes every per-IP key per-host-address** (`client-ip.ts:19-25`, `keys.ts:33-43`). A single host with a /64 has 2^64
addresses, so `sendIp`, `verifyIp`, `passwordIp` and the new `addr_ip` buckets are free to evade. Consequences: SF3's goal fails
(one host rotating addresses reaches the address-only ceiling of 60 per 15 minutes and locks the owner out again), `sendIp` stops
nothing, and the global send cap (30 a day) can be drained from one machine (still one Turnstile solve per send). Fix: key IPv6 on its
/64 (and fold IPv4-mapped `::ffff:a.b.c.d` to the IPv4 form) inside `ipHash` and `addressIpHash`, so every caller gets it. This also
makes the privacy page's "each network" true (EML-S SF6). B2's `socialIp` inherits the fix.

**S4. The SF3 ceiling raised the per-address password budget six-fold.** `passwordAddr` is 60 per 15 minutes (`auth-limits.ts:47`):
5,760 guesses a day against one address from a few networks (or one IPv6 host, S3), against 960 before EML-F. With an 8-character
minimum and no breached-password check that is a real online-guessing budget. Fix: add a day window to `passwordAddr` (for example
200 a day) and to `verifyAddr`, or count only failed attempts toward the address ceiling.

**S5. The Google flag is not a server-side kill switch, and spec 11 says it is.** See B1: with the provider configured on a branch,
Google sign-in, account creation and implicit linking work through Neon directly whatever `NEXT_PUBLIC_SIGN_IN_GOOGLE` says. Fix: in
spec 11 rollback step 1, say "removes our button and our proxy route only"; make step 2 (delete the provider) the real off switch; and
keep the production provider deleted whenever Google is meant to be off.

**S6. Login CSRF rests on a Neon behaviour no test covers.** The SDK only checks that *a* challenge cookie is present before the
exchange (`server-i57Km2d6.mjs:1436-1452`, `:1466-1472`); whether the verifier is bound to *that* cookie's value is decided on Neon's
server. OAuth `state` cannot carry this binding here, because the state cookie would be on our origin while Google returns to Neon's.
Spec R3 tests a missing cookie only. Fix: add R3b to GSI-E: start a flow in browser A, stop at Neon's redirect, open
`/account/?neon_auth_session_verifier=<A's verifier>` in browser B that holds its own, different challenge cookie from an earlier press;
pass is no session in B.

**S7. The verifier can land on pages with third-party script, and in platform logs.** On a failed exchange the SDK's login redirect
copies every query parameter, the verifier included, to `/sign-in/` (`server-i57Km2d6.mjs:1667-1670`). The Cloudflare beacon is
rendered on every page (`web/app/layout.tsx:49-50`), including `/sign-in/` and `/account/`, against spec 7.1 ("no analytics on
`/account/`"); the card strips the verifier only after the lazy chunk hydrates. Vercel's request logs record the full URL of
`/account/?neon_auth_session_verifier=...` on every successful return. The verifier is single-use and cookie-bound (if S6 holds), so
this is low, but the spec promises otherwise. Fix: omit the beacon on `/account/`, `/sign-in/` and `/sign-up/` (or confirm in writing
that Cloudflare Web Analytics drops query strings), and record the Vercel log exposure as accepted in spec 7.1.

**S8. Neon's limiter is shared by all our users on the email routes too** (same root cause as B2; not Google-specific). Better Auth's
default rule for `/sign-in/email` is 3 requests per 10 seconds per IP (Rate limit docs); through our proxy that IP is Vercel's egress.
A burst of four honest password sign-ins, or an attacker staying inside our per-IP quotas from several networks, gets Neon 429s for
everyone. Fix: EML-V measures it on the child branch (four `sign-in/email` calls through the proxy within 10 seconds from two
clients); if confirmed, ask Neon whether the proxy may pass a trusted client-IP header, and record the residual risk in email spec 5.1.

## 3. Notes

- **N1. No one tells the account owner when Google is added.** With L1 implicit linking (verified accounts), anyone who controls the
  address at Google gets in silently. For a live mailbox that is no new power (email-code sign-in already grants it), but a Google
  account created on an address someone once controlled (an old employer domain, a lapsed custom domain) keeps working after the
  mailbox moves on. The fix is a "Google was added to your account" mail once the Phase 2 sender exists, and GSI-2's Ways to sign in
  list, which is the only place an owner can notice. Add to spec 16 as a known issue.
- **N2. String 20 sends a pre-registration victim to a dead end.** `account_not_linked` says "Sign in with your email first"
  (`oauth-errors.ts:28`); a victim of a pre-registered row has no password. It should offer "Email me a code" (or reset), which proves
  the mailbox. EML-V should confirm that a reset by code sets `emailVerified` and that `revokeSessionsBefore` evicts the
  pre-registrant's sessions.
- **N3.** `sign-out` POST is forwarded without the 4 KB cap (`guard.ts:402-407`); the SDK reads the whole body into memory
  (`server-i57Km2d6.mjs:1262-1264`). Vercel's own body limit bounds it; apply `readCapped` for consistency.
- **N4. Flag-off behaviour is right.** With `signInGoogle` off the route answers the same 404 body as any unknown path, before the
  origin check and before Neon (`guard.ts:346-349`, `guard.test.ts` "with NEXT_PUBLIC_SIGN_IN_GOOGLE off ... never reaches Neon");
  with `signIn` off the route handler answers 404 before the guard (`route.ts`, `live()`). The flag is build-time
  (`flags.ts:27-39`), so a change needs a redeploy, as spec 11.2 says.
- **N5. `next` is sound.** `returnPath` (`return-path.ts:11-37`) held against `/.//evil`, `/trips/..//evil`, `/trips/.././/evil`,
  `/trips/%2e%2e/%2e//evil`, `/%09/evil`, `/t/../../evil` and CRLF: all `/account/`. `/trips/x/..//..//evil` normalises to
  `/trips//evil`, which is still a same-origin path (Next's `redirect` emits it relative to our host, and the `//` is not at the start).
  `/account/?next=/account/?next=...` chains peel one level per load and are bounded by the 512-character cap. `googleCallbacks`
  (`google.ts:63-71`) ignores every path the browser sends and reads only `next`, so `callbackURL` is always `/account/`. The account
  page redirects only after `getUser()` (`account/page.tsx:97`).
- **N6. SF3 as built is correct** apart from S3 and S4: `addressIpHash` (`keys.ts:33-37`) is a day-salted HMAC under its own scope,
  `rulesFor` takes `addr_ip`, `addr` and `ip` in one atomic take (`guard.ts:283-287`), a missing IP falls to the strict shared
  `unknown` key, and the IP is never logged (`guardLog` drops IP-shaped values, `guard.ts:215-223`).
- **N7. SF5 answer hold is correct** (`answer-hold.ts:10-14`, `guard.ts:423-426`): monotonic clock, clamped random, applied to every
  outcome of send and sign-up after the origin check. It holds a function for about 1.2 to 1.5 s per send; at these volumes the cost is
  nil. EML-V still has to measure Neon's own time against `answerMinMs`.
- **N8. Logs.** The social branch logs fixed codes only (`guard.ts:344-345`, `:386`); Neon's error message is never passed on. The SDK
  logs at `warn` by default and its `detail` fields are error codes (`server-i57Km2d6.mjs:773-783`, `:883-898`), not URLs.
- **N9. Origin source.** `sameOrigin` compares Origin with Host and requires HTTPS outside development and test
  (`same-origin.ts:7-23`); `originOk` refuses a missing Origin on every non-GET (`guard.ts:312-314`). Good. The string `null` Origin
  fails `new URL` and is refused.

## 4. Must be true before Google is ON in production

Code (each a merged commit with tests):
1. B2: `auth:social:ip` bucket on `sign-in/social`, fail closed without the store.
2. S1: production callback URLs built from `SITE_ORIGIN`, a foreign request origin refused.
3. S2: query strings stripped from proxied POSTs.
4. S3: IPv6 keyed on /64 in `keys.ts` (it also fixes SF3's lockout goal).
5. GSI-2 merged: Ways to sign in on `/account/` (so an owner can see and remove a linked Google) and its post-link stop. Recorded as
   transparency, not as the linking control (B1).

Neon production branch `br-soft-glade-b4mkqyvd` (settings by name, no values):
6. L1 passed and recorded in spec section 18 on a branch configured like production (B1); L3, R1 to R4 and R3b (S6) passed on the
   HTTPS preview (GSI-E). Until L1 passes, the Google provider is deleted from production.
7. Require Verification **on** (O-E1), send verification email on sign-in **off** (EML-S MF2); the count of remaining unverified
   password accounts recorded.
8. Trusted domains exactly `https://travel-beta-tan.vercel.app` (no wildcard, no preview hosts); Allow Localhost **off**;
   `organization` plugin **disabled** (EML-S MF1, MF3).
9. Google provider is the owner's own client (`custom`), not Neon's shared one; R1 shows scopes exactly `openid email profile`, a
   `state`, and `code_challenge_method=S256`.
10. `travel_app` has no privilege on any `neon_auth.*` table (spec 6.2), checked as the owner role.

Google Cloud and Vercel:
11. The `travel-prod` client lists only the production Neon callback as redirect URI and no JavaScript origins; its secret exists only
    in Neon and the owner's password manager.
12. Vercel Production: `SITE_ORIGIN` set, `AUTH_GUARD` unset, `AUTH_QUOTA_SECRET` and `TURNSTILE_SECRET_KEY` set and Sensitive, migration
    `0011_quota.sql` applied (EML-S SF7), `NEXT_PUBLIC_SIGN_IN=1`, `NEXT_PUBLIC_SIGN_IN_GOOGLE` non-sensitive (prebuilt deploys).
13. S7: no analytics beacon on `/account/`, `/sign-in/`, `/sign-up/`, or written confirmation that it drops query strings.
14. Spec 11 rollback rewritten per S5, and the owner knows that turning the flag off does not stop Google at Neon.

## 5. Positive

The allow-list (MF3) means the Google route is the only new surface, and it is opt-in. Both callback URLs are rebuilt server-side and
the browser-chosen path is discarded. `errorCallbackURL` can only be `/sign-in/` or `/sign-up/`. The card validates Neon's answer to
`https://accounts.google.com` without credentials in the URL before leaving. The return reads `error` through a fixed map and never
echoes it, strips `error`, `error_description` and the verifier with `replaceState`, and stores only a timestamp and a method name in
the browser. No code reads `user.image` (pinned by a test). The guard tests cover flag off, GET, foreign, HTTP and missing Origin,
oversize and bad bodies, another provider, the rebuilt body and Neon's 429.

## Sources

- Better Auth, Rate limit (defaults 100 per 10 s; `/sign-in/email` 3 per 10 s; IP from `x-forwarded-for`):
  https://www.better-auth.com/docs/concepts/rate-limit
- Better Auth, Users and accounts (implicit linking, `trustedProviders`, `disableImplicitLinking`):
  https://www.better-auth.com/docs/concepts/users-accounts
- `@neondatabase/auth` 0.7.0-beta, `web/node_modules/@neondatabase/auth/dist/server-i57Km2d6.mjs` (read 27 Oct 2026).
