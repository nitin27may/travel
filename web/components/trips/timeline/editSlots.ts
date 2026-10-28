'use client';

// The slots your own trip fills in the timeline (STEP2-E1; components 4.3 "Slots on your own trip", patterns 3.13). The public page never
// provides this context, so its entries are unchanged. Two parts: `marks` (words under a stop's title, read mode too, from the document)
// and `edit` (what edit mode adds, from the lazy edit chunk). The other E packages fill the empty members: E2 `handle`, E3 `addPicker`,
// E4 `dayMenu`, E5 `dayStatus`.
import { createContext, useContext, type ReactNode } from 'react';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';

export interface EditSlots {
  /** The leading handle (E2, drag). Not drawn until a package fills it. */
  handle?: (e: TimelineEntry) => ReactNode;
  /** The trailing `⋯` button of a stop (components 8.7). */
  trail: (e: TimelineEntry, dayEntries: readonly TimelineEntry[]) => ReactNode;
  /** Which entries get the `⋯` (STEP2-E1B: the rows the rules made too); absent, the stops only. */
  canEdit?: (e: TimelineEntry) => boolean;
  /** The day header's `⋯` (E4). */
  dayMenu?: (day: number) => ReactNode;
  /** Warnings and status under a day header (E5). */
  dayStatus?: (day: number) => ReactNode;
  /** Replaces the inline add panel of a day with the picker (E3): the node is the "Add a place to Day n" row. */
  addPicker?: (day: number) => ReactNode;
}
export interface TimelineExtras {
  /** The marks of an entry, in words (at most two are shown). */
  marks?: (e: TimelineEntry) => string[];
  edit?: EditSlots;
  /** Edit tools at the right end of the sticky day bar from 640 px: Undo, Redo, changes, Settings, Done (patterns 3.13 item 4). */
  tools?: ReactNode;
}

export const TimelineExtrasContext = createContext<TimelineExtras | null>(null);
export const useTimelineExtras = (): TimelineExtras | null => useContext(TimelineExtrasContext);
