// The Dolomites trip (13-26 Jul 2027) as the prototype's working data, from legacy/dolomites-july-2027/PLAN.md.
export interface Traveller { id: string; name: string; age?: number; initials: string }
export interface Item {
  id: string;
  placeId: string;
  time?: string;          // "HH:MM" local
  note?: string;
  who?: string[];         // traveller ids; empty = everyone
  variant?: string;       // "A" / "B" lanes on a split day
  ticket?: string;        // reservation id that anchors this item
}
export interface Day { n: number; base?: string; itemIds: string[]; title?: string }
export interface List { id: string; name: string; itemIds: string[] }
export interface Reservation {
  id: string; kind: "flight" | "stay" | "car" | "lift" | "parking" | "activity" | "restaurant";
  title: string; status: "to_book" | "booked" | "held"; when: string; where?: string; code?: string;
  opensAt?: string; note?: string; cost?: string; placeId?: string; nights?: string;
}
export interface Task { id: string; group: "Book" | "Buy" | "Pack" | "Documents" | "Prepare"; title: string; due: string; done: boolean; owner?: string; source?: string }
export interface Trip {
  id: string; title: string; start: string; nights: number; zone: string;
  travellers: Traveller[]; days: Day[]; lists: List[]; items: Record<string, Item>;
  reservations: Reservation[]; tasks: Task[];
  pace: { driveMin: number; walkKm: number; gainM: number };
}

let n = 0;
const it = (placeId: string, extra: Partial<Item> = {}): Item => ({ id: `i${++n}`, placeId, ...extra });

const dayItems: Item[][] = [
  [it("vce", { time: "11:30", note: "Land 10:55, car desk by 11:30 (automatic booked)", ticket: "r-car" }), it("landro", { time: "15:20" })],
  [it("braies", { time: "05:10", note: "Sunrise 05:32; alpenglow on the Seekofel first", ticket: "r-braies" }), it("fiscalina", { time: "14:00" })],
  [it("tre-cime", { time: "11:30", note: "Midday slot, walk clockwise", ticket: "r-auronzo" }), it("cadini", { time: "16:30" })],
  [it("seekofel", { time: "06:30", variant: "A", who: ["t1", "t2"] }), it("drava", { time: "09:30", variant: "B", who: ["t3", "t2"] }), it("funbob", { time: "15:30" })],
  [it("antorno", { time: "09:00" }), it("monte-piana", { time: "09:30" })],
  [it("tre-croci", { time: "05:45", note: "Leave Cortina 05:30; lot fills by 06:00-06:30" }), it("sorapis", { time: "06:00" })],
  [it("lagazuoi", { time: "09:00", note: "Headlamp mandatory in the tunnels" }), it("scotoni", { time: "13:00" })],
  [it("nuvolau", { time: "09:30" }), it("cinque-torri", { time: "14:00", note: "Beginner via ferrata A/B: Aarav 10+ OK if comfortable with heights" }), it("limides", { time: "20:15", note: "Sunset 20:59; needs dead calm" })],
  [it("la-val", { time: "10:30" }), it("passo-gardena", { time: "13:30", note: "Verify the 2027 day-tripper slots first" })],
  [it("pordoi", { time: "09:00", variant: "A", who: ["t1", "t2"] }), it("viel-dal-pan", { time: "09:00", variant: "B", who: ["t3", "t2"] })],
  [it("siusi", { time: "08:30", note: "Cable car from Siusi, €30 return" }), it("puflatsch", { time: "12:30" })],
  [it("seceda", { time: "08:30", ticket: "r-seceda" }), it("funes", { time: "19:30", note: "Sunset; park in the village" })],
  [it("munkel", { time: "09:00" }), it("otzi", { time: "15:30" })],
  [it("vce", { time: "12:00", note: "Return the car; fill up first" })],
];
const bases = ["hotel-san-candido", "hotel-san-candido", "hotel-san-candido", "hotel-san-candido", "hotel-cortina", "hotel-cortina", "hotel-cortina", "hotel-cortina", "hotel-ortisei", "hotel-ortisei", "hotel-ortisei", "hotel-ortisei", "hotel-bolzano", undefined];
const titles = ["Venice to the Alta Pusteria", "Lago di Braies, early", "Tre Cime di Lavaredo", "Croda del Becco or the Drava ride", "To Cortina via Monte Piana", "Lago di Sorapis", "Lagazuoi and Scotoni", "Nuvolau, Averau, Limides at sunset", "Cortina to Val Gardena, the scenic way", "Sass Pordoi and Piz Boè", "Alpe di Siusi", "Seceda, then Val di Funes at sunset", "Adolf Munkel Weg, then Bolzano", "Bolzano to Venice"];
const ideas = [it("vallunga"), it("carezza"), it("fanes-falls"), it("rafting")];
const food = [it("scotoni", { note: "Open-grill lunch" })];

const items: Record<string, Item> = {};
for (const x of [...dayItems.flat(), ...ideas, ...food]) items[x.id] = x;

export const TRIP: Trip = {
  id: "dolomites-2027",
  title: "Dolomites",
  start: "2027-07-13",
  nights: 13,
  zone: "Europe/Rome",
  travellers: [
    { id: "t1", name: "Nitin", initials: "N" },
    { id: "t2", name: "Partner", initials: "P" },
    { id: "t3", name: "Aarav", age: 10, initials: "A" },
  ],
  days: dayItems.map((xs, i) => ({ n: i + 1, base: bases[i], itemIds: xs.map(x => x.id), title: titles[i] })),
  lists: [
    { id: "ideas", name: "Ideas", itemIds: ideas.map(x => x.id) },
    { id: "food", name: "Food and huts", itemIds: food.map(x => x.id) },
  ],
  items,
  reservations: [
    { id: "r-flight", kind: "flight", title: "AC 892 Toronto → Venice", status: "booked", when: "Mon 12 Jul 18:30 → Tue 13 Jul 09:05", code: "K7Q2PZ", note: "3 passengers · seats 23A-C" },
    { id: "r-car", kind: "car", title: "Automatic compact, Marco Polo", status: "booked", when: "13 Jul 11:30 → 26 Jul 12:00", code: "EU-449812", note: "IDP from CAA before leaving" },
    { id: "r-s1", kind: "stay", title: "Example hotel, San Candido", status: "booked", when: "Check-in 13 Jul from 15:00 · out 17 Jul by 10:00", nights: "Nights 1-4", placeId: "hotel-san-candido", code: "HP-20931", cost: "€1,340" },
    { id: "r-s2", kind: "stay", title: "Example hotel, Cortina", status: "held", when: "17-21 Jul", nights: "Nights 5-8", placeId: "hotel-cortina", note: "Pay at property; free cancellation until 1 Jul", cost: "€1,880" },
    { id: "r-s3", kind: "stay", title: "Ortisei, 4 nights", status: "to_book", when: "21-25 Jul", nights: "Nights 9-12", note: "Filter for the Südtirol Guest Pass", opensAt: "Book by 15 Mar 2027" },
    { id: "r-braies", kind: "parking", title: "Lago di Braies P4 parking", status: "to_book", when: "Wed 14 Jul", opensAt: "Online booking, before the day", placeId: "braies", cost: "€44" },
    { id: "r-auronzo", kind: "parking", title: "Tre Cime toll road slot", status: "to_book", when: "Thu 15 Jul 11:00", opensAt: "Opens Tue 15 Jun 2027, 30 days before", placeId: "tre-cime", cost: "€40" },
    { id: "r-seceda", kind: "lift", title: "Seceda lift, 08:30 slot", status: "to_book", when: "Sat 24 Jul 08:30", opensAt: "Pre-booked slots, non-refundable", placeId: "seceda", cost: "€74 × 3" },
    { id: "r-otzi", kind: "activity", title: "Ötzi museum entry", status: "to_book", when: "Sun 25 Jul 15:30", placeId: "otzi", cost: "€13" },
  ],
  tasks: [
    { id: "k1", group: "Book", title: "Book the Tre Cime toll slot", due: "2027-06-15", done: false, source: "Booking window" },
    { id: "k2", group: "Book", title: "Book Braies P4 parking", due: "2027-07-01", done: false, source: "Reservation" },
    { id: "k3", group: "Book", title: "Book Seceda lift slot", due: "2027-06-01", done: false, source: "Reservation" },
    { id: "k4", group: "Book", title: "Book Ortisei stay (Guest Pass)", due: "2027-03-15", done: false, source: "Reservation" },
    { id: "k5", group: "Documents", title: "International Driving Permit from CAA", due: "2027-06-20", done: false, owner: "t1", source: "Car rental" },
    { id: "k6", group: "Documents", title: "Passports valid 3 months past 26 Jul", due: "2027-01-15", done: true, source: "Entry rules" },
    { id: "k7", group: "Documents", title: "Insurance covers helicopter rescue", due: "2027-06-01", done: false, source: "Packing template" },
    { id: "k8", group: "Pack", title: "Headlamps ×3 (Lagazuoi tunnels, sunsets)", due: "2027-07-10", done: false, source: "Trip items" },
    { id: "k9", group: "Pack", title: "Cash for rifugi", due: "2027-07-12", done: false, source: "Trip items" },
    { id: "k10", group: "Buy", title: "Italian eSIM (~USD 33 / 30 days)", due: "2027-07-05", done: false },
    { id: "k11", group: "Prepare", title: "Download the trip for offline use", due: "2027-07-10", done: false, source: "Prepare" },
    { id: "k12", group: "Prepare", title: "Last day to cancel the Cortina hotel free", due: "2027-07-01", done: false, source: "Reservation" },
  ],
  pace: { driveMin: 180, walkKm: 12, gainM: 800 },
};

export const dayDate = (start: string, n: number) => {
  const d = new Date(start + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n - 1); return d;
};
export const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
