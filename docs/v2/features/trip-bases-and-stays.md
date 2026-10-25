# Trip bases and stay-sets: where to sleep, and how to show it (R-70)

Status: spec, 25 Oct 2026. Owner request: for the Rockies, should the trip use three bases (Jasper, Golden, Banff) so
the return to Calgary is easy? Offer Canmore as a cheaper alternative to Banff and Lake Louise village. Show readers
they can explore more stay options and cut check-ins and check-outs, and decide how the trip details page shows it.
Findings: `research/trips/canadian-rockies-sept-2029/base-strategies.md` (computed drive times, 10 strategies,
source marks, open questions). Builds on `trip-overview-and-customisation.md` section 3 (the Stays tab shows "bases
and nights only") and the schedule's `bases`.

## 1. What the research found (summary)

- Three bases is right; **Jasper, Lake Louise and Banff (or Canmore)** beats the owner's Jasper, Golden, Banff:
  27.4 h of day-trip driving against 33.0 h, and base-to-base 748 min against 876. Golden is off the Icefields
  Parkway (278 min to Jasper) and only suits Yoho and Kootenay.
- Fewer check-ins costs little: 3 check-ins instead of 5 adds about 15 minutes a day of day-trip driving.
- The Calgary return decides the ends: start south (Canmore 94 min, Banff 110), cross to Jasper mid-trip (Calgary to
  Jasper is 364 min, a poor first day), end at Lake Louise (155), Banff (110) or Canmore (94).
- Canmore for Banff: nearer Calgary, 40 min more round trip to Lake Louise and Moraine, cheaper by an amount that
  only blogs state (no number stored).
- Jasper has fewer rooms since 2024; Hinton (69 min) and Valemount (104 min) are the fallbacks (secondary source;
  verify before stating a number).

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| B1 | A trip's **plan bases** (the schedule's `bases`) stay the truth for "the plan"; **stay-sets** are a new, separate list of alternatives, each a set of bases with nights | The plan page must not change when a reader browses alternatives; the alternatives are researched, the plan is authored |
| B2 | A stay-set is **area-level only**: base town, nights, check-in count, transfer drives, sourced pros and cons. **No hotel, no brand, no price quote, no booking state** | Privacy rule (no stay ideas); area facts are public-safe |
| B3 | Drive times are **computed** (OSRM, free-flow) and labelled "typical drive, no stops" with the read date; a later ORS value replaces them | One method, honest marks; the timeline's D10 already prefers ORS |
| B4 | A price appears only as **one dated, sourced line about an area** (Banff 2025 average daily rate, trade data) and only if the owner agrees (Q-BASE-3). A blog percentage is never shown as a figure | Sourcing rule; blog numbers disagree |
| B5 | The alternatives show the **trade-off in minutes and nights**, not "best". One card is tagged "Plan" | P8 honest labels; the reader decides |
| B6 | Each base carries a **reach table** (round trip minutes to each place that the plan or scope uses) so "Where to base" and the overview's Base filter (3.3) share one data source | The overview already filters by base; same field, no second computation |

## 3. Data shape

New file per trip, `data/stays/<trip>.json` (spec `trip-stays/1`; the researcher writes it, a core op validates it, it
maps to Neon table `trip_stay_sets` and `trip_base_reach`).

```json
{
  "spec": "trip-stays/1",
  "trip": "canadian-rockies-2029",
  "read": "2026-10-25",
  "method": {"drive": "computed", "tool": "osrm", "note": "free-flow minutes, no stops"},
  "bases": {
    "canmore": {"name": "Canmore", "point": "ref", "area": "Bow Valley, outside Banff National Park", "src": ["id"]},
    "lake-louise": {"name": "Lake Louise village", "point": "ref", "src": ["id"]}
  },
  "reach": [{"base": "lake-louise", "to": "ref", "round_trip_min": 118, "mark": "computed"}],
  "sets": [
    {
      "id": "plan", "is_plan": true,
      "blocks": [{"base": "banff", "nights": 2}, {"base": "lake-louise", "nights": 1}],
      "check_ins": 5, "transfer_min": [110, 54], "longest_transfer_min": 218,
      "day_drive_h": 23.6,
      "pros": [{"text": "...", "src": ["id"]}], "cons": [{"text": "...", "src": ["id"]}]
    }
  ],
  "alternatives_by_area": [
    {"replaces": "banff", "with": "canmore", "pros": [], "cons": [], "price": {"kind": "none_stated"}}
  ],
  "gaps": [{"field": "price.canmore", "searched_none": "2026-10-25", "tried": "Town of Banff report, Travel Alberta, trade news, two blogs"}]
}
```

Rules: every `pros` and `cons` line has a `src` that resolves in the registry or is `computed`; `reach` and
`transfer_min` are derived, never typed; a `searched_none` gap is allowed and shown as "no source yet"; `check_ins`
is the number of blocks (a validator checks it); a block's nights sum to the trip nights; base ids are the schedule's
where they exist.

## 4. How the trip details page shows it

Placement: the **Stays** tab of the overview (spec trip-overview section 3.2) becomes **Where to base**, and a
compact line sits in the trip header ("5 check-ins, 4 places"). Nothing opens as a modal (P5).

**At rest (server-rendered, P3):** the plan's bases as a strip: place, nights, a drive-to-next chip between them, and
the totals ("5 check-ins, longest drive 3 h 38 min, airport to first base 1 h 50 min"). Below it one sentence:
"You can sleep in fewer places. See 2 other ways." Link opens the alternatives.

**Alternatives (below the strip, cards in a row, stacked on a phone):** each card is one stay-set:

```
Plan             3 bases           3 check-ins     Drive: 12 h 28 min between bases
Jasper 5 · Lake Louise 4 · Banff 5      Day trips about 27 h in all (plan: 24 h)
+ 2 fewer moves, easy last day (Banff 1 h 50 min from the airport)
- Jasper first leg is 6 h; Icefield is a short day from Jasper only
[ See on the map ]  [ Use these bases ]  (signed in: copy and customise, R-65)
```

- The plan card is tagged **Plan**; others carry no star. A set with a warning (Golden: "off the Icefields Parkway")
  shows it as a minus, never hidden.
- Numbers: check-ins, longest drive, day-trip drive, each as a plain count with its mark (≈ for computed).
- **Area swap note** under the cards: "Canmore instead of Banff: 16 min nearer the airport, Lake Louise days 40 min
  longer, usually cheaper (check dates)". Each fact has an info link to its source row (P4).
- **Map:** the strip's bases on the trip map with the day-trip reach as a ring; selecting a card re-tints days by the
  base that serves them best ("Day 5 is from Jasper").
- **Overview tie-in:** the overview's Base filter lists the plan's bases by default and the alternative's bases when
  a card is selected (3.3). The per-item "Base" column then reads the selected set.
- **Customise (R-65):** "Use these bases" in a copy re-assigns days to bases and updates the day's leave-base start;
  the public page is unchanged.
- **States:** no `data/stays` file → the strip only (as today), no alternatives; a `searched_none` price → no price
  line; a stay-set with a conflicting source → shows both and marks the card "sources differ".
- **A11y and phone:** cards are a list with the plan first; each is one focus stop with the stats read in order; on
  a phone the cards scroll as a vertical stack, no horizontal carousel.

## 5. Where the work goes

| Step | Owner | Content |
|---|---|---|
| ST-1 | researcher (Opus) | Verify the Parks Canada and Alberta Parks pass facts, Jasper capacity from Tourism Jasper or Parks Canada, a Canmore parking page, an official source for Canmore and Lake Louise rates or `searched_none`; register OSRM as a source; write `data/stays/canadian-rockies-2029.json` from `base-strategies.md` |
| ST-2 | builder (Sonnet; shared contract so Opus for the schema) | Schema `trip-stays/1`, validator, op, Neon mapping, adapter, "Where to base" strip and cards; the Stays tab rename |
| ST-3 | design reviewer, then verifier | Review the card, strip and map states, light and dark, phone |
| ST-4 | researcher | Repeat for the other trips with more than 2 bases (Dolomites, Switzerland, Norway, Iceland) once the Rockies shape ships |

## 6. Open owner questions

- **Q-BASE-1** Is an easy Calgary return a rule (last base within 2 h of the airport) or a preference?
- **Q-BASE-2** Show the plan's bases with 2 or 3 alternative cards (assumed), or replace the plan with a 3-base default?
- **Q-BASE-3** May a dated area-level average rate appear, or are rates kept off the page?

## 7. Gotchas

- Golden to Jasper is 278 min and Golden is off the Icefields Parkway; a 3-base plan that includes Golden costs 5.6 h
  more day-trip driving than one with Lake Louise.
- Calgary to Jasper is 364 min: never put Jasper first without saying so.
- Computed minutes are free-flow; the 2029 summer roads, closures and traffic are not known.
- Canmore parking and Canmore and Lake Louise prices are not sourced; show nothing numeric for them.
- The private notes (`logistics-stays.md`, the legacy plan) hold household details; never copy them into `data/stays`.
