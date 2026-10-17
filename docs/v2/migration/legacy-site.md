# The legacy site (nks-travel.pages.dev)

Today: 13 trip pages and 2 site pages (`globe`, `locations`) plus the generated landing hub, all
served from Cloudflare Pages by `publish.sh`, each a self-contained HTML page. They stay live and
unchanged until each has a v2 equivalent; then the old URL redirects. Sharing in v2 is defined in
`docs/v2/10-sharing.md` (share links scoped to a trip, days, a day, a list, an item, a reservation or
a template; guest links read-only with expiry and optional PIN; public templates).

## 1. Why the pages should not simply stay public forever

- They are public today and several name the family's party and children's ages ("adults + a child
  ~6", "children 11+"), travel dates and lodging plans. In v2, a published template strips travellers
  and dates, and a guest link to the real trip expires. Retiring the legacy pages closes that exposure.
- They are snapshots: prices, windows and closures in them stop updating; the v2 trip and template
  refresh from the catalog.

## 2. Page by page

| Legacy URL (`/<slug>/`) | Kind today | v2 equivalent for the family | v2 equivalent for everyone else | Redirect when |
|---|---|---|---|---|
| `canadian-rockies-sept-2029` | future trip, published | private trip in the app; guest link (whole trip or days) for relatives | **public curated template** `/templates/canadian-rockies-young-child` | the template is published (M5) |
| `patagonia-feb-mar-2027` | future trip | private trip; guest link while travelling | public template | template published |
| `iceland-ring-road` | future trip | private trip | public template "Iceland by camper van" | template published |
| `norway-summer` | future, dates open | private trip (window A/B as variants) | public template | template published |
| `dolomites-july-2027` | future trip | private trip | public template | template published |
| `chamonix-mont-blanc-sept-2028` | future trip | private trip | public template | template published |
| `switzerland-2027` | future trip | private trip | public template | template published |
| `costa-rica-feb-2027` | future trip | private trip | public template | template published |
| `usa-southwest-rockies` | queued, dates open | private trip | public template "Utah's five parks" | template published |
| `algonquin-muskoka-oct-2026` | past (10-12 Oct 2026) | done trip | public weekend template | template published |
| `vermont-fall-2026` | past (1-4 Oct 2026) | done trip | public template; the KML/CSV become a GPX/KML export of the template | template published |
| `quebec-sept-2026` | past | done trip | public template | template published |
| `new-hampshire-stopover-2026` | past, one night | done trip | no template (too thin); redirect to the Vermont template | when Vermont redirects |
| `niagara-day-aug-2026` | past day trip | done trip | public day-trip template | template published |
| `locations/` | wishlist list page | the household wishlist (private list) | the public explore page `/explore` and place pages `/p/<slug>` | M1 (catalog live) |
| `globe/` | 3D globe of places | — | the explore map; the globe can survive as a public "where we have been / want to go" view generated from the catalog, owner's choice | M1 or kept |
| `/` (hub) | landing with trip cards | app home (signed in) | public home: templates and explore | M5 |

Trips still in planning are not public in v2 by default. If the owner wants a live, always-current
public page of a future trip (as today), that is a guest link with no expiry and the "public trip"
include settings from 10-sharing.md; templates are the recommended public form.

## 3. Redirect mechanics

- Cloudflare Pages supports a `_redirects` file at the site root (the platform plan, PLAN-platform
  E18, has the deploy step write it last; confirm in the deploy script). Each retired page gets one line:
  `/canadian-rockies-sept-2029/*  https://app.<domain>/templates/canadian-rockies-young-child  301`.
- Fragment links (`#day-5`) inside old pages map to the template's day anchors (`#day-5`): v2 keeps
  `day-N` anchors so old shared links still land on the right day.
- Asset URLs (`/vermont-fall-2026/assets/vermont-pins.kml`) redirect to the template's export
  (`/templates/<slug>/export.kml`).
- Old renamed paths that still serve from earlier deployments (the CLAUDE.md gotcha) are cleaned up in
  the Pages dashboard at the same time.
- Redirects are permanent (301) only after the owner has checked the new page; until then 302.

## 4. Retirement steps per page

1. Trip imported and reviewed (import-plan.md).
2. Template published (or guest link created for family-only pages) and checked side by side with the
   legacy page (same days, same key facts, sources visible).
3. Add the redirect line; republish the legacy site once (`publish.sh`) so `_redirects` deploys.
4. After 30 days, remove the page from `legacy/MANIFEST.json` (`served: false`) so it is no longer
   copied; the folder stays in git as history.
5. When every page is redirected, the Pages project keeps serving only `_redirects` and a small
   "moved" page; the domain can later point at the app directly.

## 5. What does not move

Page builders, gallery tools, theme CSS and the `_system/` design system stay in the repo as history.
Their good ideas (themes per trip, gallery lightbox, sun tables, Plan B toggles, split-day tracks) are
carried into the v2 UI design, not into code.
