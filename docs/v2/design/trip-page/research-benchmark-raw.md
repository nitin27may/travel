# Official Docs Research: itinerary and timeline UI benchmark (2025-2026)
SOURCE_TYPE: official-docs (plus a few reputable reviews and user reports, marked as such)
CONFIDENCE: MEDIUM for Wanderlog, Polarsteps, Airbnb, Linear, GitHub/Primer; LOW for Lonely Planet, Atlas Obscura, Apple Journal, Komoot, Google
GENERATED: 2026-10-18T12:00:00+05:30

## Summary

Every row below is limited to what an official page, release note or named review actually says. A cell reading "not documented" means no citable source was found, not that the feature is missing. Several vendor pages blocked fetching (403: Atlas Obscura, Polarsteps support, Wanderlog help centre) or render their itinerary body client-side (Lonely Planet). For those, the claims come from search-result snippets of the same official URL. Wanderlog is the only product that officially documents per-stop start and end times together with time and distance on the legs between stops. TripIt is still the reference for a single chronological booking timeline, and Komoot for stage-based multi-day splitting. Linear and GitHub/Primer are the references for collapse rules and rail mechanics, not for travel.

## Benchmark table

| Product | Time rail / per-stop times | Connectors between stops | Collapse / expand | Day nav / overview strip | Map sync | Meals, breaks, bookings | Uncertain / suggested times | Weakness | Sources |
|---|---|---|---|---|---|---|---|---|---|
| Wanderlog | Optional start and end time per place: "Organize your day by adding start (and end) times" [1]. Places stay in list order with no fixed time grid [1][2] | "Distance and time between places" shown on the itinerary [2]. Daily total of time and distance travelled [1]. A directions button between stops opens Google Maps, Apple Maps or Waze [3] | Not documented in official sources | Itinerary "organized by day or by category" [2]. No official description of a sticky day bar | "Your itinerary and your map in one view" [4]. "Color-coded map" [2]. Pins joined by lines in visit order [1] | Flight, hotel and reservation emails auto-populate "dates and times" [2] | Times stay unset unless the user enters them. A user review asks for stay durations so the app can show "approximate timestamps", which suggests no computed arrival times [5] | Users report wrong drive times, e.g. "just over 3 hours" for a 40-50 min drive (Trustpilot, 2023) [6]. Route optimisation is Pro only [3] | [1][2][3][4][5][6] |
| TripIt | One "single chronological timeline" of all bookings per trip (review, 2023) [7]. TripIt "creates a schedule showing you where to be and when" [8]. Time zone of a manual plan comes from its address, "at a minimum, a city and country" [9] | Navigator "Shows you options to get from one point to another" [8]. No documented duration or distance between plans [7][8] | Not documented | Not documented | Not documented in the itinerary view. Airport and terminal maps are separate features [8] | Restaurant reservations, tours and transfers sit on the same timeline as flights and hotels [7]. "Add a Plan" by type [9]. Forward confirmations to plans@tripit.com [10] | Time comes only from bookings or manual entry. Pro "reminders when to leave" [11] | Bookings from small operators often need manual entry. Useful features sit behind the $49/yr Pro tier [7][11] | [7][8][9][10][11] |
| Google (Trips app, Travel, Maps, Search AI Mode) | Trips app shut down 5 Aug 2019 [12]. Reservations went to a trip timeline at google.com/travel, editable in place (2019) [13]. AI Overview itineraries (Mar 2025): no documented per-stop times [14] | AI Mode Canvas (Nov 2025) sorts restaurants and activities "by travel time from where you're staying" [15]. No leg connectors documented | Not documented | AI Overviews build itineraries for whole regions (Mar 2025). Day-by-day structure is not described in the official post [14] | AI Overview itinerary shows "locations on an expandable map" and can be saved as a Maps list [14]. Canvas combines Maps details in a side panel [15] | Reservations pulled from Gmail into Maps (Your places, Reservations) and Travel [16][13]. Canvas compares hotels on price and amenities [15] | Itineraries are AI-generated. A 2026 review found Gemini "occasionally made mistakes" [17] | Spread across four surfaces with no single itinerary page. Canvas is US-only, desktop-only and behind a Labs opt-in [15] | [12][13][14][15][16][17] |
| Airbnb (Trips tab, Experiences) | Trips tab: "An advanced travel itinerary with a schedule of your trip" (13 May 2025) [18]. Experience itinerary: ordered activities, each with "how many minutes", no clock times [19] | Not documented | Not documented | Not documented | Not documented | Booked services and experiences appear in the Trips schedule next to check-in (screenshot shows check-in and a luchador show) [18]. Experience steps each carry a title, one-line description, photo and duration [19] | Durations only, so start times per step are implied | Experience steps have no clock times or map. Press flags clutter risk in the all-in-one app [19][20] | [18][19][20] |
| Lonely Planet | Articles grouped by trip length (e.g. "4-day Osaka and Kyoto itinerary", 10 to 14 day routes) [21][22]. "Make My Day" guides use morning, afternoon and evening blocks instead of clock times [23] | Transport advice in prose (e.g. Japan Rail Pass on the Golden Route) [21] | Not documented (body renders client-side; not fetchable) | Itineraries titled by day count. Bookable "Journeys" itineraries exist [24] | Not documented | Not documented for articles. Journeys are "ready-to-book itineraries" [24] | Block-based (morning/afternoon/evening) rather than timed [23] | Editorial prose with no structured timeline found. Could not verify the on-page layout [21][24] | [21][22][23][24] |
| Atlas Obscura Trips | Trips listed by length, e.g. "7 days, 6 nights" [25]. Day 1 is a narrative sequence: welcome drink, orientation tour, welcome dinner [25] | Not documented | Not documented (pages return 403 to fetch) | Day-numbered sections ("Day 1") [25] | Not documented | Meals named inline in each day's narrative, e.g. "welcome dinner", "home-cooked meals in the private homes of local chefs" [25] | No clock times, so the itinerary reads as a narrative | Prose days with no times, legs or map documented [25] | [25] |
| Apple Journal | Sort by "Entry Date" or "Moment Date". Insights calendar jumps to a day's entries [26] | None | Not documented | Insights calendar picks a date [26] | Places map shows entries with a location, or photos with location data [26]. Users found the map hard to discover (AppleVis, 2025 beta) [27] | Not applicable. Trip moments come from photos and places grouped by on-device suggestions [28] | Retrospective: times come from the moment, never planned | No planning model at all, and the map is hard to find [27] | [26][27][28] |
| Polarsteps | Planned "steps" each carry an arrival date and a number of nights. No per-stop clock time documented [29] | Per-leg transport mode: "train, bus, bike, boat, or on foot" [30][31]. Leg duration and distance not documented | Not documented | Not documented | Map-first: the AI builder works "directly on the map" and "you see your route unfold visually" (summer 2025) [32] | Forward hostel, hotel or Airbnb confirmations to plan@polarsteps.app [30]. Notes per step can hold "ticket numbers" [29] | AI itinerary is an editable suggestion with chosen start and end points and transport modes [30] | Planning is app-only, with desktop "coming soon" [30]. Granularity is days and nights, not hours [29] | [29][30][31][32] |
| Komoot multi-day | Stages sized by "total daily moving time" (Premium) [33][34]. Not clock-timed | Each stage is one routed tour. Stages "adjust the route to and from the doorstep of your accommodation" [34] | Not documented | Stage list; "see all the details per stage" [35] | Stages can be adjusted by dragging the route on the map (review) [36] | Accommodation can be added at the end of each stage [35]. Stage planning shows hotels, campsites, restaurants and drinking water (review) [36] | Moving-time estimates only | Saving splits the plan into separate tours in a Collection, so editing one day does not carry into the next (user report) [37]. Collections need Premium [38] | [33][34][35][36][37][38] |
| Linear (issue activity) | Activity feed, events listed in order [39] | Not applicable | "Group similar consecutive events and collapse older activity between comment threads" (3 Apr 2025) [39]. How it expands is not documented | Not applicable | Not applicable | Not applicable | Not applicable | Expansion control and opt-out are not documented [39] | [39] |
| GitHub / Primer Timeline | Vertical rail of items for PR and issue history [40]. `Timeline.Item` with a `Timeline.Badge` icon and variant colours [40] | `Timeline.Break` gives a decorative visual separation, hidden from assistive technology [40] | `condensed` item reduces padding and drops the badge background (used for commits) [40][41]. Long timelines hide events behind "Load more" and "Load all"; screen readers now announce how many loaded (8 Oct 2026) [42] | Not applicable | Not applicable | Not applicable | Not applicable | Primer guidelines "in progress". Rails component is Beta and not reviewed for accessibility [40][41] | [40][41][42] |

## Notes for the trip-page spec

1. Per-stop times are optional everywhere. Wanderlog makes start and end times opt-in per place [1]. Airbnb uses durations only [19]. Polarsteps uses dates and nights [29]. Lonely Planet uses morning, afternoon and evening blocks [23]. None of the sources documents a visual difference between a fixed time and an approximate one. That is an open gap the spec can fill, for example with "~10:30" or a block label.
2. Connector legs are documented only by Wanderlog (time and distance per leg plus daily totals, with a directions hand-off) [1][2][3] and Polarsteps (mode only) [30]. Wanderlog's accuracy complaints [6] argue for showing the routing source and allowing a manual override.
3. Bookings: TripIt, Wanderlog, Polarsteps and Google all ingest confirmation emails [10][2][30][16]. Airbnb puts booked experiences inline in the schedule [18]. Atlas Obscura puts meals inline in the day narrative [25]. No product documents a separate meal or break item type.
4. Collapse rules come from dev tools. Linear groups similar consecutive events and collapses older activity between comments [39]. GitHub hides the middle of long timelines behind Load more or Load all [42]. Primer offers a condensed item variant and a decorative break [40]. A reasonable mapping is condensed rows for legs and minor stops, with full rows for timed or booked items.
5. Map sync: Wanderlog's "itinerary and map in one view" [4] and Polarsteps' map-first builder [32] are the only documented cases. Scroll-linked sync and sticky day navigation are not documented by any product found. Treat them as unverified and benchmark them hands-on.

## Caveats / Gaps

- 403 on fetch: atlasobscura.com, support.polarsteps.com, help.wanderlog.com. Claims for those URLs come from search snippets of the official page.
- Lonely Planet itinerary bodies were not readable (client-rendered). Their layout is unverified.
- Wanderlog app-store and APK listing text [1] is vendor marketing copy hosted on third-party sites.
- TripIt review [7] dates from March 2023 and Go Now coverage from 2017. Current TripIt help pages describing the timeline UI were not found.
- Komoot help-centre pages were not found. Rows rely on the komoot.com product page, the komoot newsroom and 2019-2024 reviews. Bending Spoons bought Komoot in March 2025 and features may have changed [38].
- Apple Journal: only the Mac guide is official [26]. iPhone trip grouping comes from press coverage of iOS 17.2 [28].
- Google Maps "Trips" tab (2020) rollout is unconfirmed for 2025-2026 [16].
- The scope of this run ruled out hands-on observation of sticky day navigation, scroll-linked maps and expand behaviour.

## Sources

[1] https://blog.reeoo.com/app-screenshot/wanderlog-travel-planner/ — Wanderlog - Travel Planner (app listing text)
[2] https://wanderlog.com/plan-a-trip — Wanderlog: Plan a trip, build your itinerary
[3] https://help.wanderlog.com/hc/en-us/articles/13545624787867-Optimize-route — Wanderlog Help: Optimize route (snippet; Pro features section https://help.wanderlog.com/hc/en-us/sections/13302911983643--Pro-features)
[4] https://wanderlog.com/ — Wanderlog travel planner home
[5] https://www.apkmirror.com/?p=15143062 — What's new in Wanderlog 2.215 (listing and review text)
[6] https://www.trustpilot.com/review/wanderlog.com?page=2 — wanderlog.com Reviews, Trustpilot
[7] https://thriftytraveler.com/guides/travel/tripit-review/ — Thrifty Traveler TripIt review (13 Mar 2023)
[8] https://www.tripit.com/uhp/features — TripIt features
[9] https://help.tripit.com/en/support/solutions/articles/103000063279-edit-trip-itinerary-on-our-website — TripIt Help: Edit trip itinerary on our website
[10] https://www.tripit.com/web/free — TripIt free
[11] https://m.tripit.com/uhp/pricing — TripIt pricing
[12] https://9to5google.com/2019/08/06/google-trips-stop-support/ — 9to5Google: Google Trips stops support
[13] https://blog.google/products/flights-hotels/planning-trip-google-can-help/ — Google Keyword: easier way to plan and organize trips (14 May 2019)
[14] https://techcrunch.com/2025/03/27/google-rolls-out-new-vacation-planning-features-to-search-maps-and-gemini — TechCrunch: Google vacation planning features (27 Mar 2025)
[15] https://blog.google/products-and-platforms/products/search/agentic-plans-booking-travel-canvas-ai-mode/ — Google Keyword: New ways to plan travel with AI in Search (17 Nov 2025)
[16] https://9to5google.com/2019/08/08/google-maps-travel-reservations/ — 9to5Google: Google Maps travel reservations
[17] https://www.thestar.com.my/tech/tech-news/2026/05/07/opinion-a-tech-writer-puts-googles-ai-to-the-test-as-a-trip-planner — The Star: Google's AI as trip planner (7 May 2026)
[18] https://news.airbnb.com/product-releases/airbnb-2025-summer-release/ — Airbnb 2025 Summer Release (13 May 2025)
[19] https://www.airbnb.com/resources/hosting-experiences/a/how-to-build-an-itinerary-that-stands-out-713 — Airbnb: How to build an itinerary that stands out
[20] https://www.phocuswire.com/airbnb-summer-release-2025-experiences-services-short-term-rentals — PhocusWire: Airbnb summer release 2025
[21] https://www.lonelyplanet.com/articles/best-japan-itineraries — Lonely Planet: 5 best Japan itineraries
[22] https://www.lonelyplanet.com/articles/osaka-and-kyoto-japan-itinerary — Lonely Planet: 4-day Osaka and Kyoto itinerary
[23] https://export.side.fr/en/9781743609286-make-my-day-rome-1ed-anglais- — Lonely Planet Make My Day Rome (publisher listing)
[24] https://www.lonelyplanet.com/journeys/itineraries/98a5d0f7-de9f-4224-8ea4-377c77759290 — Lonely Planet Journeys: 14 Days in Japan
[25] https://www.atlasobscura.com/unusual-trips/oaxaca — Atlas Obscura Trips: Flavors of Oaxaca (snippet)
[26] https://support.apple.com/guide/journal/dev153edfa89/mac — Apple: View and search your journal entries on Mac
[27] https://www.applevis.com/comment/195701 — AppleVis: The map function in the Journal app (beta)
[28] https://www.igeeksblog.com/how-to-use-journal-app-on-iphone/ — iGeeksBlog: Apple Journal app guide
[29] https://support.polarsteps.com/article/176-itinerary-planner — Polarsteps Support: How do I plan my trip? (snippet)
[30] https://news.polarsteps.com/releases/planning-update-2025 — Polarsteps: Trip planning update 2025
[31] https://apps.apple.com/us/app/polarsteps/id947925763 — Polarsteps on the App Store
[32] https://www.polarsteps.com/news/polarsteps-summer-2025-release-is-here — Polarsteps summer 2025 release
[33] https://newsroom.komoot.com/182344-go-further-with-komoot-premium/ — komoot newsroom: Go further with komoot Premium
[34] https://www.bikeradar.com/advertising-feature/komoot-bikepacking-collections/ — BikeRadar (komoot feature): bikepacking Collections
[35] https://www.komoot.com/premium/multiday-planner — komoot Premium multi-day planner
[36] https://www.singletracks.com/mtb-news/bikepack-around-the-globe-with-new-komoot-premium-multi-day-routing-features/ — Singletracks: komoot multi-day routing
[37] https://www.trainerroad.com/forum/t/planning-a-multi-day-bikepacking-trip-with-komoot-how-can-i-save-the-route-while-still-planning/37162 — TrainerRoad forum: multi-day komoot save behaviour
[38] https://www.komoot.com/adventure-hub/7givr4EV7bXg2vLJbWVXFx/the-5-step-guide-to-planning-a-long-distance-ride-with-komoot — komoot: 5-step guide to a long-distance ride (25 Apr 2024); Bending Spoons note via https://veloplanner.com/blog/looking-for-a-komoot-alternative-an-honest-answer-from-people-who-build-one
[39] https://linear.app/changelog/2025-04-03-collapsed-issue-history — Linear changelog: Collapsed issue history (3 Apr 2025)
[40] https://primer.style/components/timeline — Primer: Timeline
[41] https://primer.style/view-components/components/beta/timelineitem — Primer ViewComponents: TimelineItem (Beta)
[42] https://github.blog/changelog/2026-10-08-screen-readers-can-navigate-timelines-as-lists — GitHub changelog: Screen readers can navigate timelines as lists (8 Oct 2026)
