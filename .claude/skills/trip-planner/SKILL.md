---
name: trip-planner
description: Build a researched, publishable travel itinerary in this repo — parallel research fan-out, a PLAN.md, and an interactive single-file index.html with per-stop maps, trail links, and verified photos, deployed to nks-travel.pages.dev. Use for any new trip plan, or when revising/refining an existing one in ~/workspace/travel.
---

# Trip Planner (house format)

Every trip in this repo is **one folder** — `~/workspace/travel/legacy/<slug>/` — containing:

| File | Purpose |
|---|---|
| `index.html` | The deliverable. Self-contained interactive plan. Becomes `/<slug>/` on the live site. |
| `PLAN.md` | Same content as markdown, for reading in the terminal/editor and for future sessions to load cheaply. |
| `research/trips/<slug>/*.md` | Raw agent findings, one per research lane. Never delete — they justify decisions and prevent re-researching. |

`publish.sh` at the repo root deploys every folder at once. **Never create a Pages project per trip.**

## Rule zero: don't take the user's draft at face value

A rough itinerary is a starting hypothesis, not a spec. Research it and say plainly what changed and why. Real examples worth repeating:

- A "summit hike" whose summit is **forested with no view** (Mt. Pisgah) — the payoff was 0.4 mi past the top.
- An attraction the user assumed was closed/replaced (Stowe gondola) that was actually **operating**.
- Trailhead lots holding **9 cars** that fill by 9 AM, which dictates the entire day's ordering.
- Two different waterfalls **with the same name** an hour apart (Moss Glen Falls, Stowe vs Granville).

Lead the final response with what changed, not with a restatement of their plan.

## Phase 1 — research fan-out (always parallel)

Launch these as concurrent `Agent` calls in a single message. Tell each one its output is **raw data for another agent to synthesize, not a human-facing report**, and that every claim needs a source URL.

1. **Trails & hikes** — exact distance (mi AND km), elevation gain, difficulty, time, trailhead
   location, **parking capacity, cost and how early it fills**, AllTrails **and** an official
   source, recent closures/alerts, what you actually see at the top, season-specific notes,
   and **whether offline maps need a paid tier**. Flag any popular route that crosses a
   closed section — people download those and follow them into a barrier with no signal.
2. **Adventure & activities** — ziplines, via ferrata, paragliding, coasters, cable-car
   walkways, guided glacier or summit days. For each: **price in local currency, and the hard
   limits — minimum age, minimum height, weight range.** Those limits decide who in the group
   can actually do it, and they are the most commonly missing fact. Also capture **booking
   channel (advance vs same-day-only vs sells out), operating window, and the weather
   cancellation and refund terms.** Check whether an activity's own opening hours contradict
   the plan's weather strategy.
3. **Route & logistics** — 2–3 route options with distance/time/tolls, border crossings and
   wait-time links, documents, fuel-price arbitrage across jurisdictions, cell/roaming dead
   zones, **sunrise/sunset for the exact dates**, and drive times between every pair of stops.
4. **Attractions & hours** — operating dates/hours/prices, **verify anything the user assumed**,
   closures, reservation needs, groceries, restaurants with their day-of-week gotchas, crowd
   patterns by day and hour.
5. **Villages & where to stay** — for each candidate base: **elevation, whether it is car-free,
   how it is reached, and what it costs in tourist tax.** Then the things that decide whether a
   place is good to *stay* in rather than visit: **when it loses the sun** (a valley floor
   between high walls goes dark hours before sunset), overnight temperature — which matters
   because most alpine hotels have no air conditioning — day-tripper churn versus evening
   quiet, last transport up, and where the nearest real supermarket is. Name the trade honestly:
   the famous village is often the wrong one to sleep in.
6. **Seasonal timing & photography** — when the thing they came for actually peaks by
   sub-region, live-condition sources, photo spots with galleries, and **which spots want
   sunrise vs sunset vs overcast**. Compute **sun azimuth and elevation for the actual dates**,
   not generic golden-hour advice — it reveals alignments worth planning around (a street the
   sun sets straight down; a subject front-lit at the exact hour everyone else faces the glare)
   and it tells you when a deep gorge or north face is actually lit.

Adapt the lanes to the trip (ski, city, coastal), but keep the shape: **capability, adventure,
logistics, hours, where to stay, timing/light.** A city trip swaps trails for neighbourhoods and
via ferrata for tours, but still needs the age/price/booking limits and still needs to answer
"which district should we actually sleep in, and why."

**Record gaps as gaps.** Write `GAP:` against anything unverified rather than filling it with a
plausible number, and say which source failed. Later sessions close them; invented figures never
get caught. When a gap is later closed, mark it `GAP CLOSED <date>` with the source, and if the
new fact contradicts the old note, say so in the file — a silent correction is how a wrong number
survives into the plan.

## Phase 2 — schedule a conditions re-check

If the trip is more than ~a week out and depends on conditions (foliage, snow, wildlife, weather), create a **one-time cloud routine** via the `schedule` skill for ~2 days before departure. It must email a structured report ending in **one named verdict** — e.g. "Option A keep / B swap days / C use the backup route" — not a pile of observations. Put the TLDR at the top of the email.

## Phase 3 — write PLAN.md, then index.html

Order the day by **constraints, not by the map**: earliest-filling parking first, then light quality, then crowd windows, then driving efficiency. State a decision rule wherever weather or timing could flip a choice.

### The opening — orient before you schedule (mandatory)

**Every plan opens with an orientation section, between the hero and Day 1.** Write it for
someone who has never been and cannot picture the place. A plan that starts at "Day 1,
08:00" assumes knowledge the reader does not have.

It must answer, in this order:

1. **What this place physically is.** The geology or geography in two or three sentences —
   why it looks the way it does. *The Dolomites are fossilised coral reef pushed vertical;
   Vermont is a worn-down 400-million-year-old range, which is why it rounds rather than
   spikes.* This is the single most useful paragraph on the page and it is the one most
   plans skip.
2. **Why it is famous — the specific thing.** Name it. "Stunning scenery" is not an answer;
   *enrosadira*, the alpenglow that fires pink on dolomitic limestone because of its
   magnesium content, is. If a place is famous for one photograph, say which one and where
   it is taken from.
3. **What you cannot get anywhere else.** The honest differentiator, including the cultural
   one where it exists — Ladin language and Tyrolean-Italian food in the Dolomites, the
   Ladin *viles*, the WWI front line running through the hiking trails.
4. **The sub-regions, as a card grid with a photo each.** Two to five named areas the trip
   covers, each with one line on what it is *for* and which days cover it. This is how the
   reader builds a mental map before the days start, and it is what makes a 14-day plan
   legible instead of a wall.
5. **The trip in numbers.** A short mono stat strip: nights, bases, distance driven,
   highest point, longest hike, total ascent.
6. **What to know before reading the days.** Three to six blunt points — the access-booking
   culture, the afternoon storm cycle, what the language situation actually is, the cash
   problem at huts. Things that change how the reader interprets every day that follows.

**Photos here are wide and establishing**, not the per-stop shots — the range from a
distance, a valley, a town. Reuse from the day cards only if you must.

**Do not write brochure copy.** Every claim in the intro must survive the research files.
If the intro says a place is "unspoilt", something in `research/trips/<slug>/*.md` has to support it.

### The HTML deliverable

Single self-contained file. **No build step for the reader, no external JS** — these pages get
opened at a trailhead on a phone with no signal. That constraint is not negotiable.

**Build it through `legacy/_system/`, not by hand.** See `legacy/_system/README.md`.

```bash
python3 legacy/_system/build.py --check       # gates: no stray colour, tokens defined, WCAG AA, comments
python3 legacy/_system/build.py --gallery     # every theme side by side, same markup
```

**Colour and typography live only in `legacy/_system/themes/*.css`.** Tokens are named for what they
*do* — `--accent`, `--header`, `--warn`, `--class-1…6`, `--font-display` — never for a colour or a
place. Naming them `--spruce` or `--swiss` is exactly what made the first five pages
un-reskinnable. Pick a theme per trip (`forest`, `maritime`, `alpenglow`, `alpine-snow`, `autumn`,
`coastal`, `desert`, `urban`) or add one; the contrast gate will reject it if it fails WCAG AA.

**The classifier encodes something true.** One component, `.mark.mark--N`. Each trip declares its
own vocabulary — `trail/road/town/food` for Niagara, `book/dawn/high/shut` for the Dolomites — and
the legend renders from that declaration. Do not ship generic `01 / 02 / 03` numbering unless the
sequence itself carries meaning.

**Every stop is a card containing, without exception:**
- A time chip (and an `opt` variant for optional stops)
- Title, with a tag for `added` items the user didn't ask for
- Two or three sentences that say **why this stop, at this hour** — not a brochure blurb
- Mono stat row: distance, gain, duration, parking capacity
- Buttons: **Map (always)**, plus AllTrails/official/gallery where they exist
- A photo (see below)
- A collapsed `<details>` for fine print — trail hazards, alternatives, decision rules

**Also include:** a hero with the trip's most characteristic image, the orientation section above,
sticky day nav with scrollspy, an embedded Google map per day, a live countdown, a `localStorage`
checklist, a **day-of links block** (the handful of things actually tapped in the field: closures
page, weather, offline maps, parking map, `tel:` numbers), an A/B plan toggle when there's a real
backup itinerary, `scroll-margin-top` on sections, a print stylesheet, and `prefers-reduced-motion`
respected.

**Behaviour comes from `legacy/_system/base.js`** — countdown, checklist, scrollspy, plan toggle. Do not
write per-page script. Two markup conventions are supported: `#countdown` (script writes the whole
phrase, so it must have **no sibling text**) or `#cd` (number only, markup supplies the label);
checkboxes as `#checklist input[data-k]` or `[data-ck]`.

### Links — the conventions

- **Per stop:** `https://maps.google.com/?q=<Place Name>,+<Town>,+<State>`
- **Multi-stop day loop:** `https://www.google.com/maps/dir/A/B/C/A/` with real place names, in visiting order.
- **Force a specific route** (e.g. a quieter border crossing) by inserting a waypoint the router would otherwise skip.
- **Embedded map:** `https://maps.google.com/maps?q=<Place>&z=11&output=embed` in an iframe.
- **Trails:** AllTrails **and** an official source. Never AllTrails alone — its distances vary from official figures; when sources disagree, report the range.

### Photos — verify before embedding

Use **Wikimedia Commons** (stable, licensed, hotlinkable):

```bash
# 1. search
curl -s -A "Mozilla/5.0" "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=<QUERY>&srnamespace=6&srlimit=6&format=json"
# 2. ALWAYS verify the URL resolves before putting it in the page
curl -s -A "Mozilla/5.0" -o /dev/null -w "%{http_code}" -IL \
  "https://commons.wikimedia.org/wiki/Special:FilePath/<URL-encoded filename>?width=1200"
# 3. GPS/date of a photo (useful: "this was taken on your exact dates")
curl -s ".../api.php?action=query&titles=File:<name>&prop=imageinfo|coordinates&iiprop=extmetadata&format=json"
```

Embed as `Special:FilePath/<encoded>?width=900`, always with a `<figcaption>` linking the Commons file page. A user agent is required — the API 403s without one. Searches also return unrelated PDFs/books; filter to real photos of the actual place.

**Every stop gets an image, including drive legs** — highways, border crossings, and the base town all have usable photos, and the user will ask for them if you skip them.

### Photo gallery — every trip gets one (mandatory)

A gallery section sits right after the orientation section so the reader sees where they are going
before the days start. It is **data, not hand-written HTML**: `legacy/<trip>/gallery/gallery.json` plus
`tools/gallery/gallery.py`.

```bash
python3 tools/gallery/gallery.py verify legacy/<trip>/gallery/gallery.json            # Commons metadata, licence, >=1600 px landscape, hotlink 200
python3 tools/gallery/gallery.py sheet  legacy/<trip>/gallery/gallery.json /tmp/s.jpg  # contact sheet: LOOK at it before injecting
python3 tools/gallery/gallery.py inject legacy/<trip>/gallery/gallery.json legacy/<trip>/index.html   # idempotent; also adds a "photos" nav link
```

- **Cheapest model for the finding.** Photo search, metadata checks and thumbnail viewing are
  mechanical: run one Haiku agent per trip (`model: "haiku"`), about 3 photos per place and 6-9
  places, and have it write `gallery.json` (schema in `tools/gallery/gallery.py`). Opus plans the
  place list; do not spend a bigger model on the search.
- **Always eyeball the contact sheet** after the agent finishes. Cheap models pass a photo of the
  wrong valley or a watermark. Fix by swapping the filename in the json, not the page.
- **Never run Commons searches from parallel agents.** One shared IP, so four agents at once trip a 429 "too many requests" that lasted 25+ minutes and killed the run (2026-10-12). One agent, one request at a time, a couple of seconds apart; probe `action=query&meta=siteinfo` before starting.
- Commons only, credited with author and licence, linked to the file page. Reject watermarks,
  winter scenes on a summer trip, people in the foreground, grey weather.
- Trips built by `build_page.py` must call `gallery.py inject` at the end of the build, because a
  rebuild overwrites the injected section.

## Phase 4 — screenshot and self-review before delivering

Never hand over an unrendered page.

```bash
# fixed-height hero copy so the full-page shot isn't distorted by vh units
sed 's/min-height:78vh/min-height:640px/; s/scroll-behavior:smooth/scroll-behavior:auto/' index.html > /tmp/shot.html
google-chrome --headless=new --disable-gpu --window-size=1440,14000 \
  --screenshot=/tmp/all.png --hide-scrollbars --virtual-time-budget=25000 file:///tmp/shot.html
# then crop into readable slices with PIL and Read them
```

Anchor URLs (`#day2`) don't work reliably in headless — screenshot the whole page and crop. Real defects caught this way: a **watermarked** photo, a photo of the **wrong subject**, a scaled image **bleeding outside its card** (needs `overflow:hidden` on the figure), and sticky-nav overlap.

## Phase 5 — publish

```bash
cd ~/workspace/travel && ./publish.sh          # deploys ALL trips; hub page regenerates itself
```

Live at `https://nks-travel.pages.dev/<slug>/`. The hub scrapes each page's `<title>` and `.sub` text, so write both as real user-facing copy.

**Cloudflare auth on nks-ubuntu:** use `npx wrangler login --device`. The default localhost:8976 callback **fails here** — Nitin approves on his phone, and the phone's localhost isn't the desktop's (plus a CSRF cookie error). `--use-keyring` needs `libsecret-tools`, not installed.

For a quick temporary preview instead of publishing: `python3 -m http.server <port> --bind 127.0.0.1` plus `cloudflared tunnel --url http://127.0.0.1:<port>`, and **stop both when done**.

## Writing style

Follow the global rules — direct, no emojis, no "delve/leverage/unlock". Specific to trips:

- Give **times, distances, and capacities**, never "arrive early" alone: "the lot holds ~9 cars and fills before 9."
- Flag the physical-risk items plainly — wet rock, exposed ledges, cold summits.
- Note **hours gotchas as a table**; restaurants closed on the one night you need them is a trip-ruining detail.
- Mark anything you added that the user didn't ask for, so they can veto it.
- End with the honest state: what's verified, what still needs confirming closer to the date.
