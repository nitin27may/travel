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
| 2026-10-26 | NAV-2 | Any page, a browser that blocks site data | A page failed to load when `window.localStorage` threw on access ("This page couldn't load"). Fixed by SAFE-STORAGE (`lib/storage/safe.ts`, lint rule, `storage-blocked` e2e); kept here as the Must it was. | Must |
| 2026-10-26 | NAV-2 | `/mine/`, row menu > Print | Print opened the trip in a hidden frame after 1.5 s and printed the wrong page. Fixed in NAV-2F: the one-shot `travel.mine.print` key read by `ExportMenu`; check on a real iPhone that the dialog opens after the navigation (the "Ready to print" notice is the fallback). | Should |
| 2026-10-26 | NAV-2 | `/mine/` rows with a photo | Row photos show only when a copy carries a same-origin `/img/` path; trip pages hold no `cc`, so a copy's `cc` is null until a catalogue refresh gives it. | Could |
| 2026-10-26 | NAV-2 | `/mine/` at 1,024 px and wider | Two-column rows filled row by row, so dates jumped when reading down a column. Fixed in NAV-2F with CSS columns; a short second column ends above the first (the list's bottom line spans both). | Could |
| 2026-10-26 | TRP-GL | Trip page, Dolomites (Italy) distances | Drive distances read in miles (169.5 mi) because the unit default is not per country; N3 only stops the doubling. Owner question: should an Italy trip default to km? | Should |
| 2026-10-26 | TRP-GL | Phone map key panel | The panel opens at half the map; the first entry's label "Stop, numbered in the day's order" wraps to four lines in a two-column grid. A shorter label in `routeSpec.ts` would save a row. The keyboard Tab order leaves the toggle for the map controls first, because the panel sits inside the map box. | Could |
| 2026-10-26 | TRP-GL | Trip print, Rockies Book ahead | Rockies booking notes still carry stale facts ("closed for 2026", "not known yet") until BACKLOG 15.223b rewrites the data; no rule prints because every Rockies `bookRule` is null. | Should |
| 2026-10-26 | TRP-GL | `trip-polish.spec.ts` Patagonia Day 2 | The e2e expects "no stop has a map position yet · showing the whole trip" but the page now says "Day 2 · Ushuaia · no stop has a map position · showing the base"; fails on main as well (the copy changed, the spec did not). | Should |
