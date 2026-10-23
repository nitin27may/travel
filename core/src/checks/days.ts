// Day checks (plan 2.4, "Day checks"): warnings per day and per track. Whole-group items (track null) are merged
// into each track's timeline. One function serves the validator, the hooks, the editor panel and the planner.
import type { DayWarning, WarnCode } from "./codes.ts";
import type { DayCheckCtx, Row } from "./context.ts";
import { haversineM } from "../geo/distance.ts";
import { fmtDuration, fmtMin, isoWeekday, sameOffsets, toMin } from "./time.ts";

const PACE_MIN = [300, 420, 540, 660, 780];
const TRACKS = ["A", "B", "C"];
const LIMIT_COLS = ["min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg"];

interface Slot {
  item: Row;
  /** index in trip.items, for the warning path */
  index: number;
  start: number | null;
  end: number | null;
  /** true when `start` or a window was written down, false when derived from the previous item */
  fixed: boolean;
  src: 0 | 1;
}

type LL = { lat: number; lon: number };

export function checkDays(trip: Row, ctx: DayCheckCtx): DayWarning[] {
  const out: DayWarning[] = [];
  const seen = new Set<string>();
  const days: Row[] = trip.days ?? [];
  const items: Row[] = trip.items ?? [];
  const bases: Row[] = trip.bases ?? [];
  const bookings: Row[] = trip.trip_bookings ?? [];
  const profile: Row = trip.profile ?? {};
  const t: Row = trip.trip ?? {};
  const baseById = new Map(bases.map((b) => [b.id as string, b]));
  const bookingById = new Map(bookings.map((b) => [b.id as string, b]));
  const customById = new Map((trip.custom_items ?? []).map((c: Row) => [c.id as string, c]));
  const edition = (trip.editions ?? []).find((e: Row) => e.status === "chosen" || e.status === "booked") as Row | undefined;
  const year = edition?.start ? Number(String(edition.start).slice(0, 4)) : 2027;

  function warn(code: WarnCode, path: string, message: string, day: Row | null, track: string | null, dedupe: string): void {
    const key = `${code}|${path}|${dedupe}`;
    if (seen.has(key)) return;
    seen.add(key);
    const accepted = !!day && Array.isArray(day.accepted_warnings) && day.accepted_warnings.includes(code);
    out.push({ code, path, message, day: day ? (day.n as number) : null, track, accepted });
  }

  const baseCoords = (b: Row | undefined): LL | null => {
    if (!b) return null;
    if (typeof b.lat === "number" && typeof b.lon === "number") return { lat: b.lat, lon: b.lon };
    const st = b.stay_id ? ctx.catalog.stay(b.stay_id) : null;
    if (st && typeof st.lat === "number") return { lat: st.lat, lon: st.lon };
    const pl = b.place_id ? ctx.catalog.place(b.place_id) : null;
    return pl && typeof pl.lat === "number" ? { lat: pl.lat, lon: pl.lon } : null;
  };

  const rowCoords = (r: Row | null | undefined): LL | null =>
    r && typeof r.lat === "number" && typeof r.lon === "number" ? { lat: r.lat, lon: r.lon } : null;

  /** item coordinates: its own, else the row it references, else its base (plan 2.3, items.lat) */
  function coordsOf(it: Row): LL | null {
    const own = rowCoords(it);
    if (own) return own;
    if (it.trail_id) {
      const tr = ctx.catalog.trail(it.trail_id);
      if (tr && typeof tr.trailhead_lat === "number") return { lat: tr.trailhead_lat, lon: tr.trailhead_lon };
    }
    if (it.activity_id) {
      const a = ctx.catalog.activity(it.activity_id);
      const c = rowCoords(a) ?? (a?.place_id ? rowCoords(ctx.catalog.place(a.place_id)) : null);
      if (c) return c;
    }
    if (it.eatery_id) {
      const c = rowCoords(ctx.catalog.eatery(it.eatery_id));
      if (c) return c;
    }
    if (it.custom_item_id) {
      const c = rowCoords(customById.get(it.custom_item_id) as Row | undefined);
      if (c) return c;
    }
    if (it.place_id) {
      const c = rowCoords(ctx.catalog.place(it.place_id));
      if (c) return c;
    }
    return it.base_id ? baseCoords(baseById.get(it.base_id)) : null;
  }

  const dayRow = (n: number): Row | null => days.find((d) => d.n === n) ?? null;

  /** zone of an item (plan 2.1): items.tz, else its base, else the base the group sleeps in, else the origin zone */
  function zoneOf(it: Row): string | null {
    if (it.tz) return it.tz as string;
    if (it.base_id && baseById.get(it.base_id)) return baseById.get(it.base_id)!.tz as string;
    const d = dayRow(it.day);
    if (d?.base_id && baseById.get(d.base_id)) return baseById.get(d.base_id)!.tz as string;
    return (t.origin_tz as string) ?? null;
  }

  function slotsOf(list: { item: Row; index: number }[], src: 0 | 1): Slot[] {
    const sorted = [...list].sort((a, b) => a.item.seq - b.item.seq);
    const slots: Slot[] = [];
    let prevEnd: number | null = null;
    for (const { item, index } of sorted) {
      const fixedStart = toMin(item.start);
      const win = toMin(item.window_start);
      const written = fixedStart ?? win;
      const start: number | null = written ?? (prevEnd !== null ? prevEnd + (item.leg_minutes ?? 0) : null);
      const end: number | null = start !== null ? start + (item.duration_min ?? 0) : null;
      slots.push({ item, index, start, end, fixed: written !== null, src });
      prevEnd = end;
    }
    return slots;
  }

  /** item-level checks run once per item, whichever timeline it appears in */
  function itemChecks(s: Slot, day: Row, track: string | null): void {
    const it = s.item;
    const path = `/items/${s.index}`;
    const label = `${it.id} "${it.title}"`;
    const coords = coordsOf(it);
    if (!coords && it.type !== "buffer" && it.type !== "rest") {
      warn("W_NO_COORDS", path, `${label} resolves to no coordinates, so the daylight and leg checks skip it. Add lat and lon, or reference a place, trail or base. Example: lat -49.33, lon -72.88.`, day, it.track, "");
    }
    const date = ctx.resolveDate(day.n);
    // W_DAYLIGHT
    if (it.needs_daylight && s.end !== null && coords && date) {
      const zone = zoneOf(it);
      const sun = zone ? ctx.sun(day.n, coords.lat, coords.lon, zone) : null;
      const sunset = sun ? toMin(sun.sunset) : null;
      if (sunset !== null && s.end > sunset) {
        warn("W_DAYLIGHT", path, `${label} ends at ${fmtMin(s.end)}, after sunset at ${sun!.sunset} on day ${day.n}. Start earlier or shorten it.`, day, it.track, "");
      }
    }
    // W_HOURS
    const from = toMin(it.open_from);
    const to = toMin(it.open_to);
    if (s.start !== null && from !== null && s.start < from) {
      warn("W_HOURS", path, `${label} starts at ${fmtMin(s.start)} but opens at ${it.open_from}.`, day, it.track, "open");
    }
    if (s.end !== null && to !== null && s.end > to) {
      warn("W_HOURS", path, `${label} ends at ${fmtMin(s.end)} but closes at ${it.open_to}.`, day, it.track, "close");
    }
    if (date && Array.isArray(it.closed_weekdays) && it.closed_weekdays.includes(isoWeekday(date))) {
      warn("W_HOURS", path, `${label} falls on ${date}, a weekday it is closed (ISO weekday ${isoWeekday(date)}).`, day, it.track, "weekday");
    }
    // W_BOOKING_DAY
    if (it.booking_id) {
      const b = bookingById.get(it.booking_id);
      if (b && Array.isArray(b.used_days) && !b.used_days.includes(day.n)) {
        warn("W_BOOKING_DAY", path, `${label} uses booking ${b.id}, which is booked for day(s) ${JSON.stringify(b.used_days)}, not day ${day.n}. Add ${day.n} to used_days or move the item.`, day, it.track, "");
      }
    }
    // W_EARLY
    if (profile.early_starts === "never" && s.start !== null && s.start < 360) {
      warn("W_EARLY", path, `${label} starts at ${fmtMin(s.start)}, before 06:00, and the profile says early starts: never.`, day, it.track, "");
    }
    // W_CEILING
    if (it.type === "trail" && it.trail_id) {
      const tr = ctx.catalog.trail(it.trail_id);
      if (tr) {
        const o = (it.override ?? {}) as Row;
        const km = o.km ?? tr.km;
        const gain = o.gain_m ?? tr.gain_m;
        const grade = o.house_grade ?? tr.house_grade;
        if (it.track !== "A") {
          if (typeof profile.hiking_ceiling_km === "number" && typeof km === "number" && km > profile.hiking_ceiling_km) {
            warn("W_CEILING", path, `${label} is ${km} km, over the hiking ceiling of ${profile.hiking_ceiling_km} km. Move it to Track A or pick a shorter trail.`, day, it.track, "km");
          }
          if (typeof profile.hiking_ceiling_gain_m === "number" && typeof gain === "number" && gain > profile.hiking_ceiling_gain_m) {
            warn("W_CEILING", path, `${label} climbs ${gain} m, over the ceiling of ${profile.hiking_ceiling_gain_m} m.`, day, it.track, "gain");
          }
        }
        if ((it.track === "B" || it.track === "C") && typeof profile.max_house_grade === "number" && typeof grade === "number" && grade > profile.max_house_grade) {
          warn("W_CEILING", path, `${label} has house grade ${grade}, above the maximum of ${profile.max_house_grade} for Track ${it.track}; trails above it go to Track A only.`, day, it.track, "grade");
        }
      }
    }
    // W_LEG_DRIFT
    if (it.leg_id) {
      const leg = ctx.catalog.leg(it.leg_id);
      const noted = typeof it.override?.leg_note === "string" && it.override.leg_note.trim() !== "";
      if (leg && !noted) {
        for (const [col, ref] of [["leg_km", leg.km], ["leg_minutes", leg.minutes]] as const) {
          const v = it[col];
          if (typeof v === "number" && typeof ref === "number" && ref > 0 && Math.abs(v - ref) / ref > 0.2) {
            warn("W_LEG_DRIFT", path, `${label}: ${col} is ${v} but the catalog leg ${it.leg_id} says ${ref} (more than 20% apart). Use the catalog value or explain it with override.leg_note.`, day, it.track, col);
          }
        }
      }
    }
    fitChecks(s, day);
  }

  // ---- W_FIT and W_FIT_UNKNOWN
  const travellers: Row[] = trip.travellers ?? [];
  const hasChild = travellers.some((x) => x.role === "child" || x.role === "infant");
  function ageAt(tv: Row): number | null {
    if (typeof tv.age_years !== "number") return null;
    if (edition?.start && typeof tv.age_as_of === "string") {
      const ms = Date.parse(edition.start) - Date.parse(tv.age_as_of);
      return tv.age_years + Math.floor(ms / 86400000 / 365.25);
    }
    return tv.age_years;
  }
  function fitChecks(s: Slot, day: Row): void {
    const it = s.item;
    const path = `/items/${s.index}`;
    const booking = it.booking_id ? bookingById.get(it.booking_id) : undefined;
    const offer = booking?.offer_id ? ctx.catalog.offer(booking.offer_id) : null;
    const act = it.activity_id ? ctx.catalog.activity(it.activity_id) : null;
    const trail = it.trail_id ? ctx.catalog.trail(it.trail_id) : null;
    const rows = [offer && { kind: "offer", row: offer }, act && { kind: "activity", row: act }, trail && { kind: "trail", row: trail }].filter(Boolean) as { kind: string; row: Row }[];
    for (const { row, kind } of rows) {
      for (const tv of travellers) {
        const age = ageAt(tv);
        const checks: [string, number | null, number | null, number | null][] = [
          ["age", age, row.min_age, row.max_age],
          ["height", tv.height_cm ?? null, row.min_height_cm, row.max_height_cm],
          ["weight", tv.weight_kg ?? null, row.min_weight_kg, row.max_weight_kg],
        ];
        for (const [what, v, lo, hi] of checks) {
          if (v === null) continue;
          if ((typeof lo === "number" && v < lo) || (typeof hi === "number" && v > hi)) {
            warn("W_FIT", path, `${tv.label} does not fit the ${what} limit of ${kind} "${row.name}" (${lo ?? "-"} to ${hi ?? "-"}, traveller has ${v}).`, day, it.track, `${tv.id}|${what}|${row.id}`);
          }
        }
      }
    }
    // limits unknown: only for things people book or join, and only when it matters for the party
    const bookable = rows.filter((r) => r.kind !== "trail");
    if (bookable.length > 0 && hasChild) {
      const known = bookable.some(({ row }) => LIMIT_COLS.some((c) => typeof row[c] === "number") || row.limits_status === "none-stated" || row.limits_status === "verified");
      if (!known) {
        warn("W_FIT_UNKNOWN", path, `${it.id} "${it.title}": the age, height and weight limits are not known for ${bookable.map((r) => `"${r.row.name}"`).join(" or ")}, and the party includes a child. Ask the operator.`, day, it.track, "");
      }
    }
  }

  // ---- per day
  days.forEach((day, di) => {
    const dayItems = items.map((item, index) => ({ item, index })).filter((x) => x.item.day === day.n);
    if (dayItems.length === 0) return;
    const whole = slotsOf(dayItems.filter((x) => x.item.track === null), 0);
    const byTrack = new Map<string, Slot[]>();
    for (const tk of ["A", "B", "C", "P"]) {
      const list = dayItems.filter((x) => x.item.track === tk);
      if (list.length > 0) byTrack.set(tk, slotsOf(list, 1));
    }
    const dayPath = `/days/${di}`;

    // W_ORDER: per source list, in seq order
    for (const [name, list] of [["whole group", whole] as const, ...[...byTrack].map(([k, v]) => [`Track ${k}`, v] as const)]) {
      let last: Slot | null = null;
      for (const s of list) {
        if (s.start === null) continue;
        if (last && last.start !== null && s.start < last.start) {
          warn("W_ORDER", `/items/${s.index}`, `${name}: ${s.item.id} starts at ${fmtMin(s.start)}, before ${last.item.id} at ${fmtMin(last.start)}, though its seq is later. Reorder the items or fix the times.`, day, s.item.track, "");
        }
        last = s;
      }
    }

    // timelines: one per walking track with the whole group merged in; Plan B stands alone
    const timelines: { track: string | null; slots: Slot[] }[] = [];
    const walking = TRACKS.filter((k) => byTrack.has(k));
    if (walking.length === 0 && whole.length > 0) timelines.push({ track: null, slots: whole });
    for (const k of walking) timelines.push({ track: k, slots: merge(whole, byTrack.get(k)!) });
    if (byTrack.has("P")) timelines.push({ track: "P", slots: byTrack.get("P")! });

    const itemDone = new Set<number>();
    for (const tl of timelines) {
      const trackName = tl.track ? `Track ${tl.track}` : "The whole group";
      for (const s of tl.slots) {
        if (!itemDone.has(s.index)) {
          itemDone.add(s.index);
          itemChecks(s, day, tl.track);
        }
      }
      // pairs
      for (let i = 1; i < tl.slots.length; i++) {
        const a = tl.slots[i - 1]!;
        const b = tl.slots[i]!;
        const leg = b.item.leg_minutes ?? 0;
        // W_OVERLAP: only when the next item was given a time
        if (b.fixed && a.end !== null) {
          const arrive = a.end + leg;
          const fixedStart = toMin(b.item.start);
          const winEnd = toMin(b.item.window_end);
          const bad = fixedStart !== null ? arrive > fixedStart : winEnd !== null ? arrive >= winEnd : false;
          if (bad) {
            warn("W_OVERLAP", `/items/${b.index}`, `${trackName}: ${a.item.id} ends at ${fmtMin(a.end)}${leg ? ` and the leg takes ${leg} min` : ""}, so you arrive at ${fmtMin(arrive)}, after ${b.item.id} starts${fixedStart !== null ? ` at ${b.item.start}` : ` (window closes ${b.item.window_end})`}.`, day, tl.track, `${a.index}`);
          }
        }
        // W_LEG_MISSING
        const ca = coordsOf(a.item);
        const cb = coordsOf(b.item);
        if (ca && cb && haversineM(ca, cb) > 300 && (b.item.leg_mode === null || b.item.leg_minutes === null)) {
          warn("W_LEG_MISSING", `/items/${b.index}`, `${b.item.id} is ${Math.round(haversineM(ca, cb))} m from ${a.item.id} but has no leg_mode and leg_minutes. Add the travel time. Example: leg_mode "walk", leg_minutes 12.`, day, tl.track, `${a.index}`);
        }
        // W_TZ_MISSING
        if (!a.item.tz && !b.item.tz) {
          const za = zoneOf(a.item);
          const zb = zoneOf(b.item);
          if (za && zb && !sameOffsets(za, zb, year)) {
            warn("W_TZ_MISSING", `/items/${b.index}`, `${a.item.id} is in ${za} and ${b.item.id} in ${zb}, with no tz on either. Set items.tz on the one that is in the other zone. Example: "${zb}".`, day, tl.track, `${a.index}`);
          }
        }
      }
      // W_PACE
      const budget = PACE_MIN[Math.min(5, Math.max(1, profile.pace ?? 3)) - 1]!;
      let active = 0;
      let drive = 0;
      for (const s of tl.slots) {
        const it = s.item;
        const leg = it.leg_minutes ?? 0;
        if (it.leg_mode === "drive") drive += leg;
        if (it.optional || it.type === "rest") continue;
        const legCost = it.leg_mode === "drive" && day.kind === "travel" ? leg * 1.5 : leg;
        active += (it.duration_min ?? 0) + legCost;
      }
      if (active > budget) {
        warn("W_PACE", dayPath, `${trackName} on day ${day.n} has ${Math.round(active)} min (${fmtDuration(active)}) of active time, over the pace ${profile.pace ?? 3} budget of ${budget} min by ${Math.round(active - budget)} min (${fmtDuration(active - budget)}).`, day, tl.track, tl.track ?? "");
      }
      // W_DRIVE_LIMIT
      if (typeof profile.daily_max_drive_min === "number" && drive > profile.daily_max_drive_min) {
        warn("W_DRIVE_LIMIT", dayPath, `${trackName} on day ${day.n} drives ${drive} min, over the profile limit of ${profile.daily_max_drive_min} min.`, day, tl.track, tl.track ?? "");
      }
    }
  });

  // W_DEADLINE: bookings, not days
  const day1 = ctx.resolveDate(1);
  bookings.forEach((b, i) => {
    if (b.status !== "todo" || !day1) return;
    const offset = ctx.bookBy(b);
    let deadline: string | null = typeof b.deadline_date === "string" ? b.deadline_date : null;
    if (!deadline && offset !== null) deadline = shift(day1, offset);
    if (deadline && deadline < ctx.today) {
      warn("W_DEADLINE", `/trip_bookings/${i}`, `booking ${b.id} was due by ${deadline} (${offset !== null ? `${offset} days from Day 1` : "fixed date"}) and is still todo; today is ${ctx.today}. Book it, or move the edition.`, null, null, "");
    }
  });

  return out;
}

function shift(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Merge the whole-group slots into a track's: by start time, whole group first on ties, derived starts follow their predecessor. */
function merge(whole: Slot[], track: Slot[]): Slot[] {
  const keyed: { s: Slot; k: number; n: number }[] = [];
  let n = 0;
  for (const list of [whole, track]) {
    let last = 0;
    for (const s of list) {
      if (s.start !== null) last = s.start;
      keyed.push({ s, k: s.start ?? last, n: n++ });
    }
  }
  keyed.sort((a, b) => a.k - b.k || a.s.src - b.s.src || a.n - b.n);
  return keyed.map((x) => x.s);
}

