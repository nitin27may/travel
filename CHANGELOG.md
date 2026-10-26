# Changelog

Every release of the travel site at https://travel-beta-tan.vercel.app, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry names its date, the commit deployed, the database
migrations applied and the owner's actions. The release order, gates and checklist are in
[docs/v2/build/RELEASE-PLAN.md](docs/v2/build/RELEASE-PLAN.md) (section 8 is the convention for this file).

## [Next] - unreleased

Planned for v0.2 (see the release plan for the full train).

### Added
- A sign-in item in the phone menu bar, so you can sign in or reach your account from a phone.
- A privacy page that says what the site keeps and what it does not.
- Anonymous page-view counting (Cloudflare Web Analytics: no cookies, no personal data), named on the privacy page.

### Internal
- A tool that builds the catalogue database from the files in the repository and keeps it in sync. No change for
  visitors.

## [v0.1] - 2026-10-25

Commit d93127b. Migrations 0001 to 0011 applied. Owner actions: approved the deploy of this commit; set the hosting
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
