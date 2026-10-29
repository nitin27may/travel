// The Table view's rows (UXB-5; spec trip-and-places-ux-fixes 7, components 4.6). Pure: the same timeline the List draws, one row per entry in
// time order, worded by the same functions as the print and the CSV (`printTime`, `fmtHM`), so "Stops only" equals the CSV's rows and nothing
// is reworded (7.4). No React here: a test pins the rows against `forTimeline`.
import { PRINTED_KINDS, printTime } from '@travel/core/export/plan.ts';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { DayTimeline, ScheduleItem, TimelineEntry } from '@travel/core/schedule/types.ts';
import { fixedLabel, KIND_WORD, MODE_WORD } from './labels';

/** `rows=stops` in the address; the default is every row. */
export type TableRowsMode = 'all' | 'stops';

export interface TableRow {
  id: string;
  /** The time as the print words it ("~08:45", "about 19:30", "Morning"); empty when the entry has none. */
  time: string;
  name: string;
  /** The place page, for a stop that has one. */
  href: string | null;
  /** The kind word ("trail", "drive", "meal"). */
  kind: string;
  /** The area of the place itself; empty when it is not known (never the day's base: a road-trip day's stops are not all at its base). */
  where: string;
  /** For a leg, where it starts from ("from Banff"); the What cell says it under the name, so the Where column stays the stop's area. */
  from: string;
  /** Duration, and for a drive its distance: "55 min · 42 km". */
  takes: string;
  /** Short facts and notes, each its own line in the cell. */
  notes: string[];
  /** A warning of this entry, shown after the notes. */
  warns: string[];
  leg: boolean;
  /** Inside another stop (a coffee at the lake): indented like a drive. */
  inside: boolean;
  /** Drives and the other legs are quiet rows. */
  quiet: boolean;
}

/** What a row needs from outside the timeline. */
export interface RowContext {
  /** The place's area by place slug (the trip's own Stops rows). */
  areaOf: (slug: string) => string | null;
  /** The base the day sleeps at: the caption names it ("base Jasper townsite"); a row never takes it as its own area. */
  base?: string | null;
  /** "42 km" or "26 mi", in the visitor's unit. */
  distance: (km: number) => string;
  elevation: (m: number) => string;
  /** "Last ride up 16:30" for a stop, from the day's items. */
  lastStart: (item: ScheduleItem | undefined) => string | null;
  items: ReadonlyMap<string, ScheduleItem>;
}

/** The entries of a day that a mode shows. Stops only is the print's and the CSV's rule: a visit or a walk, not inside another; a day with none (a travel day) keeps its travel. */
export function shownEntries(tl: DayTimeline, mode: TableRowsMode): TimelineEntry[] {
  if (mode === 'all') return tl.entries;
  const stops = tl.entries.filter((e) => PRINTED_KINDS.has(e.kind) && !e.insideOf);
  if (stops.length) return stops;
  return tl.entries.filter((e) => e.kind !== 'start' && e.kind !== 'checkout' && !e.insideOf);
}

/** "trail", "lake", "drive": the sub-kind when the entry has one worth saying. */
function kindWord(e: TimelineEntry): string {
  if (e.kind === 'leg') return (MODE_WORD[e.leg?.mode ?? 'drive'] ?? 'Travel').toLowerCase();
  if (e.kind === 'trail') return 'trail';
  if (e.kind === 'visit' && e.sub && e.sub !== 'together') return e.sub.replace(/-/g, ' ');
  return KIND_WORD[e.kind];
}

export function rowOf(e: TimelineEntry, tl: DayTimeline, cx: RowContext): TableRow {
  const leg = e.kind === 'leg';
  const quiet = leg || ['meal', 'break', 'rest', 'checkin', 'checkout', 'end', 'start', 'booking'].includes(e.kind);
  const takes: string[] = [];
  if (e.durationMin > 0 && e.kind !== 'sun') takes.push(`${leg && e.leg?.basis !== 'routed' && e.leg?.mode === 'drive' ? '≈' : ''}${fmtHM(e.durationMin)}`);
  // a split drive's halves both carry the whole route's km (N3): the distance is said on the first half only
  const half = leg && (e.leg?.breaks ?? 0) > 0 && /^(Back to|Drive on to)/.test(e.title);
  if (leg && e.leg?.km && !half) takes.push(cx.distance(e.leg.km));
  const notes: string[] = [];
  const slot = fixedLabel(e);
  if (slot) notes.push(slot);
  const last = cx.lastStart(e.sourceItemId ? cx.items.get(e.sourceItemId) : undefined);
  if (last) notes.push(last);
  if (e.stats?.distanceKm != null) notes.push(cx.distance(e.stats.distanceKm));
  if (e.stats?.gainM != null) notes.push(`${cx.elevation(e.stats.gainM)} up`);
  if (e.optional) notes.push('Optional');
  if (e.addedBy === 'visitor') notes.push('You added this');
  if (e.time.note && (e.kind !== 'start' || e.time.note.startsWith('Flight'))) notes.push(e.time.note);
  const slug = e.at?.placeSlug ?? null;
  // a leg's start is named only when it is a short place name; a long description of a trailhead is not a column value
  const from = e.from?.name ?? '';
  const where = leg ? '' : (slug && cx.areaOf(slug)) || '';
  const name = /^Drive on to /.test(e.title) ? 'Drive on' : e.title;
  return {
    id: e.id,
    time: printTime(e, tl.blocks) ?? '',
    name,
    href: slug && !quiet ? `/places/${slug}/` : null,
    kind: kindWord(e),
    where,
    from: leg && from && from.length <= 36 ? `from ${from}` : '',
    takes: takes.join(' · '),
    notes,
    warns: tl.warnings.filter((w) => w.entryId === e.id).map((w) => w.message),
    leg,
    inside: !!e.insideOf,
    quiet,
  };
}

export const rowsOf = (tl: DayTimeline, mode: TableRowsMode, cx: RowContext): TableRow[] => shownEntries(tl, mode).map((e) => rowOf(e, tl, cx));
