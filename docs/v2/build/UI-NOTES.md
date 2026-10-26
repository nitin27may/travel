# UI notes: the running list for the end audit

Created 26 Oct 2026 (task AUDIT-MOVE). The UI and UX audit runs once at the end, as release v0.22, just before the v1.0
cutover ([AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md) 2.3 and REC-7). Until then, every UI issue found during the
build goes here so the audit starts from known items.

**Rules.**
- Builders, reviewers and the verifier append one row per issue, in the commit that finds it. Do not fix it here unless it is
  in your task.
- Columns: date (YYYY-MM-DD), release (the release the issue was seen in, for example v0.7), screen (URL or screen name and
  state), note (what is wrong, one or two sentences, with the viewport and theme if it matters), severity (Must, Should or
  Could, by your best guess; UA-T sets the final one).
- Never edit or delete another row. UA-T marks each row confirmed, fixed earlier or dropped in the audit report, not here.
- No screenshots in this file. Name the screen and state; the per-release shots are outside the repository (REC-2).

| Date | Release | Screen | Note | Severity |
|---|---|---|---|---|
| 2026-10-26 | v0.4 | `/trips/dolomites-2027/?view=category`, Logistics, "Tre Cime toll road slot" chip, all widths | The "To book" chip reads "Opens 30 days before Day 3 local": `bookRuleLabel` adds " local" whenever the rule has a zone, even with no time, so "local" qualifies nothing. Say "local" only after a time ("at 08:00 local"); the export reuses the same words (core `bookRuleText`), so change both together and keep their parity test | Could |
| 2026-10-26 | v0.4 | Export menu, "For a spreadsheet (CSV): N stops", both trips | The count is stops only; since TRP-GL-C the file also holds one "booking" row per booking window (Dolomites 3, Rockies 11). The toast says "N stops, M to book ahead"; the menu label could say the same | Could |
| 2026-10-26 | NAV-1 | `/mine/` with copies and favourites kept | The Mine tabs show counts but the panels list kept items as plain links (name and date or kind): the rows, groups and menu are NAV-2 (My trips) and FAV-1 (Favourites). | Should |
| 2026-10-26 | NAV-1 | `/mine/`, device notice | "Got it" snoozes both lists for 30 days, but the copies envelope has no count field, so only 10 more favourites bring the notice back early; 10 more copies do not (contract limit in `copies/1`). | Could |
| 2026-10-26 | NAV-1 | Phone header, signed in, rotating a phone past 640 px | The avatar menu is chosen from the width at the moment the session read returns, then follows the media query; the Account link and the avatar never show together, but a signed-in visitor who rotates sees the Sign in link for the first frame. | Could |
| 2026-10-26 | NAV-1 | Any page, desktop 640 to 899 px | The Mine button mounts after hydration into a reserved slot; with scripts off the slot is empty (Mine is still in the bar on phones, and `/mine/` is linked from nowhere on a script-less desktop). | Could |
| 2026-10-26 | NAV-1 | Dev build, any page | Next's dev indicator badge covers the first bottom-bar item in dev-server screenshots; production builds are clean. | Could |

## NAV-2 (My trips, copy sheet), 26 Oct 2026

- **A trip page fails to load when `window.localStorage` throws on access** (a browser that blocks all site data, e.g. Safari "Block all cookies"): the page shows "This page couldn't load" (a `SecurityError` page error, reproduced with a getter that throws on `/trips/dolomites-2027/` and on `/places/lago-di-braies/`). Some start-chunk code reads `localStorage` outside a try. Mine and the copy sheet go through `probeStorage` and cope; the rest of the site does not. Important for the storage-blocked case (spec 5.4); owner: whoever owns the page's storage reads (find with the throwing-getter script in NAV-2's test notes). The e2e blocks writes under `travel.*` instead.
- Print from the Mine row prints the trip page in a hidden same-origin frame after 1.5 s; the one-shot `travel.mine.print` key of the spec needs a reader on the trip page (TripPrintView or ExportMenu, TRP-GL's files), so it was not built. A print dialog opened from a frame can look different in Safari; check on a phone.
- Row photos show only when a copy carries a same-origin `/img/` path; trip pages hold no `cc`, so a copy's `cc` is null until a catalogue refresh gives it.
- Two-column rows from 1,024 px fill row by row (soonest on the left, next on the right); a visitor reading down one column sees dates jump. Consider `column-fill` by column.
