// Published trips for the Discover page. They carry no dates (days are Day 1..N), no bookings, no costs paid and no
// names but the publisher's first name. The season says when the plan is true; outside it the weather and what is open change.
import { PLACE } from "./places";
import { TRIP } from "./trip";

export type StopKind = "hike" | "view" | "lift" | "town" | "food" | "stay" | "drive" | "sight" | "water" | "activity" | "airport";
export interface PubStop { name: string; kind: StopKind; durationMin: number; note?: string }
export interface PubDay { n: number; title: string; base: string; stops: PubStop[]; driveMin: number }
export interface Season {
  months: number[]; label: string; why: string;
  weather: { tempC: string; rain: string; daylight: string; notes: string[] };
}
export type Effort = "easy" | "moderate" | "hard";
export interface PublicTrip {
  id: string; title: string; summary: string; nights: number; region: string; country: string; tripTypes: string[];
  group: string; ageFit: number; season: Season; effort: Effort; driveAvgMin: number; by: string; copies: number;
  tone: "relief" | "lake" | "ice" | "steppe" | "forest" | "town"; days: PubDay[];
}

export const KIND_ICON: Record<StopKind, string> = { hike: "walk", view: "peak", lift: "ticket", town: "pin", food: "star", stay: "bed", drive: "car", sight: "flag", water: "compass", activity: "grip", airport: "plane" };
export const KIND_LABEL: Record<StopKind, string> = { hike: "Hike", view: "Viewpoint", lift: "Lift", town: "Town", food: "Food", stay: "Stay", drive: "Drive", sight: "Sight", water: "Water", activity: "Activity", airport: "Airport" };
export const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Name|kind|minutes|note"
const stop = (s: string): PubStop => { const [name, kind, min, note] = s.split("|"); return { name, kind: kind as StopKind, durationMin: Number(min), ...(note ? { note } : {}) }; };
const day = (n: number, title: string, base: string, driveMin: number, ...stops: string[]): PubDay => ({ n, title, base, driveMin, stops: stops.map(stop) });

// ---- Dolomites, converted from the real plan (dates dropped, bookings and notes about booked things dropped) ----
const KIND_MAP: Record<string, StopKind> = { town: "town", stay: "stay", lake: "water", trail: "hike", viewpoint: "view", lift: "lift", hut: "food", activity: "activity", pass: "drive", sight: "sight", airport: "airport", parking: "drive" };
const DOLO_DRIVE = [150, 55, 70, 40, 45, 80, 60, 50, 110, 45, 40, 70, 90, 120];
const SAFE_NOTE = (n?: string) => n && !/booked|confirm|code|€\d/i.test(n) ? n : undefined;
const dolomiteDays: PubDay[] = TRIP.days.map((d, i) => ({
  n: d.n, title: d.title ?? `Day ${d.n}`, base: d.base ? (PLACE[d.base]?.area ?? "Dolomites") : "Venice",
  driveMin: DOLO_DRIVE[i] ?? 60,
  stops: d.itemIds.map(id => TRIP.items[id]).filter(Boolean).map(it => {
    const p = PLACE[it.placeId];
    return { name: p?.name ?? it.placeId, kind: KIND_MAP[p?.kind ?? "sight"] ?? "sight", durationMin: p?.durationMin ?? 90, ...(SAFE_NOTE(it.note) ? { note: SAFE_NOTE(it.note) } : {}) };
  }),
}));
// bases in the real data are hotels; show the valley instead
const DOLO_BASES = ["Venice", "Alta Pusteria", "Alta Pusteria", "Alta Pusteria", "Alta Pusteria", "Cortina d'Ampezzo", "Cortina d'Ampezzo", "Cortina d'Ampezzo", "Cortina d'Ampezzo", "Val Gardena", "Val Gardena", "Val Gardena", "Val Gardena", "Bolzano"];
dolomiteDays.forEach((d, i) => { d.base = i === 0 ? "Alta Pusteria" : DOLO_BASES[i]; });
dolomiteDays[13].base = "Bolzano to Venice";

const rockies = [
  day(1, "Calgary to Banff", "Banff", 95, "Calgary airport to Banff|drive|95|Pick up the car, supplies in Canmore", "Vermilion Lakes sunset|view|45"),
  day(2, "Johnston Canyon and the gondola", "Banff", 40, "Johnston Canyon|hike|150|Catwalks, Lower and Upper Falls", "Banff Gondola|lift|90|Easier option for the day: skip the via ferrata"),
  day(3, "Lake Louise and Lake Agnes", "Lake Louise", 60, "Lake Agnes teahouse|hike|210|Two tracks: teahouse only, or on to the Little Beehive", "Fairview Lookout|view|40"),
  day(4, "Icefields Parkway north", "Jasper", 270, "Peyto Lake|view|40|Bow Summit lot fills by 10:00", "Athabasca Glacier|sight|90", "Sunwapta Falls|sight|30"),
  day(5, "Maligne Canyon and Spirit Island", "Jasper", 100, "Maligne Canyon|hike|90", "Maligne Lake cruise|water|90|Cruise runs late May to early October"),
  day(6, "Edith Cavell meadows", "Jasper", 80, "Path of the Glacier|hike|120", "Cavell Meadows loop|hike|150|Often snow-bound until mid-July"),
  day(7, "Jasper at a slow pace", "Jasper", 30, "Jasper SkyTram|lift|120", "Pyramid Lake|water|90", "Spare time|activity|60"),
  day(8, "Back south on the Parkway", "Lake Louise", 240, "Mistaya Canyon|hike|45", "Bow Lake and Crowfoot Glacier|view|45", "Icefields Parkway south|drive|120"),
  day(9, "Moraine Lake at sunrise", "Lake Louise", 60, "Moraine Lake sunrise|view|120|Shuttle only, book ahead", "Larch Valley|hike|240|Gold needle colour from mid-September", "Lake Louise lakeshore|water|60"),
  day(10, "Lake O'Hara day", "Lake Louise", 60, "Lake O'Hara|hike|360|Bus lottery opens in spring; alternative is Paradise Valley"),
  day(11, "Yoho: Emerald Lake and Takakkaw", "Lake Louise", 90, "Emerald Lake loop|hike|90", "Takakkaw Falls|sight|60|Yoho Valley Road closes in October", "Natural Bridge|sight|20"),
  day(12, "Kananaskis: Ha Ling", "Kananaskis Village", 100, "Ha Ling Peak|hike|240|Child 8+ copes with the final scramble", "Troll Falls|hike|75"),
  day(13, "Spa and a short walk", "Kananaskis Village", 30, "Kananaskis Nordic Spa|activity|180|Adults only", "Barrier Lake|water|60"),
  day(14, "Kananaskis lakes", "Kananaskis Village", 40, "Upper Kananaskis Lake|hike|120", "Wedge Pond|water|30", "Evening in the village|town|60"),
  day(15, "Calgary and home", "Calgary", 90, "Kananaskis to Calgary airport|drive|90|Leave four hours before the flight"),
];
const iceland = [
  day(1, "Keflavik and the Reykjanes peninsula", "Reykjavik area", 60, "Keflavik airport, pick up the van|airport|90", "Blue Lagoon area lava fields|sight|60", "Campsite Reykjavik|stay|30"),
  day(2, "Golden Circle", "Selfoss area", 150, "Thingvellir|hike|90", "Geysir|sight|45", "Gullfoss|sight|45"),
  day(3, "South coast waterfalls", "Vik", 190, "Seljalandsfoss|sight|45", "Skogafoss|sight|45", "Reynisfjara beach|view|45|Never turn your back on the surf"),
  day(4, "Vatnajokull edge", "Skaftafell", 180, "Fjadrargljufur canyon|hike|60", "Skaftafell Svartifoss|hike|120"),
  day(5, "Glacier lagoon and the east", "Hofn", 150, "Jokulsarlon|view|75", "Diamond Beach|view|45", "Hofn harbour|town|45"),
  day(6, "East fjords", "Egilsstadir", 210, "Eastfjords coast road|drive|150", "Seydisfjordur|town|90"),
  day(7, "Myvatn", "Myvatn", 190, "Dettifoss|sight|60", "Namaskard|sight|45", "Myvatn Nature Baths|activity|90"),
  day(8, "Akureyri and Godafoss", "Akureyri", 100, "Godafoss|sight|45", "Akureyri botanical garden|town|60"),
  day(9, "Skagafjordur to Snaefellsnes", "Grundarfjordur", 270, "Glaumbaer turf farm|sight|45", "Kirkjufell|view|60"),
  day(10, "Snaefellsnes peninsula", "Grundarfjordur", 120, "Djupalonssandur|hike|90", "Arnarstapi to Hellnar|hike|90", "Snaefellsjokull view|view|30"),
  day(11, "Back to Reykjavik", "Reykjavik area", 160, "Borgarfjordur waterfalls|sight|60", "Reykjavik old harbour|town|90"),
  day(12, "Return the van", "Keflavik", 50, "Keflavik airport|airport|60"),
];
const patagonia = [
  day(1, "Buenos Aires", "Buenos Aires", 0, "Palermo and Recoleta walk|town|180", "Evening parrilla|food|90"),
  day(2, "Fly to Ushuaia", "Ushuaia", 20, "Flight to Ushuaia|airport|180", "Harbour walk|town|60"),
  day(3, "Tierra del Fuego National Park", "Ushuaia", 40, "Coastal path|hike|120", "Lapataia Bay|view|45"),
  day(4, "Beagle Channel", "Ushuaia", 15, "Beagle Channel boat|water|240", "Penguin colony stop|sight|60"),
  day(5, "Laguna Esmeralda", "Ushuaia", 40, "Laguna Esmeralda|hike|270", "Town dinner|food|75"),
  day(6, "Fly to El Calafate and on to El Chalten", "El Chalten", 220, "Flight Ushuaia to Calafate|airport|180", "Drive to El Chalten|drive|180"),
  day(7, "Mirador de los Condores", "El Chalten", 0, "Mirador de los Condores|hike|90", "Mirador de las Aguilas|hike|60"),
  day(8, "Laguna Capri and Fitz Roy views", "El Chalten", 0, "Laguna Capri|hike|180", "Evening Fitz Roy glow|view|45"),
  day(9, "Laguna de los Tres", "El Chalten", 0, "Laguna de los Tres|hike|480|Long day: shorter option stops at Poincenot"),
  day(10, "Rest day and Chorrillo del Salto", "El Chalten", 0, "Chorrillo del Salto|hike|90", "Village and cafes|town|120"),
  day(11, "Perito Moreno glacier", "El Calafate", 220, "Drive to El Calafate|drive|180", "Perito Moreno walkways|sight|180"),
  day(12, "Minitrekking or the lake", "El Calafate", 60, "Minitrekking on the glacier|activity|300|Age 8 to 65", "Laguna Nimez birds|view|60"),
  day(13, "Fly to Buenos Aires", "Buenos Aires", 30, "Flight to Buenos Aires|airport|180", "San Telmo market|town|120"),
  day(14, "Last morning", "Buenos Aires", 40, "Cafe and bookshops|town|90", "Airport|airport|60"),
];
const utah = [
  day(1, "Las Vegas to Springdale", "Springdale", 170, "Drive from Las Vegas|drive|170", "Zion Canyon Scenic Drive by shuttle|sight|90"),
  day(2, "Zion classics", "Springdale", 15, "Angels Landing chains view or Scout Lookout|hike|240|Permit only for the final chains", "Riverside Walk|hike|90"),
  day(3, "The Narrows", "Springdale", 15, "Narrows from the Temple of Sinawava|hike|240|Water temp and flow decide the day", "Pa'rus Trail|hike|60"),
  day(4, "Zion to Bryce", "Bryce Canyon", 150, "Zion-Mt Carmel Highway|drive|60", "Bryce amphitheatre rim|view|90", "Sunset Point|view|45"),
  day(5, "Bryce at dawn, then UT-12", "Torrey", 180, "Navajo Loop and Queens Garden|hike|150", "Scenic Byway 12|drive|120", "Lower Calf Creek Falls|hike|180|Optional"),
  day(6, "Capitol Reef", "Torrey", 40, "Hickman Bridge|hike|90", "Fruita orchards|sight|60", "Scenic drive|drive|60"),
  day(7, "Torrey to Moab", "Moab", 150, "Goblin Valley|sight|90", "Drive to Moab|drive|120"),
  day(8, "Arches", "Moab", 40, "Delicate Arch trail|hike|150", "Windows section|hike|90", "Devils Garden|hike|120"),
  day(9, "Canyonlands Island in the Sky", "Moab", 80, "Mesa Arch|hike|45", "Grand View Point|view|60", "Upheaval Dome|hike|60"),
  day(10, "Dead Horse Point and Moab", "Moab", 60, "Dead Horse Point|view|90", "Main Street Moab|town|90"),
  day(11, "Moab to Salt Lake City", "Salt Lake City", 240, "Drive to Salt Lake City|drive|240", "Temple Square|sight|60"),
];
const algonquin = [
  day(1, "Whitby to Lake of Bays", "Dwight", 240, "Huntsville lunch|food|75", "Solitaire Lake Trail|hike|120|Afternoon light is better", "Dwight Beach sunset|view|45"),
  day(2, "Algonquin Track and Tower", "Dwight", 70, "Track and Tower Trail|hike|150|Start at 08:00; the ledge is front-lit to about 10:30", "Ragged Falls|sight|60"),
  day(3, "Dorset and home", "Whitby", 240, "Dorset lookout tower|view|60", "Huntsville|town|60|Leave by 13:30 or after 19:30 to miss traffic"),
];
const vermont = [
  day(1, "Whitby to Hyde Park", "Hyde Park", 420, "Border crossing at Derby Line|drive|60", "Hyde Park village|town|45"),
  day(2, "Smugglers' Notch and Stowe", "Hyde Park", 40, "Smugglers' Notch|view|75", "Stowe Recreation Path|hike|90", "Cider donut stop|food|30"),
  day(3, "Covered bridges and farms", "Hyde Park", 90, "Covered bridge loop|sight|120", "Cabot Creamery|food|45", "Peacham village|town|45"),
  day(4, "Back to Whitby", "Whitby", 420, "Burke Mountain overlook|view|45", "Drive home|drive|420"),
];
const chamonix = [
  day(1, "Geneva to Les Praz", "Les Praz", 90, "Geneva airport to Chamonix|drive|90", "Les Praz village|town|45"),
  day(2, "Lac des Gaillands and Les Praz", "Les Praz", 15, "Lac des Gaillands|water|60", "Chamonix old town|town|90"),
  day(3, "Lac Blanc", "Les Praz", 20, "Lac Blanc via Flegere|hike|300|Lift-dependent, close before mid-September", "Mont Blanc reflection|view|30"),
  day(4, "Mer de Glace", "Les Praz", 15, "Montenvers train|lift|150", "Grotte de la Mer de Glace|sight|60"),
  day(5, "Move to Argentiere", "Argentiere", 25, "Plan de l'Aiguille|hike|180", "Aiguille du Midi|lift|150|Needs a clear morning"),
  day(6, "Aiguillette des Posettes", "Argentiere", 20, "Col des Montets|hike|210", "Lac du Chatelard|water|45"),
  day(7, "Swiss side: Emosson", "Argentiere", 45, "Emosson dam and dinosaur tracks|sight|150", "Vallorcine|town|45"),
  day(8, "Rest and market day", "Argentiere", 15, "Chamonix market|town|90", "Cafe afternoon|food|75"),
  day(9, "Back to Geneva", "Geneva", 90, "Drive to Geneva airport|drive|90"),
];

const S = (months: number[], label: string, why: string, tempC: string, rain: string, daylight: string, notes: string[]): Season => ({ months, label, why, weather: { tempC, rain, daylight, notes } });

export const PUBLIC_TRIPS: PublicTrip[] = [
  { id: "p-dolomites", title: "Dolomites, 13 nights", summary: "Three valley bases, early starts at the famous lakes, a Sass Pordoi day and sunset at Val di Funes. A rental car is needed throughout.", nights: 13, region: "South Tyrol and Veneto", country: "Italy", tripTypes: ["Family", "Hiking"], group: "2 adults + child 10", ageFit: 8, effort: "moderate", driveAvgMin: 70, by: "Nitin", copies: 41, tone: "relief",
    season: S([7, 8], "Mid-July to end of August", "All lifts and high trails are open and the snow is gone from the passes.", "8 to 24 C valley, near 0 C on 2,900 m summits", "Afternoon thunderstorms most days; start early, off the ridges by 14:00", "Sunrise about 05:30, sunset about 20:55 mid-July", ["Mountain huts are open and busy; Tre Cime and Braies need booked parking or a toll slot", "Early June and September close several lifts", "Lagazuoi tunnels need a headlamp"]),
    days: dolomiteDays },
  { id: "p-rockies", title: "Canadian Rockies, 14 nights", summary: "Five bases from Banff to Kananaskis. Every day has an adults' hike, a family hike and a shorter option for a child around 6.", nights: 14, region: "Alberta and British Columbia", country: "Canada", tripTypes: ["Family", "Hiking", "Road trip"], group: "2 adults + child 6", ageFit: 5, effort: "moderate", driveAvgMin: 100, by: "Nitin", copies: 63, tone: "lake",
    season: S([9], "Early to late September", "Crowds thin after Labour Day, larches turn gold in the second half of the month and the lake roads are still open.", "2 to 16 C", "Showers and first snow on high passes possible", "Sunrise about 07:00, sunset about 19:45 mid-September", ["Moraine Lake road closes in mid-October", "Larch gold peaks in the last third of September into early October", "Maligne cruise ends early October"]),
    days: rockies },
  { id: "p-iceland", title: "Iceland Ring Road by camper van", summary: "Counter-clockwise with Snaefellsnes, sleeping at campsites only. The highlands are out because 2WD vans cannot take F-roads.", nights: 11, region: "Ring Road", country: "Iceland", tripTypes: ["Camper van", "Road trip"], group: "2 adults", ageFit: 8, effort: "moderate", driveAvgMin: 160, by: "Nitin", copies: 28, tone: "ice",
    season: S([9], "First three weeks of September", "Dark enough for aurora from early September, while most campsites stay open until mid-September.", "3 to 11 C", "Wet, windy spells; roads stay open", "Sunrise about 06:40, sunset about 20:00, shrinking 6 minutes a day", ["About 50 campsites close during September", "Puffins have left by September", "No river crossings: rental cover excludes them"]),
    days: iceland },
  { id: "p-patagonia", title: "Patagonia with kids 11+", summary: "Buenos Aires, Ushuaia, El Chalten and El Calafate in a reversed route so the penguins and the walking build up in the right order.", nights: 13, region: "Tierra del Fuego and Santa Cruz", country: "Argentina", tripTypes: ["Family", "Adventure", "Hiking"], group: "2 adults + children 11+", ageFit: 11, effort: "hard", driveAvgMin: 55, by: "Nitin", copies: 19, tone: "steppe",
    season: S([2, 3], "Late February to mid-March", "Long days, late summer weather and stable trails; walking in El Chalten is at its best before the autumn wind.", "4 to 17 C", "Dry in the east, rain and wind on the Beagle Channel", "Sunrise about 07:15, sunset about 20:30", ["Wind can close boats and the Fitz Roy ridge", "Penguin colony season ends in March", "Check national park entry fees before the day"]),
    days: patagonia },
  { id: "p-utah", title: "Utah's five parks", summary: "Zion, Bryce, Capitol Reef, Arches and Canyonlands, every leg paved, with the Narrows as the fixed point.", nights: 10, region: "Southern Utah", country: "United States", tripTypes: ["Family", "Road trip", "Hiking"], group: "family of 4", ageFit: 7, effort: "moderate", driveAvgMin: 110, by: "Nitin", copies: 36, tone: "steppe",
    season: S([4, 5, 9], "Mid-April to May, or September", "Narrows water is warm enough in late spring and early autumn, and the desert is below 35 C.", "10 to 30 C", "Dry; spring flash flood watches in the slots", "Sunrise about 06:30, sunset about 19:30 in May", ["Do not go in the Narrows if flash flood warnings are posted", "Summer heat above 38 C makes midday hikes unsafe", "Timed entry may apply at Arches"]),
    days: utah },
  { id: "p-algonquin", title: "Algonquin colour weekend", summary: "Three days at Lake of Bays for peak autumn colour, with a plan B built in for the Algonquin day permit.", nights: 2, region: "Muskoka and Algonquin", country: "Canada", tripTypes: ["Weekend", "Fall colours", "Family"], group: "family", ageFit: 4, effort: "easy", driveAvgMin: 120, by: "Nitin", copies: 54, tone: "forest",
    season: S([9, 10], "Late September to early October", "Colour peaks in this window; earlier and the leaves are green, later and they are down.", "2 to 14 C", "Showers possible; bring layers", "Sunrise about 07:15, sunset about 18:50", ["Algonquin day permits sell online only a few days ahead", "Thanksgiving traffic is heavy on Friday and Monday", "Colour year varies by two weeks"]),
    days: algonquin },
  { id: "p-vermont", title: "Vermont foliage, 3 nights", summary: "A Hyde Park base for Smugglers' Notch, Stowe and the covered bridges. Border time is the main variable.", nights: 3, region: "Northern Vermont", country: "United States", tripTypes: ["Weekend", "Fall colours"], group: "family", ageFit: 4, effort: "easy", driveAvgMin: 120, by: "Nitin", copies: 22, tone: "forest",
    season: S([9, 10], "Late September to mid-October", "Foliage peaks across the north in these weeks and Smugglers' Notch is open before its winter closure.", "3 to 15 C", "Showers, sometimes the first frost", "Sunrise about 07:10, sunset about 18:30", ["Smugglers' Notch road closes in November", "Weekend traffic around Stowe is slow", "Carry passports for every traveller, including children"]),
    days: vermont },
  { id: "p-chamonix", title: "Chamonix and Mont Blanc", summary: "Valley day hikes from two bases, no full Tour du Mont Blanc. Every lift-dependent day falls before the lifts close.", nights: 8, region: "Haute-Savoie", country: "France", tripTypes: ["Hiking", "Couple"], group: "2 adults", ageFit: 10, effort: "moderate", driveAvgMin: 25, by: "Nitin", copies: 15, tone: "ice",
    season: S([6, 7, 8, 9], "Late June to first week of September", "Lifts and huts run, and the high trails are snow-free. Brevent and Planpraz lifts close in mid-September.", "6 to 25 C", "Thunderstorms in the afternoon; mornings are clearer", "Sunrise about 06:15, sunset about 20:30 in early September", ["Mont Blanc tunnel autumn closures may cut off Courmayeur", "UTMB week fills every bed", "Huts close around the third week of September"]),
    days: chamonix },
];

export const publicTripById = (id: string) => PUBLIC_TRIPS.find(t => t.id === id);

// the selected trip travels between the Discover and public-trip screens through this store
const KEY = "proto.publicTrip";
export const getSelectedPublicTrip = (): string | undefined => { try { return localStorage.getItem(KEY) ?? undefined; } catch { return undefined; } };
export const setSelectedPublicTrip = (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* storage blocked */ } };
