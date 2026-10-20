// Validation of a scheduled day (spec 2.11). It produces warnings, never errors. W_ codes mirror core/src/checks/days.ts so
// a trip copied into the planner raises the same warnings it had on the public page (toItems.ts maps the rows for that).
import { fmtMin, toMin } from "../checks/time.ts";
import type { SunRef } from "./sun.ts";
import { ACTIVE_BUDGET_MIN, dayCapMin, fmtHM, PACE_RULES, walkCeiling } from "./rules.ts";
import type { DayTimeline, Lane, Profile, ScheduleDayInput, ScheduleItem, ScheduleWarning, TimelineEntry } from "./types.ts";

const m = (hhmm: string): number => toMin(hhmm) ?? 0;
const endM = (e: TimelineEntry): number => m(e.start) + e.durationMin;

/** The entries of one lane as the visitor reads them: that lane plus the shared ones, in order. */
function laneEntries(t: DayTimeline, lane: Lane): TimelineEntry[] {
  return t.entries.filter((e) => e.kind !== "sun" && e.block !== "After dark" && (e.lane === "all" || e.lane === lane));
}

export function validateDay(t: DayTimeline, input: ScheduleDayInput, profile: Profile, sun: SunRef | null, items: Map<string, ScheduleItem>, mainLabel: Lane): ScheduleWarning[] {
  const out: ScheduleWarning[] = [];
  const warn = (code: ScheduleWarning["code"], message: string, entry: TimelineEntry | null, lane: Lane): void => {
    if (out.some((w) => w.code === code && w.entryId === (entry?.id ?? null) && w.message === message)) return;
    out.push({ code, message, entryId: entry?.id ?? null, lane });
  };
  const lanes: Lane[] = t.lanes.length > 1 ? t.lanes : ["all"];
  const timed = !t.blocks;
  const pr = PACE_RULES[profile.pace];
  const ceiling = walkCeiling(profile);

  for (const lane of timed ? lanes : []) {
    const es = laneEntries(t, lane);
    // W_OVERLAP: a non-leg entry that starts before the previous one (plus the leg) is over
    const body = es.filter((e) => e.kind !== "end" && e.kind !== "start" && e.durationMin > 0 && !(e.kind === "meal" && e.style === "on-trail"));
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1]!;
      const b = body[i]!;
      const over = endM(a) - m(b.start);
      if (over > 0 && b.time.pinned) warn("W_OVERLAP", `${a.title} runs ${over} min into ${b.title} at ${b.start}.`, b, lane);
    }
  }

  const main = t.entries.filter((e) => e.kind !== "sun" && e.block !== "After dark" && (e.lane === "all" || e.lane === mainLabel));
  for (const e of t.entries) {
    if (e.kind === "sun" || e.block === "After dark") continue;
    const w = e.time.window;
    const it = e.sourceItemId ? items.get(e.sourceItemId) : undefined;
    // W_HOURS and S_LAST_RIDE
    if (timed && w && (e.kind === "visit" || e.kind === "trail")) {
      if (w.from && m(e.start) < m(w.from) && !it?.window?.lastUp) warn("W_HOURS", `Starts ${e.start}; ${e.title} opens at ${w.from}.`, e, e.lane);
      if (w.to && endM(e) > m(w.to) && !it?.window?.lastDown) warn("W_HOURS", `Ends ${fmtMin(endM(e))}; ${e.title} closes at ${w.to}.`, e, e.lane);
    }
    if (!timed) {
      /* a condensed plan has no clock times to check */
    } else if (it?.window?.lastUp && m(e.start) > m(it.window.lastUp)) {
      warn("S_LAST_RIDE", `Last ride up is ${it.window.lastUp}; this starts at ${e.start}.`, e, e.lane);
    } else if (it?.window?.lastDown && endM(e) > m(it.window.lastDown)) {
      warn("S_LAST_RIDE", `Last ride down is ${it.window.lastDown}; this ends at ${fmtMin(endM(e))}.`, e, e.lane);
    }
    // W_DAYLIGHT: a trail or needs_daylight entry ends after the earliest sunset of the window
    if (timed && sun && sun.state === "normal" && (e.kind === "trail" || it?.needsDaylight)) {
      const limit = e.kind === "trail" ? sun.civilDusk.lo - 30 : sun.sunset.lo;
      if (endM(e) > limit && !e.optional) warn("W_DAYLIGHT", `Ends about ${fmtMin(endM(e))}; sunset can be ${fmtMin(sun.sunset.lo)} in this window.`, e, e.lane);
    }
    // S_MIDNIGHT
    if (timed && m(e.start) + e.durationMin > 24 * 60 - 1 && e.kind !== "end") warn("S_MIDNIGHT", `${e.title} runs past midnight.`, e, e.lane);
    // W_CEILING: a trail in the party's lane over the walk ceiling
    if (e.kind === "trail" && (e.lane === "all" || e.lane === mainLabel) && !e.optional) {
      const km = e.stats?.distanceKm ?? null;
      const gain = e.stats?.gainM ?? null;
      if (ceiling.km !== null && km !== null && km > ceiling.km) warn("W_CEILING", `${e.title} is ${km} km; we plan walks up to ${ceiling.km} km at age ${profile.youngest ?? "this setting"}.`, e, e.lane);
      else if (ceiling.gainM !== null && gain !== null && gain > ceiling.gainM) warn("W_CEILING", `${e.title} climbs ${gain} m; we plan climbs up to ${ceiling.gainM} m at age ${profile.youngest ?? "this setting"}.`, e, e.lane);
    }
    // W_FIT
    if (it && it.minAge !== null && profile.party === "family" && profile.youngest !== null && profile.youngest < it.minAge && (e.lane === "all" || e.lane === mainLabel)) {
      warn(
        "W_FIT",
        it.minAgeRule === "advice"
          ? `${e.title} is advised for age ${it.minAge} and up.`
          : it.minAgeRule === "plan"
            ? `${e.title} is an adults' hike in this plan; we offer it from age ${it.minAge}.`
            : `${e.title} has a minimum age of ${it.minAge}.`,
        e,
        e.lane,
      );
    }
  }

  // S_DAY_CAP: the time away from base. A long rest at the base (45 min or more) and dinner there are not part of the outing.
  if (timed) {
    const cap = dayCapMin(profile);
    // a stored zero-minute leg to or from the base marks an item done at the base itself (laundry, errands)
    const atBase = new Set(input.legs.filter((l) => l.minutes === 0 && (l.from === "base" || l.to === "base")).map((l) => (l.from === "base" ? l.to : l.from)));
    const home = main.filter((e) => e.durationMin >= 45 && (e.sub === "at-base" && e.kind === "rest" || (e.kind === "visit" && e.sourceItemId !== null && atBase.has(e.sourceItemId)))).reduce((n, e) => n + e.durationMin, 0)
      + main.filter((e) => e.kind === "meal" && e.style === "at-base").reduce((n, e) => n + e.durationMin, 0);
    const away = t.span.minutes - home;
    if (away > cap) {
      const opt = [...new Set(main.filter((e) => e.optional && (e.kind === "visit" || e.kind === "trail")).map((e) => e.title))];
      warn("S_DAY_CAP", `Day ${t.day} is ${fmtHM(away)} away from base, over ${fmtHM(cap)} for a ${profile.pace} ${profile.party === "family" ? "family " : ""}day.${opt.length ? ` Optional: ${opt.join(", ")}.` : ""}`, null, "all");
    }
  }
  // W_PACE: active time on the party lane over the budget
  const budget = ACTIVE_BUDGET_MIN[profile.pace];
  if (timed && t.totals.activeMin > budget) {
    warn("W_PACE", `${fmtHM(t.totals.activeMin)} of active time, over the ${profile.pace} budget of ${fmtHM(budget)}.`, null, "all");
  }
  // W_DRIVE_LIMIT
  if (timed && t.totals.driveMin > pr.driveLimitMin) {
    warn("W_DRIVE_LIMIT", `Drives ${fmtHM(t.totals.driveMin)}, over the ${fmtHM(pr.driveLimitMin)} limit for a ${profile.pace} day.`, null, "all");
  }
  // S_HOME_BY
  const end = main.find((e) => e.kind === "end");
  if (end?.time.window?.why === "home by" && end.time.window.to && m(end.start) > m(end.time.window.to)) {
    warn("S_HOME_BY", `Home ${end.start}, ${m(end.start) - m(end.time.window.to)} min after ${end.time.window.to}.`, end, "all");
  }
  // S_NO_FIT
  if (!t.fits) warn("S_NO_FIT", `No version of Day ${t.day} suits age ${profile.youngest ?? "this setting"}.`, null, "all");
  return out;
}
