// Generator for data/windows/canadian-rockies-2029.json (DATA-D7R). Run from the worktree root:
//   node <this file> <worktree>
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
const { normaliseUrl, sourceId } = await import(join(root, "core/src/sources/normalize.ts"));

const READ = "2026-10-25";
type Src = { key: string; url: string; title: string; publisher: string; kind: string; note?: string; page_modified?: string };
const SRC: Src[] = [
  { key: "sunshine26", url: "https://www.skibanff.com/summer/plan-your-summer-visit/summer-hours-tickets", title: "Summer hours and tickets (Sunshine Village gondola and Standish chair)", publisher: "Banff Sunshine Village", kind: "operator", note: "2026 summer operations: opened in the first week of July, closed on the third Sunday of September; gondola 8:00 to 18:00." },
  { key: "sunshine25", url: "https://www.newswire.com/news/banff-sunshine-village-announces-summer-opening-for-2025-season-22596547", title: "Banff Sunshine Village announces summer opening for 2025 season", publisher: "Banff Sunshine Village (press release)", kind: "operator", note: "2025 summer season: opened on the last Friday of June, closed on the third Sunday of September." },
  { key: "lltransit", url: "https://parks.canada.ca/lakelouise-transit", title: "Lake Louise and Moraine Lake shuttles", publisher: "Parks Canada", kind: "official", note: "2026: Lakeshore shuttle from mid-May, Moraine Lake shuttle and Lake Connector from the start of June, all to Thanksgiving Monday; Moraine Lake Road closed to personal vehicles year-round." },
  { key: "pcweather", url: "https://parks.canada.ca/pn-np/ab/banff/securite-safety/meteo-weather", title: "Weather, Banff National Park (monthly averages)", publisher: "Parks Canada", kind: "official", note: "Averages without stated years. Banff, September: high 16.1, low 2.7 C. Lake Louise, September: high 14.3, low -0.8 C; June: high 17.2, low 2.1 C. Banff, August: high 21.6 C.", page_modified: "2024-10-07" },
  { key: "ecccbanff", url: "https://climate.weather.gc.ca/climate_normals/results_1991_2020_e.html?searchType=stnProv&lstProvince=AB&climate_id=3050519&dispBack=0", title: "Canadian Climate Normals 1991-2020, BANFF CS (3050519)", publisher: "Environment and Climate Change Canada", kind: "official", note: "Precipitation, June: 73.3 mm (the wettest month); September: 44.9 mm. Days with 1 mm or more, June: 11.3; July: 8.2; August: 8.3; September: 7.9. Snowfall, June: 1.7 cm; September: 7.9 cm." },
  { key: "tmm2019", url: "https://open.alberta.ca/dataset/1d0c35db-2c11-4f54-8f9c-89a4b01a3875/resource/ff6e8818-d5df-4ed6-82ac-f1e7060dd7be/download/edtt-tourism-market-monitor-2019-12.pdf", title: "Alberta Tourism Market Monitor, December 2019 (national park attendance by month, source Parks Canada)", publisher: "Government of Alberta", kind: "official", note: "Independent visitors, thousands, 2019. Banff: Jun 389.1, Jul 688.5, Aug 723.8, Sep 472.3. Jasper: Jun 237.9, Jul 468.4, Aug 495.7, Sep 319.8. Monthly only; no weekly split." },
  { key: "abholidays", url: "https://www.alberta.ca/alberta-general-holidays", title: "Alberta general holidays", publisher: "Government of Alberta", kind: "official", note: "Canada Day: the first of July, or the second when the first is a Sunday. Labour Day dates listed for 2026 and 2027 are both the first Monday of September." },
  { key: "holidaysact", url: "https://laws-lois.justice.gc.ca/eng/acts/H-5/page-1.html", title: "Holidays Act (R.S.C., 1985, c. H-5)", publisher: "Justice Laws, Government of Canada", kind: "official", note: "Section 2: Canada Day is a legal holiday throughout Canada." },
  { key: "cbecal", url: "https://belfast.cbe.ab.ca/documents/28d085db-7810-4d25-b130-2b5d82b91a87/Belfast-School-Calendar.pdf", title: "Calgary Board of Education school calendar 2025-26 (Belfast School)", publisher: "Calgary Board of Education", kind: "official", note: "First day of classes the Tuesday after Labour Day; last day of school the last Friday of June (system-wide early dismissal). One school's copy of the board calendar." },
  { key: "onreg304", url: "https://www.ontario.ca/laws/regulation/900304", title: "R.R.O. 1990, Reg. 304: School year calendar, professional activity days", publisher: "Government of Ontario (e-Laws)", kind: "official", note: "Section 2(1): the school year ends on or before the thirtieth day of June. Read through a search summary of the e-Laws text (the page renders by script); not read in the page itself." },
  { key: "stampede", url: "https://www.calgarystampede.com", title: "Calgary Stampede", publisher: "Calgary Stampede", kind: "operator", note: "Next edition (2027) runs ten days from the second Friday of July." },
  { key: "pchiking", url: "https://parks.canada.ca/pn-np/ab/banff/activ/randonnee-hiking", title: "Hiking, Banff National Park", publisher: "Parks Canada", kind: "official", note: "Prime hiking season July through mid-September; until late June many passes snow-bound with avalanche hazard; most alpine passes snow-free by mid-July; Healy Pass larches turn in late September.", page_modified: "2026-10-13" },
  { key: "ohara", url: "https://parks.canada.ca/pn-np/bc/yoho/activ/randonnee-hike/ohara/visit", title: "Visiting Lake O'Hara, Yoho National Park", publisher: "Parks Canada", kind: "official", note: "Until late June many higher routes are still snow-bound and may be subject to avalanche hazard.", page_modified: "2026-02-27" },
  { key: "yohohours", url: "https://parks.canada.ca/pn-np/bc/yoho/visit/heures-hours", title: "Hours of operation, Yoho National Park", publisher: "Parks Canada", kind: "official", note: "Yoho Valley Road open seasonally from mid-June until mid-October, weather permitting.", page_modified: "2026-09-29" },
  { key: "abroads", url: "https://www.albertaparks.ca/parks/kananaskis/kananaskis-country/advisories-and-public-safety/annual-road-closures/", title: "Annual road closures, Kananaskis Country", publisher: "Alberta Parks", kind: "official", note: "Highway 40 (Peter Lougheed to Highwood House) closed from the first of December to the fourteenth of June.", page_modified: "2026-10-02" },
  { key: "bvp", url: "https://parks.canada.ca/voyage-travel/securite-safety/bulletins/0fb4c673-78a8-447c-8722-08d021915744", title: "Restricted activity: personal vehicle access on the Bow Valley Parkway", publisher: "Parks Canada", kind: "official", note: "2026: from the end of April to the last week of June, east end to Johnston Canyon; Johnston Canyon reachable by car via Castle Junction. The bulletin does not say it recurs." },
  { key: "elk", url: "https://parks.canada.ca/pn-np/ab/jasper/securite-safety/faune-wildlife/wapiti-elk", title: "Elk safety, Jasper National Park", publisher: "Parks Canada", kind: "official", note: "Calving season mid-May to the end of June; rutting season the start of September to mid-October; keep at least 30 m from all elk.", page_modified: "2026-10-01" },
  { key: "moraineldg", url: "https://morainelake.com/day-visits/", title: "Day visits (canoe dock)", publisher: "Moraine Lake Lodge", kind: "operator", note: "Due to water levels the canoe dock runs only from mid-June to mid-September; first come, first served." },
  { key: "maligne", url: "https://www.banffjaspercollection.com/attractions/maligne-lake-cruise/location-hours/", title: "Maligne Lake Cruise, location and hours", publisher: "Pursuit (Banff Jasper Collection)", kind: "operator", note: "2027 season from the last days of May to the Thanksgiving weekend." },
  { key: "minnewanka", url: "https://www.banffjaspercollection.com/attractions/lake-minnewanka-cruise/location-hours/", title: "Lake Minnewanka Cruise, location and hours", publisher: "Pursuit (Banff Jasper Collection)", kind: "operator", note: "2027: Classic Cruise from early May to the Thanksgiving weekend; Junior Explorer Cruise from the last week of June to Labour Day." },
  { key: "talarch", url: "https://www.travelalberta.com/articles/golden-larch-trees-in-the-canadian-rockies", title: "Where to find golden larch trees in the Canadian Rockies", publisher: "Travel Alberta (provincial tourism agency)", kind: "official", note: "Best time between mid-September and early October, varying with the weather. Promotional page; no page date." },
  { key: "sun", url: "core/bin/sun.ts", title: "Sun calculator (sunrise, sunset, twilight)", publisher: "this repo", kind: "computed", note: "Runs saved in research/runs/DATA-D7R/sun-runs.txt (reference year 2027, Banff and Jasper points of the schedule)." },
];
const id = new Map(SRC.map((s) => [s.key, sourceId(normaliseUrl(s.url))]));
const s = (...keys: string[]) => keys.map((k) => { const v = id.get(k); if (!v) throw new Error("no source " + k); return v; });

const ON = READ;
type Pt = Record<string, unknown>;
const pt = (text: string, factor: string, basis: string, src: string[], extra: Pt = {}): Pt => ({ text, factor, basis, src: s(...src), on: ON, ...extra });
const inf = (text: string, factor: string, note: string, src: string[] = []): Pt => ({ text, factor, basis: "our_inference", ...(src.length ? { src: s(...src) } : {}), note, on: ON });
const R = "legacy/canadian-rockies-sept-2029";
const aff = (ref: string, state: string, why: string, basis: string, src: string[], extra: Pt = {}): Pt => ({ ref: `${R}/${ref}`, state, why, basis, src: s(...src), ...extra });
const unk = (text: string, tried: string): Pt => ({ text, searched: ON, tried });

const commonUnknown = [
  unk("Crowd level by week inside a month", "Only monthly park visits exist (Parks Canada figures in the Alberta Tourism Market Monitor); no weekly or trail counts found."),
  unk("Season price differences for rooms", "Not researched: the only seasonal price data seen are travel-agency and booking-site figures, which are links only."),
  unk("Odds of wildfire smoke in this window", "Not researched in this batch; earlier notes list smoke years from news reports only, no official odds."),
  unk("Lake Louise and Emerald Lake canoe rental seasons", "Operator pages not read in this batch; only the Moraine Lake Lodge dock season was confirmed."),
  unk("Jasper SkyTram season and hours", "Operator page jasperskytram.com answered with a server error (520) on the read."),
];

const windows = [
  {
    id: "sep-w2",
    label: "Second week of September",
    start: { month: 9, week: 2 },
    sun: { from: [9, 8], to: [9, 22] },
    verdict: "best",
    best_for: "The plan as written: after the long weekend, with the first larch colour late in the trip",
    crowd: { level: "lower", basis: "official", src: s("tmm2019"), pattern_year: 2019, note: "Banff had 472 thousand visits in September against 724 thousand in August; that the weeks after Labour Day are the quieter part of September is our inference." },
    plus: [
      pt("Starts after the Labour Day long weekend, once schools are back", "crowds", "official", ["abholidays", "cbecal"]),
      pt("Larch colour season starts around mid-September, inside the trip's second week", "wildlife", "official", ["talarch", "pchiking"]),
      pt("Sunshine Meadows gondola still runs on plan day 2; it closes later in September", "access", "operator", ["sunshine26", "sunshine25"], { pattern_year: 2026 }),
      pt("Fewer wet days than June: about 8 days a month with 1 mm of rain or more at Banff", "weather", "official", ["ecccbanff"]),
    ],
    minus: [
      pt("Cold nights: Lake Louise's September average low is just below freezing", "weather", "official", ["pcweather"]),
      pt("Snow is possible up high: Banff averages about 8 cm of snowfall in September", "weather", "official", ["ecccbanff"]),
      pt("Moraine Lake's canoe dock runs only to mid-September, so it can be closed by plan day 11", "access", "operator", ["moraineldg"]),
      pt("Elk rut season: keep at least 30 m from elk around the townsites", "wildlife", "official", ["elk"]),
    ],
    events: [
      { rule: "Labour Day is the first Monday of September; this window always starts after that long weekend", effect: "crowds", basis: "official", src: s("abholidays"), on: ON },
    ],
    affects: [
      aff("adventures/moraine-lake-canoe", "uncertain", "Canoe dock season ends mid-September", "operator", ["moraineldg"]),
    ],
    unknown: [
      unk("Peak larch week in a given year at Larch Valley and Highwood Pass", "Travel Alberta and Parks Canada give a range only (mid-September to early October; Healy Pass late September); no site-by-site official dates."),
      unk("Snow on Sentinel Pass and the Iceline in mid-September", "Parks Canada hiking pages read; no seasonal statement for these trails."),
      ...commonUnknown,
    ],
  },
  {
    id: "sep-w1",
    label: "First week of September",
    start: { month: 9, week: 1 },
    sun: { from: [9, 1], to: [9, 15] },
    verdict: "good",
    best_for: "Slightly longer, warmer days with every boat and lift running, if you accept a long-weekend start",
    crowd: { level: "high", basis: "official", src: s("tmm2019", "abholidays"), pattern_year: 2019, note: "August is Banff's busiest month (724 thousand visits) and the Labour Day long weekend falls in this week; September as a whole drops to 472 thousand. The split by week is our inference." },
    plus: [
      pt("Sunshine, the lake cruises and the Moraine Lake canoe dock are all in season on the plan days", "access", "operator", ["sunshine26", "moraineldg", "minnewanka", "maligne"], { note: "Sunshine from its latest season, the cruises from the next one; the canoe dock runs to mid-September, so a late start in the week puts plan day 11 at its edge." }),
      pt("Lake Minnewanka's Junior Explorer cruise for children runs until Labour Day", "access", "operator", ["minnewanka"], { pattern_year: 2027 }),
      pt("About 13.5 hours of daylight at the start, about 25 minutes more than the plan's own window", "light", "computed", ["sun"]),
      inf("Days start a little warmer than mid-September, as August averages are higher", "weather", "Banff averages 21.6 C in August and 16.1 C in September (Parks Canada); a week earlier sits nearer the August end. Inference from monthly means.", ["pcweather"]),
    ],
    minus: [
      pt("Starts on or just after the Labour Day long weekend, a holiday weekend across Canada", "crowds", "official", ["abholidays"]),
      pt("Larches are still mostly green: the colour season starts around mid-September", "wildlife", "official", ["talarch"], { note: "The source gives the colour window only; green before it is our reading of that window." }),
      pt("Elk rut season begins: keep at least 30 m from elk", "wildlife", "official", ["elk"]),
      pt("Snow is possible up high: Banff averages about 8 cm of snowfall in September", "weather", "official", ["ecccbanff"]),
    ],
    events: [
      { rule: "Labour Day long weekend (first Monday of September) falls in the first days of this window", effect: "crowds", basis: "official", src: s("abholidays"), on: ON },
      { rule: "Calgary public schools start the day after Labour Day", effect: "crowds", basis: "official", src: s("cbecal"), on: ON, pattern_year: 2025 },
    ],
    affects: [],
    unknown: [
      unk("Lodging demand on the Labour Day weekend at the first base", "No official occupancy figure by week found; only monthly visits."),
      ...commonUnknown,
    ],
  },
  {
    id: "jun-last",
    label: "Last week of June",
    start: { month: 6, week: "last" },
    sun: { from: [6, 24], to: [7, 8] },
    verdict: "good",
    best_for: "The longest days and open lake roads, before the mid-summer peak, giving up Sunshine and some high passes",
    crowd: { level: "rising", basis: "official", src: s("tmm2019", "cbecal", "onreg304"), pattern_year: 2019, note: "Banff had 389 thousand visits in June and 689 thousand in July; this window crosses into July as Alberta and Ontario schools finish. The rise inside the window is our inference." },
    plus: [
      pt("Longest days of the year: about 16.5 hours of daylight at Banff", "light", "computed", ["sun"]),
      pt("Moraine Lake and Lake Louise shuttles run, and the Moraine Lake canoe dock is open", "access", "official", ["lltransit", "moraineldg"], { pattern_year: 2026 }),
      pt("Yoho Valley Road to Takakkaw Falls has opened by plan day 9 (it opens mid-June)", "access", "official", ["yohohours"]),
      pt("Highwood Pass road is open for the Kananaskis days (closed until mid-June)", "access", "official", ["abroads"]),
    ],
    minus: [
      pt("Sunshine Meadows gondola has not opened for the summer by plan day 2", "access", "operator", ["sunshine26", "sunshine25"], { pattern_year: 2026 }),
      pt("High passes can still hold snow; Parks Canada says most are snow-free by mid-July", "access", "official", ["pchiking", "ohara"]),
      pt("June is Banff's wettest month: about 73 mm and 11 days with 1 mm or more", "weather", "official", ["ecccbanff"]),
      pt("No true night at Jasper, so the dark-sky evening has little dark sky", "light", "computed", ["sun"]),
    ],
    events: [
      { rule: "Canada Day, a national holiday, falls inside this window", effect: "crowds", basis: "official", src: s("holidaysact", "abholidays"), on: ON },
      { rule: "Alberta and Ontario school years end by the last day of June, at the start of this window", effect: "crowds", basis: "official", src: s("cbecal", "onreg304"), on: ON },
      { rule: "The ten-day Calgary Stampede opens in early July, near the trip's last days", effect: "crowds", basis: "operator", src: s("stampede"), on: ON, pattern_year: 2027 },
    ],
    affects: [
      aff("trails/sunshine-meadows-citadel-pass", "closed", "Sunshine gondola summer season has not started", "operator", ["sunshine26", "sunshine25"], { pattern_year: 2026 }),
      aff("trails/larch-valley-sentinel-pass", "uncertain", "Sentinel Pass may still hold snow before mid-July", "official", ["pchiking"]),
      aff("trails/iceline-trail", "uncertain", "Higher routes in Yoho can be snow-bound until late June", "official", ["ohara"]),
      aff("adventures/jasper-dark-sky", "limited", "No astronomical night at Jasper in this window", "computed", ["sun"]),
      { ref: `${R}/trails/wilcox-pass`, state: "uncertain", why: "Alpine route; snow may linger", basis: "our_inference", note: "Parks Canada's Banff statement that most passes are snow-free by mid-July, applied to a Jasper pass by inference.", src: s("pchiking") },
      { ref: `${R}/trails/parker-ridge`, state: "uncertain", why: "Alpine ridge; snow may linger", basis: "our_inference", note: "Same inference as Wilcox Pass.", src: s("pchiking") },
    ],
    unknown: [
      unk("Snow on Wilcox Pass, Parker Ridge, Bald Hills and Sulphur Skyline in late June", "Jasper trail pages not read; the Banff and Yoho season statements were applied by inference only."),
      unk("Highwood Pass alpine trails (Ptarmigan Cirque) in late June", "A search summary mentioned an Alberta Parks wet-and-snowy closure of the Highwood Pass trails in the latest season; the advisory page read did not show it, so not confirmed."),
      unk("Mosquitoes and ticks in late June", "No official source found in this batch."),
      ...commonUnknown,
    ],
  },
  {
    id: "jun-w2",
    label: "Second week of June",
    start: { month: 6, week: 2 },
    sun: { from: [6, 8], to: [6, 22] },
    verdict: "workable",
    best_for: "Quieter valleys and long days before schools finish, if Sunshine and the high trails can be dropped",
    crowd: { level: "lower", basis: "official", src: s("tmm2019", "cbecal"), pattern_year: 2019, note: "June visits to Banff were about half of August's (389 against 724 thousand), and this window ends before Alberta schools finish. Week split is our inference." },
    plus: [
      pt("Ends before Alberta schools finish in the last week of June", "school", "official", ["cbecal"]),
      pt("About 16.5 hours of daylight for long valley days", "light", "computed", ["sun"]),
      pt("Moraine Lake Road shuttle and the Lake Connector run from the start of June", "access", "official", ["lltransit"], { pattern_year: 2026 }),
      pt("Highwood Pass road reopens in mid-June, before the Kananaskis days", "access", "official", ["abroads"]),
    ],
    minus: [
      pt("Sunshine Meadows gondola is not running for the summer on plan day 2", "access", "operator", ["sunshine26", "sunshine25"], { pattern_year: 2026 }),
      pt("Many passes are still snow-bound, with avalanche hazard, until late June", "access", "official", ["pchiking", "ohara"]),
      pt("June is Banff's wettest month: about 73 mm and 11 days with 1 mm or more", "weather", "official", ["ecccbanff"]),
      pt("Elk calving season: cow elk defend calves; keep at least 30 m away", "wildlife", "official", ["elk"]),
    ],
    events: [
      { rule: "The Alberta school year runs to the last week of June; this window ends before it", effect: "crowds", basis: "official", src: s("cbecal"), on: ON, pattern_year: 2025 },
    ],
    affects: [
      aff("trails/sunshine-meadows-citadel-pass", "closed", "Sunshine gondola summer season has not started", "operator", ["sunshine26", "sunshine25"], { pattern_year: 2026 }),
      aff("sights/johnston-canyon", "limited", "Spring vehicle restriction on the Bow Valley Parkway east end; reach it via Castle Junction", "official", ["bvp"], { pattern_year: 2026 }),
      aff("sights/takakkaw-falls", "uncertain", "Yoho Valley Road opens mid-June, weather permitting", "official", ["yohohours"]),
      aff("trails/takakkaw-falls-walk", "uncertain", "Yoho Valley Road opens mid-June, weather permitting", "official", ["yohohours"]),
      aff("trails/iceline-trail", "uncertain", "Higher routes in Yoho can be snow-bound until late June", "official", ["ohara"]),
      aff("trails/larch-valley-sentinel-pass", "uncertain", "Passes can be snow-bound with avalanche hazard until late June", "official", ["pchiking"]),
      aff("adventures/moraine-lake-canoe", "uncertain", "Canoe dock opens only from mid-June", "operator", ["moraineldg"]),
      aff("adventures/jasper-dark-sky", "limited", "No astronomical night at Jasper in this window", "computed", ["sun"]),
      { ref: `${R}/trails/ptarmigan-cirque`, state: "uncertain", why: "Alpine cirque just after the road opens", basis: "our_inference", note: "The road opens mid-June (Alberta Parks); snow on the cirque trail itself is our inference, not confirmed.", src: s("abroads") },
      { ref: `${R}/trails/wilcox-pass`, state: "uncertain", why: "Alpine route; snow likely", basis: "our_inference", note: "Parks Canada's Banff statement on snow-bound passes until late June, applied to a Jasper pass by inference.", src: s("pchiking") },
      { ref: `${R}/trails/parker-ridge`, state: "uncertain", why: "Alpine ridge; snow likely", basis: "our_inference", note: "Same inference as Wilcox Pass.", src: s("pchiking") },
    ],
    unknown: [
      unk("Whether the Bow Valley Parkway spring restriction repeats every year", "The latest bulletin covers one season only and does not say it recurs."),
      unk("Lake ice on the high lakes in the second week of June", "No Parks Canada ice-off statement found; the Moraine Lake dock's mid-June start (water levels) is the only signal."),
      unk("Highwood Pass alpine trails (Ptarmigan Cirque) in mid-June", "A search summary mentioned an Alberta Parks wet-and-snowy closure of the Highwood Pass trails in the latest season; the advisory page read did not show it, so not confirmed."),
      unk("Mosquitoes and ticks in mid-June", "No official source found in this batch."),
      ...commonUnknown,
    ],
  },
];

const out = {
  schema: "trip-windows/1",
  trip: "canadian-rockies-2029",
  researched: READ,
  agent: "travel-researcher",
  model: "opus",
  batch: "DATA-D7R",
  length_days: 15,
  default: "sep-w2",
  validation_note: "No trip-windows/1 validator exists yet (OVR-Ca). Checked by hand against overview spec 2.2 with the batch's check script; see research/runs/DATA-D7R.md.",
  affects_states_note: "closed: outside the stated season. uncertain: the season edge or snow falls inside the plan day. limited: open but reduced (access route or no darkness). OVR-Ca to confirm the enum.",
  sources: SRC.map((x) => ({ id: id.get(x.key), url: x.url, title: x.title, publisher: x.publisher, kind: x.kind, read: READ, ...(x.note ? { note: x.note } : {}), ...(x.page_modified ? { page_modified: x.page_modified } : {}) })),
  windows,
};
writeFileSync(join(root, "data/windows/canadian-rockies-2029.json"), JSON.stringify(out, null, 2) + "\n");
console.log("wrote", out.windows.length, "windows,", out.sources.length, "sources");
