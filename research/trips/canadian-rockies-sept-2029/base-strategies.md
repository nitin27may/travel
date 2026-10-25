# Rockies: where to base (strategy research, 25 Oct 2026)

Spec: `docs/v2/features/stay-bases-and-optimisation.md` sections 3.6 and 3.7 (PLAN R-112). The questions at the end are
now Q-BASE-1 there, Q114 (was Q-BASE-2) and Q113 (Q-BASE-3 folded in).

Question (owner, 25 Oct): would three bases (Jasper, Golden, Banff) cut check-ins and make the return to Calgary
easy? Is Canmore a cheaper option than Banff or Lake Louise village? What should the trip page say about it?

Public-safe: area-level only. No hotel names, no party, ages, home town, booking state or stay ideas. The older
private notes (`logistics-stays.md`, the legacy plan) were read for the shape of the question and are not a source.

## Method and marks

- **computed**: drive minutes from one call to the public OSRM `/table` (router.project-osrm.org, OSM road data),
  read 25 Oct 2026. Free-flow minutes, no stops, no traffic, no roadworks. Saved in `research/runs/rockies-bases-osrm-2026-10-25.json` and
  summarised below. OSRM is not in the source registry yet: register it as a source, or keep the values `computed`
  and say "typical, free-flow" on the page. Never present them as a posted time.
- Base points: GeoNames towns layer (`data/reference/towns/ca.json`) for Banff, Canmore, Golden, Jasper, Radium,
  Hinton, Valemount; Wikidata P625 for Lake Louise (Q12826048) and Kananaskis Village (Q6360620); OSM node 51970759
  for Field. Stop points are the D1 points in `data/capture/points.json` (many `approx`; a stop point moves a time
  by minutes, not by hours).
- **Day-trip drive** below is the round trip from a base to the main stop of each scheduled area, summed over the
  plan's 15 day sections (one per area day, two for Icefield and Kananaskis Lakes). It is a comparison number, not
  a promise of the day.

## Base to base (minutes, one way, computed)

| From | To | min |
|---|---|---|
| Calgary airport | Canmore | 94 |
| Calgary airport | Banff | 110 |
| Calgary airport | Lake Louise | 155 |
| Calgary airport | Golden | 221 |
| Calgary airport | Jasper | 364 |
| Canmore | Banff | 30 |
| Banff | Lake Louise | 54 |
| Lake Louise | Field (Yoho) | 27 |
| Lake Louise | Golden | 72 |
| Lake Louise | Jasper | 216 |
| Golden | Jasper | 278 |
| Jasper | Hinton | 69 |
| Jasper | Valemount | 104 |
| Kananaskis Village | Banff | 69 |
| Kananaskis Village | Canmore | 51 |

## Round trip from each base to the area of each plan day (minutes, computed)

| Area (plan day) | Canmore | Banff | Lake Louise | Field | Golden | Jasper |
|---|---|---|---|---|---|---|
| Banff town, gondola (d1-2) | 59 | 0 | 108 | 149 | 241 | 529 |
| Sunshine Meadows (d2) | 90 | 50 | 111 | 152 | 244 | 532 |
| Kootenay north, Bourgeau (d3) | 70 | 30 | 80 | 121 | 212 | 501 |
| Lake Louise lake (d10) | 158 | 118 | 19 | 63 | 155 | 443 |
| Moraine Lake (d11) | 189 | 150 | 50 | 95 | 186 | 475 |
| Emerald Lake, Yoho (d9) | 219 | 179 | 83 | 38 | 124 | 495 |
| Bow Lake, Parkway (d4) | 208 | 169 | 73 | 105 | 196 | 367 |
| Columbia Icefield (d4, d8) | 369 | 329 | 233 | 265 | 357 | 201 |
| Maligne Lake (d5) | 688 | 648 | 552 | 584 | 676 | 126 |
| Sulphur Skyline, Jasper (d7) | 694 | 654 | 559 | 590 | 682 | 132 |
| Kinney Lake, Robson (d6) | 707 | 668 | 572 | 604 | 696 | 154 |
| Ha Ling, Canmore (d12) | 42 | 92 | 181 | 222 | 313 | 602 |
| Rawson Lake, Kananaskis Lakes (d13) | 181 | 216 | 304 | 345 | 437 | 725 |

Reading it: Jasper is the only base for the north (Maligne, Skyline, Robson are 2 to 3 h each way from anywhere
else). Golden is 72 min from Lake Louise and about 124 min round trip from Emerald Lake, so it serves Yoho and
Kootenay, but it is **not on the Icefields Parkway**: 278 min to Jasper and 357 min round trip to the Icefield. Lake
Louise is the best single centre for Moraine, Louise, Yoho and the southern Parkway.

## Strategies compared (computed; same 15 day sections)

| Strategy | Check-ins | Base-to-base total | Longest transfer | Day-trip drive total | Worst day |
|---|---|---|---|---|---|
| S0 current plan: Banff 2, Lake Louise 1, Jasper 4, Lake Louise 4, Kananaskis Village 3 | 5 | 806 min | 218 | 23.6 h | 202 min (Icefield from Jasper) |
| S1 Jasper 5, Golden 4, Banff 5 (the owner's idea) | 3 | 876 | 364 | 33.0 h | 215 (Rawson from Banff) |
| S1c the same, Canmore in place of Banff | 3 | 876 | 364 | 35.0 h | 202 |
| S2 Banff 5, Jasper 5, Golden 4 | 3 | 875 | 279 | 33.0 h | 215 |
| S3 Jasper 5, Lake Louise 4, Banff 5 | 3 | 748 | 364 | 27.4 h | 215 |
| S3c the same, Canmore in place of Banff | 3 | 748 | 364 | 27.8 h | 202 |
| S4 Banff 5, Jasper 5, Lake Louise 4 (end at Lake Louise) | 3 | 747 | 263 | 27.4 h | 215 |
| S5 two bases: Jasper 5, Banff 9 | 2 | 742 | 364 | 33.9 h | 215 |
| S5c two bases: Jasper 5, Canmore 9 | 2 | 742 | 285 | 36.9 h | 219 |
| S6 Canmore 3, Jasper 5, Lake Louise 3, Canmore 3 | 4 | 762 | 284 | 27.8 h | 202 |

(Transfers include Calgary airport to the first base and the last base back to the airport. Nights are a split of
the 14 in each row, not a recommendation of a split.)

### What the numbers say

1. **Three bases is a good idea, but Golden is the wrong third base for this plan.** Golden adds 9 h of day-trip
   driving over the Lake Louise version (33.0 h against 27.4 h) because it sits off the Parkway and far from
   Moraine. It only wins if the plan is Yoho and Kootenay heavy, or if Lake Louise is full. Say so on the page.
2. **Jasper, Lake Louise, Banff (or Canmore) is the best 3-base shape**: 3 check-ins instead of 5, base-to-base
   drive 748 min instead of 806, day-trip driving 27 h instead of 24 h (3.8 h more over the trip, about 15 min a
   day). The cost of fewer check-ins is a little more driving, not a lot more.
3. **The Calgary leg decides the ends.** Calgary to Jasper is 364 min, a poor first day after a flight. Start
   south (Canmore 94 min or Banff 110), cross to Jasper mid-trip, and finish at Lake Louise (155 min) or Banff
   (110 min) or Canmore (94 min). S4 does this and has the shortest longest-transfer of the 3-base options (263
   min). The owner's idea of ending in Banff for an easy return is right: the three nearest bases to the airport
   are Canmore, Banff and Kananaskis Village (Village is 51 to 69 min from the other two, the far side).
4. **Canmore for Banff**: 16 min nearer the airport (94 against 110), 40 min more round trip to Lake Louise (158
   against 118), 40 min more to Moraine (189 against 150) and 50 min less to Ha Ling (42 against 92). In the 3-base
   shape (S3c against S3) it adds only 0.4 h of day-trip driving over the trip. Its case is price and fewer crowds,
   not distance, and the price gap is blog-only (see the facts table). Stay-set cards should say "Canmore is a
   cheaper, quieter base, about 30 min from Banff; the Lake Louise days get 40 min longer".
5. **The current plan (S0) is reasonable.** Five check-ins is the cost of a Kananaskis finish (Rawson, Ha Ling,
   Kananaskis Lakes) that no other base serves in under 3 h. If the owner wants fewer moves, drop the Kananaskis
   block or reach it as day trips from Canmore (Ha Ling 42 min round trip, Rawson Lake 181) and end in Canmore:
   S6 has 4 check-ins and the same 27.8 h.

## Facts needing a source (what was found, how sure)

| Claim | Found | Source and mark | Use on the page |
|---|---|---|---|
| Banff average daily rate 2025 was $453 at 70% occupancy (2024 $414, 2023 $380, 2022 $340, 2021 $257) | yes | Rocky Mountain Outlook, citing a Town of Banff report of 24 Mar 2026 (Banff and Lake Louise Hospitality Association data); official trade data via a news report | Shown as "average rate", dated, the year and source named |
| Canmore costs about 20 to 30% less than Banff | blog only | banffbound.com/canmore-vs-banff; beautifulcanmore.com (a local-tourism blog) | **Do not store as a number.** Say "usually cheaper than Banff; check the dates", marked low confidence, or leave out until a trade-data source is found |
| Lake Louise village rates | none | no official ADR found; Travel Alberta's hotel-performance page is a dashboard with no text | `searched_none`, 25 Oct 2026: tried Town of Banff report, Travel Alberta, trade news, two blogs |
| Canmore is outside Banff National Park, so no Parks Canada pass to stay there; Canmore Nordic Centre needs an Alberta Kananaskis Conservation Pass to park | yes, secondary | Alberta Parks Canmore Nordic Centre visitor guide; Beautiful Canmore passes page; a web search summary, 25 Oct | **Verify on parks.canada.ca and albertaparks.ca before storing**; the fact is useful (passes cover a day trip into Banff, not a night in Canmore) |
| Banff town and Lake Louise village parking: paid and limited; Sulphur Mountain paid pilot $17.50 a vehicle a day, 15 May to 12 Oct | partly | Parks Canada pilot notice, read 25 Oct | Per-stop facts belong on those places, not on the base card |
| Canmore parking | blogs disagree (one says free everywhere, one says little free parking) | two blogs | `none_stated` until a town page is read |
| Jasper accommodation after the 2024 fire: about 77% of the pre-fire commercial rooms are back, three large hotels due by spring 2027, and Hinton (69 min) and Valemount (104 min) are the fallback towns | reported | a web search summary of Jasper news pieces (CBC, Travel Weekly), 25 Oct; **secondary, not verified** | Say "Jasper has fewer rooms than before 2024; book early; Hinton and Valemount are the fallback" and nothing numeric until Tourism Jasper or Parks Canada is read |

## Open questions for the owner

1. **Q-BASE-1.** Is "easy Calgary return" a rule (the last base within 2 h of the airport) or a preference? The
   data shows Canmore, Banff and Kananaskis Village qualify; Lake Louise at 155 min does not.
2. **Q-BASE-2.** Does the Rockies page present the plan's own bases (S0) and offer 2 or 3 alternative "stay-set"
   cards, or replace S0 with a 3-base default? The spec assumes the first.
3. **Q-BASE-3.** May the page carry the Banff average rate as one dated line, or are all rates kept off the page
   (the "no stay ideas" rule can be read either way)? The spec assumes the line is allowed because it is trade data
   about an area, not a stay idea.

## Not verified

Roadworks, seasonal road closures (Icefields Parkway, Highway 93N, Trans-Canada construction), real peak traffic
into Banff, the 2029 rates, and every number marked secondary above.
