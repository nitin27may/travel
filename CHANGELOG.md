# Changelog

Every release of the travel site at https://travel-beta-tan.vercel.app, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry names its date, the commit deployed, the database
migrations applied and the owner's actions. The release order, gates and checklist are in
[docs/v2/build/RELEASE-PLAN.md](docs/v2/build/RELEASE-PLAN.md) (section 8 is the convention for this file).

## [A.1] - 27 Oct 2026

Hotfix on release A. Deployed commit `4b5274d2`, deployment `travel-k7cz9cplo`, tag `release/A.1`. No database migrations.
Owner actions done: Allow Localhost off and the organization plugin disabled on the production Neon Auth branch.

### Fixed
- Sign-in routes: only the routes this site uses are reachable; every other path answers "not found" and every
  change request must come from this site.
- The sign-in switches now really turn the sign-in routes off when a switch is off.
- Signing in with an unverified email asks for a code through the same protected step as everything else.
- Sign-up and sign-in forms pass only the fields they need; the sign-up answer no longer copies the provider's headers.

### Internal
- The auth error log carries a plain code only, and the visitor's network address is read from the platform header.

## [A] - 27 Oct 2026

Deployed commit `a0867e4e` (code verified at `0743e1ca`; the changelog entry is the only change after it), deployment `travel-m99ylm9bq`, tag `release/A`. No database migrations.
This release carries v0.2, v0.3 and v0.4, which were not deployed on their own. Owner actions before the deploy:
analytics token set for production (done), Maps key restricted, rate limit on the catalogue API, a production database
snapshot, and approval of the named commit.

### Added
- **Trip tabs.** Trip pages open on a Summary with the headline facts, and Days, Stops, Bookings and Photos are tabs.
  Print works from Summary, Days and Bookings with the same pages.
- **Mine.** A new item in the phone bar and a link in the header open Mine: your own trips and favourites in one place.
  Without an account they stay in this browser.
- **My trips.** A trip you copy with your own dates appears in Mine with its dates and who is travelling. Open it, add it
  to your calendar, print it, change the dates or remove it. Copies made earlier move into Mine the first time you open
  it.
- **Favourites.** Tap the heart on a place or a trip to keep it in Mine. Cards show a small heart for favourites.
- **Sign in from a phone.** A person icon in the phone header goes to sign-in, or to your account.
- **Privacy page.** What the site keeps and what it does not, linked from every page.
- **Page-view counts.** Anonymous counting by Cloudflare Web Analytics: no cookies, no personal data.
- **Booking windows on paper.** The printed plan and the CSV list what to book ahead and when.
- **Link previews.** Sharing a trip or place link shows a preview image.
- **Weather links.** Official weather and climate links for the 14 public trips.
- **Basics for 74 more places:** where each is and its seasons, or "Not checked yet".

### Changed
- Trip pages read as published plans ("Published plan"). They no longer show a finished or past state.
- Photos load from this site in sizes that fit the screen.
- On phones the open map key covers at most half the map, and map buttons are easier to tap.
- A printed travel day shows its breaks and the arrival time, for example the time to be at the airport.
- A long drive split by a break no longer shows the full distance twice.
- Three Rockies walks draw their drive as a road route.
- Every filter option on the places page can be reached on a phone.

### Fixed
- The home page search and place pages no longer scroll sideways on small phones.
- Pages no longer fail to load when the browser blocks site data.

### Known limits
- Mine, copies and favourites stay in this browser; they do not follow you to another device yet, even when you sign in.
- Clearing browser data, a private window or some browsers' cleanup after a few weeks without a visit removes them.
- Most trail photos we have researched are not shown yet.
- Signing in with a code sent by email is not switched on yet.
- The site has no custom domain yet.

### Internal
- Trip identifiers in public pages and the API no longer carry travel months.
- Budgets at the final check: trip start JS 190.3 KB of 200 KB; place size median 1.2485 of 1.25; shell chrome 3,437 B of
  5,028 B (public) and 3,761 B of 6,693 B (sign-in on).
- A read endpoint that resolves renamed and withdrawn pages for Mine; booking windows in the export contract; the image
  steps run before the build and never fetch from Commons on the build server.

## [v0.1] - 2026-10-25

Commit 47be5b5. Migrations 0001 to 0011 applied. Owner actions: approved the deploy of this commit; set the hosting
environment; trusted the site address in the sign-in service.

The first public release of the new site. Everything here works without an account.

### Added
- **Trips.** Browse and search every public trip. Each trip is a plan you can reuse on your own dates: Day 1 to the
  last day, its length, the season it suits, and a day-by-day timeline in order.
- **Trip maps.** A Google map for each day with the stops in order and the drives between them.
- **Export a trip.** A calendar file, a printable page, and GPX, KML and CSV files for maps and spreadsheets.
- **Copy a trip.** Pick your own start date and who is travelling, and the plan lays itself out on those dates.
- **Seasons.** Six trips show which months suit them.
- **Places.** Search and filter places of every kind (trails, lakes, viewpoints, sights, activities) as cards, a list,
  a table or a map.
- **Place and trail pages.** Where it is, who it suits, the facts we have checked, links to trail and park sites, and
  directions. A section we have not researched says "Not checked yet" rather than guessing.
- **Globe.** A full-screen globe; pick a pin to open a trip or a place.
- **Search from anywhere.** Press `/` on any page. Plain questions such as "easy hike near Banff" become filters you
  can remove one by one.
- **On phones,** a button that takes you back to the top of long pages.
- **Accounts.** Sign in or create an account with an email address and a password, and keep your own plans on the
  Account page.

### Known limits
- Photos load straight from Wikimedia Commons rather than as resized copies from this site, so some pages load more
  slowly.
- Shared links show no preview image.
- Signing in with a code sent by email is not switched on yet.
- On phones the header has no sign-in link; open `/sign-in/` directly.
- A copied trip is kept in your browser, but no page lists it yet.
- Most trail photos we have researched are not shown yet.
- The site has no custom domain yet.
