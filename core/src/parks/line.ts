// The park line (protected-area-entry 6.2 "Park line", 6.4, 6.5 `TripPark`): for each park or zone a trip enters, its own entry needs
// for the trip's visit modes and months, the pass that covers them, the other parks on the trip that pass covers, and, only when the
// prices compare (QP5), a "pass is likely cheaper" line. Pure, over the graph index's `requirementsOf` (entity-graph 7.2).
//
//   "Banff National Park, days 3 to 6 and 9 to 11: entry fee each day, or the Discovery Pass covers it (also Jasper, Yoho and Kootenay
//    on this trip)"
//
// Public output: names, slugs and day numbers only. No record ref (legacy refs name dated trip folders), no party, no date (public trips
// are dateless), no price claim without comparable units: never per party, never "per person" against "per family" (the stay-bases
// silence rule).
import type { GraphIndex } from "../graph/build.ts";
import { entryOverride, requirementsOf } from "../graph/requires.ts";
import { bookRuleText } from "../export/bookings.ts";
import { bookRuleFromWindow, PASS_TYPES, requirementKind, singleDay, WINDOW_NOT_PUBLISHED } from "../export/requirements.ts";
import type { BookingKind } from "../export/types.ts";
import type { ParkKind, ParkVisit, VisitMode } from "./visits.ts";

type Loose = Record<string, any>;
const unwrap = (x: unknown): any => (x && typeof x === "object" && !Array.isArray(x) && "v" in (x as object) ? (x as { v: unknown }).v : x);
const under = (type: string, prefix: string): boolean => type === prefix || type.startsWith(`${prefix}.`);

export type ParkState = "requirements" | "none_needed" | "not_checked";

/** `TripPark` of core/src/schema/api/trip.ts. */
export interface TripPark {
  slug: string | null;
  name: string;
  kind: ParkKind;
  parent: { slug: string | null; name: string } | null;
  days: number[];
  nights: number[];
  modes: VisitMode[];
  state: ParkState;
  needs: { name: string; kind: BookingKind; text: string }[];
  /** the name of the pass that covers the park's needs, or null */
  coveredBy: string | null;
  line: string;
  saving: string | null;
}

export interface TripParksOpts {
  /** the trip's season months (1 to 12): keep requirements in force in any of them; every month when absent */
  months?: readonly number[];
  /** the public slug of a park record; default: the `<slug>` of a `place/<slug>` ref, else null */
  slugOf?: (ref: string) => string | null;
}

/** The words a park line uses for a requirement's type, by the leaf under `access.pass` (and the two other requirement kinds). */
const TYPE_WORDS: readonly [string, string][] = [
  ["access.pass.entry_fee", "entry fee"], ["access.pass.park_pass", "park pass"], ["access.pass.vehicle_permit", "vehicle permit"],
  ["access.pass.timed_entry", "timed entry"], ["access.pass.day_use_permit", "day-use permit"], ["access.pass.backcountry_permit", "backcountry permit"],
  ["access.pass.shuttle_seat", "shuttle seat"], ["access.pass.activity_permit", "activity permit"], ["access.pass.lift_pass", "lift pass"],
  ["access.park", "parking"], ["stay.camp", "campsite"],
];
export function requirementWords(type: string): string {
  return TYPE_WORDS.find(([t]) => under(type, t))?.[1] ?? "permit";
}

/** "day 3", "days 3 and 5", "days 3 to 6 and 9 to 11": the trip days, as runs. */
export function daysText(days: readonly number[]): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (!d.length) return "";
  if (d.length === 1) return `day ${d[0]}`;
  const runs: string[] = [];
  for (let i = 0; i < d.length; ) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j]! + 1) j++;
    runs.push(j > i ? `${d[i]} to ${d[j]}` : `${d[i]}`);
    i = j + 1;
  }
  return `days ${listText(runs)}`;
}

/** "a", "a and b", "a, b and c". */
export function listText(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Other parks named after the line's own park drop the words they share at the end ("Jasper" beside "Banff National Park"). */
export function shortNames(own: string, others: readonly string[]): string[] {
  const words = [own, ...others].map((n) => n.split(/\s+/));
  let k = 0;
  while (words.every((w) => w.length > k + 1 && w[w.length - 1 - k] === words[0]![words[0]!.length - 1 - k])) k++;
  return k ? others.map((n) => n.split(/\s+/).slice(0, -k).join(" ")) : [...others];
}

const defaultSlug = (ref: string): string | null => /^place\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(ref)?.[1] ?? null;

interface OwnNeed { ref: string; rec: Loose; coveredBy: string[] }

/**
 * A park's own requirements for a visit: those `at` or `on` the park itself (a member's own needs, a shuttle `at` a lake, are rows of
 * entryNeeds, not the park line), needed for one of the visit's modes, in force in one of the months. A pass that is itself a need and
 * covers another need is folded into that need ("or the pass covers it").
 */
function ownNeeds(g: GraphIndex, v: ParkVisit, months: readonly number[] | undefined): OwnNeed[] {
  const lists = months?.length ? months.map((month) => requirementsOf(g, v.ref, { month })) : [requirementsOf(g, v.ref)];
  const seen = new Map<string, OwnNeed>();
  for (const n of lists.flat()) {
    if (n.inheritedFrom !== v.ref || seen.has(n.ref)) continue;
    const rec = (g.recs.get(n.ref) ?? {}) as Loose;
    // the graph's own mode filter reads a bare entry; a captured entry is a sourced value, so the mode is checked here on its value
    const needed = (unwrap(rec.entry) as Loose | undefined)?.needed_for;
    if (Array.isArray(needed) && !v.modes.some((m) => needed.includes(m))) continue;
    seen.set(n.ref, { ref: n.ref, rec, coveredBy: n.coveredBy });
  }
  const all = [...seen.values()];
  const covering = new Set(all.flatMap((n) => n.coveredBy));
  return all.filter((n) => !covering.has(n.ref));
}

function needText(rec: Loose, firstDay: number | null): string {
  const rule = bookRuleFromWindow(rec.window, firstDay);
  if (rule) return bookRuleText(rule);
  return rec.window && typeof rec.window === "object" && (rec.window as Loose).state === "searched_none" ? WINDOW_NOT_PUBLISHED : "";
}

const isPassType = (rec: Loose): boolean => PASS_TYPES.some((t) => under(String(rec.type ?? ""), t));

/** The day prices of a fee and the price of a pass, per one comparable unit (QP5): family or vehicle, same currency, no residency band. */
function priceOf(rec: Loose, per: string): { amount: number; currency: string } | null {
  const rows = unwrap(rec.price);
  if (!Array.isArray(rows)) return null;
  const hit = rows.filter((r: Loose) => r?.per === per && r.residency === undefined && typeof r.amount === "number");
  return hit.length === 1 ? { amount: hit[0].amount, currency: hit[0].currency } : null;
}

/**
 * "For 11 park days, the Discovery Pass is likely cheaper than the daily entry fee (family price)": only when every covered fee is a
 * one-day fee with one price per the same unit (family, else vehicle), the same amount and currency as each other and as the pass, and
 * the day count is known. Otherwise null: the line says "covers it" without a saving claim (QP5).
 */
export function passSaving(pass: Loose, fees: readonly Loose[], dayCount: number): string | null {
  if (!fees.length || dayCount < 1 || !fees.every(singleDay)) return null;
  for (const per of ["family", "vehicle"]) {
    const p = priceOf(pass, per);
    const f = fees.map((x) => priceOf(x, per));
    if (!p || f.some((x) => !x || x.currency !== p.currency || x.amount !== f[0]!.amount)) continue;
    if (p.amount < f[0]!.amount * dayCount) {
      const what = [...new Set(fees.map((x) => requirementWords(String(x.type ?? ""))))];
      return `For ${dayCount} park day${dayCount === 1 ? "" : "s"}, the ${pass.name} is likely cheaper than the daily ${listText(what)} (${per} price)`;
    }
    return null;
  }
  return null;
}

/**
 * The park lines of a trip (6.2), one per park or zone visited, in visit order. A zone with no requirement of its own is left out: its
 * park's line already says what applies (the Lake Louise area under Banff). A park with no requirement and no sourced "no fee" says
 * "Entry not checked yet for <park>" (4.5).
 */
export function tripParks(g: GraphIndex, visits: readonly ParkVisit[], opts: TripParksOpts = {}): TripPark[] {
  const slugOf = opts.slugOf ?? defaultSlug;
  const needsBy = new Map(visits.map((v) => [v.ref, ownNeeds(g, v, opts.months)]));
  const kept = visits.filter((v) => v.kind !== "zone" || needsBy.get(v.ref)!.length > 0);
  // passes: which visited parks each covers, in visit order
  const parksOfPass = new Map<string, ParkVisit[]>();
  for (const v of kept) for (const p of new Set(needsBy.get(v.ref)!.flatMap((n) => n.coveredBy))) parksOfPass.set(p, [...(parksOfPass.get(p) ?? []), v]);
  const savingDone = new Set<string>();

  return kept.map((v) => {
    const own = needsBy.get(v.ref)!;
    const first = v.days[0] ?? null;
    const passRefs = [...new Set(own.flatMap((n) => n.coveredBy))].filter((p) => g.recs.has(p));
    const passName = passRefs.length ? (g.recs.get(passRefs[0]!)!.name ?? null) : null;
    const needs = own.map((n) => ({ name: String(n.rec.name ?? requirementWords(String(n.rec.type ?? ""))), kind: requirementKind(n.rec) as BookingKind, text: needText(n.rec, first) }));
    const where = `${v.name}, ${daysText(v.days)}`;
    let state: ParkState;
    let line: string;
    let saving: string | null = null;
    if (own.length) {
      state = "requirements";
      const clauses = own.map((n) => {
        const words = requirementWords(String(n.rec.type ?? ""));
        const each = isPassType(n.rec) && singleDay(n.rec) ? " each day" : "";
        const covers = n.coveredBy.filter((p) => g.recs.has(p)).map((p) => `the ${g.recs.get(p)!.name}`);
        return `${words}${each}${covers.length ? `, or ${covers.join(" or ")} covers it` : ""}`;
      });
      const also = passRefs.length ? (parksOfPass.get(passRefs[0]!) ?? []).filter((x) => x.ref !== v.ref).map((x) => x.name) : [];
      line = `${where}: ${clauses.join("; ")}${also.length ? ` (also ${listText(shortNames(v.name, also))} on this trip)` : ""}`;
      const pass = passRefs[0];
      if (pass && !savingDone.has(pass)) {
        savingDone.add(pass);
        const parks = parksOfPass.get(pass) ?? [];
        const fees = parks.flatMap((x) => needsBy.get(x.ref)!.filter((n) => n.coveredBy.includes(pass)).map((n) => n.rec));
        const dayCount = new Set(parks.flatMap((x) => x.days)).size;
        saving = passSaving(g.recs.get(pass) as unknown as Loose, fees, dayCount);
      }
    } else if (entryOverride(g, v.ref) || requirementsOf(g, v.ref).some((n) => n.inheritedFrom === v.ref)) {
      // a sourced "no fee", or requirements that none of this visit's modes and months need
      state = "none_needed";
      line = `${where}: no entry fee or permit needed for this visit`;
    } else {
      state = "not_checked";
      line = `Entry not checked yet for ${v.name}`;
    }
    const parentRec = v.parent ? g.recs.get(v.parent) : undefined;
    const parent = v.parent && parentRec ? { slug: slugOf(v.parent), name: parentRec.name ?? "Unnamed protected area" } : null;
    return { slug: slugOf(v.ref), name: v.name, kind: v.kind, parent, days: v.days, nights: v.nights, modes: v.modes, state, needs, coveredBy: passName, line, saving };
  });
}
