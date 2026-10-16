# Lane 6: Seasonal timing and photography - Chamonix / Mont Blanc, 1-14 Sep 2028

Raw data. Research date 2026-10-12. Tool: WebSearch/WebFetch summaries (page text came back through a summariser; quotes are as returned). `GAP:` = not verified, source named. `CALC:` = my own Python calculation (no network). `DERIVED:` = my reasoning from geometry, not a sourced claim.

## 0. Key flags for the synthesiser

1. LIFT CLOSURES FALL INSIDE 1-14 SEP. Both the 2025 actual and the 2026 published pattern have Flegere, Balme (Vallorcine side), Les Houches-Saint-Gervais and Bossons chairlift ending on or near 13-14 Sep; Bresvent closed 14 Sep in 2025 but runs to 1 Nov in the 2026 table. The 2028 calendar is not published (GAP). Plan Lac Blanc / Flegere / Col de Balme activities for the first week and treat as unconfirmed.
2. Wildflowers/larch: no source verified. See section 2.
3. UTMB 2028 dates: GAP (not published in results). 2026 race week is 24-30 Aug. Pattern: last week Aug / first weekend Sep. Check montblanc.utmb.world.
4. No Desale/Fete des Alpages in the Chamonix valley in September was found (see 2.4).

## 1. Daylight and sun position (CALC)

Method: NOAA-style low-precision solar formulae, lat 45.9237 N, lon 6.8694 E, CEST = UTC+2, sunrise/sunset at -0.833 deg on a FLAT horizon. Times to about +/-2 min.

| Date | Sunrise (flat) | Az | Solar noon CEST | Max elev | Sunset (flat) | Az | Elev -4 deg am / pm | Elev -6 deg am / pm |
|---|---|---|---|---|---|---|---|---|
| 1 Sep 2028 | 06:54 | 77 | 13:32 | 52.3 | 20:12 | 283 | 06:35 / 20:31 | 06:23 / 20:43 |
| 14 Sep 2028 | 07:09 | 84 | 13:28 | 47.4 | 19:47 | 276 | 06:51 / 20:05 | 06:39 / 20:17 |

Day length: 1 Sep about 13 h 18 m; 14 Sep about 12 h 38 m (computed from the rise/set above). Loses about 40 min of daylight over the stay. Sunset moves 25 min earlier.

Sun elevation / azimuth (azimuth from true north, clockwise: 90 = E, 180 = S, 270 = W), local CEST:

| CEST | 1 Sep el / az | 14 Sep el / az |
|---|---|---|
| 07:00 | 0.4 / 78 | -2.4 / 83 |
| 08:00 | 10.7 / 89 | 8.0 / 93 |
| 09:00 | 21.1 / 100 | 18.3 / 105 |
| 10:00 | 31.1 / 112 | 28.1 / 117 |
| 11:00 | 40.1 / 127 | 36.7 / 132 |
| 12:00 | 47.4 / 145 | 43.3 / 149 |
| 13:00 | 51.7 / 167 | 47.0 / 170 |
| 14:00 | 51.8 / 191 | 46.8 / 192 |
| 15:00 | 47.9 / 213 | 42.9 / 212 |
| 16:00 | 40.8 / 232 | 36.0 / 230 |
| 17:00 | 31.8 / 246 | 27.3 / 244 |
| 18:00 | 21.9 / 259 | 17.5 / 256 |
| 19:00 | 11.5 / 270 | 7.2 / 267 |
| 20:00 | 1.1 / 281 | -3.2 / 278 |

Local-horizon caveat: the valley floor sits under high ridges, so real direct-sun sunrise/sunset in town is much later/earlier than the flat-horizon times above. GAP: no sourced valley-floor sunrise/sunset for Chamonix found. Listing-site claim of "summer sunrise around 06:20 and sunset around 20:40" (locationscout-derived summary, https://www.locationscout.net/france/38639-lac-de-cheserys-chamonix search result) is a mid-summer approximation, not for September.

### Which faces are lit when (DERIVED from the table plus valley orientation)
Valley runs roughly NE-SW with the Mont Blanc massif on the SE side and the Aiguilles Rouges / Brevent / Flegere on the NW side (general geography; orientation estimate is mine, GAP: not sourced).
- Mont Blanc massif faces (Aiguille du Midi, Bossons, Mer de Glace sides) face NW toward the valley. They are front-lit from about 14:00 CEST (az ~190) increasing to full front light 16:00-sunset (az 230-283). Morning: backlit / side-lit from the E-SE (az 77-130 until 10:00-11:00).
- So viewing Mont Blanc from the NW side (Brevent, Flegere, Lac Blanc, Aiguillette d'Argentiere) is best afternoon to sunset (sun behind the photographer's left shoulder). Morning from those spots is contre-jour; can work for silhouettes or glow on the summit.
- Aiguilles Rouges (NW side) face SE: front-lit 08:00-12:00 (az 89-145). Aiguilles Rouges are named for reddish colour in early morning light (https://www.walkopedia.net/best-world-walks/France/Aiguilles-Rouges, via search summary).
- Alpenglow on Mont Blanc (summit 4,805 m, high above the valley horizon): DERIVED, summit holds direct light after the flat-horizon sunset and afterglow runs roughly to sun elevation -4 to -6. CALC evening windows: 1 Sep sunset 20:12, -4 deg at 20:31, -6 deg at 20:43. 14 Sep sunset 19:47, -4 deg at 20:05, -6 deg at 20:17. Morning mirror: first colour on the summit from about -6/-4 deg: 1 Sep 06:23-06:35 CEST; 14 Sep 06:39-06:51 CEST. Pink/orange on the summit actually peaks a little before the flat-horizon sunset/just after sunrise; exact minute depends on the observer elevation (GAP: no sourced alpenglow times).
- Dawn from the NW side: sun rises at az 77-84, almost behind the massif from Flegere; Mont Blanc catches first light on its east/NE flank, valley still in shadow.

## 2. What peaks in early-mid September

### 2.1 Weather / temperatures
- Valley: "lows of around 9C and highs of 19C ... on average around 10 days of rain" - https://www.seechamonix.com/news/what-s-on-in-chamonix-september-698979 (fetched). "Only a few degrees cooler than the height of summer."
- ERA5-based site: roughly 10-18 C, ~11 h of sun, rain ~46% of days (summary of https://bestdateweather.com/de/chamonix-wetter-september; low quality; not independently verified).
- 2,000 m / 3,800 m temperatures: GAP: no sourced figures. Forum anecdote (Rick Steves forum, https://community.ricksteves.com/travel-forum/general-europe/26749): top of Aiguille du Midi (3,842 m) about "35 degrees colder than in town" - anecdote, too large for a standard lapse rate (a standard 6.5 C/km gives about 18 C colder); do not use. DERIVED with standard lapse 6.5 C/km from the 9-19 C valley figures (1,035 m): 2,000 m about 3-13 C; 3,800 m about -9 to +1 C before wind chill. Treat as estimate only.
- Freezing level: a single 2025 mid-September snow-forecast snapshot ranged 3,300-4,600 m over six days (https://snow-forecast.com/resorts/Chamonix/6day/mid, search summary; snapshot not climatology). 2007 report: snow line 2,500-3,000 m, forecast snow to 1,500 m later that week (https://www.seechamonix.com/reviews/chamonix-activity-report-24th-september-2007-33257). GAP: no climatological freezing-level normal for September.
- Thunderstorms: only datapoint is an UTMB late-August bulletin: "first very localized thunderstorms after 3 PM, widespread from 5 PM to 10 PM", heavy downpour 30-60 min with sharp temperature drop (https://montblanc.utmb.world/it/weather via search). Pattern is summer convective; September-specific frequency GAP. Lifts (Aiguille du Midi, Montenvers) halt in lightning/high wind (rainviewer.com summary, secondary).
- Crowds: early September "generally less crowded than peak August"; busiest late June, mid-July, late August; UTMB week biggest (https://www.mountaindropoffs.com/?p=253642). seechamonix: "crowds may have dispersed".

### 2.2 Wildflowers, bilberries, larches, rut
- Wildflowers over / bilberries / larch timing / chamois-ibex rut: GAP: no source returned numbers or dates. Search for larch colour (https://en.chamonix.com/nos-inspirations/immersion-dans-les-couleurs-de-chamonix, https://en.chamonix.com/sport-activities/autumn-dayhike-autumn-couleurs-compagnie-des-guides-chamonix) confirmed larches are a signature autumn feature but gave no dates; the search tool noted "general knowledge" of gold from late September, peak October (unverified). One photo guide says autumn is arguably best for photography as "larch trees turn a brilliant gold and the air becomes exceptionally clear" (via search summary of locationscout/Chamonix photo guide; underlying URL not fetched). Conclusion: 1-14 Sep is before the larch colour; hint of bilberry-leaf reds and early yellowing at 2,000 m+ is possible but unverified.
- Larch colour viewing spot named by the OT: Grand Balcon Sud (Flegere-Planpraz) (https://en.chamonix.com/nos-inspirations/immersion-dans-les-couleurs-de-chamonix).

### 2.3 Lifts (critical, from Compagnie du Mont Blanc via third parties; CMB site itself not fetched)
2026 published table (https://www.mountaindropoffs.com/?p=253642; "last updated" blank, unofficial):
| Lift | 2026 |
|---|---|
| Aiguille du Midi | 1 May-1 Nov |
| Brevent | 13 Jun-1 Nov |
| Flegere | 20 Jun-13 Sep |
| Balme, Le Tour side | 20 Jun-20 Sep |
| Balme, Vallorcine side | 4 Jul-13 Sep |
| Les Houches-Saint-Gervais | 6 Jun-13 Sep |
| Bossons chairlift | 13 Jun-13 Sep |
| Panoramic Mont-Blanc (to Italy) | 13 Jul-27 Sep |
| Montenvers | May-Nov; closed 28 Sep-16 Oct; Ice Cave closed 28 Sep-1 Nov |
| Grands Montets | closed summer 2026 |
Autumn 2025 actuals (https://www.chamonix.net/index.php/english/news/ski-lifts-autumn-winter-2025): Brevent closed 14 Sep; Flegere 21 Sep; Aiguille du Midi to 3 Nov; Panoramic Mont Blanc 21 Sep; Montenvers to 3 Nov; Tramway du Mont Blanc to 28 Sep; Balme (Le Tour/Vallorcine) 14 Sep; Grands Montets closed all summer 2025.
Tramway du Mont-Blanc: Nid d'Aigle top station closed for renovation until summer 2026 (chamonix.net 2025 article). 2028: GAP.
Rule of thumb for synth: dates shift each year; in both years the Flegere/Balme/Bossons group ends 13-21 Sep. Check cmb.fr/chamonix.com for 2028 (not published yet; GAP).

### 2.4 Cows / Desalpe / Fete des Alpages
- Haute-Savoie 2026 autumn list (https://www.tourisme-haute-savoie.com/en/news-from-haute-savoie/activities-events/the-alpine-descents-not-to-be-missed-this-autumn-2026-in-haute-savoie/): 13 Sep La Clusaz; 19 Sep Le Grand-Bornand; 26-27 Sep Thones; 27 Sep Bernex; 4 Oct Abondance; 10 Oct Annecy; 11 Oct Megeve and Servoz (sheep fair); 18 Oct Saint-Gervais; 25 Oct Manigod. Only Servoz is in the valley; none in Chamonix, Les Houches or Vallorcine. Herd return runs mid-Sep to late Oct. So for 1-14 Sep 2028 the only nearby fair by pattern would be 13 Sep La Clusaz-type (Sun 10 Sep 2028 would be the analogue; 2028 dates GAP).
- Switzerland: Desalpe de Charmey is the last Saturday of September (26 Sep 2026) (https://www.myswitzerland.com/en-ch/experiences/events/desalpe-in-charmey/) - outside the window and not near Chamonix.
- Cows in September: not verified for the valley; pastures on the Aiguilles Rouges side still have cattle until descent (GAP, no source).
- Other September events: La Folie Douce closing party "later in September" (seechamonix). TAR trail race 54 km (seechamonix; date GAP). UTMB 2028: GAP (race week late Aug; if it runs to early Sep it would collide with 1-3 Sep; verify at montblanc.utmb.world).

### 2.5 Snow line / glaciers
- Mer de Glace: terminus retreat 162 m (1996-2000), 208 m (2001-2005), 175 m (2006-2010) (Wikipedia, https://en.wikipedia.org/wiki/Mer_de_Glace); surface lowering 4.0 +/- 0.2 m/yr 2000-2008 near Montenvers; Euronews 2024 says ~6 m of thickness a year (https://euronews.com/green/2024/08/27/last-chance-tourism-visiting-a-vanishing-glacier-in-chamonix). 500+ steps to reach the ice cave now (https://www.seechamonix.com/lifts/summer/montenvers--mer-de-glace-cog-railway-train-40000). Ice cave moves/rebuilt annually.
- Bossons: front retreated up the slope, "could lose nearly half its mass by 2035" (https://www.tourisme-haute-savoie.com/en/news-from-haute-savoie/why-the-bossons-glacier-could-lose-half-of-its-mass-by-2035-and-what-it-means-for-chamonix/); 2026 heat accelerating decline (https://fr.euronews.com/2026/06/23/mont-blanc-la-chaleur-accelere-le-declin-du-glacier-des-bossons). Per-year rate: GAP.
- September is end of the ablation season: glaciers at minimum snow cover, bare ice/crevasses most exposed; fresh snow possible above ~2,500-3,000 m (2007 report only).

### 2.6 Autumn transition
- TMB huts: usually open mid-June, close around 20 Sep (https://www.trekking-mont-blanc.com/en/top-refuges-and-accomodations-tour-du-mont-blanc, via summary). Rifugio Maison Vieille 2025: 9 Jun-21 Sep (https://montourdumontblanc.com/uk/il4-refuge_i32386-rifugio-maison-vieille.aspx). Lac Blanc refuge tied to Flegere lift; "opened until September 20th (to confirm weather)" (https://www.cirkwi.com/en/point-interet/2080400-refuge-du-lac-blanc). Hut closures begin mid-month: 1-14 Sep is the safe end.
- Local bus network: city buses "often only run from mid June to early September" (via TMB search summary; source thedailypackers.com/15-proven-ways-to-shortcut-the-tmb/).
- Valley quietens mid/late Sep once lifts close (2007 report; seechamonix).
- Autumn dates in the valley: Oct events (Chamonix photo festival 23 Oct 2026; Oct fairs) out of scope.

## 3. Live-condition sources
- Meteo-France Chamonix bulletin, produced daily by a forecaster in Chamonix: https://en.chamonix.com/meteo and https://en.chamonix.com/weather (OT pages embedding it). Cached versions noted outage during a strike.
- MeteoBlue: https://www.meteoblue.com/en/france/weather-chamonix-mont-blanc
- UTMB weather page (useful hour-by-hour storm text in race week): https://montblanc.utmb.world/it/weather
- Radar: https://www.rainviewer.com/france/weather-radar-map-live-chamonix.html
- Trail/mountain conditions: La Chamoniarde (high-mountain office) was named by a search summary; OT office. GAP: URL not fetched; Chamonix tourism site is https://en.chamonix.com.
- Lift status/timetables: Compagnie du Mont Blanc (cmb.fr) - GAP: not fetched; third-party mirror: https://www.chamonix.net, https://www.seechamonix.com/lifts/summer/montenvers--mer-de-glace-cog-railway-train-40000
- Webcams: GAP: none verified in this lane.

## 4. Photo spots (light wanted)
Sourced items, then DERIVED light logic using section 1.

| Spot | Sourced | Best light (DERIVED unless cited) |
|---|---|---|
| Lac Blanc (2,352 m, ~1 h 30-2 h from Flegere) | Classic Mont Blanc mirror on calm days; arrive at lake at least 2 h before sunset for calm water; no bivouac, sleep at refuge (https://locationscout.net/france/8660-lac-blanc-chamonix, search summary). Dawn Mont Blanc reflections exist in stock archives (photo12.com). Best when snow-free (summer/early autumn). | Sunrise: glow on Aiguille Verte/Drus side but Mont Blanc itself backlit; evening: massif front-lit, golden 17:30-19:30. Wind drops dawn and late afternoon. Needs Flegere lift (ends ~13 Sep) or walk from the valley; refuge stay avoids the lift. |
| Aiguille du Midi (3,842 m) | First cable car for soft morning light on granite spires; 360 deg views; 70-200 mm and a polariser (via search summary of tourism guides). | Morning: clear, still air, Vallee Blanche lit from E. Afternoon cloud/convection builds. First lift time: GAP. |
| Brevent | Sunset from Brevent gives best golden hour on Mont Blanc massif (guide via search summary). | Late afternoon to sunset, front-lit massif. Lift status: 2025 closed 14 Sep, 2026 table to 1 Nov. |
| Flegere | Better toward Aiguille Verte and Drus; sunrise or sunset (same guide). | Afternoon front-light on the massif; early morning backlit. Lift ends about 13-21 Sep. |
| Montenvers / Mer de Glace | 500+ steps; retreat signs and markers (seechamonix / Euronews) | Midday overcast works for ice detail; Dru/Grandes Jorasses faces lit by afternoon (DERIVED). Cable car closure for work from 28 Sep (2026). |
| Les Houches | GAP: no source; Bellevue/ Les Houches lift to Saint-Gervais ends 13 Sep 2026 | |
| Col de Balme | GAP (no photo source); Balme lifts 13-20 Sep 2026 | DERIVED: col looks N/ S across Chamonix and Trient valleys; morning / evening sidelight |
| Aiguillette (d'Argentiere / des Posettes) | GAP: no source returned | |
| Vallorcine | GAP | |
| Lac de Peclerel | A Decathlon route described "Peclerey in the forest" (https://www.decathlon-outdoor.com/en/explore/france/peclerey-in-the-forest-6463c4efda3ce, search listing; details not fetched) | DERIVED: forest lake, overcast evens light |
| Lac Vert | GAP: not covered by sources retrieved | |
| Lacs de Cheserys | Less crowded than Lac Blanc; 1.5-2 h from Flegere; Mont Blanc massif reflection at sunrise (photo12.com brk19e54_342) and in evening light (brk19e54_348) | Both; sunrise has first light on the high summits; sunset front-lit massif. https://locationscout.net/france/38639-lac-de-cheserys-chamonix |
| Les Bossons glacier | GAP for photography; chairlift ends 13 Sep (2026) | DERIVED: faces NW, front-lit from afternoon |
| Chamonix town streets | GAP | Blue hour / dusk after summit alpenglow; overcast is fine |
| Courmayeur / Val Veny | Sunrise images of Val Veny with Mont Blanc and Grandes Jorasses (lookphotos.com, search summary); Mont Blanc reflected in Checrouit Lake at sunset (same) | Val Veny is on the SE side: Miage, Brouillard faces lit by morning and midday sun. DERIVED. |
| Lac Combal | Lac Combal with Pyramides Calcaires and Miage moraine (https://www.randozone.com/photo/8532/lac-combal; photos copyrighted) | GAP: no specific time advice. |

More sources: 26 photo spots list, https://www.locationscout.net/locations/8181-chamonix (HTTP 403 on fetch; only snippet); https://tourismattractions.net/france/chamonix-photo-spots (low quality).

## 5. DAYS NEEDED (evidence)

### 5.1 Chamonix valley sightseeing
- Earth Trekkers itinerary: recommended stay 3 to 5 days, five days enough for the best trails, cable cars and town (https://www.earthtrekkers.com/chamonix-itinerary/).
- The World Was Here First: "2 to 3 Days in Chamonix Itinerary" (https://www.theworldwasherefirst.com/chamonix-itinerary/).
- Destinationless Travel: three days (https://destinationlesstravel.com/three-days-in-chamonix-france-itinerary/).
- Search summary: 1 day = Aiguille du Midi only; 2 days = minimum (Midi, glacier, one hike); 3 days = most common (Midi, Mer de Glace, town, paragliding, Lac Blanc, Brevent); 4-5 = adds Tramway du Mont Blanc, Argentiere glacier, longer hikes; "a week or more" only for ski/multi-day hiking; keep a spare day for cloud and weather (Aiguille du Midi, Lac Blanc, Brevent need clear sky).
- Rick Steves forum thread "days in chamonix" exists (https://community.ricksteves.com/travel-forum/france/days-in-chamonix) - content not retrieved.

### 5.2 Tour du Mont Blanc
- Official TMB site: 5 to 12 days, most commonly 7 to 10; about 170 km, close to 10,000 m ascent; 7 days is about 24 km and 1,400 m/day, 10 days about 17 km and 1,000 m/day (https://montourdumontblanc.com/en/actualites/how-many-days-to-hike-the-tour-du-mont-blanc). Suggests splitting into two trips.
- Guidebook (Cicerone via https://www.cordee.co.uk/trekking-the-tour-du-mont-blanc.html): 11 daily stages of 7-21 km, from Les Houches.
- 7-day products: Adventure Base 7-day cuts stages 7, 10, 11 (https://adventurebase.rezdy.com/504119/adventure-base-self-guided-tour-du-mont-blanc-7-days); another ends at Argentiere and uses a La Fouly-Champex bus.
- Shortcuts: lifts, buses, harder variants (https://thedailypackers.com/15-proven-ways-to-shortcut-the-tmb/). Cautions: city buses often only mid-Jun to early Sep; lifts stop in bad weather; many closed by mid-Sep (see 2.3). Daily Chamonix-Courmayeur bus in high season (official TMB site).
- Fit for dates: huts close about 20 Sep; 1-14 Sep full loop is possible in about 10-11 days but would end near hut closure and lift closure dates; weather risk at Col de la Seigne / Grand Col Ferret (GAP: no source for September snow frequency).

### 5.3 Evidence-based days table (day-trip hiker, first visit) - DERIVED from the sources above
| Days | What fits | Marginal gain of the last day | Evidence |
|---|---|---|---|
| 3 | Midi, Mer de Glace/Montenvers, town, one hike (Lac Blanc or Brevent); no weather slack | High; most-cited minimum "sweet spot" | Earth Trekkers, World Was Here First, Destinationless |
| 5 | Adds Flegere-Lac Blanc-Cheserys, Tramway du Mont Blanc, Argentiere glacier, 1-2 weather-swap days | Medium-high; weather slack is the main value | Earth Trekkers "3 to 5 days"; Aiguille du Midi/Lac Blanc need clear days |
| 7 | Adds Italian side (Courmayeur, Val Veny, Lac Combal), Vallorcine/Balme, second big hike, a rest day | Medium; each extra day mostly longer/quieter hikes | Official TMB site says 7 days is the fastest common TMB pace, sources say "a week or more" is for ski/multiday |
| 10 | Allows a partial TMB (northern or southern loop) or repeat summit/lake days in better weather | Low for sightseeing; high only if trekking the TMB | Official TMB: 10 days about 17 km, 1,000 m/day |
| 14 | Full 11-stage TMB with buffer, or about 4 days of weather-reserve | Lowest for day-trip sightseeing; sources recommend only for TMB/ski/climbing | Cicerone 11 stages; huts and lifts close from mid-Sep, so late days in 1-14 Sep window lose services |
Diminishing returns found only qualitatively: sources agree the first 3 days cover the headline sights; the 4th-5th add a weather margin and Lac Blanc-type hikes; beyond about 7 days no sightseeing-focused source recommends staying in Chamonix itself. GAP: no quantitative study. For 1-14 Sep, the second week meets lift and hut closures, so extra days beyond ~7 are best front-loaded in the first week or used for other bases (Courmayeur, Annecy, Switzerland) - my inference.

## 6. Source reliability notes
- seechamonix.com and chamonix.net are commercial local guides; mountaindropoffs.com is a shuttle operator, dates unofficial.
- Official: chamonix.com (OT), tourisme-haute-savoie.com, montourdumontblanc.com, myswitzerland.com.
- Search summaries were produced by a model; items marked "via search summary" were not read at page level.
