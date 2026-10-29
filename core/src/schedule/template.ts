// A copy of our trip, scheduled with the person's changes (STEP2-C2; gap-analysis H2, D5; edit-mode-spec 5, 6). Pure and
// deterministic like the day scheduler: the published days in, the delta in, one timeline per day of the copy out.
//
// The order is fixed: versions (overrides), then removed stops, moved stops, added places, then the day operations, each list in
// op order. A version is chosen for the published day BEFORE any edit, so removing a stop never swaps the whole day for another
// version; the day's fit is then re-read with the edits. Generated entries (meals, rests, breaks, legs) are never stored: every
// day is scheduled again from its stops, so a meal or a rest that a full day had squeezed out comes back once a stop leaves
// (trip-overview 5.2), and a booking slot is generated from its stop, so it follows the stop to another day. A generated row the
// person removed (STEP2-E1B) is kept as its rule key (ruleRows.ts) and hidden each time the day is scheduled again.
//
// Only the touched days change: an untouched day is scheduled from the same input and options as the public page, and its
// generated ids keep the PUBLISHED day number, so the ids a delta names survive inserted and dropped days (`TemplateDay.n` is the
// number to show). This file is outside the page entry (browser.ts): it loads with edit mode, not with /trips/<slug>/.
import { MOVED_STOP_LEGS } from "../config/schedule.ts";
import { haversineM } from "../geo/distance.ts";
import { estimateLeg } from "./legs.ts";
import { LOCAL_MOVE_MIN, ROUND_MIN } from "./rules.ts";
import { isRuleItem, RULE_PREFIX, ruleKeyOf, rowsOfKeys } from "./ruleRows.ts";
import { scheduleDay } from "./schedule.ts";
import { selectVariant, variantFits } from "./select.ts";
import type {
  DayEdit, DayTimeline, DayVariant, PlacedStop, Point, Profile, ScheduleDayInput, ScheduleItem, ScheduleOptions, StoredLeg, TemplateDay, TemplateDayRef,
  TemplateDelta, TemplateSchedule, TemplateSkip,
} from "./types.ts";

/** One day being edited: what the public page schedules (`input`, `base`) and the person's edits to it. */
export interface EditedDay {
  input: ScheduleDayInput;
  /** The version picked (`variant`) and the visitor's additions placed by cheapest insertion (`added`). */
  base: ScheduleOptions;
  edit: DayEdit;
}

/** The result of one edit on one day: the day as it now stands and its new timeline. */
export interface EditedResult {
  day: EditedDay;
  timeline: DayTimeline;
}

export const emptyDayEdit = (): DayEdit => ({ removed: [], placed: [] });
const noStopEdit = (e: DayEdit): boolean => e.removed.length === 0 && e.placed.length === 0;
const isEmptyEdit = (e: DayEdit): boolean => noStopEdit(e) && !e.hidden?.length;
const asEdited = (input: ScheduleDayInput, base: ScheduleOptions = {}): EditedDay => ({ input, base, edit: emptyDayEdit() });

/**
 * The scheduler options of an edited day. No edit: the base options as they are (the day schedules exactly as on the public page).
 * Otherwise the version is chosen from the published versions, the removed stops leave it and its parallel lane, and the placed
 * stops go in at their places; the fit is read again from the plan's stops and the ones moved here (a visitor's are checked as
 * additions, as today).
 */
export function editDay(input: ScheduleDayInput, profile: Profile, base: ScheduleOptions, edit: DayEdit): ScheduleOptions {
  const opts = editStops(input, profile, base, edit);
  return edit.hidden?.length ? { ...opts, hidden: hiddenIds(input, profile, opts, edit.hidden) } : opts;
}

/**
 * The entry ids of the generated rows the rule keys name (STEP2-E1B), read from the day as it schedules with them hidden. Hiding a row
 * renames no other (ids are named for the stop a row precedes), but its re-flow can bring a row of a listed key into the day (a lunch
 * that moves to where a rest was), so the day is read again until nothing new is found: at most three passes.
 */
function hiddenIds(input: ScheduleDayInput, profile: Profile, opts: ScheduleOptions, keys: string[]): string[] {
  let ids: string[] = [];
  for (let pass = 0; pass < 3; pass++) {
    const more = rowsOfKeys(scheduleDay(input, profile, { ...opts, hidden: ids }).entries, keys).map((e) => e.id).filter((id) => !ids.includes(id));
    if (!more.length) break;
    ids = [...ids, ...more];
  }
  return ids;
}

/** The options of a day's stop edits (removed and placed), before any generated row is hidden. */
function editStops(input: ScheduleDayInput, profile: Profile, base: ScheduleOptions, edit: DayEdit): ScheduleOptions {
  const { selection: _s, visitor: _v, hidden: _h, ...rest } = base;
  if (noStopEdit(edit)) return rest;
  const sel = selectVariant(input, profile, base.variant);
  const rm = new Set(edit.removed);
  let items = sel.variant.items.filter((i) => !rm.has(i.id));
  const visitor: string[] = [];
  for (const p of edit.placed) {
    if (p.addedBy === "visitor") visitor.push(p.item.id);
    const after = typeof p.at === "object" ? items.findIndex((x) => x.id === (p.at as { after: string }).after) : -1;
    const at = p.at === "start" ? 0 : after < 0 ? items.length : after + 1;
    items = [...items.slice(0, at), p.item, ...items.slice(at)];
  }
  const parItems = sel.parallel ? sel.parallel.items.filter((i) => !rm.has(i.id)) : [];
  const parallel: DayVariant | null = sel.parallel && parItems.length ? { ...sel.parallel, items: parItems } : null;
  const variant: DayVariant = { ...sel.variant, items };
  const f = variantFits({ ...variant, items: items.filter((i) => !visitor.includes(i.id)) }, profile);
  let reason = sel.reason;
  if (f.fits !== sel.fits) {
    if (sel.chosenBy === "override") reason = `${variant.label}: picked for this day${f.fits ? "" : `. ${f.reason}`}`;
    else reason = f.fits ? `${variant.label}: fits with your changes` : (f.reason ?? sel.reason);
  }
  return { ...rest, selection: { ...sel, variant, parallel, fits: f.fits, reason }, ...(visitor.length ? { visitor } : {}) };
}

/** Schedules an edited day. */
export const scheduleEdited = (d: EditedDay, profile: Profile): DayTimeline => scheduleDay(d.input, profile, editDay(d.input, profile, d.base, d.edit));
const result = (day: EditedDay, profile: Profile): EditedResult => ({ day, timeline: scheduleEdited(day, profile) });

/**
 * The stops a day holds for a party, in plan order: the chosen version's (less the removed), the ones placed here, then the visitor's
 * additions by cheapest insertion. `lane` says whether the stop is on the party's lane or the adults' parallel lane of a split day.
 */
export function stopsOf(d: EditedDay, profile: Profile): { item: ScheduleItem; addedBy: "author" | "visitor"; lane: "main" | "parallel" }[] {
  const opts = editStops(d.input, profile, d.base, d.edit);
  const sel = opts.selection ?? selectVariant(d.input, profile, d.base.variant);
  const by = (i: ScheduleItem): "author" | "visitor" => (opts.visitor?.includes(i.id) ? "visitor" : "author");
  return [
    ...sel.variant.items.map((item) => ({ item, addedBy: by(item), lane: "main" as const })),
    ...(sel.parallel?.items ?? []).map((item) => ({ item, addedBy: "author" as const, lane: "parallel" as const })),
    ...(d.base.added ?? []).map((item) => ({ item, addedBy: "visitor" as const, lane: "main" as const })),
  ];
}

/** Takes a stop off a day: a stop the person put there leaves their list; a stop of our plan is removed by its schedule id. */
function takeOff(d: EditedDay, id: string): { day: EditedDay; stop: PlacedStop | null; plan: boolean } {
  const pi = d.edit.placed.findIndex((p) => p.item.id === id);
  if (pi >= 0) {
    const stop = d.edit.placed[pi]!;
    return { day: { ...d, edit: { ...d.edit, placed: d.edit.placed.filter((_, j) => j !== pi) } }, stop, plan: false };
  }
  const ai = (d.base.added ?? []).findIndex((i) => i.id === id);
  if (ai >= 0) {
    const item = d.base.added![ai]!;
    return { day: { ...d, base: { ...d.base, added: d.base.added!.filter((_, j) => j !== ai) } }, stop: { item, addedBy: "visitor", at: "end" }, plan: false };
  }
  return { day: { ...d, edit: { ...d.edit, removed: [...d.edit.removed, id] } }, stop: null, plan: true };
}

/** Hides a generated row by its rule key; a key already hidden is not listed twice. */
const hide = (d: EditedDay, key: string): EditedDay => (d.edit.hidden?.includes(key) ? d : { ...d, edit: { ...d.edit, hidden: [...(d.edit.hidden ?? []), key] } });

/**
 * Removes a stop from a day (edit-mode-spec 5 Remove), or a generated row by `rule:` and its rule key (STEP2-E1B; ruleRows.ts). Null
 * when the stop is not on the day for this party, or no row of the day has that key.
 */
export function removeItem(d: EditedDay, profile: Profile, id: string): EditedResult | null {
  if (isRuleItem(id)) {
    const key = id.slice(RULE_PREFIX.length);
    if (!scheduleEdited(d, profile).entries.some((e) => ruleKeyOf(e) === key)) return null;
    return result(hide(d, key), profile);
  }
  if (!stopsOf(d, profile).some((s) => s.item.id === id)) return null;
  return result(takeOff(d, id).day, profile);
}

const sameBase = (a: ScheduleDayInput, b: ScheduleDayInput): boolean => !!a.base && !!b.base && a.base.name === b.base.name;
const endsOf = (it: ScheduleItem): string[] => [it.id, ...(it.placeSlug ? [it.placeSlug] : [])];

/** The day's own published stop of this id, or null: a stop that comes back to its day comes back exactly as published. */
const ownStop = (d: ScheduleDayInput, id: string): ScheduleItem | null => {
  for (const v of d.variants) for (const i of v.items) if (i.id === id) return i;
  return null;
};

/**
 * A stop as it lands on another day (edit-mode-spec 5 Move to day, 6 Drop): its own day's stop as published when it goes home, else the
 * stop with its place page's map point as its point, so the leg ladder reaches it point to point (the published day never reads it).
 */
function arriving(it: ScheduleItem, to: ScheduleDayInput): ScheduleItem {
  const own = ownStop(to, it.id);
  if (own) return own;
  return it.point || !it.placePoint ? it : { ...it, point: { lat: it.placePoint.lat, lon: it.placePoint.lon } };
}

/**
 * The shortest way over a day's stored legs from each of its bases ("base", "next-base"; never "origin", the start of an arrival day) to
 * a stop: [which base, its point, minutes, km or null]. Legs are symmetric unless marked otherwise; a stop is known by its id and slug.
 */
function waysFromBases(d: ScheduleDayInput, ends: string[]): ["base" | "next-base", Point | null, number, number | null][] {
  const name = (x: string): string => (ends.includes(x) ? "@stop" : x);
  const out: ["base" | "next-base", Point | null, number, number | null][] = [];
  for (const [start, at] of [["base", d.base], ["next-base", d.nextBase]] as const) {
    if (!at) continue;
    const best = new Map<string, [number, number | null]>([[start, [0, 0]]]);
    const queue: string[] = [start];
    // Bellman-Ford style relaxation: a day holds a handful of legs, so the plain loop is enough
    while (queue.length) {
      const x = queue.shift()!;
      const [min, km] = best.get(x)!;
      for (const l of d.legs) {
        const a = name(l.from);
        const b = name(l.to);
        const next = a === x ? b : l.symmetric !== false && b === x ? a : null;
        if (!next || next === "origin") continue;
        const was = best.get(next);
        if (was && was[0] <= min + l.minutes) continue;
        best.set(next, [min + l.minutes, km === null || l.km === null ? null : km + l.km]);
        if (next !== "@stop") queue.push(next);
      }
    }
    const hit = best.get("@stop");
    if (hit) out.push([start, at.point, hit[0], hit[1]]);
  }
  return out;
}

const round5 = (min: number): number => Math.max(ROUND_MIN, Math.round(min / ROUND_MIN) * ROUND_MIN);
const estimated = (from: string, to: string, minutes: number, km: number | null): StoredLeg => ({ from, to, mode: "drive", minutes: round5(minutes), km, basis: "estimate", estimate: true, symmetric: true });

/** The drive between two points as the ladder estimates it; nothing for the same spot (under the ladder's walking distance). */
const between = (a: Point, b: Point): { minutes: number; km: number | null } => (haversineM(a, b) < 1200 ? { minutes: 0, km: 0 } : estimateLeg(a, b));

/**
 * The legs a day needs for a stop with no map point moved in from another day (STEP2-C2 gap). From the base: at another base, the drive
 * between the two bases plus the stored way from the stop's own base (or `MOVED_STOP_LEGS.nearOwnBaseMin` when the plan stores none, or
 * `unknownMin` when a base has no point); at the same base, the stored way the day already holds, else the shortest stored way from the
 * base on the stop's own day (Emerald Lakeshore, Day 9 to Day 12: through Natural Bridge, 50 min), else `nearOwnBaseMin` (DG2F: never the
 * ladder's 10 minute local move for a stop the plan reached by road). To each of the day's stops that has no point either, the way through
 * the base. All `estimate` (≈). A stop with a point needs no base leg (the ladder estimates from the point), only the ways through the
 * base to the day's stops that have none. The home point is never read: only the two days' bases and stored legs.
 */
function movedLegs(to: ScheduleDayInput, from: ScheduleDayInput, it: ScheduleItem, others: ScheduleItem[]): StoredLeg[] {
  const ends = endsOf(it);
  const here = to.base?.point ?? null;
  const same = sameBase(to, from);
  const out: StoredLeg[] = [];
  const atBase = (ids: string[], legs: StoredLeg[]): boolean => legs.some((l) => (ids.includes(l.from) && (l.to === "base" || l.to === "next-base")) || (ids.includes(l.to) && (l.from === "base" || l.from === "next-base")));
  // the stop's way from the base: what the day already holds (the same base's legs carried), else estimated here
  const fromBase = (ids: string[]): number | null => waysFromBases(to, ids).find(([w]) => w === "base")?.[2] ?? null;
  // a stop with a point: the ladder reaches it from the base point to point; the day's stops with no point are reached through the base
  // over the day's stored ways (DG2F: the ladder's own fallback knows only a direct base leg, so Canmore to Emerald read 50 min)
  let base = it.point ? (here ? round5(between(here, it.point).minutes) : null) : fromBase(ends);
  if (!it.point && base === null && !atBase(ends, to.legs)) {
    let est: { minutes: number; km: number | null };
    // the same base: the stop is as far from it as on its own day (the shortest stored way there), else the configured near-base guess
    if (same) est = waysFromBases(from, ends).filter(([w]) => w === "base").map(([, , minutes, km]) => ({ minutes, km }))[0] ?? { minutes: MOVED_STOP_LEGS.nearOwnBaseMin, km: null };
    else if (!here || !from.base?.point) est = { minutes: MOVED_STOP_LEGS.unknownMin, km: null };
    else {
      const ways = waysFromBases(from, ends).flatMap(([, p, min, km]) => {
        if (!p) return [];
        const b = between(here, p);
        return [{ minutes: b.minutes + min, km: b.km === null || km === null ? null : b.km + km }];
      });
      const b = between(here, from.base.point);
      est = ways.sort((x, y) => x.minutes - y.minutes)[0] ?? { minutes: b.minutes + MOVED_STOP_LEGS.nearOwnBaseMin, km: null };
    }
    out.push(estimated("base", it.id, est.minutes, est.km === null ? null : Math.round(est.km)));
    base = round5(est.minutes);
  }
  if (base === null) return out;
  const legs = [...to.legs, ...out];
  for (const o of others) {
    if (o.id === it.id || o.point) continue;
    const oe = endsOf(o);
    if (legs.some((l) => (ends.includes(l.from) && oe.includes(l.to)) || (oe.includes(l.from) && ends.includes(l.to)))) continue;
    out.push(estimated(it.id, o.id, base + (fromBase(oe) ?? LOCAL_MOVE_MIN), null));
  }
  return out;
}

/**
 * The legs a stop brings to another day: the plan's legs between it and another stop (true on any day); at the same base, its own day's
 * base legs (its road time from the base stays the plan's); then the estimates of `movedLegs`. A stop going back to its own published day
 * brings nothing: that day already has its legs.
 */
function carryLegs(to: ScheduleDayInput, from: ScheduleDayInput, it: ScheduleItem, others: ScheduleItem[] = []): ScheduleDayInput {
  if (to === from || ownStop(to, it.id)) return to;
  const ends = endsOf(it);
  const isBase = (x: string): boolean => x === "base" || x === "next-base" || x === "origin";
  const has = (l: StoredLeg): boolean => to.legs.some((x) => x.from === l.from && x.to === l.to && x.mode === l.mode);
  const mine = (l: StoredLeg): boolean => ends.includes(l.from) || ends.includes(l.to);
  const stopLegs = from.legs.filter((l) => mine(l) && !isBase(l.from) && !isBase(l.to) && !has(l));
  const baseLegs = sameBase(to, from) ? from.legs.filter((l) => mine(l) && (l.to === "base" || l.from === "base") && !has(l)) : [];
  const step = [...stopLegs, ...baseLegs];
  const mid: ScheduleDayInput = step.length ? { ...to, legs: [...to.legs, ...step] } : to;
  const add = movedLegs(mid, from, it, others);
  return add.length ? { ...mid, legs: [...mid.legs, ...add] } : mid;
}

/** Every stop a day holds or may hold (all its versions, the stops placed there, the visitor's additions): the ends a moved stop may meet. */
const allStops = (d: EditedDay): ScheduleItem[] => [...d.input.variants.flatMap((v) => v.items), ...d.edit.placed.map((p) => p.item), ...(d.base.added ?? [])];

/**
 * Moves a stop to another day, or within its day when `from` and `to` are the same day (edit-mode-spec 5 Move to day, Move up and
 * down). `at`: "start", "end" or after a schedule id. Null when the stop is not on `from` for this party.
 */
export function moveItem(from: EditedDay, to: EditedDay, profile: Profile, id: string, at: PlacedStop["at"]): { from: EditedResult; to: EditedResult } | null {
  const stop = stopsOf(from, profile).find((s) => s.item.id === id);
  if (!stop) return null;
  const off = takeOff(from, id);
  const same = from.input.day === to.input.day;
  const target = same ? off.day : to;
  const item = arriving(stop.item, target.input);
  const placed: PlacedStop = { item, addedBy: stop.addedBy, at };
  const next: EditedDay = { ...target, input: carryLegs(target.input, from.input, item, allStops(target)), edit: { ...target.edit, placed: [...target.edit.placed, placed] } };
  const toR = result(next, profile);
  return { from: same ? toR : result(off.day, profile), to: toR };
}

/** Where the party sleeps after a day: a transfer day ends at the next base; any other day at its own. */
const sleepsAt = (d: ScheduleDayInput): ScheduleDayInput["base"] => (d.kind === "transfer" ? (d.nextBase ?? d.base) : d.base);

/**
 * A new empty day (edit-mode-spec 6 Add a day): the base of the day before (`before`; null when it goes before Day 1, then Day 1's),
 * its zone and season window, a plain day with no stops. `day` is the number its generated ids carry. The legs of a neighbour at the
 * same base come with it, so a stop moved in keeps the plan's road time from the base.
 */
export function insertDay(before: ScheduleDayInput | null, next: ScheduleDayInput | null, day: number): ScheduleDayInput {
  const src = before ?? next;
  if (!src) throw new Error("insertDay: a day before or after");
  const base = before ? sleepsAt(before) : (next?.base ?? null);
  const legSrc = [next, before].find((d) => d && d.base && base && d.base.name === base.name) ?? null;
  const legs = (legSrc?.legs ?? []).filter((l) => ![l.from, l.to].some((e) => e === "origin" || e === "next-base"));
  const empty: DayVariant = { key: "main", label: "Your day", audience: "any", relation: "alternative", items: [], rank: 0 };
  return {
    day, kind: "normal", tz: src.tz, base, nextBase: null, sunPoint: base?.point ?? src.sunPoint, sunWindow: src.sunWindow, variants: [empty], legs,
    start: null, origin: null, homeBy: null, splitNote: null, ...(src.blocks !== undefined ? { blocks: src.blocks } : {}),
  };
}

/**
 * Drops a day (edit-mode-spec 6 Drop Day n): its stops for this party move to the end of `to` in their order (a visitor's addition
 * that was placed by cheapest insertion is placed that way again), or, with no `to`, go with the day. Returns the target day and the
 * stops carried (empty with no `to`; the Maybe list is the caller's).
 */
export function dropDay(dropped: EditedDay, to: EditedDay | null, profile: Profile): { to: EditedResult | null; carried: PlacedStop[] } {
  if (!to) return { to: null, carried: [] };
  const added = new Set(dropped.base.added ?? []);
  const stops = stopsOf(dropped, profile).filter((s) => s.lane === "main");
  const carried = stops.filter((s) => !added.has(s.item)).map((s): PlacedStop => ({ item: arriving(s.item, to.input), addedBy: s.addedBy, at: "end" }));
  let input = to.input;
  const others = allStops(to);
  for (const s of stops) input = carryLegs(input, dropped.input, arriving(s.item, to.input), [...others, ...carried.map((c) => c.item)]);
  const next: EditedDay = {
    input,
    base: { ...to.base, added: [...(to.base.added ?? []), ...(dropped.base.added ?? [])] },
    edit: { ...to.edit, placed: [...to.edit.placed, ...carried] },
  };
  return { to: result(next, profile), carried };
}

interface Slot extends EditedDay {
  ref: TemplateDayRef;
  inserted: boolean;
  dropped: boolean;
}

/**
 * Schedules a copy: the published days with the delta applied (gap-analysis D5). `days` are the published days in order, as the public
 * page schedules them. An entry that cannot apply (its day is not in this trip, its stop is not on the day for this party, a drop whose
 * target is gone) is listed in `skipped` and changes nothing, so the person can be told (edit-mode-spec 12).
 */
export function scheduleTemplate(days: ScheduleDayInput[], delta: TemplateDelta, profile: Profile): TemplateSchedule {
  const skipped: TemplateSkip[] = [];
  const skip = (op: string, reason: TemplateSkip["reason"]): void => void skipped.push({ op, reason });
  const last = days.reduce((n, d) => Math.max(n, d.day), 0);
  const inserts = delta.days.filter((x): x is Extract<TemplateDelta["days"][number], { kind: "insert" }> => x.kind === "insert");
  const published = (d: ScheduleDayInput): Slot => ({ ...asEdited(d, { variant: delta.overrides[String(d.day)] ?? null, added: [] }), ref: d.day, inserted: false, dropped: false });

  // the copy's days in order: inserts after Day 0 first, then each published day followed by the days inserted after it, in op order
  const slots: Slot[] = [];
  const insertAfter = (n: number, before: ScheduleDayInput | null, next: ScheduleDayInput | null): void => {
    for (const x of inserts) {
      if (x.after !== n) continue;
      const key = last + inserts.indexOf(x) + 1;
      slots.push({ ...asEdited(insertDay(before, next, key)), ref: x.op, inserted: true, dropped: false });
    }
  };
  insertAfter(0, null, days[0] ?? null);
  days.forEach((d, i) => {
    slots.push(published(d));
    insertAfter(d.day, d, days[i + 1] ?? null);
  });
  const known = new Set([0, ...days.map((d) => d.day)]);
  for (const x of inserts) if (!known.has(x.after)) skip(x.op, "no-day");

  const at = (ref: TemplateDayRef): number => slots.findIndex((s) => s.ref === ref && !s.dropped);
  const put = (i: number, d: EditedDay): void => void (slots[i] = { ...slots[i]!, ...d });

  for (const r of delta.removed) {
    const i = at(r.day);
    if (i < 0) skip(r.op, "no-day");
    // a generated row is hidden by its key whatever the day holds now: a move or an addition applied later may be what it precedes
    else if (isRuleItem(r.item)) put(i, hide(slots[i]!, r.item.slice(RULE_PREFIX.length)));
    else {
      const res = removeItem(slots[i]!, profile, r.item);
      if (res) put(i, res.day);
      else skip(r.op, "not-on-day");
    }
  }
  for (const m of delta.moved) {
    const i = at(m.day);
    const j = at(m.toDay);
    if (i < 0 || j < 0) {
      skip(m.op, "no-day");
      continue;
    }
    const res = moveItem(slots[i]!, slots[j]!, profile, m.item, m.after ? { after: m.after } : "start");
    if (!res) {
      skip(m.op, "not-on-day");
      continue;
    }
    put(i, res.from.day);
    put(j, res.to.day);
  }
  for (const a of delta.added) {
    const i = at(a.day);
    if (i < 0) {
      skip(a.op, "no-day");
      continue;
    }
    const s = slots[i]!;
    if (a.after) put(i, { ...s, edit: { ...s.edit, placed: [...s.edit.placed, { item: a.item, addedBy: "visitor", at: { after: a.after } }] } });
    else put(i, { ...s, base: { ...s.base, added: [...(s.base.added ?? []), a.item] } });
  }
  for (const x of delta.days) {
    if (x.kind !== "drop") continue;
    const i = at(x.day);
    const j = x.to === undefined ? -1 : at(x.to);
    if (i < 0 || slots[i]!.inserted || (x.to !== undefined && (j < 0 || j === i))) {
      skip(x.op, "no-day");
      continue;
    }
    const res = dropDay(slots[i]!, j < 0 ? null : slots[j]!, profile);
    if (res.to) put(j, res.to.day);
    slots[i] = { ...slots[i]!, dropped: true };
  }

  let n = 0;
  const out: TemplateDay[] = [];
  for (const s of slots) {
    if (s.dropped) continue;
    const opts = editDay(s.input, profile, s.base, s.edit);
    const changed = s.inserted || !isEmptyEdit(s.edit) || (s.base.added?.length ?? 0) > 0 || !!s.base.variant;
    out.push({ n: ++n, ref: s.ref, inserted: s.inserted, changed, input: s.input, opts, timeline: scheduleDay(s.input, profile, opts) });
  }
  return { days: out, skipped };
}

/** The empty delta: a fresh copy. `scheduleTemplate(days, emptyTemplateDelta(), p)` schedules exactly what the public page does. */
export const emptyTemplateDelta = (): TemplateDelta => ({ overrides: {}, added: [], removed: [], moved: [], days: [] });
