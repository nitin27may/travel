# S25. Admin: coverage, backlog and research jobs

## Purpose
See what the catalog knows and where it is thin or stale, rank what to research next, start jobs
(for Claude Code, a chat client or later a server agent) and watch their cost and output.

## Entry points
Rail **Admin → Coverage / Backlog / Jobs**; S06 "Request research" (adds to backlog); MCP
`research_brief` and `start_job`.

## Wireframes

Coverage (map + table):

```
┌ Coverage ─────── Kind: [Trails ▾] Freshness: [any ▾] ─────────────────────────────────────┐
│ map: areas shaded thin/usable/good  │ Area            Trails Stays Food Media Fresh Score  │
│  ▓ Banff good                        │ Banff NP          62    18    9    71 %  88 % good   │
│  ▒ Dolomites usable                  │ Val Gardena       24     6    2    40 %  70 % usable │
│  ░ El Chaltén thin                   │ El Chaltén        11     3    0    20 %  95 % thin   │
│                                      │ [Research this area ▸]                              │
└──────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

Backlog:

```
│ Priority │ Gap                                         │ Why                     │ Lane  │
│ 9.6      │ El Chaltén food (0 places)                  │ trip in 133 d uses area │ food  │
│ 8.1      │ Moraine shuttle window stale (read 2025)    │ trip books in Apr       │ fares │
│ 6.0      │ Lake Agnes parking missing                  │ 3 trips use it          │ trails│
│ [Start job with selected ▸]                                                           │
```

Jobs:

```
│ Job                   Runner        Status     Changes  Cost    Started   │
│ Banff trails          Claude Code   submitted  34       —       2 h ago   │
│ Dolomites stays       chat (Claude) running    —        —       10 min    │
│ Commons media Banff   import script done       12       $0      yesterday │
```

Job detail: scope, lanes, the brief given, progress notes, changesets produced, "what was not found"
(gaps reported by the runner), cost.

Phone: three tabs; the map collapses to a list.

## Regions and components
CoverageMap (choropleth by score) · CoverageTable · BacklogTable (priority, reason, lane, select) ·
StartJobSheet (scope, lanes, runner: "copy brief for Claude Code" / "open in chat client" / server
later, budget) · JobRow · JobDetail.

## Primary action
"Research this area" / "Start job with selected".

## States
No jobs: "Start the first job: pick an area." Runner = Claude Code: the sheet shows a one-line command
or prompt to paste ("Use the research skill on job job_01H…") and the MCP connection status.

## Interactions
Select backlog rows → start job; click an area on the map → filter.

## Copy
Scores in words (thin, usable, good) with numbers beside.

## Accessibility
Map has the table as its equivalent.

## Data and operations
`coverage`, `backlog`, `research_job`, `changeset` counts; ops `start_job`, `research_brief`,
`cancel_job`.

## Acceptance criteria
1. Starting a job creates a research_job with a brief retrievable by `research_brief`.
2. Backlog priority = trips using × urgency × severity, visible per row.

## Share
Not shareable outside admins.
