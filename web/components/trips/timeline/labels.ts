import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { honesty } from '@/lib/public/honesty';
import type { HonestyId } from '@/lib/public/types';

/** Source labels of the time (spec 1.3). */
export const SOURCE_LABEL: Record<TimelineEntry['time']['source'], string> = {
  operator: 'Operator timetable',
  plan: 'From the plan',
  sun: 'Sun, computed for the season',
  data: 'From our place data',
  rule: 'Our rule',
  visitor: 'You added this',
};

export const CONF_LABEL: Record<TimelineEntry['time']['confidence'], string> = { fixed: 'fixed', anchored: 'tied to the sun', suggested: 'suggested' };

export const KIND_WORD: Record<TimelineEntry['kind'], string> = {
  start: 'start', leg: 'travel', visit: 'stop', trail: 'walk', meal: 'meal', break: 'break', rest: 'rest', checkin: 'check-in', checkout: 'check-out', booking: 'booking', sun: 'sun', end: 'end',
};

export const MODE_WORD: Record<string, string> = { drive: 'Drive', walk: 'Walk', shuttle: 'Shuttle', bus: 'Bus', train: 'Train', ferry: 'Ferry', boat: 'Boat', lift: 'Lift', flight: 'Flight' };

/** What the time column says. "about" for the sun, nothing extra for the rest: weight and the node carry fixed and suggested. */
export function timeText(e: TimelineEntry): string {
  if (e.time.confidence === 'anchored') return `about ${e.start}`;
  return e.start;
}

/** The word under or beside a fixed time (spec 1.3: Slot, Last ride up, Departure). */
export function fixedLabel(e: TimelineEntry): string | null {
  if (e.time.confidence !== 'fixed') return null;
  if (e.kind === 'booking') return 'Slot';
  return e.time.source === 'operator' ? 'Slot' : 'Fixed time';
}

export const honestyLabel = (id: HonestyId): string => honesty(id, '').label;

/** The sentence a screen reader gets for the time. */
export function timeSpeech(e: TimelineEntry): string {
  if (e.kind === 'sun') return `${e.start}, tied to the sun`;
  return `${e.time.confidence === 'anchored' ? 'about ' : ''}${e.start}, ${CONF_LABEL[e.time.confidence]}`;
}
