// The day scheduler (spec 2.9). Pure and deterministic: no I/O, no clock, no locale. It assigns times to the authored
// order and never reorders it; only items the visitor adds are placed by the scheduler (cheapest insertion).
import { fmtMin, toMin } from "../checks/time.ts";
import { resolveLeg, samePlace, type LegEnd } from "./legs.ts";
import {
  breakEveryMin, COFFEE_GAP_MIN, DINNER_SETTLE_MIN, fmtHM, mealWindows, PACE_RULES, REST_THRESHOLD_MIN, resolveDuration, ROUND_MIN, rule, shownMin,
} from "./rules.ts";
import { selectVariant } from "./select.ts";
import { anchorTime, sunReference, type SunRange, type SunRef } from "./sun.ts";
import type {
  Confidence, DayTimeline, EntryKind, Lane, PlaceRef, Profile, ResolvedLeg, ScheduleDayInput, ScheduleItem, ScheduleOptions,
  ScheduleWarning, TimeSource, TimelineEntry,
} from "./types.ts";
import { validateDay } from "./validate.ts";

/** The latest a dinner may start: 30 minutes after its window closes (19:30 for a family). */
const dinnerLatest = (p: Profile): number => mealWindows(p).dinner.to + 30;
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
  /** Generated rows the person removed (STEP2-E1B), by id: drawn nowhere and, but for a rest (a wait for a set time), taking no time. */
  hidden: string[];
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
  /** Authored times let go because the day could not reach them: the item flows after what comes before it. */
  released: Set<string>;
  isMain: boolean;
}

const placeOf = (it: ScheduleItem): PlaceRef => ({ name: it.title, placeSlug: it.placeSlug, point: it.point });
const refOf = (b: { name: string; placeSlug: string | null; point: { lat: number; lon: number } | null } | null): PlaceRef | null =>
  b ? { name: b.name, placeSlug: b.placeSlug, point: b.point } : null;
const endOf = (it: ScheduleItem): LegEnd => ({ ids: [it.id, ...(it.placeSlug ? [it.placeSlug] : [])], point: it.point });

function makeCtx(input: ScheduleDayInput, profile: Profile, hidden: string[] = []): Ctx {
  const sun = input.sunPoint && input.sunWindow ? sunReference(input.sunPoint, input.tz, input.sunWindow) : null;
  const end = (b: ScheduleDayInput["base"], id: string): LegEnd | null => (b ? { ids: [id, ...(b.placeSlug ? [b.placeSlug] : [])], point: b.point } : null);
  return {
    input, profile, sun,
    base: end(input.base, "base"),
    nextBase: end(input.nextBase, "next-base"),
    origin: input.origin ? { ids: ["origin"], point: input.origin.point } : null,
    items: new Map(),
    hidden,
  };
}

const legText = (r: ResolvedLeg): string =>
  ({ routed: "Routed road time", plan: "From the plan", matrix: "The plan's drive table", estimate: r.km === null ? "A local move" : "A straight line scaled to a road time" })[r.basis];

type PushIn = Omit<TimelineEntry, "id" | "day" | "tz" | "lane" | "optional" | "addedBy" | "honesty" | "sourceItemId" | "end" | "at" | "from" | "to"> &
  Partial<Pick<TimelineEntry, "id" | "lane" | "optional" | "addedBy" | "honesty" | "sourceItemId" | "at" | "from" | "to">>;

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

  // A generated entry is named for what it is and what it precedes, not for its count: adding a stop elsewhere keeps the others' ids,
  // so a before/after comparison pairs the same entries.
  let before = "start";
  const nextId = (kind: EntryKind, sub: string | null): string => {
    // a meal is one per day whatever surrounds it; anything else is named for the stop it comes before
    const key = `${input.day}-${lane}-${kind}${sub ? `-${sub}` : ""}${kind === "meal" ? "" : `-${before}`}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return n > 1 ? `${key}.${n}` : key;
  };
  const push = (e: PushIn): TimelineEntry => {
    const entry: TimelineEntry = {
      day: input.day, lane: current, tz: input.tz, optional: false, addedBy: "scheduler", honesty: [], sourceItemId: null, at: null, from: null, to: null, ...e, id: e.id ?? nextId(e.kind, e.sub), end: "",
    };
    if (ctx.hidden.includes(entry.id)) entry.durationMin = 0;
    else entries.push(entry);
    entry.end = clock(m(entry.start) + entry.durationMin);
    return entry;
  };
  const RL = (a: LegEnd, b: LegEnd): ResolvedLeg => resolveLeg(a, b, input.legs, ctx.base?.point ?? null);
  const ruleTime = (note: string | null = null): TimelineEntry["time"] => ({ confidence: "suggested", source: "rule", pinned: false, note });
  const ruleDur = (id: string, minutes: number): TimelineEntry["duration"] => ({ source: "rule", basis: `rule: ${rule(id).label} ${fmtHM(minutes)}` });

  // ---- state ----
  let t = 0;
  let loc: LegEnd | null = null;
  let lunchDone = false;
  const later: string[] = [];
  let pushedBy = "";
  let dinnerDone = input.kind === "departure";
  let lastKind = null as EntryKind | null;
  let checkedIn = input.kind !== "arrival";
  const startsAtOrigin = !!ctx.origin && !ctx.base;

  const lastPlace = (): PlaceRef | null => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      if (e.kind === "leg") return e.to;
      if (e.at) return e.at;
    }
    return null;
  };

  /** Generated entries start on a 5 minute mark (spec 2.9 step 9). */
  const align = (): number => {
    const before = t;
    t = ceil5(t);
    return t - before;
  };
  const addRest = (minutes: number, sub: string, title: string, at: PlaceRef | null): void => {
    minutes -= align();
    if (minutes <= 0) return;
    push({ kind: "rest", sub, title, start: clock(t), durationMin: minutes, at, time: ruleTime(), duration: { source: "rule", basis: "the gap between entries" } });
    t += minutes;
    lastKind = "rest";
  };

  /** A coffee before a long wait: a generated break the next squeeze level drops, placed only when it ends by `deadline`. */
  const addCoffee = (at: PlaceRef | null, deadline: number): void => {
    if (o.squeeze >= 2) return;
    align();
    if (t + 20 > deadline) return;
    t += push({ kind: "break", sub: "coffee", title: "Coffee and a snack", start: clock(t), durationMin: 20, at, time: ruleTime(), duration: ruleDur("break.coffee", 20) }).durationMin;
    lastKind = "break";
  };

  const addLeg = (toRef: PlaceRef | null, r: ResolvedLeg, title: string, dur?: TimelineEntry["duration"]): void => {
    const from = lastPlace();
    // a way through the base reads as one leg "via Jasper"; the second half of a split drive carries on, it does not start again
    if (r.via && input.base) title += ` via ${input.base.name}`;
    const rest = title.replace(/^Drive to /, "Drive on to ");
    const src: TimeSource = r.basis === "routed" ? "data" : r.basis === "plan" ? "plan" : "rule";
    const honesty: TimelineEntry["honesty"] = r.mode === "drive" && r.basis !== "routed" ? ["drive_estimated"] : [];
    const part = (minutes: number, breaks: number, name = title): void => {
      t += push({
        kind: "leg", sub: r.mode, title: name, start: clock(t), durationMin: minutes, at: null, from, to: toRef,
        time: { confidence: "suggested", source: src, pinned: false, note: null }, duration: dur ?? { source: src, basis: legText(r) },
        leg: { mode: r.mode, km: r.km, basis: r.basis, breaks }, honesty: [...honesty],
      }).durationMin;
    };
    if (r.mode === "drive" && r.minutes > breakEveryMin(profile) && o.squeeze < 2) {
      const first = Math.max(5, Math.round(r.minutes / 10) * 5);
      part(first, 1);
      align();
      t += push({ kind: "break", sub: "leg-stretch", title: "Stretch break", start: clock(t), durationMin: 15, at: null, time: ruleTime(), duration: ruleDur("break.leg-stretch", 15) }).durationMin;
      part(r.minutes - first, 1, rest);
    } else part(r.minutes, 0);
    lastKind = "leg";
  };

  /** The walk from the car park to a trailhead after a drive out (rule park.walk-in): drawn, so the rail's times add up (SW-022). */
  const addWalkIn = (it: ScheduleItem, minutes: number): void =>
    addLeg(placeOf(it), { mode: "walk", minutes, km: null, basis: "estimate", estimate: true }, `Walk to the start of ${it.title}`, ruleDur("park.walk-in", minutes));

  const addMeal = (which: "lunch" | "dinner", style: "sit-down" | "picnic" | "at-base", at: PlaceRef | null, maxMin: number | null = null): void => {
    align();
    let st = style;
    const id = which === "dinner" ? "meal.dinner" : st === "sit-down" ? "meal.lunch.sit-down" : "meal.lunch.picnic";
    let minutes = rule(id).minutes;
    // the first squeeze level shortens lunch to a picnic
    if (which === "lunch" && o.squeeze >= 1) {
      st = "picnic";
      minutes = Math.min(minutes, 30);
    }
    const w = wins[which];
    if (maxMin !== null) minutes = Math.min(minutes, maxMin);
    const title = which === "dinner" ? (at ? `Dinner in ${at.name}` : "Dinner") : st === "picnic" ? "Picnic lunch" : "Lunch";
    t += push({
      kind: "meal", sub: which, style: st, title, start: clock(t), durationMin: minutes, at,
      time: { confidence: "suggested", source: "rule", pinned: false, window: { from: fmtMin(w.from), to: fmtMin(w.to), why: `${profile.party === "family" ? "family" : "adult"} ${which} window` }, note: null },
      duration: ruleDur(id, minutes),
    }).durationMin;
    lastKind = "meal";
  };

  const dinnerStart = wins.dinner.from + DINNER_SETTLE_MIN;
  const baseRef = refOf(input.base);
  const nextRef = refOf(input.nextBase);

  /** Drop bags, or check in from 15:00: an arrival day after the drive, a transfer day at the end. */
  const doCheckin = (at: LegEnd | null, ref: PlaceRef | null): void => {
    if (at && loc && !samePlace(loc, at)) {
      addLeg(ref, RL(loc, at), `Drive to ${ref?.name ?? "your stay"}`);
    }
    loc = at ?? loc;
    align();
    const early = t < 15 * 60 - 30;
    const minutes = early ? 15 : rule("checkin").minutes;
    const start = early ? t : Math.max(t, 15 * 60);
    if (start - t > REST_THRESHOLD_MIN) addRest(start - t, "free-time", "Free time before check-in", ref);
    else t = start;
    t += push({
      kind: "checkin", sub: "stay", title: early ? `Drop bags, ${ref?.name ?? "your stay"}` : `Check in, ${ref?.name ?? "your stay"}`, start: clock(t), durationMin: minutes, at: ref,
      time: ruleTime("From 15:00 unless your stay says otherwise"), duration: ruleDur("checkin", minutes),
    }).durationMin;
    checkedIn = true;
    lastKind = "checkin";
  };

  /** Back at the base (or on to the next one), a rest until dinner opens, dinner. */
  const dinner = (deadline: number | null, maxMin: number | null = null): void => {
    if (dinnerDone) return;
    const was = before;
    before = "dinner";
    const toNext = input.kind === "transfer";
    const where = toNext ? ctx.nextBase : ctx.base;
    const ref = toNext ? nextRef : baseRef;
    if (where && loc && !samePlace(loc, where)) {
      addLeg(ref, RL(loc, where), toNext ? `Drive on to ${ref?.name ?? "the next base"}` : `Back to ${ref?.name ?? "base"}`);
      loc = where;
    }
    if (t < dinnerStart && (deadline === null || deadline - dinnerStart >= 45)) {
      const gap = dinnerStart - t;
      if (gap > REST_THRESHOLD_MIN) addRest(gap, "at-base", "Rest at the base", ref);
      else t = dinnerStart;
    }
    dinnerDone = true;
    if (t <= wins.dinner.to + 120) addMeal("dinner", "at-base", ref, maxMin);
    before = was;
    // what the visitor added or an optional stop moved after dinner, or a dinner that cannot hold, is said so, naming the cause
    const named = stops.filter((x) => x.addedBy === "visitor").map((x) => x.item.title).join(", ");
    const meal = entries.find((e) => e.id === `${input.day}-${lane}-meal-dinner`);
    if (named && (!meal || m(meal.start) > dinnerLatest(profile))) pushedBy = named;
  };

  // ---- the day start (2.9 step 4) ----
  const startEnd: LegEnd | null = input.kind === "arrival" ? (ctx.origin ?? ctx.base) : (ctx.base ?? ctx.origin);
  if (o.resume === null) {
    const pinOf = (it: ScheduleItem): number | null => {
      if (it.start && !o.released.has(it.id)) return m(it.start.time) - (it.checkinMin ?? 0);
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
          const l = RL(at, e);
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
      kind: "start", sub, title: input.start?.label ?? defaultTitle, start: clock(startMin), durationMin: 0, at: where,
      time: { confidence: "suggested", source, pinned, note: note ?? (input.base || input.origin ? null : "Start point not set") }, duration: { source: "rule", basis: "a moment, not a duration" },
    });
    lastKind = "start";
    loc = startEnd;
    if (input.kind === "arrival") {
      const r = rule("arrival.car-hire");
      t += push({ kind: "visit", sub: "car-hire", title: "Collect the hire car", start: clock(t), durationMin: r.minutes, at: where, time: ruleTime(), duration: ruleDur("arrival.car-hire", r.minutes) }).durationMin;
      lastKind = "visit";
    }
    if (input.kind === "departure") {
      const r = rule("checkout");
      t += push({ kind: "checkout", sub: "stay", title: input.base ? `Check out of ${input.base.name}` : "Check out", start: clock(t), durationMin: r.minutes, at: baseRef, time: ruleTime(), duration: ruleDur("checkout", r.minutes) }).durationMin;
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
    before = it.id;
    // the rejoin pin is a moment in the place the party already is: no leg
    const stayHere = !it.point && !it.placeSlug && (it.kind === "break" || it.kind === "rest" || it.kind === "meal") && !input.legs.some((l) => l.from === it.id || l.to === it.id);
    const target = (stop.isRejoin || stayHere) && loc ? loc : endOf(it);
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
    if (it.start && !o.released.has(it.id)) {
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
      const back = loc && !samePlace(loc, ctx.base) ? RL(loc, ctx.base).minutes : 0;
      const out = RL(ctx.base, target).minutes;
      const earliest = Math.max(t + back, dinnerStart);
      const room = gate - out - 5 - earliest;
      // dinner before the evening outing, shortened to what fits (45 min at least)
      if (room >= 45) dinner(gate - out, room);
    }

    // an added or optional stop never pushes dinner past its latest time: dinner is eaten first and the stop follows it
    if (o.resume === null && !dinnerDone && !stop.isRejoin && pinStart === null && ctx.base && (input.kind === "normal" || input.kind === "arrival") && (stop.addedBy === "visitor" || it.optional)) {
      const out = loc && !samePlace(loc, target) ? RL(loc, target).minutes : 0;
      const back = samePlace(target, ctx.base) ? 0 : RL(target, ctx.base).minutes;
      if (t + out + duration + back > dinnerLatest(profile)) {
        dinner(null);
        later.push(it.title);
      }
    }

    // lunch is due where we stand
    const L = wins.lunch;
    if (!lunchDone && t >= L.from && it.kind !== "meal" && !stop.isRejoin && (gate === null || gate - t >= 75)) {
      lunchDone = true;
      if (t <= L.to + 30) addMeal("lunch", /town|village|cafe|restaurant/i.test(lastPlace()?.name ?? "") ? "sit-down" : "picnic", lastPlace());
    }

    // the leg to this stop
    let arrive = t;
    let leg: ResolvedLeg | null = null;
    if (loc !== null && !samePlace(loc, target)) {
      leg = RL(loc, target);
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
    // (also when the stop would run across the whole window: lunch comes first, after a short wait for it to open)
    if (!lunchDone && it.kind !== "meal" && !stop.isRejoin && (gate === null || gate - arrive >= 40) && (arrive >= L.from || (arrive >= L.from - 30 && arrive + duration > L.to && duration < 150))) {
      lunchDone = true;
      if (arrive <= L.to + 30) {
        if (t < L.from) t = L.from;
        addMeal("lunch", it.sub === "town" ? "sit-down" : "picnic", placeOf(it));
      }
      arrive = t;
    }

    // ---- place the stop ----
    let s0: number;
    if (pinStart !== null) {
      const arrival = arrive + walkIn;
      const gateT = gate ?? pinStart;
      const gap = gateT - arrival;
      // the wait is spent at the car park, then the walk in: the walk ends at the gate
      if (gap > REST_THRESHOLD_MIN && !(stop.isRejoin && !o.isMain)) {
        const place = leg ? placeOf(it) : lastPlace();
        if (gap >= COFFEE_GAP_MIN) addCoffee(place, gateT - walkIn);
        const left = gateT - walkIn - t;
        if (left > REST_THRESHOLD_MIN) addRest(left, "free-time", "Free time", place);
      }
      if (walkIn) addWalkIn(it, walkIn);
      if (arrival > pinStart) {
        warnings.push({ code: "S_FIXED_MISSED", entryId: it.id, lane: current, message: `Arrives ${fmtMin(arrival)} for the ${fmtMin(pinStart)} ${it.sub === "together" ? "regroup" : it.title}.` });
      }
      if (checkin) {
        push({
          kind: "booking", sub: "slot", title: `Check in for ${it.title}`, start: clock(gateT), durationMin: checkin, at: placeOf(it),
          time: { confidence: "fixed", source: it.start?.source === "operator" ? "operator" : "rule", pinned: true, note: `Arrive ${checkin} min before the slot` },
          duration: ruleDur("booking.checkin", checkin), bookingOf: it.id,
        });
      }
      s0 = pinStart;
    } else {
      const buffer = !leg && lastKind !== null && lastKind !== "start" && lastKind !== "rest" && lastKind !== "leg" ? 5 : 0;
      if (walkIn) addWalkIn(it, walkIn);
      s0 = ceil5(t + buffer);
      if (it.start && o.released.has(it.id)) {
        warnings.push({ code: "S_FIXED_MISSED", entryId: it.id, lane: current, message: `${it.title} moves from ${it.start.time} to about ${fmtMin(s0)}: earlier stops take longer.` });
      }
      const open = it.window?.from ? m(it.window.from) : 0;
      if (open > s0) {
        if (open - s0 > REST_THRESHOLD_MIN) addRest(open - t, "free-time", "Wait for opening", placeOf(it));
        s0 = open;
      }
    }

    // a long outing that spans the lunch window carries lunch with it (on-trail, no extra time)
    let onTrailAt: number | null = null;
    if (!lunchDone && it.kind !== "meal" && !stop.isRejoin && duration >= 150 && s0 <= L.from + 30 && s0 + duration >= L.to - 30) {
      lunchDone = true;
      onTrailAt = Math.min(Math.max(s0 + 60, Math.min(L.to - 20, s0 + duration)), s0 + duration - 5);
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
    push({
      id: it.id, kind: it.kind as EntryKind, sub: it.sub, title: it.title, start: clock(s0), durationMin: duration, at: placeOf(it), time,
      duration: { source: D.source, basis: D.basis }, ...(it.kind === "trail" || it.stats ? { stats: { distanceKm: it.stats?.distanceKm ?? null, gainM: it.stats?.gainM ?? null } } : {}),
      optional: it.optional, addedBy: stop.addedBy, sourceItemId: it.id, honesty: [...it.honesty, ...(D.unknown ? (["not_known"] as const) : [])],
    });
    t = s0 + duration;
    if (onTrailAt !== null) {
      push({
        kind: "meal", sub: "lunch", style: "on-trail", title: "Packed lunch on the trail", start: clock(onTrailAt), durationMin: 0, at: placeOf(it),
        time: { confidence: "suggested", source: "rule", pinned: false, note: null, window: { from: fmtMin(L.from), to: fmtMin(L.to), why: "lunch window" } },
        duration: { source: "rule", basis: "eaten on the trail, inside the walk" }, insideOf: it.id,
      });
    }
    if (it.kind === "meal" && it.sub === "lunch") lunchDone = true;
    if (it.kind === "meal" && it.sub === "dinner") dinnerDone = true;
    loc = target;
    lastKind = stop.isRejoin ? "rest" : it.kind as EntryKind;
  }

  // ---- close the day (2.9 step 8) ----
  before = "close";
  if (o.resume === null) {
    if (!checkedIn) doCheckin(ctx.base, baseRef);
    if (!lunchDone && input.kind !== "departure") {
      lunchDone = true;
      const L = wins.lunch;
      if (t <= L.to + 30) {
        // nothing left to do before lunch: head back to the base and eat there when the window opens
        if (t < L.from && input.kind === "normal" && ctx.base && loc && !samePlace(loc, ctx.base)) {
          addLeg(baseRef, RL(loc, ctx.base), `Back to ${baseRef?.name ?? "base"}`);
          loc = ctx.base;
        }
        if (t < L.from && L.from - t > REST_THRESHOLD_MIN) addRest(L.from - t, "at-base", "Rest at the base", baseRef);
        else if (t < L.from) t = L.from;
        addMeal("lunch", "picnic", lastPlace());
      }
    }
    if (input.kind === "transfer") {
      doCheckin(ctx.nextBase, nextRef);
      dinner(null);
    } else if (input.kind === "departure") {
      if (ctx.nextBase && loc && !samePlace(loc, ctx.nextBase)) addLeg(nextRef, RL(loc, ctx.nextBase), `Drive to ${nextRef?.name ?? "the airport"}`);
    } else {
      dinner(null);
      if (ctx.base && loc && !samePlace(loc, ctx.base)) addLeg(baseRef, RL(loc, ctx.base), `Back to ${baseRef?.name ?? "base"}`);
    }
    const sub = input.kind === "departure" ? "at-airport" : input.kind === "transfer" ? "at-next-base" : startsAtOrigin ? "at-home" : "at-base";
    const ref = input.kind === "departure" || input.kind === "transfer" ? nextRef : startsAtOrigin ? input.origin : baseRef;
    const title = input.kind === "departure" ? "At the airport 3 h before an international flight" : startsAtOrigin ? "Home again" : ref ? `Back at ${ref.name}` : "End of the day";
    align();
    push({
      kind: "end", sub, title, start: clock(t), durationMin: 0, at: ref,
      time: { confidence: "suggested", source: "rule", pinned: false, note: null, ...(input.homeBy ? { window: { from: null, to: input.homeBy, why: "home by" } } : {}) },
      duration: { source: "rule", basis: "a moment, not a duration" },
    });
  }
  if (later.length || pushedBy) {
    const meal = entries.find((e) => e.id === `${input.day}-${lane}-meal-dinner`);
    warnings.push({ code: "S_DINNER_LATE", entryId: null, lane: current, message: later.length ? `${later.join(", ")} comes after dinner so dinner holds.` : `With ${pushedBy}, ${meal ? `dinner is at ${meal.start}` : "no time for dinner"}.` });
  }
  return { entries, warnings, afterFirstLeg, end: t };
}

const legsMin = (es: TimelineEntry[]): number => es.filter((e) => e.kind === "leg").reduce((s, e) => s + e.durationMin, 0);
const missedCount = (r: LaneResult): number => r.warnings.filter((w) => w.code === "S_FIXED_MISSED").length;

/**
 * Runs a lane at the lowest squeeze level that keeps every pin (2.9 step 7). A pin from the plan (not an operator's slot) that the
 * day cannot reach is let go: that item flows after what precedes it and one line says so, rather than two times that overlap.
 */
function runSqueezed(ctx: Ctx, stops: Stop[], lane: Lane, profile: Profile, o: Omit<LaneOpts, "squeeze" | "released">): LaneResult {
  const released = new Set<string>();
  let res: LaneResult = runLane(ctx, stops, lane, profile, { ...o, squeeze: 0, released });
  for (let round = 0; round < 4; round++) {
    for (let sq = 1; sq <= MAX_SQUEEZE && missedCount(res) > 0; sq++) {
      const next = runLane(ctx, stops, lane, profile, { ...o, squeeze: sq, released });
      if (missedCount(next) <= missedCount(res)) res = next;
    }
    const letGo = res.warnings.filter((w) => w.code === "S_FIXED_MISSED" && w.entryId && !released.has(w.entryId) && stops.some((x) => x.item.id === w.entryId && x.item.start?.confidence === "suggested")).map((w) => w.entryId!);
    if (!letGo.length) break;
    letGo.forEach((id) => released.add(id));
    res = runLane(ctx, stops, lane, profile, { ...o, squeeze: 0, released });
  }
  return res;
}

/** Cheapest insertion (2.9): the position with no new missed pin, then the least added leg time. */
function insertAdded(ctx: Ctx, stops: Stop[], item: ScheduleItem, profile: Profile): Stop[] {
  const add: Stop = { item, addedBy: "visitor" };
  let best = { pos: stops.length, score: Infinity };
  for (let pos = 0; pos <= stops.length; pos++) {
    const trial = [...stops.slice(0, pos), add, ...stops.slice(pos)];
    const r = runSqueezed(ctx, trial, "all", profile, { label: "all", resume: null, isMain: true });
    const dinner = r.entries.find((e) => e.kind === "meal" && e.sub === "dinner");
    // lexicographic: a missed pin, a late dinner, the day's end, the driving added
    const score = missedCount(r) * 1e8 + (dinner && m(dinner.start) > dinnerLatest(profile) ? 1e7 : 0) + r.end * 1e3 + legsMin(r.entries);
    if (score < best.score) best = { pos, score };
  }
  return [...stops.slice(0, best.pos), add, ...stops.slice(best.pos)];
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
  const rng = (r: SunRange): [string, string] => [fmtMin(r.lo), fmtMin(r.hi)];
  const ev = (to: "sunrise" | "sunset", r: SunRange, keep: boolean, n: number): void => {
    if (keep) out.push(row(to, r.mid, rng(r), `${to === "sunrise" ? "Sunrise" : "Sunset"}, about ${fmtMin(r.lo)} to ${fmtMin(r.hi)} in this window`, n));
  };
  const within = (r: SunRange): boolean => r.mid >= spanStart && r.mid <= spanEnd;
  ev("sunrise", sun.sunrise, within(sun.sunrise) || anchored.has("sunrise"), 1);
  ev("sunset", sun.sunset, within(sun.sunset) || anchored.has("sunset") || anchored.has("golden-pm"), 2);
  return out;
}

/** A stop that needs a dark sky (nautical dusk) follows the day: it is never given a clock time that could fall in daylight. */
const afterDark = (it: ScheduleItem): boolean => it.needs?.sun === "nautical-dusk";

/** The after-dark stop: after the day's last entry, outside the span, the day cap and the totals. */
function darkEntry(ctx: Ctx, it: ScheduleItem, at: string, profile: Profile): TimelineEntry {
  const a = ctx.sun ? anchorTime(ctx.sun, "nautical-dusk", 0) : null;
  return plain(ctx.input, it, resolveDuration(it, profile), m(at), {
    at: null, optional: true, block: "After dark",
    time: { confidence: "anchored", source: "sun", pinned: false, note: `After dark${a ? `, about ${a.range[0]} to ${a.range[1]} in this window,` : ""} if the sky is clear.`, ...(a ? { anchor: { to: "nautical-dusk" as const, offsetMin: 0, range: a.range } } : {}) },
  });
}

/** An entry for a stop the scheduler does not time itself (a condensed day's block, the after-dark stop). */
function plain(input: ScheduleDayInput, it: ScheduleItem, D: ReturnType<typeof resolveDuration>, t: number, over: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: it.id, day: input.day, lane: "all", kind: it.kind as EntryKind, sub: it.sub, title: it.title, start: clock(t), durationMin: D.minutes, end: clock(t + D.minutes), tz: input.tz, at: placeOf(it), from: null, to: null,
    time: { confidence: "suggested", source: "plan", pinned: false, note: it.note }, duration: { source: D.source, basis: D.basis },
    ...(it.stats ? { stats: { distanceKm: it.stats.distanceKm, gainM: it.stats.gainM } } : {}),
    optional: it.optional, addedBy: "author", sourceItemId: it.id, honesty: [...it.honesty], ...over,
  };
}

const KIND_ORDER: Record<EntryKind, number> = { start: 0, checkout: 1, sun: 2, leg: 3, booking: 4, visit: 5, trail: 5, meal: 6, break: 6, rest: 7, checkin: 7, end: 9 };
const LANE_ORDER: Record<Lane, number> = { all: 0, B: 1, C: 1, A: 2 };
/** The regroup pin of a split day comes before whatever starts at the same minute. */
const kindOrder = (e: TimelineEntry): number => (e.block ? 10 : e.kind === "rest" && e.sub === "together" ? -1 : e.insideOf ? 2.5 : KIND_ORDER[e.kind]);
const sortEntries = (es: TimelineEntry[]): TimelineEntry[] =>
  [...es].sort((a, b) => m(a.start) - m(b.start) || LANE_ORDER[a.lane] - LANE_ORDER[b.lane] || kindOrder(a) - kindOrder(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export const adultsOf = (p: Profile): Profile => ({ ...p, party: "adults", youngest: null });

const partOfDay = (min: number): "Morning" | "Afternoon" | "Evening" => (min < 12 * 60 ? "Morning" : min < 17 * 60 ? "Afternoon" : "Evening");

const sumBy = (es: TimelineEntry[], f: (e: TimelineEntry) => number): number => es.reduce((n, e) => n + f(e), 0);
const totalsOf = (es: TimelineEntry[], active: (e: TimelineEntry) => boolean): DayTimeline["totals"] => {
  const trails = es.filter((e) => e.kind === "trail");
  return {
    activeMin: sumBy(es.filter((e) => !e.optional && active(e)), (e) => e.durationMin),
    // the sum of the drives as each is drawn (to 5 min), so the header and the legs under it agree (SW-022: 48 + 10 + 39 read 50 + 10 + 40
    // under a header of 1 h 35)
    driveMin: sumBy(es.filter((e) => e.kind === "leg" && e.leg?.mode === "drive"), (e) => shownMin(e.durationMin)),
    walkKm: Math.round(sumBy(trails, (e) => e.stats?.distanceKm ?? 0) * 10) / 10,
    gainM: sumBy(trails, (e) => e.stats?.gainM ?? 0),
  };
};

/** A condensed plan (design 9): the plan's own stops in order with a part of the day, a flight or transfer where it names one, and nothing invented. */
function blocksDay(input: ScheduleDayInput, profile: Profile, opts: ScheduleOptions, sel: ReturnType<typeof selectVariant>): DayTimeline {
  const entries: TimelineEntry[] = [];
  const items = [...sel.variant.items, ...(opts.added ?? [])];
  let t = 9 * 60;
  items.forEach((it, i) => {
    const D = resolveDuration(it, profile);
    const isLeg = it.kind === "transfer";
    const own = i >= sel.variant.items.length || !!opts.visitor?.includes(it.id);
    entries.push(plain(input, it, D, t, {
      kind: isLeg ? "leg" : (it.kind as EntryKind), at: isLeg ? null : placeOf(it),
      time: { confidence: "suggested", source: own ? "visitor" : "plan", pinned: false, note: it.note }, addedBy: own ? "visitor" : "author", block: partOfDay(t),
      ...(isLeg ? { leg: { mode: (it.sub ?? "drive") as "drive", km: null, basis: "plan" as const, breaks: 0 } } : {}),
    }));
    t += D.minutes;
  });
  const tl: DayTimeline = {
    day: input.day, variant: { key: sel.variant.key, label: sel.variant.label, chosenBy: sel.chosenBy, reason: sel.reason }, lanes: ["all"], entries,
    span: { start: "09:00", end: clock(t), minutes: t - 9 * 60 },
    totals: totalsOf(entries, () => true),
    warnings: [], fits: sel.fits, notes: sel.fits ? [] : [{ kind: "no-fit", text: sel.reason }], blocks: true,
  };
  tl.warnings = validateDay(tl, input, profile, null, new Map(items.map((i) => [i.id, i])), "all");
  return tl;
}

/** Schedules one day for a profile (2.9). */
export function scheduleDay(input: ScheduleDayInput, profile: Profile, opts: ScheduleOptions = {}): DayTimeline {
  const sel = opts.selection ?? selectVariant(input, profile, opts.variant);
  if (input.blocks) return blocksDay(input, profile, opts, sel);
  const ctx = makeCtx(input, profile, opts.hidden);
  let stops: Stop[] = sel.variant.items.map((item) => ({ item, addedBy: opts.visitor?.includes(item.id) ? "visitor" : "author" }));
  // dark-sky watching waits for a dark sky: when that is past the evening it follows the day instead of being scheduled in it
  const dark = stops.filter((s) => afterDark(s.item)).map((s) => s.item);
  stops = stops.filter((s) => !dark.includes(s.item));
  for (const add of opts.added ?? []) stops = insertAdded(ctx, stops, add, profile);

  const rejoin = sel.parallel?.rejoin ?? sel.variant.rejoin ?? null;
  const splitDrawn = profile.split && sel.parallel !== null && rejoin !== null;
  const mainLabel: Lane = splitDrawn ? (sel.variant.key === "main" ? "B" : (sel.variant.key as Lane)) : "all";
  // the wait for the other adult is part of the day whichever view is shown: a view switch must not change the plan (L3c I-1).
  // A version that carries no rejoin of its own (the easy day) has nothing to wait for unless the visitor asks for both lanes.
  if (sel.parallel && rejoin && (profile.split || sel.variant.rejoin)) {
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
        text: `${pv.optionalSplit ? "Optional split" : "Split option"}: the stronger walkers can take ${walk.title}${km ? ` (${km} km, ${fmtHM(dur)})` : ` (${fmtHM(dur)})`}${rj ? ` and rejoin at ${rj.time}${rj.place ? ` at ${rj.place}` : ""}` : ""}.`,
      });
    }
  }

  const dayEnd = entries.filter((e) => e.kind === "end" && (e.lane === "all" || e.lane === mainLabel)).map((e) => e.start)[0] ?? clock(Math.max(...entries.map((e) => m(e.start))));
  entries = sortEntries([...entries, ...sunRows(ctx, entries), ...dark.map((it) => darkEntry(ctx, it, dayEnd, profile))]);
  const real = entries.filter((e) => e.kind !== "sun" && !e.block);
  const partyLane = (e: TimelineEntry): boolean => e.lane === "all" || e.lane === mainLabel;
  // a day whose every row the person removed (STEP2-E1B) has a zero span, not an infinite one
  const startM = Math.min(...real.map((e) => m(e.start)), MINUTES_PER_DAY - 1);
  const endM = Math.max(startM, ...real.filter(partyLane).map((e) => m(e.start) + e.durationMin));
  const span = { start: fmtMin(startM), end: clock(endM), minutes: endM - startM };
  const totals = totalsOf(real.filter(partyLane), (e) => e.kind === "visit" || e.kind === "trail" || e.kind === "leg");
  if (!sel.fits) notes.unshift({ kind: "no-fit", text: sel.reason });

  const timeline: DayTimeline = {
    day: input.day, variant: { key: sel.variant.key, label: sel.variant.label, chosenBy: sel.chosenBy, reason: sel.reason },
    lanes, entries, span, totals, warnings, fits: sel.fits, notes, blocks: false,
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
