# DATA-D7R: Rockies best-time windows (run note, 25 Oct 2026)

Batch D7-R of the DATA brief (`docs/v2/build/public-site/briefs/DATA.md` step 13; overview spec
`docs/v2/features/trip-overview-and-customisation.md` sections 2.2 to 2.5). Trip `canadian-rockies-2029`, research folder
`canadian-rockies-sept-2029`. Agent `travel-researcher`, model **Opus**. Branch `public/DATA-D7R`, worktree
`v2-DATA-D7R`, from `main` at f2dee4b.

Output: `data/windows/canadian-rockies-2029.json` (`trip-windows/1`, never `data/seasons/`, decision DD-1).

## Result

| Window | Start rule | Sun pair | Verdict | Crowd | Plus / minus / events / affects / unknown |
|---|---|---|---|---|---|
| `sep-w2` (default, the plan's own) | second week of September | [9, 8] to [9, 22], equals `data/schedules/canadian-rockies-2029.json` | best | lower | 4 / 4 / 1 / 1 / 7 |
| `sep-w1` | first week of September | [9, 1] to [9, 15] | good | high | 4 / 4 / 2 / 0 / 6 |
| `jun-last` | last week of June | [6, 24] to [7, 8] | good | rising | 4 / 4 / 3 / 6 / 8 |
| `jun-w2` | second week of June | [6, 8] to [6, 22] | workable | lower | 4 / 4 / 1 / 11 / 9 |

`sun.from` is the first day of the start week (week 2 starts on day 8, "last" on the last seven days); `sun.to` is 14
days later, so every pair spans the 15 plan days. Starts are 7, 9 and 77 days apart (no `W_WIN_CLOSE`).

Why the second week of June and not the third: it is the most distinct of the June candidates (before schools finish,
before Canada Day, earliest snow and road edges), and the third week overlaps the last-week window by most of its days.
The third week would sit between the two and add little (spec 2.3 step 4, drop a candidate that adds nothing new).

## Findings (prose; the brief names `timing-windows.md` (in the Rockies research folder, not yet created) for this, see DECISIONS NEEDED)

### Access seasons that decide the windows

| Item (plan day) | Season found | Source (read 25 Oct 2026) | Windows hit |
|---|---|---|---|
| Sunshine Meadows gondola (day 2, `trails/sunshine-meadows-citadel-pass`) | 2026: summer operations 6 Jul to 20 Sep, gondola 08:00-18:00; 2025: 27 Jun to 21 Sep. Both closing days are the third Sunday of September. 2026 also had summer skiing 20 Jun to 5 Jul (CTV, not used as a value) | skibanff.com summer hours page (operator); Banff Sunshine 2025 press release on newswire.com | closed in `jun-w2` and `jun-last`; open on day 2 of both September windows |
| Moraine Lake Road and shuttles (day 11) | Moraine Lake shuttle and Lake Connector 1 Jun to 12 Oct 2026; Lakeshore shuttle 15 May to 12 Oct; road closed to personal vehicles year-round | parks.canada.ca/lakelouise-transit | open in all four |
| Moraine Lake canoe dock (day 11, `adventures/moraine-lake-canoe`) | mid-June to mid-September "due to water levels"; first come, first served | morainelake.com/day-visits (Moraine Lake Lodge) | uncertain in `jun-w2` (opening edge) and `sep-w2` (closing edge) |
| Yoho Valley Road, Takakkaw Falls (day 9) | open seasonally mid-June to mid-October, weather permitting | Parks Canada Yoho hours page (modified 2026-09-29) | uncertain in `jun-w2` |
| Highwood Pass, Hwy 40 (day 14) | closed 1 Dec to 14 Jun | Alberta Parks annual road closures (updated 2026-10-02). Confirms the earlier unverified "1 Dec to 15 Jun" in `timing-hazards.md`, sharpened: closed through 14 Jun, so it reopens on 15 Jun | open in all four |
| Bow Valley Parkway east end to Johnston Canyon (day 3) | personal vehicles restricted 30 Apr to 25 Jun 2026; Johnston Canyon reachable by car via Castle Junction; bulletin does not say it recurs | Parks Canada bulletin 0fb4c673 | limited in `jun-w2` |
| High passes (days 4, 8, 9, 11) | Banff: "Until late June, many passes are still snow-bound and may be subject to avalanche hazard"; "By the middle of July, most alpine passes are snow-free"; prime hiking season July to mid-September. Yoho (O'Hara page): higher routes snow-bound until late June | Parks Canada Banff hiking page (modified 2026-10-13); Lake O'Hara visit page (modified 2026-02-27) | uncertain in both June windows (Larch Valley, Iceline by source; Wilcox Pass and Parker Ridge by inference) |
| Lake Minnewanka cruise (day 2) | 2027: Classic Cruise 7 May to 11 Oct; Junior Explorer cruise 26 Jun to 6 Sep (Labour Day 2027) | Pursuit location and hours page | open in all four; Junior Explorer only in `sep-w1` and the end of `jun-last` |
| Maligne Lake cruise (day 5) | 2027: 28 May to 10 Oct | Pursuit location and hours page | open in all four |
| Columbia Icefield Adventure (days 4, 8) | 2027: 1 May to 11 Oct, weather dependent | Pursuit page (read; not cited in the file because no window turns on it) | open in all four |
| Jasper dark sky (day 7) | no astronomical night at Jasper in either June window; 6 h 17 min to 7 h 06 min of darkness on the September Jasper days | `core/bin/sun.ts` (runs in `DATA-D7R/sun-runs.txt`) | limited in both June windows |

### Crowds

Official monthly visits, independent travellers, thousands (Parks Canada figures published in the Government of Alberta
Tourism Market Monitor, December 2019 edition; 2019 is the last full pre-pandemic year found in that series on
open.alberta.ca, later years returned 404):

| Park | Jun | Jul | Aug | Sep |
|---|---|---|---|---|
| Banff | 389.1 | 688.5 | 723.8 | 472.3 |
| Jasper | 237.9 | 468.4 | 495.7 | 319.8 |

The 2017 edition gives the same shape (Banff Jun 370.6, Jul 688.3, Aug 674.8, Sep 491.7). No weekly or site counts
exist in what was read, so every crowd level is the monthly figure plus a labelled inference about the week (in each
crowd `note`). Levels use the spec 2.4 scale relative to the July-August peak.

Rules used as events (never dates): Canada Day (Holidays Act s. 2; Alberta general holidays page: 1 July, 2 July when
the first is a Sunday); Labour Day the first Monday of September (Alberta page lists 7 Sep 2026 and 6 Sep 2027, both
first Mondays); Calgary Board of Education 2025-26 calendar: first day of classes the Tuesday after Labour Day, last day
26 Jun (system-wide early dismissal); Ontario Reg. 304 s. 2(1): the school year ends on or before 30 June (read through a
search summary of the e-Laws text, see Unverified); Calgary Stampede 2027: 9 to 18 Jul (ten days).

### Weather

ECCC Canadian Climate Normals 1991-2020, BANFF CS (3050519): precipitation Jun 73.3 mm (wettest month of the year), Jul
46.9, Aug 46.9, Sep 44.9; days with 1 mm or more Jun 11.3, Jul 8.2, Aug 8.3, Sep 7.9; snowfall Jun 1.7 cm, Sep 7.9 cm;
daily max Jun 17.9, Sep 16.7; daily min Jun 4.4, Sep 2.2. Parks Canada Banff weather page (no years stated, modified
2024-10-07): Lake Louise September mean low -0.8 C, June 2.1 C; Banff August high 21.6 C, September 16.1 C.

### Light (computed)

`node core/bin/sun.ts` at the schedule's Banff and Jasper points, reference year 2027 (a neutral year, not the travel
year): Banff day length 16 h 25 min to 16 h 35 min in both June windows (no astronomical night), 13 h 37 min to 12 h 44 min
in `sep-w1`, 13 h 11 min to 12 h 17 min in `sep-w2`.

### Larches

Travel Alberta: best between mid-September and early October, varying with the weather (promotional page, no date).
Parks Canada Banff hiking page: Healy Pass larches turn golden in late September. No site-by-site official dates found;
the earlier blog figures in `timing-hazards.md` (peak about 20 Sep to 5 Oct) were not used as values.

## Method and services

- Plain page reads only (WebFetch, and `curl` with the project user agent for three open.alberta.ca PDFs), one read at a
  time per host. No Overpass, Wikidata, Nominatim or Commons call, so no lock was needed and `flock` was not installed
  (it is still not installed on this Mac; any later batch that calls those services must `brew install flock` first).
- AllTrails, Google, Tripadvisor, Komoot: not used. Blog and news figures from the older notes were not used as values;
  the CTV article on 2026 summer skiing and the Travel Alberta larch page are the only non-park, non-operator pages, and
  only Travel Alberta is cited (labelled a promotional provincial page).
- Source ids are the registry hash (`sourceId(normaliseUrl(url))` from `core/src/sources/normalize.ts`), as D6a did, so
  they match the registry once windows files feed it.
- The file is generated by `research/runs/DATA-D7R/gen-windows.ts` (all values live there with their source keys) and
  checked by `research/runs/DATA-D7R/check-windows.ts`.

## Validation (by hand; no validator exists until OVR-Ca)

`node research/runs/DATA-D7R/check-windows.ts` checks the spec 2.2 rule table: `E_WIN_COUNT` (4), `E_WIN_DEFAULT`
(`sep-w2`), `E_WIN_LENGTH` (15 = schedule day count, and every sun pair spans 15 days), `E_WIN_SUN` (default sun equals
`data/schedules/canadian-rockies-2029.json` `season`), `E_WIN_SRC` (every plus, minus, crowd, event and affects entry has
`src` in the file's sources, every source id equals the registry hash of its URL, every `our_inference` has a note),
`E_WIN_DATE` (core `DATE_TEXT` over 158 texts including source notes), `E_PRIVACY` (core `HOUSEHOLD_TEXT`, plus a word
scan), `E_WIN_LONG` (at most 4 plus and 4 minus, each at most 120 characters), `E_FK` (all 18 `affects` refs resolve to
records in `data/capture/canadian-rockies-2029/`), `W_WIN_CLOSE`. Result: OK. Remaining warnings: bare figure years in
source notes (provenance, not window text). It cannot check that `src` ids resolve in `data/sources/registry.json`,
because the registry is derived from suitability and relevance lane files only (see DECISIONS NEEDED).

## Counts before and after

No capture record, sidecar or lane file was touched, so every count is unchanged. The before and after JSON reports
(`gaps --placement --json`, `gaps --tier required --json`) were byte-identical to each other and to
`research/runs/DATA-D1-points/after-placement.json` and `after-tier.json`, so only their hashes and the budget output are
kept, in `research/runs/DATA-D7R/gaps-summary.txt` (tree_check rule 7 forbids duplicate files): `E_PLACE_AREA` 277, `E_PLACE_ORPHAN` 17, `W_PLACE_POINT` 6, `W_PLACE_APPROX`
0, `E_PLACE_FAR` 0, `W_PLACE_TOWN` 0, `W_TIER_REQUIRED` 385, `W_TIER_REQUIRED.keys` 3875. Gap budget: no count rose (no
`--write` needed). Windows for the Rockies: 0 to 4 (spec 8.2 row "Best-time windows").

## Sample check (19 values, re-read against the live source at the end of the run)

| # | Value in the file or note | Source | Result |
|---|---|---|---|
| 1-3 | Banff visits Jun 389.1, Aug 723.8, Sep 472.3 thousand | Tourism Market Monitor 2019-12 PDF | pass |
| 4-5 | Sunshine 2026 summer 6 Jul to 20 Sep; gondola 08:00-18:00 | skibanff.com summer hours | pass |
| 6 | Moraine Lake canoe dock mid-June to mid-September | morainelake.com/day-visits | pass |
| 7-9 | Elk calving 15 May to 30 Jun; rut 1 Sep to 15 Oct; 30 m | Parks Canada Jasper elk page | pass |
| 10 | Hwy 40 closed 1 Dec to 14 Jun | Alberta Parks annual road closures | pass |
| 11-14 | June precipitation 73.3 mm; June 11.3 wet days; September snowfall 7.9 cm; September 7.9 wet days | ECCC normals Banff CS | pass |
| 15-16 | Lake Louise September low -0.8 C; Banff August high 21.6 C | Parks Canada Banff weather | pass |
| 17 | Junior Explorer cruise to Labour Day (2027: 26 Jun to 6 Sep) | Pursuit Minnewanka hours | pass |
| 18-19 | Labour Day the first Monday of September; Canada Day rule | Alberta general holidays | pass |

19 of 19 pass.

## DECISIONS NEEDED (safest reversible choice taken)

1. **Owned paths versus the brief.** The brief and spec 8.4 also name `timing-windows.md` (in the Rockies research folder, not yet created), the
   run note named DATA-D7-canadian-rockies-2029.md and a capture run record named DATA-D7-*.json (neither exists). This
   batch's assignment owned only `data/windows/**` and `research/runs/DATA-D7R*`, so the prose is in this note under
   "Findings" and no capture run record was written (no API run happened; all reads were plain page reads). Coordinator:
   move the Findings section to `timing-windows.md` and rename this note if wanted.
2. **`affects[].state` enum.** The spec shows only `closed`. This file uses `closed` (outside the stated season),
   `uncertain` (a season edge or snow falls on the plan day) and `limited` (open but reduced: an access detour, no
   darkness). OVR-Ca must accept or rename them; the meaning is in the file's `affects_states_note`.
3. **Sources outside the registry.** `data/sources/registry.json` is derived only from suitability and relevance lane files, so
   the 22 window sources are not in it and `E_WIN_SRC` "resolving to the source registry" cannot pass until OVR-Ca (or
   the registry build) reads `data/windows/`. The ids are already the registry hashes, so nothing in the file needs to
   change then.
4. **Extra fields.** `batch`, `validation_note`, `affects_states_note`, source `note` and `page_modified`, `pattern_year` on
   crowd blocks and events, `basis` and `on` on events and affects: not in the spec example. Kept because they carry
   provenance; OVR-Ca can allow or strip them.
5. **Crowd scale reference.** Levels are relative to the July-August peak (the spec says "relative to the trip's own
   season"; the plan's own window is then `lower`, not `similar`). Owner or OVR-C to confirm.
6. **Verdict for `jun-last`.** `good`, not `workable`, although it loses the Sunshine day: the day has a family track that can
   be swapped, and the window gains the longest light and open lake roads. A judgement call.

## Unverified and gaps

- Ontario Reg. 304 s. 2(1) was read through a search summary of the e-Laws text; the e-Laws page renders by script and the
  fetch returned only its title.
- The Highwood Pass alpine-trail closure for wet and snowy conditions (a June 2026 Alberta Parks advisory, per a search
  summary) was not on the advisory page read; kept as `unknown` in both June windows, and Ptarmigan Cirque is `uncertain`
  by inference only.
- The Bow Valley Parkway spring restriction is a 2026 bulletin; recurrence not stated.
- Not read: Lake Louise and Emerald Lake canoe seasons, Lake Louise gondola 2027 season (page says closed for 2026, no
  dates), Jasper SkyTram (server error 520), Plain of Six Glaciers teahouse season, Jasper trail snow pages, wildfire
  smoke odds, weekly crowd counts, seasonal room prices (only OTA figures exist; links only). Each is an `unknown` entry
  where it matters to a window.
- Lake O'Hara: the 2026 bus season is 19 Jun to 4 Oct (Parks Canada); not a plan record, so not in `affects`.
- Larch Valley group-of-four rule: Parks Canada (Mount Temple guide, modified 2025-01-16) says restrictions are "often in
  place during the summer"; it applies to all four windows, so it is not a window point.
