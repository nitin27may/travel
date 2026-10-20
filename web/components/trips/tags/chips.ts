// Which tag chips a trip card shows, as plain data (no React), so a test can check the rules: overview trips get no chip for what
// they cannot know, and at most two suitability chips show.
import type { TripListRow } from '@/components/trips/types';
import { LENGTH_CHIP, hikeLabel, kidsLabel, tagHref } from './labels';

export interface TagChip {
  key: string;
  label: string;
  href: string;
  aria: string;
  /** The tooltip: what the chip rests on. */
  why?: string;
  icon?: string;
}

export const HIKE_LABEL = { easy: 'easy', moderate: 'moderate', strenuous: 'strenuous' } as const;
export const AROUND_LABEL: Record<string, string> = { 'rental-car': 'Rental car', 'camper-van': 'Camper van', train: 'Train', tours: 'Tours' };

export function tagChips(row: TripListRow): { suit: TagChip[]; tags: TagChip[] } {
  const suit: TagChip[] = [];
  if (row.ageFit !== null) {
    // the Youngest child filter takes any age, so "Kids from 7" opens the list for a child of 7
    const age = row.ageFit;
    const k = kidsLabel(row.ageFit, row.kidsBasis);
    suit.push({ key: 'kids', label: k.text, href: tagHref('kid', String(age)), aria: `Show trips that suit a child of ${age}. ${k.why}`, why: k.why, icon: 'user' });
  }
  if (row.hike) {
    const h = hikeLabel(HIKE_LABEL[row.hike], row.hikeBasis);
    suit.push({ key: 'hike', label: h.text, href: tagHref('effort', row.hike), aria: `Show trips with ${HIKE_LABEL[row.hike]} hiking. ${h.why}`, why: h.why, icon: 'mountain' });
  }
  const tags: TagChip[] = [];
  const first = row.countries[0];
  if (first) tags.push({ key: 'where', label: row.countries.length > 1 ? `${first.name} +${row.countries.length - 1}` : first.name, href: tagHref('country', first.code), aria: `Show trips in ${first.name}`, icon: 'pin' });
  if (row.length) tags.push({ key: 'length', label: LENGTH_CHIP[row.length] ?? row.length, href: tagHref('length', row.length), aria: `Show ${LENGTH_CHIP[row.length]?.toLowerCase() ?? row.length} trips`, icon: 'clock' });
  for (const a of row.activities.slice(0, 2)) tags.push({ key: `a-${a.id}`, label: a.label, href: tagHref('tag', a.id), aria: `Show trips with ${a.label.toLowerCase()}`, icon: 'activity' });
  return { suit: suit.slice(0, 2), tags };
}
