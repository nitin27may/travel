# Design review GSI-UX-R: the centred sign-in, sign-up and reset pages (27 Oct 2026)

Status: **review, 27 Oct 2026 (travel-design-reviewer, model Opus 5.5).** Review only: no app code and no foundation file
changed. Verdict: **the new frame is the right design and reads as a real sign-in page. It ships after M1 and M2.** The
should-fix items are small CSS and copy changes and can go in the same builder pass.

## 0. What this is based on

- Built code on `main` b5ecedfb (GSI-UX merged as ab8b96d6): `web/components/auth/AuthFrame.tsx`, `web/styles/auth-page.css`,
  `web/components/auth/auth.css`, `EmailStep.tsx`, `ChooserStep.tsx`, `CodeStep.tsx`, `ResetFlow.tsx`, `SignInCard.tsx`,
  `parts.tsx`; `web/components/ui/ui.css:475` (`.ban`); `web/app/themes.css` (light 107-139, dark 180-212).
- Copy: [google-sign-in-copy-2026-10-26.md](google-sign-in-copy-2026-10-26.md). Previous review:
  [review-gsi-r-2026-10-27.md](review-gsi-r-2026-10-27.md) (its M1 and S1 to S4 are closed in this build: privacy
  `#accounts` paragraph, "Use Google instead", 44 px Google button, 15 s start timeout, cookies wording).
- Foundation: [principles.md](../foundation/principles.md) P1 to P9, [components.md](../foundation/components.md) 2.1 (44 px
  targets, required mark "·"), 5.4 (banners), [tokens.md](../foundation/tokens.md).
- Shots supplied: `/Users/nks/workspace/travel-wt/shots-GSIUX/` (312 files): email states `01` to `32`, Google states `g01`
  to `g18`, at 1440, 390 and 320, light and dark, plus `privacy-accounts-*` and `privacy-device-*`. Dark was set through
  the header's theme control (`setTheme` in the shot spec). Note: the `g*` shots are full-page captures, so the fixed header
  and bottom bar are sometimes painted mid-page (g01-sign-in-320-dark, g05-*-390, g15-*-320-light). That is the capture,
  not the page.
- My own renders against the GSI-UX `.fixture-auth` build (Chromium on Metal, 2x, free port picked by the harness):
  g14 re-rendered six times, a load-by-load probe of the g14 banner, and a keyboard walk at 390 with `reducedMotion:
  'reduce'` on `/sign-in/`, `/sign-up/` and `/sign-in/reset/` (tab order, every target's box, the step animation,
  `scrollWidth`). Shots in the session scratchpad, not committed.

## 1. What is right

- **The frame (P3, P7).** One panel, max 28rem, centred, `--surface` on `--bg` with a 1 px `--line` edge and radius
  `--r-4`; title in the display face, one-line purpose under it, then the card. At 1440 the whole step 1 sits above the
  fold (g01-sign-in-1440-light); at 390 the panel runs edge to edge with 14 px margins and the whole first step, including
  "New here? Create an account", is on the first screen (g01-sign-in-390-light). This answers the owner's complaint: it no
  longer looks like a bare form.
- **Hierarchy.** Google first and full width, the consent line, the "or" divider, Email, Continue, the next-step line,
  "Forgot password?", a hairline, then "New here? Create an account". Primary action is obvious (amber Continue), the
  alternative (Google) is first without competing in colour, and the two other ways on are quiet and centred.
- **Consistency across the three pages.** Same frame, same title style, same footer pattern: "New here? Create an account"
  (sign-in), "Already have an account? Sign in" (sign-up, 14-signup-email-light-390), "Remembered it? Back to sign in"
  (reset, 19-reset-email-light-390). Sign-up correctly has no "Forgot password?"; reset correctly has no Google.
- **Focus order** (measured, all three pages): Continue with Google, What we keep, Email, Continue, Forgot password?,
  Create an account, Privacy, Terms, then the site footer. Reset: Email, Email me a code, Back to sign in, Privacy, Terms.
  Logical, matches the visual order, no traps.
- **44 px targets** (measured at 390): Google 320 x 46, Email 294 x 44, Continue 320 x 44, What we keep 96 x 44, Forgot
  password? 141 x 44, Create an account 125 x 44, Sign in (sign-up footer) 48 x 44, Back to sign in 102 x 44, Privacy 61 x
  44, Terms 151 x 44. Change, Show and "Use Google instead" are 44 tall in the shots. All pass components 2.1.
- **320 px.** No horizontal overflow (`scrollWidth` equals the viewport in every page I walked); "RESET YOUR PASSWORD"
  wraps to two balanced lines (19-reset-email-dark-320); the Google label stays on one line (g01-sign-in-320-dark).
- **Reduced motion (P5).** The step change becomes a 120 ms opacity fade with no movement (`auth.css:20-22`); the Google
  press does not move. Right.
- **Error and notice states** render with the right kind: field errors under their field in `--crit` mono
  (02-email-invalid, 16-signup-password), urgent banners with border (09-password-wrong, 23-chooser-held-long), notices
  without (30-code-resent, g05, g15). When codes are held, "Use my password" becomes the amber primary and the code button
  carries the wait (23-chooser-held-long-dark-390): the person always has a way forward (P4).
- **Privacy link** lands on the Accounts heading with the new Google paragraph directly under it, heading clear of the
  sticky header (privacy-accounts-390-light).
- **Wording.** "Forgot password?", "New here? Create an account", "Remembered it? Back to sign in" and "Already have an
  account? Sign in" are the conventional phrases a first-time visitor expects (P4). "Next, choose a code we email you or a
  password." does its job: it tells the person that Continue does not send anything yet and that a password is optional.

### Contrast (computed from `themes.css`, light / dark)

| Pair | Light | Dark | Verdict |
|---|---|---|---|
| Title `--ink` on `--surface` | 16.06 | 13.83 | AAA |
| Sub-line and leads `--ink-2` on `--surface` | 12.09 | 10.76 | AAA |
| Next-step line, consent, sender note, "or", label `--muted` on `--surface` | 6.94 | 7.45 | AA |
| Links (What we keep, Forgot password?, Create an account) `--accent-text` on `--surface` | 6.33 | 7.99 | AA |
| Continue label `--accent-ink` on `--accent` | 6.96 | 6.96 | AA |
| Masked address `--ink` on `--well` | 13.92 | 15.94 | AAA |
| Change `--accent-text` on `--well` | 5.49 | 9.21 | AA |
| Notice banner `--info` on `--info-soft` (and its "Use Google instead") | 5.91 | 7.61 | AA |
| Urgent banner `--crit` on `--crit-soft` | 5.45 | 6.36 | AA |
| Field error `--crit` on `--surface` | 6.61 | 7.01 | AA |
| Input edge `--line-2` on `--surface` | 3.67 | 3.42 | passes 3:1 for a control boundary |
| Privacy and Terms under the panel `--muted` on `--bg` | 6.42 | 8.23 | AA |
| Focus ring `--focus` on `--surface` | 16.06 | 13.83 | passes 3:1 |
| Panel edge `--line` on `--bg` | 1.25 | 1.56 | decorative, not a control; the panel reads by its fill and edge together (acceptable) |

Disabled labels ("Send a new code (in 1:00)", "Email me a code (in 15 min)") are exempt from 1.4.3; the first is `--muted`
on `--surface` (6.94 / 7.45) anyway.

## 2. Findings

### Must fix

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| M1 | Step 1 after a Back from Google, string 16 ("Signing in with Google didn't finish ...") | The banner does not appear in most loads. Supplied shots: present in g14-did-not-finish-1440-dark and g14-*-320, absent in g14-did-not-finish-1440-light, g14-did-not-finish-390-light and g14-did-not-finish-390-dark (each identical to g01). My re-render: absent in 4 of 6. My probe of `/sign-in/?neon_auth_session_verifier=v1` with a fresh `auth.googlePending` mark: banner present in 1 of 6 loads, and when it is missing it never appears (polled for 1.6 s; the card mounts at about 330 ms and the address is cleaned to `/sign-in/`). The `g14-*-390` shots in `shots-GSI` from an hour earlier are also the size of the plain card, so this may predate GSI-UX; it is not caused by the frame change | This is the only message a family gets when Google's screen was closed or the exchange failed. Without it, a person who pressed Google and came back sees the same page with no explanation and presses again into the same failure (P4, copy rule W5) | Builder: find why `returnNotice()` (`SignInCard.tsx:66-72`, read in the `useState` initialiser at 102-106) returns null on most loads. Check first whether the card mounts twice (the effect at 141-148 clears the pending mark and strips the query, so a second mount reads nothing), and whether the GSI-SEC verifier scrub in `proxy.ts` / `lib/auth/verifier.ts` changes the address before the card reads it. Make g14 an assertion in `auth-google.spec.ts` (banner visible at 1440, 390 and 320), not only a screenshot |
| M2 | Every step after step 1, and the consent line on step 1 (04-code-light-390, 03-chooser-light-390, 13-unverified-confirm-light-390, 21-reset-done-signed-out-light-390, 17-signup-verify-light-1440, g01-sign-in-1440-light) | Mixed alignment, as the builder flagged. Title, sub-line, step heading, buttons, next-step line and footer are centred; the text between them is left-aligned: "We sent a 6-digit code to", the Neon sender note, "No password needed: we email you a 6-digit code." (sitting between two centred buttons), "Confirm your email first.", "For your safety you were signed out everywhere ...", and the Google consent line under a centred button | The owner's request was a polished centred page; a centred heading over a left-aligned one-liner looks like a layout mistake and is the first thing an owner's eye catches. It also makes the chooser's help line look attached to the wrong button | One rule for the panel: **page text is centred, field text is left-aligned.** Centre `.auth-lead`, `.auth-note`, `.auth-help` (outside a `.field`), `.auth-google-consent` and the done-state lead, with `text-wrap: pretty` (`auth.css:36-39`, 162-163). Keep left-aligned what belongs to an input: field labels, field help ("The code works once, for 5 minutes.", "At least 8 characters."), field errors, the masked-address well, and banner text. Concretely: `.auth-lead, .auth-note, .auth-step > .auth-help, .auth-choices > .auth-help, .auth-google-consent { text-align: center; text-wrap: pretty; }`. Field help inside `.field` keeps its left alignment because it is a different element. Re-shoot 03, 04, 13, 17, 20, 21 and g01 |

### Should fix

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| S1 | Steps 2 and later on all three pages (20-reset-code-light-390, 04-code-light-390, 30-code-resent-light-390) | The page sub-line stays above the step heading, so steps 2+ stack three headings: "SIGN IN", "Save and revisit your trip drafts.", "Check your email". On reset the sub-line is three lines ("We email you a code, then you choose a new password. Your trip drafts stay as they are."), which pushes "Set password" under the bottom bar at 390, and the code field is focused, so the phone keyboard covers the rest | On a phone in a hotel lobby the person sees instructions they have already followed instead of the button they need (P3, P6: the right text at the right moment) | Hide the sub-line once a step heading exists, the way the done state already does (`auth.css:128`): `.auth-page:has(.auth-step-title) .auth-head .auth-sub { display: none; }`. Step 1 has no step heading, so it keeps its sub-line. Reduce `.auth-screen .auth-page` gap between head and card from `--s-6` to `--s-5` on steps 2+ if the head then looks detached |
| S2 | Every multi-line banner (g05-account-exists-390-light, g15-code-send-failed-320-dark, 23-chooser-held-long-dark-390, 30-code-resent-light-390, g14-did-not-finish-1440-dark) | The banner icon is vertically centred on the whole text block (`ui.css:475`, `.ban { align-items: center }`). With three to five lines plus the "Use Google instead" action, the icon floats beside the second or third line | The icon is the first thing that says "notice" or "problem"; beside the middle of a paragraph it reads as decoration rather than a marker for the message | In the card: `.auth-card .ban { align-items: flex-start; } .auth-card .ban > svg { margin-top: calc((1lh - 16px) / 2); }` so the icon sits on the first line. Foundation follow-up (this agent): components.md 5.4 to say "icon aligned to the first line" for every banner; one-line banners look the same either way |
| S3 | "We sent a new code" notice (30-code-resent-light-390, -dark-390) | The masked address breaks at the ellipsis: "n…" ends line 1 and "@example.com" starts line 2 | A split address is hard to recognise as one's own, and the notice exists so the person checks which inbox (P4) | Render the address in that message inside a `white-space: nowrap` span (the same `auth-masked` element the address well uses, `parts.tsx:71`), or build `resentMessage()` (`lib/auth/auth-errors.ts:89`) as text plus a nowrap span rather than one string |
| S4 | Human check (31-turnstile-challenge-light-390) | `.auth-turnstile` (`auth.css:121-122`) is a plain block, so the widget sits at the left edge of a centred panel. The fixture stub shows it as left-aligned text with empty space under it; the real Turnstile widget is a fixed 300 x 65 box and will do the same | The one moment the page asks the person to do something unusual, the control is visually off-axis from everything else | `.auth-turnstile { display: flex; justify-content: center; }` and keep the notice banner above it. Re-shoot 31 with the real widget size (a 300 x 65 placeholder in the fixture) |
| S5 | Step 1, the next-step line at 390 and 320 (g01-sign-in-390-light, 14-signup-email-light-390) | "Next, choose a code we email you or a password." wraps with "password." alone on the second line | A one-word widow under the main button looks unfinished, exactly where the eye goes after Continue | `text-wrap: balance` on `.auth-next` (`auth.css:75`). Wording stays. Optional for sign-up only: "Next, choose a code we email you or a new password." so it does not read as "your password" to a new user |

### Notes (no change needed for the cut)

| # | Screen | Note |
|---|---|---|
| N1 | Step 1 "Email ·" (g01-*) | The "·" is the foundation's required mark (components.md: "Required mark '·' after the label"). On a form with one field it reads as stray punctuation. Proposal for the foundation, not this lane: a form whose every field is required and that has one field drops the mark. I will raise it as a components.md change separately |
| N2 | Link styles in the panel (g01-sign-in-1440-light) | Four link looks in one panel: mono accent ("Forgot password?", "Use my password instead"), serif 600 accent ("Create an account"), serif 400 accent ("What we keep"), mono muted (Privacy, Terms). Each follows a rule (text actions mono, inline prose links serif, legal muted), and together they still read as one family because of colour and underline. Leave it; revisit only if the owner remarks on it |
| N3 | Privacy and Terms under the panel, and again in the site footer (01-email-light-390) | On a phone both lines are on one screen. Conventional for sign-in pages and harmless; keep. If the owner wants the panel calmer, the line under the panel is the one to drop |
| N4 | Header on these pages (g01-sign-in-1440-light, 14-signup-email-light-390, 16-signup-password-dark-390) | At 1440 the header still shows "Sign in" with no current state while on the sign-in page; on phone the person glyph is amber on `/sign-in/` and `/sign-in/reset/` but white on `/sign-up/`. NAV rule, not this lane (GSI-R N10); the sign-up mismatch should be added to the NAV backlog |
| N5 | Code step sender note (04-code-light-390) | Four lines about Neon Auth before the code field. Needed (the sender name is unfamiliar and the spam hint saves a support message), and after M2 it reads as a centred paragraph. If S1 is not enough to keep the button in view, move the note under "Send a new code" rather than shortening it |
| N6 | Light panel edge (g01-sign-in-1440-light) | `--line` on `--bg` is 1.25:1; the white fill on `#F5F6F8` carries the panel. Visible on a laptop screen; in Sunlight `--line` is `#8C99A8`, so the edge is strong where it matters |
| N7 | Fixed bars in full-page captures | The shot harness's `fullPage: true` paints the sticky header and bottom bar at the scroll position (g01-sign-in-320-dark, g05-account-exists-390-light, g15-code-send-failed-320-light). Not a page bug. For the owner, use viewport shots, or scroll to the top before a full-page capture |

## 3. Shots for the owner

Best views of the new design:

- `/Users/nks/workspace/travel-wt/shots-GSIUX/g01-sign-in-390-light.png` (phone, the whole first step)
- `/Users/nks/workspace/travel-wt/shots-GSIUX/g01-sign-in-1440-light.png` (laptop, centred panel)
- `/Users/nks/workspace/travel-wt/shots-GSIUX/g14-did-not-finish-1440-dark.png` (dark, with a notice banner)
- `/Users/nks/workspace/travel-wt/shots-GSIUX/19-reset-email-light-390.png` (reset page, same frame)

What M2 and S1 change (show alongside, so the owner sees what is still to come):

- `/Users/nks/workspace/travel-wt/shots-GSIUX/04-code-light-390.png` (left-aligned lines under a centred heading)
- `/Users/nks/workspace/travel-wt/shots-GSIUX/20-reset-code-light-390.png` (three stacked headings push the button down)

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | First version (GSI-UX-R, Opus 5.5): 2 must-fix, 5 should-fix, 7 notes; contrast for every approved pair, light and dark |
