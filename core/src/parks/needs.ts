// Entry needs and entry for a member (protected-area-entry 6.2, 6.5; entity-graph 7.2). "What do I need to enter on date X as a day
// visitor, a camper, a backcountry camper?" and "what must I book and by when?", answered from the graph index alone: the park's requirement
// offers and the ones a member inherits (`requirementsOf`), cut by the visit mode, the date or month, and who is in the party.
//
// Pure and dateless in what it says: a rule is "opens 90 days before", a Day N only when the caller gives the trip days. Every row says
// where it comes from (QG3): the park, a zone, or the start, payoff or an access point of the trail. The record ref stays on the row for
// the server; the public mapper must not print it (legacy refs name dated trip folders).
//
// Honest states (4.5): no requirement record and no sourced "no fee" is `not_checked`; requirements that this visit does not need, or a
// sourced "no fee", is `none_needed`. A pass is a saving only when the prices compare (QP5, `passSaving`).
import type { GraphIndex, Via } from "../graph/build.ts";
import { entryOverride, inherited, requirementsOf } from "../graph/requires.ts";
import { bookRuleText } from "../export/bookings.ts";
import type { BookingSource } from "../export/bookings.ts";
import { bookRuleFromWindow, PASS_TYPES, requirementKind, requirementRows, WINDOW_NOT_PUBLISHED } from "../export/requirements.ts";
import type { BookingKind } from "../export/types.ts";
import { passSaving, requirementWords } from "./line.ts";
import type { VisitMode } from "./visits.ts";

type Loose = Record<string, any>;
const unwrap = (x: unknown): any => (x && typeof x === "object" && !Array.isArray(x) && "v" in (x as object) ? (x as { v: unknown }).v : x);
const under = (type: string, prefix: string): boolean => type === prefix || type.startsWith(`${prefix}.`);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Who is visiting. `who` are exemption kinds that apply (`camper`, `through_traffic`, `pass_holder`, `resident`, `school_group`). */
export interface EntryParty {
  who?: readonly string[];
  /** the ages of the people; a free band (price row of amount 0 with `age_to`) then frees those people from that fee */
  ages?: readonly number[];
  /** the party's residency, to pick the price rows (a row with none applies to all) */
  residency?: "resident" | "national" | "foreign";
}

export interface EntryQuery {
  mode: VisitMode;
  /** `YYYY-MM-DD`: season, closures and park access are checked on that day */
  date?: string;
  /** 1 to 12, when only the month is known; ignored when `date` is given */
  month?: number;
  party?: EntryParty;
  /** the trip days the visit uses (Day N for the rules; one row per day for a one-day seat) */
  days?: readonly number[];
  /** how many park days, for the pass line (QP5); `days.length` when absent */
  dayCount?: number;
  /** members the visitor goes to (a trail, a lake, a campground, a zone): their own needs are added, each labelled with its source */
  visiting?: readonly string[];
  /** activity type ids for `entry.for_types` */
  types?: string[];
}

export interface EntrySource {
  ref: string;
  name: string;
  /** how the chain reached the record (QG3) */
  via: Via;
  kind: "park" | "zone" | "place";
  /** "Banff National Park", "Lake O'Hara", "Mirror Lake shuttle stop, the trail's start" */
  label: string;
}

export interface EntryRow {
  ref: string;
  name: string;
  type: string;
  /** "entry fee", "timed entry", "campsite" (the words the park line uses) */
  words: string;
  /** booking: a window to watch; pass: buy any time; check: nothing to book (a check is never counted "to book") */
  kind: Exclude<BookingKind, "task">;
  source: EntrySource;
  /** the rule in words ("Buy any time", "Lottery: ..."), or "Booking window not published; ...", or "" */
  rule: string;
  /** the Book ahead rows of the requirement for the trip days given: one per ridden day for a one-day seat; else one row (or none: no days) */
  bookings: BookingSource[];
  required: string | null;
  price: Loose[];
  /** the party's split of a fee with an age band: how many pay and how many are free (null without ages or bands) */
  partyPays: { paying: number; free: number } | null;
  /** the passes that cover it, and what is `included_in` */
  coveredBy: { ref: string; name: string }[];
  /** the alternatives of the same need (an `alternative_to` pair) */
  alternatives: { ref: string; name: string; source: EntrySource }[];
  exemptions: string[];
  /** the season rows that bound it, when it has them */
  season: { from: string; to: string }[] | null;
}

export interface EntryExempted { row: EntryRow; why: string }

export type EntryState = "requirements" | "none_needed" | "not_checked";
export interface EntryAccess {
  state: "open" | "limited" | "closed" | "unknown";
  notes: { text: string; from: string }[];
}

export interface EntryResult {
  ref: string;
  name: string;
  mode: VisitMode;
  state: EntryState;
  rows: EntryRow[];
  /** needs this party is exempt from or does not pay (labelled with why); they are not in `rows` */
  exempted: EntryExempted[];
  /** the counts a Bookings tab says: only `booking` rows are "to book" (QP3) */
  counts: { toBook: number; pass: number; check: number };
  /** "Nothing to book ahead" or "<n> to book ahead"; "Entry not checked yet" for a park with no requirement record */
  summary: string;
  /** standing season state and published closures on the date (or month); live closures are never stored */
  access: EntryAccess;
  closures: { text: string; status: "closed" | "limited"; from: string }[];
  /** gated zones of the park with needs of their own that this result does not include, when the visit might go there */
  elsewhere: { ref: string; name: string; count: number }[];
  /** "For 10 park days, the X is likely cheaper ..." only per QP5, else null */
  saving: string | null;
}

// ---- dates ---------------------------------------------------------------------------------------------------------------------------

const mmddOf = (s: string): number => Number(s.slice(0, 2)) * 100 + Number(s.slice(3, 5));
const inRange = (d: number, from: number, to: number): boolean => (from <= to ? d >= from && d <= to : d >= from || d <= to);
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

interface When { year: number | null; month: number | null; mmdd: number | null }
function whenOf(q: Pick<EntryQuery, "date" | "month">): When {
  const m = q.date ? ISO.exec(q.date) : null;
  if (q.date && !m) throw new Error(`entry query date must be YYYY-MM-DD, got "${q.date}"`);
  if (m) return { year: Number(m[1]), month: Number(m[2]), mmdd: Number(m[2]) * 100 + Number(m[3]) };
  if (q.month !== undefined && (!Number.isInteger(q.month) || q.month < 1 || q.month > 12)) throw new Error(`entry query month must be 1 to 12, got ${q.month}`);
  return { year: null, month: q.month ?? null, mmdd: null };
}
/** `from` to `to` of a season row, MM-DD, wrapping the new year */
function rowHits(r: { from: string; to: string }, w: When): boolean {
  if (w.mmdd !== null) return inRange(w.mmdd, mmddOf(r.from), mmddOf(r.to));
  if (w.month !== null) { const a = w.month * 100 + 1, b = w.month * 100 + 31; return inRange(a, mmddOf(r.from), mmddOf(r.to)) || inRange(b, mmddOf(r.from), mmddOf(r.to)) || inRange(mmddOf(r.from), a, b); }
  return true;
}
/** a closure date as an ISO range of days (a year, a month or a day), or MM-DD recurring */
function closureHits(c: { from: string; to?: string }, w: When): boolean {
  const recurring = /^\d{2}-\d{2}$/.test(c.from);
  if (recurring) return rowHits({ from: c.from, to: c.to ?? c.from }, w);
  if (w.year === null) return false; // a dated closure needs a dated query
  const lo = (s: string): string => (s.length === 4 ? `${s}-01-01` : s.length === 7 ? `${s}-01` : s);
  const hi = (s: string): string => (s.length === 4 ? `${s}-12-31` : s.length === 7 ? `${s}-31` : s);
  const day = `${w.year}-${String(Math.floor(w.mmdd! / 100)).padStart(2, "0")}-${String(w.mmdd! % 100).padStart(2, "0")}`;
  if (w.mmdd === null) return false;
  return day >= lo(c.from) && (c.to === undefined || day <= hi(c.to));
}

// ---- rows ----------------------------------------------------------------------------------------------------------------------------

function sourceOf(g: GraphIndex, ref: string, via: Via): EntrySource {
  const rec = g.recs.get(ref);
  const name = rec?.name ?? "Unnamed place";
  const type = rec?.type ?? "";
  const kind = under(type, "nature.protected.zone") ? "zone" : under(type, "nature.protected") ? "park" : "place";
  const how: Partial<Record<Via, string>> = { start: "the trail's start", payoff: "the trail's payoff", end: "the trail's end", access: "an access point", primary: "its main route" };
  const phrase = how[via];
  const label = !phrase ? name : kind === "place" ? `${name}, ${phrase}` : `${name}, reached through ${phrase}`;
  return { ref, name, kind, via, label };
}

/** a requirement's modes: its `needed_for`, else the type's (a campsite is for nights, a backcountry site for backcountry nights) */
function neededFor(rec: Loose): string[] | null {
  const nf = (unwrap(rec.entry) as Loose | undefined)?.needed_for;
  if (Array.isArray(nf)) return nf;
  const t = String(rec.type ?? "");
  if (under(t, "stay.camp.backcountry_site")) return ["overnight_back"];
  if (under(t, "stay.camp")) return ["overnight_front"];
  return null;
}

function priceRows(rec: Loose, party: EntryParty | undefined): Loose[] {
  const rows = unwrap(rec.price);
  if (!Array.isArray(rows)) return [];
  return rows.filter((r: Loose) => !r?.residency || !party?.residency || r.residency === party.residency);
}

function partyPays(price: Loose[], ages: readonly number[] | undefined): EntryRow["partyPays"] {
  if (!ages?.length) return null;
  const free = price.filter((r) => r.amount === 0 && (typeof r.age_to === "number" || typeof r.age_from === "number"));
  if (!free.length) return null;
  const isFree = (a: number): boolean => free.some((r) => a >= (r.age_from ?? 0) && a <= (r.age_to ?? 200));
  const f = ages.filter(isFree).length;
  return { paying: ages.length - f, free: f };
}

const exemptionKinds = (rec: Loose): string[] => {
  const ex = (unwrap(rec.entry) as Loose | undefined)?.exemptions;
  return Array.isArray(ex) ? ex.map((e: unknown) => (typeof e === "string" ? e : String((e as Loose)?.who ?? ""))).filter(Boolean) : [];
};

/** A requirement offer is in force on the day: some open season row has it, or it has no season (or only rows of another year) */
function inForce(rec: Loose, w: When): boolean {
  if (w.mmdd === null) return true; // the month is filtered by requirementsOf
  const rows = unwrap(rec.season);
  if (!Array.isArray(rows) || !rows.length) return true;
  const mine = rows.filter((r: Loose) => !r.applies_to || Number(r.applies_to) === w.year);
  if (!mine.length) return true;
  return mine.some((r: Loose) => r.status !== "closed" && rowHits(r as { from: string; to: string }, w));
}

function dayText(rec: Loose, first: number | null): string {
  const rule = bookRuleFromWindow(rec.window, first);
  if (rule) return bookRuleText(rule);
  const win = rec.window as Loose | undefined;
  return win && typeof win === "object" && win.state === "searched_none" ? WINDOW_NOT_PUBLISHED : "";
}

interface Collected { need: ReturnType<typeof requirementsOf>[number]; asked: string }

/** the needs of one record for the query, in force on the day, for the mode (typed defaults for campsites) */
function needsOf(g: GraphIndex, ref: string, q: EntryQuery, w: When, lodging = false): Collected[] {
  // with a date, the season is checked here, per year (`applies_to`); the graph's month filter ignores the year
  const base = requirementsOf(g, ref, { mode: q.mode, month: w.mmdd === null ? (w.month ?? undefined) : undefined, types: q.types });
  if (lodging) {
    // a campsite is a lodging offer, not an access offer, so the graph's requirements do not list it: the offers `at` the campground do
    for (const o of g.inv.get(ref)?.offers_at ?? []) {
      const r = g.recs.get(o);
      if (r && under(r.type, "stay.camp")) base.push({ ref: o, inheritedFrom: ref, via: "self", options: [{ ref: o, inheritedFrom: ref, via: "self" }], coveredBy: [...(((r as unknown as Loose).covered_by as string[] | undefined) ?? [])].sort(), includedIn: [] });
    }
  }
  const out: Collected[] = [];
  for (const need of base) {
    const rec = (g.recs.get(need.ref) ?? {}) as Loose;
    const nf = neededFor(rec);
    if (nf && !nf.includes(q.mode)) continue;
    if (!inForce(rec, w)) continue;
    // a permit `on` a route is that route's (and its stages'), though it is `at` the park: a lake does not inherit it, the park's own list keeps it
    const on = Array.isArray(rec.on) ? (rec.on as Loose[]).map((x) => String(x?.ref ?? x)) : [];
    if (on.length && need.inheritedFrom !== ref && !g.chainOf(ref).some((c) => on.includes(c.ref))) continue;
    out.push({ need, asked: ref });
  }
  return out;
}

function rowOf(g: GraphIndex, c: Collected, q: EntryQuery, key: string, parkName: string): EntryRow {
  const rec = (g.recs.get(c.need.ref) ?? {}) as Loose;
  const price = priceRows(rec, q.party);
  const days = q.days ?? [];
  const first = days.length ? Math.min(...days) : null;
  const options = c.need.options.filter((o) => o.ref !== c.need.ref);
  const row: EntryRow = {
    ref: c.need.ref,
    name: String(rec.name ?? requirementWords(String(rec.type ?? ""))),
    type: String(rec.type ?? ""),
    words: requirementWords(String(rec.type ?? "")),
    kind: requirementKind(rec),
    source: sourceOf(g, c.need.inheritedFrom, c.need.via),
    rule: dayText(rec, first),
    bookings: days.length ? requirementRows(rec, { key, days, park: parkName }) : [],
    required: ((unwrap(rec.entry) as Loose | undefined)?.required as string | undefined) ?? null,
    price,
    partyPays: partyPays(price, q.party?.ages),
    coveredBy: c.need.coveredBy.filter((p) => g.recs.has(p)).map((p) => ({ ref: p, name: String(g.recs.get(p)!.name ?? "Pass") })),
    alternatives: options.map((o) => ({ ref: o.ref, name: String(g.recs.get(o.ref)?.name ?? ""), source: sourceOf(g, o.inheritedFrom, o.via) })),
    exemptions: exemptionKinds(rec),
    season: ((): EntryRow["season"] => { const s = unwrap(rec.season); return Array.isArray(s) && s.length ? s.filter((r: Loose) => r.status !== "closed").map((r: Loose) => ({ from: r.from, to: r.to })) : null; })(),
  };
  return row;
}

function accessOf(g: GraphIndex, ref: string, w: When): { access: EntryAccess; closures: EntryResult["closures"] } {
  const notes: EntryAccess["notes"] = [];
  let state: EntryAccess["state"] = "unknown";
  const season = inherited(g, ref, "season");
  const hit = (v: { value: unknown }) => (v.value as { from: string; to: string; status?: string; note?: string; applies_to?: string }[]).filter((r) => !r.applies_to || w.year === null || Number(r.applies_to) === w.year);
  if (season.values.length && (w.mmdd !== null || w.month !== null)) {
    const rows = season.values.flatMap((v) => hit(v).filter((r) => rowHits(r, w)).map((r) => ({ r, from: v.from })));
    const open = season.effective ? season.effective.some((e) => rowHits(e, w)) : rows.some((x) => x.r.status !== "closed");
    state = open ? (rows.some((x) => x.r.status === "limited") ? "limited" : "open") : "closed";
    for (const x of rows) if (x.r.note && x.r.status !== "open") notes.push({ text: x.r.note, from: x.from });
  }
  const closures: EntryResult["closures"] = [];
  for (const c of g.chainOf(ref)) {
    const rec = (g.recs.get(c.ref) ?? {}) as Loose;
    const rows = [
      ...(((unwrap(rec.closures) as Loose[] | undefined) ?? []).map((x) => ({ from: x.from, to: x.to, status: x.status as "closed" | "limited", text: String(x.why ?? "") }))),
      ...((((unwrap(rec.hours) as Loose | undefined)?.closures as Loose[] | undefined) ?? []).map((x) => ({ from: x.from, to: x.to, status: "closed" as const, text: String(x.why ?? "") }))),
    ];
    for (const r of rows) if (closureHits(r, w)) closures.push({ text: r.text, status: r.status, from: c.ref });
  }
  if (closures.some((x) => x.status === "closed")) state = "closed";
  return { access: { state, notes }, closures };
}

const isPass = (rec: Loose): boolean => PASS_TYPES.some((t) => under(String(rec.type ?? ""), t));

/**
 * What a visitor of `ref` needs (the heart of both entry functions): the requirements of `ref` and of the records it `visiting`, for the
 * mode, the date or month and the party. Exempt rows move to `exempted` with the reason.
 */
function resolve(g: GraphIndex, ref: string, q: EntryQuery, extra: readonly string[], campsFor: readonly string[]): EntryResult {
  const rec = g.recs.get(ref);
  if (!rec) throw new Error(`entry: unknown record "${ref}"`);
  const w = whenOf(q);
  const asks = [ref, ...extra.filter((x) => x !== ref), ...campsFor];
  const seen = new Map<string, Collected>();
  for (const a of asks) for (const c of needsOf(g, a, q, w, campsFor.includes(a))) {
    const old = seen.get(c.need.ref);
    // the nearest record to the visitor says where it comes from: the first ask that has it
    if (!old) seen.set(c.need.ref, c);
  }
  // a pass that is itself a need and covers another need is folded into that need's `coveredBy`, as the park line does
  const all = [...seen.values()].sort((a, b) => cmp(a.need.ref, b.need.ref));
  const covering = new Set(all.flatMap((c) => c.need.coveredBy));
  const parkName = String(rec.name ?? "Unnamed protected area");
  const rows: EntryRow[] = [];
  const exempted: EntryExempted[] = [];
  const who = q.party?.who ?? [];
  let k = 0;
  for (const c of all) {
    if (covering.has(c.need.ref)) continue;
    const row = rowOf(g, c, q, `entry-${k++}`, parkName);
    const hitWho = row.exemptions.find((e) => who.includes(e));
    if (hitWho) { exempted.push({ row: row, why: hitWho }); continue; }
    if (isPass((g.recs.get(row.ref) ?? {}) as Loose) && row.partyPays && row.partyPays.paying === 0) { exempted.push({ row: row, why: "free for this party" }); continue; }
    rows.push(row);
  }
  const counts = {
    toBook: rows.filter((r) => r.kind === "booking").length,
    pass: rows.filter((r) => r.kind === "pass").length,
    check: rows.filter((r) => r.kind === "check").length,
  };

  const chain = g.chainOf(ref).map((c) => c.ref);
  const free = entryOverride(g, ref) || (!g.reqOf(ref).length && chain.some((r) => r !== ref && entryOverride(g, r)));
  const known = g.reqOf(ref).length > 0 || asks.slice(1).some((a) => g.reqOf(a).length > 0);
  let state: EntryState = rows.length ? "requirements" : free || known ? "none_needed" : "not_checked";
  if (!rows.length && exempted.length) state = "none_needed";
  const summary = state === "not_checked" ? "Entry not checked yet" : state === "none_needed" ? "Nothing to enter or book for this visit" : counts.toBook ? `${counts.toBook} to book ahead` : "Nothing to book ahead";

  // QP5: the pass line only for one pass that covers fees of one unit, each valid one day, with the day count known
  let saving: string | null = null;
  const dayCount = q.dayCount ?? (q.days?.length || 0);
  const pass = rows.flatMap((r) => r.coveredBy.map((p) => p.ref))[0];
  if (pass && dayCount > 0) {
    const fees = rows.filter((r) => r.coveredBy.some((p) => p.ref === pass)).map((r) => (g.recs.get(r.ref) ?? {}) as Loose);
    saving = passSaving(g.recs.get(pass) as unknown as Loose, fees, dayCount);
  }

  const { access, closures } = accessOf(g, ref, w);
  const elsewhere: EntryResult["elsewhere"] = [];
  if (under(rec.type, "nature.protected")) {
    for (const m of g.membersAll(ref)) {
      const mr = g.recs.get(m);
      if (!mr || !under(mr.type, "nature.protected.zone") || asks.includes(m)) continue;
      const n = needsOf(g, m, q, w).filter((c) => c.need.inheritedFrom === m && !seen.has(c.need.ref)).length;
      if (n) elsewhere.push({ ref: m, name: String(mr.name ?? "Unnamed zone"), count: n });
    }
  }
  return { ref, name: parkName, mode: q.mode, state, rows, exempted, counts, summary, access, closures, elsewhere, saving };
}

/**
 * What a visitor of the park needs on that day or in that month, in that mode (6.5: "what do I need to enter ..."; "what must I book and
 * by when"). Day mode gives the entry fee, pass, timed entry and permits; an overnight mode adds the campsites of the park's campgrounds
 * (front) or its backcountry sites and permits (back). `visiting` adds the needs of a zone, trail, lake or campground the visitor goes to.
 */
export function entryNeeds(g: GraphIndex, parkRef: string, q: EntryQuery): EntryResult {
  const members = g.membersAll(parkRef);
  const camps = q.mode === "overnight_front" ? members.filter((m) => under(g.recs.get(m)?.type ?? "", "stay.camp") && !under(g.recs.get(m)?.type ?? "", "stay.camp.backcountry_site"))
    : q.mode === "overnight_back" ? members.filter((m) => under(g.recs.get(m)?.type ?? "", "stay.camp.backcountry_site")) : [];
  return resolve(g, parkRef, q, q.visiting ?? [], camps.filter((m) => !(q.visiting ?? []).includes(m)));
}

/** What a member (a trail, lake or campground) needs, by `requirementsOf`: its own, the park's it inherits, and the ones its start, payoff or access point carry; each row says which. */
export function entryFor(g: GraphIndex, ref: string, q: EntryQuery): EntryResult {
  return resolve(g, ref, q, [], []);
}
