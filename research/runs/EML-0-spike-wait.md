# EML-0: waiting on the owner

Run notes: [EML-0-spike.md](EML-0-spike.md). Child branch `br-damp-breeze-b41mtvn5` only. Never paste a password or
an API key into chat; codes are fine (they die in 5 minutes).

Email budget: cap 12. Run 1 wrote 5 code mails (most likely sent) and made 5 more calls that should send nothing.
Until W1 confirms the real count, assume 10 used and **2 left**; if W1 shows only the 5 code mails, 7 are left.

## W1. Report what arrived from run 1 (5 minutes, no code to paste)

Search Gmail (Inbox, Spam, Promotions, Updates) for `to:nitin27may+eml0` received on 25 Oct 2026 between 14:12 and
14:20 local time, UTC-4 (18:12 to 18:20 UTC). For each mail, give:

- the alias (+eml0-1 to +eml0-6), the subject, the sender address and display name, the time received, and the folder;
- whether it carries a 6-digit code or a link, and whether the code is in the subject;
- whether the body shows the name "EML0 test" or the app name, and any Neon branding.

Expected: +eml0-2 x1 (verification), +eml0-4 x2 (sign-in), +eml0-1 x2 (verification, then password reset). **Any mail
to +eml0-3, +eml0-5 or +eml0-6 is a finding**: say which and its subject. All these codes are dead and the accounts
deleted; do not paste them.

## W2. Live code session (about 15 minutes; you at the keyboard, an agent at the terminal)

Every code expires 5 minutes after it is sent, so this needs one sitting. Ask the coordinator to start an EML-0
follow-up run with you present. It uses 2 emails (3 if budget allows) in this priority order. The agent creates
fresh users with random passwords that it never prints, and deletes them at the end.

1. **M1 gate (CVE-2026-67327), 1 email to +eml0-10.** The agent signs up +eml0-10 with a password (the "attacker")
   and keeps that session, then sends a sign-in code. **You:** paste the 6-digit code from the newest mail to
   +eml0-10 (the subject should name a sign-in code). The agent then signs in with the code through
   `http://localhost:<port>/api/auth/sign-in/email-otp/`. Pass: the old password gets 401, the attacker's session is
   gone, the `credential` account row is deleted, `emailVerified` is true, our proxy set the session cookie (U1), and
   the same code again gets `INVALID_OTP`.
2. **Reset by code (U5), 1 email to +eml0-11.** The agent signs up +eml0-11 with a password (no mail with the baseline
   flags), keeps its session, and requests a reset code. **You:** paste the code from the mail to +eml0-11. The agent
   sets a new password with `/email-otp/reset-password`. Pass: the new password signs in, the old one gets 401, and
   the earlier session is revoked (answers spec 5.1, "revokes other sessions on reset").
3. **Code sign-in for an unknown address (U2, Q146), 1 email to +eml0-12, only if budget allows.** The agent turns
   Disable Sign Up on (child), sends a sign-in code to +eml0-12, and you paste it. Result: either the account is
   created (Disable Sign Up does not protect code sign-in) or it is refused. Then the agent restores the flag.

Resend behaviour (does the first code stay valid after a second send?) needs one more email. Skip it unless W1
leaves budget.

## W3. Gate L1 (CVE-2026-53516): needs your Google login (10 minutes)

Not done by an agent, because Google blocks scripted logins. Use a Google test account (Q119), not your main one.

1. An agent signs up that Gmail address on the child branch with a password through `/api/auth/sign-up/email/`
   (unverified; baseline flags send no mail) and confirms `emailVerified` is false.
2. **You (once):** in Google Cloud console, open the OAuth client the child branch uses and confirm its "Authorised
   redirect URIs" include the child's Neon Auth callback (`<child auth base URL>/callback/google`; the agent gives
   you the exact value). The agent then starts `next dev` with the child env on a free localhost port and opens
   `/sign-in/`.
3. **You:** press Continue with Google and complete consent with the test account.
4. Pass: refused (`account_not_linked` or similar banner); no `google` row in `neon_auth.account` for that user; no
   session. Fail stops the Google plan (Google spec 10.3).

## W4. Magic link on the child (M2, U4 second half, U7): your console toggle

The CLI cannot turn magic link on. If you want M2 run before the domain exists: Neon Console, project
`damp-queen-64719841`, branch `srv-migrate-verify`, Auth, Configuration, Magic Link, "Enable Magic Link". Then tell the
coordinator. An agent sends 1 link to +eml0-13 to learn whether the shared sender sends links at all, and you report
whether it arrived. Turn it off again afterwards. Recommended: **skip until the Resend domain exists** (the plan
ships links only after it).

## W5. U13: Vercel Deployment Protection on the production alias

`https://travel-beta-tan.vercel.app/` currently answers `DEPLOYMENT_NOT_FOUND` (no production deployment), so it
cannot be probed. **You:** Vercel, project `travel`, Settings, Deployment Protection: report the mode (for example
"Standard Protection", which protects previews but not the production domain, or "All Deployments"). Neon's webhook
calls need the production alias to answer without a login.

## W6. U11: Resend sandbox

The Resend key is only in the production env file, which EML-0 may not use. Decide whether EML-M checks
`delivered@resend.dev` with that key (it counts against the 100-a-day cap).

## Decision: child settings

All child settings are restored to the baseline (run notes). No decision is needed unless you want something left on.


## W1 result (owner, 25 Oct 2026)

Five mails arrived, as expected (no mail to the aliases that should have had none). The reset-by-code mail was seen in the Inbox, sender display name "Neon Auth", body names "Travel Planner", code in a boxed block, Gmail showed its Copy code card. Gmail also showed "Images in this message are hidden. This message appears suspicious" on that mail (shared development sender, no own domain). Folder of the other four and their subjects: not reported; treat as Inbox unless the owner says otherwise.
