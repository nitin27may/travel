'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { writeSession } from '@/lib/storage/safe';
import { removeById, undoRemove } from '@/lib/mine/copies';
import type { WriteFailure } from '@/lib/mine/copies';
import { PRINT_KEY } from '@/lib/mine/keys';
import { groupRows, localToday, openHref, rowTitle } from '@/lib/mine/rows';
import type { RowModel } from '@/lib/mine/rows';
import { resolveListing } from '@/lib/mine/listing';
import type { Listing } from '@/lib/mine/listing';
import type { CopyItem, StorageLike } from '@travel/core/schema/copies.ts';
import { formatDate } from '@/lib/export/dates';
import type { AccountSync, SyncSnapshot } from '@/lib/mine/sync';
import { chipsBare, retryAnnouncement } from '@/lib/mine/chips';
import type { RowChip } from '@/lib/mine/chips';
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
  /**
   * The `accountTrips` flag on and signed in (edit-my-trip): the account's trips are in `items`, synced by `engine`; `deviceIds` are the
   * device copies the account does not hold yet. Rows then draw the sync chips instead of the plain "On this device".
   */
  acct?: { engine: AccountSync; snap: SyncSnapshot; deviceIds: ReadonlySet<string> };
}

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The My trips panel (spec 5.2): Upcoming, Past (collapsed with its count), rows with the menu, Undo for Remove and Change dates. */
export function MyTrips({ items, storage, signedIn, didNotFit, onChanged, acct }: Props) {
  const { toast } = useToast();
  const [today] = useState(() => localToday());
  const [listing, setListing] = useState<Map<string, Listing> | null>(null);
  const [collapsing, setCollapsing] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [editing, setEditing] = useState<CopyItem | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  // where focus goes once the list has re-rendered after Remove or Undo; a ref, so no state is set from an effect
  const focusNext = useRef<{ id: string | null } | null>(null);
  const router = useRouter();
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

  // each row's sync state; with one state on every row that the card line already says, no row draws a chip (SF10)
  const stateOf = useCallback(
    (id: string): RowChip => (acct ? (acct.deviceIds.has(id) ? 'device' : (acct.snap.rows[id]?.state ?? 'quiet')) : 'quiet'),
    [acct],
  );
  const bare = useMemo(() => (acct ? chipsBare(items.map((i) => stateOf(i.id))) : false), [acct, items, stateOf]);

  // a row that becomes "Not synced" is said once, by name, in this list's polite region (SF11); syncing and the way back say nothing
  const [rowSaid, setRowSaid] = useState('');
  const seenStates = useRef<Map<string, RowChip> | null>(null);
  useEffect(() => {
    if (!acct) return;
    const now = new Map(items.map((i) => [i.id, stateOf(i.id)] as const));
    const before = seenStates.current;
    seenStates.current = now;
    if (!before) return;
    const turned = groups.upcoming.concat(groups.past).filter((r) => now.get(r.item.id) === 'retry' && before.get(r.item.id) !== 'retry');
    if (turned.length) setRowSaid(turned.map((r) => retryAnnouncement(r.title)).join(' '));
  }, [acct, items, stateOf, groups]);

  // M5: one toast when the sign-in merge moved trips into the account; nothing when nothing moved
  const added = acct?.snap.merge?.added ?? 0;
  const mergeSeen = useRef<unknown>(null);
  const mergeNow = acct?.snap.merge ?? null;
  useEffect(() => {
    if (!mergeNow || mergeSeen.current === mergeNow) return;
    mergeSeen.current = mergeNow;
    if (added > 0) toast({ message: `${added} ${added === 1 ? 'trip' : 'trips'} added to your account` });
  }, [mergeNow, added, toast]);

  // after Remove or Undo focus goes to a row's link; with no row left, to the Past toggle, the empty state's action, then the Mine tab
  useEffect(() => {
    const want = focusNext.current;
    if (!want) return;
    focusNext.current = null;
    const q = (sel: string) => root.current?.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(sel);
    const el = (want.id ? q(`[data-copy-id="${want.id}"] .crow-link`) : null) ?? q('#mt-past .mt-toggle') ?? q('.empty a') ?? q('#mine-tab-trips');
    el?.focus();
  }, [items]);

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

  /** Undo of an account Remove (or of "removed on another device"): the tombstone is cleared and the trip comes back. */
  const putBack = async (id: string, title: string) => {
    const res = await acct?.engine.undoRemove(id);
    if (res?.ok) {
      setRestored(id);
      focusNext.current = { id };
      return;
    }
    toast({
      message:
        res?.reason === 'offline'
          ? `Could not put ${title} back: you are offline.`
          : res?.reason === 'full'
            ? `Could not put ${title} back: your account is full.`
            : `Could not put ${title} back.`,
    });
  };

  const remove = useCallback(
    (r: RowModel) => {
      const at = flat.findIndex((x) => x.item.id === r.item.id);
      const next = flat[at + 1] ?? flat[at - 1] ?? null;
      setCollapsing(r.item.id);
      // a trip kept in the account is removed as a tombstone, with an Undo that restores it (edit-my-trip 4.5)
      if (acct && !acct.deviceIds.has(r.item.id)) {
        setTimeout(
          () => {
            const res = acct.engine.remove(r.item.id);
            setCollapsing(null);
            if (!res) {
              toast({ message: 'Could not remove that trip. Try again.' });
              return;
            }
            focusNext.current = { id: next ? next.item.id : null };
            toast({
              message: `Removed ${r.title} from Mine`,
              actionLabel: 'Undo',
              onAction: () => void putBack(r.item.id, r.title),
            });
          },
          reduced() ? 0 : 200,
        );
        return;
      }
      setTimeout(
        () => {
          let res = removeById(storage, r.item.id);
          // another tab wrote between our read and our write: read again and retry once, silently
          if (!res.ok && res.reason === 'changed') res = removeById(storage, r.item.id);
          setCollapsing(null);
          if (!res.ok) {
            toast({ message: failMessage(res.reason) });
            return;
          }
          focusNext.current = { id: next ? next.item.id : null };
          onChanged();
          toast({
            message: `Removed ${r.title} from Mine`,
            actionLabel: 'Undo',
            onAction: () => {
              if (undoRemove(storage, res.removed)) {
                setRestored(res.removed.id);
                focusNext.current = { id: res.removed.id };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `putBack` is built from `acct` and `toast`, already listed
    [flat, onChanged, storage, toast, acct],
  );

  const rowProps = (r: RowModel) => ({
    row: r,
    unlisted: listing?.get(r.item.slug)?.state === 'unlisted',
    collapsing: collapsing === r.item.id,
    restored: restored === r.item.id,
    ...(acct
      ? {
          sync: {
            state: stateOf(r.item.id),
            bare,
            // focus moves to the row's link as the chip goes (the button is replaced); if the rounds fail again it goes back to Retry
            onRetry: () => {
              focusNext.current = { id: r.item.id };
              void acct.engine.retry(r.item.id).then(() => {
                if (acct.engine.snapshot().rows[r.item.id]?.state === 'retry') root.current?.querySelector<HTMLElement>(`[data-copy-id="${r.item.id}"] .crow-retry`)?.focus();
              });
            },
          },
        }
      : { chip: signedIn }),
    onCalendar: calendar,
    // one-shot hand-off (spec 5.2): the trip page's export menu reads it, prints its print view, and removes it. Never a URL key; with storage
    // blocked the write fails and Print simply opens the trip, where Export > PDF is one tap away
    onPrint: (x: RowModel) => {
      writeSession(PRINT_KEY, x.item.slug);
      router.push(openHref(x.item));
    },
    onChangeDates: (x: RowModel) => setEditing(x.item),
    onRemove: remove,
  });

  const notices = acct ? (
    <div className="mt-notices">
      {acct.snap.notices.map((n, i) => (
        <Banner
          key={`${n.kind}-${n.id}-${i}`}
          kind="notice"
          action={
            <>
              {n.kind === 'removed' ? (
                <Button size="sm" onClick={() => void putBack(n.id, n.title)}>
                  Undo
                </Button>
              ) : null}
              <Button size="sm" onClick={() => acct.engine.dismissNotice(i)}>
                OK
              </Button>
            </>
          }
        >
          {n.kind === 'removed'
            ? `${n.title} was removed on another device. ${n.count === 1 ? '1 change' : `${n.count} changes`} you made here ${n.count === 1 ? 'was' : 'were'} not sent.`
            : `${n.count === 1 ? '1 change' : `${n.count} changes`} to ${n.title} ${n.count === 1 ? 'was' : 'were'} not applied: ${n.reasons.includes('gone') ? 'something it changed was removed on another device' : 'it no longer fits the plan'}.`}
        </Banner>
      ))}
    </div>
  ) : null;

  if (items.length === 0) {
    return (
      <div ref={root}>
        {notices}
        {didNotFit > 0 ? <DidNotFit n={didNotFit} /> : null}
        <EmptyState
          quiet
          glyph="layers"
          title="No trips yet"
          why="Copy one of our trips. It stays here."
          action={<ButtonLink href="/trips/" variant="primary">Browse trips</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div ref={root} className="mytrips">
      {acct ? (
        <div className="sr-only" aria-live="polite">
          {rowSaid}
        </div>
      ) : null}
      {notices}
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
          commit={
            acct && !acct.deviceIds.has(editing.id)
              ? (c) => {
                  const r = acct.engine.changeDates(editing.id, c);
                  if (!r.ok) return false;
                  toast({
                    message: `${rowTitle(editing)} now starts ${formatDate(c.start)}`,
                    actionLabel: 'Undo',
                    onAction: () => void acct.engine.undo(editing.id, r.inverse),
                  });
                  return true;
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

/** The Remove toast's words for each reason a write was refused (NAV-R2 should 6). */
function failMessage(reason: WriteFailure): string {
  if (reason === 'quota') return 'This browser is out of space for this site, so nothing was written.';
  if (reason === 'changed') return 'Your trips changed in another tab. Try again.';
  if (reason === 'blocked' || reason === 'unverified') return 'This browser is not keeping data, so nothing was written.';
  if (reason === 'newer' || reason === 'corrupt' || reason === 'invalid') return 'We could not change your trips. Reload the page and try again.';
  return 'Could not remove that copy. Try again.';
}

function DidNotFit({ n }: { n: number }) {
  return (
    <Banner kind="notice" className="mt-note">
      {n} older {n === 1 ? 'copy' : 'copies'} did not fit. This device keeps 20.
    </Banner>
  );
}
