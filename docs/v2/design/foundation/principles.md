# UX principles (owner, 18 Oct 2026)

These come before any pattern, component or token. Every design, every build brief and every review is
checked against them. Reviewers cite them by number.

## P1. Design for scale

The test of the UI is how easily a visitor finds the one thing they want when there are 10,000 places and
trips, not 100. Lists, search, filters and the globe are judged at that size:
- result counts
- grouping
- clustering
- empty states
- performance

## P2. Show everything, progressively

Nothing important is hidden for good, and nothing is shown all at once. Each screen has a first view that
answers the visitor's main question. Detail opens step by step, on demand.
- The trip page leads with the shape of the trip: the timeline at a glance, then the days.
- A visitor deep-diving one day can then answer, one click at a time:
  - should we go there?
  - how long will it take?
  - how steep is the trail?
  - is there a booking we are missing?

## P3. A glance, then a few clicks

The first view must be readable at a glance. Any deeper fact is a few clicks away ("tick, tick, click,
click"), never a hunt.
- Each level of detail is one tap or click from the level above.
- The way back is always visible.

## P4. No manual needed

Search and filters must be understood on first use, without help text or documentation:
- plain labels
- visible current state (chips, counts)
- one obvious way to clear
- results that update as you choose

If a control needs explaining, the control is wrong.

## P5. Every open and close is smooth and linked

Components that open, close, expand or move between views do so with short, consistent motion:
- the map follows the timeline
- the card grows from the pin
- the day expands in place

Context is kept: no jump to the top, no lost scroll, no lost selection. Reduced motion jumps but keeps the
same links.

## P6. The right metadata at the right moment

Each fact has a place where it matters and is shown there first:
- Effort and age on the day row.
- The trail's steepness when the trail is opened.
- Booking windows where the booking is due.

Metadata is shown as chips and short values, never as paragraphs. Provenance stays one step away.

## P7. Know the primary goal

About 90% of visitors come to search, read a trip or a place, and copy it with their own dates. About 10%
plan. The public pages are designed for the 90% first, and every screen names its primary action.

## How the principles are used

- **Fable design reviews** score each screen against P1-P7 and list each breach with a fix.
- **Build briefs** state which principles a lane must satisfy and how its acceptance checks measure them,
  for example "every day row answers effort, time and bookings at rest" (P2, P6).
- **The verifier sweep** includes a first-use walk with no prior knowledge (P4) and a large-data check (P1).

## Applied to travel: decisions (coordinator, 18 Oct 2026, cross-checked against what is built)

The owner asked that each principle be checked against the travel domain and the built site before it is locked.
The decisions below are binding. Where a principle is adapted, the adaptation wins over the general wording above.

| Principle | Decision for travel | Built today (checked) | Gap, and where it is fixed |
|---|---|---|---|
| P1 scale | **Adapt.** Design the structure for 10,000 places: counts, grouping, clustering, virtualised long lists, search that stays fast. Do not build a server search yet: year one has under 100 users and about 120 entities, and two years of capture is about 1-2k. Test the UI with 10,000 synthetic places, but keep budgets for the real size. | Lists group and paginate. The globe clusters. `search-index.json` is 37 KB for about 120 entities, which would be about 3 MB at 10,000. | Split the search index by kind and country, and load each part when it is needed (backlog 2.20). The 10,000-place synthetic check is part of the stage 5 sweep (5.1). |
| P2 progressive | **Adopt, with a safety exception.** Detail opens step by step. But anything that can stop a visit or hurt someone stays visible at rest, never behind a click: hard age, height or weight limits, closures, permits and timed slots that must be booked, and the main hazards (bear spray, exposure, tides, river crossings). In travel, a hidden constraint is a failed trip. | The trip page has no timeline yet (L3c). Place pages render every section even when it is empty: Lake Louise shows 12 "No ... recorded yet" phrases. | Empty place sections stay visible as markers of missing data (owner, 18 Oct), and are filled by enrichment (backlog L8), not hidden. L3c and L2b briefs must keep the safety items visible at rest (3.1, 3.3). |
| P3 glance | **Adopt.** A trip card or day row answers at a glance: how long, how hard, for whom, when to go, and what must be booked. | Trip cards show length and season. Day rows show the drive. Effort and age come with suitability S1. | S1 suitability chips on day rows and cards (3a.5). Booking-due markers on days come with L3c (3.1). |
| P4 no manual | **Adopt, with one exception.** Filters and search must be obvious on first use. Show four primary filters (Places: Country, Kind, Season, Kids; Trips: Where, When, Length, Kids) and put the rest under "More filters". **Six pills when a Kind is chosen (owner, Q27):** narrowing Kind to a domain or category promotes up to two of that scope's facets into the bar beside the four, and no bar ever holds more than six; clearing Kind returns it to four. Show the result count as you choose, offer one "Clear all", and an empty result suggests the nearest match. The exception: honesty markers ("Estimate", "Sources disagree") keep a short tooltip, because trust needs the reason. | Places shows 8 filters at once. Trips shows 4. Counts and chips exist. There is no "More filters" and no nearest-match empty state. | Filter hierarchy and empty states for Places (2.22) and Trips (inside L3b, 3.2). |
| P5 smooth | **Adopt, within a budget.** Transitions are short and keep context, and reduced motion jumps. Smoothness never costs first paint on phones in the field, where the signal is weak. | Globe at 60 fps on the GPU. One 267 ms hitch on fly-in (L2 verifier measuring). The map does not yet follow the timeline. | Globe long tasks (L2b M12, 3.3). The map following the scroll (L3c, 3.1). |
| P6 metadata | **Adopt.** Each fact appears where the decision is made: suitability on the day row, steepness when the trail opens, the booking window on the day it falls due, the season on the card. Chips, not paragraphs, with provenance one step away. | Research markers leak into prose (INFERENCE, CALC). Units are mixed in notes. | L3c markers to chips and units (3.1). Suitability chips (3a.5). |
| P7 the 90% | **Adopt.** The primary action on a public trip is "Copy with my dates" (or "Add to calendar" for a short trip). On a place, it is "Directions" or "Save to a trip". | "Save to a trip" and "Copy to my trips" exist, with no defined behaviour before sign-in. | Make each action real or plainly labelled (2.13). |

### Travel needs the general principles do not cover (added)

| ID | Principle | Why it matters in travel |
|---|---|---|
| T1 | **When is part of every answer.** Season windows, booking windows and opening hours are first-class, shown on cards, days and places, never only in prose. | A place that is right in July is wrong in October, and a booking missed by a week can cancel a day. |
| T2 | **Works in the field.** Phone first, one hand, poor signal. Trip and place pages print and export cleanly (PDF, GPX, KML), and nothing essential needs a live map load. | Trailheads and car parks have little or no signal. |
| T3 | **Trust shows its age.** Every fact that changes (prices, hours, closures, lift seasons) shows when it was read, and "2026 data used as a pattern" stays visible on future trips. | Stale travel data costs real money and time. |
| T4 | **Families first, everyone included.** Suitability (age, stroller, effort) drives filters and the trip profile. Accessibility is shown honestly as chips, even before it is a full profile control (Q12). | The household and its audience travel with children. |
| T5 | **Honest maps.** We draw only points and lines we hold, with their source. Approximate pins say so, and directions start from our coordinates. | A wrong pin sends a car to the wrong car park. |

### Not adopted, and why

- **A server search, personalisation and recommendations now.** These are not worth the cost at under 100 users. Revisit at about 1,000 users.
- **Infinite scroll on lists.** It breaks URL state and the back button, which P4 and P5 depend on. Keep pagination with the page number in the URL.
- **Hiding the honesty markers to look cleaner.** Trust (T3) beats tidiness. Markers stay, styled quietly.

## P8. Protect the catalogue (core principle, owner, 18 Oct 2026)

Our researched content is the product: the trips, the place facts, suitability, times, links and checklists.
At go-live the UI must not hand it over in bulk. A visitor can read, copy one trip into their account and
export what they need for one trip. Nobody can pull the whole catalogue in a few requests.

What this means in practice (decided):
- **No bulk files.** No public file holds the whole catalogue: `/data/places.json` and `/data/trips.json` go. The
  per-slug export files at predictable URLs (`/export-data/<type>s/<slug>/data.json`) go too.
- **Light list data.** List and search pages ship only the fields that cards and filters need: name, kind, area,
  season, the kids and effort chips, and the slug. Never facts, links, suitability values, times or notes. The search index
  carries names and areas only.
- **Decided list-row allowlist (18 Oct, after the INT-B verification).** A list row carries only what a card, a table column or a filter shows: name, kind, area, season, the kids and effort chips, the completeness level label (not its check counts), honesty chip labels (not their reasons), public trip names for the "In a public trip" facet, and three numeric glance facts. The numeric facts are km, gain and elevation, under a recorded waiver because P3 needs them on the table and they are widely published. A test pins the exact keys.
- **Honest about the limit.** Item pages stay one request each, and the sitemap lists them, so P8 raises the cost of bulk copying; it does not stop it. The edge protections at go-live (rate limit, bot block) and a server for detail data later are what close the gap.
- **Exports are per item, for personal use.** "Copy to my trips", ICS, PDF and print stay per trip. The table's
  CSV of a whole list is removed from the public site. At go-live, CSV, GPX and KML require sign-in and are
  limited to one trip or place at a time. Every export says where it came from.
- **Edge protection.** Turn on Cloudflare's free bot protection, its AI-crawler block and one rate-limit rule.
  Search engines stay allowed, because the public site depends on being found.
- **Terms.** A short terms and copyright page states that the content may not be reused in bulk.
- **Honest limits.** Anything a page shows can be copied by a determined person, one page at a time. The goal is
  to stop bulk extraction, not to stop reading. We never use hostile tricks: no disabled right-click, no blocked
  text selection, no obfuscated text. They break accessibility and P4, and they stop nobody.
- **What we cannot restrict.** OpenStreetMap-derived points and lines are ODbL, so they need credit and share-alike.
  Wikimedia Commons photos carry their own licences. Only our own words and research are ours to protect.

## P9. Server-ready by default (owner, 18 Oct 2026)

The site starts static and moves to a server gradually: search, filters, details and exports, one at a time.
Nothing built now may make that move hard:
- **One data boundary.** All data goes through the adapter functions (`web/lib/public`, and later an API client
  with the same signatures). No component reads a JSON file or a URL for data directly.
- **Server-shaped state.** URL state and list state (filters, sort, page) already map onto query parameters a server
  can answer. Keep pagination; never ship "load everything then filter" for the detail fields.
- **Moving in steps.** Each server step replaces one adapter function and its static file: first search, then list
  queries, then exports. The static pages stay as the cache.
- **No new client-side bulk loads.** Do not add one for convenience. If a feature needs one, it is a server feature.
