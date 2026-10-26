# 06. Decisions and questions for the owner

> **Working draft.** "Decided" and "answered" below mean *current direction*, not final. Any of them can be reopened.

> **Last verified 25 Oct 2026 against main 4230210** ([audit](MASTER-PLAN-AUDIT-2026-10-25.md)). Since the 24 Oct note
> below: hosting is decided (Vercel, project `travel`, Q3); the site uses `https://travel-beta-tan.vercel.app` with no
> custom domain for now (owner 25 Oct, which answers Q17 for the time being; Q148 covers the mail domain); sign-in by
> email code and Google are planned (R-100, R-81), Apple is skipped (R-85), MCP sign-in is designed (R-123 to R-129,
> Q160 to Q167). Open owner questions now live in [PLAN.md](PLAN.md) section 5; this page is the 17 Oct record.

**Revised 24 Oct 2026 (owner): Q1 = Neon for Postgres, Managed Better Auth and Realtime, selected and provisioned
([NEON-SETUP.md](build/public-site/NEON-SETUP.md)).** That choice does not settle hosting, object storage or
functions, which remain open (laundry list Q65; hosting was then decided as Vercel, Q3). Sign-in is email and password only so far (Q66); who may sign up
(Q67), guest planning (Q68) and the household privacy model (Q69) keep their own answers in
[SERVER-SIDE-LAUNDRY-LIST.md](build/SERVER-SIDE-LAUNDRY-LIST.md).

**Historical:** on 17 Oct 2026 Q1 became self-hosted Supabase on the home server (Docker on Ubuntu), Supabase
Auth and Realtime, Next.js in a container, Cloudflare Tunnel (08-self-hosted.md); superseded on 24 Oct. Earlier the
same day: Q1 = C (Neon + Better Auth); Q10 = family first, public later; Q12 = live
co-editing like Wanderlog (built as an op broadcast, 04-stack.md 1.8); Q3/Q4 = Next.js on Vercel
for year one, with the conditions in 04-stack.md 1.9.

Each has a recommendation; "blocks" says which milestone cannot start without an answer.

## Decisions

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| Q1 | Data host and auth | A Supabase all-in · B Supabase as plain Postgres + Better Auth · **C Neon + Better Auth + R2 + Workers** | **Decided 24 Oct: Neon Postgres + Managed Better Auth + Neon Realtime.** R2, Workers and the rest of C are not selected (04-stack.md 1.5 is the reasoning record) | M0 |
| Q2 | Free plan for year one | stay free until outside users · pay from day one | **Free until the first outside user relies on reminders**, with our own nightly backup; then Neon Launch (~$5-20/mo) | M3 |
| Q3 | Hosting | **Cloudflare Workers** · Vercel | **Decided 24 Oct: Vercel** for the Next.js frontend; create/configure and deploy only when merge-ready (PLAN R-61). Cron, storage and trip rooms are not implied | M0 |
| Q4 | Web framework | **React Router 7** on Workers · keep Next.js 16 (OpenNext) | **Decided: Next.js 16** (04-stack.md 1.9); deploy on Vercel after merge-ready (Q3/R-61) | M0 |
| Q5 | Source of truth | Postgres now · stay with JSON in git | **Postgres now**, pause P4c | M0 |
| Q6 | First destination | **Banff and Lake Louise** · Patagonia | **Banff**: well mapped in OSM, your 2029 trip has the richest data to import | M1 |
| Q7 | Accounts | now · later | **Now** (households, MCP OAuth and sharing all need them) | M0 |
| Q8 | Server-run research | owner only · paid users · never | **Owner only**; others use their own chat client via MCP | M6 |
| Q9 | Public catalog licence | keep OSM-derived layer separate (ODbL) · avoid OSM data entirely | **Separate layer**, legal advice before selling data | M1 |

## Questions where your answer changes the design

| # | Question | Why it matters | My default if you don't answer |
|---|---|---|---|
| Q10 | Is this for **your family first, then others**, or a **public product from launch**? | public launch adds moderation, terms, abuse limits and support before M2 | family first; public from M5 |
| Q11 | Region: start **Ontario + day trips** (the Travel Finder idea) or **big trips worldwide**? | day trips need dense local coverage and drive times; big trips need deep research per destination | both, but the first catalog is Banff + your 64 places + the 40 local day trips |
| Q12 | Should **collaborators edit at the same time** (Google Docs style) or is "someone else changed this, refresh" enough? | real-time needs a sync engine (ElectricSQL, Zero) and changes M2's size | refresh is enough in v1. **Answered 17 Oct: live, like Wanderlog** (note above); the transport on Neon is not designed |
| Q13 | Flights: just **items with a booking and a deadline**, or **fare tracking**? | fare tracking needs paid APIs | items only |
| Q14 | Do you want an **in-app AI chat** at all, or only the MCP for outside clients? | in-app chat costs model tokens per user | MCP only; in-app later if asked |
| Q15 | Is the **trip page for others** (the published HTML today) still needed, or is the app's read-only link enough? | the legacy pages are rich, designed one-pagers; the app view is functional | app link, with a print-friendly view |
| Q16 | Kids' data: is storing **birth year and height** acceptable, or only an age band? | eligibility checks (via ferrata 12+, 40-120 kg) need numbers | birth year + optional height, private to the household |
| Q17 | **Brand and domain** for the product (not nks-travel.pages.dev)? | OAuth consent screens, email sender, cookies | decide before M3 (email). **25 Oct (owner):** the Vercel address for now, no custom domain; the planned Application Name in account mail is "Trip Plans" (R-107 O-E0, not yet set; the child branch reads "Travel Planner") |
| Q18 | Which **design direction** from the commissioned previews? | colour, type, density | wait for the previews |
| Q19 | **Budget per month** you are comfortable with once others use it? | decides the Neon paid plan, the app host and the email tier (the Neon vs Supabase Pro comparison is historical) | $25 |
| Q20 | Who besides you will **review research** (moderators)? | review queue permissions and volume | you only |

---

## Consolidated open questions from the detailed pages (17 Oct 2026)

Collected from features/, ux/, research/, mcp/ and migration/, deduplicated.

**Current direction (17 Oct 2026, not final): the defaults below are the working assumptions**, with these specific answers:
- **P1**: the five past pages (Algonquin, Vermont, Québec, New Hampshire, Niagara) and the two undated
  ones (Norway, Utah) are taken private now: `"private": true` in `legacy/MANIFEST.json`; publishing
  replaces each page and its asset files with a noindex placeholder (old Cloudflare deployments keep
  serving any path a new deploy omits, so overwriting is the only way to take them down) and drops their
  hub cards. Takes effect on the next `./publish.sh` from the owner's machine.
- **D1**: new research is recorded as changesets, not `research/trips/<slug>/*.md`.
- **Templates (M1-M4)**: the owner's trips become templates **visible to invited family and friends
  only** at first; making one public is a per-template switch later.
Change any decision by its ID.

### Privacy and people
| ID | Question | Default |
|---|---|---|
| P1 | The **published legacy pages show children's ages and travel dates** today. Hide the past and undated ones now? | Hide past (Algonquin, Vermont, Québec, New Hampshire, Niagara) and undated pages now; keep the rest until M5 |
| P2 | Store a person's weight (via ferrata 40-120 kg limits)? | Optional, private, asked only when an activity has a weight limit |
| P3 | Kids' birth year and height | Birth year + optional height, household-private (Q16) |
| P4 | Can a second adult remove the household owner? | No; ownership transfer is explicit |
| P5 | `people:read` and `reservations:read` for MCP clients, even the owner's own Claude | Off by default, ticked per client |
| P6 | Background location for automatic "done" ticks | No |

### Accounts, sharing and collaboration
| ID | Question | Default |
|---|---|---|
| A1 | Sign-up | Invite-only until M5 (still the default; the working email sign-up page does not settle admission, laundry list Q67) |
| A2 | Can editors invite others? | No, owner only (per-member `can_invite` switch exists) |
| A3 | Comments on items in v1 | No; notes cover it |
| A4 | Guest link defaults | 7-day expiry, no PIN, copy-to-my-trips allowed, costs and notes off |
| A5 | Sharing a ticket from the wallet | Members only, as a file through the phone's share sheet, never a link |
| A6 | Guests see the budget? | Only if the link's costs toggle is on |
| A7 | Passkeys in year one | Open (Q66); only if Managed Better Auth supports them without extra services. The self-hosted Supabase condition is historical |
| A8 | Template and guest URL shape | `app.<domain>/templates/<slug>` and `/s/<token>` |

### Planning and UX
| ID | Question | Default |
|---|---|---|
| U1 | Default desktop Plan view | The plan document; board as second view; map never fully hidden |
| U2 | Phone bottom bar inside a trip | Overview/Today · Plan · Bookings · Tasks · More (Budget, People under More) |
| U3 | Which day is expanded when a long trip opens | Next unplanned day; today during the trip |
| U4 | "Navigate" opens | Ask once (Google or Apple Maps), remember per device |
| U5 | Is "vacation" a trip type? | No; it is just multi_day length |
| U6 | Default lists on a new trip | Ideas only |
| U7 | Day-trip "pair these stops" in v1 | "Pairs well with" chips; full route builder in M7 |
| U8 | Typed search parsing | Rules only, no AI model, in v1 |
| U9 | Public star ratings | No; trust badges and reasons |
| U10 | Template adaptation | Always preview the change list first, with "Accept all" |
| U11 | Template updates after forking | Banner to review; never applied automatically |
| U12 | Sunlight high-contrast theme | Manual switch, remembered |
| U13 | UI font | Decide with the design previews (Inter or Source Sans 3, self-hosted) |
| U14 | Past trips in the list | Collapsed into "Past" by year |
| U15 | Default walk limit for families with tweens | 12 km and 800 m gain per day, editable |

### Reminders, reservations and budget
| ID | Question | Default |
|---|---|---|
| R1 | Quiet hours vs a 03:00 booking opening | Ring for openings that sell out in minutes or hours; others wait for morning |
| R2 | Tomorrow briefing | Push at 19:30 local during the trip, editable |
| R3 | SMS reminders | No; push and email |
| R4 | A second person also gets the alarm for time-critical bookings | Yes, optional per reservation |
| R5 | Weekly digest recipients | All editors, opt-out each |
| R6 | Flight lookup by number (paid API) | Not in v1 |
| R7 | Keep forwarded emails | Parsed fields + original as attachment for 30 days, then deleted |
| R8 | A held (provisional) stay counts for "no stay" check | Yes |
| R9 | Food budget per person per day by style | 40 / 75 / 120 CAD, editable |
| R10 | Fuel estimate for road trips | On by default |
| R11 | Weather-rule thresholds | Defaults per activity type, editable per item |

### Catalog, research and data
| ID | Question | Default |
|---|---|---|
| D1 | **Stop writing `research/trips/<slug>/*.md` for new research; the changeset becomes the record** | Yes; existing files stay as history and are imported as evidence |
| D2 | Auto-accept low-risk additions (official-source viewpoints, free-licence photos, link checks) | On for these only; never for facts from the owner's own Claude runs |
| D3 | Reviewers besides the owner in year one | None |
| D4 | Server-run research | Owner only, hard budget per job |
| D5 | OSM data as a separate layer; licensing decided before any export or sale | Yes; no public data export until then |
| D6 | Parking fill times from community reports | Yes, with two dated reports, shown as unverified |
| D7 | Trail variants | One entity per destination a walker chooses; shorter versions are turnaround points |
| D8 | Publish a destination in public Explore | Only when overview, trails or sights, stays and legs reach "usable" |
| D9 | Conditions checks | 3 days before, evening before, daily during the trip; rules first, a model only on conflicts |
| D10 | Community trip reports and videos | Shown as clearly labelled links |
| D11 | GPX downloads of OSM tracks | Yes, with attribution in the file |
| D12 | Elevation profiles | Computed on the server once per track |
| D13 | Public holidays source | Bundled JSON for Canada and the US, refreshed yearly; school calendars per household |
| D14 | Flight time for candidates abroad | Straight-line estimate labelled "approx." |
| D15 | Routing | OpenRouteService first; self-host Valhalla when needed; transit as Google Maps links only |
| D16 | Media finding | Cheapest model finds, owner picks on a contact sheet (as the gallery tools do now) |
| D17 | Who tunes trip-type profiles | Owner only, in admin |

### Templates and migration
| ID | Question | Default |
|---|---|---|
| M1 | Past trips (Algonquin, Vermont, Québec, Niagara) become templates? | Yes; New Hampshire stays a done trip (too thin) |
| M2 | "Travelled" templates only from finished trips | Yes; researched-only templates carry a "not travelled" badge |
| M3 | Budget ranges on templates | Yes, per category, with the year of the prices |
| M4 | Non-owners publishing templates in year one | No |
| M5 | Wishlist (64 places) | Private household list; the places themselves join the shared catalog |
| M6 | 126 Rockies rows without coordinates | Geocode from OSM; owner pins failures on a "needs a pin" admin screen |
| M7 | Hand-written trips imported | Assisted import when each trip is next revised, Patagonia first |
| M8 | The globe page | Kept, regenerated from the catalog, low priority |

### Storage limits (written for the historical home server; still the defaults for any host)
| ID | Question | Default |
|---|---|---|
| H1 | Offline map tiles per trip | 300 MB, adjustable 100 MB to 1 GB |
| H2 | Photos per trip | 200 at 2048 px; originals not kept |
| H3 | After-trip ratings affect public suggestions | Not in year one |
