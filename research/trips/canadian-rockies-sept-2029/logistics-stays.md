# Lane 5: Logistics and stays (raw findings)

Research date: 2026-10-12. No 2029 data exists; each figure carries its source year. Tags: VERIFIED (seen in a fetched or searched source), CALC (computed), INFERENCE (my estimate, no source), GAP (not found; source that failed named).
Trip: Sat 1 Sep 2029 to mid-Sep, a family with a young child, flying in from Ontario, rental car, hotels/lodges.

## 1. Flights
- Nonstop YYZ-YYC carriers: Air Canada, WestJet, Flair, Porter. Frequency varies by aggregator (AC 9-11/day, WS 10-13/day, Flair 3-5/day, Porter 3-4/day; ~202 flights/week claimed by one aggregator). VERIFIED (aggregator snippets, undated): https://www.flightsfrom.com/YYZ-YYC (search snippet; page itself returned HTTP 403 on fetch), https://kupi.com/en/flights/from-toronto/to-calgary
- Air Transat on this route: GAP (search found no route-specific data).
- Departure times, duration, fare range: GAP (flightsfrom.com 403; no fare source retrieved). INFERENCE: flight ~4h15 westbound, ~3h45 eastbound; typical early-Sept return fares for a family are a booking-window question, check Google Flights.
- Open-jaw YYZ-YYC / YEG-YYZ: carriers serving YEG nonstop not verified. GAP. INFERENCE: AC, WestJet, Flair, Porter all fly YYZ-YEG.
- Time zone: Toronto is Eastern; Alberta is Mountain (2 h behind Toronto). Same in September (both on DST). INFERENCE (standard knowledge). BC east of Golden: Golden/Field/Radium/Invermere observe Mountain time; Valemount and Mount Robson are Pacific. GAP: verify Field and Yoho; no source fetched.

## 2. Calgary to Banff / Canmore drive
- Calgary-Banff ~124 km, 1h25 to 1h45 depending on traffic. VERIFIED: https://www.rome2rio.com/s/Calgary-AB/Banff ; Canadream itinerary lists 132 km/1h25 (https://www.canadream.com/trip-planner/itineraries/alberta/hot-springs-adventure/).
- Banff-Lake Louise ~61 km / ~40 min. VERIFIED (same Canadream URL).
- Banff-Jasper ~288 km via Icefields Parkway, 3.5-4 h non-stop. VERIFIED weak (auto-generated page, https://sdp.otoy.com/how-far-is-from-banff-to-jasper); the icefieldsparkway.com page says 232 km Lake Louise to Jasper.
- Canmore is ~25 min from Banff, ~70 min from Calgary. INFERENCE.

## 3. Rental car
- One-way YYC pick-up / YEG drop: no published fee found. Forum says "from nothing to several hundred dollars"; one tour-operator table uses $1.25/km for unlisted routes (~300 km = ~$375 plus tax, my arithmetic). VERIFIED (forum/doc only): https://www.australianfrequentflyer.com.au/community/threads/canada-car-hire-one-way-trip-cost-recommend.40263/latest ; https://flywith.virginatlantic.com/content/dam/vhols/fly-drives/hertz-canada-one-way-fees.pdf. Actual fee: GAP, needs live quote.
- Winter tires: not required in September (rule applies 1 Nov-31 Mar on Icefields Parkway, M+S or snowflake or chains; snow can fall any month). VERIFIED: https://icefieldsparkway.com/faqs
- Gravel clauses: Smith-Dorrien (Hwy 742) is maintained gravel, washboard, dusty, "no need for an SUV", 2-3 h loop with Hwy 40. VERIFIED: https://www.rexby.com/thebanffblog/ttd/scenic-dusty-drive-through-kananaskis-country (snippet). Rental company policy: GAP (no Canadian policy retrieved). Most rental contracts bar unsealed roads and insurers may void cover; ask in writing. Elk Lakes (BC, forestry road): GAP, no source retrieved; INFERENCE: treat as prohibited under standard rental terms.
- Wildlife strikes: GAP for stats/costs. Icefields page warns bighorn sheep/mountain goats on road in winter; INFERENCE: dawn/dusk elk, deer, bear risk on all park highways, check CDW covers animal damage.

## 4. Drive-time matrix
Full matrix is in data/bases.json (drive_times_min per base, 16 bases, symmetric). ALL values are INFERENCE: my own estimates rounded to 5 min from general road knowledge; no routing API or source fetched. Only these have a source: Calgary-Banff ~90 (Rome2Rio), Banff-LL ~40 (Canadream), Golden-Jasper 4h34 (https://wanderlog.com/drive/between/58088/58110/golden-to-jasper-drive; I used 255 via Parkway, note that source's route may differ), Banff-Jasper 3.5-4 h. Key legs (min, INFERENCE): Cal-Canmore 70, Canmore-Banff 25, Banff-LL 40, LL-Field 25, Field-Golden 40, LL-Jasper 175 (no stops), Jasper-Edmonton 225, Calgary-Waterton 195, Calgary-Jasper 300, Banff-Radium 115 (via Hwy 93S), Radium-Invermere 20, Jasper-Valemount 85, Valemount-Mount Robson 30.
Distance matrix in km: GAP (not computed; no routing source).

## 5. Icefields Parkway (Hwy 93N)
- 232 km Lake Louise to Jasper; 3-5 h straight, 6-8 h with stops. VERIFIED: https://icefieldsparkway.com/faqs
- With a young child: INFERENCE 7-8 h realistic with 2 meal/long stops and 4-5 toilet breaks; split Banff/LL to Jasper over two days if possible.
- Fuel: Saskatchewan River Crossing only; seasonal "typically April-October" (same URL). Exact 2026 hours: GAP (no Parks Canada page retrieved). Fill up at Lake Louise or Jasper; Saskatchewan Crossing often pricier (https://thebanffblog.com/icefields-parkway-tips/ snippet).
- Services: Saskatchewan Crossing (fuel, dining, lodging), Num-Ti-Jah Lodge at Bow Lake (GAP: not retrieved, I could not verify open status), Columbia Icefield Centre (open mid-April to mid-Oct, full plumbing, VERIFIED same URL), Sunwapta: GAP.
- Columbia Icefield Adventure/Skywalk listed open 1 May-12 Oct 2026, weather dependent; Ice Odyssey status conflicting. VERIFIED: https://prod.banffjaspercollection.com/plan-your-trip/opening-dates/
- Cell: none on the Parkway (icefieldsparkway.com/faqs); Columbia Icefield has cell/Wi-Fi per Pursuit via https://www.nomadesim.com/zh-hans/blog/no-cell-signal-icefields-parkway (second-hand). Download offline maps first.
- Toilets: full plumbing at Lake Louise, Saskatchewan Crossing, Icefield Centre (mid-Apr to mid-Oct), Jasper; almost everywhere else pit toilets, spaced ~every 15-20 min; carry sanitizer and tissue. VERIFIED same URL. Named toilet list per stop: GAP.
- Rules: Parks Canada pass required; trucks barred; stopping rules not specified on the page. 2026 only: "No Park Pass is required 19 June to 7 September 2026" (icefieldsparkway.com/faqs). 2029 pass status/price: GAP. Pass rates quoted: ~$25/day family-group (up to 7), $12.25/day individual, youth 17 and under free (year not stated, treat as 2026).
- Closures: avalanche closure into March 2026, reopened 26 Mar 2026. https://www.jasperlocal.com/2026/03/22/icefields-parkway-remains-closed-until-further-notice/ ; detours: Hwy 1 east, Hwy 22 north, Hwy 16 west (7-8 h) or Hwy 11 Nordegg if only south half closed (icefieldsparkway.com/faqs).

## 6. Highways
- Hwy 1 Kicking Horse Canyon Phase 4: four lanes opened 30 Nov 2023, project completed 2024 (CTV says 31 Jul 2024), 100 km/h posted. VERIFIED: https://calgary.ctvnews.ca/four-lane-stretch-of-trans-canada-highway-opens-east-of-golden-b-c-after-years-of-construction-1.6986093 and https://www.kickinghorsecanyon.ca/about/project-overview/ . Future construction 2029: GAP.
- Hwy 93S Kootenay (Radium-Castle Jct): 2026 works Jun-Oct at Sinclair Canyon, single-lane alternating, delays up to 45 min; Kootenay Crossing bridge km 60; parking pullouts closed. Radium pools stay open. VERIFIED: https://parks.canada.ca/pn-np/bc/kootenay/visit/infrastructure . No-stopping zone: I found none for 93S (the earlier bear no-stopping zone was a 2019-era CTV report: https://calgary.ctvnews.ca/mobile/parks-canada-officials-create-no-stopping-zone-in-kootenay-national-park-1.4425604, 15 km, status 2029 GAP). Fire closures 2018 existed: https://globalnews.ca/news/4365187/wildfire-forces-closure-of-highway-93-from-radium-hot-springs-to-alberta-border
- Hwy 40 Highwood Pass: closed 1 Dec to 14 Jun (Kananaskis Lakes Trail to Highwood House Junction); open in September. User's "mid June" is June 14 per official listings. VERIFIED: https://okotoksonline.com/articles/seasonal-road-closures-start-soon-for-popular-k-country-routes ; https://www.rmoutlook.com/kananaskis-country/seasonal-road-closures-in-effect-for-kananaskis-country-7901043
- Crowsnest route (Hwy 3) to Waterton via Pincher Creek and Hwy 6: no closure/construction data retrieved. GAP (sources failed: search returned only Prince of Wales Hotel hits).

## 7. Jasper after the 2024 fire
- 358 structures destroyed (initial), 375 properties needing remediation, 374 rebuilds anticipated; 93 properties under construction as of the municipality page updated 2 Oct 2026. No completion timeline. VERIFIED: https://www.jasper-alberta.ca/p/rebuild-numbers
- Federal $520M announced 30 Jun 2026; Year Two progress report exists. VERIFIED: https://www.parks.canada.ca/pn-np/ab/jasper/gestion-management/serviceimmobilier-realty/retablissement-recovery ; https://globalnews.ca/news/11945192/ottawa-jasper-fire-recovery-funding-announcement/
- Occupancy ~96% summer 2026; two hotels due 2027; staff housing is the constraint (search summary of travel report; source not retrieved directly). Lodging inventory list, services open in 2026, 2029 restoration plan: GAP (Parks Canada/municipal pages did not list them). Wapiti campground open.
- INFERENCE: book Jasper lodging 9-12 months ahead; fallback Hinton (1 h east) or Valemount (1h25 west).

## 8. Where to sleep (honest trade-offs; INFERENCE unless noted)
- Banff vs Canmore: Banff has walkability and in-park parking pain; Canmore is cheaper with condos/kitchens and 25 min away. Pool/breakfast data below.
- Lake Louise: closest to Lake Louise/Moraine and Parkway start; thin groceries; pricey; Field is quieter but has almost no services.
- Jasper vs Hinton vs Valemount: Jasper closest but constrained and expensive post-fire; Hinton and Valemount are cheaper fallbacks 1-1.5 h away.
- Waterton townsite vs Pincher Creek: townsite for atmosphere, Pincher Creek for cost and groceries; Waterton services close early autumn (Prince of Wales Hotel listed 11 May-5 Oct 2026, third party: https://curiocity.com/prince-of-wales-hotel-waterton/).

## 9. Kid-friendly hotels, pools, breakfast (2025-2026 snapshots only)
- Canmore: Pocaterra Inn and Waterslide (indoor pool+slide, kids under 18 free, breakfast buffet); $87/night 18-19 Jan 2026 vs $272 in a summer snapshot. Canmore Inn and Suites has indoor pool and slide. https://www.travelocity.com/Canmore-Hotels-Hotels-With-Complimentary-Breakfast.0-0-d10131-tHotelswithComplimentaryBreakfast.Travel-Guide-Filter-Hotels ; https://www.travelalberta.com/map?id=4891
- Banff: Banff Rocky Mountain Resort (indoor pool, 2 hot tubs); Rundlestone Lodge (indoor pool) CAD 149-169 in April; Banff Aspen Lodge and Canalta free breakfast from ~$112 spring. https://www.travelocity.com/Banff-Hotels-Hotels-With-Complimentary-Breakfast.0-0-d10550-tHotelswithComplimentaryBreakfast.Travel-Guide-Filter-Hotels
- Lake Louise: no clear indoor pool + breakfast option found. GAP.
- Sept 2029 rates: GAP. INFERENCE: early Sept (Labour Day weekend) is peak; expect 1.5-2x the spring snapshots.

## 10. Groceries, restaurants, laundry, carriers, fuel
- Banff: IGA (Marten St) 8-20 listed (third-party, may be stale), Safeway (Banff Ave), Keller's Foods (Bear St). Canmore: Safeway, Save-On-Foods, new IGA at 300 Cascade Dr opened 16 Apr 2026. https://dailyhive.com/calgary/iga-canmore ; Lake Louise: small Village Market in Samson Mall, pricey, Chateau General Store 7am-11pm summer. https://banffandbeyond.com/where-to-find-cheap-eats-in-lake-louise/ . Hours verified: GAP.
- Restaurant day-of-week closures and laundromats: GAP (no source retrieved).
- Carriers: Bell/Telus best in Rockies, Rogers weaker in mountains but best on Trans-Canada; no signal on Icefields Parkway. https://www.roamiapp.com/blog/canada-esim-coverage-guide/ ; https://banffbound.com/blog/banff-mobile-connectivity . Roaming for US/UK visitors n/a (Canadian residents).
- Fuel (2026): Calgary regular $1.79/L (27 May 2026), Edmonton $1.74; a Calgary Costco $1.559 (25 Aug 2026). https://dailyhive.com/edmonton/alberta-gas-prices-compared-canada ; Banff/Jasper prices: GAP.

## 11. Sunrise/sunset, Banff (51.178N, 115.570W, MDT UTC-6) CALC
NOAA-style algorithm in Python, accurate to about +/-2 min, standard -0.833 deg horizon, no terrain:
- 1 Sep 2029: sunrise 06:55, sunset 20:28
- 8 Sep 2029: sunrise 07:06, sunset 20:13
- 15 Sep 2029: sunrise 07:17, sunset 19:57
Mountains shorten usable light by about 30-60 min at each end. INFERENCE.

## 12. Emergency, seats, insurance
- Emergency: 911 everywhere. Park wardens Banff/Yoho/Kootenay/Lake Louise 403-762-4506, Jasper 780-852-6155: GAP, from memory, not verified from a source. 
- Alberta: children under 6 and 40 lb (18 kg) or less must be in a child seat; ages 6-15 or over 40 lb must wear a seatbelt; booster not legally required but recommended until 145 cm / 8-12 yr; kids in back until 13. VERIFIED: https://www.alberta.ca/child-seats . A child of 6 or over, or over 18 kg, is legally belt-only in Alberta; INFERENCE: still use a booster.
- BC (Field, Golden, Radium, Invermere, Valemount): child seat/booster until 9th birthday or 145 cm, whichever first (2008 regulation, still cited). A child under 9 and under 145 cm needs a booster in BC. VERIFIED weak: https://bcmj.org/icbc/new-booster-seat-regulations-will-improve-safety-bc-kids ; current ICBC text not retrieved. GAP.
- Rental seats: booking a booster from the car company costs per day; INFERENCE: bring own booster from home (airline checks car seats free).
- Insurance: GAP. INFERENCE: Ontario provincial health (OHIP) does not cover out-of-province hospital fully; buy travel medical + trip cancellation and check wildfire-evacuation clauses.

## 13. Recommended night split (INFERENCE; Calgary in, Calgary out)
Assumes Sat 1 Sep arrival (late flight, sleep Calgary or Canmore). Bases from bases.json.
- 8 nights: Canmore 2, Banff 2, Lake Louise 2, Canmore/Calgary 1, Calgary 1. Skip Jasper; kids and the Parkway as a day return trip from Lake Louise (Columbia Icefield, 7-8 h round trip is too long; suggest Bow Lake and Peyto only).
- 10 nights: Canmore 2, Banff 2, Lake Louise 2, Jasper 3 (via Parkway, one night at Saskatchewan Crossing optional), Calgary 1 (drive Jasper-Calgary 5 h on last day).
- 12 nights: Canmore 2, Banff 2, Lake Louise 2, Jasper 3, Golden or Field 1, Calgary 2 (the 12th night buffer for flights).
- 14 nights: add Kananaskis/Peter Lougheed 2 (Hwy 40 open) and Radium 1 for the pools; Banff 3, LL 2, Jasper 3, Canmore 2, Golden 1, Calgary 1.
- 16 nights: add Waterton 2 and Pincher Creek 1 (Hwy 6) before returning north; Jasper 3-4; Banff 3; LL 2.
- Edmonton-out option: drop the Calgary return night; sleep Jasper 3 then drive 3h45 to YEG (stay at airport on last night); add one-way fee quote. 12-night version: Canmore 2, Banff 2, LL 2, Jasper 3, Valemount or Mount Robson 1 (optional), YEG 1.
Reasons: 2 nights minimum per base with a young child; long days (Parkway) split; early Sept still busy through 3 Sep Labour Day, so book Banff/LL before Jasper; Jasper last because of capacity risk.
