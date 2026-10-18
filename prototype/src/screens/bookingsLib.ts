// Bookings helpers: date and money formatting, the form draft, validation, and the confirmation-email reader.
// Dates are local ISO strings ("2027-07-13T15:00", or "2027-07-13" with no time) interpreted in the booking's own zone.
import type { Attachment, FlightLeg, Reservation, Trip } from "../data/trip";

export type Kind = Reservation["kind"];
export const TODAY = "2026-10-17"; // the prototype's today
export const ZONES = ["America/Toronto", "Europe/Rome", "Europe/Paris", "Europe/London", "Europe/Zurich", "Europe/Vienna", "America/New_York", "America/Vancouver", "UTC"];
export const ZONE_LABEL = (z: string) => z === "UTC" ? "UTC" : z.split("/")[1].replace(/_/g, " ");
export const CURRENCIES = ["CAD", "EUR", "USD", "GBP", "CHF"];
const AIRPORT_ZONE: Record<string, string> = { YYZ: "America/Toronto", YUL: "America/Toronto", YVR: "America/Vancouver", JFK: "America/New_York", VCE: "Europe/Rome", MXP: "Europe/Rome", FCO: "Europe/Rome", ZRH: "Europe/Zurich", GVA: "Europe/Zurich", LHR: "Europe/London", CDG: "Europe/Paris", MUC: "Europe/Berlin", VIE: "Europe/Vienna" };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export function parts(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return undefined;
  return { y: +m[1], mo: +m[2], d: +m[3], time: m[4] ? `${m[4]}:${m[5]}` : undefined };
}
export function fmtDate(iso: string | undefined, o: { year?: boolean; dow?: boolean } = {}): string {
  const p = iso && parts(iso); if (!p) return "";
  const dow = o.dow === false ? "" : `${DOW[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]} `;
  return `${dow}${p.d} ${MON[p.mo - 1]}${o.year ? ` ${p.y}` : ""}`;
}
export const fmtTime = (iso: string | undefined) => (iso && parts(iso)?.time) || "";
export const fmtDT = (iso: string | undefined, o: { year?: boolean; dow?: boolean } = {}) => [fmtDate(iso, o), fmtTime(iso)].filter(Boolean).join(" ");
const dayNum = (iso: string) => { const p = parts(iso)!; return Math.floor(Date.UTC(p.y, p.mo - 1, p.d) / 86400000); };
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);

function tzOffsetMs(ms: number, tz: string): number {
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).reduce<Record<string, number>>((a, x) => (x.type !== "literal" ? { ...a, [x.type]: +x.value } : a), {});
    return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - ms;
  } catch { return 0; }
}
/** instant in ms for a local ISO string in a zone, so legs across zones compare correctly */
export function instant(iso: string, tz?: string): number {
  const p = parts(iso)!; const [h, m] = (p.time ?? "00:00").split(":").map(Number);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, h, m);
  return tz ? asUtc - tzOffsetMs(asUtc, tz) : asUtc;
}

const num = (n: number) => n.toLocaleString("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
export const money = (n: number, cur?: string) => `${cur ? `${cur} ` : ""}${num(n)}`;

export type Tone = "ok" | "warn" | "crit" | "act" | "";
export function paymentLine(r: Reservation): string | undefined {
  const p = r.payment; if (!p) return undefined;
  const c = p.currency; const total = p.total; const paid = p.paid ?? 0;
  switch (p.status) {
    case "paid": return total != null ? `Paid ${money(paid || total, c)} of ${num(total)}` : "Paid in full";
    case "deposit": return total != null
      ? `Deposit ${num(paid)} paid, ${num(Math.max(total - paid, 0))} due${p.dueDate ? ` by ${fmtDate(p.dueDate, { dow: false })}` : ""} (${money(total, c)} total)`
      : `Deposit ${num(paid)} paid${p.dueDate ? `, balance due by ${fmtDate(p.dueDate, { dow: false })}` : ""}`;
    case "pay_on_arrival": return total != null ? `Pay on arrival, ${money(total, c)}` : "Pay on arrival";
    case "unpaid": return total != null ? `Not paid yet, ${money(total, c)}${p.dueDate ? ` due by ${fmtDate(p.dueDate, { dow: false })}` : ""}` : "Not paid yet";
  }
}
export function paymentChip(r: Reservation): { label: string; cls: Tone } | undefined {
  const p = r.payment; if (!p || r.status === "to_book" && p.status === "unpaid") return undefined;
  const c = p.currency; const sym = c === "EUR" ? "€" : c ? `${c} ` : "";
  const t = p.total != null ? `${sym}${num(p.total)}` : "";
  switch (p.status) {
    case "paid": return { label: `paid${t ? ` ${t}` : ""}`, cls: "ok" };
    case "deposit": return { label: p.dueDate && p.total != null ? `${sym}${num(p.total - (p.paid ?? 0))} due ${fmtDate(p.dueDate, { dow: false })}` : "deposit", cls: "act" };
    case "pay_on_arrival": return { label: `pay on arrival${t ? ` ${t}` : ""}`, cls: "" };
    case "unpaid": return { label: "unpaid", cls: "warn" };
  }
}
export function cancelInfo(r: Reservation): { text: string; cls: Tone; warn: boolean } | undefined {
  if (!r.freeCancellationUntil) return undefined;
  const left = daysBetween(TODAY, r.freeCancellationUntil);
  const on = fmtDT(r.freeCancellationUntil, { year: true });
  if (left < 0) return { text: `Free cancellation ended ${on}`, cls: "crit", warn: true };
  if (left <= 14) return { text: `Free cancellation ends in ${left} day${left === 1 ? "" : "s"} (${on})`, cls: "warn", warn: true };
  return { text: `Free cancellation until ${on}`, cls: "", warn: false };
}

// ---- form draft ------------------------------------------------------------------------------------------------
export interface LegDraft { num: string; from: string; to: string; dep: string; arr: string; depTz: string; arrTz: string; cabin: string }
export interface Draft {
  kind: Kind; status: Reservation["status"]; title: string; provider: string; code: string;
  start: string; end: string; tz: string; legs: LegDraft[];
  date: string; slotTime: string; endTime: string; entryFrom: string; entryBy: string; where: string;
  pickupPlace: string; dropoffPlace: string; vehicleClass: string;
  adults: string; children: string; rooms: string; roomType: string; seats: Record<string, string>;
  payStatus: "" | NonNullable<Reservation["payment"]>["status"]; currency: string; total: string; paid: string; dueDate: string; freeCancel: string; holdUntil: string;
  address: string; phone: string; email: string; manageUrl: string;
  attachments: Attachment[]; notes: string; dayN: string; itemId: string;
}
export const blankLeg = (): LegDraft => ({ num: "", from: "", to: "", dep: "", arr: "", depTz: "America/Toronto", arrTz: "Europe/Rome", cabin: "" });
export const blankDraft = (kind: Kind, tz: string): Draft => ({
  kind, status: "to_book", title: "", provider: "", code: "", start: "", end: "", tz, legs: kind === "flight" ? [blankLeg()] : [],
  date: "", slotTime: "", endTime: "", entryFrom: "", entryBy: "", where: "", pickupPlace: "", dropoffPlace: "", vehicleClass: "",
  adults: "", children: "", rooms: "", roomType: "", seats: {}, payStatus: "", currency: "CAD", total: "", paid: "", dueDate: "", freeCancel: "", holdUntil: "",
  address: "", phone: "", email: "", manageUrl: "", attachments: [], notes: "", dayN: "", itemId: "",
});
export const isSlot = (k: Kind) => k === "lift" || k === "parking" || k === "activity" || k === "restaurant";
const dt = (iso?: string) => iso ? iso.slice(0, 16) : "";

export function toDraft(r: Reservation, trip: Trip): Draft {
  const d = blankDraft(r.kind, r.tz ?? trip.zone);
  const legs: LegDraft[] = (r.legs ?? []).map(l => ({ num: l.num, from: l.from, to: l.to, dep: dt(l.dep), arr: dt(l.arr), depTz: l.depTz ?? "", arrTz: l.arrTz ?? "", cabin: l.cabin ?? "" }));
  const linked = r.itemId || Object.values(trip.items).find(i => i.ticket === r.id)?.id || "";
  return {
    ...d, status: r.status, title: r.title, provider: r.provider ?? "", code: r.code ?? "",
    start: dt(r.start), end: dt(r.end), legs: r.kind === "flight" ? (legs.length ? legs : [blankLeg()]) : [],
    date: r.start?.slice(0, 10) ?? "", slotTime: r.slotTime ?? fmtTime(r.start), endTime: fmtTime(r.end), entryFrom: r.entryFrom ?? "", entryBy: r.entryBy ?? "", where: r.where ?? "",
    pickupPlace: r.pickupPlace ?? "", dropoffPlace: r.dropoffPlace ?? "", vehicleClass: r.vehicleClass ?? "",
    adults: r.guests ? String(r.guests.adults) : "", children: r.guests?.children.join(", ") ?? "", rooms: r.rooms ? String(r.rooms) : "", roomType: r.roomType ?? "", seats: r.seats ?? {},
    payStatus: r.payment?.status ?? "", currency: r.payment?.currency ?? "CAD", total: r.payment?.total != null ? String(r.payment.total) : "", paid: r.payment?.paid != null ? String(r.payment.paid) : "", dueDate: r.payment?.dueDate ?? "",
    freeCancel: dt(r.freeCancellationUntil), holdUntil: dt(r.holdUntil),
    address: r.address ?? "", phone: r.phone ?? "", email: r.email ?? "", manageUrl: r.manageUrl ?? "",
    attachments: r.attachments ?? [], notes: r.notes ?? r.note ?? "", dayN: r.dayN ? String(r.dayN) : "", itemId: linked,
  };
}

export type Errors = Record<string, string>;
const isUrl = (v: string) => { try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
export function validate(d: Draft): Errors {
  const e: Errors = {};
  if (!d.title.trim()) e.title = "Add a title";
  if (!d.kind) e.kind = "Choose a kind";
  const amount = (k: string, v: string, label: string) => { if (v === "") return; const n = Number(v); if (Number.isNaN(n)) e[k] = `${label} must be a number`; else if (n < 0) e[k] = `${label} cannot be negative`; };
  amount("total", d.total, "Total"); amount("paid", d.paid, "Paid");
  if (!e.total && !e.paid && d.total !== "" && d.paid !== "" && Number(d.paid) > Number(d.total)) e.paid = "Paid is more than the total";
  if (d.manageUrl && !isUrl(d.manageUrl.trim())) e.manageUrl = "Use a full link starting http:// or https://";
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = "That email does not look right";
  if (d.phone && !/^\+?[\d\s().-]{6,}$/.test(d.phone.trim())) e.phone = "Digits, spaces and + only";
  if (d.adults !== "" && !(Number.isInteger(Number(d.adults)) && Number(d.adults) >= 0)) e.adults = "Whole number, 0 or more";
  if (d.children.trim() && !d.children.split(/[,\s]+/).filter(Boolean).every(x => /^\d{1,2}$/.test(x))) e.children = "Ages as numbers, like 10, 7";
  if (d.rooms !== "" && !(Number.isInteger(Number(d.rooms)) && Number(d.rooms) >= 1)) e.rooms = "At least 1";
  if (d.kind === "flight") {
    d.legs.forEach((l, i) => { if (l.dep && l.arr && instant(l.arr, l.arrTz || undefined) <= instant(l.dep, l.depTz || undefined)) e[`leg${i}`] = "Arrival must be after departure"; });
  } else if (isSlot(d.kind)) {
    if (d.slotTime && d.endTime && d.endTime <= d.slotTime) e.endTime = "Ends after it starts";
    if (d.entryFrom && d.entryBy && d.entryBy <= d.entryFrom) e.entryBy = "Must be after the start of the window";
  } else if (d.start && d.end && instant(d.end, d.tz) <= instant(d.start, d.tz)) e.end = d.kind === "stay" ? "Check-out must be after check-in" : "Drop-off must be after pick-up";
  return e;
}

const sym = (c: string) => c === "EUR" ? "€" : `${c} `;
export function fromDraft(d: Draft, base: Reservation | undefined, trip: Trip): Reservation {
  const t = (v: string) => v.trim() || undefined;
  const slot = isSlot(d.kind);
  const start = d.kind === "flight" ? d.legs[0]?.dep || undefined : slot ? (d.date ? (d.slotTime ? `${d.date}T${d.slotTime}` : d.date) : undefined) : t(d.start);
  const end = d.kind === "flight" ? d.legs[d.legs.length - 1]?.arr || undefined : slot ? (d.date && d.endTime ? `${d.date}T${d.endTime}` : undefined) : t(d.end);
  const legs: FlightLeg[] | undefined = d.kind === "flight" ? d.legs.filter(l => l.num || l.from || l.to || l.dep).map(l => ({ num: l.num.trim(), from: l.from.trim(), to: l.to.trim(), dep: l.dep, arr: l.arr, depTz: l.depTz || undefined, arrTz: l.arrTz || undefined, cabin: t(l.cabin) })) : undefined;
  let when = "Dates to add";
  if (d.kind === "flight" && legs?.[0]?.dep) when = `${fmtDT(legs[0].dep)}${legs[0].arr ? ` → ${fmtDT(legs[0].arr)}` : ""}`;
  else if (d.kind === "stay" && start) when = `Check-in ${fmtDate(start, { dow: false })}${fmtTime(start) ? ` from ${fmtTime(start)}` : ""}${end ? ` · out ${fmtDate(end, { dow: false })}${fmtTime(end) ? ` by ${fmtTime(end)}` : ""}` : ""}`;
  else if (start) when = `${fmtDT(start)}${end && !slot ? ` → ${fmtDT(end, { dow: false })}` : ""}`;
  const total = d.total === "" ? undefined : Number(d.total);
  const payment = d.payStatus ? { status: d.payStatus, total, paid: d.paid === "" ? (d.payStatus === "paid" ? total : undefined) : Number(d.paid), currency: d.currency, dueDate: t(d.dueDate) } : undefined;
  const nights = d.kind === "stay" && start && end ? daysBetween(start, end) : 0;
  let dayN = d.dayN ? Number(d.dayN) : undefined;
  if (!dayN && start) { const n = daysBetween(trip.start, start) + 1; if (n >= 1 && n <= trip.days.length) dayN = n; }
  const adults = d.adults === "" ? undefined : Number(d.adults);
  const kids = d.children.split(/[,\s]+/).filter(Boolean).map(Number);
  const seatsFilled = Object.fromEntries(Object.entries(d.seats).filter(([, v]) => v.trim()));
  return {
    ...base, id: base?.id ?? `r-new-${Date.now()}`, kind: d.kind, status: d.status, title: d.title.trim(), when,
    code: t(d.code), provider: t(d.provider), where: t(d.where), address: t(d.address), phone: t(d.phone), email: t(d.email), manageUrl: t(d.manageUrl),
    start, end, tz: d.tz, legs, seats: d.kind === "flight" && Object.keys(seatsFilled).length ? seatsFilled : undefined,
    guests: adults != null || kids.length ? { adults: adults ?? 0, children: kids } : undefined,
    rooms: d.rooms ? Number(d.rooms) : undefined, roomType: d.kind === "stay" ? t(d.roomType) : undefined,
    vehicleClass: d.kind === "car" ? t(d.vehicleClass) : undefined, pickupPlace: d.kind === "car" ? t(d.pickupPlace) : undefined, dropoffPlace: d.kind === "car" ? t(d.dropoffPlace) : undefined,
    slotTime: slot ? t(d.slotTime) : undefined, entryFrom: slot ? t(d.entryFrom) : undefined, entryBy: slot ? t(d.entryBy) : undefined,
    payment, cost: total != null ? `${sym(d.currency)}${num(total)}` : base?.cost,
    freeCancellationUntil: t(d.freeCancel), holdUntil: d.status === "held" ? t(d.holdUntil) : undefined,
    attachments: d.attachments.length ? d.attachments : undefined, notes: t(d.notes), note: base?.note && !d.notes ? base.note : undefined,
    nights: base?.nights ?? (nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : undefined), dayN, itemId: t(d.itemId),
  };
}

// ---- reading a pasted confirmation -------------------------------------------------------------------------------
export const SAMPLE_FLIGHT = `From: Air Canada <confirmation@aircanada.ca>
Subject: Your booking confirmation - K7Q2PZ

Booking reference: K7Q2PZ
Passengers: SINGH/NITIN MR, SINGH/PARTNER MRS, SINGH/AARAV MSTR

Flight 1: AC 892  Toronto (YYZ) Terminal 1 -> Venice (VCE)
  Depart: Mon 12 Jul 2027 18:30   Arrive: Tue 13 Jul 2027 09:05
  Seats: 23A, 23B, 23C   Cabin: Economy

Flight 2: AC 893  Venice (VCE) -> Toronto (YYZ) Terminal 1
  Depart: Mon 26 Jul 2027 11:50   Arrive: Mon 26 Jul 2027 15:10

Total: CAD 4,212.36
Payment: Paid in full by card
Manage your booking: https://www.aircanada.com/ca/en/aco/home/book/manage-bookings.html
Questions: +1 888 247 2262`;
export const SAMPLE_HOTEL = `From: Booking.com <customer.service@booking.com>
Subject: Booking confirmed - Example hotel, Ortisei

Confirmation number: HP-48127
Property: Example hotel, Ortisei
Address: Via Rezia 22, 39046 Ortisei BZ, Italy
Phone: +39 0471 796 100
Check-in: Wed 21 Jul 2027 from 15:00
Check-out: Sun 25 Jul 2027 by 10:00
Guests: 2 adults, 1 child (10)
Room: Family room, 1 room
Total price: EUR 1,560.00
Payment: pay at the property
Free cancellation until 1 Jul 2027 23:59
Manage your booking: https://secure.booking.com/mybooking.html?ref=HP-48127`;

export interface Reading { kind: Kind; found: string[]; missing: string[]; patch: Partial<Draft>; seatList: string[]; pax: string[]; legs: number }
function isoFrom(text: string): string | undefined {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})(?:[^\d]{1,12}?(\d{1,2}:\d{2}))?/);
  const mo = m && MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
  if (!m || mo == null || mo < 0) return undefined;
  return `${m[3]}-${pad(mo + 1)}-${pad(+m[1])}${m[4] ? `T${pad(+m[4].split(":")[0])}:${m[4].split(":")[1]}` : ""}`;
}
export function readConfirmation(t: string, defaultTz: string): Reading {
  const line = (re: RegExp) => t.match(re)?.[1]?.trim();
  const provider = line(/^From:\s*"?([^<\n"]+?)"?\s*(?:<|$)/im)?.replace(/\s+(Customer Service|Reservations|Support)$/i, "");
  const code = line(/(?:booking reference|reference|PNR|confirmation(?: number| code)?)\s*[:\s]\s*([A-Z0-9][A-Z0-9-]{4,13})/i);
  const flights: { num: string; from: string; to: string; dep: string; arr: string }[] = [];
  const re = /\b([A-Z]{2}) ?(\d{2,4})\b[^\n]*?\((\w{3})\)[^\n]*?\((\w{3})\)[\s\S]*?Depart:\s*([^\n]+?)\s{2,}Arrive:\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) flights.push({ num: `${m[1]} ${m[2]}`, from: m[3], to: m[4], dep: m[5], arr: m[6] });
  const pax = (line(/Passengers?:\s*([^\n]+)/i) ?? "").split(",").map(x => x.trim()).filter(Boolean)
    .map(x => { const [last, first] = x.split("/"); return `${(first ?? "").replace(/\s+(MR|MRS|MS|MSTR|MISS)$/, "")} ${last}`.trim(); });
  const seatList = (line(/Seats?:\s*([^\n]+?)(?:\s{2,}|$)/im) ?? "").split(/,\s*/).filter(Boolean);
  const tot = t.match(/Total(?: price)?:\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/);
  const address = line(/^Address:\s*(.+)$/im);
  const phone = line(/(?:Phone|Tel|Questions)[^+\d\n]*(\+?[\d][\d\s().-]{6,})/i);
  const manage = line(/(https?:\/\/\S+)/i);
  const checkIn = line(/Check-?in:\s*([^\n]+)/i); const checkOut = line(/Check-?out:\s*([^\n]+)/i);
  const kind: Kind = flights.length ? "flight" : checkIn ? "stay" : "activity";
  const patch: Partial<Draft> = { kind, status: "booked" };
  const found: string[] = []; const missing: string[] = [];
  const note = (ok: unknown, yes: string, no: string) => (ok ? found : missing).push(ok ? yes : no);
  if (provider) patch.provider = provider; note(provider, `Booked through ${provider}`, "Provider");
  if (code) patch.code = code; note(code, `Code ${code}`, "Confirmation code");
  if (kind === "flight") {
    patch.legs = flights.map(f => ({ num: f.num, from: f.from, to: f.to, dep: isoFrom(f.dep) ?? "", arr: isoFrom(f.arr) ?? "", depTz: AIRPORT_ZONE[f.from] ?? defaultTz, arrTz: AIRPORT_ZONE[f.to] ?? defaultTz, cabin: line(/Cabin:\s*([A-Za-z ]+?)(?:\s{2,}|$)/im) ?? "" }));
    patch.title = `${flights[0].num} ${flights[0].from} → ${flights[0].to}`;
    patch.tz = AIRPORT_ZONE[flights[0].from] ?? defaultTz;
    note(true, `${flights.length} flight leg${flights.length === 1 ? "" : "s"}: ${flights.map(f => `${f.num} ${f.from}→${f.to}`).join(", ")}`, "");
    note(pax.length, `${pax.length} passengers${seatList.length ? `, seats ${seatList.join(" ")}` : ""}`, "Passengers");
    if (pax.length) { patch.adults = String(pax.filter(x => !/AARAV|MSTR/i.test(x)).length || pax.length); }
  } else if (kind === "stay") {
    patch.title = line(/^Property:\s*(.+)$/im) ?? line(/^Subject:.*?-\s*(.+)$/im) ?? "";
    patch.start = isoFrom(checkIn ?? "") ?? ""; patch.end = isoFrom(checkOut ?? "") ?? ""; patch.tz = defaultTz;
    note(patch.start && patch.end, `${fmtDT(patch.start)} to ${fmtDT(patch.end)}`, "Check-in and check-out");
    const g = line(/Guests?:\s*([^\n]+)/i);
    const ad = g?.match(/(\d+)\s+adult/i)?.[1]; const kids = [...(g?.matchAll(/\((\d{1,2})\)/g) ?? [])].map(x => x[1]);
    if (ad) { patch.adults = ad; patch.children = kids.join(", "); } note(ad, `${ad} adults${kids.length ? `, children ${kids.join(", ")}` : ""}`, "Guests");
    const room = line(/^Room:\s*(.+)$/im); if (room) { patch.roomType = room.replace(/,?\s*\d+ rooms?$/i, ""); patch.rooms = room.match(/(\d+) rooms?/i)?.[1] ?? "1"; } note(room, `Room ${room}`, "Room");
    const fc = t.match(/Free cancellation until\s+([^\n]+)/i)?.[1]; const fci = fc && isoFrom(fc);
    if (fci) { patch.freeCancel = fci; found.push(`Free cancellation until ${fmtDT(fci, { year: true })}`); }
  }
  if (address) patch.address = address; note(address, "Address", "Address");
  if (phone) patch.phone = phone.trim();
  if (manage) { patch.manageUrl = manage; found.push("Manage link"); }
  if (tot) {
    patch.currency = tot[1]; patch.total = tot[2].replace(/,/g, "");
    const paid = /paid in full|payment received/i.test(t); const onArr = /pay (?:at|on) (?:the )?(?:property|arrival)/i.test(t);
    patch.payStatus = paid ? "paid" : onArr ? "pay_on_arrival" : "unpaid"; if (paid) patch.paid = patch.total;
    found.push(`Total ${tot[1]} ${tot[2]}${paid ? ", paid" : onArr ? ", pay on arrival" : ""}`);
  } else missing.push("Total");
  return { kind, found: found.filter(Boolean), missing, patch, seatList, pax, legs: flights.length };
}
