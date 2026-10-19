// Which tag chips a trip card shows, as plain data (no React), so a test can check the rules: overview trips get no chip for what
// they cannot know, and at most two suitability chips show.
import type { TripListRow } from '@/components/trips/types';
import { KID_AGES, LENGTH_CHIP, tagHref } from './labels';

export interface TagChip {
  key: string;
  label: string;
  href: string;
  aria: string;
  icon?: string;
}

export const HIKE_LABEL = { easy: 'easy', moderate: 'moderate', strenuous: 'strenuous' } as const;
export const AROUND_LABEL: Record<string, string> = { 'rental-car': 'Rental car', 'camper-van': 'Camper van', train: 'Train', tours: 'Tours' };

export function tagChips(row: TripListRow): { suit: TagChip[]; tags: TagChip[] } {
  const suit: TagChip[] = [];
  if (row.ageFit !== null) {
    // the Kids filter offers standard ages; "Kids from 7" opens the list for the nearest age at or above it (8), which includes this plan
    const age = KID_AGES.find((a) => a >= (row.ageFit as number)) ?? KID_AGES[KID_AGES.length - 1];
    suit.push({ key: 'kids', label: row.ageFit === 0 ? 'All ages' : `Kids from ${row.ageFit}`, href: tagHref('kid', String(age)), aria: `Show trips that suit a child of ${age}`, icon: 'user' });
  }
  if (row.hike) suit.push({ key: 'hike', label: `Hike effort: ${HIKE_LABEL[row.hike]}`, href: tagHref('effort', row.hike), aria: `Show trips with ${HIKE_LABEL[row.hike]} hiking`, icon: 'mountain' });
  const tags: TagChip[] = [];
  const first = row.countries[0];
  if (first) tags.push({ key: 'where', label: row.countries.length > 1 ? `${first.name} +${row.countries.length - 1}` : first.name, href: tagHref('country', first.code), aria: `Show trips in ${first.name}` });
  if (row.length) tags.push({ key: 'length', label: LENGTH_CHIP[row.length] ?? row.length, href: tagHref('length', row.length), aria: `Show ${LENGTH_CHIP[row.length]?.toLowerCase() ?? row.length} trips` });
  for (const a of row.activities.slice(0, 2)) tags.push({ key: `a-${a.id}`, label: a.label, href: tagHref('tag', a.id), aria: `Show trips with ${a.label.toLowerCase()}` });
  return { suit: suit.slice(0, 2), tags };
}
