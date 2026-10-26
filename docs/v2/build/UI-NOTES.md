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
| 2026-10-26 | NAV-1 | `/mine/` with copies and favourites kept | The Mine tabs show counts but the panels list kept items as plain links (name and date or kind): the rows, groups and menu are NAV-2 (My trips) and FAV-1 (Favourites). | Should |
| 2026-10-26 | NAV-1 | `/mine/`, device notice | "Got it" snoozes both lists for 30 days, but the copies envelope has no count field, so only 10 more favourites bring the notice back early; 10 more copies do not (contract limit in `copies/1`). | Could |
| 2026-10-26 | NAV-1 | Phone header, signed in, rotating a phone past 640 px | The avatar menu is chosen from the width at the moment the session read returns, then follows the media query; the Account link and the avatar never show together, but a signed-in visitor who rotates sees the Sign in link for the first frame. | Could |
| 2026-10-26 | NAV-1 | Any page, desktop 640 to 899 px | The Mine button mounts after hydration into a reserved slot; with scripts off the slot is empty (Mine is still in the bar on phones, and `/mine/` is linked from nowhere on a script-less desktop). | Could |
| 2026-10-26 | NAV-1 | Dev build, any page | Next's dev indicator badge covers the first bottom-bar item in dev-server screenshots; production builds are clean. | Could |
