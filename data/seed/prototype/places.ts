// Dolomites catalog for the prototype. Facts come from legacy/dolomites-july-2027/PLAN.md (2026 operator
// data, re-verify for 2027). Coordinates are approximate (prototype only; the app takes them from OSM/Wikidata).
export type Kind = "town" | "stay" | "lake" | "trail" | "viewpoint" | "lift" | "hut" | "activity" | "pass" | "sight" | "airport" | "parking";

export interface Fact { label: string; value: string; source?: string; read?: string }
export interface Link { kind: string; label: string; url: string; linkOnly?: boolean }
export interface Place {
  id: string;
  name: string;
  aka?: string[];
  kind: Kind;
  area: string;
  lng: number;
  lat: number;
  summary?: string;
  minAge?: number;           // youngest age the activity allows
  km?: number;               // trail distance
  gain?: number;             // metres of climb
  hours?: string;            // typical time
  durationMin?: number;      // planned time on site
  parking?: string;
  trailhead?: string;        // place id of the trailhead or car park the walk starts from
  booking?: string;          // what has to be booked, and when
  facts?: Fact[];
  links?: Link[];
  catalog?: boolean;         // false for the user's own places
}

const P = (p: Place): Place => ({ catalog: true, ...p });

export const PLACES: Place[] = [
  P({ id: "vce", name: "Venice Marco Polo Airport", aka: ["VCE", "Venezia aeroporto"], kind: "airport", area: "Venice", lng: 12.3519, lat: 45.5053 }),
  P({ id: "san-candido", name: "San Candido", aka: ["Innichen"], kind: "town", area: "Alta Pusteria", lng: 12.2803, lat: 46.7327, summary: "Base 1. Braies, Tre Cime, Val Fiscalina and the Drava ride start here." }),
  P({ id: "dobbiaco", name: "Dobbiaco", aka: ["Toblach"], kind: "town", area: "Alta Pusteria", lng: 12.2219, lat: 46.7353 }),
  P({ id: "cortina", name: "Cortina d'Ampezzo", aka: ["Cortina"], kind: "town", area: "Ampezzo", lng: 12.1357, lat: 46.5405, summary: "Base 2. Sorapis, the Falzarego road, Nuvolau; real town amenities." }),
  P({ id: "san-vito", name: "San Vito di Cadore", kind: "town", area: "Cadore", lng: 12.2055, lat: 46.4573, summary: "15 min south of Cortina, about 40% cheaper." }),
  P({ id: "ortisei", name: "Ortisei", aka: ["St. Ulrich", "Urtijëi"], kind: "town", area: "Val Gardena", lng: 11.6714, lat: 46.5747, summary: "Base 3. Best village atmosphere; strict camera ZTL in the centre." }),
  P({ id: "santa-cristina", name: "Santa Cristina", aka: ["St. Christina"], kind: "town", area: "Val Gardena", lng: 11.7208, lat: 46.5605 }),
  P({ id: "selva", name: "Selva di Val Gardena", aka: ["Wolkenstein", "Selva"], kind: "town", area: "Val Gardena", lng: 11.7612, lat: 46.5556 }),
  P({ id: "bolzano", name: "Bolzano", aka: ["Bozen"], kind: "town", area: "Bolzano", lng: 11.3548, lat: 46.4983, summary: "One night. Cuts an hour off the airport drive and adds Ötzi." }),

  P({ id: "hotel-san-candido", name: "Example hotel, San Candido", kind: "stay", area: "Alta Pusteria", lng: 12.2810, lat: 46.7330, summary: "Example stay for base 1 (Südtirol Guest Pass included)." }),
  P({ id: "hotel-cortina", name: "Example hotel, Cortina", kind: "stay", area: "Ampezzo", lng: 12.1360, lat: 46.5390, summary: "Example stay for base 2." }),
  P({ id: "hotel-ortisei", name: "Example guesthouse, Ortisei", kind: "stay", area: "Val Gardena", lng: 11.6730, lat: 46.5760, summary: "Example stay for base 3; hotel issues the ZTL permit on arrival." }),
  P({ id: "hotel-bolzano", name: "Example hotel, Bolzano", kind: "stay", area: "Bolzano", lng: 11.3540, lat: 46.4985, summary: "Example stay for the last night." }),

  P({ id: "landro", name: "Lago di Landro", aka: ["Dürrensee"], kind: "lake", area: "Alta Pusteria", lng: 12.2310, lat: 46.6347, durationMin: 20, summary: "Roadside stop with the Cristallo head-on." }),
  P({ id: "lago-dobbiaco", name: "Lago di Dobbiaco", aka: ["Toblacher See"], kind: "lake", area: "Alta Pusteria", lng: 12.2186, lat: 46.6928, km: 3.5, gain: 10, hours: "1 h", durationMin: 60, summary: "Flat boardwalk loop, easy evening walk." }),
  P({ id: "braies", name: "Lago di Braies", aka: ["Pragser Wildsee", "Braies"], kind: "lake", area: "Braies", lng: 12.0853, lat: 46.6946, km: 3.7, gain: 30, hours: "1-1.5 h", durationMin: 150,
    summary: "Be there at first light: sunrise 05:32, alpenglow on the Seekofel 15-20 min before. Boats moored in their row only before 08:00.",
    parking: "P4, booked online in advance, €44 per car incl. a €22 voucher; no same-day payment at the gate. Without a booking arrive well before 09:00; not guaranteed.",
    booking: "Parking P4 online, before the day",
    facts: [
      { label: "Lake loop", value: "3.7 km, flat", source: "PLAN.md", read: "Aug 2026" },
      { label: "Parking", value: "P4 €44 (incl. €22 voucher), booked online", source: "prags.bz", read: "Aug 2026" },
      { label: "Boat rental", value: "€20 shared / €55 private per 45 min", source: "PLAN.md", read: "Aug 2026" },
    ],
    links: [{ kind: "official", label: "Braies access rules", url: "https://www.prags.bz/en/" }] }),
  P({ id: "fiscalina", name: "Val Fiscalina", aka: ["Fischleintal", "Talschlusshütte"], kind: "trail", area: "Sesto", lng: 12.3550, lat: 46.6745, km: 3, gain: 60, hours: "1 h", durationMin: 120, summary: "Flat 20-30 min to the Talschlusshütte under the Croda dei Toni. Cars restricted; shuttle 440/446." }),
  P({ id: "tre-cime", name: "Tre Cime di Lavaredo loop", aka: ["Drei Zinnen", "Rifugio Auronzo", "Tre Cime"], kind: "trail", area: "Auronzo", lng: 12.2955, lat: 46.6125, km: 10, gain: 450, hours: "3.5-4.5 h", durationMin: 270,
    summary: "Wide gravel loop, no exposure. Clockwise from a midday slot keeps the north faces lit at Locatelli.",
    parking: "Toll road to Rifugio Auronzo: book a slot 30 days out, €40 per car, valid 12 h from the slot, no same-day sales.",
    booking: "Toll slot at pass.auronzo.info, opens 30 days before",
    facts: [
      { label: "Loop", value: "9.5-10.5 km, 400-480 m, 3.5-4.5 h", source: "PLAN.md", read: "Aug 2026" },
      { label: "Toll road", value: "€40 per car, booked 30 days out", source: "pass.auronzo.info", read: "Aug 2026" },
      { label: "Rifugio Locatelli", value: "open in July", source: "PLAN.md", read: "Aug 2026" },
    ],
    links: [
      { kind: "official", label: "Toll road booking", url: "https://pass.auronzo.info" },
      { kind: "osm", label: "OpenStreetMap route", url: "https://www.openstreetmap.org/search?query=Tre%20Cime%20di%20Lavaredo" },
      { kind: "alltrails", label: "AllTrails (link only)", url: "https://www.alltrails.com/", linkOnly: true },
      { kind: "conditions", label: "South Tyrol mountain weather", url: "https://wetter.provinz.bz.it/en/mountain-weather" },
    ] }),
  P({ id: "cadini", name: "Cadini di Misurina viewpoint", kind: "viewpoint", area: "Auronzo", lng: 12.2700, lat: 46.6050, km: 2, gain: 150, hours: "30-40 min", durationMin: 60, summary: "Exposed spur ending at a drop-off on trail 117. Do not continue onto the Bonacossa." }),
  P({ id: "misurina", name: "Lago di Misurina", kind: "lake", area: "Auronzo", lng: 12.2533, lat: 46.5808, durationMin: 30 }),
  P({ id: "antorno", name: "Lago d'Antorno", kind: "lake", area: "Auronzo", lng: 12.2591, lat: 46.5947, durationMin: 20 }),
  P({ id: "monte-piana", name: "Monte Piana", aka: ["Monte Piano"], kind: "trail", area: "Misurina", lng: 12.2380, lat: 46.6136, km: 9.2, gain: 600, hours: "4-5 h", durationMin: 270, summary: "WWI open-air museum on the summit plateau. Small headlamp for the tunnels. Jeep shuttle from Misurina as the easy way up." }),
  P({ id: "seekofel", name: "Croda del Becco", aka: ["Seekofel"], kind: "trail", area: "Braies", lng: 12.0640, lat: 46.6670, km: 14.6, gain: 1350, hours: "7-8.5 h", durationMin: 480, minAge: 12, summary: "Strenuous; short cable-protected steps near the top. Snow-free by mid-July." }),
  P({ id: "drava", name: "Drava cycle path to Lienz", aka: ["Drauradweg", "bike"], kind: "activity", area: "Alta Pusteria", lng: 12.2900, lat: 46.7360, km: 43.4, gain: 15, hours: "about 2 h 50", durationMin: 300, summary: "Downhill all the way; rent at Papin Sport, drop at Lienz, train back. Combined bike-and-person ticket at Lienz." }),
  P({ id: "funbob", name: "Funbob, Monte Baranci", aka: ["toboggan", "Haunold"], kind: "activity", area: "Alta Pusteria", lng: 12.2700, lat: 46.7250, durationMin: 90, minAge: 8, summary: "1,739 m rail toboggan, 314 m drop. From 8 riders go alone with ID; under 8 with an adult.", facts: [{ label: "Price", value: "Adult €21.50, junior €15 per ride", source: "operator", read: "Aug 2026" }] }),
  P({ id: "rafting", name: "Rafting on the Rienza", kind: "activity", area: "Val Pusteria", lng: 11.9400, lat: 46.7960, durationMin: 180, minAge: 6, summary: "Minimum age 6 (the Isarco advanced run is 14+)." }),
  P({ id: "tre-croci", name: "Passo Tre Croci parking", kind: "parking", area: "Ampezzo", lng: 12.2050, lat: 46.5560, durationMin: 10, summary: "About 20 cars; fills by 06:00-06:30 in July." }),
  P({ id: "sorapis", name: "Lago di Sorapis", aka: ["Sorapiss", "Rifugio Vandelli"], kind: "trail", area: "Ampezzo", lng: 12.2200, lat: 46.5197, km: 12, gain: 550, hours: "4.5-6 h", durationMin: 330, minAge: 10, trailhead: "tre-croci",
    summary: "A traverse whose difficulty is exposure: ladders, boards and cabled ledges. Water is most turquoise 09:00-11:00.",
    parking: "Passo Tre Croci: about 20 cars, fills by 06:00-06:30. Leave at 05:30.",
    facts: [{ label: "Route", value: "11-12.6 km, 460-630 m, 4.5-6 h", source: "PLAN.md", read: "Aug 2026" }, { label: "Rifugio Vandelli", value: "lunch 11:30-14:30, cash only", source: "PLAN.md", read: "Aug 2026" }] }),
  P({ id: "lagazuoi", name: "Lagazuoi cable car and tunnels", aka: ["Rifugio Lagazuoi", "Falzarego"], kind: "lift", area: "Falzarego", lng: 12.0060, lat: 46.5275, km: 3, gain: -647, hours: "2-2.5 h", durationMin: 210, minAge: 10, summary: "Cable car from Passo Falzarego; tunnel descent with a mandatory headlamp. Parking free all summer.", parking: "Passo Falzarego, free all summer." }),
  P({ id: "scotoni", name: "Rifugio Scotoni", kind: "hut", area: "Alta Badia", lng: 11.9928, lat: 46.5361, km: 2, gain: 200, hours: "50 min up", durationMin: 120, summary: "From Capanna Alpina; known for its open-grill lunch." }),
  P({ id: "cinque-torri", name: "Cinque Torri", aka: ["5 Torri", "via ferrata"], kind: "sight", area: "Ampezzo", lng: 12.0500, lat: 46.5050, durationMin: 150, minAge: 10, summary: "Free WWI open-air trench museum; beginner A/B via ferrata at the towers, 10+ comfortable with heights." }),
  P({ id: "nuvolau", name: "Rifugio Nuvolau and Averau", aka: ["Averau", "Passo Giau", "Fedare"], kind: "hut", area: "Ampezzo", lng: 12.0476, lat: 46.4968, km: 4, gain: 350, hours: "2-3 h", durationMin: 240, summary: "Fedare chairlift from Passo Giau; 360° panorama from 2,575 m. Book lunch at Averau.", booking: "Lunch at Averau, +39 0436 4660" }),
  P({ id: "limides", name: "Lago di Limides", kind: "lake", area: "Falzarego", lng: 12.0346, lat: 46.5110, km: 2, gain: 80, hours: "20-30 min each way", durationMin: 90, summary: "Sunset mirror of Tofana di Rozes; needs dead calm. Headlamp for the walk out." }),
  P({ id: "la-val", name: "La Val", kind: "town", area: "Alta Badia", lng: 11.9290, lat: 46.6580, durationMin: 60, summary: "Centuries-old viles hamlets under Sas dla Crusc." }),
  P({ id: "passo-gardena", name: "Passo Gardena", aka: ["Grödner Joch"], kind: "pass", area: "Val Gardena", lng: 11.8070, lat: 46.5490, summary: "Verify before committing: a 2026 pilot capped day-trippers at 150 pre-booked slots." }),
  P({ id: "pordoi", name: "Sass Pordoi and Piz Boè", aka: ["Piz Boe", "Pordoi"], kind: "trail", area: "Sella", lng: 11.8150, lat: 46.5033, km: 6, gain: 200, hours: "3-4 h", durationMin: 300, minAge: 12, summary: "Cable car to 2,950 m, then exposed sections with short cabled steps to 3,152 m." }),
  P({ id: "viel-dal-pan", name: "Viel dal Pan", aka: ["Bindelweg"], kind: "trail", area: "Sella", lng: 11.8400, lat: 46.4900, km: 8, gain: 380, hours: "2.5-4 h", durationMin: 240, summary: "Balcony traverse with the Marmolada glacier in view the whole way." }),
  P({ id: "siusi", name: "Alpe di Siusi", aka: ["Seiser Alm", "Compatsch"], kind: "trail", area: "Alpe di Siusi", lng: 11.6250, lat: 46.5410, km: 6.8, gain: 200, hours: "2-3 h", durationMin: 210, summary: "Take the cable car from Siusi (€30 return); driving is banned 09:00-17:00." }),
  P({ id: "puflatsch", name: "Bullaccia and the Witches' Benches", aka: ["Puflatsch"], kind: "trail", area: "Alpe di Siusi", lng: 11.6110, lat: 46.5550, km: 4.8, gain: 152, hours: "1.5-2.5 h", durationMin: 150 }),
  P({ id: "seceda", name: "Seceda ridge", aka: ["Seceda"], kind: "viewpoint", area: "Val Gardena", lng: 11.7231, lat: 46.5996, km: 3, gain: 100, hours: "1.5 h on the ridge", durationMin: 210,
    summary: "The famous view is along the ridge toward the Fermeda towers, not at the top station.",
    booking: "Lift slots pre-booked, 30 min, non-refundable; €74 return",
    facts: [{ label: "Lift", value: "€74 return / €49 one-way, + €5 ridge turnstile", source: "seceda.it", read: "Aug 2026" }, { label: "Cheaper door", value: "Col Raiser from Santa Cristina, €34 return + 1 h walk", source: "PLAN.md", read: "Aug 2026" }],
    links: [{ kind: "official", label: "Seceda summer slots", url: "https://www.seceda.it/en/summer" }] }),
  P({ id: "funes", name: "Santa Maddalena, Val di Funes", aka: ["Villnöss", "Funes"], kind: "viewpoint", area: "Val di Funes", lng: 11.7230, lat: 46.6390, durationMin: 120, summary: "Sunset light on the church under the Odle wall. Park in the village and walk 20-30 min." }),
  P({ id: "munkel", name: "Adolf Munkel Weg", aka: ["Munkel"], kind: "trail", area: "Val di Funes", lng: 11.7600, lat: 46.6200, km: 8, gain: 420, hours: "about 3 h", durationMin: 210, summary: "Zero exposure, a continuous close-up of the Odle wall. Lunch at Geisler Alm.", parking: "Zanser Alm: green light = drive up and pay; red = pre-booked only (else Bus 330 from Ranui)." }),
  P({ id: "otzi", name: "Ötzi, South Tyrol Museum of Archaeology", aka: ["Otzi", "museum"], kind: "sight", area: "Bolzano", lng: 11.3485, lat: 46.4990, durationMin: 120, summary: "€13, 10:00-18:00, last entry 17:30. Reservations recommended." }),
  P({ id: "carezza", name: "Lago di Carezza", aka: ["Karersee"], kind: "lake", area: "Val d'Ega", lng: 11.5751, lat: 46.4093, durationMin: 45 }),
  P({ id: "vallunga", name: "Vallunga", aka: ["Langental"], kind: "trail", area: "Val Gardena", lng: 11.7900, lat: 46.5650, km: 8, gain: 150, hours: "2-3 h", durationMin: 180, summary: "Easy flat valley walk from Selva; the plan's missing day." }),
  P({ id: "fanes-falls", name: "Cascate di Fanes", aka: ["Fanes waterfalls"], kind: "trail", area: "Ampezzo", lng: 12.0697, lat: 46.5806, km: 6, gain: 300, hours: "2-3 h", durationMin: 180 }),
  P({ id: "federa", name: "Lago Federa", aka: ["Croda da Lago"], kind: "lake", area: "Ampezzo", lng: 12.1140, lat: 46.5000, km: 9, gain: 750, hours: "4 h", durationMin: 240 }),
];

export const PLACE: Record<string, Place> = Object.fromEntries(PLACES.map(p => [p.id, p]));
