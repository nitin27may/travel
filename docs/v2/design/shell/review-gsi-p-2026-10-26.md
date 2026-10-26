# Design review: GSI-P, the privacy page and footer link (26 Oct 2026)

Reviewer: `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Review only: no app code changed. Branch `public/GSI-P`, commit 6c1e0873, worktree `/Users/nks/workspace/travel-wt/v2-GSIP`.

**Verdict: not approved. Ship after the must list.** The page is built right: `page-head` and `prose` used as specified, one h1, plain words, no new colour, and the footer link sits on every page that has the footer. The problem is the words. Four claims on the page are wrong or incomplete against the code and the production setup, the page offers no way to remove an account, and the code says the copy is owner-approved when no approved copy exists. A privacy page that is wrong is worse than none, and Google's consent screen review (R-84) and the Google Maps Platform terms both read it. The footer credit change is acceptable (section 3).

Counts: **5 critical (must before merge), 5 important, 3 polish.**

## 0. What this is based on

- **Brief and spec**: [MASTER-ORDER.md](../../build/MASTER-ORDER.md) 6.3 (GSI-P), [google-and-apple-sign-in.md](../../features/google-and-apple-sign-in.md) 6.2 (what `/privacy/` must say: what is collected, why, where, how long, how to export and delete), [email-sign-in-and-account-emails.md](../../features/email-sign-in-and-account-emails.md) "Decision 25 Oct" (Neon sends account mail, Resend owner alerts only), PLAN R-84 and Q222.
- **Code read**: `git show 6c1e0873`, plus `web/app/layout.tsx` (beacon), `web/lib/map/family.ts` (Google Maps on trip pages), `web/lib/server/mailer.ts` and `core/src/mail/` (Resend owner-only guard), `web/lib/auth/guard.ts`, `web/lib/server/client-ip.ts`, `core/src/quota/keys.ts`, `core/src/db/migrations/0011_quota.sql` (hashed rate-limit keys, 48 h purge), `web/app/account/` (drafts), `web/components/shell/ReportLink.tsx` and `web/lib/config/product.ts` (`reportUrl` is null), `web/app/terms/page.tsx`, every `localStorage` use in `web/`.
- **Licences**: `NOTICE`, `data/reference/licences.json`, [sources-and-licences.md](../../../../research/method/sources-and-licences.md) section 5.
- **Authority**: [principles.md](../foundation/principles.md) P1 to P9, [components.md](../foundation/components.md) (page head, prose), [tokens.md](../foundation/tokens.md), [keep-from-live-site.md](../keep-from-live-site.md), [trip-scope-scenarios.md](../trip-scope-scenarios.md), [product-direction-2026-10-18.md](../product-direction-2026-10-18.md).
- **Shots**: all twelve builder shots in `/Users/nks/workspace/travel-wt/v2-GSIP-shots/` read (privacy, footer on a trip, footer on a place; 1440 and 390; light and dark; 2x). **I did not render my own**: the coordinator told me not to build because another agent was building in that worktree. That departs from the reviewer's standing rule, so the verifier's sweep must include the privacy page and footer at 1440 and 390 in both themes, with dark set through the theme control, and must use viewport tiles on phones (see I5).

## 1. What is right

- **Components.** `header.page-head` with h1 and `.lede`, then `.prose` with h2 sections: the same structure as `/terms/`, so the two read as a pair (P4). One h1, no skipped levels. The measure is 46rem (about 75 characters at 1440), which is right for reading.
- **Phone.** The lede is hidden below 640 px by the shared rule (`app.css:115`). That is the component's design, and on this page nothing is lost because the h1 says it.
- **Footer.** "Privacy" is the third link in the existing row, in the same style, before the Report link when that link is on. The row wraps cleanly at 390 (two lines of links and credits, then Units) and stays on one line at 1440. The globe page hides the footer by design (polish P1).
- **Sitemap and indexing.** Listed in `sitemapInput.fixed`; no `noindex`. Google's branded consent screen needs a public privacy page, and this meets that.
- **No new colour, no green.** Only `--ink`, `--ink-2`, `--muted`, `--bg`, `--line`.
- **True claims, checked in code.** The beacon loads only when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set, which is Vercel Production only (TODO, 25 Oct). Resend goes through `ownerOnly`, which refuses any recipient but `OWNER_EMAIL` while `MAIL_FROM` is unset. Public pages carry no household data (the PRIV1 detector). Our own logs drop addresses, codes and IPs (`guardLog`).

### Contrast (approved pairs, WCAG 2.x)

| Pair | Light | Dark | Use |
|---|---|---|---|
| `--ink` on `--bg` | #172230 on #F5F6F8, 14.85:1 | #E7ECF1 on #0F1620, 15.28:1 | h1, h2, body, links in prose and footer |
| `--ink-2` on `--bg` | #2B3746 on #F5F6F8, 11.18:1 | #C9D2DC on #0F1620, 11.88:1 | lede |
| `--muted` on `--bg` | #4D5B6B on #F5F6F8, 6.42:1 | #A3B0BE on #0F1620, 8.23:1 | footer credits text |

All pass AA for small text; ink and ink-2 pass AAA. Links are underlined, so they do not rely on colour.

## 2. Findings

### Critical: must fix before merge

**C1. The account section leaves out what an account holds.** Screen: `/privacy/`, "Accounts". The page says Neon stores "your email address and sign-in details" and that "We use them to sign you in and for nothing else." In the code an account also holds the trip drafts a person saves (`public.planner_draft`, shown and edited on `/account/`), possibly a name (`SessionUser.name`), and a hashed password. The rate limiter also keeps day-scoped HMAC hashes of the address and IP, deleted 48 hours after their window ends. Why it matters: a family that saves a draft of where they are going has stored travel plans with us, and the page tells them we hold only an email address. Fix: replace the section with the "Accounts" copy in section 4.

**C2. The page offers no way to delete an account or to contact anyone.** Screen: `/privacy/`. Spec 6.2 says the page states "how long, how to export and delete". There is no delete-account control in the app (F17 items 15 and 16 are not built), the Report link is off (`reportUrl = null`), and `/terms/` says "ask first" with no route either. Why it matters: anyone who signs up, including through Google, has no way to leave. That fails a basic privacy expectation, and Google's consent screen review checks for it. Fix: add the "Removing your account" section in section 4 with a working route. **This needs an owner decision (new question):** (a) a contact address on the page, for example a dedicated alias, until F17's delete button ships (recommended); or (b) keep `NEXT_PUBLIC_SIGN_IN` off in production until the delete button exists. Without one of the two, sign-in must not be on in production.

**C3. Google Maps is not named, but trip maps load it in production.** Screen: `/privacy/`, and every trip page. `tripPageFamily()` picks `google-js` whenever the browser key and Map ID are set, and HANDOVER says the map variables are set in Vercel Production. Then the visitor's browser loads Google's script and tiles, and Google receives their IP address and browser details. If they are signed in to Google, it may also receive Google's own cookies. The Google Maps Platform terms require a site that uses the Maps APIs to disclose that in its privacy policy and link Google's privacy policy. Why it matters: it is the one third party on the page a reader would most want to know about, and leaving it out is a terms breach. Fix: add the "Maps and photos" section in section 4. Render the Google sentence only when `tripPageFamily() === 'google-js' || placePageFamily() === 'google-js'` (import from `@/lib/map/family`; this is a server component, so it adds no client JS). That way the page never names a service that is off, and never leaves out one that is on.

**C4. "Nothing else about you" is wrong for Cloudflare Web Analytics.** Screen: `/privacy/`, "Page counts". Cloudflare's dashboard also shows the referring site, country, browser, operating system and device type, and page-speed figures. These are totals, not per person, but they are more than the path. Why it matters: the sentence makes a promise the tool does not keep, and the page's credibility rests on its exact claims. Fix: use the "Page counts" copy in section 4.

**C5. The code says the copy is owner-approved, and it is not.** File: `web/app/privacy/page.tsx` line 10 ("The copy is owner-approved wording") and `web/tests/shell/privacy-page.test.ts` line 21 ("the approved copy"). The brief says the planner drafts the words and the owner approves them (MASTER-ORDER 6.3). No approved copy exists in `docs/v2/`, and no Q row records an approval. Why it matters: a later editor will treat the words as signed off and will not question them. Fix: change the comment to `Copy drafted for GSI-P; owner approval recorded as Q<n> in PLAN.md.` and the test title to `'names each service the site uses and what it does with it'`. Then put the section 4 copy (with the C2 route filled in) to the owner as a PLAN question, and record the answer before merge. Pin the new key sentences in the test.

### Important: fix in this lane, or before v0.2 ships

**I1. "Set no tracking cookies" is true but evasive.** Signing in sets session cookies (Neon Auth). The browser also keeps the theme, units, saved views, copy drafts (`travel:v1:copy-drafts`), globe settings, a Wikidata facts cache and the last sign-in method in `localStorage`. Why it matters: "no tracking cookies" invites the question "which cookies, then?", and the honest answer is short. Fix: use the "Cookies and this device" copy in section 4.

**I2. The Turnstile sentence says nothing.** "It is shown only when it is turned on" is circular. In production the guard fails closed without the Turnstile secret, so whenever sign-in is on, Turnstile is on. Fix: "Cloudflare Turnstile runs on the sign-in and sign-up forms to tell a person from a bot. To do that, Cloudflare looks at your browser. It never runs on trip or place pages."

**I3. Server logs: no retention period, and the browser string is missing.** Vercel's request logs also record the user agent, and the spec asks "how long". Fix: use the "Server logs" copy in section 4. The owner should confirm the retention period in the Vercel dashboard for the plan in use and put that figure in the copy; do not publish a guess.

**I4. The "Email" section reads as "visitors never get email".** Neon's shared sender sends sign-in and reset codes to visitors (Decision 25 Oct). EML-P will add the full "Sign-in emails" section later, but until then this page must not suggest the opposite. Fix: use the "Email" copy in section 4. EML-P then replaces the first sentence and keeps the Resend sentence.

**I5. The 390 shots cannot show the "Accounts" heading.** In `privacy-*-390.png` the fixed bottom bar is drawn over the middle of the page, so it covers the "Accounts" h2 and the first line of its text. This is a full-page capture artifact, not a layout fault. But it means nobody has checked that section on a phone. Fix (verifier): capture the 390 page as viewport tiles (scroll, then shoot each screen) and read every section.

### Polish

**P1. No privacy link on the globe.** `globe.css:7` hides the footer, so `/globe/` has no route to `/privacy/`. The beacon runs there, and so do the third-party tile loads. It is acceptable for now because the home page links it (which is what Google checks). Later, add "Privacy" to the globe's compact attribution or to its info panel.

**P2. No date.** A privacy page should say when it last changed (P6: the right metadata at the right moment). Add a last line in `.prose-note`: "Last changed 26 October 2026." Update it on every edit of the page (EML-P, FBK-2 and ORG-A each add a section).

**P3. About the data does not link to Privacy.** Add one item to the list on `/about/data/` (outside GSI-P's files, so give it to the next lane that owns `web/app/about/`).

## 3. The footer credit line: acceptable, with two words restored

The old line said where credits are ("credited where they appear") and gave the credit form ("OpenStreetMap contributors", "Wikimedia Commons authors"). The new line is "Credits: OpenStreetMap, OpenFreeMap, Mapterhorn, Wikimedia Commons."

**Legally it is acceptable.** The footer is not the attribution that the licences require. That attribution sits next to the data, and GSI-P does not touch it:
- Trip pages end with "Maps: OpenFreeMap, data © OpenStreetMap contributors, relief by Mapterhorn", plus one line per photo giving title, author and licence (shot `footer-trip-*`).
- Place pages show "Route line: © OpenStreetMap contributors (ODbL)" under the map, and each photo carries its own credit (shot `footer-place-*`).
- MapLibre maps carry their own attribution control (`lib/map/maplibre/engine.ts`, `lib/globe/engine.ts`).
- Home and `/trips/` render `<Credits>` for their cover photos.
- `/about/data/` lists every licence from `licences.json`.

ODbL and CC BY are met there, and `sources-and-licences.md` section 5 asks for nothing more.

**As writing it is weaker.** "Credits: Wikimedia Commons" credits the host rather than the authors, and CC BY is about the authors. It also drops the pointer to where the full credits are. The cost of keeping the meaning is small. **Recommended (important, same lane):**

> Credits: OpenStreetMap contributors, OpenFreeMap, Mapterhorn and Wikimedia Commons authors.

That adds 24 bytes to the new line. The old line was 135 characters and the new one is 67, so the change still saves more than the Privacy link adds. The verifier rechecks the S13 place-HTML median in both builds.

**Rule for later lanes:** a size squeeze may shorten the footer summary, but it never removes or shortens an on-page credit line (map attribution, photo author and licence, the trip-end "Maps:" line). Those are the licence attribution.

## 4. Replacement copy for `web/app/privacy/page.tsx` (for owner approval, C5)

Same components: `page-head`, then `prose` with h2 sections. Square brackets mark the values the owner fills in.

**Lede:** What this site keeps about you, what it does not, and who handles it.

**Reading the site.** You do not need an account to read any trip or place. The pages hold no household data: nothing about who travels, where they live or what they have booked.

**Cookies and this device.** Reading the site sets no cookies. Signing in sets cookies that keep you signed in until you sign out; they are used for nothing else. Your browser also keeps a few things on this device: light or dark, km or miles, saved views and trips you are copying. They stay on the device and are not sent to us.

**Page counts.** On the live site we count page views with Cloudflare Web Analytics. It sets no cookies and does not follow you from site to site. It shows us totals: which pages were opened (for example `/trips/dolomites-2027/`), which site linked to them, and the country, browser and kind of device. It never shows us who you are. It runs only on the live site.

**Maps and photos.** Maps, photos and some globe facts load straight from the services that hold them: OpenFreeMap and Mapterhorn for maps, Wikimedia Commons for photos and Wikidata for country facts. [Only when a Google family is on:] Trip maps use Google Maps, which loads from Google under [Google's privacy policy](https://policies.google.com/privacy). Like any website, these services see your IP address and browser when your device asks them for a file. We send them nothing else about you.

**Server logs.** Our host, Vercel, keeps request logs: the page asked for, the time, the browser and the IP address the request came from. We read them only to find faults, and Vercel deletes them after [period]. Our own logs never hold your email address, a sign-in code or your IP address.

**Accounts.** Making an account is optional. If you make one, we keep your email address, your name if you give one, your password in a scrambled form that cannot be read back, and the trip drafts you save. They are held by Neon, our database provider, in the United States. We use them to sign you in and to show you your drafts, and for nothing else.

To stop repeated guessing of passwords and codes, we count attempts for each email address and each network for one day. We keep only a scrambled form that cannot be turned back into the address or the IP, and we delete it within two days.

Cloudflare Turnstile runs on the sign-in and sign-up forms to tell a person from a bot. To do that, Cloudflare looks at your browser. It never runs on trip or place pages.

**Email.** Sign-in and password reset codes are sent by Neon, the service that runs our sign-in. We use Resend only to send alerts to the site owner; it never sends you anything. Neither is used for newsletters or marketing.

**Removing your account.** You can delete any saved draft on your account page. To delete the account itself, with everything in it, [route from C2, for example: write to [address] from the address you signed up with]. We delete it within [30] days and tell you when it is done.

**Rules for using the site.** What you may and may not do with the content is on the [terms and copyright](/terms/) page.

*Last changed 26 October 2026.*

When Google sign-in ships (GSI-1), that lane adds the spec 6.2 sentence to "Accounts": "We use Google only to confirm who you are; we receive your name, email and profile photo link, and we do not use the photo."

## 5. Must list (files and changes)

| # | File | Change |
|---|---|---|
| C1, C3, C4, I1 to I4, P2 | `web/app/privacy/page.tsx` | Replace the body with the section 4 copy. Render the Google sentence only when `tripPageFamily()` or `placePageFamily()` is `google-js`. |
| C2 | `docs/v2/PLAN.md` (coordinator) | A new owner question: a contact route for removing an account, or sign-in stays off in production until F17's delete ships. Fill the route into "Removing your account". |
| C5 | `web/app/privacy/page.tsx` line 10, `web/tests/shell/privacy-page.test.ts` line 21 | Remove the "owner-approved" claims until the answer is recorded. Pin the new key sentences, including "trip drafts you save", "Removing your account" and the conditional Google sentence (one test with the family on, one with it off). |
| Section 3 | `web/components/shell/SiteFooter.tsx` | "Credits: OpenStreetMap contributors, OpenFreeMap, Mapterhorn and Wikimedia Commons authors." Then recheck S13 in both builds. |
| I5 | verifier | 390 shots as viewport tiles, both themes, every section read. |

After the fixes: a second look by `travel-design-reviewer` (copy only, no new visual surface), then `travel-verifier` (axe on Chromium and WebKit, S13, trip start JS +0 B, shots).
