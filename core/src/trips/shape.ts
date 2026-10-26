// "The trip's shape" (trip-and-places-ux-fixes.md 4.2 to 4.5, W5; Q297): the bases ribbon, the count line and one row per day,
// built from the timelines the page shows. Pure: the server renders the collapsed ribbon and count line from the default profile;
// the lazy rows chunk calls the same function with the visitor's timelines, so the two can never disagree.
//
// Notes are words, never icons alone: Long drive (2 h 30 or more), Book n, Highlight, Warning n, Light day (on foot under 2 h and
// driving under 1 h, not a travel day), Flight home (or Last day), Changed, and the version's label when the party's version is
// not the day's main one (finding I1: no "The plan's day" column).
import type { DayTimeline } from "../schedule/types.ts";
import { dayDriveMin, LONG_DRIVE_MIN } from "./drive.ts";

export interface ShapeDayInput {
  n: number;
  title: string;
  base: string | null;
  /** The plan's own drive figure for the day (`PublicDay.driveMin`), used on a condensed day (drive.ts `dayDriveMin`). */
  plannedDriveMin: number | null;
  /** The day's versions (`PublicDay.variants`): the main one is the first whose key is `main`, else whose audience is family, else the first. */
  variants: readonly { key: string; label: string; audience: string }[];
}

export interface ShapeBaseInput {
  name: string;
  nights: number;
  days: readonly number[];
}

export interface ShapeInput {
  days: readonly ShapeDayInput[];
  bases: readonly ShapeBaseInput[];
  /** The timelines on screen: the default profile's on the server, the visitor's in the lazy rows. Matched to a day by `day`. */
  timelines: readonly Pick<DayTimeline, "day" | "variant" | "entries" | "totals" | "warnings" | "blocks">[];
  /** The day of each export booking (`TripExport.bookings[].day`); null days are not counted. */
  bookingDays: readonly (number | null)[];
  /** Place slugs of the trip's highlights (summary.ts `highlights`, with the routes folded into them). */
  highlightSlugs: ReadonlySet<string> | readonly string[];
  /**
   * Day -> the version keys whose stops include a highlight. A timeline entry does not always carry its stop's page (the Rockies'
   * "Spirit Island cruise" has none), so the day's plan for the chosen version says it too.
   */
  highlightVersions?: Readonly<Record<number, readonly string[]>>;
  /** Days the visitor changed (a version or an added stop). */
  changedDays?: ReadonlySet<number> | readonly number[];
}

export type ShapeNoteKind = "long-drive" | "book" | "highlight" | "warning" | "light" | "last-day" | "changed" | "version";

export interface ShapeNote {
  kind: ShapeNoteKind;
  /** The word the row prints: "Long drive", "Book 2", "Warning 1", "Adults' hike". */
  text: string;
}

export interface ShapeRow {
  n: number;
  base: string | null;
  title: string;
  /** dayDriveMin; null when not known. */
  driveMin: number | null;
  /** 0..1 of the trip's longest drive day, for the bar; 0 with no drive. */
  driveShare: number;
  /** The timeline's walking distance for the party on screen. */
  walkKm: number;
  /** Minutes on trails (the timeline's trail entries): the "on foot" half of the light-day rule. */
  onFootMin: number;
  /** A day that checks in or out: never a light day. */
  travel: boolean;
  notes: ShapeNote[];
}

export interface RibbonSegment {
  name: string;
  nights: number;
  days: number[];
  /** Width: nights over the trip's nights. */
  share: number;
}

export interface ShapeModel {
  days: number;
  ribbon: RibbonSegment[];
  /** Days after the last night (the departure day): "+ the flight home on Day 15". */
  tail: { days: number[]; label: string } | null;
  /** Day lists behind each count phrase (a phrase filters the rows to its days). */
  sets: { longDrive: number[]; booking: number[]; highlight: number[]; warning: number[]; light: number[] };
  /** "15 days · 4 long drive days · 5 days with a booking · 7 highlight days · 6 days with a warning"; a zero count is left out. */
  countLine: string;
  /** Each phrase of the count line with the set it opens, for the buttons. */
  phrases: { key: "days" | "longDrive" | "booking" | "highlight" | "warning"; text: string }[];
  maxDriveMin: number;
  rows: ShapeRow[];
}

const LIGHT_FOOT_MIN = 120;
const LIGHT_DRIVE_MIN = 60;
const AIRPORT = /\b(?:airport|flight|fly home|YYC|YEG)\b/i;

const asSet = <T>(x: ReadonlySet<T> | readonly T[] | undefined): ReadonlySet<T> => (x instanceof Set ? x : new Set((x as readonly T[] | undefined) ?? []));
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The main version of a day: `main`, else the family version, else the first. */
export function mainVariantKey(variants: ShapeDayInput["variants"]): string | null {
  return (variants.find((v) => v.key === "main") ?? variants.find((v) => v.audience === "family") ?? variants[0])?.key ?? null;
}

export function tripShape(i: ShapeInput): ShapeModel {
  const byDay = new Map(i.timelines.map((t) => [t.day, t]));
  const highlights = asSet(i.highlightSlugs);
  const changed = asSet(i.changedDays);
  const books = new Map<number, number>();
  for (const d of i.bookingDays) if (d !== null) books.set(d, (books.get(d) ?? 0) + 1);
  const lastDay = i.days.length ? i.days[i.days.length - 1]!.n : 0;

  const drives = i.days.map((d) => dayDriveMin(byDay.get(d.n), d.plannedDriveMin));
  const maxDriveMin = Math.max(0, ...drives.map((m) => m ?? 0));

  const rows: ShapeRow[] = i.days.map((d, idx) => {
    const tl = byDay.get(d.n);
    const driveMin = drives[idx]!;
    const entries = tl?.entries ?? [];
    const onFootMin = entries.filter((e) => e.kind === "trail").reduce((s, e) => s + e.durationMin, 0);
    const travel = entries.some((e) => e.kind === "checkin" || e.kind === "checkout");
    const notes: ShapeNote[] = [];
    if (driveMin !== null && driveMin >= LONG_DRIVE_MIN) notes.push({ kind: "long-drive", text: "Long drive" });
    const nb = books.get(d.n) ?? 0;
    if (nb) notes.push({ kind: "book", text: `Book ${nb}` });
    const hlVersion = !!tl && (i.highlightVersions?.[d.n] ?? []).includes(tl.variant.key);
    if (hlVersion || entries.some((e) => e.at?.placeSlug && highlights.has(e.at.placeSlug))) notes.push({ kind: "highlight", text: "Highlight" });
    const nw = tl?.warnings.length ?? 0;
    if (nw) notes.push({ kind: "warning", text: `Warning ${nw}` });
    if (tl && !travel && d.n !== lastDay && onFootMin < LIGHT_FOOT_MIN && (driveMin ?? 0) < LIGHT_DRIVE_MIN) notes.push({ kind: "light", text: "Light day" });
    if (d.n === lastDay && i.days.length > 1) {
      const said = [d.title, ...entries.flatMap((e) => [e.title, e.to?.name ?? "", e.at?.name ?? ""])].join(" ");
      notes.push({ kind: "last-day", text: entries.some((e) => e.leg?.mode === "flight") || AIRPORT.test(said) ? "Flight home" : "Last day" });
    }
    const main = mainVariantKey(d.variants);
    if (tl && main && tl.variant.key !== main) notes.push({ kind: "version", text: d.variants.find((v) => v.key === tl.variant.key)?.label ?? tl.variant.label });
    if (changed.has(d.n)) notes.push({ kind: "changed", text: "Changed" });
    return {
      n: d.n, base: d.base, title: d.title, driveMin, driveShare: maxDriveMin > 0 && driveMin ? Math.round((driveMin / maxDriveMin) * 1000) / 1000 : 0,
      walkKm: tl?.totals.walkKm ?? 0, onFootMin, travel, notes,
    };
  });

  const daysWith = (k: ShapeNoteKind): number[] => rows.filter((r) => r.notes.some((x) => x.kind === k)).map((r) => r.n);
  const sets = { longDrive: daysWith("long-drive"), booking: daysWith("book"), highlight: daysWith("highlight"), warning: daysWith("warning"), light: daysWith("light") };

  const totalNights = i.bases.reduce((s, b) => s + b.nights, 0);
  const ribbon = i.bases.map((b) => ({ name: b.name, nights: b.nights, days: [...b.days], share: totalNights > 0 ? Math.round((b.nights / totalNights) * 1000) / 1000 : 0 }));
  const covered = new Set(i.bases.flatMap((b) => b.days));
  const tailDays = i.days.map((d) => d.n).filter((n) => !covered.has(n) && n > Math.max(0, ...covered));
  const tailNote = rows.find((r) => r.n === lastDay)?.notes.find((x) => x.kind === "last-day")?.text;
  const tail = tailDays.length && ribbon.length ? { days: tailDays, label: tailNote ?? "Last day" } : null;

  const phrases: ShapeModel["phrases"] = [{ key: "days", text: plural(i.days.length, "day", "days") }];
  if (sets.longDrive.length) phrases.push({ key: "longDrive", text: plural(sets.longDrive.length, "long drive day", "long drive days") });
  if (sets.booking.length) phrases.push({ key: "booking", text: plural(sets.booking.length, "day with a booking", "days with a booking") });
  if (sets.highlight.length) phrases.push({ key: "highlight", text: plural(sets.highlight.length, "highlight day", "highlight days") });
  if (sets.warning.length) phrases.push({ key: "warning", text: plural(sets.warning.length, "day with a warning", "days with a warning") });

  return { days: i.days.length, ribbon, tail, sets, countLine: phrases.map((p) => p.text).join(" · "), phrases, maxDriveMin, rows };
}
