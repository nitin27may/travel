// The groups of the add picker (edit-mode-spec 7.2) as plain rows, worked out from the document, the trip's plan model and the pages
// the catalogue answered. Pure: nothing here reads the network, the clock or the scheduler. The picker draws what this returns.
import { ADD_NEARBY_KM, ADD_PIN_FAR_KM, DRIVE_BAND_EDGES_MIN } from '@travel/core/config/nearby.ts';
import { estimateLeg } from '@travel/core/schedule/legs.ts';
import type { Point, TimelineEntry } from '@travel/core/schedule/types.ts';
import type { AddCandidate, TimelineModel } from '@/components/trips/timeline/model';
import { isRuleItem } from '@/lib/trip-edit/ruleRows';
import { dayRef } from '@/lib/trip-edit/stopOps';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { bearingOf, candidateOf, kmBetween, type Found } from './place';

/** The row flags the Rainy day chip filters on (the capture `indoor` property; `indoor-or-rainy-day` is the facet's name for it). */
const RAINY_FLAGS: readonly string[] = ['indoor', 'indoor-or-rainy-day'];
export const isRainy = (f: Pick<Found, 'flags'>): boolean => f.flags.some((x) => RAINY_FLAGS.includes(x));

export type GroupId = 'versions' | 'removed' | 'maybe' | 'trip' | 'near' | 'search';

/** Where a place already stands on the trip. */
export interface OnTrip {
  day: number;
  entry: TimelineEntry;
}

export interface PickRow {
  /** unique inside the picker */
  key: string;
  slug: string | null;
  name: string;
  /** a catalogue kind, for the glyph */
  kind: string;
  kindLabel: string;
  /** what the scheduler places; null for a row that only puts something back */
  cand: AddCandidate | null;
  /** straight-line km from the day's base, with the compass point and an estimated drive in minutes */
  km: number | null;
  bearing: string | null;
  driveMin: number | null;
  /** already on this day */
  here: boolean;
  /** on another day of the trip: the day and the stop */
  on: OnTrip | null;
  /** beyond ADD_PIN_FAR_KM of every base of the trip */
  far: boolean;
  /** how far, when far */
  farKm: number | null;
  /** what the button does instead of Add: put a removed stop or a Maybe place back */
  back: { ops: (newId: () => string) => PlanOp[]; label: string; verb: 'Add' | 'Put back' } | null;
  /** a short note under the name ("Removed from this day", "In Maybe") */
  note: string | null;
  /** the kid fit and the season, for the chips */
  found: Found | null;
}

export interface Section {
  id: GroupId;
  label: string;
  rows: PickRow[];
  /** rows the group holds beyond the page shown */
  more: number;
}

export interface Chips {
  rainy: boolean;
  kids: boolean;
  /** the trip's month (1 to 12) when the trip is dated and the chip is on */
  month: number | null;
}

export interface Inputs {
  doc: PlanDraft;
  model: TimelineModel;
  day: number;
  /** where each place stands on the trip now (the scheduler's own answer), by slug and by schedule id */
  onTrip: ReadonlyMap<string, OnTrip>;
  /** the youngest child's age, or null with no children */
  youngest: number | null;
  /** places round the day's base, or null while they load or when the build has no API */
  near: readonly Found[] | null;
  /** the words in the search field */
  q: string;
  /** the catalogue's matches for `q`, or null while they load or when the build has no API */
  search: readonly Found[] | null;
  chips: Chips;
  /** rows of the Maybe places the model does not carry */
  maybe: readonly Found[];
  /** how many rows each group shows: `PAGE_SIZE.list` times the "Show more" presses */
  limit: Record<GroupId, number>;
  /** rows just added or moved here: they stay in their place, reading "Added · Undo", though they are on the day now */
  keep: ReadonlySet<string>;
}

const dayOf = (m: TimelineModel, n: number) => m.days.find((d) => d.n === n) ?? null;

/**
 * The group a candidate stands in on one day. The model keeps one candidate per key, whichever day listed it first, so its own `group` can
 * belong to another day (ER-005): a stop that is a version's extra on Day 2 is "nearby" on Day 6. The days' inputs say which it is here: a
 * stop of one of this day's other versions, else a stop of the plan on another day at this base, else a place with a page near the base.
 */
export function groupOn(m: TimelineModel, day: number, c: AddCandidate): AddCandidate['group'] {
  const d = dayOf(m, day);
  if (!d) return c.group;
  const idOf = (i: { id: string; placeSlug: string | null }): string => i.placeSlug ?? i.id;
  const chosen = d.input.variants.find((v) => v.key === 'B') ?? d.input.variants[0];
  const inChosen = new Set((chosen?.items ?? []).flatMap((i) => [i.id, idOf(i)]));
  if (!inChosen.has(c.key) && d.input.variants.some((v) => v !== chosen && v.items.some((i) => idOf(i) === c.key))) return 'variant';
  if (d.base && m.days.some((o) => o.n !== day && o.base === d.base && o.input.variants.some((v) => (v.key === 'B' || v.key === 'main') && v.items.some((i) => idOf(i) === c.key)))) return 'trip';
  return 'nearby';
}

/** The points a day is anchored on: its base and every stop with a coordinate in any version. */
export function anchorsOf(m: TimelineModel, n: number): Point[] {
  const d = dayOf(m, n);
  if (!d) return [];
  return [...(d.input.base?.point ? [d.input.base.point] : []), ...d.input.variants.flatMap((v) => v.items.flatMap((i) => (i.point ? [i.point] : [])))];
}
/** The day's base point, else its first anchor. */
export const centreOf = (m: TimelineModel, n: number): Point | null => dayOf(m, n)?.input.base?.point ?? anchorsOf(m, n)[0] ?? null;
/** Every base the trip sleeps at (and where each day ends), as points. */
export function basesOf(m: TimelineModel): Point[] {
  return m.days.flatMap((d) => [d.input.base?.point, d.input.nextBase?.point].filter((p): p is Point => !!p));
}
/** The least distance in km from `p` to any of `points`; null with none. */
export function nearestKm(p: Point, points: readonly Point[]): number | null {
  return points.length ? Math.min(...points.map((a) => kmBetween(a, p))) : null;
}
/** A place beyond ADD_PIN_FAR_KM of every base is no stop of this trip (README ruling C5). A trip with no known base cannot say, so nothing is far. */
export function isFar(p: Point | null, m: TimelineModel): boolean {
  if (!p) return false;
  const k = nearestKm(p, basesOf(m));
  return k !== null && k > ADD_PIN_FAR_KM;
}

/** How far a place is from the nearest base when that is beyond ADD_PIN_FAR_KM, else null. */
export function farKmOf(p: Point | null, m: TimelineModel): number | null {
  if (!p) return null;
  const k = nearestKm(p, basesOf(m));
  return k !== null && k > ADD_PIN_FAR_KM ? k : null;
}

/** "under 15 min", "15 to 30 min", "1 to 2 h": the drive band of an estimated drive, never a figure to the minute. */
export function bandWords(driveMin: number | null, km: number | null): string | null {
  if (driveMin === null || km === null) return null;
  if (km < 1.2) return 'a walk';
  const [a, b, c] = DRIVE_BAND_EDGES_MIN;
  if (driveMin < a) return `under ${a} min`;
  if (driveMin < b) return `${a} to ${b} min`;
  if (driveMin < c) return `${b} to ${c} min`;
  return `${c} min to 2 h`;
}

/** The distance words of a row: "12 km NE · 15 to 30 min ≈". `unit` formats the distance. */
export function distanceWords(r: Pick<PickRow, 'km' | 'bearing' | 'driveMin'>, fmt: (km: number) => string): string | null {
  if (r.km === null) return null;
  const band = bandWords(r.driveMin, r.km);
  return `${fmt(r.km)}${r.bearing ? ` ${r.bearing}` : ''}${band ? ` · ${band} ≈` : ''}`;
}

export const rowOfFound = (f: Found, i: Pick<Inputs, 'model' | 'onTrip' | 'day'>, group: GroupId): PickRow => {
  const centre = centreOf(i.model, i.day);
  const p = f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null;
  const km = p && centre ? kmBetween(centre, p) : null;
  const on = i.onTrip.get(f.slug) ?? null;
  return {
    key: `${group}:${f.slug}`, slug: f.slug, name: f.name, kind: f.kind, kindLabel: f.kindLabel, cand: candidateOf(f, km), km, bearing: p && centre && km !== null && km > 0 ? bearingOf(centre, p) : null,
    driveMin: p && centre ? estimateLeg(centre, p).minutes : null, here: on?.day === i.day, on: on && on.day !== i.day ? on : null, far: isFar(p, i.model), farKm: farKmOf(p, i.model), back: null, note: null, found: f,
  };
};

export const rowOfCandidate = (c: AddCandidate, i: Pick<Inputs, 'model' | 'onTrip' | 'day'>, group: GroupId): PickRow => {
  const centre = centreOf(i.model, i.day);
  const on = i.onTrip.get(c.key) ?? i.onTrip.get(c.placeSlug ?? '') ?? null;
  return {
    key: `${group}:${c.key}`, slug: c.placeSlug, name: c.name, kind: c.sub ?? c.kind, kindLabel: c.label, cand: c, km: c.km, bearing: c.point && centre && c.km ? bearingOf(centre, c.point) : null,
    driveMin: c.point && centre ? estimateLeg(centre, c.point).minutes : null, here: on?.day === i.day, on: on && on.day !== i.day ? on : null, far: isFar(c.point, i.model), farKm: farKmOf(c.point, i.model), back: null, note: null, found: null,
  };
};

/** The chips narrow places from the catalogue only: the trip's own stops are never hidden by them (a stop that is not Rainy day still belongs to the trip). */
export function passesChips(f: Found, chips: Chips, youngest: number | null): boolean {
  if (chips.rainy && !isRainy(f)) return false;
  if (chips.kids) {
    if (f.kidFit === 'no') return false;
    if (youngest !== null && f.kidsFrom !== null && f.kidsFrom > youngest) return false;
  }
  if (chips.month !== null && f.season.length > 0 && !f.season.includes(chips.month)) return false;
  return true;
}

const matches = (needle: string, ...texts: (string | null | undefined)[]): boolean => !needle || texts.some((t) => t?.toLowerCase().includes(needle));

/** A removed stop of the day, by its title. */
function removedRows(i: Inputs, needle: string): PickRow[] {
  const t = i.doc.template;
  const d = dayOf(i.model, i.day);
  if (!t || !d) return [];
  const titles = new Map<string, string>();
  for (const v of d.input.variants) for (const it of v.items) titles.set(it.id, it.title);
  const out: PickRow[] = [];
  for (const r of [...t.removed].reverse()) {
    if (r.day !== i.day || isRuleItem(r.item)) continue;
    const name = titles.get(r.item);
    if (!name || !matches(needle, name)) continue;
    out.push({
      key: `removed:${r.op}`, slug: null, name, kind: 'sight', kindLabel: 'Stop', cand: null, km: null, bearing: null, driveMin: null, here: false, on: null, far: false, farKm: null, found: null,
      note: `Removed from Day ${i.day}`, back: { ops: (id) => [{ kind: 'deleteEntry', id: id(), target: r.op }], label: `Put ${name} back on Day ${i.day}`, verb: 'Put back' },
    });
  }
  return out;
}

/** The Maybe places of the copy; each brings back with one Add (the Maybe entry leaves, the place joins the day: one undo step). */
function maybeRows(i: Inputs, needle: string): PickRow[] {
  const t = i.doc.template;
  if (!t) return [];
  const byFound = new Map(i.maybe.map((f) => [f.slug, f]));
  const out: PickRow[] = [];
  for (const m of [...t.maybe].reverse()) {
    const slug = m.ref.replace(/^place\//, '');
    const cand = i.model.addables[slug];
    const found = byFound.get(slug) ?? null;
    const name = cand?.name ?? found?.name ?? slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    if (!matches(needle, name)) continue;
    const base = found ? rowOfFound(found, i, 'maybe') : cand ? rowOfCandidate(cand, i, 'maybe') : null;
    const ref = m.ref;
    const here = i.onTrip.get(slug);
    out.push({
      ...(base ?? { slug, name, kind: 'sight', kindLabel: 'Stop', cand: null, km: null, bearing: null, driveMin: null, here: false, on: here ?? null, far: false, farKm: null, found: null, back: null, note: null, key: '' }),
      key: `maybe:${m.op}`, note: 'In Maybe',
      back: { ops: (id) => [{ kind: 'deleteEntry', id: id(), target: m.op }, { kind: 'addPlace', id: id(), day: dayRef(i.doc, i.day), ref }], label: `Added ${name} to Day ${i.day}`, verb: 'Add' },
    });
  }
  return out;
}

const cap = (rows: PickRow[], n: number): { rows: PickRow[]; more: number } => ({ rows: rows.slice(0, n), more: Math.max(0, rows.length - n) });

/**
 * The groups of edit-mode-spec 7.2 for one day, in the spec's order, with empty groups left out. With words in the search field every
 * group is narrowed by them and the catalogue's matches follow as "Search results", nearest the day's base first, the far ones last.
 */
export function buildSections(i: Inputs): Section[] {
  const needle = i.q.trim().toLowerCase();
  const out: Section[] = [];
  const push = (id: GroupId, label: string, rows: PickRow[]): void => {
    const c = cap(rows, i.limit[id]);
    if (c.rows.length) out.push({ id, label, rows: c.rows, more: c.more });
  };
  const shown = (r: PickRow): boolean => !r.here || i.keep.has(r.key);
  const seen = new Set<string>();
  const take = (rows: PickRow[]): PickRow[] => rows.filter((r) => {
    const k = r.slug ?? r.key;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const keys = i.model.addByDay[i.day] ?? [];
  const cands = (group: AddCandidate['group']) => keys.map((k) => i.model.addables[k]).filter((c): c is AddCandidate => !!c && groupOn(i.model, i.day, c) === group && matches(needle, c.name, c.label));

  // 1. the other versions of this day (a copy whose day has versions)
  if (i.doc.template) push('versions', 'From the other versions of this day', take(cands('variant').map((c) => rowOfCandidate(c, i, 'versions')).filter(shown)));
  // 2 and 3. what the person took off this day, and the Maybe list
  push('removed', 'Removed from this day', removedRows(i, needle));
  push('maybe', 'Maybe', take(maybeRows(i, needle)));
  // 5. the trip's own stops at this base on other days
  push('trip', 'Elsewhere on this trip, near here', take(cands('trip').map((c) => rowOfCandidate(c, i, 'trip')).filter(shown)));
  // 6. places with a page near the day's base: the catalogue's answer, else the plan model's own short list
  const nearFound = i.near ? i.near.filter((f) => matches(needle, f.name, f.kindLabel, f.area) && passesChips(f, i.chips, i.youngest)).map((f) => rowOfFound(f, i, 'near')) : cands('nearby').map((c) => rowOfCandidate(c, i, 'near'));
  const filtered = i.near ? nearFound : i.chips.rainy || i.chips.kids ? [] : nearFound;
  push('near', `Within ${ADD_NEARBY_KM} km, with a place page`, take(filtered.filter(shown)));
  // 8. the catalogue's search results
  if (needle && i.search) {
    const rows = i.search.filter((f) => passesChips(f, i.chips, i.youngest)).map((f) => rowOfFound(f, i, 'search'));
    rows.sort((a, b) => Number(a.far) - Number(b.far) || (a.km ?? Infinity) - (b.km ?? Infinity) || a.name.localeCompare(b.name));
    push('search', 'Search results', rows);
  }
  return out;
}

export const GROUP_ORDER: readonly GroupId[] = ['versions', 'removed', 'maybe', 'trip', 'near', 'search'];
const LABELS: Record<GroupId, string> = {
  versions: 'From the other versions of this day', removed: 'Removed from this day', maybe: 'Maybe', trip: 'Elsewhere on this trip, near here',
  near: `Within ${ADD_NEARBY_KM} km, with a place page`, search: 'Search results',
};

/** A row that left its group once used (a removed stop put back, a Maybe place added), kept where it was so "Added · Undo" shows in place. */
export interface Ghost {
  id: GroupId;
  index: number;
  row: PickRow;
}
/** Puts the ghosts back into the groups they left, at the place they had. */
export function withGhosts(sections: readonly Section[], ghosts: readonly Ghost[]): Section[] {
  const out = sections.map((s) => ({ ...s, rows: [...s.rows] }));
  for (const g of ghosts) {
    let s = out.find((x) => x.id === g.id);
    if (!s) {
      s = { id: g.id, label: LABELS[g.id], rows: [], more: 0 };
      out.push(s);
      out.sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));
    }
    if (!s.rows.some((r) => r.key === g.row.key)) s.rows.splice(Math.min(g.index, s.rows.length), 0, g.row);
  }
  return out;
}

/** True when a group has anything after the chips and the search narrowed it, for the empty state. */
export const anyRows = (s: readonly Section[]): boolean => s.some((x) => x.rows.length > 0);

/** The days of the trip nearest a place, nearest first, with the distance to the day's nearest anchor; days beyond ADD_NEARBY_KM follow. */
export function daysByDistance(m: TimelineModel, p: Point): { n: number; km: number | null }[] {
  return m.days.map((d) => ({ n: d.n, km: nearestKm(p, anchorsOf(m, d.n)) })).sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.n - b.n);
}

/** What the sheet is titled: "Add a place to Day 5". */
export const titleWords = (day: number): string => `Add a place to Day ${day}`;
