# Trip timing and the trip inventory: when to go, everything on a trip, filters, add-ons (TIM, INV)

Status: spec, 25 Oct 2026; owner decisions Q-TIM-1 to 3 answered. Written from the owner's request of 25 Oct (this session). Nothing in it is built. Example trip: Canadian Rockies
(`canadian-rockies-2029`). It extends, and does not replace: [trip-timeline.md](trip-timeline.md) (days and the scheduler),
[nearby-and-regions.md](nearby-and-regions.md) (what is near, Q60: nothing unresearched is suggested), F06 and F07 (customising the plan) and
[DATA-LOC.md](../build/public-site/briefs/DATA-LOC.md) (basics and photos for every location). UI work goes through `travel-builder`, then
`travel-design-reviewer`, then `travel-verifier`; data work follows the research skill.

## 1. Owner asks (25 Oct) and where each is answered

| # | Ask | Answer |
|---|---|---|
| 1 | The legacy Rockies page is a September plan; the trip is now "14 days". Suggest the best time to go, with tips to avoid the rush: late June, or the second or third or last week, or the first week of September. Add pluses and minuses | 2. Timing windows |
| 2 | A consolidated view per trip: every walking trail, every sight, every activity, as a tab or group, with counts | 3. The inventory |
| 3 | Filter that view: how many sights, how many need booking, how many activities; not only day by day | 3.2 Filters |
| 4 | When someone customises the trip they add or remove trails; show every possible nearby thing they could add | 4. Add-ons and customising |
| 5 | Capture whatever data is missing for this; thumbnails for every trail card | 5. Data to capture, 6. Thumbnails |

## 2. Timing windows: "when to go"

### 2.1 What exists

`data/schedules/canadian-rockies-2029.json` has one `season` (8 to 22 Sep) and 15 day sections. The six trips that show "season not set yet" are D6a
(BACKLOG 3.9). So today a trip has a single fixed window and no reason for it.

### 2.2 The model

A trip carries `timing.windows[]`, 2 to 5 per trip. Each window is a stretch of weeks, not a date:

| Field | Meaning |
|---|---|
| `id`, `label` | `late-june`, "Last week of June" |
| `from`, `to` | month and day, any year (the schedule keeps its own dates) |
| `verdict` | `best`, `good`, `trade-off`, `avoid`: the one-word summary a card shows |
| `pros[]`, `cons[]` | one line each; each carries a source row, read date and basis. A line with no source is not written |
| `open_share` | **computed**, never typed: of the trip's stops (section 3.1), how many are open in this window, from each record's `access_season`, `closures` and `window` |
| `crowd` | `low`, `medium`, `high`, `none_stated`, with the source (for example Parks Canada visitation by month, Alberta and BC parks pages), or `searched_none` |
| `daylight` | first light, sunset and twilight from `core/src/sun` for the window's middle day (never from memory) |
| `weather` | the monthly normal from the national weather service, with the station named and the read date |
| `tips[]` | "go early for Moraine Lake", "book the shuttle at 8 AM on the opening day": each is a stated rule with a source |

The computed `open_share` is the honest core: a window is "best" because more of the plan is open and fewer rules bite, not because the page says so.
Window verdicts are our judgement and say so (`basis: our_inference`); the pros and cons under them are sourced facts.

### 2.3 The Rockies example, to research (not yet researched)

The owner's candidates: **last week of June**, **second and third week of June**, **last week of September**, **first week of September**.
Questions the research must answer from official pages, each with a read date, before a verdict is written:

- What opens when, in June: the Moraine Lake and Lake Louise shuttle or road season, Icefields Parkway services, the Maligne Lake boat season, the
  gondolas, rafting season (snowmelt flows), and when the high trails (Larch Valley, Sentinel Pass, Cory Pass, Skyline, Berg Lake) are snow-free.
- What is lost or gained against 8 to 22 September: larches (late September), wildlife (the elk rut is a September event), water levels, smoke
  and wildfire records (a counted fact, not a feeling), first-week-of-September holiday crowds, daylight length.
- Crowds: Parks Canada monthly visitation and the parks' own "avoid the rush" advice, quoted and dated.

This is a D6a extension (an Opus researcher, `research` skill). Until a window is researched it is not shown; a trip with one window says so.

### 2.4 Showing it

A "When to go" block on the trip page and on the trip card: the windows side by side, a bar of `open_share`, the pros and cons, and the tips. Choosing a
window is a planner action (F03 candidate windows) and moves the schedule's dates; it never rewrites the day list silently (trip-timeline.md: no silent stop loss).

## 3. The inventory: everything on a trip

### 3.1 What it lists

For one trip: every record of its lane (`data/capture/<trip>/`) that a visitor can do or see, grouped by the capture type tree, not by day. Measured for the
Rockies (25 Oct): **199 records**, of which **67 are trails** (46 hikes, 20 walks, 1 other), 14 lakes, 9 waterfalls, 9 gondolas or lifts, 8 viewpoints, 7 hot
springs, 6 scenic drives, 6 landmarks, 5 rafting offers and more. The schedule uses **40** of them over its 15 day sections, so about four in five are not in
the plan today. That is the add-on pool (section 4).

Groups (tabs on the trip page, counts on each), mapped from the type tree:

| Tab | Types | Note |
|---|---|---|
| Trails and walks | `nature.trail.*` | cards with distance, gain, difficulty, time, a thumbnail |
| Sights | viewpoints, lakes, waterfalls, landmarks, parks, hot springs, wildlife | |
| Activities | offers: rafting, lifts, horse rides, cruises, rentals, tours | price, operator, season, minimum age |
| Getting around | scenic drives, shuttles, parking, rail | parking and fees |
| Eat and stay | only where researched | no stay ideas or booking state in public fields |

A record belongs to one tab by its type and may appear in "In the plan" or "Not in the plan" by whether a schedule day references it.

### 3.2 Filters (one filter set, every tab)

- In the plan, or not in the plan.
- Needs booking: yes, no, `none_stated` (from `window` and `links.booking`); with the booking date if one is stored.
- Kind within the tab (hike, walk, drive, lift, rafting).
- Effort: distance, gain, difficulty band, time; kid-fit; stroller, wheelchair, dogs.
- Open in the chosen window (section 2): shown from `access_season`.
- Base or area, and drive time from a base (stored matrices only, the nearby spec).
- Needs a car or a shuttle, parking and a fee.
- Has a photo.

URL state only (the existing filter pill pattern), counts after each filter, and an empty state that says which filter emptied it.
Where a value is `none_stated` the card says "not stated", never a guess; a filter on a missing value lists those as "unknown".

## 4. Add-ons and customising

- The "Not in the plan" list is the pick list: all researched records near the trip's bases (nearby-and-regions spec; Q60 keeps unresearched places out).
- Each candidate shows what it costs to add: duration, drive from the nearest base or day, the day it fits (open season, booking window), and its trade-off
  (a 6 h hike on a day that already holds 5 h).
- "Add to day N" and "Remove from plan" are planner actions (F06, F07). They write an operation (`trip.restore` undoes it), never the public data. A removed
  item moves back to "Not in the plan"; it is not lost.
- Customising by a visitor (their plan) is private household data and stays out of the public files.

Owner Q-TIM-1 (decided: yes): the **list** is public (it is the catalogue); **add and remove** need a plan.
catalogue), the **add and remove** need a plan.

## 5. Data to capture

What the inventory and the timing need, against what exists today. Each gap is a research or data task, not a UI task.

| Need | Today | Task |
|---|---|---|
| Trail distance, gain, time, surface, dogs, stroller | 1 of 118 trails has the required tier | D3a extended to all Rockies trails (not only the plan's days) |
| Season per record | `access_season` is required and mostly empty | D6a, then the Rockies pass for all 199 |
| Booking: needed or not, URL, window | offers only; trails and sights rarely | D4a, plus a "booking needed" answer on every sight (none_stated is a valid answer) |
| Parking and fee | `access_points`, `access_cost` required, mostly unanswered | DATA-LOC L2, trip lanes first |
| Timing windows with sources | none | new: section 2.3 research, then a schema entry |
| Duration | partly in schedule items (`durationMin`, `durationSource`) | copy to records where the schedule has it |
| Thumbnails | 118 trails without a photo (D5a) | section 6 |

Schema work (a builder step, `core/` change, registry first): `trip.timing` and the window fields of 2.2; a derived `inventory` view (counts per tab and per filter) in the adapter so
no page counts in the browser. Neon: `timing_window` as one table keyed by trip, the inventory as a view over capture records; no new free-text columns.

## 6. Thumbnails for every trail card

Every card has an image. Order:

1. A licensed photo (D5a, DATA-LOC L3 source order: Commons, Openverse, Flickr CC, Geograph, agency media), resized to a card rendition (a 400 px wide WebP, 4:3) in the same sequential rendition run.
2. If none is suitable: a **route thumbnail** drawn from our own stored OSM track (`data/tracks/`, ODbL, credited): the route line on a plain tile-less shape with the start marked. It carries no third-party image, has no licence problem and lets
   every trail with a track show a card image today. It is a `web/` or `tools/` build step.
3. If there is no track either: the kind icon and the words "No licensed photo yet" (the search date is in the data).

Cards never hot-link a third-party image: renditions are built from the stored file.

## 7. Steps and owners

| Step | Work | Owner kind | After |
|---|---|---|---|
| TIM-1 | Research the Rockies windows (2.3) to the capture contract; write `timing.windows` for it | Opus researcher | D6a |
| TIM-2 | Schema: `trip.timing`, computed `open_share`; adapter and OpenAPI | travel-builder (Opus: a shared contract) | TIM-1 shape agreed |
| INV-1 | Adapter: the inventory (tabs, counts, filters) from capture records and schedule refs | travel-builder | none |
| INV-2 | Trip page: the "When to go" block, the inventory tabs, the filter bar, the add-on list; design review, then verifier | travel-builder, design reviewer, verifier | INV-1, TIM-2 |
| INV-3 | Route thumbnails from `data/tracks` and the card rendition for photos | travel-builder | DATA-LOC L3 for photos |
| INV-4 | The other trips: the same pass, trip by trip, by research readiness | researcher | INV-2 |

## 8. Open decisions

- **Q-TIM-1** DECIDED 25 Oct (owner): yes. The add-on list is public; add and remove need a plan.
- **Q-TIM-2** DECIDED 25 Oct (owner: "fix it"): the trip card and page show one count that matches the data. The schedule holds 15 day sections (arrival and departure days included), so the card reads "15 days" with the arrival and departure days named, and the "14 days" wording is corrected wherever it appears. Day count is derived from the schedule, never typed.
- **Q-TIM-3** DECIDED 25 Oct (owner): show the verdict word (`best`, `good`, `trade-off`, `avoid`) on each window card, with the pros, cons and `open_share` under it. The word is marked as our judgement.
