// What the drag code needs to know about the rows on the page, read from the page itself so the timeline files stay as E1 left them.
// Each handle writes its entry here when it renders (the slot gives it the entry); the stops of a day in time order come from the DOM:
// the rows with `data-edit="stop"` are the stops that move (rule rows are `data-edit="rule"`: no handle, not a slot), and `data-entry` is "<day>:<id>".
import type { TimelineEntry } from '@travel/core/schedule/types.ts';

const entries = new Map<string, TimelineEntry>();
export const keyOf = (e: { day: number; id: string }): string => `${e.day}:${e.id}`;
export const remember = (e: TimelineEntry): void => void entries.set(keyOf(e), e);
export const entryFor = (key: string): TimelineEntry | undefined => entries.get(key);
export const parseKey = (key: string): { day: number; id: string } => {
  const i = key.indexOf(':');
  return { day: Number(key.slice(0, i)), id: key.slice(i + 1) };
};

/** The stop rows of a day, in page order. */
export const stopRows = (day: number): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(`#day-${day} li.tl-entry[data-edit="stop"]`)];
/** The days on the page, in order. */
export const dayNumbers = (): number[] => [...document.querySelectorAll<HTMLElement>('li.tl-day[id^="day-"]')].map((d) => Number(d.id.slice(4)));
/** The entries of a day's stop rows (the ones the handles have registered), in page order. */
export const stopEntries = (day: number): TimelineEntry[] => stopRows(day).flatMap((li) => {
  const e = entries.get(li.dataset.entry ?? '');
  return e ? [e] : [];
});
