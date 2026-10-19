// The day scheduler (spec 2.9). Pure and deterministic: no I/O, no clock, no locale. It assigns times to the authored
// order and never reorders it; only items the visitor adds are placed by the scheduler (cheapest insertion).
import { fmtMin, toMin } from "../checks/time.ts";
import { resolveLeg, samePlace, type LegEnd } from "./legs.ts";
import {
  breakEveryMin, COFFEE_GAP_MIN, DINNER_SETTLE_MIN, fmtHM, mealWindows, PACE_RULES, REST_THRESHOLD_MIN, resolveDuration, ROUND_MIN, rule,
} from "./rules.ts";
import { selectVariant } from "./select.ts";
import { anchorTime, sunReference, type SunRef } from "./sun.ts";
import type {
  Confidence, DayTimeline, EntryKind, Lane, PlaceRef, Profile, ResolvedLeg, ScheduleDayInput, ScheduleItem, ScheduleOptions,
  ScheduleWarning, TimeSource, TimelineEntry,
} from "./types.ts";
import { validateDay } from "./validate.ts";

const ceil5 = (m: number): number => Math.ceil(m / ROUND_MIN) * ROUND_MIN;
const MAX_SQUEEZE = 2;
const MINUTES_PER_DAY = 24 * 60;
const m = (hhmm: string): number => toMin(hhmm) ?? 0;
const clock = (min: number): string => fmtMin(Math.min(Math.max(min, 0), MINUTES_PER_DAY - 1));

interface Ctx {
  input: ScheduleDayInput;
  profile: Profile;
  sun: SunRef | null;
  base: LegEnd | null;
  nextBase: LegEnd | null;
  /** Where an arrival day starts or a short trip begins: the airport or the start point. */
  origin: LegEnd | null;
  items: Map<string, ScheduleItem>;
}

interface Stop {
  item: ScheduleItem;
  addedBy: "author" | "visitor";
  /** The shared pin where a split day rejoins: lane labels switch back to 'all' here. */
  isRejoin?: boolean;
}

interface LaneResult {
  entries: TimelineEntry[];
  warnings: ScheduleWarning[];
  /** Time and place after the first leg, for the parallel lane to start from. */
  afterFirstLeg: number | null;
  end: number;
}

interface LaneOpts {
  squeeze: number;
  label: Lane;
  /** The parallel lane begins here, already at the day's destination. */
  resume: number | null;
  isMain: boolean;
}

const placeOf = (it: ScheduleItem): PlaceRef => ({ name: it.title, placeSlug: it.placeSlug, point: it.point });
const refOf = (b: { name: string; placeSlug: string | null; point: { lat: number; lon: number } | null } | null): PlaceRef | null =>
  b ? { name: b.name, placeSlug: b.placeSlug, point: b.point } : null;
const endOf = (it: ScheduleItem): LegEnd => ({ ids: [it.id, ...(it.placeSlug ? [it.placeSlug] : [])], point: it.point });

function makeCtx(input: ScheduleDayInput, profile: Profile): Ctx {
  const sun = input.sunPoint && input.sunWindow ? sunReference(input.sunPoint, input.tz, input.sunWindow) : null;
  const end = (b: ScheduleDayInput["base"], id: string): LegEnd | null => (b ? { ids: [id, ...(b.placeSlug ? [b.placeSlug] : [])], point: b.point } : null);
  return {
    input, profile, sun,
    base: end(input.base, "base"),
    nextBase: end(input.nextBase, "next-base"),
    origin: input.origin ? { ids: ["origin"], point: input.origin.point } : null,
    items: new Map(),
  };
}

const legText = (r: ResolvedLeg): string =>
  r.basis === "routed" ? "Routed road time, stored" : r.basis === "plan" ? "From the plan" : r.basis === "matrix" ? "From the plan's drive table" : r.km === null ? "Time between stops not known; a local move" : "A straight line scaled to a road time";

type PushIn = Omit<TimelineEntry, "id" | "day" | "tz" | "lane" | "optional" | "addedBy" | "honesty" | "sourceItemId" | "end"> &
  Partial<Pick<TimelineEntry, "id" | "lane" | "optional" | "addedBy" | "honesty" | "sourceItemId">>;

/** One lane from start to end. `squeeze` 1 shortens meals, 2 also drops generated breaks (spec 2.9 steps 6 and 7). */
function runLane(ctx: Ctx, stops: Stop[], lane: Lane, profile: Profile, o: LaneOpts): LaneResult {
  const { input } = ctx;
  const pr = PACE_RULES[profile.pace];
  const wins = mealWindows(profile);
  const entries: TimelineEntry[] = [];
  const warnings: ScheduleWarning[] = [];
  const counters = new Map<string, number>();
  let afterFirstLeg: number | null = null;
  let current: Lane = o.label;

  const nextId = (kind: EntryKind): string => {
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    return `${input.day}-${lane}-${kind}-${n}`;
  };
  const push = (e: PushIn): TimelineEntry => {
    const entry: TimelineEntry = {
      day: input.day, lane: current, tz: input.tz, optional: false, addedBy: "scheduler", honesty: [], sourceItemId: null, ...e, id: e.id ?? nextId(e.kind), end: "",
    };
    entry.end = clock(m(entry.start) + entry.durationMin);
    entries.push(entry);
    return entry;
  };
  const ruleTime = (note: string | null = null): TimelineEntry["time"] => ({ confidence: "suggested", source: "rule", pinned: false, note });
  const ruleDur = (id: string, minutes: number): TimelineEntry["duration"] => ({ source: "rule", basis: `rule: ${rule(id).label} ${fmtHM(minutes)}` });

  // ---- state ----
  let t = 0;
  let loc: LegEnd | null = null;
  let lunchDone = false;
  let dinnerDone = input.kind === "departure";
  let lastKind = null as EntryKind | null;
  let checkedIn = input.kind !== "arrival";
  let genCount = 0;
  const startsAtOrigin = !!ctx.origin && !ctx.base;

  const lastPlace = (): PlaceRef | null => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      if (e.kind === "leg") return e.to;
      if (e.at) return e.at;
    }
    return null;
  };

  const addRest = (minutes: number, sub: string, title: string, at: PlaceRef | null): void => {
    if (minutes <= 0) return;
    push({ kind: "rest", sub, title, start: clock(t), durationMin: minutes, at, from: null, to: null, time: ruleTime(), duration: { source: "rule", basis: "the gap between entries" } });
    t += minutes;
    lastKind = "rest";
  };

  /** A generated break the next squeeze level drops. Returns false when it was not placed. */
  const addBreak = (sub: string, minutes: number, title: string, at: PlaceRef | null, deadline: number | null): boolean => {
    genCount += 1;
    if (o.squeeze >= 2) return false;
    if (deadline !== null && t + minutes > deadline) return false;
    push({ kind: "break", sub, title, start: clock(t), durationMin: minutes, at, from: null, to: null, time: ruleTime(), duration: ruleDur(`break.${sub}`, minutes) });
    t += minutes;
    lastKind = "break";
    return true;
  };

  const addLeg = (toRef: PlaceRef | null, r: ResolvedLeg, title: string): void => {
    const from = lastPlace();
    const src: TimeSource = r.basis === "routed" ? "data" : r.basis === "plan" ? "plan" : "rule";
    const honesty: TimelineEntry["honesty"] = r.mode === "drive" && r.basis !== "routed" ? ["drive_estimated"] : [];
    const part = (minutes: number, breaks: number): void => {
      push({
        kind: "leg", sub: r.mode, title, start: clock(t), durationMin: minutes, at: null, from, to: toRef,
        time: { confidence: "suggested", source: src, pinned: false, note: null }, duration: { source: src, basis: legText(r) },
        leg: { mode: r.mode, km: r.km, basis: r.basis, breaks }, honesty: [...honesty],
      });
      t += minutes;
    };
    if (r.mode === "drive" && r.minutes > breakEveryMin(profile) && o.squeeze < 2) {
      genCount += 1;
      const first = Math.round(r.minutes / 2);
      part(first, 1);
      push({ kind: "break", sub: "leg-stretch", title: "Stretch break on the way", start: clock(t), durationMin: 15, at: null, from: null, to: null, time: ruleTime(), duration: ruleDur("break.leg-stretch", 15) });
      t += 15;
      part(r.minutes - first, 1);
    } else part(r.minutes, 0);
    lastKind = "leg";
  };

  const addMeal = (which: "lunch" | "dinner", style: "sit-down" | "picnic" | "at-base", at: PlaceRef | null, deadline: number | null, maxMin: number | null = null): void => {
    let st = style;
    const id = which === "dinner" ? "meal.dinner" : st === "sit-down" ? "meal.lunch.sit-down" : "meal.lunch.picnic";
    let minutes = rule(id).minutes;
    if (which === "lunch" && (o.squeeze >= 1 || (deadline !== null && t + minutes + 5 > deadline && o.squeeze >= 1))) {
      st = "picnic";
      minutes = Math.min(minutes, 30);
    }
    const w = wins[which];
    if (maxMin !== null) minutes = Math.min(minutes, maxMin);
    const title = which === "dinner" ? (at ? `Dinner in ${at.name}` : "Dinner") : st === "picnic" ? "Picnic lunch" : "Lunch";
    push({
      kind: "meal", sub: which, style: st, title, start: clock(t), durationMin: minutes, at, from: null, to: null,
      time: { confidence: "suggested", source: "rule", pinned: false, window: { from: fmtMin(w.from), to: fmtMin(w.to), why: `${profile.party === "family" ? "family" : "adult"} ${which} window` }, note: null },
      duration: ruleDur(id, minutes),
    });
    t += minutes;
    lastKind = "meal";
  };

  const dinnerStart = wins.dinner.from + DINNER_SETTLE_MIN;
  const baseRef = refOf(input.base);
  const nextRef = refOf(input.nextBase);

  /** Drop bags, or check in from 15:00: an arrival day after the drive, a transfer day at the end. */
  const doCheckin = (at: LegEnd | null, ref: PlaceRef | null): void => {
    if (at && loc && !samePlace(loc, at)) {
      addLeg(ref, resolveLeg(loc, at, input.legs), `Drive to ${ref?.name ?? "your stay"}`);
    }
    loc = at ?? loc;
    const early = t < 15 * 60 - 30;
    const minutes = early ? 15 : rule("checkin").minutes;
    const start = early ? t : Math.max(t, 15 * 60);
    if (start - t > REST_THRESHOLD_MIN) addRest(start - t, "free-time", "Free time before check-in", ref);
    else t = start;
    push({
      kind: "checkin", sub: "stay", title: early ? `Drop bags, ${ref?.name ?? "your stay"}` : `Check in, ${ref?.name ?? "your stay"}`, start: clock(t), durationMin: minutes, at: ref, from: null, to: null,
      time: ruleTime("Check-in from 15:00 unless your stay says otherwise"), duration: ruleDur(early ? "checkin" : "checkin", minutes),
    });
    t += minutes;
    checkedIn = true;
    lastKind = "checkin";
  };

  /** Back at the base (or on to the next one), a rest until dinner opens, dinner. */
  const dinner = (deadline: number | null, maxMin: number | null = null): void => {
    if (dinnerDone) return;
    const toNext = input.kind === "transfer";
    const where = toNext ? ctx.nextBase : ctx.base;
    const ref = toNext ? nextRef : baseRef;
    if (where && loc && !samePlace(loc, where)) {
      addLeg(ref, resolveLeg(loc, where, input.legs), toNext ? `Drive on to ${ref?.name ?? "the next base"}` : `Back to ${ref?.name ?? "base"}`);
      loc = where;
    }
    if (t < dinnerStart && (deadline === null || deadline - dinnerStart >= 45)) {
      const gap = dinnerStart - t;
      if (gap > REST_THRESHOLD_MIN) addRest(gap, "at-base", "Rest at the base", ref);
      else t = dinnerStart;
    }
    dinnerDone = true;
    if (t > wins.dinner.to + 120) return;
    addMeal("dinner", "at-base", ref, deadline, maxMin);
  };

  // ---- the day start (2.9 step 4) ----
  const startEnd: LegEnd | null = input.kind === "arrival" ? (ctx.origin ?? ctx.base) : (ctx.base ?? ctx.origin);
  if (o.resume === null) {
    const pinOf = (it: ScheduleItem): number | null => {
      if (it.start) return m(it.start.time) - (it.checkinMin ?? 0);
      if (it.needs && ctx.sun) {
        const a = anchorTime(ctx.sun, it.needs.sun, it.needs.offsetMin);
        return a ? ceil5(a.mid) : null;
      }
      return null;
    };
    const firstPin = stops.findIndex((s) => pinOf(s.item) !== null);
    let startMin = pr.startMin;
    let pinned = false;
    let source: TimeSource = "rule";
    let note: string | null = null;
    if (input.start) {
      startMin = m(input.start.time);
      source = input.start.source;
      pinned = true;
    } else if (input.kind === "arrival") {
      startMin = 10 * 60;
      note = "Arrival time not set";
    } else if (firstPin >= 0) {
      let lead = 0;
      let at: LegEnd | null = startEnd;
      for (let i = 0; i <= firstPin; i++) {
        const it = stops[i]!.item;
        const e = endOf(it);
        if (at && !samePlace(at, e)) {
          const l = resolveLeg(at, e, input.legs);
          lead += l.minutes;
          if (i === firstPin && it.kind === "trail" && l.mode === "drive" && l.minutes >= 30) lead += rule("park.walk-in").minutes;
        }
        if (i < firstPin) lead += resolveDuration(it, profile).minutes;
        at = e;
      }
      startMin = Math.floor((pinOf(stops[firstPin]!.item)! - lead) / ROUND_MIN) * ROUND_MIN;
      source = "plan";
      if (startMin < 360) {
        pinned = true;
        note = "Early start";
      }
    }
    startMin = Math.max(0, startMin);
    const sub = input.kind === "arrival" ? "land" : startsAtOrigin ? "leave-home" : "leave-base";
    const where = input.kind === "arrival" ? input.origin : startsAtOrigin ? input.origin : baseRef;
    const defaultTitle = sub === "land" ? "Land and head out" : sub === "leave-home" ? "Leave home" : input.base ? `Leave ${input.base.name}` : "Start the day";
    t = startMin;
    push({
      kind: "start", sub, title: input.start?.label ?? defaultTitle, start: clock(startMin), durationMin: 0, at: where, from: null, to: null,
      time: { confidence: "suggested", source, pinned, note: note ?? (input.base || input.origin ? null : "Start point not set") }, duration: { source: "rule", basis: "a moment, not a duration" },
    });
    lastKind = "start";
    loc = startEnd;
    if (input.kind === "arrival") {
      const r = rule("arrival.car-hire");
      push({ kind: "visit", sub: "car-hire", title: "Collect the hire car", start: clock(t), durationMin: r.minutes, at: where, from: null, to: null, time: ruleTime(), duration: ruleDur("arrival.car-hire", r.minutes) });
      t += r.minutes;
      lastKind = "visit";
    }
    if (input.kind === "departure") {
      const r = rule("checkout");
      push({ kind: "checkout", sub: "stay", title: input.base ? `Check out of ${input.base.name}` : "Check out", start: clock(t), durationMin: r.minutes, at: baseRef, from: null, to: null, time: ruleTime(), duration: ruleDur("checkout", r.minutes) });
      t += r.minutes;
      lastKind = "checkout";
    }
  } else {
    t = o.resume;
    loc = null;
  }

  // ---- the stops ----
  for (let si = 0; si < stops.length; si++) {
    const stop = stops[si]!;
    const it = stop.item;
    ctx.items.set(it.id, it);
    // the rejoin pin is a moment in the place the party already is: no leg
    const target = stop.isRejoin && loc ? loc : endOf(it);
    const D = resolveDuration(it, profile);
    const duration = D.minutes;
    if (stop.isRejoin) current = "all";

    // arrival day: to the stay first, then out again
    if (!checkedIn && o.resume === null && input.checkin !== "last") doCheckin(ctx.base, baseRef);

    // the pinned time of this stop
    let pinStart: number | null = null;
    let conf: Confidence = "suggested";
    let src: TimeSource = "rule";
    let anchor: TimelineEntry["time"]["anchor"] | undefined;
    if (it.start) {
      pinStart = m(it.start.time);
      conf = it.start.confidence;
      src = it.start.source;
    } else if (it.needs && ctx.sun) {
      const a = anchorTime(ctx.sun, it.needs.sun, it.needs.offsetMin);
      if (a) {
        pinStart = ceil5(a.mid);
        conf = "anchored";
        src = "sun";
        anchor = { to: it.needs.sun, offsetMin: it.needs.offsetMin, range: a.range };
      }
    }
    const checkin = pinStart !== null && it.checkinMin ? it.checkinMin : 0;
    const gate = pinStart !== null ? pinStart - checkin : null;

    // dinner before an evening pin
    if (!dinnerDone && gate !== null && !stop.isRejoin && gate >= wins.dinner.from + 30 && ctx.base && input.kind !== "transfer") {
      const back = loc && !samePlace(loc, ctx.base) ? resolveLeg(loc, ctx.base, input.legs).minutes : 0;
      const out = resolveLeg(ctx.base, target, input.legs).minutes;
      const earliest = Math.max(t + back, dinnerStart);
      const room = gate - out - 5 - earliest;
      // dinner before the evening outing, shortened to what fits (45 min at least)
      if (room >= 45) dinner(gate - out, room);
    }

    // lunch is due where we stand
    const L = wins.lunch;
    if (!lunchDone && t >= L.from && it.kind !== "meal" && !stop.isRejoin) {
      lunchDone = true;
      if (t <= L.to + 30) addMeal("lunch", /town|village|cafe|restaurant/i.test(lastPlace()?.name ?? "") ? "sit-down" : "picnic", lastPlace(), gate);
    }

    // the leg to this stop
    let arrive = t;
    let leg: ResolvedLeg | null = null;
    if (loc !== null && !samePlace(loc, target)) {
      leg = resolveLeg(loc, target, input.legs);
      if (leg.minutes === 0) leg = null; // a stored zero is "the same site"
    }
    if (leg) {
      const earliest = t + leg.minutes + (it.kind === "trail" && leg.mode === "drive" ? rule("park.walk-in").minutes : 0);
      const lead = gate !== null ? gate - earliest : 0;
      const atBase = ctx.base !== null && loc !== null && samePlace(loc, ctx.base);
      if (gate !== null && lead > 45 && lastKind !== "start" && atBase) addRest(lead - 5, "at-base", "Rest at the base", baseRef);
      addLeg(placeOf(it), leg, `${leg.mode === "drive" ? "Drive" : leg.mode === "walk" ? "Walk" : leg.mode[0]!.toUpperCase() + leg.mode.slice(1)} to ${it.title}`);
      arrive = t;
    }
    if (afterFirstLeg === null && o.isMain) afterFirstLeg = arrive;
    // a car park walk-in after a real drive out to a trailhead, and for the lane that is already at the trailhead
    const byCar = (leg?.mode === "drive" && leg.minutes >= 30) || (o.resume !== null && si === 0);
    const walkIn = it.kind === "trail" && byCar && !stop.isRejoin ? rule("park.walk-in").minutes : 0;

    // lunch at the destination, when we arrive after the window opens
    if (!lunchDone && arrive >= L.from && it.kind !== "meal" && !stop.isRejoin) {
      lunchDone = true;
      if (arrive <= L.to + 30) addMeal("lunch", it.sub === "town" ? "sit-down" : "picnic", placeOf(it), gate);
      arrive = t;
    }

    // ---- place the stop ----
    let s0: number;
    let missed = false;
    if (pinStart !== null) {
      const arrival = arrive + walkIn;
      const gateT = gate ?? pinStart;
      const gap = gateT - arrival;
      if (gap > REST_THRESHOLD_MIN && !(stop.isRejoin && !o.isMain)) {
        const place = leg ? placeOf(it) : lastPlace();
        const coffee = gap >= COFFEE_GAP_MIN && addBreak("coffee", 20, "Coffee and a snack", place, gateT);
        const left = gateT - t;
        if (left > REST_THRESHOLD_MIN) addRest(left, "free-time", "Free time", place);
        void coffee;
      }
      if (arrival > pinStart) {
        missed = true;
        warnings.push({ code: "S_FIXED_MISSED", entryId: it.id, lane: current, message: `Arrives ${fmtMin(arrival)} for the ${fmtMin(pinStart)} ${it.sub === "together" ? "regroup" : it.title}.` });
      }
      if (checkin) {
        push({
          kind: "booking", sub: "slot", title: `Check in for ${it.title}`, start: clock(gateT), durationMin: checkin, at: placeOf(it), from: null, to: null,
          time: { confidence: "fixed", source: it.start?.source === "operator" ? "operator" : "rule", pinned: true, note: `Arrive ${checkin} min before the slot` },
          duration: ruleDur("booking.checkin", checkin), bookingOf: it.id,
        });
      }
      s0 = pinStart;
    } else {
      const buffer = !leg && lastKind !== null && lastKind !== "start" && lastKind !== "rest" && lastKind !== "leg" ? 5 : 0;
      s0 = ceil5(arrive + walkIn + buffer);
      const open = it.window?.from ? m(it.window.from) : 0;
      if (open > s0) {
        if (open - s0 > REST_THRESHOLD_MIN) addRest(open - t, "free-time", "Wait for opening", placeOf(it));
        s0 = open;
      }
    }
    void missed;

    // a long outing that spans the lunch window carries lunch with it (on-trail, no extra time)
    let onTrailAt: number | null = null;
    if (!lunchDone && it.kind !== "meal" && !stop.isRejoin && duration >= 150 && s0 <= L.from + 30 && s0 + duration >= L.to - 30) {
      lunchDone = true;
      onTrailAt = Math.max(s0 + 60, Math.min(L.to - 20, s0 + duration));
    }

    const time: TimelineEntry["time"] = {
      confidence: conf,
      source: pinStart !== null ? (anchor ? "sun" : (it.start?.source ?? "plan")) : stop.addedBy === "visitor" ? "visitor" : "rule",
      pinned: pinStart !== null,
      note: it.start?.note ?? it.note ?? null,
      ...(anchor ? { anchor } : {}),
      ...(it.window ? { window: { from: it.window.from ?? it.window.lastUp, to: it.window.to ?? it.window.lastDown, why: it.window.why } } : {}),
    };
    t = s0;
    const entry = push({
      id: it.id, kind: it.kind, sub: it.sub, title: it.title, start: clock(s0), durationMin: duration, at: placeOf(it), from: null, to: null, time,
      duration: { source: D.source, basis: D.basis }, ...(it.kind === "trail" || it.stats ? { stats: { distanceKm: it.stats?.distanceKm ?? null, gainM: it.stats?.gainM ?? null } } : {}),
      optional: it.optional, addedBy: stop.addedBy, sourceItemId: it.id, honesty: [...it.honesty, ...(D.unknown ? (["not_known"] as const) : [])],
    });
    void entry;
    t = s0 + duration;
    if (onTrailAt !== null) {
      push({
        kind: "meal", sub: "lunch", style: "on-trail", title: "Packed lunch on the trail", start: clock(onTrailAt), durationMin: 0, at: placeOf(it), from: null, to: null,
        time: { confidence: "suggested", source: "rule", pinned: false, note: null, window: { from: fmtMin(L.from), to: fmtMin(L.to), why: "lunch window" } },
        duration: { source: "rule", basis: "eaten on the trail, inside the walk" }, insideOf: it.id,
      });
    }
    if (it.kind === "meal" && it.sub === "lunch") lunchDone = true;
    if (it.kind === "meal" && it.sub === "dinner") dinnerDone = true;
    loc = target;
    lastKind = stop.isRejoin ? "rest" : it.kind;
  }

  // ---- close the day (2.9 step 8) ----
  if (o.resume === null) {
    if (!checkedIn) doCheckin(ctx.base, baseRef);
    if (!lunchDone && input.kind !== "departure") {
      lunchDone = true;
      const L = wins.lunch;
      if (t <= L.to + 30) {
        // nothing left to do before lunch: head back to the base and eat there when the window opens
        if (t < L.from && input.kind === "normal" && ctx.base && loc && !samePlace(loc, ctx.base)) {
          addLeg(baseRef, resolveLeg(loc, ctx.base, input.legs), `Back to ${baseRef?.name ?? "base"}`);
          loc = ctx.base;
        }
        if (t < L.from && L.from - t > REST_THRESHOLD_MIN) addRest(L.from - t, "at-base", "Rest at the base", baseRef);
        else if (t < L.from) t = L.from;
        addMeal("lunch", "picnic", lastPlace(), null);
      }
    }
    if (input.kind === "transfer") {
      doCheckin(ctx.nextBase, nextRef);
      dinner(null);
    } else if (input.kind === "departure") {
      if (ctx.nextBase && loc && !samePlace(loc, ctx.nextBase)) addLeg(nextRef, resolveLeg(loc, ctx.nextBase, input.legs), `Drive to ${nextRef?.name ?? "the airport"}`);
    } else {
      dinner(null);
      if (ctx.base && loc && !samePlace(loc, ctx.base)) addLeg(baseRef, resolveLeg(loc, ctx.base, input.legs), `Back to ${baseRef?.name ?? "base"}`);
    }
    const sub = input.kind === "departure" ? "at-airport" : input.kind === "transfer" ? "at-next-base" : startsAtOrigin ? "at-home" : "at-base";
    const ref = input.kind === "departure" || input.kind === "transfer" ? nextRef : startsAtOrigin ? input.origin : baseRef;
    const title = input.kind === "departure" ? "At the airport 3 h before an international flight" : startsAtOrigin ? "Home again" : ref ? `Back at ${ref.name}` : "End of the day";
    push({
      kind: "end", sub, title, start: clock(t), durationMin: 0, at: ref, from: null, to: null,
      time: { confidence: "suggested", source: "rule", pinned: false, note: null, ...(input.homeBy ? { window: { from: null, to: input.homeBy, why: "home by" } } : {}) },
      duration: { source: "rule", basis: "a moment, not a duration" },
    });
  }
  void genCount;
  return { entries, warnings, afterFirstLeg, end: t };
}

const legsMin = (es: TimelineEntry[]): number => es.filter((e) => e.kind === "leg").reduce((s, e) => s + e.durationMin, 0);
const missedCount = (r: LaneResult): number => r.warnings.filter((w) => w.code === "S_FIXED_MISSED").length;

/** Runs a lane at the lowest squeeze level that keeps every pin (2.9 step 7). */
function runSqueezed(ctx: Ctx, stops: Stop[], lane: Lane, profile: Profile, o: Omit<LaneOpts, "squeeze">): LaneResult {
  let res = runLane(ctx, stops, lane, profile, { ...o, squeeze: 0 });
  for (let sq = 1; sq <= MAX_SQUEEZE && missedCount(res) > 0; sq++) {
    const next = runLane(ctx, stops, lane, profile, { ...o, squeeze: sq });
    if (missedCount(next) <= missedCount(res)) res = next;
  }
  return res;
}

/** Cheapest insertion (2.9): the position with no new missed pin, then the least added leg time. */
function insertAdded(ctx: Ctx, stops: Stop[], item: ScheduleItem, profile: Profile): Stop[] {
  const add: Stop = { item, addedBy: "visitor" };
  let best: { pos: number; score: [number, number, number] } | null = null;
  for (let pos = 0; pos <= stops.length; pos++) {
    const trial = [...stops.slice(0, pos), add, ...stops.slice(pos)];
    const r = runSqueezed(ctx, trial, "all", profile, { label: "all", resume: null, isMain: true });
    const score: [number, number, number] = [missedCount(r), legsMin(r.entries), r.end];
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2])))) best = { pos, score };
  }
  const pos = best?.pos ?? stops.length;
  return [...stops.slice(0, pos), add, ...stops.slice(pos)];
}

const rejoinItem = (day: number, place: string, time: string): ScheduleItem => ({
  id: `${day}-together`, kind: "rest", sub: "together", title: `Together again${place ? ` at ${place}` : ""}`, placeSlug: null, point: null, rule: null, durationMin: 0, durationRange: null,
  durationSource: "plan", stats: null, start: { time, confidence: "suggested", source: "plan", note: null }, needs: null, window: null, checkinMin: null, optional: false,
  note: null, minAge: null, minAgeRule: null, needsDaylight: false, honesty: [],
});

function sunRows(ctx: Ctx, entries: TimelineEntry[]): TimelineEntry[] {
  const day = ctx.input.day;
  const out: TimelineEntry[] = [];
  const sun = ctx.sun;
  if (!sun) return out;
  const real = entries.filter((e) => e.kind !== "sun");
  if (!real.length) return out;
  const row = (to: "sunrise" | "sunset" | "no-sunset", at: number, range: [string, string], title: string, n: number): TimelineEntry => ({
    id: `${day}-all-sun-${n}`, day, lane: "all", kind: "sun", sub: to, title, start: clock(at), durationMin: 0, end: clock(at), tz: ctx.input.tz, at: null, from: null, to: null,
    time: { confidence: "anchored", source: "sun", pinned: true, note: null, anchor: { to, offsetMin: 0, range } },
    duration: { source: "rule", basis: "Sun, computed for the season" }, optional: false, addedBy: "scheduler", sourceItemId: null, honesty: [],
  });
  if (sun.state !== "normal") {
    out.push(row("no-sunset", m(real[0]!.start), ["00:00", "00:00"], "No sunset in this window", 1));
    return out;
  }
  const spanStart = Math.min(...real.map((e) => m(e.start)));
  const spanEnd = Math.max(...real.map((e) => m(e.start) + e.durationMin));
  const anchored = new Set(real.map((e) => e.time.anchor?.to));
  const rng = (r: { lo: number; hi: number }): [string, string] => [fmtMin(r.lo), fmtMin(r.hi)];
  if ((sun.sunrise.mid >= spanStart && sun.sunrise.mid <= spanEnd) || anchored.has("sunrise")) {
    out.push(row("sunrise", sun.sunrise.mid, rng(sun.sunrise), `Sunrise, about ${fmtMin(sun.sunrise.lo)} to ${fmtMin(sun.sunrise.hi)} in this window`, 1));
  }
  if ((sun.sunset.mid >= spanStart && sun.sunset.mid <= spanEnd) || anchored.has("sunset") || anchored.has("golden-pm")) {
    out.push(row("sunset", sun.sunset.mid, rng(sun.sunset), `Sunset, about ${fmtMin(sun.sunset.lo)} to ${fmtMin(sun.sunset.hi)} in this window`, 2));
  }
  return out;
}

const KIND_ORDER: Record<EntryKind, number> = { start: 0, checkout: 1, sun: 2, leg: 3, booking: 4, visit: 5, trail: 5, meal: 6, break: 6, rest: 7, checkin: 7, end: 9 };
const LANE_ORDER: Record<Lane, number> = { all: 0, B: 1, C: 1, A: 2 };
/** The regroup pin of a split day comes before whatever starts at the same minute. */
const kindOrder = (e: TimelineEntry): number => (e.kind === "rest" && e.sub === "together" ? -1 : KIND_ORDER[e.kind]);
const sortEntries = (es: TimelineEntry[]): TimelineEntry[] =>
  [...es].sort((a, b) => m(a.start) - m(b.start) || LANE_ORDER[a.lane] - LANE_ORDER[b.lane] || kindOrder(a) - kindOrder(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export const adultsOf = (p: Profile): Profile => ({ ...p, party: "adults", youngest: null });

/** Schedules one day for a profile (2.9). */
export function scheduleDay(input: ScheduleDayInput, profile: Profile, opts: ScheduleOptions = {}): DayTimeline {
  const sel = selectVariant(input, profile, opts.variant);
  const ctx = makeCtx(input, profile);
  let stops: Stop[] = sel.variant.items.map((item) => ({ item, addedBy: "author" as const }));
  for (const add of opts.added ?? []) stops = insertAdded(ctx, stops, add, profile);

  const rejoin = sel.parallel?.rejoin ?? sel.variant.rejoin ?? null;
  const splitDrawn = profile.split && sel.parallel !== null && rejoin !== null;
  const mainLabel: Lane = splitDrawn ? (sel.variant.key === "main" ? "B" : (sel.variant.key as Lane)) : "all";
  if (splitDrawn && rejoin) {
    const idx = rejoin.afterItem ? stops.findIndex((s) => s.item.id === rejoin.afterItem) : -1;
    const at = idx >= 0 ? idx + 1 : stops.length;
    stops = [...stops.slice(0, at), { item: rejoinItem(input.day, rejoin.place, rejoin.time), addedBy: "author", isRejoin: true }, ...stops.slice(at)];
  }
  const main = runSqueezed(ctx, stops, "all", profile, { label: mainLabel, resume: null, isMain: true });
  let entries = main.entries;
  const warnings = [...main.warnings];
  let lanes: Lane[] = ["all"];
  const notes: DayTimeline["notes"] = [];

  if (splitDrawn && sel.parallel && rejoin) {
    const pLane: Lane = sel.parallel.key === "main" ? "A" : (sel.parallel.key as Lane);
    lanes = [mainLabel, pLane];
    const pStops: Stop[] = [...sel.parallel.items.map((item) => ({ item, addedBy: "author" as const })), { item: rejoinItem(input.day, rejoin.place, rejoin.time), addedBy: "author" as const, isRejoin: true }];
    const par = runSqueezed(ctx, pStops, pLane, adultsOf(profile), { label: pLane, resume: main.afterFirstLeg ?? m(entries[0]!.start), isMain: false });
    entries = [...entries, ...par.entries.filter((e) => e.sub !== "together").map((e) => ({ ...e, lane: pLane }))];
    warnings.push(...par.warnings.filter((w) => w.entryId !== `${input.day}-together`).map((w) => ({ ...w, lane: pLane })));
  } else if (sel.parallel && profile.adults >= 2 && profile.party === "family") {
    const pv = sel.parallel;
    const walk = pv.items.filter((i) => i.kind === "trail").sort((a, b) => (b.stats?.distanceKm ?? 0) - (a.stats?.distanceKm ?? 0))[0];
    const rj = pv.rejoin ?? sel.variant.rejoin ?? null;
    if (walk) {
      const dur = resolveDuration(walk, adultsOf(profile)).minutes;
      const km = walk.stats?.distanceKm;
      notes.push({
        kind: "split-option",
        text: `${pv.optionalSplit ? "Optional split: some of the group could take" : "Split option: the stronger walkers can take"} ${walk.title}${km ? ` (${km} km, ${fmtHM(dur)})` : ` (${fmtHM(dur)})`}${rj ? ` and rejoin at ${rj.time}${rj.place ? ` at ${rj.place}` : ""}` : ""}.`,
      });
    }
  }

  entries = sortEntries([...entries, ...sunRows(ctx, entries)]);
  const real = entries.filter((e) => e.kind !== "sun");
  const partyLane = (e: TimelineEntry): boolean => e.lane === "all" || e.lane === mainLabel;
  const startM = Math.min(...real.map((e) => m(e.start)));
  const endM = Math.max(...real.filter(partyLane).map((e) => m(e.start) + e.durationMin));
  const span = { start: fmtMin(startM), end: clock(endM), minutes: endM - startM };
  const totals = {
    activeMin: real.filter((e) => partyLane(e) && !e.optional && (e.kind === "visit" || e.kind === "trail" || e.kind === "leg")).reduce((s, e) => s + e.durationMin, 0),
    driveMin: real.filter((e) => partyLane(e) && e.kind === "leg" && e.leg?.mode === "drive").reduce((s, e) => s + e.durationMin, 0),
    walkKm: Math.round(real.filter((e) => partyLane(e) && e.kind === "trail").reduce((s, e) => s + (e.stats?.distanceKm ?? 0), 0) * 10) / 10,
    gainM: real.filter((e) => partyLane(e) && e.kind === "trail").reduce((s, e) => s + (e.stats?.gainM ?? 0), 0),
  };
  if (!sel.fits) notes.unshift({ kind: "no-fit", text: sel.reason });
  const early = real.find((e) => e.kind === "start" && e.time.note === "Early start");
  if (early) notes.push({ kind: "early-start", text: `Early start, ${early.start}.` });

  const timeline: DayTimeline = {
    day: input.day, variant: { key: sel.variant.key, label: sel.variant.label, chosenBy: sel.chosenBy, reason: sel.reason },
    lanes, entries, span, totals, warnings, fits: sel.fits, notes,
  };
  timeline.warnings = [...warnings, ...validateDay(timeline, input, profile, ctx.sun, ctx.items, mainLabel)];
  return timeline;
}

/** Schedules every day of a trip for a profile, applying per-day overrides and additions (3.6, 3.7). */
export function scheduleTrip(days: ScheduleDayInput[], profile: Profile, overrides: Record<number, string> = {}, added: Record<number, ScheduleItem[]> = {}): DayTimeline[] {
  return days.map((d) => scheduleDay(d, profile, { variant: overrides[d.day] ?? null, added: added[d.day] ?? [] }));
}

/** Adds one item to a day by cheapest insertion and returns the new timeline (3.7). */
export function addItem(input: ScheduleDayInput, profile: Profile, opts: ScheduleOptions, item: ScheduleItem): { timeline: DayTimeline; opts: ScheduleOptions } {
  const next: ScheduleOptions = { ...opts, added: [...(opts.added ?? []), item] };
  return { timeline: scheduleDay(input, profile, next), opts: next };
}
