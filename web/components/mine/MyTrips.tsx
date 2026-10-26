'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { removeById, undoRemove } from '@/lib/mine/copies';
import { groupRows, localToday, openHref, rowTitle } from '@/lib/mine/rows';
import type { RowModel } from '@/lib/mine/rows';
import { resolveListing } from '@/lib/mine/listing';
import type { Listing } from '@/lib/mine/listing';
import type { CopyItem, StorageLike } from '@travel/core/schema/copies.ts';
import { CopyRow } from './CopyRow';
import './my-trips.css';

// Change dates reopens the copy sheet, which stays out of the Mine chunk until it is asked for
const CopySheet = dynamic(() => import('@/components/actions/CopySheet').then((m) => m.CopySheet), { ssr: false });

interface Props {
  items: readonly CopyItem[];
  storage: StorageLike;
  /** Signed in: rows carry the "On this device" chip. */
  signedIn: boolean;
  /** Good drafts the one-time move could not fit (`MoveResult.kept`): "N older copies did not fit". */
  didNotFit: number;
  /** Re-read the list after a write (the shell recounts the tab). */
  onChanged: () => void;
}

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Prints the page a copy opens, from a hidden same-origin frame once it has loaded (the print dialog opens over Mine). */
function printOpened(href: string): void {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  f.title = 'Print';
  f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;';
  f.src = href;
  f.addEventListener('load', () => {
    // the trip page builds its print view after it hydrates
    setTimeout(() => {
      try {
        f.contentWindow?.focus();
        f.contentWindow?.print();
      } finally {
        setTimeout(() => f.remove(), 60_000);
      }
    }, 1500);
  });
  document.body.appendChild(f);
}

/** The My trips panel (spec 5.2): Upcoming, Past (collapsed with its count), rows with the menu, Undo for Remove and Change dates. */
export function MyTrips({ items, storage, signedIn, didNotFit, onChanged }: Props) {
  const { toast } = useToast();
  const [today] = useState(() => localToday());
  const [listing, setListing] = useState<Map<string, Listing> | null>(null);
  const [collapsing, setCollapsing] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [editing, setEditing] = useState<CopyItem | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // which trips are still listed, and their current names; a failed answer changes nothing
  const slugKey = items.map((i) => i.slug).sort().join(',');
  useEffect(() => {
    let live = true;
    void resolveListing(items).then((m) => live && setListing(m));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the slugs are the dependency, not the item objects
  }, [slugKey]);

  const groups = useMemo(() => {
    const g = groupRows(items, today);
    const name = (r: RowModel): RowModel => {
      const l = listing?.get(r.item.slug);
      return l?.state === 'listed' && l.title && r.title !== r.item.title ? { ...r, title: l.title } : r;
    };
    return { upcoming: g.upcoming.map(name), past: g.past.map(name) };
  }, [items, today, listing]);
  const flat = useMemo(() => [...groups.upcoming, ...(pastOpen ? groups.past : [])], [groups, pastOpen]);

  // after Remove or Undo, focus goes to a row's link (or the empty state's action)
  useEffect(() => {
    if (!focus) return;
    const el = focus === 'empty' ? root.current?.querySelector<HTMLElement>('.empty a') : root.current?.querySelector<HTMLElement>(`[data-copy-id="${focus}"] .crow-link`);
    el?.focus();
    setFocus(null);
  }, [focus, items]);

  const calendar = useCallback(
    async (r: RowModel) => {
      try {
        const c = await import('@/lib/export/client');
        const d = await c.loadExport('trip', r.item.slug);
        const out = c.downloadIcs(d as Parameters<typeof c.downloadIcs>[0], r.item.start);
        toast({ message: `Downloaded ${out.name} · ${out.summary}` });
      } catch (e) {
        toast({ message: (e as Error)?.name === 'NoCalendarError' ? 'This trip has no day plan to put in a calendar.' : 'Could not build that file. Try again.' });
      }
    },
    [toast],
  );

  const remove = useCallback(
    (r: RowModel) => {
      const at = flat.findIndex((x) => x.item.id === r.item.id);
      const next = flat[at + 1] ?? flat[at - 1] ?? null;
      setCollapsing(r.item.id);
      setTimeout(
        () => {
          const res = removeById(storage, r.item.id);
          setCollapsing(null);
          if (!res.ok) {
            toast({ message: res.reason === 'newer' || res.reason === 'corrupt' || res.reason === 'invalid' ? 'We could not change your trips. Reload the page and try again.' : 'Could not remove that copy. Try again.' });
            return;
          }
          setFocus(next ? next.item.id : 'empty');
          onChanged();
          toast({
            message: `Removed ${r.title} from Mine`,
            actionLabel: 'Undo',
            onAction: () => {
              if (undoRemove(storage, res.removed)) {
                setRestored(res.removed.id);
                setFocus(res.removed.id);
                onChanged();
              } else {
                toast({ message: `Could not put ${r.title} back: you have copied that trip again or the list is full.` });
              }
            },
          });
        },
        reduced() ? 0 : 200,
      );
    },
    [flat, onChanged, storage, toast],
  );

  const rowProps = (r: RowModel) => ({
    row: r,
    unlisted: listing?.get(r.item.slug)?.state === 'unlisted',
    collapsing: collapsing === r.item.id,
    restored: restored === r.item.id,
    chip: signedIn,
    onCalendar: calendar,
    onPrint: (x: RowModel) => printOpened(openHref(x.item)),
    onChangeDates: (x: RowModel) => setEditing(x.item),
    onRemove: remove,
  });

  if (items.length === 0) {
    return (
      <div ref={root}>
        {didNotFit > 0 ? <DidNotFit n={didNotFit} /> : null}
        <EmptyState
          quiet
          glyph="layers"
          title="No trips copied yet"
          why="Open a trip and choose Copy to my trips. It stays here with your dates."
          action={<ButtonLink href="/trips/" variant="primary">Browse trips</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div ref={root} className="mytrips">
      {didNotFit > 0 ? <DidNotFit n={didNotFit} /> : null}
      {groups.upcoming.length ? (
        <section aria-labelledby="mt-up">
          <h2 className="mt-head" id="mt-up">
            <span>Upcoming<span className="sr-only">, {groups.upcoming.length} {groups.upcoming.length === 1 ? 'trip' : 'trips'}</span></span>
            <span className="mt-count" aria-hidden="true">{groups.upcoming.length}</span>
          </h2>
          <ul className="mt-list">
            {groups.upcoming.map((r) => (
              <CopyRow key={r.item.id} {...rowProps(r)} />
            ))}
          </ul>
        </section>
      ) : null}
      {groups.past.length ? (
        <section aria-labelledby="mt-past">
          <h2 className="mt-head mt-head-past" id="mt-past">
            <button type="button" className="mt-toggle" aria-expanded={pastOpen} aria-controls="mt-past-list" onClick={() => setPastOpen((o) => !o)}>
              <Icon name="chevronRight" size={14} className="mt-caret" />
              <span>Past ({groups.past.length})</span>
            </button>
          </h2>
          <div className="mt-fold" id="mt-past-list" data-open={pastOpen || undefined}>
            <ul className="mt-list" inert={!pastOpen || undefined}>
              {groups.past.map((r) => (
                <CopyRow key={r.item.id} {...rowProps(r)} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {editing ? (
        <CopySheet
          trip={{ slug: editing.slug, title: rowTitle(editing), nights: Math.max(0, (editing.days ?? 1) - 1), days: editing.days ?? 1 }}
          open
          initial={{ id: editing.id, start: editing.start, adults: editing.adults, children: editing.children }}
          onClose={() => setEditing(null)}
          onSaved={() => onChanged()}
        />
      ) : null}
    </div>
  );
}

function DidNotFit({ n }: { n: number }) {
  return (
    <Banner kind="notice" className="mt-note">
      {n} older {n === 1 ? 'copy' : 'copies'} did not fit. This device keeps 20.
    </Banner>
  );
}
