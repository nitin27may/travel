# V02-VERIFY: v0.2 verification (main 9b556fbd)

Verifier: Claude Sonnet 5.5. Nothing fixed. Shots and raw data: `/private/tmp/claude-501/-Users-nks-workspace-travel/7c94cc19-af86-4a44-b307-85be51e879c1/scratchpad/v02verify/` (light shots, dark shots, `report.json`, `report-dark.json`). Dark shots set `travel:v1:theme=dark` (emulated colorScheme does not switch this app; the first dark set was discarded and redone).

## Summary
Gates pass. Four findings, one of them a must-fix: horizontal overflow on place pages at phone widths (66 of 358 place pages at 320, 13 at 390).

| Item | Result | Evidence |
|---|---|---|
| Budget tests (budget, place-size, shell-size), public build | pass | 3 files, 23 tests passed |
| budget:report, public | pass | S13 median 1.2485 of 1.25 (cinque-torri 93783 B vs 75117 B), headroom 113 B; largest 1.2329, headroom 2297 B; chrome largest 4381 of 5028 B (headroom 647 B; header 1036, footer 754, bar 1380); start JS 199.4 KB of 200 (trips/algonquin-muskoka-2026), headroom 655 B |
| budget:report, NEXT_PUBLIC_SIGN_IN=1 build (.fixture-auth) | pass | S13 median 1.2487, headroom 100 B; largest 1.2330, headroom 2284 B; chrome 6046 of 6693 B (headroom 647 B; header 1103, footer 754, bar 2015); start JS 199.3 KB, headroom 691 B |
| Playwright chromium + webkit-iphone: privacy, trip-timeline, trip-polish, places, cross-browser | pass | 104 passed |
| Also auth-email, a11y, home.phone, shell-report on chromium, webkit-iphone, webkit-desktop; cross-browser on all | pass | 145 passed, 14 skipped (code-option-off block needs another build; shell-report shots are opt-in) |
| Privacy page: footer link, sitemap entry, mailto, text vs PrivacyBody.tsx | pass | footer `/privacy/` link present; sitemap has `/privacy/`; `mailto:nitin27may@gmail.com`; all 38 body sentences match, bar the Google paragraph, which shows only in a Google map family (not in this build). The lede is hidden below 640 px by `.page-head .lede` (app.css:115), by design |
| Bottom bar fits 5 items at 320 (sign-in on) | pass | Trips 4-66 ... Sign in 254-316 on pages with no overflow; public build shows 4 items |
| Sign in item current on /sign-in/ | pass | aria-current on "Sign in" at 320 and 390 |
| Sign in item current on /sign-up/ | fail | no item carries aria-current on /sign-up/ at 320 or 390 |
| Home search overflow at 320 | fail (known) | scrollWidth 338 vs 320, 18 px; `button.home-search` right edge 338 (left 31) |
| No horizontal overflow, key pages | fail | home 320 (above). Place pages: see F2 |
| axe (wcag2a, 2aa, 21a, 21aa): /privacy/, /sign-in/ | pass | 0 violations at 390 light and 1440 dark, both pages |
| Visual sweep 320/390/1440, light and dark, 2x | pass with F1-F3 | 3 sizes x 2 themes x 8 pages (sign-in build); home and privacy also in the public build |

## Findings
- F1 (known, should-fix): home search overflows at 320 by 18 px; the field runs past the card (dark shot `auth-home-320-dark.png`).
- F2 (must-fix): place pages scroll sideways on phones. A full scan at 320 and 390 (domcontentloaded plus 150 ms, rechecked with 3 s on four) found 66 pages at 320 and 13 at 390. Examples at 390: athabasca-falls +274 px, dettifoss +524, dead-horse-point +426, bryce-amphitheatre-rim +12, sapa +12. At 320 cinque-torri +15, bald-hills +10. Culprits: the "Who it suits" chip list (`ul.chs`, `li.ch`, long text such as "Exposure: level Some, fenced...") on the suitability header, the "How to get there" source row (`.srs`/`.sv`), and the elevation profile (`figure.pl-profile`). The e2e smoke passes because it tests other slugs. Not checked against a pre-D2b build, so whether the 74 new places or older pages cause it is open; the list includes old pages (athabasca-falls). The bottom bar is also drawn wider than the screen on these pages (Sign in at 319-398 on a 390 viewport). Full list is in the scan output; rerun with the script in the scratchpad (`scan.mjs`).
- F3 (minor): Sign in not current on /sign-up/.
- F4 (watch): S13 median headroom is 113 B public, 100 B sign-in on; start JS headroom 655 B. The next place or script change will break the gate.
