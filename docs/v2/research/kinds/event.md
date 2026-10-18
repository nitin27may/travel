# Kind profile: event

Status: draft (18 Oct 2026). Template: [README.md](README.md). Method:
[../lanes/events-and-seasonal.md](../lanes/events-and-seasonal.md).

## 1. What it is

Something that happens on dates: a festival, market, race, holiday, natural event (larch peak, salmon
run, foliage peak), or a closure that behaves like an event (the Mont Blanc tunnel's autumn closure, a
lift-closing Sunday, a pass closed for a bike race). Stored as `entity.kind = event`, subkind
`festival`, `market`, `sport`, `holiday`, `natural`, `closure`, with one `event_occurrence` row per
year (research/README.md R6). Produced by the **events and seasonal** lane.

An event either **is** a reason to go (Diwali, UTMB as a spectator, larches) or **changes** other
places (prices up, roads closed, hotels full). Both are modelled with `affects` relations to the
places and areas (`attrs.effect`: `crowds`, `prices_up`, `closure`, `road_closed`, `must_see`).

Separate entities: the venue ([sight](sight.md), [town](town.md)); tickets (`offer`); the places it
affects (`affects`).

## 2. Required fields

| Field | Format | Example | Why it matters to a family planning a day |
|---|---|---|---|
| `area_id` | the area it happens in or affects | `area_chamonix` | |
| `attrs.recurrence` | `fixed_date` (MM-DD), `nth_weekday` (e.g. last full week of August), `lunar` (with the calendar), `condition` (peak colour), `one_off` | `nth_weekday: last week of August, about 7 days` | |
| occurrence for the trip's year | `event_occurrence {year, starts_on, ends_on, status: confirmed | expected | cancelled, source}` | `{year: 2028, status: "expected", starts_on: null}` | whether it overlaps the trip |
| `attrs.effect` | list from the enum, with `affects` relations | `["crowds", "prices_up"]` | the base that becomes impossible |
| `attrs.family_friendly` | `yes`, `partly`, `no`, with why | | |
| `point` | the main venue, or the area centre for area-wide events | | |

Natural events add `attrs.peak_window` by sub-area `{area, from, to, confidence, years_observed}`
(the larch peak about 20 Sep - 5 Oct; Algonquin peaked about 27 Sep in an early year) and the live
source (`conditions` link: a foliage report, a park update).

Complete adds: tickets (`offer`), `attrs.crowd_level`, `attrs.best_spot` (point), `attrs.road_closures`
(roads and hours, for races), `attrs.accessibility`, `attrs.schedule` (programme by day once
published).

## 3. Location

`point` from the venue's OSM id, or the area centre (`wikidata:` allowed) for area-wide events. The
places it affects carry their own points.

## 4. Link checklist

`official` (organiser), `tourism_board` (event calendar), `booking` (tickets), `conditions` (natural
events: foliage, larch, wildlife reports), `wikidata`, `wikipedia`, `commons`, `video`.

## 5. Where to research, in order

1. Organiser (race, festival, temple or community body).
2. Official tourism event calendars, municipal notices.
3. For natural events: the park or wildlife agency and long-running trackers, with years observed.
4. For closures: the operator (ATMB for the tunnel, the lift company for closing Sunday).
5. Community reports for crowds and the real effect on prices.

## 6. People limits

Rarely. Age rules on events (adults-only evenings, race minimum ages) go in `eligibility`.

## 7. Time and money

Occurrence dates per year with status; ticket windows (often fixed-date releases); the price effect on
stays (recorded as `effect: prices_up` with the evidence, not as a number we invent).

## 8. Never guess

A future year's dates presented as confirmed when only the pattern is known; lunar holidays copied
from last year; peak foliage dates as a fixed date (it is a window with confidence).

## 9. Completeness levels

Common checks D1-D5, U1-U2, C1-C8 (U2 season is the recurrence season), plus:

| Id | Level | Check | Allowed evidence |
|---|---|---|---|
| U3 | Usable | `attrs.recurrence` | `official` or the years observed |
| U4 | Usable | an occurrence for every year a trip in the catalog uses, with `starts_on`, `ends_on` and status (an `expected` occurrence may carry dates derived from the pattern, marked as such) | `official` for `confirmed`; the pattern for `expected` |
| U5 | Usable | `attrs.effect` with at least one `affects` relation | |
| U6 | Usable, natural events | `attrs.peak_window` with confidence and years observed | `official` or dated `community` |
| C9 | Complete | `attrs.family_friendly` | |
| C10 | Complete | tickets `offer` or `free` | `official` |
| C11 | Complete | `attrs.crowd_level` | `community` |
| C12 | Complete, sport and festivals | `attrs.road_closures` (or `none_stated`) | `official` |
| C13 | Complete | `conditions` link for natural events, or `not_applicable` | |

Totals: Draft 5, Usable 6, Complete 13; **24** (natural event); **23** otherwise.

## 10. Freshness

Occurrences: until confirmed, re-checked every 60 days inside a year of the date. Patterns and
recurrence: 365 days. Peak windows: after each season, add the observed year. Tickets: 120 days.

## 11. Traps

| Trap | Where |
|---|---|
| Future dates unknown | UTMB 2028 dates unknown when the Chamonix plan was made (repo CLAUDE.md, Chamonix entry) |
| A closure that decides the trip | Mont Blanc tunnel autumn closure (2025: 1 Sep - 12 Dec; ATMB says 2027-28 repeat it) (same) |
| A closing Sunday that falls inside the window | Chamonix lifts about 13 Sep; a 2028 closing Sunday could be 10 Sep (same) |
| An early colour year | Algonquin peaked about 27 Sep 2026 (repo CLAUDE.md, Algonquin entry) |
| Races that close passes | Sellaronda Bike Day and Maratona dles Dolomites (research/trips/dolomites-july-2027/sights.md line 282) |
| Car-free scheme dates move between years | Passo Sella #dolomitesvives, 23 Jul - 31 Aug in the recent framework, 2027 dates GAP (dolomites transport.md section 1) |

## 12. Worked example: UTMB week, 2028

| Field | Value | Evidence |
|---|---|---|
| `subkind` | `sport` | |
| `area_id` | `area_chamonix` | |
| `recurrence` | `nth_weekday`: late August, about 7 days | lanes/events-and-seasonal.md example |
| occurrence 2028 | `expected`, `starts_on` null | dates not announced (repo CLAUDE.md) |
| `effect` | `crowds`, `prices_up`; `affects` every Chamonix base | |
| `point` | Chamonix centre (`wikidata:` allowed for an area-wide event) | |

Level: **Draft · 8 of 23** (D1-D5, U3, U5, and U1 once the summary is written; U4 fails because 2028
has no occurrence dates, which is the correct state). The Chamonix plan (1-9 Sep 2028) lists the
unknown UTMB dates as a risk; with U4 failing, `check_trip` keeps reporting it until the organiser
publishes.
