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
