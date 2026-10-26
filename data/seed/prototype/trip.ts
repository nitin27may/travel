// The Dolomites trip (13-26 Jul 2027) as the prototype's working data, from legacy/dolomites-july-2027/PLAN.md.
// EXAMPLE DATA: the travellers (Rowan, Sam, Kai), every booking, code, seat, cost, contact, voucher and attachment below are invented
// for the prototype. None of it is a real person or reservation.
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
export interface Payment { status: "paid" | "deposit" | "pay_on_arrival" | "unpaid"; total?: number; paid?: number; currency?: string; dueDate?: string }
export interface Attachment { name: string; kind: "pdf" | "image"; addedAt: string }
/** One timed leg of a flight; dep/arr are local ISO date-times ("2027-07-12T18:30") in their own zone. */
export interface FlightLeg { num: string; from: string; to: string; dep: string; arr: string; depTz?: string; arrTz?: string; cabin?: string }
export interface Reservation {
  id: string; kind: "flight" | "stay" | "car" | "lift" | "parking" | "activity" | "restaurant";
  title: string; status: "to_book" | "booked" | "held"; when: string; where?: string; code?: string;
  opensAt?: string; note?: string; cost?: string; placeId?: string; nights?: string;
  // Added for the booking record (all optional). start/end are local ISO date-times in `tz`.
  provider?: string; manageUrl?: string; address?: string; phone?: string; email?: string;
  start?: string; end?: string; tz?: string;
  legs?: FlightLeg[]; seats?: Record<string, string>;
  guests?: { adults: number; children: number[] };
  rooms?: number; roomType?: string;
  vehicleClass?: string; pickupPlace?: string; dropoffPlace?: string;
  slotTime?: string; entryFrom?: string; entryBy?: string;
  payment?: Payment; freeCancellationUntil?: string; holdUntil?: string;
  attachments?: Attachment[]; notes?: string;
  dayN?: number; itemId?: string;
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
  [it("nuvolau", { time: "09:30" }), it("cinque-torri", { time: "14:00", note: "Beginner via ferrata A/B: Kai 8+ OK if comfortable with heights" }), it("limides", { time: "20:15", note: "Sunset 20:59; needs dead calm" })],
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
    { id: "t1", name: "Rowan", initials: "R" },
    { id: "t2", name: "Sam", initials: "S" },
    { id: "t3", name: "Kai", age: 8, initials: "K" },
  ],
  days: dayItems.map((xs, i) => ({ n: i + 1, base: bases[i], itemIds: xs.map(x => x.id), title: titles[i] })),
  lists: [
    { id: "ideas", name: "Ideas", itemIds: ideas.map(x => x.id) },
    { id: "food", name: "Food and huts", itemIds: food.map(x => x.id) },
  ],
  items,
  reservations: [
    { id: "r-flight", kind: "flight", title: "Example flight, Toronto → Venice", status: "booked", when: "Mon 12 Jul 18:30 → Tue 13 Jul 09:05", code: "EXMPL1", note: "3 passengers · seats 23A-C", cost: "CAD 4,212",
      provider: "Example Air", manageUrl: "https://www.example-air.example/manage-booking", phone: "+1 555 010 0100", email: "confirmation@example-air.example",
      address: "Toronto Pearson, Terminal 1, 6301 Silver Dart Dr, Mississauga ON", start: "2027-07-12T18:30", end: "2027-07-26T15:10", tz: "America/Toronto",
      legs: [
        { num: "EX 892", from: "YYZ", to: "VCE", dep: "2027-07-12T18:30", arr: "2027-07-13T09:05", depTz: "America/Toronto", arrTz: "Europe/Rome", cabin: "Economy" },
        { num: "EX 893", from: "VCE", to: "YYZ", dep: "2027-07-26T11:50", arr: "2027-07-26T15:10", depTz: "Europe/Rome", arrTz: "America/Toronto", cabin: "Economy" },
      ],
      seats: { t1: "23A", t2: "23B", t3: "23C" }, guests: { adults: 2, children: [8] },
      payment: { status: "paid", total: 4212.36, paid: 4212.36, currency: "CAD" }, freeCancellationUntil: "2027-07-13T09:00",
      attachments: [{ name: "example-flight-EXMPL1-itinerary.pdf", kind: "pdf", addedAt: "2026-10-02" }, { name: "example-boarding-pass-23A.png", kind: "image", addedAt: "2026-10-03" }],
      notes: "Checked bag: 1 x 23 kg each. Kai's meal pre-ordered.", dayN: 1, itemId: "i1" },
    { id: "r-car", kind: "car", title: "Example car hire, Marco Polo", status: "booked", when: "13 Jul 11:30 → 26 Jul 12:00", code: "EX-000001", note: "IDP from CAA before leaving", cost: "CAD 612",
      provider: "Example car hire", manageUrl: "https://www.example-car-hire.example/manage-booking", phone: "+39 000 000 0000", email: "reservations@example-car-hire.example",
      address: "Venice Marco Polo Airport, rental desk 3, Viale Galileo Galilei 30, Tessera", start: "2027-07-13T11:30", end: "2027-07-26T12:00", tz: "Europe/Rome",
      vehicleClass: "Compact, automatic, diesel", pickupPlace: "Marco Polo Airport, desk 3", dropoffPlace: "Marco Polo Airport, car return", guests: { adults: 2, children: [8] },
      payment: { status: "deposit", total: 612, paid: 150, currency: "CAD", dueDate: "2027-07-13" }, freeCancellationUntil: "2027-07-10T11:30",
      attachments: [{ name: "example-car-voucher.pdf", kind: "pdf", addedAt: "2026-10-05" }], notes: "Full cover, one extra driver (Sam). Fuel policy full to full. Child seat requested for Kai.", dayN: 1, itemId: "i1" },
    { id: "r-s1", kind: "stay", title: "Example hotel, San Candido", status: "booked", when: "Check-in 13 Jul from 15:00 · out 17 Jul by 10:00", nights: "Nights 1-4", placeId: "hotel-san-candido", code: "HP-20931", cost: "€1,340",
      provider: "Booking.com", manageUrl: "https://secure.booking.com/mybooking.html", phone: "+39 0474 913 000", email: "info@example-hotel-sancandido.example",
      address: "Via Duca Tassilo 7, 39038 San Candido BZ", start: "2027-07-13T15:00", end: "2027-07-17T10:00", tz: "Europe/Rome",
      guests: { adults: 2, children: [8] }, rooms: 1, roomType: "Family room, mountain view, breakfast included",
      payment: { status: "paid", total: 1340, paid: 1340, currency: "EUR" }, freeCancellationUntil: "2027-07-06T23:59",
      attachments: [{ name: "booking-confirmation-HP-20931.pdf", kind: "pdf", addedAt: "2026-10-09" }], notes: "Free parking in the garage. Ask for a ground-floor room if the car is heavy.", dayN: 1 },
    { id: "r-s2", kind: "stay", title: "Example hotel, Cortina", status: "held", when: "17-21 Jul", nights: "Nights 5-8", placeId: "hotel-cortina", note: "Pay at property; free cancellation until 1 Jul", cost: "€1,880",
      provider: "Direct with the hotel", manageUrl: "https://www.example-hotel-cortina.example/my-booking", phone: "+39 0436 866 000", email: "reservations@example-hotel-cortina.example",
      address: "Corso Italia 62, 32043 Cortina d'Ampezzo BL", start: "2027-07-17T14:00", end: "2027-07-21T10:30", tz: "Europe/Rome",
      guests: { adults: 2, children: [8] }, rooms: 1, roomType: "Junior suite with sofa bed",
      payment: { status: "pay_on_arrival", total: 1880, paid: 0, currency: "EUR" }, freeCancellationUntil: "2027-07-01T23:59", holdUntil: "2027-05-01T23:59",
      notes: "Held by email until 1 May; confirm with a card guarantee.", dayN: 5 },
    { id: "r-s3", kind: "stay", title: "Ortisei, 4 nights", status: "to_book", when: "21-25 Jul", nights: "Nights 9-12", note: "Filter for the Südtirol Guest Pass", opensAt: "Book by 15 Mar 2027",
      start: "2027-07-21T15:00", end: "2027-07-25T10:00", tz: "Europe/Rome", guests: { adults: 2, children: [8] }, rooms: 1, dayN: 9 },
    { id: "r-braies", kind: "parking", title: "Lago di Braies P4 parking", status: "to_book", when: "Wed 14 Jul", opensAt: "Online booking, before the day", placeId: "braies", cost: "€44",
      provider: "Lago di Braies official booking", manageUrl: "https://www.lagodibraies.com/en/parking", where: "P4, Lago di Braies", tz: "Europe/Rome",
      start: "2027-07-14T05:00", end: "2027-07-14T10:00", slotTime: "05:00", entryFrom: "05:00", entryBy: "09:00", payment: { status: "unpaid", total: 44, paid: 0, currency: "EUR" },
      notes: "Road closed to cars 09:30-16:00 in July without a reservation.", dayN: 2 },
    { id: "r-auronzo", kind: "parking", title: "Tre Cime toll road slot", status: "to_book", when: "Thu 15 Jul 11:00", opensAt: "Opens Tue 15 Jun 2027, 30 days before", placeId: "tre-cime", cost: "€40",
      provider: "Auronzo di Cadore (Rifugio Auronzo)", manageUrl: "https://www.auronzo.example/tre-cime-toll", where: "Toll gate, Misurina side", tz: "Europe/Rome",
      start: "2027-07-15T11:00", end: "2027-07-15T17:00", slotTime: "11:00", entryFrom: "10:45", entryBy: "11:30", payment: { status: "unpaid", total: 40, paid: 0, currency: "EUR" },
      notes: "Midday slots sell out first; the toll is per car.", dayN: 3 },
    { id: "r-seceda", kind: "lift", title: "Seceda lift, 08:30 slot", status: "to_book", when: "Sat 24 Jul 08:30", opensAt: "Pre-booked slots, non-refundable", placeId: "seceda", cost: "€74 × 3",
      provider: "Seceda cable car (Ortisei)", manageUrl: "https://www.seceda.example/tickets", phone: "+39 0471 796 340", address: "Ortisei valley station, Via Rezia 14", where: "Ortisei valley station", tz: "Europe/Rome",
      start: "2027-07-24T08:30", end: "2027-07-24T09:00", slotTime: "08:30", entryFrom: "08:15", entryBy: "08:45", guests: { adults: 2, children: [8] },
      payment: { status: "unpaid", total: 222, paid: 0, currency: "EUR" }, notes: "Non-refundable once booked. Guest Pass may cut the price.", dayN: 12 },
    { id: "r-otzi", kind: "activity", title: "Ötzi museum entry", status: "to_book", when: "Sun 25 Jul 15:30", placeId: "otzi", cost: "€13",
      provider: "South Tyrol Museum of Archaeology", manageUrl: "https://www.iceman.it/en/tickets/", address: "Via dei Bottai 1, 39100 Bolzano", tz: "Europe/Rome",
      start: "2027-07-25T15:30", end: "2027-07-25T17:00", slotTime: "15:30", guests: { adults: 2, children: [8] }, payment: { status: "unpaid", total: 39, paid: 0, currency: "EUR" }, dayN: 13 },
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
