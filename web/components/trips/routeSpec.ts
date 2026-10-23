// The trip route map's spec, key and label (map note 4, 5, 6). Lives in the map's own chunk: the trip page's start JS does not carry it.
import { haversineM } from '@travel/core/geo/distance.ts';
import type { LegendItem, Line, LngLat, MapSpec, Pin } from '@/lib/map/types';
import type { RoutedPath } from './legGeometry';
import { cellOf, dayBases, type DayMap } from './mapPins';

export interface RouteBase { id: string; name: string; lng: number; lat: number; days: number[] }

/** Padding that keeps a fit clear of the map's own chrome (note 6.2): wide maps draw stop labels, narrow ones numbers only. */
export const FIT_PADDING = {
  wide: { top: 56, right: 176, bottom: 48, left: 48 },
  narrow: { top: 40, right: 60, bottom: 44, left: 28 },
} as const;
/** A map at least this many px wide draws stop labels beside the pins (note 4.2). */
export const LABEL_MIN_WIDTH = 560;
const DAY_MAX_ZOOM = 13;
const BASE_ZOOM = 11;

const at = (b: { lng: number; lat: number }): LngLat => ({ lng: b.lng, lat: b.lat });

/** The legs of one day, each its own line: `leg:<day>:<i>` runs into pin i; `leg:<day>:end` runs to the night's base. A missing base is never invented. */
export function legIds(m: DayMap, hasMorning: boolean, hasNight: boolean): string[] {
  if (!m.pins.length) return [];
  const ids = m.pins.slice(hasMorning ? 0 : 1).map((p) => `leg:${m.day}:${p.n}`);
  return hasNight ? [...ids, `leg:${m.day}:end`] : ids;
}

/** A routed line ends at the stop's trailhead or car park, which can be km from its pin: past this gap a dashed stub joins the two (T5). */
export const STUB_GAP_M = 50;
const gapM = (a: LngLat, b: LngLat): number => haversineM({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng });

function dayLegs(m: DayMap, bases: RouteBase[], geometry: Record<string, RoutedPath> | undefined, picked: boolean): Line[] {
  const { morning, night } = dayBases(bases, m.day);
  const chain: (LngLat | null)[] = [morning ? at(morning) : null, ...m.pins.map((p) => p.at), night ? at(night) : null];
  if (!m.pins.length) return [];
  const lines: Line[] = [];
  chain.forEach((to, i) => {
    const from = chain[i - 1];
    if (!to || !from) return;
    // chain index 1..N are the pins; the last entry is the night base
    const id = i <= m.pins.length ? `leg:${m.day}:${i}` : `leg:${m.day}:end`;
    const g = geometry?.[id];
    if (!g) {
      lines.push({ id, coords: [from, to], style: 'straight-estimate' });
      return;
    }
    const first = g.path[0]!;
    const last = g.path[g.path.length - 1]!;
    // the route's own ends are the car park or trailhead; the pins are where the family goes, so the rest is drawn as the estimate it is
    if (gapM(from, first) > STUB_GAP_M) lines.push({ id: `${id}:a`, coords: [from, first], style: 'straight-estimate' });
    lines.push({ id, coords: g.path, style: picked ? 'route-pick' : 'route', mode: g.mode });
    if (gapM(last, to) > STUB_GAP_M) lines.push({ id: `${id}:b`, coords: [last, to], style: 'straight-estimate' });
  });
  return lines;
}

/** Ids a fit covers for one day: its pins and legs and the bases at either end. A day with no pin frames its base. */
export function dayFitIds(models: DayMap[], bases: RouteBase[], n: number): string[] {
  const m = models.find((d) => d.day === n);
  const { morning, night } = dayBases(bases, n);
  if (!m || !m.pins.length) return night ? [`base:${night.id}`] : [];
  return [...new Set([...m.pins.map((p) => p.id), ...legIds(m, !!morning, !!night), ...(morning ? [`base:${morning.id}`] : []), ...(night ? [`base:${night.id}`] : [])])];
}

export interface SpecInput {
  bases: RouteBase[];
  models: DayMap[];
  /** The day the map shows, or null for All days. */
  picked: number | null;
  /** Encoded-away road geometry by leg id; none exists yet for any trip, so every leg is a labelled straight estimate. */
  geometry?: Record<string, RoutedPath>;
  wide?: boolean;
}

/**
 * The map for one picked day (or all days). Rules, from the note:
 * - A pin is a timeline entry with a position, numbered in the day list's order; a road or drive is never a pin; a stop with no position has no pin and no vertex.
 * - A leg without road geometry is a straight, dashed, labelled estimate; amber and solid are for real route geometry only.
 * - In Day view only the picked day's lines are drawn; the other days' stops stay as dimmed dots.
 */
export function routeSpec({ bases, models, picked, geometry, wide = true }: SpecInput): MapSpec {
  const day = models.find((d) => d.day === picked) ?? null;
  const { night } = picked !== null ? dayBases(bases, picked) : { night: undefined };
  const pins: Pin[] = bases.map((b) => ({ id: `base:${b.id}`, at: at(b), style: 'base' as const, label: b.name, quiet: b.id !== night?.id, days: b.days }));
  const taken = new Set(bases.map(cellOf));
  if (day) {
    for (const p of day.pins) {
      taken.add(cellOf(p.at));
      pins.push({ id: p.id, at: p.at, style: 'stop-numbered', number: p.n, label: p.name, days: [day.day] });
    }
  }
  const dots = new Map<string, Pin>();
  for (const m of models) {
    if (m.day === picked) continue;
    for (const p of m.pins) {
      const c = cellOf(p.at);
      if (taken.has(c)) continue;
      const hit = dots.get(c);
      if (hit) hit.days = [...(hit.days ?? []), m.day];
      else dots.set(c, { id: `dot:${p.id.split(':').slice(2).join(':')}`, at: p.at, style: 'stop', quiet: true, dim: picked !== null, days: [m.day] });
    }
  }
  pins.push(...dots.values());
  const lines = (picked !== null ? models.filter((m) => m.day === picked) : models).flatMap((m) => dayLegs(m, bases, geometry, picked !== null));
  const empty = picked !== null && !day?.pins.length;
  const ids = picked !== null ? dayFitIds(models, bases, picked) : [];
  return {
    pins,
    lines,
    // a day with no placed stop frames its base, or shows the whole trip; either way the previous day's view is not left on screen (note 6.3)
    fit: picked !== null && ids.length ? { ids } : 'all',
    selectedId: night ? `base:${night.id}` : undefined,
    hideBasemapLabels: ['towns', 'regions'],
    load: 'visible',
    fitPadding: wide ? FIT_PADDING.wide : FIT_PADDING.narrow,
    maxZoom: picked === null ? undefined : empty ? (ids.length ? BASE_ZOOM : undefined) : DAY_MAX_ZOOM,
  };
}

// ---- the key (note 5.2) ------------------------------------------------------------------------------------------------------------------
export const KEY_LABEL = {
  stop: "Stop, numbered in the day's order",
  stops: 'Stop',
  base: 'Base for the night',
  estimate: 'Straight line, not a route',
  road: 'Road route',
  roadOrPath: 'Road or path route',
  other: 'Other days',
} as const;
export const KEY_NO_ROUTE = "Road routes are not drawn yet. Lines join each day's stops in order; use Directions for the drive.";
export const KEY_SOME_ROUTE = "Road routes from OpenStreetMap data run to each stop's car park or trailhead. A straight line has no road route stored, often because the stop is reached on foot, by lift or by boat.";

export interface KeyState { items: (LegendItem & { dim?: boolean; pick?: boolean })[]; sentence: string | null }

/** Only what the map draws in this view, in the note's order. */
export function keyOf(spec: Pick<MapSpec, 'pins' | 'lines' | 'selectedId'>): KeyState {
  const has = (f: (p: Pin) => boolean) => spec.pins.some(f);
  const estimate = spec.lines.some((l) => l.style === 'straight-estimate');
  const routedLines = spec.lines.filter((l) => l.style === 'route' || l.style === 'route-pick');
  const routed = routedLines.length > 0;
  const items: KeyState['items'] = [];
  if (has((p) => p.style === 'stop-numbered')) items.push({ id: 'stop', label: KEY_LABEL.stop, style: 'stop-numbered' });
  else if (has((p) => p.style === 'stop' && !p.dim)) items.push({ id: 'stops', label: KEY_LABEL.stops, style: 'stop' });
  // the base of the picked day is drawn amber with its casing: the key shows what the map shows
  if (has((p) => p.style === 'base')) items.push({ id: 'base', label: KEY_LABEL.base, style: 'base', pick: has((p) => p.style === 'base' && p.id === spec.selectedId) });
  if (estimate) items.push({ id: 'estimate', label: KEY_LABEL.estimate, style: 'straight-estimate' });
  // the swatch is the line the map draws: amber with a casing for the picked day, thin ink for All days; a walk says so
  if (routed) items.push({ id: 'road', label: routedLines.some((l) => l.mode === 'walk') ? KEY_LABEL.roadOrPath : KEY_LABEL.road, style: routedLines.some((l) => l.style === 'route-pick') ? 'route-pick' : 'route' });
  if (has((p) => p.style === 'stop' && !!p.dim)) items.push({ id: 'other', label: KEY_LABEL.other, style: 'stop', dim: true });
  return { items, sentence: routed ? (estimate ? KEY_SOME_ROUTE : null) : KEY_NO_ROUTE };
}

// ---- the label row (note 4.1, 6.3) -------------------------------------------------------------------------------------------------------
const stops = (n: number): string => `${n} ${n === 1 ? 'stop' : 'stops'} on the map`;

export interface LabelInput {
  /** The day shown, or null for All days. */
  day: number | null;
  baseName: string | null;
  baseOnMap: boolean;
  model: DayMap | null;
  /** All days: distinct dots drawn and stops with no position across the trip. */
  trip: { stops: number; missing: number };
  /** Paused on All days: the label then also says which day Follow resumes. */
  paused?: boolean;
  /** A phone or tablet sheet: one line, so the count comes first and the words that repeat the segment are left out. */
  compact?: boolean;
}

/** The sentence before the "N not on the map" button, and the count the button carries. Both counts come from the same model as the pins. */
export function labelOf(i: LabelInput): { text: string; missing: number } {
  if (i.day === null && i.compact) return { text: stops(i.trip.stops), missing: i.trip.missing };
  if (i.day === null) return { text: `${i.paused ? '' : 'All days · '}the whole trip · ${stops(i.trip.stops)}`, missing: i.trip.missing };
  const head = `Day ${i.day}${i.baseName ? ` · ${i.baseName}` : ''}`;
  const m = i.model;
  if (m && m.pins.length) return { text: `${head} · ${stops(m.pins.length)}`, missing: m.missing };
  const why = m && m.missing ? 'no stop has a map position' : 'no stops planned';
  if (i.baseOnMap) return { text: `${head} · ${why} · showing the base`, missing: m?.missing ?? 0 };
  return { text: `Day ${i.day} · ${why}${m && m.missing ? ' yet' : ''} · showing the whole trip`, missing: m?.missing ?? 0 };
}
