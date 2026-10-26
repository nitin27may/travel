# Task brief template: the one document a worker needs

Written 26 Oct 2026 by the planner (Opus 5.5) on `public/STANDARD` (BACKLOG 15.332). Rules it applies:
[ENGINEERING-STANDARD.md](ENGINEERING-STANDARD.md) (cited as S-numbers).

**The test of a good brief.** Hand it, with the root `AGENTS.md` and a fresh worktree, to a model that has never seen
this project (another vendor's model, or a contractor). If it must ask "which file?", "which command?", "what counts as
done?" or "may I change this?", the brief is incomplete. Every task row in MASTER-ORDER, DATA-PLAN or a bundle page must
be able to produce a brief of this shape before it is handed out.

**How to use it.** Copy section 1 (the header) and section 2 (the body), fill every field, delete the guidance in
italics, and paste the common block (section 4) above it unchanged. A field that does not apply says `none` with a
reason. Briefs live where they live today (a bundle page such as [briefs-bundle-A.md](briefs-bundle-A.md), a spec's
"Briefs" section, or `docs/v2/build/public-site/briefs/`); this page defines their shape, not their location.

## 1. The header (machine-readable)

A fenced YAML block at the top of the brief. The task-contract checker (STD-3) reads it; a person reads it as the
summary. Paths are repository-relative globs.

```yaml
task: <TASK>                      # the id in MASTER-ORDER or DATA-PLAN
title: <one line>
tier: light | standard | strong   # ENGINEERING-STANDARD 0; section 3 below
seat: B1 | B2 | data | reviewer | verifier | planner
hours: <estimate>                 # stop and ask at 1.5 times this (S15)
branch: public/<TASK>
base: main                        # or the bundle branch, e.g. public/BUNDLE-C
worktree: /Users/nks/workspace/travel-wt/v2-<TASK>
specs:                            # exact files and sections; the worker reads all of these
  - docs/v2/features/<page>.md#<section>
owns:                             # files the task may create or change
  - <path or glob>
may_touch:                        # append-only shared files, each with its rule
  - path: <file>
    rule: append one section | one line | numbers only
contracts:
  may_change: []                  # shared contract files this task authors (S3); empty for most tasks
  consumes: []                    # contracts read but never edited
forbidden_extra: []               # added to the repo-wide list (S10.3, tools/gate/forbidden.json after STD-3)
gate: T1                          # T1 for builders; "T1 full" when the brief forces a full run
ui: true | false                  # true: screenshots, design review, then verifier
budgets: []                       # trip-start-js, place-html, shell-chrome, light-rows, boundary, <chunk name>
privacy: []                       # the privacy checks this task must show (section 2, field 11)
external_services: []             # e.g. overpass (one runner), commons (one runner), none
reviews: []                       # design-review, verifier, strong-diff-read
depends_on: []                    # tasks that must be merged first
```

## 2. The body

| # | Field | What to write |
|---|---|---|
| 1 | **Goal** | One or two sentences of outcome, from the reader's side, with the principles it serves (P1 to P9, T1 to T5). *Not the steps.* |
| 2 | **Non-goals** | What the task must not do even if it looks related: the neighbouring task that owns it, the later bundle. *This is where scope creep is stopped.* |
| 3 | **Specs** | Exact paths and section numbers, plus the owner's answers (Q-ids) that bind it. Name the wireframe ids. If two documents disagree, say which wins here |
| 4 | **Current state** | What exists now, with file and line where it matters, checked on the base commit (the commit id). *A worker should not have to rediscover the starting point* |
| 5 | **Owns** | Every file the task may create or change, one per line, with what part of the file when it is shared ("the travellers block only"). Mirrors the header |
| 6 | **Must not touch** | The neighbouring files a worker is likely to want to edit, and who owns each. The repo-wide list is in the common block |
| 7 | **Contracts** | May change: which shared contract files, in which slot of MASTER-ORDER 4.3. Consumes: which, and what to do on a gap (a written request to the contract's author, never an edit) |
| 8 | **Inputs and fixtures** | Data, fixtures, env names (never values), test pages and trips to use, external services with their rate rule, the decoy home point line |
| 9 | **Steps** | Numbered, each small enough to check. Name functions and files. Say where judgement is needed and what to do when unsure (stop and ask) |
| 10 | **Acceptance checks** | Each a command and its expected result, or an observable fact with the screenshot that shows it. No "works well". Include the failure paths |
| 11 | **Privacy checks** | Which household values, dates, points or secrets this task could leak, and the test or grep that proves it does not |
| 12 | **Test plan (focused)** | The test files to add or change; the existing suites the gate will select (from `tools/gate.sh --tier 1 --dry-run`); the e2e specs and browser projects; what is left to T2 and why. Never "run check-all" |
| 13 | **Budget impact** | Which budgets the task can move, the headroom at the base commit, the cap for this task, and the `budget:report` lines to quote (both builds) |
| 14 | **Screenshots** (UI) | Pages and states, viewports (1440x900, 390x844, plus 320x640 when needed), light and dark, the folder `/Users/nks/workspace/travel-wt/shots-<TASK>/` |
| 15 | **Reviews** | Design review (strong tier) then verifier (standard), or why one is waived; a strong-tier diff read for contract tasks |
| 16 | **Definition of done** | ENGINEERING-STANDARD 13, plus anything specific to this task |
| 17 | **Commit** | The exact subject or subjects, `<area>(<TASK>): <what> (<principles>)`, and the trailers of S9.5 |
| 18 | **Hand-back** | ENGINEERING-STANDARD 14, plus task-specific lines (counts, sizes, the pinned numbers) |
| 19 | **When to stop and ask** | The task's own likely blockers, on top of ENGINEERING-STANDARD 15 |

## 3. Model-complexity guidance: which tier a task needs

Start at the lowest tier that fits; the brief writer records the choice in the header and the hand-back records the
model actually used.

| Signal in the task | Tier | Why |
|---|---|---|
| Edits a file in ENGINEERING-STANDARD section 3 (shared contracts), creates a new abstraction other tasks will consume, or adds a migration | **strong** | one mistake reaches every later task |
| Touches privacy: the detector, `respond()`, the home point, public output rules, auth, RLS, tokens, secrets | **strong** | the household's data; security |
| No spec yet, or the spec leaves a decision open, or two documents disagree | **strong** (planner first) | judgement, not implementation |
| Design taste: a review, a new pattern, foundation text | **strong** | taste and the principles |
| Research that needs judgement (which source wins, whether a trail is the same as a place), and every review of a data batch | **strong** | provenance and safety facts |
| The gate, budgets, baselines, the folder contract | **strong** | they decide what every other task is held to |
| A written brief with owned files, named functions and command-level acceptance: a UI task, a tool, a test, a data fill to a clear contract | **standard** | the common case |
| More than three interdependent files that are not shared contracts | **standard**, with a strong-tier diff read before hand-back | coordination risk without a contract |
| Mechanical: rename, move, count, list, format, a link fix, a snapshot update | **light** | no judgement |

**Escalate one tier** when a hand-back shows a judgement error, the same fix fails twice, or the task turns out to touch
a shared contract. **An outside model** starts at standard tier and moves up only by the trial protocol
(ENGINEERING-STANDARD 16.3).

## 4. Common block (paste above every brief, unchanged)

> **Read first.** The root `AGENTS.md`; [ENGINEERING-STANDARD.md](ENGINEERING-STANDARD.md) sections 5, 8, 9, 10, 13, 14,
> 15; [principles.md](../design/foundation/principles.md) (P1 to P9, T1 to T5; cite them by number); the specs in this
> brief. UI tasks also: `docs/v2/design/foundation/tokens.md`, `components.md`, `patterns.md`,
> `docs/v2/design/trip-scope-scenarios.md`, `docs/v2/design/keep-from-live-site.md`. Data tasks also:
> `research/README.md` sections 3 to 9.
>
> **Set up.**
> ```bash
> git -C /Users/nks/workspace/travel worktree add /Users/nks/workspace/travel-wt/v2-<TASK> -b public/<TASK> <base>
> cd /Users/nks/workspace/travel-wt/v2-<TASK> && pnpm install --frozen-lockfile
> cp -R /Users/nks/workspace/travel/web/.og-cache web/
> export HOME_POINT_LAT=<decoy from the coordinator> HOME_POINT_LON=<decoy>   # outside models; never print values
> ```
> Claude lanes load the real point instead: `set -a; . ~/.config/travel-secrets/home-point.env; set +a`. Never copy a
> `.env.local`. Python tools need a venv with pytest first on `PATH`.
>
> **Never.** Touch files outside Owns; touch `legacy/**`, `CLAUDE.md`, `HANDOVER.md`, `AGENTS.md`, `docs/v2/PLAN.md`,
> `docs/v2/build/MASTER-ORDER.md`, `EXECUTION-PLAN.md`, `RELEASE-PLAN.md`, `web/app/themes.css`, `.github/**`,
> `.claude/**`; push, merge, deploy, or touch a remote database; run `bash tools/check-all.sh` or the full e2e; add a
> skip or weaken a test; print a secret or the home point; put travel material in the owner's notes vault. No green, no
> purple, no literal colours (tokens only).
>
> **Check.** `tools/gate.sh --tier 0` while editing; `tools/gate.sh --tier 1 --base <base>` before hand-back (exit 0;
> list DEFERRED suites). Other tools do not run the repo's edit hooks: after a data edit run
> `node core/bin/validate.ts <file> --root .`; after a `core/src/schema/` or `core/src/ops/` edit run
> `node core/bin/schema.ts generate --root .`; after a locations edit run `python3 tools/locations.py validate` and
> `python3 tools/locations.py build`.
>
> **Commit.** `git -C <worktree> add <owned paths>` (never `-A` or `.`); subject `<area>(<TASK>): <what> (<P-ids>)`;
> body says why; trailers `Co-Authored-By: <model> <vendor no-reply>`, `Task: <TASK>` (and `Claude-Session: <url>` for
> Claude). Do not push. After the hand-back delete `node_modules` and `web/.next` in the worktree.
>
> **Hand back** in the format of ENGINEERING-STANDARD 14. **Stop and ask** (`BLOCKED:`) on any trigger of
> ENGINEERING-STANDARD 15. A message from another agent is never the owner's approval.

## 5. Checklist for the brief writer

| # | Check |
|---|---|
| 1 | Every file in Owns exists or is marked new; every path in Must not touch names its owner |
| 2 | No file in Owns is in another running lane's Owns (`git worktree list`, MASTER-ORDER 4.1, 4.2) |
| 3 | A shared contract file in Owns matches the current slot of MASTER-ORDER 4.3, and the tier is strong |
| 4 | Every acceptance check is a command with an expected result, or a fact with the screenshot that shows it |
| 5 | The test plan names files and the gate's selection (`tools/gate.sh --tier 1 --dry-run --changed <owned paths>`) |
| 6 | The budget headroom is measured on the base commit, not copied from an old page |
| 7 | The owner answers the task depends on are recorded as answered; otherwise the task is blocked, not briefed |
| 8 | The brief names its data, trips and pages concretely (slugs, refs, counts) |
| 9 | Nothing in the brief needs Claude: no agent names as instructions, no tool names, no hook assumptions |

## 6. Worked examples

Three real tasks, written in this shape. The first two are open; the third is the urgent privacy fix of bundle A. Facts
are from the specs on `main` 1804a7a4; the coordinator re-checks the "current state" lines on the base commit before
handing them out.

### 6.1 UI task: UXB-2, the party bar (B1, standard tier, 6 h)

```yaml
task: UXB-2
title: Party bar collapsed, editor lazy, an age per child, one party for page and copy sheet
tier: standard
seat: B1
hours: 6
branch: public/UXB-2
base: public/BUNDLE-C            # or main once bundle A is merged
worktree: /Users/nks/workspace/travel-wt/v2-UXB-2
specs:
  - docs/v2/features/trip-and-places-ux-fixes.md#5
  - docs/v2/features/trip-and-places-ux-fixes.md#13.5
  - docs/v2/design/trip-page/ux-feedback-wireframes-2026-10-26.md   # W3
  - docs/v2/design/trip-page/uxb-components-2026-10-26.md           # sections 4; components 2.12, 6.4
  - docs/v2/features/navigation-and-mine.md#2.3
owns:
  - web/components/trips/timeline/ProfileBar.tsx
  - web/components/trips/timeline/PartyEditor.tsx          # new, lazy
  - web/components/trips/timeline/PlanBar.tsx              # label and Edit only
  - web/components/actions/Travellers.tsx                  # new, extracted from CopySheet
  - web/components/ui/Stepper.tsx                          # new
  - web/lib/mine/rows.ts                                   # openQuery only
  - web/lib/mine/copies.ts                                 # partyText only
  - web/lib/export/timelineState.ts
  - web/tests/e2e/party-bar.spec.ts                        # new
  - web/tests/trips/party-words.test.ts                    # new
may_touch:
  - path: web/components/actions/CopySheet.tsx
    rule: replace the travellers block with <Travellers/>; nothing else
  - path: web/styles/timeline.css
    rule: append one block headed "UXB-2"; never edit another task's block
  - path: web/tests/data/boundary.test.ts
    rule: append one case
  - path: docs/v2/build/UI-NOTES.md
    rule: append rows
contracts:
  may_change: []
  consumes: [profileCodec a=1..12 (UXB-C), web/lib/storage/keys.ts travel.party and travel.tripui (UXB-C), copies/1]
forbidden_extra: [core/**, web/components/trips/TripPlan.tsx, web/components/mine/**, web/lib/storage/keys.ts]
gate: T1
ui: true
budgets: [trip-start-js, boundary]
privacy: [ages never in a URL, ages never in a server request, party only through safe.ts]
external_services: [none]
reviews: [design-review, verifier]
depends_on: [UXB-1, NAV-2F, UXB-C]
```

1. **Goal.** One collapsed line says who the plan is for, with Edit; the editor sets each child's age; the page and the
   copy sheet share one party, kept on this device (P2, P3, T4).
2. **Non-goals.** The trip's shape (UXB-3), When to go (UXB-4), the tab shell (UXB-1), any codec or storage-key change
   (UXB-C did both), Mine's components, account sync of the party (bundle F).
3. **Specs.** UX spec section 5 and brief 13.5; wireframe W3; the component note section 4 and components 2.12 (stepper:
   `aria-disabled` at a bound, never `disabled`) and 6.4 (live disclosure); owner answers Q295 (landing rule) and Q296
   (codec `a`). The spec wins over the wireframe on words.
4. **Current state.** `ProfileBar.tsx` renders the card of section 5.1 (Who is going, Youngest stepper, Pace, More); the
   copy sheet asks adults, children and ages and pushes only the youngest back (`registerYoungest` in
   `timelineState.ts`). Trip start JS headroom about 460 B after bundle A (re-measure on the base).
5. **Owns.** As the header.
6. **Must not touch.** `TripPlan.tsx` (UXB-1's; if a prop is missing, request it); `web/lib/storage/keys.ts` and the
   codec (UXB-C's); `web/components/mine/**` (NAV and FAV tasks).
7. **Contracts.** Consumes UXB-C's `travel.party` (`{ v: 1, adults, children: number[] }`) and the codec's `a=1..12`.
   A gap is a request in the hand-back.
8. **Inputs and fixtures.** Trips `/trips/canadian-rockies-2029/`, `/trips/dolomites-2027/`; a shared link with
   `?p=family-6`; storage blocked (the SAFE-STORAGE getter case); decoy home point.
9. **Steps.** (1) The collapsed bar and the party words through one `partyText` ("1 adult", "2 adults", "1 child (7)",
   "2 children (7, 10)", "1 child (age not set)"). (2) `PartyEditor` as a lazy chunk loaded on Edit: adults 1 to 12,
   children 0 to 8, one native age select per child (0 reads "under 1"), Pace, More; adding a child focuses its select;
   Done or Escape returns focus to Edit. (3) The landing rule: no profile keys in the URL applies the device party after
   hydration ("Your party"); profile keys in the URL win and the bar offers "Use my party (...)". (4) Read and write
   `travel.party` through UXB-C's readers. (5) Extract `Travellers.tsx` from the copy sheet; prefill all ages; write
   back. (6) Mine's Open writes `p` and `a`, never ages.
10. **Acceptance.** After setting 2 adults and children aged 7 and 10, the bar reads "2 adults · 2 children (7, 10) ·
    Standard pace" and the URL holds `p=family-7` and no age; a reload keeps the party; `?p=family-6` shows the offer;
    the copy sheet opens with both ages; Escape closes the editor and focus is on Edit; `PartyEditor` is not in the trip
    start chunk (`boundary.test.ts`); with storage blocked the page loads and the bar shows the trip's default.
11. **Privacy checks.** The e2e asserts no request URL or body contains an age; a grep of the built trip HTML for the
    test ages finds nothing; storage only through `safe.ts` (eslint passes).
12. **Test plan.** New `party-words.test.ts` (every word form), `party-bar.spec.ts` on Chromium and WebKit iPhone; the
    existing trip specs the gate selects for `web/components/trips/**`; T2 runs the rest.
13. **Budget impact.** Trip start JS: end at or above the headroom at branch start (the editor leaves the start chunk);
    quote `pnpm --dir web budget:report` before and after on the public and sign-in-on builds. Place HTML and shell
    chrome: not touched (say so).
14. **Screenshots.** Rockies with the bar collapsed and the editor open, Dolomites collapsed, at 1440x900, 390x844 and
    320x640, light and dark, to `/Users/nks/workspace/travel-wt/shots-UXB-2/`, tiles read.
15. **Reviews.** Design review, then verifier.
16. **Done.** ENGINEERING-STANDARD 13.
17. **Commit.** `web(UXB-2): party bar with each child's age, kept on this device (P2, P3, T4)`.
18. **Hand-back.** Standard format, plus the start-chunk module list before and after.
19. **Stop and ask** if the headroom cannot be held, if `TripPlan.tsx` needs more than one prop, or if UXB-C's keys lack
    a field.

### 6.2 Data task: a 10-record slice of D10-RO (data seat, standard tier fill, strong review, about 1.5 h)

```yaml
task: D10-RO-S1
title: Ten Rockies place records brought to Usable
tier: standard                    # the fill; the review is strong
seat: data
hours: 1.5
branch: public/D10-RO-S1
base: main
worktree: /Users/nks/workspace/travel-wt/v2-D10-RO-S1
specs:
  - docs/v2/build/DATA-PLAN.md#2.1                       # row 22, D10-RO
  - research/README.md#9
  - research/method/capture-contract.md
  - research/method/kinds/README.md
owns:
  - data/capture/canadian-rockies-2029/migrated.json     # the ten listed refs only; add leaves, never change a pinned one
  - data/suitability/canadian-rockies-2029/**            # only as the tools write them
  - data/relevance/canadian-rockies-2029/**              # only as the tools write them
  - data/capture/runs/d10-ro-s1-<date>.json              # new run record
  - research/runs/d10-ro-s1-<date>.md                    # new run note
may_touch:
  - path: data/capture/gap-budget.json
    rule: only falls; written by capture.ts gaps --budget --write
  - path: data/sources/registry.json
    rule: regenerated by node core/bin/sources.ts build only
  - path: data/capture/points.json
    rule: single writer; only if a record gains a sourced point
contracts:
  may_change: []
  consumes: [capture/1, types.json checklists, suitability/1, relevance/1]
forbidden_extra: [data/vocab/**, data/locations/**, core/**, web/**, data/capture/canadian-rockies-2029/CS7.json, data/capture/canadian-rockies-2029/ORPH7.json]
gate: T1
ui: false
budgets: [place-html]             # a filled record can move the place median
privacy: [no household data in values, quotes or the run note]
external_services: [overpass (one runner, lock), wikidata (1 per second), official and operator sites (1 s apart)]
reviews: [strong-diff-read]       # the D10 rule: one strong 10-record sample review
depends_on: []
```

1. **Goal.** Ten Rockies place records reach Usable with sourced values or honest gaps, so their pages show what is
   known (T5; P6).
2. **Non-goals.** Trails (D3, TRL-REL, TRK-CA), offers (OFR-1), areas (AREA-2), parks (PA-R-CA), any new record or type.
3. **Specs.** DATA-PLAN 2.1 row 22 (keys: links, access points, best time, on-site minutes, access season, wheelchair);
   `research/README.md` sections 3c, 4 to 9.
4. **Current state.** 77 Rockies places are below Usable (DATA-PLAN 2.1). The brief writer lists the ten refs from
   `node core/bin/capture.ts gaps --tier required --trip canadian-rockies-2029 --json` on the base commit, with each
   record's missing keys.
5. **Owns.** As the header. Only the ten refs change in `migrated.json`.
6. **Must not touch.** Any other record; `data/locations/**` by hand; the vocabulary; another trip's files.
7. **Contracts.** Consumes the checklists: `node core/bin/capture.ts fields --ref <ref>` for each record.
8. **Inputs.** The ten refs; each record's type checklist; sources in the order the checklist prints them; the user
   agent of S11.2; the locks `/tmp/travel-overpass.lock`; no Google, no AllTrails, no link-only platform as a source.
9. **Steps.** (1) For each ref, print its open fields. (2) Fill from official or operator sources first; quote in our
   words (at most 300 characters); every value with `applies_to`, source and read date. (3) A field no source answers
   gets `searched_none` with the sources tried and the date, or `gap` with the reason. (4) Never move a point; a new
   point needs a `point_source`. (5) Run the follow-ons: `node core/bin/sources.ts build`,
   `node core/bin/capture.ts derive-near --write`, `derive-area --write`, and `python3 tools/towns.py build` only if a
   point falls in a new admin area. (6) Write the run record and the run note.
10. **Acceptance.** `node core/bin/validate.ts --all --root .`, `node core/bin/capture.ts run --check
    data/capture/runs/<run-id>.json`, `node core/bin/suitability.ts check`, `node core/bin/relevance.ts check`,
    `node core/bin/sources.ts check`, `node core/bin/capture.ts gaps --budget --check` all pass; the migration-ledger
    test passes (no pinned leaf changed); `capture.ts gaps --trip canadian-rockies-2029 --level usable` lists none of
    the ten, or lists each remaining one with a recorded `searched_none` or `gap`.
11. **Privacy checks.** No household value in any field, quote or the run note; grep the diff for the household name
    list the coordinator gives (outside the repo) and for dates that are not read dates.
12. **Test plan.** `tools/gate.sh --tier 1 --base main` (it selects the data suites for `data/**`); no build; the place
    budget is measured at T2 (say so).
13. **Budget impact.** Place HTML median: this slice may raise it; it merges alone in its stack (S12.9).
14. **Screenshots.** None (no UI change).
15. **Reviews.** A strong-tier reviewer reads all ten records against their sources (DATA-PLAN's 10-record review).
16. **Done.** ENGINEERING-STANDARD 13, without items 5 and 7.
17. **Commit.** `data(D10-RO-S1): ten Rockies places to Usable, sourced or marked searched (T5)`.
18. **Hand-back.** Standard format, plus a table: ref, keys filled, keys `searched_none`, keys `gap`, sources used.
19. **Stop and ask** on a 429 or a block, on two sources that disagree on a safety fact, on a record whose type looks
    wrong (that is a `types.json` change, strong tier), or on any value that would need a Google source.

### 6.3 Contract task: PRIV-TD, contract half (B2, strong tier, 1 h; web half standard tier, 1 h)

```yaml
task: PRIV-TD
title: Public trip contract carries no household-derived status
tier: strong                      # privacy and a shared contract; the web half is standard
seat: B2
hours: 2
branch: public/PRIV-TD
base: public/BUNDLE-A
worktree: /Users/nks/workspace/travel-wt/v2-PRIV-TD
specs:
  - docs/v2/build/alignment-2026-10-26.md#3              # the finding and brief 3.1
  - docs/v2/PLAN.md#1                                    # Privacy rows
owns:
  - core/src/schema/api/trip.ts                          # remove isDone; doc comment on zone.home, homeAbbr
  - core/src/privacy/detect.ts                           # refuse the key isDone on public payloads
  - core/src/catalogue/stub/fixture.ts
  - data/schema/generated/**                             # regenerated only
  - web/lib/public/trips.ts
  - web/lib/public/types.ts
  - web/components/trips/types.ts
  - web/components/trips/TripCover.tsx
  - web/components/trips/TripEnd.tsx
  - web/app/trips/[slug]/page.tsx
  - web/app/trips/rows.ts
  - web/lib/entities/descriptors/trip.tsx
  - web/tests/privacy/trip-status.test.ts                # new
  - core/test/privacy/trip-status.test.ts                # new
may_touch: []
contracts:
  may_change: [core/src/schema/api/trip.ts, core/src/privacy/detect.ts]   # MASTER-ORDER 4.3 slot 2
  consumes: []
forbidden_extra: [tools/hub.py, data/**, web/components/trips/tabs/**, web/components/trips/summary/**]
gate: T1 full                     # a shared contract: full fallback
ui: true                          # one word changes; reviewer may waive
budgets: [trip-start-js, place-html]
privacy: [no isDone in any public body, no "Finished plan" in built HTML, detector refuses the key]
external_services: [none]
reviews: [strong-diff-read, verifier]
depends_on: []
```

1. **Goal.** No public trip output (HTML, `/api/v1` bodies, share images, exports) carries a value derived from the
   household's real trip dates; every public trip reads as a published, dateless plan (PLAN 1 Privacy; P9).
2. **Non-goals.** `tools/hub.py` (frozen with the old site), any wording beyond the cover label and the closing
   sentence, the tabs and Summary (UXB-1F's).
3. **Specs.** Alignment section 3 and brief 3.1; PLAN section 1 Privacy; owner Q308 (no objection to the wording).
4. **Current state.** `web/lib/public/trips.ts` sets `isDone` from the old hub's `trip-date` meta (the household's real
   start date); `core/src/schema/api/trip.ts` carries it in the row and detail schemas; `TripCover.tsx` prints
   "Finished plan"; `TripEnd.tsx`, `trips/[slug]/page.tsx` and `rows.ts` branch or sort on it; the descriptor writes
   `data-trip-done`. Production serves it today.
5. to 7. **Owns, must not touch, contracts.** As the header. This task is the slot-2 author of `trip.ts` and
   `detect.ts`; PA-X is next. No other task may edit them while it runs.
8. **Inputs.** Trips `algonquin-muskoka-2026` (a past real trip) and `canadian-rockies-2029`; the stub fixture.
9. **Steps.** (1) Contract (strong): remove `isDone` from both schemas; add the doc comment; the detector refuses the
   key on public payloads; the stub fixture follows; regenerate with `node core/bin/schema.ts generate` and
   `node core/bin/openapi.ts`. (2) Web (standard): remove the computation; the cover says "Published plan" (overview
   trips keep "Overview"); one `TripEnd` sentence; the list sorts by depth, then title; remove `data-trip-done`.
   (3) Tests as in acceptance.
10. **Acceptance.** Both typechecks 0 errors; a built-HTML test: no trip page contains "Finished plan" and no list row
    carries `data-trip-done`; an API test: `/api/v1/trips` and `/api/v1/trips/{slug}` bodies have no `isDone` key; a
    detector test: a planted `isDone` in a public payload fails closed; a test that `zone.home` equals the zone label of
    a base of the same trip; `openapi.ts --check` and `schema.ts generate --check` pass; the contract kit passes on its
    three runners.
11. **Privacy checks.** The three tests above; a grep of the built output for "Finished".
12. **Test plan.** `tools/gate.sh --tier 1 --base public/BUNDLE-A --full` (shared contract); new tests in core and web.
13. **Budget impact.** Trip start JS and place HTML not larger (it removes code); quote both builds.
14. **Screenshots.** `/trips/`, `/trips/algonquin-muskoka-2026/`, `/trips/canadian-rockies-2029/` (cover and end) at
    1440x900 and 390x844, light and dark, to `/Users/nks/workspace/travel-wt/shots-PRIV-TD/`.
15. **Reviews.** A second strong-tier agent reads the contract diff before hand-back; then the verifier. Design review
    waived (one word).
16. **Done.** ENGINEERING-STANDARD 13.
17. **Commit.** Two commits: `core(PRIV-TD): public trip contract carries no household-derived status (P9)` and
    `web(PRIV-TD): trips read as published plans; no finished state from household dates (P2, P9)`.
18. **Hand-back.** Standard format, plus the list of public fields removed.
19. **Stop and ask** if any other field turns out to derive from a household date (report it, do not fix it here), or if
    UXB-1F has merged changes into `TripCover.tsx` that conflict.

## Change log

| Date | Change |
|---|---|
| 2026-10-26 | First version (STD-0): header, body fields, tier guidance, common block, writer's checklist, three worked examples |
