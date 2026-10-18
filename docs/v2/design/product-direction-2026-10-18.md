# Product direction from the owner (18 Oct 2026)

These are inputs for the next round. Work on them starts only after the running work has finished: the redesign previews, the trail coordinates, the Fable review and the scenario check. The order is at the end.

## Two parts of one product

1. **The public site: read-only, no login. This is the key selling point and comes first.**
   - Anyone can come for inspiration and details. They search trips; they search places of every kind (trails, hikes, lakes, viewpoints, sights, activities, stays); they open a trip or a place and see everything; they copy or export it.
   - This already works well on https://nks-travel.pages.dev (Trips, Places, Globe; see [keep-from-live-site.md](keep-from-live-site.md)). It must not be lost. Improve it; do not replace it.
   - **Globe:**
     - Make it much better: **full screen**, rotate, select, smooth animation.
     - Pins on continents and countries are the way in. Selecting a pin opens a trip or a place with all its details.
   - **Trip detail page:** fix it properly. Content is categorised (stays, trails, sights, food, logistics), and the day-by-day is **chronological**. Read-only improvements are wanted; the existing content stays.
   - Most visitors will never sign in, so the whole public experience works without an account.
2. **The planner: signed in. Built after the public site.**
   - Trips, bookings, tasks, budget, Today and collaboration (the current prototype).
   - Planning without signing in can be allowed later, held in browser memory with a clear warning that the data can be lost on exit. Decide this when the schema is designed.

## Design system and colour

- The existing design system (live site and v2 docs) can be **revived**: its structure, components, type, views and honesty markers.
- **No green palette.** The product needs a new colour palette that works end to end: public site and planner, light and dark, maps included.
- Order of work: wireframes, then the whole prototype, then the end-to-end design. Architecture comes after. "No one worries about what architecture you are using; it is how easy it is to find the solution."

## Maps

- The owner likes **Google Maps**. The public pages already show a location pin on a Google map, and it looks good.
- The product needs **distance and directions** as well as pins.
- Research the free tiers properly and choose the map stack as part of the UI/UX work, not only by licence. Candidates to check, with current terms:
  - **Google Maps Embed API**: place and directions modes in an iframe. It needs a key, and the published pricing lists it as no charge; verify this.
  - **Google Maps URLs**: deep links, no key.
  - The Google Maps JavaScript API and Routes API free monthly caps.
  - MapTiler, Stadia and Mapbox free tiers.
  - OpenFreeMap with OpenRouteService or OSRM for routing.
- **Scale assumption (owner, 18 Oct 2026): fewer than 100 users in the first year.**
  - Judge every option at that size. It should be free, or within a free tier, for year one.
  - Prefer the option that looks and works best, Google included, as long as its free caps cover under 100 users with headroom.
  - Note the exit path and the cost only for a later 1,000-user step; do not design for 10,000.
- The research answers which look the owner gets, the cost in year one, the step to 1,000 users, and what each option's terms allow us to store.

## Order of work (after the current tasks finish)

1. Finalise the design of the **public read-only site**:
   - wireframes and a prototype for Home/inspiration, the globe (full screen), trip search and trip detail (categorised, chronological), place search and place detail (all kinds), copy and export
   - built on the chosen palette and the Fable-reviewed design system
2. Map stack research and decision, as part of step 1.
3. Then the signed-in planner, applying the same system.
4. Then the schema, auth and backend, including the guest-planning decision.
