# Norway — timing, light and crowds

Researched 2026-08-31. **Year fixed: summer 2028.** Exact dates still open.
All sun and midnight-sun figures below are computed for **2028** (`sun-times.py`, reproducible).

**GAP CLOSED 2026-08-31 — and it reverses the earlier recommendation.** The first pass
defaulted to a late-July window using 2026's *fellesferie* dates. Computed for 2028,
*fellesferie* (ISO weeks 28–30) falls **10–30 July**, a full week later than 2026's 6–24 July.
That makes **late June 2028 both pre-crowd and inside the midnight sun** — a combination
2026 did not offer. See below.

---

## The two candidate windows for 2028

| | **Window A — ~24 Jun to 8 Jul 2028** ← recommended | **Window B — ~29 Jul to 12 Aug 2028** |
|---|---|---|
| Midnight sun, Svolvær / Reine | **Yes — full, both** | No (ends 18 Jul / 16 Jul) |
| Midnight sun, Tromsø / Senja | **Yes** | No (ends 25 Jul / 24 Jul) |
| Norwegian *fellesferie* (10–30 Jul 2028) | **Entirely before it** | Entirely after it |
| High-route snow | Lingering above ~1,400 m | Gone |
| Wildflowers | Peak | Over |
| Rain odds | Lower | Slightly higher |
| Prices | High | Highest |

**Recommendation for 2028: Window A.** The 2028 calendar makes it the clear winner, and
this is a year-specific answer, not a general one:

1. ***Fellesferie* starts 10 July in 2028**, so the whole of late June is ahead of the
   Norwegian domestic surge. In 2026 it started 6 July and this window did not exist.
2. **Full midnight sun everywhere in the Arctic half.** Svolvær runs 25 May – 18 July,
   Reine 27 May – 16 July, Senja 19 May – 24 July, Tromsø 18 May – 25 July.
3. **The usual objection to late June does not apply to this itinerary.** The snow
   argument is about high inland ridges — Besseggen, Trolltunga, Galdhøpiggen — and none
   of them are in the plan. What *is* in the plan opens earlier: the Romsdalseggen bus
   runs from **12 June**, the Nibbevegen up Dalsnibba opens **mid-to-late May**, and the
   Loen and Nigardsbreen operations run from spring.

**Take Window B instead only if** someone in the group cannot sleep in continuous daylight,
or if a high inland ridge (Besseggen, Trolltunga) gets added to the plan later — either
would flip the answer.

`GAP:` official 2028 *fellesferie* dates are not published this far out. The 10–30 July
figure is ISO weeks 28–30 computed for 2028, which is the convention every year — but
confirm against a Norwegian source once 2028 calendars appear.

## Midnight sun, computed for 2028

| Place | Sun never sets | Days |
|---|---|---|
| **Tromsø** | 18 May – 25 July | 69 |
| **Senja (Fjordgård)** | 19 May – 24 July | 67 |
| **Svolvær** | 25 May – 18 July | 55 |
| **Reine** | 27 May – 16 July | 51 |
| **Bodø** | 31 May – 12 July | 43 |

Note the spread: **Reine loses the midnight sun nine days before Tromsø does.** A window
that ends 8 July clears all five with a margin; a window centred on 18 July catches Tromsø
and Senja but not Lofoten.

## Fellesferie — the crowd fact that most itineraries miss

Norway effectively shuts down for three weeks in July. It is **ISO weeks 28–30** every
year, which computes to **10–30 July in 2028** (against 6–24 July in 2026). Companies close
or run skeleton staff, schools are out mid-June to mid-August, and Norwegians themselves
fill the fjord towns, cabins and ferries. Peak pressure lands on those three weeks.

**This one week of drift is the whole reason Window A wins in 2028 and did not in 2026.**

## Light — computed for 2028, not quoted

Sunrise / sunset, local time, CEST. Computed with the NOAA solar algorithm
(`sun-times.py`, reproducible). "No true night" = civil twilight never ends.

| | 24 Jun | 1 Jul | 8 Jul | 18 Jul | 29 Jul | 12 Aug |
|---|---|---|---|---|---|---|
| | ← Window A → | | | | ← Window B → | |
| **Bergen** | 04:53–23:54 | 04:59–23:51 | 05:09–23:44 | 05:27–23:27 | 05:53–23:03 | 06:27–22:26 |
| **Flåm / Aurland** | 04:54–00:07 | 05:00–00:04 | 05:10–23:56 | 05:30–23:39 | 05:56–23:14 | 06:31–22:36 |
| **Loen / Stryn** | 04:39–00:20 | 04:46–00:16 | 04:57–00:08 | 05:19–23:48 | 05:47–23:21 | 06:25–22:41 |
| **Åndalsnes** | 04:32–00:34 | 04:39–00:30 | 04:51–00:20 | 05:14–00:00 | 05:44–23:31 | 06:24–22:48 |
| **Ålesund** | 04:27–00:27 | 04:34–00:22 | 04:46–00:13 | 05:09–23:52 | 05:39–23:23 | 06:18–22:42 |
| **Reine, Lofoten** | midnight sun | midnight sun | midnight sun | 03:34–02:24 | 04:54–01:04 | 06:01–23:54 |
| **Svolvær** | midnight sun | midnight sun | midnight sun | midnight sun | 04:54–01:16 | 06:03–00:04 |
| **Senja (Fjordgård)** | midnight sun | midnight sun | midnight sun | midnight sun | 04:32–02:02 | 06:00–00:31 |
| **Tromsø** | midnight sun | midnight sun | midnight sun | midnight sun | 04:30–02:15 | 06:03–00:39 |

**Three things this table tells you that a guidebook will not:**

1. **North of Åndalsnes there is no true night at all in June and early July.** Civil
   twilight never ends. You can hike, drive and shoot at 01:00 in usable light on the
   whole west coast, not just in the Arctic. This is the single biggest scheduling lever
   in a Norwegian summer — the day is 20 hours long and the crowds occupy six of them.
2. **Golden hour is enormous and lands at antisocial times.** In Lofoten on 29 July the
   sun sets at 01:04 and rises at 04:54, and in Window A it does not set at all — it just
   tracks the horizon at a shallow angle all night. The light everyone photographs Reine in is a **22:00–01:00** light,
   not an 18:00 one.
3. **Even on 12 August Lofoten has no astronomical darkness** (civil dusk 01:41, civil
   dawn 04:14). Northern lights are not on the table for any summer trip in either window.
   Do not let anyone sell you a summer aurora tour.

## Weather, honestly

| Region | July / August reality |
|---|---|
| **Bergen & the outer coast** | ~110 mm rain in July; **15–20 rain days a month** in summer; 53–66% of summer days see some rain. 13–19°C. Bergen is one of the wettest cities in Europe and the trip must be built to absorb that. |
| **Inner fjords (Flåm, Loen, Geiranger)** | Materially drier than Bergen — the coastal ranges wring the weather out. |
| **Inland east (Jotunheimen, Oslo)** | Driest and warmest, 15–25°C. |
| **Lofoten** | ~9 rain days/month Jun–Jul, 11 in Aug. 10–18°C. **Drier than Bergen**, which surprises people. Wind is the bigger factor than rain. |

**Planning consequence:** put the weather-dependent set pieces (Romsdalseggen,
Reinebringen, Trolltunga, any via ferrata) in the inner fjords and the north, and treat
Bergen as the flexible, indoor-capable bookend. Do not schedule your one big ridge hike
for a Bergen day.

## Insects

Coast and towns: few mosquitoes, June through August. Wind and cool sea air keep them
down. **Inland and boggy ground is a different story** — Finnmarksvidda and inland
valleys peak July–August, and *knott* (midges) are worse than mosquitoes in some
valleys. Nothing here carries disease. A head net costs nothing and is worth carrying
for any inland lakeside camp or a Jotunheimen approach.

## Cruise ships — the crowd pattern that decides your hours

Geiranger, Flåm, Ålesund and Bergen are heavy cruise ports. Ships berth mid-morning
and leave late afternoon, and the entire tour-bus system fires between them. Local
advice is consistent and blunt: be at Flydalsjuvet and Dalsnibba **early morning or after
18:00–19:00**, because the lots are small and fill instantly in high season.

`GAP:` Geiranger's per-day cruise call list for the target year — cruisetimetables.com and
cruisedig.com publish it 1–2 years ahead. Pull the actual dates once the window is fixed
and shift the Geiranger night to a zero-ship or one-ship day if possible. That single
check is worth more than any other crowd tactic on this trip.

## Sources

- https://www.thelocal.no/20260629/key-points-everything-that-changes-about-life-in-norway-in-july-2026
- https://workingwithnorwegians.com/fellesferie-norway-summer-shutdown
- https://guidetolofoten.com/midnight-sun-in-lofoten/
- https://arcticnorwaytours.com/en-us/midnight-sun-norway/
- https://www.weather-atlas.com/en/norway-weather-july
- https://www.lofoteninsight.com/blog/weather-and-seasons-in-lofoten-norway-your-ultimate-guide
- https://www.climatestotravel.com/climate/norway
- https://www.tripadvisor.com/ShowTopic-g190455-i550-k13829677-Are_Mosquitoes_a_problem_in_July_and_August-Norway.html
- https://www.cruisetimetables.com/geiranger-norway-cruise-ship-schedule-2026.html
- https://norwegianroutes.com/geiranger/
