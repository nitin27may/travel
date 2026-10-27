# Continue with Google: every string, the owner's live test, and the console steps (26 Oct 2026)

Status: **copy and test plan, 26 Oct 2026 (planner, model Opus 5.5).** Nothing here is built. Task GSI-COPY, TODO row of
2026-10-26, BACKLOG 15.334. Release: v0.9 in the B+C release, which ships Google **switched on** (owner, 26 Oct;
[MASTER-ORDER](../../build/MASTER-ORDER.md) 0 and 7.3).

## The owner's request (26 Oct 2026)

> "Word everything for Google, either sign up or sign in, the whole experience; I will test it myself in the morning,
> in person."

## What this page is based on

- Spec: [google-and-apple-sign-in.md](../../features/google-and-apple-sign-in.md) (flows, linking rules L1 to L7, error
  codes 4.6, privacy 6, owner steps 9, tests 10, unknowns U1 to U11).
- Tone and the card: [email-sign-in-and-account-emails.md](../../features/email-sign-in-and-account-emails.md) 2.1
  (A1 to A8), 3.1 to 3.3, and the EML-0 and EML-1 notes at its end.
- Entry points: [navigation-and-mine.md](../../features/navigation-and-mine.md) and
  [mine-and-bar-spec.md](mine-and-bar-spec.md).
- Code read on `main` 9bae68be: `web/components/auth/SignInCard.tsx`, `ChooserStep.tsx`, `EmailStep.tsx`, `parts.tsx`,
  `memory.ts`, `live.tsx`, `api.ts`; `web/lib/auth/auth-errors.ts` (the `COPY` object), `flags.ts`, `return-path.ts`,
  `guard.ts`; `web/proxy.ts`; `web/app/sign-in/page.tsx`, `sign-up/page.tsx`, `account/page.tsx`,
  `account/SignOutButton.tsx`; `web/app/mine/AccountCard.tsx`, `DeviceNotice.tsx`, `MineShell.tsx`;
  `web/app/privacy/PrivacyBody.tsx`; `web/lib/site.ts` (`SITE_NAME = 'Trip Plans'`).
- Rules: [principles.md](../foundation/principles.md) P1 to P9; [components.md](../foundation/components.md) 2.1
  (button labels at most three words, sentence case, verb first), 5.4 (banners), 6.3 (errors);
  [review-gsi-p-2026-10-26.md](review-gsi-p-2026-10-26.md) section 4 (the privacy copy every string here must agree with).

**There is no phone-number sign-in.** "Phone" in the brief is the sign-in entry on phones (ACCT-PH, Mine). The ways in
are: emailed code, password (with verification by code), and Google. This page covers how Google sits beside the first two.

## Supersedes

| What | Where | Replaced by |
|---|---|---|
| Copy table 4.3 (button, divider, the consent line "We get your name and email from Google, nothing else", shown on `/sign-up/` only) | Google spec 4.3 | Section 2.1 here. "Nothing else" is not true: Google also sends the profile photo link, the Google account id and the verified flag (spec 6.1). The line shows on **both** pages, because a new person can start on `/sign-in/` ("New here? The same steps create your account") and we only know new or returning after Google answers (Q-GC1) |
| Banner wording 4.6 | Google spec 4.6 | Sections 2.3 and 4 here (same cases, plus restart, cookies, in-app browser, unconfirmed Google email, did not finish) |
| GSI-1 owned file `web/lib/capabilities.ts` (append `signInGoogle`) | Google spec 13 | `web/lib/auth/flags.ts` (EML-1 build note: a property on `capabilities` grows every page's start JS). Already implied by MASTER-ORDER C13 |
| "Authorised JavaScript origins and redirect URIs for `https://travel-beta-tan.vercel.app` and `http://localhost:3000`" in the GSI-COPY brief | brief | Section 6. Google's redirect URI is **Neon's** callback (spec F4). Our two origins go in Neon's trusted domains, not in Google. JavaScript origins stay empty |
| "Store in Vercel env `GOOGLE_CLIENT_ID`" in the GSI-COPY brief | brief | Section 6, C-6. The app never uses the client id or secret (spec G7). The only new Vercel variable is the build flag `NEXT_PUBLIC_SIGN_IN_GOOGLE` |

The Google spec page needs a one-line pointer to this page in 4.3 and 4.6 (coordinator; this lane owns only this page and
its two rows).

## 1. Wording decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| W1 | **One label, "Continue with Google", on both pages, on step 1 above the email field.** Not on the chooser (step 2) | Google allows it; it is right for new and returning people; step 1 is the only point where the person has not yet typed an address (P3, P4, P7) | Someone who typed an address first and then wants Google presses "Change" to get back to it |
| W2 | **Neutral before Google answers, specific after.** The card never says "sign up" or "sign in" about Google. The Account page says "Your account is ready" (new), "we added Google to it" (linked), or nothing (returning) | We cannot know which until Neon returns | One extra notice in two rare cases |
| W3 | **A link to an existing account is always told, once, on Account, before the person moves on.** A new account or a link stops on `/account/` with a Continue button, instead of jumping to `next` (Q-GC3) | "Never merge silently": the email code and password accounts are verified, so L1 links them without asking. The person must see that it happened and how to undo it | One extra click for those two cases; returning sign-ins still go straight back |
| W4 | **No new words for technical things.** Never "OAuth", "provider", "link", "merge", "token", "session", "origin", "credentials" | P4 | A few strings are longer |
| W5 | **Every failure keeps the email way open.** Each Google error ends with "or use your email below" where the email form is on the same screen | Google failing is never a dead end (spec story 5) | Repetition across banners, accepted |
| W6 | **The address is masked on the card and in notices** (`n…@gmail.com`, `maskAddress()`); the full address only in "Signed in as" on Account and Mine, as today | Screenshots of the card show less; no household data anywhere public (PLAN 1 Privacy) | None |
| W7 | **The Google name and photo are never shown.** Account and Mine keep "Signed in as {email}"; the header keeps the initial | Spec 6.2 (photo never read); the name adds nothing and is personal | The account page does not greet by name |

## 2. Copy table

Conventions. **Key**: the name the builder uses (a property of `COPY` in `web/lib/auth/auth-errors.ts`, or of a new
`GOOGLE_COPY` in `web/lib/auth/oauth-errors.ts`, or the component that holds the text). **Max**: characters, for a 390 px
phone (card text column about 326 px; serif 15.5 holds about 40 characters a line, so 120 characters is three lines;
button labels must stay on one line at 320 px). `{masked}` is `maskAddress(email)`; `{email}` is the full address;
`{wait}` is `waitPhrase(retryAfterS)`; `{date}` is "26 Oct 2026" (`d MMM yyyy`). Banner kinds are components 5.4. Every
notice is also written to the card's one polite live region (`useAnnouncer`, review M2); urgent banners keep
`role="alert"` and are not repeated.

### 2.1 Sign-in card, step 1 (`/sign-in/` and `/sign-up/`)

| # | Key | Text | Where | Max | Screen reader | Notes |
|---|---|---|---|---|---|---|
| 1 | `auth.google.button` | Continue with Google | new `web/components/auth/GoogleButton.tsx`, rendered by `SignInCard.tsx` on the email step, first in the card, full width | 20 (fixed) | `<button type="button">`; the visible text is the name; the "G" is `<img alt="">`; no `aria-label` (it would duplicate) | Same label on both pages (W1). Google colours per spec 4.2 |
| 2 | `auth.google.divider` | or | between the button and the email form | 2 | read as text ("or"); not hidden, so the order makes sense when read | Sentence case, no dashes in the text; the lines are CSS |
| 3 | `auth.google.consent` | Google shares your name, email address and profile photo link with us. Never your password or contacts. | help line under the button, both pages | 110 | tied to the button with `aria-describedby` | Consistent with the privacy page (2.8). "Never your password or contacts" answers the first worry; the photo is named because we receive it |
| 4 | `auth.google.consentLink` | What we keep | link at the end of 3, to `/privacy/#accounts` | 12 | link text alone is clear | Same tab. Needs `id="accounts"` on the privacy h2 (GSI-PG) |
| 5 | `auth.google.hostNote` | Google's screen may show neon.tech, the service that runs our sign-in. | appended to 3, **only if** GSI-0 finds Google's screen names a Neon host (U7), and only until brand verification (O-7) | 75 | part of the description | Same reason as the Neon sender note on the code step (Q-GC4) |
| 6 | `auth.google.lastUsed` | Last used on this browser | mono 12 line under the button when `lastMethod() === 'google'` | 26 | part of the description | `memory.ts` gains `'google'` (no address stored). P6 |
| 7 | `auth.google.flagOff` | Continue with Google is switched off for now. Enter the same email address and we'll email you a code. | notice above the email form when the Google flag is off and `lastMethod() === 'google'` (code on) | 105 | live region on load | Rollback path (spec 11): a Google-only person still gets in by code (A1) |
| 8 | `auth.google.inApp` | Google doesn't allow sign-in inside this app's browser. Open this page in Safari or Chrome, or use your email below. | notice above the button when the user agent is a known in-app browser (Instagram, Facebook, Line, TikTok) | 115 | live region on load | Google refuses embedded web views (`disallowed_useragent`). The button stays enabled: the check can be wrong |
| 9 | `auth.cookiesOff` | Your browser is blocking cookies for this site. Sign-in needs them to keep you signed in. | notice at the top of the card when `navigator.cookieEnabled === false` (all methods) | 95 | live region on load | Third-party cookie blocking does **not** trigger it: the flow uses only first-party cookies and full-page redirects |

Unchanged on these pages: headings "Sign in" and "Create an account", sub-lines "Save and revisit your trip drafts." and
"Start saving your trip drafts.", the footers "New here? The same steps create your account." and "Already have an account?
Sign in". "The same steps" now covers Google too, so it stays.

### 2.2 While Google opens

| # | Key | Text | Where | Max | Screen reader | Notes |
|---|---|---|---|---|---|---|
| 10 | (label) | Continue with Google (unchanged) | the button | 20 | `aria-busy="true"` on the button | A 16 px spinner replaces the "G"; width locked; the email form is disabled until the browser leaves (spec 4.2) |
| 11 | `auth.google.opening` | Opening Google. | live region only | 16 | announced once | No visible text: the page leaves within a second |
| 12 | `auth.offline` (existing `COPY.offline`) | You're offline. Sign-in needs a connection. | offline banner, when `navigator.onLine === false` at the press | existing | existing | No call is made |
| 13 | `auth.google.startFailed` | We couldn't open Google. Try again, or use your email below. | notice, when the POST to `/api/auth/sign-in/social/` fails or returns no Google URL | 65 | live region | Covers network errors and a blocked navigation |
| 14 | `auth.google.rateLimited` | Too many sign-in attempts. Wait {wait}, then try again, or use your email below. | urgent banner on a 429 from the POST | 85 | `role="alert"` | `{wait}` "a minute" reads "Please wait a minute, then try again, or use your email below." (the EML-1 pattern) |

There is no popup and no Google script on our page, so "popup blocked" cannot happen. A content blocker that stops the
navigation to Google lands in 13 or, after Back, in 16.

When the browser comes back to the card from Google with Back (the page restored from the back-forward cache), the button
returns to its ready state with no message other than 16. A spinner that stays after Back is a bug.

### 2.3 Back on the card with an error (Neon returns to `errorCallbackURL` with `?error=`)

The card reads `error` once, maps it (section 4), shows the banner, announces it, then removes `error` from the address
with `history.replaceState`, so a reload or a screenshot shows a clean URL. The raw `error` or `error_description` is never
put on the page.

| # | Key | Text | Kind | Max | Then |
|---|---|---|---|---|---|
| 15 | `auth.google.cancelled` | You cancelled signing in with Google. Try again, or use your email below. | notice | 75 | Button ready |
| 16 | `auth.google.didNotFinish` | Signing in with Google didn't finish. Try again. If this keeps happening, allow cookies for this site, or use your email below. | notice | 125 | Shown when `sessionStorage` holds the pending mark (section 8, GSI-1) on a return to `/sign-in/` or `/sign-up/` with no `error` and no session. Covers Back from Google, a failed verifier exchange (cookies blocked), and `proxy.ts` sending a signed-out `/account/` load to `/sign-in/` |
| 17 | `auth.google.restart` | That sign-in took too long or was started in another tab. Please start again. | notice | 80 | Also "session expired" during the round trip |
| 18 | `auth.google.noEmail` | Google didn't share an email address, so we couldn't sign you in. Try again and allow it, or use your email below. | notice | 115 | Rare: basic scopes cannot be deselected on Google's screen |
| 19 | `auth.google.emailUnconfirmed` | Google hasn't confirmed the email address on that Google account. Confirm it with Google first, or use your email below. | notice | 120 | Only if GSI-0 finds Neon refuses an unconfirmed Google address (UC4) |
| 20 | `auth.google.accountExists` | There's already an account here for this email. Sign in with your email first, then add Google on your account page. | notice | 115 | L2: an unconfirmed password account. Focus moves to the email field; it is never prefilled from the URL |
| 21 | `auth.google.signUpClosed` | New accounts can't be created right now. Everything on this site works without one. | notice | 85 | Q120 opened sign-up, so this should not show; kept for `signup_disabled`. First sentence is the existing `COPY.signUpClosed` |
| 22 | `auth.google.unavailable` | Google sign-in isn't working right now. Try again shortly, or use your email below. | notice | 85 | **The fallback** for unknown codes, 5xx, Neon refusing our origin, a misconfigured client. Never names the cause, the origin, the domain or Neon. Logs a fixed code only |

### 2.4 Landing on Account after Google (GSI-2, new `web/app/account/SignInNotice.tsx`)

The account page decides from the account rows (section 8, GSI-2), never from the URL, so no flag or address rides in
the URL.

| # | Key | Text | Where | Max | Screen reader | Notes |
|---|---|---|---|---|---|---|
| 23 | `account.google.new` | Your account is ready. You signed up with Google as {masked}. | notice under the Account heading | 75 | live region; the h1 keeps focus | New user, created in the last 10 minutes, Google its only row |
| 24 | `account.google.newHint` | If you meant to use a different account, sign out and choose another Google account. | second sentence of 23, only when this browser had a `lastMethod` before this sign-in | 90 | same | The "different Google account than last time" case: we store no address, so this is the most we can say |
| 25 | `account.google.linked` | You already had an account for {masked}, so we added Google to it as a way to sign in. Your drafts are unchanged. | notice under the heading | 120 | live region | L1 (the code or password account was confirmed). Never silent (W3) |
| 26 | `account.google.linkedUndo` | Not what you wanted? Remove Google | link after 25, to `#ways-to-sign-in` | 35 | link | |
| 27 | `account.google.continue` | Continue | primary button in 23 and 25 when `next` is not `/account/` | 8 | visible "Continue" plus sr-only " to the page you were on" | Goes to the checked `next` (`returnPath`). Without `next`, no button |
| 28 | (returning) | none | | | the Account h1 as today | A returning Google sign-in goes straight to `next` with no notice (P7) |

### 2.5 Account: Ways to sign in (GSI-2, `web/app/account/SignInMethods.tsx`)

| # | Key | Text | Where | Max | Screen reader | Notes |
|---|---|---|---|---|---|---|
| 29 | `account.methods.title` | Ways to sign in | h2, `id="ways-to-sign-in"` | 15 | heading | Spec 4.3 |
| 30 | `account.methods.email` | Email · A 6-digit code sent to this address | row: label, then muted detail | 45 | one line read in order | Always present: any confirmed address can get a code (A1). Not removable |
| 31 | `account.methods.password` | Password · Set | row, only when a password exists | 15 | | Read-only in v0.9; EML-3 adds Set and Change |
| 32 | `account.methods.google` | Google · Added {date} | row | 25 | | No Google address shown: it always equals the account address (L4, L5) |
| 33 | `account.methods.google.add` | Add Google | secondary button, when no Google row | 10 | button | Help line 34 tied with `aria-describedby` |
| 34 | `account.methods.google.addHelp` | Sign in with Google as well as your email. Choose the Google account for {masked}. | help under 33 | 85 | description | |
| 35 | `account.methods.google.added` | Google added. You can now sign in with Google or your email. | notice at the section top after the return | 65 | live region | The return of `linkSocial` lands on `/account/#ways-to-sign-in` |
| 36 | `account.methods.google.addCancelled` | Google wasn't added because you cancelled. You can try again any time. | notice | 75 | live region | `access_denied` during Add |
| 37 | `account.methods.google.emailMismatch` | That Google account uses a different email address. Choose the Google account for {masked}. | notice | 95 | live region | L5 |
| 38 | `account.methods.google.usedElsewhere` | That Google account already signs in to another account here. To open that account, sign out and continue with Google. | notice | 120 | live region | Never merged. The two accounts stay separate (spec 5.3) |
| 39 | `account.methods.google.addFailed` | We couldn't add Google. Try again shortly. | notice | 45 | live region | Fallback |
| 40 | `account.methods.google.remove` | Remove | text button on the Google row | 6 | sr-only " Google" appended | Opens the dialog |
| 41 | `account.methods.google.removeTitle` | Remove Google? | dialog title | 15 | dialog `aria-labelledby` | |
| 42 | `account.methods.google.removeBody` | You'll sign in with an emailed code instead. Your drafts, copies and favourites stay. Using Continue with Google again later adds it back. | dialog body | 140 | dialog `aria-describedby` | The last sentence is true under L1 and must not be hidden |
| 43 | `account.methods.google.removeGoogleSide` | To stop Google sharing your details with this site, also remove Trip Plans at myaccount.google.com/permissions. | dialog body, second paragraph | 115 | link "myaccount.google.com/permissions" with sr-only " (opens in a new tab)" | Matches the privacy page (2.8) |
| 44 | `account.methods.google.removeConfirm` | Remove Google | danger button in the dialog | 13 | | components 2.1: danger always behind a confirm |
| 45 | `account.methods.google.removeKeep` | Keep Google | secondary button, focused when the dialog opens | 11 | | |
| 46 | `account.methods.google.removed` | Google removed. Sign in with an emailed code from now on. | notice at the section top | 60 | live region | Focus returns to the Add Google button |
| 47 | `account.methods.google.removeLast` | Google is the only way in saved on this account, so it can't be removed yet. Sign in once with an emailed code, then try again. | notice | 125 | live region | Only if UC1 shows Neon refuses to remove the last row of a Google-only account |
| 48 | `account.methods.google.removeFailed` | We couldn't remove Google. Try again shortly. | notice | 48 | live region | Fallback |
| 49 | `account.methods.google.signOutNote` | Signing out here doesn't sign you out of Google on this device. | muted line under the Google row | 65 | read with the row | Shared family devices: the next person to press Continue may be signed straight in as you |
| 50 | `account.methods.google.off` | Google sign-in is switched off for now. Sign in with an emailed code meanwhile. | muted line replacing 33 and 40 when the flag is off | 80 | | Spec 11: rows stay read-only |
| 51 | `account.delete.interim` | To delete your account and everything in it, email {contact} from this address. | muted line at the foot of the section | 90 | `mailto:` link | `{contact}` is `PRIVACY_CONTACT` in `PrivacyBody.tsx` (owner, 26 Oct). Same promise as the privacy page; until F17's delete ships |

Unchanged: "Signed in as {email}" and the "Sign out" button. After sign-out the page loads `/` (`leaveSession()`), as today,
with no message.

### 2.6 Email-code card strings that change when Google is on

EML-1 left "or use Google" out until the button exists (EML-1 note "Copy"). With `signInGoogle` on:

| # | Key (existing) | Text with Google on | Today |
|---|---|---|---|
| 52 | `tooMany('send')`, sign-in page | You've asked for several codes. Wait {wait}, or use your password or Google. | "... or use your password." |
| 53 | `tooMany('send')`, sign-up page | You've asked for several codes. Wait {wait}, or use Google. | "... then try again." |
| 54 | `COPY.sendFailed` (sign-in) | We couldn't send the email. Try again shortly, or use your password or Google. | "... or use your password." |
| 55 | `COPY.sendFailedNoAlternative` (sign-up only) | We couldn't send the email. Try again shortly, or use Google. | "We couldn't send the email. Try again shortly." Reset page unchanged |

"Or use Google" means scroll up: the Google button sits on step 1. On steps 2 and 3 the card shows "Change" to get back.
GSI-1 may instead put a "Use Google instead" text button on those banners (one tap back to step 1); the words stay.

### 2.7 Mine (no Google-specific change; three promises to correct before v0.16)

Mine reaches Google only through `/sign-in/?next=%2Fmine%2F`. The signed-in card stays "Signed in as {email}" with no method
named (W7). But three existing lines promise that signing in keeps copies and favourites in the account, and that only
arrives with NAV-3 and FAV-2 in v0.16. With Google on, signing in is two taps, so more people will act on the promise and
find nothing moved on another device (Q-GC2).

| # | Key | Today | Proposed until NAV-3 and FAV-2 ship |
|---|---|---|---|
| 56 | `DeviceNotice` tail (`web/app/mine/DeviceNotice.tsx`) | "... Sign in to keep them in your account." plus **Sign in** | Drop the sentence and the Sign in button; keep **Got it** |
| 57 | Storage-blocked banner (`MineShell.tsx`) | "Copies and favourites last until you close this tab. Sign in to keep them." plus **Sign in** | "Copies and favourites last until you close this tab." No button |
| 58 | First-favourite toast (mine-and-bar-spec 7) | "Added to favourites on this device. Sign in to keep them on every device." | "Added to favourites on this device." **Undo** only |

Kept as is: "Copies on this device move to your account when the planner opens." (signed in): a promise about a later
stage, worded as one.

### 2.8 Privacy page (GSI-PG; `web/app/privacy/PrivacyBody.tsx`, section "Accounts")

| # | Key | Text | Notes |
|---|---|---|---|
| 59 | `privacy.accounts.password` | "... your password, if you set one, in a scrambled form that cannot be read back ..." | Edit of the existing sentence: a Google or code account may have no password |
| 60 | `privacy.accounts.google` | If you use Continue with Google, Google tells us your name, your email address, whether Google has confirmed it, and a link to your Google profile photo. We keep them with your account. We do not show your name on any page and we do not use the photo. We never see your Google password, contacts, calendar or files, and we ask Google for nothing else. | New paragraph after the first. Matches spec 6.1 and strings 3 and 43 |
| 61 | `privacy.accounts.googleTokens` | Neon, which runs our sign-in, also keeps the sign-in tokens Google issues. We never use them to reach your Google account. | Only if GSI-0 or GSI-E confirms Neon stores tokens (U6); otherwise left out |
| 62 | `privacy.accounts.googleRemove` | To stop Google sharing your details with us, remove Trip Plans at myaccount.google.com/permissions. That does not delete your account here; see "Removing your account" below. | Link opens in a new tab (sr-only " (opens in a new tab)"), as the Google Maps link does |
| 63 | (anchor) | `id="accounts"` on the "Accounts" h2 | Target of string 4 |
| 64 | `PRIVACY_CHANGED` | the date the paragraph ships | Review P2 rule |

### 2.9 Later (F17 delete, not v0.9)

| # | Key | Text |
|---|---|---|
| 65 | `account.delete.googleLine` | Deleting your account also removes Google as a way in. To stop Google sharing your details too, remove Trip Plans at myaccount.google.com/permissions. |

### 2.10 Screens that are Google's, not ours (for the checklist; not strings we write)

| Screen | What Google shows | What sets it |
|---|---|---|
| Account chooser | "Choose an account to continue to {name or host}" | Branding app name "Trip Plans" when Google shows the name; otherwise the redirect host (U7) |
| Consent | "Trip Plans wants to access your Google Account", name, email, profile picture; Cancel and Continue | Data Access scopes; shown on the first sign-in and after the grant is removed |
| Error | "Access blocked: authorisation error", `redirect_uri_mismatch`, `disallowed_useragent` | Console fault (section 6) or an in-app browser (string 8). Never reaches our card |

## 3. Voice note

- **Say what happened, then what to do.** One or two short sentences. "You cancelled signing in with Google. Try again, or
  use your email below." No "Oops", no "Sorry", no exclamation marks, no "please" except before "wait" and "start again",
  where the existing card uses it.
- **Second person, plain verbs, contractions** as the existing card does ("couldn't", "You're", "isn't"). British
  spelling (favourites, cancelled).
- **Name Google; name Neon only where it builds trust** (the host note, the privacy page). Never name the cause of a
  server-side failure (origin, domain, client, callback).
- **The words a person already knows:** "sign in", "account", "email address", "code", "Google account". Never "OAuth",
  "provider", "link", "merge", "token", "session", "credentials", "authenticate".
- **Neutral until we know.** Before Google answers, never "sign up" or "sign in" about Google; after, "Your account is
  ready" or "we added Google to it".
- **Every failure leaves the email way open** and every change of account is told once (W3, W5).
- **Mask the address on the card and in notices**; never echo input or query text. Buttons are at most three words,
  sentence case, verb first (components 2.1).
- **No promise the build does not keep.** Every claim here matches the privacy page (2.8) and spec 6. That is why string 3
  names the photo link and section 2.7 corrects the Mine lines.

## 4. Error codes to strings (`web/lib/auth/oauth-errors.ts`)

Codes are Better Auth's as expected from Neon (U4 confirms; anything not listed falls to the fallback). One pure function,
code in, key out; unknown, empty or over-long values map to the fallback; no input text in the output (spec 10.1).

| Code (`error=`) | On the card (sign-in or sign-up) | On Account (Add Google) |
|---|---|---|
| `access_denied` | 15 `cancelled` | 36 `addCancelled` |
| `state_mismatch`, `state_not_found`, `please_restart_the_process`, `invalid_code`, `no_code` | 17 `restart` | 39 `addFailed` |
| `email_not_found` | 18 `noEmail` | 39 |
| `email_not_verified` (if Neon has it, UC4) | 19 `emailUnconfirmed` | 39 |
| `account_not_linked` | 20 `accountExists` | 39 |
| `signup_disabled` | 21 `signUpClosed` | n/a |
| `email_doesn't_match` | 22 (fallback; cannot happen on the card) | 37 `emailMismatch` |
| `account_already_linked_to_different_user` | 22 | 38 `usedElsewhere` |
| `unable_to_link_account` | 22 | 39 |
| anything else, 5xx, refused origin, `unable_to_get_user_info`, `unable_to_create_user`, `unable_to_create_session`, `internal_server_error` | 22 `unavailable` | 39 |
| none, but the pending mark is set and there is no session | 16 `didNotFinish` | 39 |
| HTTP 429 on the POST | 14 `rateLimited` | 14 |
| no answer (`status: 0`, offline) | 12 `offline` | 12 |
| no answer (`status: 0`, network) | 13 `startFailed` | 39 |

## 5. Owner live test checklist (laptop and phone, in person)

About 75 minutes for parts 1 to 4. Tick each line; anything that differs from the string number named is a finding.

### 5.0 Before you start

| Need | Detail |
|---|---|
| What must be built | Part 1 needs nothing built (an agent drives the GSI-0 spike and gives you a Google link). Parts 2 to 4 need GSI-1 and GSI-2 merged and deployed to the preview alias with `NEXT_PUBLIC_SIGN_IN_GOOGLE=1`, `NEXT_PUBLIC_SIGN_IN=1`, `NEXT_PUBLIC_SIGN_IN_CODE=1` |
| Accounts | **Test Gmail A** (Q119, the separate test account) and **test Google account B** (a second Gmail, never used here). Do not use your main account until the production check (O-6) |
| Devices | Laptop: Chrome (main) and Safari. Phone: iPhone Safari |
| URL L (local) | `http://localhost:3000`, on the **child** Neon branch (the agent starts `next dev` with the child env). Chrome only (Safari's Secure cookies on localhost vary). Not `127.0.0.1` except in step 2.10 |
| URL P (production-like) | The preview alias `https://travel-preview-<name>.vercel.app` (Q118; name to pick in C-7). Preview carries **production** Neon values (one environment), so accounts made here are real production accounts. Previews sit behind Vercel Authentication: sign in to Vercel in the same browser first, on the phone too |
| URL Prod | `https://travel-beta-tan.vercel.app`, only after you approve the named commit and the flag goes to 1 (O-6). Then repeat 2.2, 2.3 and 3.2 once with your own account |
| Before part 3 | On the phone, signed out, copy one trip (Copy to my trips) and favourite one place, so Mine has one of each |

### Part 1: the linking gate and the Google screen, on L (agent present, 15 min)

1. The agent creates a password account for **A** on the child branch and leaves it unconfirmed (no code entered).
2. The agent gives you a Google link (or, if GSI-1 is built, open `L/sign-in/` and press **Continue with Google**).
3. In a private Chrome window, open it. **Before signing in to Google**, read the line "to continue to ..." and take a
   screenshot (U7: does it say Trip Plans, or a neon.tech host?).
4. Sign in as **A** and press **Continue**. Expected: back on `L/sign-in/` with string **20** ("There's already an account
   here for this email ..."), or the agent reports `account_not_linked`. **If you land signed in, stop: the gate failed
   (spec 10.3 L1); Google does not ship.**
5. Again, with **B**: on Google's consent press **Cancel**. Expected: string **15**. The agent records the `error` code (U4).

### Part 2: the whole flow on the laptop, Chrome, URL P (35 min)

**2.1 The page.** Open `P/sign-in/`. Check: string 1 first, full width; 2 ("or"); 3 and 4 under the button (and 5 if
Part 1 found a Neon host); the email form below. Switch dark with the theme control: the button is Google's dark style,
the "G" in colour. Open `P/sign-up/`: same button, same line 3. Tab from the top: the Google button gets focus first.

**2.2 New account, back where you were.** Open a place page, for example `P/places/<any>/`. Press the header's **Sign in**
(or the person icon). Check the address bar shows `/sign-in/?next=%2Fplaces%2F...`. Press **Continue with Google**: the
spinner replaces the "G", the email field greys out. Pick **B**, press **Continue** on consent. Expected: `P/account/`
with string **23**, and **24** only if this browser was used to sign in before (it was, in Part 1); string **27**
**Continue**. Press it: back on the same place page. Look at the address bar: no `neon_auth_session_verifier`, no email,
no `code=` or `state=`.

**2.3 Returning.** Account, **Sign out**: you land on the home page. Sign in again with **Continue with Google**, **B**.
Expected: Google may skip its screens; you land on Account (or `next`) with **no** notice. Under the button on
`P/sign-in/` you now see string **6** ("Last used on this browser") after signing out again.

**2.4 Existing email-code account, same email (never merged silently).** Sign out. Open `P/sign-up/`, type **A**'s address,
**Continue**, **Email me a code**, enter the code from A's inbox: Account shows "Signed in as" A's address and the draft
count. Sign out. Open `P/sign-in/`, **Continue with Google**, choose **A**. Expected: Account with string **25** ("You
already had an account for a…@gmail.com, so we added Google to it ...") and **26**. "Ways to sign in" shows **Email** and
**Google · Added** today's date (30, 32). The draft count is unchanged.

**2.5 Cancel, and access removed at Google.** In another tab open `myaccount.google.com/permissions` as **B**, remove
**Trip Plans**. Back on `P/sign-in/` (signed out), **Continue with Google**, **B**: Google asks consent again. Press
**Cancel**. Expected: string **15**; after a second the address bar shows `/sign-in/` with no `error=`. Press **Continue
with Google** again, **B**, **Continue**: you are signed in to the **same** account (no string 23; the Account address is
B's).

**2.6 Back from Google.** Signed out, **Continue with Google**, then the browser's **Back** on Google's screen. Expected:
the card is ready (no spinner left) and shows string **16** or nothing. Either is a pass; a spinner that stays is a fail.

**2.7 Cookies.** (a) Chrome, Settings, Privacy and security, Third-party cookies, **Block third-party cookies**. Sign in
with Google as B: it must **work** (pass). (b) Click the icon left of the address, **Site settings**, Cookies and site
data (or "Third-party cookies" plus "Cookies"), **Block** for P, reload `P/sign-in/`. Expected: string **9**. Press
**Continue with Google**, finish on Google: you come back with string **16**. (c) Set both back to **Allow**.

**2.8 Offline.** DevTools (Cmd+Option+I), Network, **Offline**. Press **Continue with Google**. Expected: string **12**.
Back to **No throttling**.

**2.9 Too long.** Optional, 11 minutes: **Continue with Google**, wait 11 minutes on Google's account chooser, then pick
B. Expected: string **17** (or a normal sign-in if Neon's state lasts longer; record which).

**2.10 Not an allowed address (L only).** Open `http://127.0.0.1:3000/sign-in/`, **Continue with Google**. Expected:
string **22** or **13**, and no word "origin", "domain", "Neon" or a code on the page.

**2.11 Remove Google, and add it back.** Signed in as **A** (email and Google). Account, Ways to sign in, **Remove**.
Check the dialog: 41, 42, 43; focus on **Keep Google**. Press **Remove Google**: string **46**; the row shows **Add
Google** (33, 34). Sign out, sign in with an emailed code: works. Account, **Add Google**, choose **B**: string **37**.
**Add Google**, choose **A**: string **35**, Google listed again.

**2.12 Google-only account.** Signed in as **B** (Google only). **Remove**, **Remove Google**. Expected: string **47**
(refused) or **46** (allowed). Record which (UC1). If allowed, sign out and sign in as B by emailed code: it must work.

**2.13 Keyboard and VoiceOver.** Cmd+F5 for VoiceOver. Tab to the Google button: it reads "Continue with Google, button"
and then line 3. Press Enter, finish, and on return the banner or notice is read once.

### Part 3: the phone, iPhone Safari, URL P (15 min)

1. `P/sign-in/` in portrait: the Google button is above the fold with the keyboard closed, on one line; line 3 fits in
   three lines. Dark via the theme control.
2. Signed out, open **Mine**: your copy and favourite are listed. Tap **Sign in**. **Continue with Google**, **A**.
   Expected: back on **Mine** (`/mine/`) or on Account with **Continue** to Mine. The copy and the favourite are **still
   listed** (they stay in this browser; they move to the account only with v0.16).
3. Airplane mode on, press **Continue with Google**: string **12**. Airplane mode off.
4. Settings, Apps (or straight to) Safari, Advanced, **Block All Cookies** on. Reload `P/sign-in/`: string **9**. Turn it
   **off** again.
5. Optional: send yourself the P link in Instagram and open it there: string **8**.

### Part 4: afterwards (5 min)

- **Mine:** copies and favourites still listed on both devices, signed in and after sign-out.
- **Sign out:** Account, **Sign out**, you land on the home page; open `P/account/` again: you are sent to sign in.
- **Nothing personal in the URL or the page:** on every page you passed, the address bar holds only a path, `next=` and
  nothing else after the redirects. No Google photo and no name anywhere; the header shows only the initial. Public pages
  (a trip, a place) look the same signed in as signed out, apart from the header.
- **Browser history** (Cmd+Y) will show one `/account/?neon_auth_session_verifier=...` entry per sign-in. Expected and
  harmless: it works once and only with this browser's cookie. Do not paste it anywhere.
- **Tell the agent** which test accounts you made on P; they are production users. The agent runs the U6 queries on them
  (what Neon stores for a Google user), then you decide whether to delete them.

### When something looks wrong, capture

| Capture | How |
|---|---|
| A screenshot with the address bar | Cmd+Shift+4 (laptop); side and volume up (iPhone). Crop nothing except a third person's data |
| The time to the minute, device, browser and version | Safari: Settings, Safari, About; Chrome: chrome://version |
| The path and the `error=` value only | Never the whole Google URL, and never a `neon_auth_session_verifier`, `code` or `state` value |
| Which step and which string number you expected | "2.4, expected 25, saw 22" |
| Laptop only, when a step fails | DevTools, Network, the `sign-in/social` request's status code (not its body) |

The agent then reads the Vercel function logs for that minute (they hold fixed codes only).

## 6. Google console and Neon steps (owner)

Secrets never go into chat, the repo, a `.env*` file or shell history (spec 9: `read -s`, then `unset`). Status as of
26 Oct, from [BACKLOG](../../build/public-site/BACKLOG.md) 15.83 (audit 25 Oct), HANDOVER (Neon line) and the EML-0 run
notes.

| # | Step | Status |
|---|---|---|
| C-1 | Neon production has your own Google client, Neon's shared one is gone (O-0, O-3) | **Done 25 Oct; confirm.** MASTER-ORDER 7.3 row 8 still lists O-0: confirm and close it |
| C-2 | Branding | **Confirm** (not recorded) |
| C-3 | Audience and publishing status | **Open** (not recorded) |
| C-4 | Data Access scopes | **Confirm** |
| C-5 | Client redirect URIs and JavaScript origins | **Done 25 Oct** (redirect URIs registered); confirm exact values |
| C-6 | No Google value in Vercel | **Confirm** |
| C-7 | Neon trusted domains: production done; preview alias open; localhost per branch | **Part done** |
| C-8 | Vercel flag and `SITE_ORIGIN` | **Open** |
| C-9 | Verification | **Open** (agent plus you, 5 min) |
| C-10 | Brand verification | **Not now** (needs a custom domain; Q122, Q148) |

**C-1. Confirm the provider (2 min).**
1. Terminal: `neon neon-auth oauth-provider list --project-id damp-queen-64719841 --branch br-soft-glade-b4mkqyvd`
2. Expect one row `google` of type `standard` (your own client), not `shared`. Same for `br-damp-breeze-b41mtvn5`.
3. Tell the coordinator, who closes O-0 in MASTER-ORDER 7.3 row 8.

**C-2. Branding (5 min).** console.cloud.google.com, top bar project picker, the project whose client file is in
`~/.config/travel-secrets/`. Menu, **Google Auth Platform**, **Branding**.
1. App name: **Trip Plans** (the site name, `SITE_NAME`). User support email: your address.
2. App logo: leave empty (a logo needs brand verification, C-10).
3. App domain: if the console accepts them, home page `https://travel-beta-tan.vercel.app/`, privacy policy
   `https://travel-beta-tan.vercel.app/privacy/` (live after the bundle A deploy), terms `.../terms/`. If it refuses
   `vercel.app` (it is a public suffix and cannot be an authorised domain), leave them empty: they matter only for C-10.
4. Authorised domains: leave what the console lists (it may list the Neon callback's domain). Do not try to add `vercel.app`.
5. Developer contact: your address. **Save**.

**C-3. Audience (2 min).** **Audience**.
1. User type: **External**.
2. Publishing status: press **Publish app**, confirm. With only the three basic scopes there is no review and no test-user
   list either way (spec F10, rechecked 26 Oct on Google's "Manage app audience" page: apps asking only for openid, email
   and profile are exempt from the test-user list, the warning and the 7-day expiry).
3. If you prefer to stay in **Testing**: under **Test users**, **Add users**, add test Gmail A and account B. Nothing else
   changes.
4. Verify: the page shows "In production" (or Testing with A and B listed).

**C-4. Data Access (2 min).** **Data Access**.
1. The list holds only `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Remove anything else.
2. Save. Neon asks for the scopes at sign-in; this list is what Google shows and checks. C-9 checks the real request.

**C-5. The client (3 min).** **Clients**, open the web client used by the production branch (and the child's, if it is a
separate client).
1. Get the exact callback: `neon neon-auth status --project-id damp-queen-64719841 --branch br-soft-glade-b4mkqyvd`, the
   "Base URL" line, then append `/callback/google` (no slash before `/callback`). Repeat for the child branch.
2. **Authorised redirect URIs** hold exactly those callbacks: production's in the production client, the child's in the
   child's client (or both in one client if you made one). Nothing else.
3. **Authorised JavaScript origins:** leave **empty**. Do **not** add `https://travel-beta-tan.vercel.app` or
   `http://localhost:3000`: our page never runs Google's script, and Google never redirects to our origin (spec F4).
   Adding them does no harm but suggests a setup that is not ours.
4. Do not download anything new. If you rotate the secret, update Neon with spec 9 O-3 (`read -s`).
5. Verify: a mismatch shows as Google's `redirect_uri_mismatch` page in Part 1; none means this step is right.

**C-6. Nothing Google in Vercel (2 min).** vercel.com, project `travel`, Settings, Environment Variables. There is no
`GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`, and none should be added: the secret lives only in Neon's provider config
and your password manager (spec G7). If one exists, delete it.

**C-7. Neon trusted domains (5 min).**
1. Production branch already trusts `https://travel-beta-tan.vercel.app` (done 25 Oct).
2. Pick the preview alias name (Q118, for example `travel-preview-nks`). Because Preview runs on production values (one
   environment, Q147), add it to the **production** branch:
   `neon neon-auth domain add https://travel-preview-<name>.vercel.app --project-id damp-queen-64719841 --branch br-soft-glade-b4mkqyvd`
   (this replaces spec 9 O-4's child-branch line).
3. Localhost: tests from `http://localhost:3000` use the **child** branch, where localhost is pre-approved. In the Neon
   console, production branch, Auth, check "Allow localhost": turn it **off** on production when Part 1 is done (spec 7.3).
4. Verify: `neon neon-auth domain list --project-id damp-queen-64719841 --branch br-soft-glade-b4mkqyvd` shows exactly
   the two `https://` origins, no trailing slash, never `*.vercel.app`.

**C-8. Vercel (5 min).** Settings, Environment Variables.
1. `NEXT_PUBLIC_SIGN_IN_GOOGLE`, **not** marked sensitive (prebuilt deploys read it as a placeholder otherwise): Preview
   `1` for the test, Production `0` until you approve the B+C commit, then `1` at the cut (ships switched on).
2. `SITE_ORIGIN`: Preview the alias, Production `https://travel-beta-tan.vercel.app`.
3. After each preview deploy: `vercel alias set <deployment-url> travel-preview-<name>.vercel.app`.

**C-9. Verify (5 min).**
1. The agent runs the R1 check (spec 10.2) against P and L: the Google URL carries the right client id, `redirect_uri`
   equal to the branch callback, `scope` exactly `openid email profile`, a `state` and `code_challenge_method=S256`.
2. You open that URL in a private window and read the "to continue to" line (U7), as in Part 1 step 3.

**C-10. Brand verification (not now).** Needs a custom domain verified in Search Console (spec F11, O-7). Q122 says
branded before any public announcement; with no domain (Q148), ship unbranded and do not announce (Q-GC5).

## 7. The unknowns: which need a real Google login

| # | Unknown | Settled without a Google login? | How |
|---|---|---|---|
| U1 | Neon's Better Auth has the 1.6.11 linking fix | **Version evidence: yes** (EML-0 U3 found 1.7.0-rc.2 or later). **Behaviour: no** | Part 1 steps 1 to 4 (owner, live) |
| U2 | Neon exposes linking options | **Yes** | CLI help, console, Neon docs, a support question (agent) |
| U3 | Social sign-up can be turned off | **Moot** | Q120 opened sign-up, and EML-0 showed Disable Sign Up does not stop code sign-up; any gate is our own check |
| U4 | Error codes reach `errorCallbackURL` | **Partly** | Scripted: call the branch's `/callback/google` with a made-up `state` and `code` and record the redirect (`state_mismatch` family). `access_denied` and `account_not_linked` need Part 1 (owner) |
| U5 | PKCE and `state` on the Google leg | **Yes** | R1, scripted (C-9) |
| U6 | What Neon stores for a Google user; `travel_app` grants | **Grants: yes** (`has_table_privilege`, scripted). **Rows: no** | Needs one real Google user; the agent queries after Part 1 or 2.2 |
| U7 | What Google's screen names | **Mostly yes** | Open the R1 URL signed out of Google: the account chooser already shows "to continue to ...". The consent screen itself needs Part 1 |
| U8 | Partial wildcards in trusted domains | **Moot** | Exact alias (G8) |
| U9 | Account delete endpoint on Neon | **Yes** | On a password test user on the child branch (agent) |

New unknowns from the wording (added to GSI-0):

| # | Unknown | Without a login? | Why it matters |
|---|---|---|---|
| UC1 | Can a Google-only account remove Google, and does a code sign-in add a row that makes it removable? | No (needs a Google-only user) | Strings 46 and 47 |
| UC2 | Does Google show its account chooser every time, or pick the signed-in Google account silently? Can Neon send `prompt=select_account`? | Partly (CLI and docs) | Shared devices (string 49) and the "different Google account" case (24) |
| UC3 | Does `list-accounts` through our proxy return `providerId` and `createdAt` for the landing notices? | Yes (password test user shows the shape) | Strings 23 to 25 |
| UC4 | Does Neon create an account from a Google address Google has **not** confirmed? | No | String 19; and a security question for GSI-S: such a row could later gain an emailed-code sign-in for the real owner of the address while the Google link stays |

## 8. Builder tasks implied (existing GSI numbering; the master order is unchanged)

Each UI task ends with `travel-design-reviewer`, then `travel-verifier`. Verification for every task: `tsc --noEmit`,
the vitest suites named, and Playwright shots of `/sign-in/`, `/sign-up/` and `/account/` (and `/mine/` for GSI-M,
`/privacy/` for GSI-PG) at 1440 x 900 and 390 x 844, light and dark (dark through the theme control), into
`web/test-results/shots/google-sign-in/` (gitignored; copy elsewhere before review). Commits: one per task,
`web(GSI-1): ...` style, `git add` of owned paths only, with the project trailers.

| Task | Change from the spec | Model | Hours (delta) | Owns (adds to spec 13) | Acceptance |
|---|---|---|---|---|---|
| GSI-0 | Add UC1 to UC4, the scripted U4 probe and the signed-out U7 screenshot; Part 1 of section 5 is its owner session | Opus | +0.5 (3 to 3.5) | spec section 18 only | each U and UC recorded with evidence |
| GSI-1 | Strings 1 to 22 and 52 to 55 wired: `GOOGLE_COPY` and the code map (section 4) in `web/lib/auth/oauth-errors.ts`; `GoogleButton.tsx`; consent line on both pages; `signInGoogle` in `web/lib/auth/flags.ts` (not `capabilities.ts`); `Method` gains `'google'` and the last-used line; the pending mark (`sessionStorage` `auth.googlePending`, a timestamp only, cleared on read or after 10 minutes); cookie, offline and in-app checks before the call; reset on `pageshow` from the back-forward cache; `error` read once then removed with `replaceState`; the flag-off notice | Opus | +2 (8 to 10) | `web/lib/auth/flags.ts`, `web/lib/auth/auth-errors.ts` (strings 52 to 55), `web/lib/auth/oauth-errors.ts` (new), `web/components/auth/GoogleButton.tsx` (new), `SignInCard.tsx`, `memory.ts`, `auth.css`, `web/tests/auth/oauth-errors.test.ts`, `web/tests/auth/google-button.test.tsx` (new). Not: `proxy.ts`, `same-origin.ts`, `guard.ts`, `web/app/api/**`, `core/**`, `web/app/mine/**`, `web/app/privacy/**` | every string pinned by its key and exact text; no `error` text echoed (fuzz); 40+ return-path cases still pass; public start JS +0 B; e2e with mocked Neon for strings 9, 12 to 17, 20, 22 |
| GSI-2 | Strings 23 to 51: landing notice from the account rows (new: Google row only and user created in the last 10 minutes; linked: Google row created in the last 10 minutes and more than 60 s after the user); Continue to `next`; the remove dialog; the sign-out note; the interim delete line; flag-off read-only | Opus | +1.5 (4 to 5.5) | `web/app/account/SignInNotice.tsx` (new), `SignInMethods.tsx` (new), `web/app/account/page.tsx` (mount; serial after GSI-1), `web/app/account.css`, `web/tests/account/sign-in-methods.test.tsx`, `web/tests/account/sign-in-notice.test.tsx` (new) | notices decided without a URL parameter; returning sign-in shows none; dialog focus on Keep Google; 44 px targets at 390 |
| GSI-PG (new) | Strings 59 to 64 on the privacy page | Sonnet (B1) | +0.5 | `web/app/privacy/PrivacyBody.tsx`, `web/tests/shell/privacy-page.test.ts` | after EML-P on that file (hot spot order: GSI-P, EML-P, then this, then FBK-2, ORG-A); sentence 61 only if U6 confirms tokens; the date updated |
| GSI-M (new, only if Q-GC2 is yes) | Strings 56 to 58 | Sonnet (B1) | +0.5 | `web/app/mine/DeviceNotice.tsx`, `web/app/mine/MineShell.tsx`, the favourite toast's file, their tests; the nav spec and mine-and-bar-spec lines | the three lines read as section 2.7; NAV-3 and FAV-2 restore them |
| GSI-E | Add the U6 queries on the owner's test users and R1 against P | Sonnet | +0.5 (3 to 3.5) | spec section 18 | U6 recorded |
| GSI-VF | The owner's live session (section 5, parts 2 to 4) is its manual checklist (replaces spec 10.4); the verifier records results in spec 18 | Sonnet + owner 75 min | 0 | review notes | every line ticked or a finding filed |

v0.9 grows from 24 to about 29.5 agent hours (GSI-0 +0.5, GSI-1 +2, GSI-2 +1.5, GSI-PG 0.5, GSI-M 0.5, GSI-E +0.5). The
order (GSI-0, GSI-T, GSI-1, GSI-2, GSI-S, GSI-E, GSI-R, GSI-VF) does not change; GSI-PG and GSI-M sit in lane W (B1).

## 9. Questions for the owner

| # | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q-GC1 | Show the "Google shares your name, email address and profile photo link ..." line on both pages, not only on Create an account? | **Yes, both.** A new person can start on Sign in, and we only know after Google answers | One more line on the sign-in page |
| Q-GC2 | Until copies and favourites follow you into the account (v0.16), drop the three Mine lines that say "Sign in to keep them"? | **Yes** (GSI-M, 0.5 h). With Google on, signing in takes two taps, and nothing moves to the account yet | Fewer prompts to sign in on Mine until v0.16 |
| Q-GC3 | When Google creates a new account or is added to an existing one, stop on Account with the notice and a Continue button, instead of going straight back? | **Yes.** It is the only place to say "we added Google to your existing account" before the person moves on | One extra click in those two cases only |
| Q-GC4 | If Google's screen names a neon.tech host, say so under the button until the brand is verified? | **Yes**, as the code step already names Neon Auth as the sender | One more sentence until a custom domain exists |
| Q-GC5 | Ship Google on in B+C with an unbranded Google screen and no custom domain (Q122 said branded before a public announcement)? | **Yes, ship on and do not announce**; brand when the domain arrives (Q148 trigger) | Google's screen may look less familiar until then |

## 10. Gotchas

- **Removing Google is not permanent.** Under L1, the next "Continue with Google" with the same confirmed address adds it
  back. String 42 says so; do not hide it.
- **Shared devices.** Signing out here leaves Google signed in on the device, and Google may sign the next person straight
  in (UC2). String 49 says so.
- **The verifier is in browser history** once per sign-in (the redirect lands on it before `proxy.ts` strips it). Single
  use and tied to the challenge cookie; never ask the owner to paste it.
- **Back from Google restores the page from the back-forward cache** with the spinner still on, unless GSI-1 resets on
  `pageshow`.
- **`proxy.ts` sends a signed-out `/account/` load to `/sign-in/`.** A failed verifier exchange therefore looks like a
  plain return to the sign-in page; the pending mark (string 16) is the only way to explain it without touching `proxy.ts`.
- **Accounts made on the preview are production accounts** (one environment). List and delete them after the test.
- **An unconfirmed Google address (UC4)** is a possible takeover path in the other direction; GSI-S must rule on it before
  the cut.
- **"Or use Google" in the email card's banners** points up to step 1; on steps 2 and 3 the person needs "Change" first.

## Change log

| Date | Change |
|---|---|
| 2026-10-26 | First version (GSI-COPY, Opus): 65 numbered strings, voice note, code map, owner live test, console steps C-1 to C-10, unknowns split by whether a login is needed, UC1 to UC4, task deltas (+5.5 h), Q-GC1 to Q-GC5 |
