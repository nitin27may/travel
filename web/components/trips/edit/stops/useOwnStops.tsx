'use client';

// The Stops tab on the person's own trip (STEP2-E6; edit-mode-spec 1 "Stops tab", gap H9). The category rows come from the published plan; the
// person's trip differs from it, so the rows are laid over the timelines the page shows: a stop they removed is not listed, a place they added is,
// and a stop they moved lists the day it is on now. In edit mode every row that is a stop on a day gets the same `⋯` and item sheet as the Days
// tab (the edit chunk's own `trail` slot, so Remove, Move to day…, Add to Maybe and the note go through the same operations and the same Undo).
// The published page never has the context this reads, so it is unchanged. Light on purpose: this file sits in the Stops tab chunk.
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { categoryOf } from '@/lib/public/taxonomy';
import type { CategoryRowModel, CategorySectionModel } from '@/components/trips/model';
import { useTimelineExtras } from '@/components/trips/timeline/editSlots';
import { nameKey, peekOwn, placeKindOf, subscribeOwn, type OwnAddable } from '@/lib/export/ownState';
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
      if (e.insideOf) continue;
      // an area-level stop (Marble Canyon) has no place page: it is joined to its row by name, only for the stops a person can act on
      const slug = e.at?.placeSlug ?? (e.sourceItemId && e.kind !== 'leg' && e.kind !== 'sun' && e.kind !== 'booking' ? `name:${nameKey(e.title)}` : null);
      if (!slug) continue;
      by.set(slug, [...(by.get(slug) ?? []), { tl, e }]);
    }
  }
  return by;
}

/** The key a Stops row is joined to the days by: its place, else its name (stays and logistics rows are not stops on a day). */
export const rowJoin = (row: CategoryRowModel): string | null => (row.placeSlug ? row.placeSlug : row.key.startsWith('stay:') || row.key.startsWith('logistics:') || row.kind === 'stay' || row.kind === 'booking' ? null : `name:${nameKey(row.name)}`);

/** Why a row has no `⋯`, for its accessible label. */
export const noActionsWhy = (row: CategoryRowModel): string =>
  row.key.startsWith('stay:') || row.kind === 'stay'
    ? 'Stays follow your dates and bases, so this row has no actions.'
    : row.key.startsWith('logistics:') || row.kind === 'booking'
      ? 'Travel and booking rows are part of the plan, so this row has no actions.'
      : 'Not a stop on any day of your trip as it stands, so this row has no actions. Add it from a day in the Days tab.';

/** The sections laid over the person's days. Pure (the hook below reads the stores). */
export function ownSections(sections: readonly CategorySectionModel[], tls: readonly DayTimeline[], addable: (slug: string) => Pick<OwnAddable, 'name' | 'kind' | 'sub' | 'label'> | undefined, gone: (slug: string) => boolean, goneName: (nameKey: string) => boolean = () => false): CategorySectionModel[] {
  const by = entriesBySlug(tls);
  const listed = new Set(sections.flatMap((s) => s.rows.flatMap((r) => (r.placeSlug ? [r.placeSlug] : []))));
  const out = sections.map((s): CategorySectionModel => {
    const rows = s.rows.flatMap((r): CategoryRowModel[] => {
      const join = rowJoin(r);
      if (!join) return [r];
      const at = by.get(join);
      // a stop the person took off the trip is no longer on any day; every other row stays, listed or not on the chosen version (the plan lists all versions)
      if (!at) return (r.placeSlug ? gone(r.placeSlug) : goneName(nameKey(r.name))) ? [] : [r];
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
  const join = rowJoin(row);
  if (!join) return null;
  const at = entriesBySlug(tls).get(join) ?? [];
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
  const goneName = own?.goneName;
  const laid = useMemo(() => (extras && tls && addable && gone ? ownSections(sections, tls, addable, gone, goneName) : null), [extras, sections, tls, addable, gone, goneName]);
  if (!laid || !tls) return null;
  const edit = extras?.edit;
  return {
    sections: laid,
    // while editing every row has the trailing cell (empty for a row that is not a stop on a day) so the columns line up
    action: edit
      ? (row) => {
          const hit = entryOfRow(row, tls, edit.canEdit ?? (() => true));
          return hit ? edit.trail(hit.e, hit.day.entries) : <span className="sr-only">{noActionsWhy(row)}</span>;
        }
      : undefined,
  };
}

/** The Stops tab's count from the person's trip (removals and additions applied), or null while the page has not published it: the tab label follows the edits. */
export function useOwnStopCount(published: readonly CategorySectionModel[] | undefined, slug: string | null): number | null {
  const own = useSyncExternalStore(subscribeOwn, peekOwn, NONE);
  const session = useSyncExternalStore(subscribeTimeline, peekTimeline, NONE);
  return useMemo(() => {
    if (!published || !own || !session || !slug || own.slug !== slug || session.slug !== slug) return null;
    return ownSections(published, session.timelines, own.addable, own.gone, own.goneName).reduce((n, s) => n + s.rows.length, 0);
  }, [published, own, session, slug]);
}

/** Renders nothing: reports the count to the page only when it changes. */
export function StopCount({ sections, slug, onCount }: { sections: readonly CategorySectionModel[] | undefined; slug: string | null; onCount: (n: number | null) => void }): null {
  const n = useOwnStopCount(sections, slug);
  useEffect(() => onCount(n), [n, onCount]);
  return null;
}
