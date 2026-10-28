'use client';

// The Stops tab on the person's own trip (STEP2-E6; edit-mode-spec 1 "Stops tab", gap H9). The category rows come from the published plan; the
// person's trip differs from it, so the rows are laid over the timelines the page shows: a stop they removed is not listed, a place they added is,
// and a stop they moved lists the day it is on now. In edit mode every row that is a stop on a day gets the same `⋯` and item sheet as the Days
// tab (the edit chunk's own `trail` slot, so Remove, Move to day…, Add to Maybe and the note go through the same operations and the same Undo).
// The published page never has the context this reads, so it is unchanged. Light on purpose: this file sits in the Stops tab chunk.
import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { categoryOf } from '@/lib/public/taxonomy';
import type { CategoryRowModel, CategorySectionModel } from '@/components/trips/model';
import { useTimelineExtras } from '@/components/trips/timeline/editSlots';
import { peekOwn, placeKindOf, subscribeOwn, type OwnAddable } from '@/lib/export/ownState';
import { peekTimeline, subscribeTimeline } from '@/lib/export/timelineState';
import { printTime } from '@travel/core/export/plan.ts';

export interface OwnStops {
  sections: CategorySectionModel[];
  /** The row's `⋯` while editing, or null. */
  action: ((row: CategoryRowModel) => ReactNode) | undefined;
}

/** Where a place is in the person's days: every entry that is at it, in day order. */
function entriesBySlug(tls: readonly DayTimeline[]): Map<string, { tl: DayTimeline; e: TimelineEntry }[]> {
  const by = new Map<string, { tl: DayTimeline; e: TimelineEntry }[]>();
  for (const tl of [...tls].sort((a, b) => a.day - b.day)) {
    for (const e of tl.entries) {
      const slug = e.at?.placeSlug;
      if (!slug || e.insideOf) continue;
      by.set(slug, [...(by.get(slug) ?? []), { tl, e }]);
    }
  }
  return by;
}

/** The sections laid over the person's days. Pure (the hook below reads the stores). */
export function ownSections(sections: readonly CategorySectionModel[], tls: readonly DayTimeline[], addable: (slug: string) => Pick<OwnAddable, 'name' | 'kind' | 'sub' | 'label'> | undefined, gone: (slug: string) => boolean): CategorySectionModel[] {
  const by = entriesBySlug(tls);
  const listed = new Set(sections.flatMap((s) => s.rows.flatMap((r) => (r.placeSlug ? [r.placeSlug] : []))));
  const out = sections.map((s): CategorySectionModel => {
    const rows = s.rows.flatMap((r): CategoryRowModel[] => {
      if (!r.placeSlug) return [r];
      const at = by.get(r.placeSlug);
      // a stop the person took off the trip is no longer on any day; every other row stays, listed or not on the chosen version (the plan lists all versions)
      if (!at) return gone(r.placeSlug) ? [] : [r];
      const days = [...new Set(at.map((x) => x.tl.day))];
      return [{ ...r, days }];
    });
    return { ...s, rows, count: rows.length };
  });
  // a place the person added: a row in its category, on the day it is on
  const added = new Map<string, { tl: DayTimeline; e: TimelineEntry }[]>();
  for (const [slug, at] of by) if (!listed.has(slug) && at.some((x) => x.e.addedBy === 'visitor')) added.set(slug, at.filter((x) => x.e.addedBy === 'visitor'));
  for (const [slug, at] of added) {
    const a = addable(slug);
    const first = at[0]!;
    const kind = a ? placeKindOf(a) : first.e.kind;
    const cat = categoryOf(kind as Parameters<typeof categoryOf>[0]);
    const section = out.find((s) => s.id === cat) ?? out.find((s) => s.id === 'sights');
    if (!section) continue;
    section.rows = [
      ...section.rows,
      {
        key: `added:${slug}`,
        name: a?.name ?? first.e.title,
        kind,
        placeSlug: slug,
        days: [...new Set(at.map((x) => x.tl.day))],
        time: printTime(first.e, first.tl.blocks),
        area: null,
        detail: a?.label ?? null,
        nights: null,
        bookRule: null,
        bookNote: null,
      },
    ];
    section.count = section.rows.length;
  }
  return out;
}

/** The entry a row's actions apply to: its first day's stop the person can edit. */
export function entryOfRow(row: CategoryRowModel, tls: readonly DayTimeline[], canEdit: (e: TimelineEntry) => boolean): { e: TimelineEntry; day: DayTimeline } | null {
  if (!row.placeSlug) return null;
  const at = entriesBySlug(tls).get(row.placeSlug) ?? [];
  const hit = at.find((x) => canEdit(x.e) && (x.e.kind === 'visit' || x.e.kind === 'trail')) ?? at.find((x) => canEdit(x.e));
  return hit ? { e: hit.e, day: hit.tl } : null;
}

const NONE = () => null;

/** Null on a published trip's page (no own trip, no context). */
export function useOwnStops(sections: CategorySectionModel[]): OwnStops | null {
  const own = useSyncExternalStore(subscribeOwn, peekOwn, NONE);
  const session = useSyncExternalStore(subscribeTimeline, peekTimeline, NONE);
  const extras = useTimelineExtras();
  const tls = session?.timelines;
  const addable = own?.addable;
  const gone = own?.gone;
  const laid = useMemo(() => (extras && tls && addable && gone ? ownSections(sections, tls, addable, gone) : null), [extras, sections, tls, addable, gone]);
  if (!laid || !tls) return null;
  const edit = extras?.edit;
  return {
    sections: laid,
    // while editing every row has the trailing cell (empty for a row that is not a stop on a day) so the columns line up
    action: edit
      ? (row) => {
          const hit = entryOfRow(row, tls, edit.canEdit ?? (() => true));
          return hit ? edit.trail(hit.e, hit.day.entries) : null;
        }
      : undefined,
  };
}
