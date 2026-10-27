# Design review GSI-R and GSI-T: Continue with Google on the sign-in card, and the brand tokens (27 Oct 2026)

Status: **review, 27 Oct 2026 (travel-design-reviewer, model Opus 5.5).** Release B+C, v0.9. Review only: no app code and no
foundation file changed. Verdict: **the card is right and ships after M1 and M2.** The brand tokens (GSI-T) are approved as
written in tokens.md 2.3.

## 0. What this is based on

- Built code on `main` 94bbca1f (GSI-1 merged as c7c11ffb): `web/components/auth/GoogleButton.tsx`, `SignInCard.tsx`,
  `auth.css`, `parts.tsx`, `live.tsx`, `api.ts`; `web/lib/auth/oauth-errors.ts`; `web/app/themes.css` (brand lines 172-174,
  245-247, 318-320); `web/app/privacy/PrivacyBody.tsx`.
- Strings: [google-sign-in-copy-2026-10-26.md](google-sign-in-copy-2026-10-26.md) (strings 1 to 22, 52 to 55, 59 to 64).
- Foundation: [tokens.md](../foundation/tokens.md) 2.3, [components.md](../foundation/components.md) (touch 44 px, inputs 42/46,
  banners 5.4), [principles.md](../foundation/principles.md) P1 to P9.
- Google's rules: developers.google.com/identity/branding-guidelines, read 27 Oct 2026: light `#FFFFFF` / `#747775` 1 px
  stroke / `#1F1F1F`; dark `#131314` / `#8E918F` / `#E3E3E3`; neutral `#F2F2F2`, no stroke / `#1F1F1F`; Google Sans Medium
  14/20; padding 12 before the G, 10 after it, 12 after the text; rectangular or pill; the G in its standard colours,
  unscaled and never recoloured; labels "Sign in with Google", "Sign up with Google" or "Continue with Google". The page
  says nothing about hover, focus or pressed states.
- Shots supplied: `/Users/nks/workspace/travel-wt/shots-GSI/g01` to `g15` at 1440, 390 and 320, light and dark (90 files);
  privacy: `/Users/nks/workspace/travel-wt/EMLF/web/test-results/shots/emlf-privacy-{desktop,phone}-{light,dark}.png`.
- My own render (Chromium on Metal, 2x, dark set through the header's theme control, `reducedMotion` emulated) of the GSI
  `.fixture-auth` build (flags code and Google on, start call mocked): focus, hover, busy and reduced-motion shots, the
  computed colours, the accessibility tree, the live region text and the return banners. Shots in
  `web/test-results/shots/gsir/` (gitignored); `report.json` there holds every measured value.

## 1. What is right

- **Hierarchy (P3, P7).** Google button first and full width, then the consent line with "What we keep", then the text
  divider "or", then the email form, on both pages (g01, g02). Accessibility tree in that order: button "Continue with
  Google", paragraph (consent + link), paragraph "or", group (Email, Continue, footer), live region. The button is
  described by the consent line (`aria-describedby="auth-google-consent"`, plus `auth-google-last` when shown, g11). The G
  is `<img alt="">` inside an `aria-hidden` span: the name is the visible text only.
- **Brand rules.** Fill, stroke and label are exactly Google's light and dark sets; the G is Google's own unmodified file
  at 18 px; label "Continue with Google"; rectangular, radius 8 (allowed). No recolouring: hover thickens the stroke with a
  1 px shadow of the same stroke token, pressed moves 1 px, neither changes a colour. Sunlight takes the light set.
- **Colour only from tokens.** `auth.css` and `GoogleButton.tsx` hold no colour value; every colour is `--brand-google-*`,
  `--muted`, `--accent-text`, `--line` or `--focus`. No green or purple of ours anywhere; the only green is in Google's G,
  which tokens.md 2.3 exempts.
- **320 px.** Button 250 px wide, label on one line, no horizontal overflow (`scrollWidth` 320 in both themes); the consent
  line wraps to four lines and still fits (g01-320).
- **Every state renders as specified** (g03 to g15): one banner at the top of the card, the Google button directly under
  it, the email way below. Return banners are notices, the 429 is urgent (`role="alert"`), offline is the dashed offline
  banner. `?error=<script>` maps to the fallback (22) and the address is cleaned (`location.search` empty after load);
  `account_not_linked` moves focus into the email field (g05).
- **Busy (string 10).** `aria-busy="true"`, width locked (370 / 320 / 250 px before and after), the email fieldset disabled,
  focus stays on the button, the live region reads "Opening Google." With reduced motion the spinner's animation is
  `none` (a still ring) and the press does not move (busy-390-light-reduce.png).
- **Live regions.** Polite notices go through the card's one region; the urgent 429 is `role="alert"` only, not repeated.
  Measured: cancelled, restart, fallback and account-exists each land in the region once after load.

### Contrast (measured on the rendered page)

| Pair | Light | Dark | Verdict |
|---|---|---|---|
| `--brand-google-ink` on `--brand-google-fill` (label) | 16.48 | 14.47 | AAA |
| `--brand-google-stroke` on `--surface` (button edge on the card) | 4.53 | 5.17 | passes 3:1 for a control boundary |
| `--brand-google-stroke` on `--bg` (if the button ever sits on the page) | 4.19 | 5.71 | passes 3:1 |
| `--brand-google-fill` on `--surface` | 1.00 | 1.13 | not a boundary; the stroke carries it, as Google intends |
| consent line `--muted` on `--surface` | 6.94 | 7.45 | AA |
| "What we keep" `--accent-text` on `--surface` | 6.33 | 7.99 | AA |
| "or" `--muted` on `--surface` | 6.94 | 7.45 | AA |
| focus ring `--focus` on `--surface` (2 px, 2 px offset) | 16.06 | 13.83 | passes 3:1 |

tokens.md 2.3's figures match the render exactly. **GSI-T approved.**

## 2. Findings

### Must fix (before the B+C cut)

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| M1 | `/privacy/`, reached from "What we keep" on the card | The privacy page on `main` and on EML-F has no Google paragraph and no `id="accounts"` (`web/app/privacy/PrivacyBody.tsx:58` is a bare `<h2>Accounts</h2>`; lines 60-62 still say "your password" with no "if you set one" and "your name if you give one"). The link lands at the top of the page, and nothing on the page says what Google sends. Shots: `emlf-privacy-phone-light.png`, `emlf-privacy-desktop-dark.png` | The consent line promises an answer one tap away; a parent deciding whether to press Google finds none, and the page contradicts the card (the card says Google shares the name; the page says "if you give one"). With Google switched on, this is the privacy promise the site makes | Land GSI-PG before the cut, after EML-F on that file: `id="accounts"` on the h2 (string 63), strings 59 and 60 as written, 62 with the new-tab sr-only suffix, 61 only if U6 confirms tokens, `PRIVACY_CHANGED` to the ship date (64). Keep it in the existing "Accounts" section as a second paragraph; no new heading, so the page keeps its rhythm |
| M2 | `/sign-in/?error=account_not_linked` (g05-*) | String 20 tells the person to "add Google on your account page". That page part (Ways to sign in, Add Google) is GSI-2, still in its own worktree | If B+C ships GSI-1 without GSI-2, the instruction points to something that does not exist: a dead end on the one case where the person already has an account (P4) | Ship GSI-1 and GSI-2 in the same cut. If GSI-2 slips, change string 20 to "There's already an account here for this email. Sign in with your email below." until it lands |

### Should fix

| # | Screen | What is wrong | Why it matters | Fix |
|---|---|---|---|---|
| S1 | Chooser step, code send failed (g15-*-390, sign-up) | "We couldn't send the email. Try again shortly, or use Google." The Google button is not on this step; the person must find "Change" first (copy page 2.6 already allows the alternative) | "Use Google" with no Google on screen reads as a broken promise (P4, W5) | Add the text button the copy page allows, "Use Google instead", as an `auth-link` in the banner; it calls `go('email')` and moves focus to `.auth-google`. Same for strings 52 and 54 on sign-in. Words of the banner unchanged |
| S2 | Desktop and tablet from 640 px (g01-1440, `auth.css:137-139`) | The Google button drops to 42 px from 640 px, while the Continue button under it stays 44 (`--touch-min`) | components.md: touch targets 44 px minimum. 640 to 1024 px is iPad width, held by a person on a sofa; the two buttons also look slightly mismatched stacked in one card | Delete the `@media (min-width: 640px) { .auth-google { min-height: 42px; } }` rule and set `min-height: var(--touch-min)` with 46 on phone kept. Google allows scaling |
| S3 | Busy state, slow or dropped network (my render with the start call held: busy-390-*) | `authCall` (`web/components/auth/api.ts:28`) has no timeout. If the POST to `sign-in/social` never answers, the spinner stays and the email form stays disabled until a reload | A family on hotel or campground wifi is locked out of both ways in with no message; the copy's own rule W5 is that every failure leaves the email way open | Give the Google start an `AbortSignal.timeout(15000)`; on abort, end busy and show string 13 ("We couldn't open Google. Try again, or use your email below."). The email calls can take the same signal later |
| S4 | Cookies off (g12-*) | String 9 says what is wrong but not what to do: "Your browser is blocking cookies for this site. Sign-in needs them to keep you signed in." Every way in fails with cookies blocked, including email | The voice note (copy page 3) is "say what happened, then what to do"; here the only fix is in the browser, and the card does not say so | String 9: "Your browser is blocking cookies for this site. Sign-in needs them. Allow cookies for this site, then reload this page." (119 characters, three lines at 390, inside the 120 limit). Copy page row 9 updated with it |
| S5 | Foundation docs | The brand tokens are in tokens.md 2.3, tokens.json and themes.css, but components.md has no entry for the Continue with Google button, and specimen.html and changes-from-preview.md do not mention it | The next third-party button (Apple, U-later) has no pattern to follow; the foundation files disagree with each other | Foundation owner (this agent, follow-up): a components.md 2.x entry "Third-party sign-in button" (anatomy, heights 46/44, focus, busy, the system-font deviation of N2), a specimen swatch row for the two sets, a changes-from-preview line |

### Notes (no change needed for the cut)

| # | Screen | Note |
|---|---|---|
| N1 | Focus ring (focus-390-dark.png, focus-1440-light.png) | Ours (`--focus-ring`, 2 px at 2 px offset) around Google's stroke. Google's rules say nothing on focus, so our ring is right and keeps every control on the page alike |
| N2 | Label font (`auth.css:133`) | `system-ui` stack instead of Google Sans Medium. **Ruled acceptable:** Google Sans is not licensed for our pages, and a webfont for one label would add a download to the sign-in chunk (P9 spirit). Weight 500 and 14/20 match. If wanted, put `Roboto` first in the stack (no download; Android and ChromeOS then match Google's own buttons). Record the deviation in tokens.md 2.3 with S5 |
| N3 | Spacing inside the button | Gap between G and label is `--s-3` 12 px; Google's figure is 10. Centred full-width layout is what Google's own rendered button does. Not worth a one-off token |
| N4 | Dark G | The colour G sits on `#131314`, as in Google's own dark button assets. The guideline line "the logo must appear on a white background" refers to the standalone logo; compare once against the dark SVG in Google's download bundle during the owner test (copy page 5, part 2.1) |
| N5 | 429 (g08-*) | The Google button stays enabled during the wait. Right: Google's label cannot carry a countdown, and a second press only shows the same banner. "Please wait a minute, then ..." for 60 s and "Too many sign-in attempts. Wait 15 minutes, ..." otherwise match string 14 |
| N6 | String 17, restart (g06-*) | The only Google failure without "or use your email below" (W5). Optional: "That sign-in took too long or was started in another tab. Please start again, or use your email below." (102) |
| N7 | In-app browser at 320 (g13-320-*) | The five-line banner pushes the email field under the bottom bar in the first screen. Acceptable: the banner says "use your email below" and the page scrolls. Do not reorder the card for this case (the detection can be wrong) |
| N8 | Live region on load | The region mounts with the card and is filled 60 ms later (`live.tsx:17`). VoiceOver on iOS can drop a polite message that arrives this soon after the region appears. The banner is also the first thing in the card, so nothing is lost; the owner's VoiceOver step (copy page 5, 2.13) confirms. If it is dropped, raise the first-load delay to about 500 ms |
| N9 | Busy with reduced motion | A still ring for under a second, with `aria-busy` and "Opening Google." read out. Enough |
| N10 | Shell, all sign-in shots | The bottom bar marks Mine as current on `/sign-in/` (and the header person glyph is amber). That is the NAV rule for the sign-in entry, not this lane; mentioned so the owner is not surprised |

## 3. Shots for the owner

Best views of the card:

- `/Users/nks/workspace/travel-wt/shots-GSI/g01-sign-in-390-light.png` and `g01-sign-in-390-dark.png` (the phone, both themes)
- `/Users/nks/workspace/travel-wt/shots-GSI/g01-sign-in-1440-light.png` and `g01-sign-in-1440-dark.png` (laptop)
- `/Users/nks/workspace/travel-wt/shots-GSI/g04-cancelled-390-light.png` (a return banner)
- `/Users/nks/workspace/travel-wt/shots-GSI/g08-rate-limited-390-dark.png` (the urgent banner in dark)
- `/Users/nks/workspace/travel-wt/shots-GSI/g01-sign-in-320-light.png` (smallest phone)

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | First version (GSI-R and GSI-T, Opus 5.5): 2 must-fix, 5 should-fix, 10 notes; brand tokens approved with measured ratios |
