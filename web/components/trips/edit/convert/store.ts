// Two small pieces of state the Make it yours card and the Settings sheet share (STEP2-B3). Nothing here is the trip: the trips whose card
// was dismissed (a device note, never synced, at most 60), and the section a card link asked Settings to open.
import { readLocal, writeLocal } from '@/lib/storage/safe';

export const SEEN_KEY = 'travel.make-yours.seen';
const CAP = 60;

const read = (): string[] => {
  try {
    const v: unknown = JSON.parse(readLocal(SEEN_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** The card was dismissed (or the person began to change the trip) for this trip. */
export const isSeen = (id: string): boolean => read().includes(id);
export function markSeen(id: string): void {
  const ids = read();
  if (!ids.includes(id)) writeLocal(SEEN_KEY, JSON.stringify([...ids, id].slice(-CAP)));
}

/** The engine sections of Settings a copy can ask for: `start` is "Where you start" on a trip near home and "Getting there" on a trip by air. */
export type EngineSection = 'where' | 'days' | 'bases' | 'start';
let wanted: EngineSection | null = null;
/** A link on the card asks the next Settings sheet to open at this section. */
export const askSection = (s: EngineSection | null): void => {
  wanted = s;
};
export const takeSection = (): EngineSection | null => {
  const s = wanted;
  wanted = null;
  return s;
};
