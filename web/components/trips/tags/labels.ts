// Words for the trip tags. One place, so a card chip, a filter option and a table cell say the same thing.
import { hoursMinutes } from '@/components/trips/format';
import { ageBasisWhy, ageLabel } from '@/lib/format/age';
import type { TripListRow } from '@/components/trips/types';

export const LENGTH_LABELS: Record<string, string> = {
  day: 'Day trips',
  overnight: 'Overnights',
  weekend: 'Weekends (2 nights)',
  'long-weekend': 'Long weekends (3 nights)',
  '4-8': '4 to 8 nights',
  '9-14': '9 to 14 nights',
  '15+': '15 nights and more',
};
export const LENGTH_ORDER = Object.keys(LENGTH_LABELS);
/** The chip on a card: short, singular. */
/**
 * The one set of names for a trip's length class (backlog 4.11): the card chip, the table cell and the subtitle all read it, so a
 * weekend is "Weekend" with "2 nights" beside it everywhere. The Length filter's own menu lists the plural names in LENGTH_LABELS.
 */
export const LENGTH_NAME: Record<string, { name: string; nights: string | null }> = {
  day: { name: 'Day trip', nights: null },
  overnight: { name: 'Overnight', nights: '1 night' },
  weekend: { name: 'Weekend', nights: '2 nights' },
  'long-weekend': { name: 'Long weekend', nights: '3 nights' },
  '4-8': { name: '4 to 8 nights', nights: null },
  '9-14': { name: '9 to 14 nights', nights: null },
  '15+': { name: '15+ nights', nights: null },
};
/** The chip on a card: short, singular. */
export const LENGTH_CHIP: Record<string, string> = Object.fromEntries(Object.entries(LENGTH_NAME).map(([k, v]) => [k, v.name]));
/** The table cell: the name, and the nights where the class has a fixed number. */
export const lengthCell = (c: string | null): string => (c && LENGTH_NAME[c] ? `${LENGTH_NAME[c].name}${LENGTH_NAME[c].nights ? ` (${LENGTH_NAME[c].nights})` : ''}` : '');
export const PHASE_FOR_LENGTH: Record<string, string> = { day: 'Day trips', overnight: 'Overnights', weekend: 'Weekends', 'long-weekend': 'Long weekends', '4-8': '4 to 8 nights', '9-14': '9 to 14 nights', '15+': '15 nights and more' };

/** The standard ages the Kids filter offers: a plan suits a child of age A when its "Kids from N" is A or less. */
export const KID_AGES = [4, 6, 8, 10, 12] as const;

export const HIKE_ORDER = ['easy', 'moderate', 'strenuous'] as const;
export const AROUND_ORDER = ['rental-car', 'camper-van', 'train', 'tours'] as const;
export const PERDAY_ORDER = ['u1', '1-2', '2-3', '3+'] as const;

/** Hub bands for the "From Toronto" pill: the value is `toronto-<n>`, n = 1 to 4 (short-trips 3.3). */
export const HUB_BANDS = [
  { n: 1, label: 'Under 1 hour', max: 60 },
  { n: 2, label: '1 to 2 hours', max: 120 },
  { n: 3, label: '2 to 3 hours', max: 180 },
  { n: 4, label: '3 hours and more', max: Infinity },
] as const;
export const hubBandOf = (minutes: number) => HUB_BANDS.find((b) => minutes < b.max)!;

/** The card's mono line: "Day trip · from Toronto 1 h 25", "2 nights · a weekend", or the nights and days for 4 and up (short-trips 3.3). */
export function lengthLine(t: TripListRow): string {
  const from = t.fromHubMin === null ? null : `from Toronto ${t.fromHubApprox ? '≈' : ''}${hoursMinutes(t.fromHubMin)}`;
  const place = t.region;
  switch (t.lengthClass) {
    case 'day':
      return [LENGTH_NAME.day!.name, from ?? place].filter(Boolean).join(' · ');
    case 'overnight':
    case 'weekend':
    case 'long-weekend':
      return [LENGTH_NAME[t.lengthClass]!.name, LENGTH_NAME[t.lengthClass]!.nights, from].filter(Boolean).join(' · ');
    default:
      return [t.nights === null || t.days === null ? '' : `${t.nights} nights · ${t.days} days`, place].filter(Boolean).join(' · ');
  }
}

/** What the Kids chip says and what it rests on: "Kids from 8 · our plan", "Kids from 10 · checked", "All ages · checked". */
export function kidsLabel(ageFit: number, basis: 'computed' | 'floor' | 'plan' | null): { text: string; why: string } {
  // the plan's own number is "our plan" when nothing was checked
  const b = basis ?? 'plan';
  return { text: ageLabel('fit', ageFit, b), why: ageBasisWhy(b) };
}

/** "Hike effort: moderate · checked" or "· our plan": the same two words as the Kids chip. */
export function hikeLabel(hike: string, basis: 'computed' | 'plan' | null): { text: string; why: string } {
  const plan = basis !== 'computed';
  return {
    text: `Hike effort: ${hike} · ${plan ? 'our plan' : 'checked'}`,
    why: plan ? "The plan's own word. Some trails in the family days have no effort on record, so the records cannot settle it." : 'The hardest trail with a known effort in the days a family would take.',
  };
}

/** The URL of the Trips list filtered by one tag. */
export const tagHref = (param: string, value: string): string => `/trips/?${param}=${encodeURIComponent(value)}`;
