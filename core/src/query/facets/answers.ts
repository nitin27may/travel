// How a list row answers a contract facet: from the six bands it carries (contract 7.3), the km and climb it shows, and its season.
// An empty answer is a gap, and a gap never passes a positive filter (contract 7.1 rule 4). Nothing here reads a raw value.
import { EFFORT_NAMES, FLAG_OF_PROPERTY } from '../../capture/bandKeys.ts';
import type { BookingBand, PriceBand, TimeBand } from '../../capture/bandKeys.ts';
import type { FacetOption } from '../types.ts';
import type { SliceFacet } from './slice.ts';

/** The fields of a list row that facets read. A row that has not got the bands (older fixtures) simply answers nothing. */
export interface FacetRow {
  type?: string | null;
  effort?: string | null;
  kids_from?: number | null;
  kids_basis?: 'rule' | 'advice' | null;
  time_band?: string | null;
  price_band?: string | null;
  booking?: string | null;
  flags?: string[];
  walk_band?: string | null;
  shape?: string | null;
  best_time?: string | null;
  km?: number | null;
  gain_m?: number | null;
  season?: number[];
}

export const TIME_LABELS: Record<TimeBand, string> = { '<1h': 'Under 1 hour', '1-2h': '1 to 2 hours', '2-4h': '2 to 4 hours', 'half-day': 'Half a day', 'full-day': 'A full day', 'multi-day': 'Several days' };
export const PRICE_LABELS: Record<PriceBand, string> = { free: 'Free', $: '$ · low', $$: '$$ · mid', $$$: '$$$ · high' };
export const BOOKING_LABELS: Record<BookingBand, string> = { none: 'Not needed', recommended: 'Recommended', required: 'Required' };
export const WALK_LABELS: Record<string, string> = { lt200: 'Under 200 m', '200-600': '200 to 600 m', '600-1500': '600 m to 1.5 km', '1500+': 'Over 1.5 km' };
export const SHAPE_LABELS: Record<string, string> = { loop: 'Loop', 'out-and-back': 'Out and back', 'point-to-point': 'Point to point', network: 'Network of paths' };
export const BEST_TIME_LABELS: Record<string, string> = { sunrise: 'Sunrise', golden_am: 'Golden hour, morning', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', golden_pm: 'Golden hour, evening', sunset: 'Sunset', night: 'Night' };
export const EFFORT_VALUES = EFFORT_NAMES.map((n) => n.toLowerCase());
export const EFFORT_LABELS: Record<string, string> = Object.fromEntries(EFFORT_NAMES.map((n) => [n.toLowerCase(), n]));

const LENGTH_BANDS = [
  { value: 'lt3', label: 'Under 3 km', max: 3 },
  { value: '3-6', label: '3 to 6 km', max: 6 },
  { value: '6-10', label: '6 to 10 km', max: 10 },
  { value: '10+', label: '10 km and more', max: Infinity },
];
const CLIMB_BANDS = [
  { value: 'lt150', label: 'Under 150 m', max: 150 },
  { value: '150-400', label: '150 to 400 m', max: 400 },
  { value: '400-800', label: '400 to 800 m', max: 800 },
  { value: '800+', label: '800 m and more', max: Infinity },
];
const AGE_BANDS = [
  { value: 'u5', label: 'Under 5', max: 5 },
  { value: '5-7', label: '5 to 7', max: 8 },
  { value: '8-11', label: '8 to 11', max: 12 },
  { value: '12+', label: '12 and over', max: Infinity },
];
const SEASONS: { value: string; label: string; months: number[] }[] = [
  { value: 'spring', label: 'Spring', months: [3, 4, 5] },
  { value: 'summer', label: 'Summer', months: [6, 7, 8] },
  { value: 'autumn', label: 'Autumn', months: [9, 10, 11] },
  { value: 'winter', label: 'Winter', months: [12, 1, 2] },
];

const pick = (bands: { value: string; label: string; max: number }[], n: number): FacetOption[] => {
  const b = bands.find((x) => n < x.max);
  return b ? [{ value: b.value, label: b.label }] : [];
};
const single = (value: string | null | undefined, labels: Record<string, string>): FacetOption[] => (value ? [{ value, label: labels[value] ?? value }] : []);

/** Fixed display order of the values of a band facet. */
export function orderOf(f: SliceFacet): string[] | undefined {
  switch (f.band) {
    case 'time_band': return Object.keys(TIME_LABELS);
    case 'price_band': return Object.keys(PRICE_LABELS);
    case 'booking': return Object.keys(BOOKING_LABELS);
    case 'effort': return EFFORT_VALUES;
    case 'length_band': return LENGTH_BANDS.map((b) => b.value);
    case 'climb_band': return CLIMB_BANDS.map((b) => b.value);
    case 'kids_from': return AGE_BANDS.map((b) => b.value);
    case 'season_band': return SEASONS.map((s) => s.value);
    case 'walk_band': return Object.keys(WALK_LABELS);
    default: return f.property === 'ext.trail.shape' ? Object.keys(SHAPE_LABELS) : f.property === 'best_time' ? Object.keys(BEST_TIME_LABELS) : f.control === 'bool' || FLAG_OF_PROPERTY[f.property] ? ['yes', 'no'] : undefined;
  }
}

/** The options a row has for one facet; [] when the row does not answer it. */
export function answersOf(f: SliceFacet, row: FacetRow): FacetOption[] {
  switch (f.band) {
    case 'time_band': return single(row.time_band, TIME_LABELS);
    case 'price_band': return single(row.price_band, PRICE_LABELS);
    case 'booking': return single(row.booking, BOOKING_LABELS);
    case 'effort': return single(row.effort?.toLowerCase(), EFFORT_LABELS);
    case 'length_band': return row.km == null ? [] : pick(LENGTH_BANDS, row.km);
    case 'climb_band': return row.gain_m == null ? [] : pick(CLIMB_BANDS, row.gain_m);
    case 'kids_from': return row.kids_from == null ? [] : pick(AGE_BANDS, row.kids_from);
    case 'season_band': {
      const months = row.season ?? [];
      return SEASONS.filter((s) => s.months.some((m) => months.includes(m))).map((s) => ({ value: s.value, label: s.label }));
    }
    case undefined:
      if (f.property === 'ext.trail.shape') return single(row.shape, SHAPE_LABELS);
      if (f.property === 'best_time') return single(row.best_time, BEST_TIME_LABELS);
      break;
    case 'walk_band': return single(row.walk_band, WALK_LABELS);
    default: return []; // a band the rows do not carry yet: a gap, so the 60% rule hides the facet
  }
  const flag = FLAG_OF_PROPERTY[f.property];
  if (!flag) return [];
  const flags = row.flags ?? [];
  const part = flag === 'stroller' && flags.includes('stroller_part');
  if (flags.includes(flag) || part) return [{ value: 'yes', label: part ? 'Part of the way' : 'Yes' }];
  if (flags.includes(`!${flag}`)) return [{ value: 'no', label: 'No' }];
  return [];
}
