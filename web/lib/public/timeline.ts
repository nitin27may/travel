// The trip timeline adapter (trip-timeline spec 2.1, 3.2, 4). Builds, per day, the scheduler's input (variants with ordered
// items, stored legs, the sun window) from the trip sources and the authored overrides in data/schedules/<slug>.json, and runs
// the scheduler once for the trip's default profile. Pure and synchronous like the rest of the adapter: files in, JSON out.
// Nothing here carries a calendar date, and every string goes through the dateless, household and party scrubs.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { sunReference } from '@travel/core/schedule/sun.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import type {
  BaseRef, DayKind, DayVariant, ItemKind, Profile, ScheduleDayInput, ScheduleItem, StoredLeg, SunWindow, TimeSource,
} from '@travel/core/schedule/types.ts';
import { fmtMin } from '@travel/core/checks/time.ts';
import { loadPoints, type PointRow } from '@travel/core/capture/placementBlock.ts';
import { primaryRef } from '@travel/core/capture/records.ts';
import { DropLog, undatedSentences } from './dateless';
import deferred from './join-deferred.json';
import { normName } from './places';
import { ownPoint } from './seeds';
import { PUBLIC_TRIP_FOLDER } from './slugs';
import { publicWorld } from './world';
import { dayKnow, noteBlock, noteLine, parseHoursRange, stripMarkers, type NoteBlock, type PrepareOpts } from './prose';
import type { ProtoPlace, ProtoPubTrip, RockiesData, RockiesDay, Sources } from './sources';
import type { DayItem, DayVariantInfo, PublicBase, PublicDay, TripSchedule } from './types';

// ---- the data files ----

export interface ScheduleItemOverride {
  /** An authored time. `null` clears the time the source carries. */
  time?: string | null;
  confidence?: 'fixed' | 'suggested';
  source?: TimeSource;
  note?: string;
  title?: string;
  kind?: ItemKind;
  sub?: string | null;
  durationMin?: number;
  durationSource?: 'plan' | 'data' | 'operator';
  checkinMin?: number;
  optional?: boolean;
  needs?: { sun: 'sunrise' | 'sunset' | 'golden-pm' | 'civil-dusk' | 'nautical-dusk'; offsetMin: number };
  window?: { from: string | null; to: string | null; lastUp: string | null; lastDown: string | null; why: string };
  stats?: { distanceKm: number | null; gainM: number | null };
  minAge?: number;
}
/** An entry of a day's `order` list: a record id, or an object with that id and overrides (an object with `kind` is an inserted entry). */
export type OrderEntry = string | (ScheduleItemOverride & { id: string });

export interface ScheduleDayFile {
  kind?: DayKind;
  start?: { time: string; source?: TimeSource; label?: string };
  /** Per variant, the items in the order the plan does them. */
  order?: Partial<Record<'A' | 'B' | 'C' | 'main', OrderEntry[]>>;
  /** Overrides by record id, for items taken from the datasets. */
  items?: Record<string, ScheduleItemOverride>;
  split?: { optional?: boolean; rejoin: { time: string; place: string; afterItem: string | null } };
  legs?: { from: string; to: string; minutes: number; mode?: StoredLeg['mode']; basis?: 'plan' | 'matrix'; estimate?: boolean; km?: number | null }[];
  /** Day 4 of the Dolomites: per-variant labels and audiences. */
  variants?: Partial<Record<'A' | 'B' | 'C', { label: string; audience: 'adults' | 'family' | 'easy' | 'any' }>>;
  /** For a departure day: be at the airport by this time. */
  arriveBy?: string;
  /** TRP: the stops of this day that sit across a time-zone line. The clock after the line reads in local time. */
  zone?: { place: string; label: string; abbr: string; home: string; homeAbbr: string; offsetMin: number; items: string[]; source: string };
  /** TRP: the day's end depends on a flight whose time the plan does not know. `source` names the research it comes from. */
  flight?: { source: string };
  /** The research file or files an inserted pin or marker of this day comes from (not published). */
  source?: string;
}

export interface ScheduleFile {
  schema: 'trip-schedule/1';
  trip: string;
  defaultProfile: { party: 'adults' | 'family'; youngest?: number; pace?: 'relaxed' | 'standard' | 'full'; adults?: number };
  writtenFor: string;
  tz: string;
  season: { from: [number, number]; to: [number, number] };
  variants?: Partial<Record<'A' | 'B' | 'C', { label: string; audience: 'adults' | 'family' | 'easy' | 'any' }>>;
  bases?: Record<string, { name: string; lat: number; lon: number }>;
  /** Short titles by record id, over the datasets' long names. */
  titles?: Record<string, string>;
  days: Record<string, ScheduleDayFile>;
}

export interface LegsFile {
  schema: 'trip-legs/1';
  trip: string;
  fetched: string;
  attribution: string;
  legs: { from: string; to: string; profile: 'driving-car' | 'foot-hiking'; mode: 'drive' | 'walk'; km: number; minutes: number }[];
}

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null);
export const readScheduleFile = (root: string, slug: string): ScheduleFile | null => readJson<ScheduleFile>(path.join(root, 'data', 'schedules', `${slug}.json`));
export const readLegsFile = (root: string, slug: string): LegsFile | null => readJson<LegsFile>(path.join(root, 'data', 'schedules', 'legs', `${slug}.json`));

// ---- small helpers ----

const profileOf = (f: ScheduleFile | null, fallback: Partial<Profile> = {}): Profile => ({
  ...DEFAULT_PROFILE,
  ...fallback,
  ...(f
    ? {
        party: f.defaultProfile.party,
        youngest: f.defaultProfile.party === 'family' ? (f.defaultProfile.youngest ?? 10) : null,
        pace: f.defaultProfile.pace ?? 'standard',
        adults: f.defaultProfile.adults ?? 2,
      }
    : {}),
});

const monthsWindow = (months: number[]): SunWindow | null => {
  if (!months.length) return null;
  const sorted = [...months].sort((a, b) => a - b);
  return { from: [sorted[0]!, 1], to: [sorted[sorted.length - 1]!, 28] };
};

const hhmm = (min: number): string => fmtMin(((min % 1440) + 1440) % 1440);

/** Public prose for a note on an item: markers out, dated and household sentences out, the party scrub applied. */
function itemNote(raw: string | null | undefined, where: string, log: DropLog, names?: Map<string, string>): { text: string | null; honesty: ScheduleItem['honesty'] } {
  if (!raw) return { text: null, honesty: [] };
  const clean = noteLine(raw, { scrub: (s) => undatedSentences(s, where, log), names });
  const honesty = (clean?.chips ?? []).filter((c): c is 'estimate' | 'not_known' | 'pattern_2026' => c === 'estimate' || c === 'not_known' || c === 'pattern_2026');
  return { text: clean?.plain ?? null, honesty };
}

const blankItem = (id: string, kind: ItemKind, title: string): ScheduleItem => ({
  id, kind, sub: null, title, placeSlug: null, point: null, rule: null, durationMin: null, durationRange: null, durationSource: null, stats: null, start: null, needs: null,
  window: null, checkinMin: null, optional: false, note: null, minAge: null, minAgeRule: null, needsDaylight: false, honesty: [],
});

function applyOverride(it: ScheduleItem, o: ScheduleItemOverride | undefined, where: string, log: DropLog, names?: Map<string, string>): ScheduleItem {
  if (!o) return it;
  const out: ScheduleItem = { ...it };
  if (o.title) out.title = o.title;
  if (o.kind) out.kind = o.kind;
  if (o.sub !== undefined) out.sub = o.sub;
  if (o.stats) {
    // the plan walks part of a trail: the record's hours are for the whole of it, so the walk is timed by its own distance instead
    const whole = it.stats?.distanceKm ?? null;
    if (o.durationMin === undefined && it.durationRange && whole && o.stats.distanceKm !== null && o.stats.distanceKm < whole * 0.85) {
      out.durationRange = null;
      out.durationSource = null;
    }
    out.stats = o.stats;
  }
  if (o.durationMin !== undefined) {
    out.durationMin = o.durationMin;
    out.durationRange = null;
    out.durationSource = o.durationSource ?? 'plan';
  }
  if (o.durationSource && o.durationMin === undefined) out.durationSource = o.durationSource;
  if (o.checkinMin !== undefined) out.checkinMin = o.checkinMin;
  if (o.optional !== undefined) out.optional = o.optional;
  if (o.needs) out.needs = o.needs;
  if (o.window) out.window = o.window;
  if (o.minAge !== undefined) out.minAge = o.minAge;
  if (o.time === null) out.start = null;
  else if (o.time) out.start = { time: o.time, confidence: o.confidence ?? 'suggested', source: o.source ?? 'plan', note: null };
  else if (out.start && (o.confidence || o.source)) out.start = { ...out.start, confidence: o.confidence ?? out.start.confidence, source: o.source ?? out.start.source };
  if (o.note !== undefined) {
    const n = itemNote(o.note, where, log, names);
    out.note = n.text;
    out.honesty = [...new Set([...out.honesty, ...n.honesty])];
  }
  if (out.start && o.note && out.start.note === undefined) out.start = { ...out.start, note: out.note };
  return out;
}

// ---- the legs ladder inputs ----

const asLegs = (d: ScheduleDayFile | undefined): StoredLeg[] =>
  (d?.legs ?? []).map((l) => ({
    from: l.from, to: l.to, mode: l.mode ?? 'drive', minutes: l.minutes, km: l.km ?? null, basis: l.basis ?? 'plan', estimate: l.estimate ?? true, symmetric: true,
  }));

// ---- the Rockies ----

/** The itinerary rows carry more than sources.ts types: the day's decision rule, wet-weather swap and status flags. */
type RockiesDayRow = RockiesDay & { decision_rule?: string | null; wet_weather?: string | null; status_flags?: string[] };

const RK_SUB: Record<string, string> = {
  gondola: 'lift-ride', cruise: 'boat', canoe: 'boat', hot_springs: 'hot-spring', glacier: 'activity', guided_hike: 'activity', rafting: 'activity',
  horse: 'activity', cycling: 'activity', wildlife: 'activity', heli: 'activity', via_ferrata: 'activity', other: 'activity',
};

function sightSub(name: string): string {
  if (/lake|pond|lakes/i.test(name)) return 'lake';
  if (/falls|canyon|paint pots/i.test(name)) return 'waterfall';
  if (/viewpoint|lookout|overlook|summit/i.test(name)) return 'viewpoint';
  if (/gondola|tram/i.test(name)) return 'lift-ride';
  if (/town|village|townsite|centre|center/i.test(name)) return 'town';
  return 'sight';
}

function rockiesItem(id: string, R: RockiesData, where: string, log: DropLog): ScheduleItem | null {
  const rec = (rows: Record<string, unknown>[]) => rows.find((r) => r.id === id);
  const trail = rec(R.trails);
  if (trail) {
    const it = blankItem(id, 'trail', String(trail.name));
    it.sub = 'hike';
    it.stats = { distanceKm: typeof trail.km === 'number' ? trail.km : null, gainM: typeof trail.gain_m === 'number' ? trail.gain_m : null };
    it.durationRange = parseHoursRange(typeof trail.hours === 'string' ? trail.hours : null);
    it.durationSource = it.durationRange ? 'data' : null;
    it.needsDaylight = true;
    // the plan's own audience: an adults' walk is not offered to a child under 13 (a teenager can take it)
    if (trail.audience === 'adult_only') {
      it.minAge = 13;
      it.minAgeRule = 'plan';
    }
    return it;
  }
  const sight = rec(R.sights);
  if (sight) {
    const name = String(sight.name);
    const it = blankItem(id, 'visit', name);
    it.sub = sightSub(name);
    if (typeof sight.time_needed_hours === 'number') {
      it.durationMin = Math.round(sight.time_needed_hours * 60);
      it.durationSource = 'data';
    }
    return it;
  }
  const adv = rec(R.adventures);
  if (adv) {
    const type = String(adv.type);
    const it = blankItem(id, 'visit', String(adv.name));
    it.sub = RK_SUB[type] ?? 'activity';
    if (typeof adv.min_age === 'number') {
      it.minAge = adv.min_age;
      it.minAgeRule = 'hard';
    }
    void where;
    void log;
    return it;
  }
  return null;
}

/** The capture ref of a Rockies record id (`legacy/<the Rockies folder>/<trails|sights|adventures>/<id>`), or null for an inserted entry. */
function rockiesRef(R: RockiesData, id: string): string | null {
  for (const [dir, rows] of [['trails', R.trails], ['sights', R.sights], ['adventures', R.adventures]] as const) {
    if (rows.some((r) => r.id === id)) return `legacy/${PUBLIC_TRIP_FOLDER['p-rockies']}/${dir}/${id}`;
  }
  return null;
}

const trackRecordIds = (t: { trail_ids?: string[]; sight_ids?: string[]; adventure_ids?: string[] } | null): string[] =>
  t ? [...(t.adventure_ids ?? []), ...(t.sight_ids ?? []), ...(t.trail_ids ?? [])] : [];

function rockiesVariant(
  key: 'A' | 'B' | 'C', day: RockiesDay, file: ScheduleFile, dayFile: ScheduleDayFile, R: RockiesData, where: string, log: DropLog, names: Map<string, string>,
  linkOf: (name: string, trail: boolean) => string | null,
): DayVariant | null {
  const track = key === 'A' ? day.track_a : key === 'B' ? day.track_b : day.track_c;
  if (!track) return null;
  const meta = dayFile.variants?.[key] ?? file.variants?.[key] ?? { label: key, audience: 'any' as const };
  const entries: OrderEntry[] = dayFile.order?.[key] ?? trackRecordIds(track);
  const seen = new Set<string>();
  const items: ScheduleItem[] = [];
  for (const e of entries) {
    const id = typeof e === 'string' ? e : e.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const inline = typeof e === 'string' ? undefined : e;
    // a record id takes its facts from the datasets; an id the datasets lack, with a kind, is an entry the plan inserts
    let base: ScheduleItem | null = rockiesItem(id, R, where, log);
    if (!base && inline?.kind) base = blankItem(id, inline.kind, inline.title ?? id);
    if (!base) continue;
    // the page of the stop: the trip builder's kind-aware lookup, keyed by the record's own name (a trail stop its trail page, any other stop its place page)
    base = { ...base, placeSlug: base.placeSlug ?? linkOf(base.title, base.kind === 'trail') };
    const titled = file.titles?.[id] ? { ...base, title: file.titles[id]! } : base;
    items.push(applyOverride(applyOverride(titled, dayFile.items?.[id], `${where} item ${id}`, log, names), inline, `${where} item ${id}`, log, names));
  }
  const parallel = key === 'A' && !!dayFile.split;
  const rank = key === 'A' ? 3 : key === 'B' ? 2 : 1;
  return {
    key, label: meta.label, audience: meta.audience, relation: parallel ? 'parallel' : 'alternative', items, rank,
    ...(dayFile.split && (key === 'A' || key === 'B') ? { rejoin: dayFile.split.rejoin, optionalSplit: !!dayFile.split.optional } : {}),
  };
}

/**
 * The rows of join-deferred.json the plan model honours too: a row held back for `place:` (the point is not the place, like the toe walk's
 * car park) stays out of the plan as well. A row held back for `size:` only keeps bytes off its place page; the plan model adds none there.
 */
const PLAN_HELD: ReadonlySet<string> = new Set(deferred.rows.filter((r) => r.why.startsWith('place:')).map((r) => r.ref));
const planPointRows = new Map<string, Map<string, PointRow>>();

/**
 * A capture record's own public point (DG2F): the record's OpenStreetMap element or Wikidata P625, by its ref, its primary ref or an alias,
 * read by the same rule as the place-page join (`ownPoint`: never a derived trailhead, a prototype guess or an approximate row). Null for
 * a ref held back for its place, and for a record with no such point. It feeds `placePoint` only, never a page.
 */
export function recordPoint(root: string, ref: string | null | undefined): { lat: number; lon: number } | null {
  if (!ref || PLAN_HELD.has(ref)) return null;
  let rows = planPointRows.get(root);
  if (!rows) planPointRows.set(root, (rows = loadPoints(root).points));
  const world = publicWorld(root);
  const primary = primaryRef(world, ref);
  for (const r of [ref, primary, ...(world.cap.get(primary)?.rec.aliases ?? [])]) {
    const row = rows.get(r);
    if (!row || row.approx) continue;
    const p = ownPoint(row);
    if (p) return { lat: p.lat, lon: p.lon };
  }
  return null;
}

/**
 * Each stop with a public point carries it as `placePoint` (a plain copy of lat and lon): its place page's map point, else its own capture
 * record's point (`refOf`: the stop's record ref; a stop with no page link, like the Rockies cruises and canoes, or a page whose pin is
 * held back for size). The published day does not read it (its legs are the plan's); a stop moved to another day takes it as its point,
 * so its new legs are estimated point to point.
 */
function withPoints(v: DayVariant, pointOf: TimelineArgs['pointOf'], recordOf: (it: ScheduleItem) => { lat: number; lon: number } | null = () => null): DayVariant {
  if (!pointOf) return v;
  return {
    ...v,
    items: v.items.map((it) => {
      const p = it.point ? null : ((it.placeSlug ? pointOf(it.placeSlug) : null) ?? recordOf(it));
      return p ? { ...it, placePoint: { lat: p.lat, lon: p.lon } } : it;
    }),
  };
}

// ---- the Dolomites ----

const DOLO_SUB: Record<string, string> = { lake: 'lake', viewpoint: 'viewpoint', lift: 'lift-ride', hut: 'sight', pass: 'viewpoint', sight: 'sight', town: 'town', activity: 'activity' };

interface DoloArgs {
  src: Sources;
  places: Map<string, ProtoPlace>;
  days: PublicDay[];
  file: ScheduleFile;
  legs: LegsFile | null;
  log: DropLog;
}

/** The prototype place ids a day moves between, in order, for each variant: the pairs scripts/legs-ors.mjs routes (legs-pairs.ts). */
function doloLegs(
  args: DoloArgs,
  protoDay: ProtoDay,
  from: { id: string; place: string },
  to: { id: string; place: string },
): StoredLeg[] {
  const { legs, places } = args;
  if (!legs) return [];
  const lookup = new Map<string, (typeof legs.legs)[number]>();
  for (const l of legs.legs) lookup.set(`${l.from}|${l.to}`, l);
  const find = (x: string, y: string) => lookup.get(`${x}|${y}`) ?? lookup.get(`${y}|${x}`) ?? null;
  const out: StoredLeg[] = [];
  const push = (fromId: string, toId: string, x: string, y: string) => {
    const hit = find(x, y);
    if (hit) out.push({ from: fromId, to: toId, mode: hit.mode, minutes: hit.minutes, km: hit.km, basis: 'routed', estimate: false, symmetric: true });
  };
  const seq = protoDay.items.filter((i) => !['parking', 'airport'].includes(places.get(i.placeId)?.kind ?? ''));
  const keys = [...new Set(seq.map((i) => i.variant).filter((v): v is string => !!v))];
  for (const v of keys.length ? keys : ['']) {
    const path = seq.filter((i) => !i.variant || i.variant === v);
    let prev = from;
    for (const it of path) {
      const time = protoDay.items.find((x) => x.id === it.id)?.time ?? '';
      // an evening outing after dinner at the base: the way back to the base before it is a leg too
      if (prev.id !== from.id && time >= '17:00') push(prev.id, 'base', prev.place, from.place);
      push(prev.id, it.id, prev.place, it.placeId);
      prev = { id: it.id, place: it.placeId };
    }
    push(prev.id, to.id, prev.place, to.place);
  }
  return out;
}

// ---- building ----

export interface TimelineArgs {
  kind: 'dolomites' | 'rockies' | 'summary';
  slug: string;
  src: Sources;
  days: PublicDay[];
  bases: PublicBase[];
  seasonMonths: number[];
  ageFit: number | null;
  /** Dolomites */
  protoPlaces?: Map<string, ProtoPlace>;
  protoDays?: ProtoDay[];
  /** Summary trips */
  pub?: ProtoPubTrip;
  /**
   * A place page's map point by slug: the public point the route map already draws (licensed, scrubbed near home with the trip). The
   * Rockies records carry none, so without it a stop moved to another base had no position and took a 10 minute local move (C2 gap).
   * Read into `ScheduleItem.placePoint` only: the published days schedule as before.
   */
  pointOf?: (slug: string) => { lat: number; lon: number } | null;
  /** A place page's capture ref by slug, for the fallback to the record's own point when the page holds no pin (DG2F). */
  refOfSlug?: (slug: string) => string | null;
  log: DropLog;
}
interface ProtoDay {
  n: number;
  baseTown: string | null;
  items: { id: string; placeId: string; time?: string; variant?: string; note?: string }[];
}

const writtenForAge = (ageFit: number | null): string => (ageFit && ageFit > 0 ? `adults and children from about ${ageFit}` : 'adults');

function variantInfos(variants: DayVariant[], notes: Map<string, NoteBlock>, titles: Map<string, string> = new Map()): DayVariantInfo[] {
  return variants.map((v) => ({ key: v.key, label: v.label, title: titles.get(v.key) ?? null, audience: v.audience, relation: v.relation, notes: notes.get(v.key) ?? { lead: null, know: [] } }));
}

const baseOf = (file: ScheduleFile | null, id: string | null): BaseRef | null => {
  const b = id ? file?.bases?.[id] : null;
  return b ? { name: b.name, placeSlug: null, point: { lat: b.lat, lon: b.lon } } : null;
};

function sunLine(point: { lat: number; lon: number } | null, tz: string, window: SunWindow | null): { text: string | null; range: { sunrise: [string, string]; sunset: [string, string] } | null } {
  if (!point || !window) return { text: null, range: null };
  const ref = sunReference(point, tz, window);
  if (ref.state !== 'normal') return { text: ref.state === 'never-sets' ? 'The sun does not set in this window.' : 'The sun does not rise in this window.', range: null };
  const r = (x: { lo: number; hi: number }): [string, string] => [hhmm(x.lo), hhmm(x.hi)];
  const range = { sunrise: r(ref.sunrise), sunset: r(ref.sunset) };
  return { text: `Sunrise about ${range.sunrise[0]} to ${range.sunrise[1]}, sunset about ${range.sunset[0]} to ${range.sunset[1]} in this window.`, range };
}

/**
 * Fills the timeline fields of a trip's days and returns the trip's schedule (the default profile's timelines), or null for a
 * trip with no days. Mutates `days` (the adapter owns them at this point).
 */
export function attachTimeline(a: TimelineArgs): TripSchedule | null {
  if (!a.days.length) return null;
  const file = readScheduleFile(a.src.root, a.slug);
  const where = `trip ${a.slug}`;
  const inputs: ScheduleDayInput[] = [];
  const window: SunWindow | null = file ? { from: file.season.from, to: file.season.to } : monthsWindow(a.seasonMonths);
  const tz = file?.tz ?? a.src.snapshot.trip.zone;

  if (a.kind === 'rockies' && a.src.rockies && file) {
    const R = a.src.rockies;
    const itin = R.itinerary.days;
    const names = new Map<string, string>();
    for (const rows of [R.trails, R.sights, R.adventures]) for (const r of rows) names.set(String(r.id), file.titles?.[String(r.id)] ?? String(r.name).replace(/\s*\(.*\)\s*$/, ''));
    const links = new Map<string, string>();
    for (const pd of a.days) for (const t of pd.tracks ?? []) for (const it of t.items) if (it.placeSlug) links.set(`${normName(it.name)}|${it.kind === 'trail'}`, it.placeSlug);
    const linkOf = (name: string, trail: boolean): string | null => links.get(`${normName(name)}|${trail}`) ?? null;
    a.days.forEach((d, idx) => {
      const rd = itin[idx]! as RockiesDayRow;
      const dayFile = file.days[String(rd.n)] ?? {};
      const prevId = idx > 0 ? itin[idx - 1]!.base_id : rd.base_id;
      const kind: DayKind = dayFile.kind ?? (idx === 0 ? 'arrival' : idx === itin.length - 1 ? 'departure' : prevId !== rd.base_id ? 'transfer' : 'normal');
      const startBase = kind === 'arrival' ? baseOf(file, rd.base_id) : baseOf(file, prevId);
      const nextBase = kind === 'transfer' ? baseOf(file, rd.base_id) : kind === 'departure' ? baseOf(file, 'calgary-airport') : null;
      const variants = (['A', 'B', 'C'] as const)
        .map((k) => rockiesVariant(k, rd, file, dayFile, R, `${where} day ${rd.n}`, a.log, names, linkOf))
        .filter((v): v is DayVariant => v !== null)
        .map((v) => withPoints(v, a.pointOf, (it) => recordPoint(a.src.root, rockiesRef(R, it.id)) ?? recordPoint(a.src.root, it.placeSlug ? a.refOfSlug?.(it.placeSlug) : null)));
      const sun = sunLine(startBase?.point ?? null, tz, window);
      // the track notes: one lead line and grouped bullets per version
      const prep = (what: string): PrepareOpts => ({ sun: sun.range, scrub: (x) => undatedSentences(x, `${where} day ${rd.n} ${what}`, a.log), names });
      const notes = new Map<string, NoteBlock>();
      for (const [k, track] of [['A', rd.track_a], ['B', rd.track_b], ['C', rd.track_c]] as const) {
        if (track) notes.set(k, noteBlock(track.notes ?? '', prep(`track ${k} notes`)));
      }
      const know = dayKnow({ decisionRule: rd.decision_rule, wetWeather: rd.wet_weather, statusFlags: rd.status_flags }, prep('notes'));
      const input: ScheduleDayInput = {
        day: rd.n, kind, tz, base: startBase, nextBase, sunPoint: startBase?.point ?? null, sunWindow: window, variants, legs: asLegs(dayFile),
        start: dayFile.start ? { time: dayFile.start.time, source: dayFile.start.source ?? 'plan', label: dayFile.start.label ?? null } : null,
        origin: kind === 'arrival' ? { name: file.bases?.['calgary-airport']?.name ?? 'the airport', placeSlug: null, point: baseOf(file, 'calgary-airport')?.point ?? null } : null,
        homeBy: null, splitNote: null,
      };
      d.scheduleInput = input;
      const titles = new Map<string, string>();
      for (const [k, track] of [['A', rd.track_a], ['B', rd.track_b], ['C', rd.track_c]] as const) {
        const ttl = track ? undatedSentences(stripMarkers(track.title).text, `${where} day ${rd.n} track ${k} title`, a.log) : '';
        if (ttl) titles.set(k, ttl);
      }
      d.variants = variantInfos(variants, notes, titles);
      d.know = know;
      d.light = sun.text;
      if (dayFile.zone) {
        const { place, label, abbr, home, homeAbbr, offsetMin, items } = dayFile.zone;
        d.zone = { place, label, abbr, home, homeAbbr, offsetMin, items };
      }
      if (dayFile.flight) d.flight = true;
      inputs.push(input);
    });
  } else if (a.kind === 'dolomites' && a.protoPlaces && a.protoDays && file) {
    const places = a.protoPlaces;
    const legs = readLegsFile(a.src.root, a.slug);
    const args: DoloArgs = { src: a.src, places, days: a.days, file, legs, log: a.log };
    let prevNight: string | null = null;
    a.protoDays.forEach((pd, idx) => {
      const d = a.days[idx]!;
      const dayFile = file.days[String(pd.n)] ?? {};
      const night = pd.baseTown ?? prevNight ?? 'san-candido';
      const startTown = idx === 0 ? night : (prevNight ?? night);
      const first = idx === 0;
      const last = idx === a.protoDays!.length - 1;
      const kind: DayKind = dayFile.kind ?? (first ? 'arrival' : last ? 'departure' : startTown !== night ? 'transfer' : 'normal');
      const townRef = (id: string): BaseRef => {
        const p = places.get(id)!;
        return { name: p.name, placeSlug: null, point: { lat: p.lat, lon: p.lng } };
      };
      const airportItem = pd.items.find((i) => places.get(i.placeId)?.kind === 'airport');
      const airport = airportItem ? townRef(airportItem.placeId) : null;
      const real = pd.items.filter((i) => places.get(i.placeId) && !['airport', 'parking'].includes(places.get(i.placeId)!.kind));
      const mk = (it: ProtoDay['items'][number]): ScheduleItem => {
        const p = places.get(it.placeId)!;
        const pubItem = d.items.find((x) => x.id === it.id) as DayItem | undefined;
        const kindOf: ItemKind = p.kind === 'trail' ? 'trail' : 'visit';
        const base = blankItem(it.id, kindOf, p.name);
        base.sub = kindOf === 'trail' ? 'hike' : (DOLO_SUB[p.kind] ?? 'sight');
        base.placeSlug = pubItem?.placeSlug ?? null;
        base.point = { lat: p.lat, lon: p.lng };
        if (typeof p.durationMin === 'number') {
          base.durationMin = p.durationMin;
          base.durationSource = 'plan';
        }
        if (kindOf === 'trail') base.stats = { distanceKm: typeof p.km === 'number' ? p.km : null, gainM: typeof p.gain === 'number' ? p.gain : null };
        if (it.time) base.start = { time: it.time, confidence: 'suggested', source: 'plan', note: null };
        if (typeof p.minAge === 'number') {
          base.minAge = p.minAge;
          base.minAgeRule = 'hard';
        }
        base.needsDaylight = kindOf === 'trail';
        const n = itemNote(pubItem?.note ?? null, `${where} day ${pd.n} item ${it.id}`, a.log);
        base.note = n.text;
        base.honesty = n.honesty;
        return applyOverride(base, dayFile.items?.[it.id], `${where} day ${pd.n} item ${it.id}`, a.log);
      };
      const vkeys = [...new Set(real.map((i) => i.variant).filter((v): v is string => !!v))];
      const variants: DayVariant[] = [];
      if (vkeys.length) {
        for (const k of vkeys as ('A' | 'B')[]) {
          const meta = dayFile.variants?.[k] ?? file.variants?.[k] ?? { label: `Option ${k}`, audience: 'any' as const };
          variants.push({ key: k, label: meta.label, audience: meta.audience, relation: 'alternative', rank: k === 'A' ? 3 : 2, items: real.filter((i) => !i.variant || i.variant === k).map(mk) });
        }
      } else {
        variants.push({ key: 'main', label: "The plan's day", audience: 'any', relation: 'alternative', rank: 2, items: real.map(mk) });
      }
      const startBase = townRef(startTown);
      const nextBase = kind === 'departure' ? airport : kind === 'transfer' ? townRef(night) : null;
      const legsStored =
        first && airportItem
          ? doloLegs(args, pd, { id: 'origin', place: airportItem.placeId }, { id: 'base', place: night })
          : last && airportItem
            ? doloLegs(args, pd, { id: 'base', place: startTown }, { id: 'next-base', place: airportItem.placeId })
            : kind === 'transfer'
              ? doloLegs(args, pd, { id: 'base', place: startTown }, { id: 'next-base', place: night })
              : doloLegs(args, pd, { id: 'base', place: startTown }, { id: 'base', place: startTown });
      let start: ScheduleDayInput['start'] = dayFile.start ? { time: dayFile.start.time, source: dayFile.start.source ?? 'plan', label: dayFile.start.label ?? null } : null;
      if (!start && first && airportItem?.time) start = { time: airportItem.time, source: 'plan', label: `Land at ${airport?.name ?? 'the airport'}` };
      if (!start && last && airportItem?.time) {
        const to = legsStored.find((l) => l.to === 'next-base');
        const lead = (to?.minutes ?? 120) + 20 + 15;
        const [h, m] = airportItem.time.split(':').map(Number);
        start = { time: hhmm(Math.floor(((h! * 60 + m!) - lead) / 5) * 5), source: 'plan', label: `Leave ${startBase.name}` };
      }
      const sun = sunLine(startBase.point, tz, window);
      const input: ScheduleDayInput = {
        day: pd.n, kind, tz, base: startBase, nextBase, sunPoint: startBase.point, sunWindow: window, variants, legs: legsStored, start,
        origin: first ? airport : null, homeBy: null, splitNote: null, checkin: first ? 'last' : 'first',
      };
      d.scheduleInput = input;
      d.variants = variantInfos(variants, new Map(), variants.length > 1 ? new Map(variants.map((v) => [v.key, v.label])) : new Map());
      d.light = sun.text;
      inputs.push(input);
      prevNight = night;
    });
  } else if (a.kind === 'summary' && a.pub) {
    summaryInputs(a, window, tz, inputs);
  } else {
    return null;
  }

  const profile = file ? profileOf(file) : { ...DEFAULT_PROFILE };
  const timelines = scheduleTrip(inputs, profile);
  const writtenFor = file?.writtenFor ?? writtenForAge(a.ageFit);
  return {
    defaultProfile: profile,
    writtenFor,
    timelines,
    condensed: a.kind === 'summary',
    hasSplit: inputs.some((i) => i.variants.some((v) => v.relation === 'parallel')),
    hasVariants: inputs.some((i) => i.variants.length > 1),
  };
}

// ---- summary trips: a condensed plan, the plan's own stops in order with a part of the day, a flight or transfer where it names one ----

const MEAL = /\b(lunch|dinner|supper|breakfast|parrilla|brunch)\b/i;
const TRANSFER = /\b(?:to|from)\b|^drive|border|home\b/i;

function summaryInputs(a: TimelineArgs, window: SunWindow | null, tz: string, out: ScheduleDayInput[]): void {
  const pub = a.pub!;
  let prevBase: string | null = null;
  a.days.forEach((d, idx) => {
    const pd = pub.days[idx]!;
    const baseName = d.base ?? prevBase;
    const kind: DayKind = prevBase && baseName && prevBase !== baseName ? 'transfer' : 'normal';
    const items: ScheduleItem[] = [];
    pd.stops.forEach((st, i) => {
      const found = d.items.find((x) => x.name === st.name);
      const id = found?.id ?? `${d.n}-t${i + 1}`;
      const n = itemNote(found?.note ?? st.note ?? null, `trip ${a.slug} day ${d.n} stop`, a.log);
      let it: ScheduleItem;
      if (st.kind === 'airport' && /\b(?:fly|flight)\b/i.test(st.name)) {
        it = blankItem(id, 'transfer', st.name);
        it.sub = 'flight';
      } else if (st.kind === 'drive' && TRANSFER.test(st.name)) {
        it = blankItem(id, 'transfer', st.name);
        it.sub = 'drive';
      } else {
        const isMeal = st.kind === 'food' || MEAL.test(st.name);
        const kindOf: ItemKind = isMeal ? 'meal' : st.kind === 'hike' ? 'trail' : st.kind === 'stay' ? 'checkin' : 'visit';
        it = blankItem(id, kindOf, st.name);
        it.sub = isMeal
          ? /dinner|supper|parrilla/i.test(st.name) ? 'dinner' : /breakfast/i.test(st.name) ? 'breakfast' : 'lunch'
          : kindOf === 'trail' ? 'hike'
          : st.kind === 'view' ? 'viewpoint' : st.kind === 'water' ? 'lake' : st.kind === 'lift' ? 'lift-ride' : st.kind === 'town' ? 'town' : st.kind === 'activity' ? 'activity'
          : st.kind === 'drive' ? 'scenic-drive' : st.kind === 'airport' ? (/pick up/i.test(st.name) ? 'car-hire' : 'sight') : 'sight';
      }
      it.placeSlug = found?.placeSlug ?? null;
      it.durationMin = st.durationMin;
      it.durationSource = 'plan';
      it.note = n.text;
      it.honesty = n.honesty;
      items.push(it);
    });
    const nameBase = baseName ? { name: baseName, placeSlug: null, point: null } : null;
    const base: BaseRef | null = kind === 'transfer' && prevBase ? { name: prevBase, placeSlug: null, point: null } : nameBase;
    const next: BaseRef | null = kind === 'transfer' && baseName ? { name: baseName, placeSlug: null, point: null } : null;
    // the stops' public points ride along for a stop moved in edit mode, as on the Rockies (DG2F); a blocks day draws no legs from them
    const main = withPoints({ key: 'main', label: "The plan's day", audience: 'any', relation: 'alternative', rank: 2, items }, a.pointOf, (it) => recordPoint(a.src.root, it.placeSlug ? a.refOfSlug?.(it.placeSlug) : null));
    const input: ScheduleDayInput = {
      day: d.n, kind, tz, base, nextBase: next, sunPoint: null, sunWindow: window, blocks: true,
      variants: [main],
      legs: [], start: null, origin: null, homeBy: null, splitNote: null,
    };
    d.scheduleInput = input;
    d.variants = variantInfos(input.variants, new Map());
    out.push(input);
    prevBase = baseName ?? prevBase;
  });
}
