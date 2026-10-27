# Review: emailed-code sign-in and account email (EML-S), R4 auth and mail

Reviewer: independent security audit (Opus), 27 Oct 2026. Task EML-S.
Scope: the code on `main` @ `3551d604`. The auth files are byte-identical to `bb804e73`. Files reviewed:
- `web/app/api/auth/[...path]/route.ts` and `web/lib/auth/**` (guard, flags, server, client, return-path, revoke, auth-errors);
- `web/components/auth/**` and the pages `/sign-in/`, `/sign-up/` and `/sign-in/reset/`;
- `web/lib/server/{same-origin,client-ip,turnstile,mailer,neon-env}.ts` and `web/proxy.ts`;
- `core/src/config/auth-limits.ts`, `core/src/mail/**`, `core/src/quota/**` and migration `0011_quota.sql`;
- `web/app/privacy/PrivacyBody.tsx`;
- the tests `web/tests/auth/**` and `web/tests/e2e/auth-email*.ts`.

The specs read were [email-sign-in-and-account-emails.md](../features/email-sign-in-and-account-emails.md) (Decision 25 Oct, sections
5, 10, 11 and 16, and the EML-0, EML-M, EML-Q and EML-1 notes), `research/runs/EML-0-spike.md`, and the SDK proxy in
`web/node_modules/@neondatabase/auth` 0.7.0-beta.

How it was checked: the code was read line by line. `npx vitest run tests/auth tests/shell/privacy-page.test.ts` passed 173 of 173.
No external service was called, no mail was sent, nothing in production was touched and no secret was read.

**Verdict: switch on after fixes.** The guard itself is careful work. It fails closed in production, the identical-answer logic is
tested, keys are HMACs, logs carry fixed codes only, the recipient guard holds owner alerts to `OWNER_EMAIL`, revocation after a reset
works, and `return-path.ts` is sound. Four problems decide the verdict. Neon's own endpoint can be reached around the guard. The planned
O-E1 setting turns password sign-in into an unguarded mail sender. The proxy allows by default any Neon route it does not know. And the
code flag only hides the UI. Each one has a cheap fix or a console setting.

## Must-fix (before `NEXT_PUBLIC_SIGN_IN_CODE=1` and O-E1)

**MF1. The guard can be bypassed by calling Neon directly. Allow Localhost is on in production.**
`guard.ts` is the only place where Turnstile, the quotas and the identical answers run (spec E7). The Neon Auth base URL is a public
host: EML-0 called the child branch's base URL directly from a script with `Origin: http://localhost:3000` (EML-0-spike.md line 9),
and Neon's OpenAPI reference is public. On production, `allow_localhost` is `true` (spec, research table), so any script that sends
`Origin: http://localhost` passes Better Auth's origin check. A script with no `Origin` and no cookie is probably accepted too; this is
not verified. That script reaches `/email-otp/send-verification-otp`, `/sign-up/email` (with the `role` leak of U8) and the code checks
with no Turnstile and none of our buckets. The only limits left are Neon's, and they are unpublished. The host leaks to visitors
anyway: once Google ships it appears in the OAuth `redirect_uri`, and it is in `iss` for MCP.
Fix:
- (a) Turn Allow Localhost off on the production branch. Local runs then use the child branch, which ends the gotcha "local development
  hits production".
- (b) EML-V proves, on the child branch only, whether a POST with no `Origin` header to `<base>/email-otp/send-verification-otp` is
  accepted.
- (c) If it is accepted, record in spec 5.1 that the guard stops abuse through the site but is not a boundary. Neon's limiter is then
  the only control on third-party mail bombing, and the owner accepts that residual risk for Phase 1 by name.

**MF2. O-E1 sets `--send-verification-email-on-sign-in=true`, which makes `/sign-in/email` send mail with no guard.**
Spec 10, O-E1. `guard.ts:67` and `rulesFor` (`guard.ts:240`) treat `sign-in/email` as `password`. That means no Turnstile and none of
the `auth:send:*` buckets. With the setting on, every password sign-in to an unverified account mails a code. Here is the attack. Sign
up `victim@` once with a known password (one Turnstile solve). Then replay `sign-in/email` with that password. It is bounded only by
`auth:password:addr`: 10 per 15 minutes, which is 960 codes a day to one victim. None of those sends count toward `auth:send:global`, so
the same replay also drains Neon's shared-sender limit for every visitor. The card depends on the setting: `SignInCard.tsx:198`
(`toVerify`) goes to the code step without asking for a send.
Fix: run O-E1 with `--send-verification-email-on-sign-in=false`. In the card, on `403 EMAIL_NOT_VERIFIED`, call
`email-otp/send-verification-otp` with `type: 'email-verification'` and a Turnstile token. That call is guarded and draws from every
send bucket. Add a guard test that `sign-in/email` never counts as a send. Before switching it on, confirm on the child branch whether
Neon sends a code on sign-in when the setting is true.

**MF3. The proxy allows by default, and the `organization` plugin is enabled.**
`guard.ts:285`: any path missing from `ROUTES` is forwarded untouched, with no same-origin check, no body cap and no field
stripping. The app uses only `get-session` and `sign-out` (`AccountMenu.tsx:30`, `SignOutButton.tsx:22`), the 7 card routes and, later,
Google's. Neon has `organization` enabled (spec, research table). Its invite endpoint mails any address, and the mail carries text the
attacker chooses: the organization name. The only thing needed is a session, and code sign-in hands one to anyone (U2). That is both an
unguarded mail bomb and a phishing channel, which breaks rule E8. The same default-allow also passes `update-user` (a `name` used by
later mails), `delete-user`, the legacy `forget-password`, and any route Neon adds.
Fix:
- Turn the `organization` plugin off in the Neon console.
- Change `classify` to an allow-list. Forward only `get-session`, `sign-out`, the 7 card routes and, once GSI-1 lands, the Google
  routes. Every other path answers 404.
- Run `sameOrigin` on every non-GET request, not only the guarded ones.

**MF4. The code flag hides the UI but turns nothing off on the server, so rollback 11.2 step 2 is not real.**
`flags.ts:16` reaches only the pages (`sign-in/page.tsx:36`). The route (`route.ts:22`) checks `authConfigured()` and nothing else.
The guard forwards `send-verification-otp` with `type: 'sign-in'` and `sign-in/email-otp` whatever the flags say. Code sign-in, which
creates accounts (U2), is therefore live whenever the guard's dependencies are configured, and "`NEXT_PUBLIC_SIGN_IN_CODE=0` and
redeploy" (spec 11.2) does not stop it.
Fix: in the guard, refuse `type: 'sign-in'` and `sign-in/email-otp` with `404 NOT_FOUND` unless `authFlags.signInCode`. While it is
there, make the whole `/api/auth` route answer 404 unless `authFlags.signIn`. Add a test for each.

## Should-fix

- **SF1. Sign-up forwards fields the client controls** (`guard.ts:319`, `rebuild`). Rule E8 holds only because the card sends
  `name: ''` (`SignInCard.tsx:189`); a script can send any `name`, `image` or `callbackURL`. Spec 5.1 says the proxy strips
  `callbackURL`, but nothing does. Fix: rebuild each guarded body from an allow-list of fields per route (`email`, `type`, `otp`,
  `password`), and force `name: ''`.
- **SF2. The identical sign-up answer copies Neon's headers** (`withBody`, `guard.ts:143`, used at `guard.ts:414` and `:418`). A
  `set-cookie`, a request-id or other header that Neon sends on one branch only would separate a new address from a known one. The test
  at `guard.test.ts:183` passes because the mock sends the same headers for both. Fix: build `SIGNUP_PENDING` with fresh headers (only
  `content-type` and `cache-control`), and test it with mocks whose headers differ.
- **SF3. The per-address password bucket is a lockout an attacker can renew**, which `auth-limits.ts:29` says the design avoids. Ten
  bad passwords every 15 minutes, 20 from one IP (enough for 2 victims), keep a victim out. `auth:verify:addr` (10 an hour) has the same
  problem for code sign-in. Fix: key the address bucket on HMAC(address + IP) and add a much higher address-only ceiling, or count
  failures only.
- **SF4. The global cap is a cheap denial of service for everyone.** About 30 sends that pass Turnstile (3 hours of 10, or about 5 IPs
  at 6 an hour) stop code sign-in, sign-up and reset for the whole UTC day (`auth-limits.ts:25`; sign-up draws from it too,
  `guard.ts:236`). Until Google ships, a code-only user has no other way in. Fix: the owner accepts this by name in spec 5.1, and the
  first `auth-global-cap` alert reaches the owner at once (it does today).
- **SF5. Timing can still tell addresses apart.** The guard waits for Neon, but Neon answers faster when it sends nothing (an unknown
  address on `request-password-reset`, an existing address on sign-up). Fix: hold every send and sign-up answer to a fixed minimum
  time, for example 1.2 s plus jitter. Otherwise, record this as accepted in 5.1.
- **SF6. The privacy page promises more than the code does** (`PrivacyBody.tsx:65-70`):
  - "we delete it within two days": purging happens only inside `quota_take()` (`0011_quota.sql`, the retention block), so with no
    traffic, rows outlive the promise. Even with traffic, a day-window row lives up to 72 hours (24 hours plus 48). Fix: add a daily purge
    (cron or a `LeaseGuard`-style job), or say "within three days, at the next sign-in attempt".
  - "each network": the code keys on the IP, not on a /24.
  - The Turnstile paragraph does not say that our server sends your IP to Cloudflare (`turnstile.ts:55`).
  - The "Email" section lacks the EML-P wording: the sender `auth@mail.myneon.app`, the name "Neon Auth", and confirmation mail.
- **SF7. Confirm what production is serving now.** Release A deployed the guard (`20242418` is in `release/A`) with "No database
  migrations", so `0011_quota.sql` is probably not applied. If `NEXT_PUBLIC_SIGN_IN=1` is set in production, every guarded call, password
  sign-in included, answers `503 GUARD_UNAVAILABLE`, unless `AUTH_GUARD=off` is set, and that flag also turns off all abuse controls.
  The owner checks both (checklist below).
- **SF8. Logging.** `server.ts:33` logs the whole `res.error` when it has no `code`; log `code` or `'unknown'` instead.
  `client-ip.ts` trusts `x-real-ip`, so a Cloudflare proxy put in front later (the domain move) would put every visitor in one bucket.
  Add that to the domain-move gotchas.

## Nits

- `guard.ts:183`: the `\d{6}` log filter drops any value with 6 digits in a row; that is fine, but write down that it is deliberate.
- `return-path.ts:15` decodes a second time after `URLSearchParams` has decoded once. It is safe because of the checks on lines 20 to 35,
  but a comment would save the next reader the analysis.
- `ResetFlow.tsx:134`: the sign-in after a reset goes through the password bucket. That is fine, but under MF2's current setting it
  would mail a code if the account were still unverified.

## Positive

Origin before quota. A body cap that reads the stream. Turnstile that checks hostname and action and refuses Cloudflare's test secrets
in production. All-or-nothing quota takes under row locks in a fixed order. Keys are day-salted HMACs with a CHECK constraint, and the
app role has no grant on the table. A Neon 4xx message is never echoed from a send. Neon's 429 keeps a Retry-After. Revocation runs only
after Neon's 200. Owner alerts have a budget. Every console line in the guard tests is captured and scanned.

## Owner and Neon console checklist (production branch `br-soft-glade-b4mkqyvd`; settings by name, no values)

1. Better Auth, Allow Localhost: **off** (MF1).
2. Plugins, `organization`: **disabled** (MF3); `magic_link` stays disabled; `phone_number` disabled.
3. Email and password, after the card is live, all in one session: Require Email Verification **true**, verification method `otp`,
   Send verification email on sign-up **true**, Send verification email on sign-in **false** (MF2), Auto sign-in after verification
   true. Leave Disable Sign Up as it is: it does not stop code sign-up (U2).
4. Email provider: `shared`. Webhooks: disabled. Trusted domains: exactly `https://travel-beta-tan.vercel.app`.
5. Project Info, Application Name: `Trip Plans` (O-E0).
6. Cloudflare Turnstile: one widget in managed mode, hostnames `travel-beta-tan.vercel.app` and `localhost`.
7. Vercel Production: `TURNSTILE_SECRET_KEY` and `AUTH_QUOTA_SECRET` (at least 16 characters, marked Sensitive),
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `OWNER_EMAIL` (the Resend account's address), `RESEND_API_KEY` (send-only key), `SITE_ORIGIN`,
   `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` and `DATABASE_URL` present. `AUTH_GUARD` **unset**. `MAIL_FROM` unset.
   `NEXT_PUBLIC_SIGN_IN=1`. `NEXT_PUBLIC_SIGN_IN_CODE=1` only after MF1 to MF4.
8. Migration `0011_quota.sql` applied on production before this deploy. Then check with `quota.ts stats` (SF7).

## What EML-V must test

- Each send route (`send-verification-otp` for every type, `request-password-reset`, `sign-up/email`) for an unknown address, a known
  unverified address and a known verified address: status, body **and the full header set** match, and so does the timing within a
  stated margin (SF2, SF5).
- Child branch only: a direct POST to Neon's base URL with no `Origin` header, and with `Origin: http://localhost` once Allow Localhost
  is off. Record the result (MF1).
- `sign-in/email` with the right password for an unverified account sends no mail; the card then sends one through the guarded route
  (MF2).
- `POST /api/auth/organization/create`, `update-user`, `delete-user`, `forget-password`, `change-email` and a made-up path all answer 404
  (MF3).
- With `NEXT_PUBLIC_SIGN_IN_CODE` unset, a code send of type `sign-in` and `sign-in/email-otp` answer 404 (MF4).
- Guard answers: a cross-site `Origin` gets 403; a body over 4 KB gets 413; no Turnstile token gets 403; per-address 429 with
  Retry-After; the card disables the button and counts down; after a reset, other sessions are signed out; `next=` attacks (`//evil`,
  `/\evil`, `%2F%2F`, `/trips/..//evil`) land on `/account/`.
- Logs for the whole sweep have no `@`, no 6-digit run, no IP and no token. The privacy page wording matches the behaviour (SF6).
