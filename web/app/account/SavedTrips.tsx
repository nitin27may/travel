'use client';

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { AccountSection } from './AccountSections';
import { createDraft, renameDraft, deleteDraft, type WriteResult } from './actions';
import { checkTitle, TITLE_MAX, type DraftRow } from '@/lib/drafts-shared';
import { applyOptimistic, commitAction, newestFirst, fetchDrafts, type OptimisticAction, type OptimisticDraft } from '@/lib/drafts-ui';
import { leaveSession } from '@/lib/auth/session-lost';
import { PLAN_DOC_LIMITS } from '@travel/core/config/plans.ts';

/** Rows shown before "{n} more" (spec 6.2). */
const SHOWN = 5;

/** The Undo of a delete met the account's cap (0013's trigger; edit-my-trip 3): say why, not "couldn't". */
export const CAP_NOTICE = `Your account already holds ${PLAN_DOC_LIMITS.accountPlans} trips, the most it can. Remove one in Mine, then try again.`;

function savedLabel(d: Date): string {
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  return `Saved ${date} · ${ago}`;
}

/**
 * Saved trips (spec 6.2): the person's `plan_draft` rows, newest first, five then "{n} more". No create box and no live stream
 * (ACCT-P1, AD7): the list re-reads through the authenticated `/api/account/drafts/` after each own write and when the window gets focus,
 * so a rename on another device shows here when the person comes back. The page never depends on a stream to show its own writes.
 */
export function SavedTrips({ userId, initialRows }: { userId: string; initialRows: DraftRow[] }) {
  const { toast } = useToast();
  // `baseRows` is the server truth: the SSR read for the first paint, then each authenticated re-fetch.
  const [baseRows, setBaseRows] = useState<DraftRow[]>(initialRows);
  const [notice, setNotice] = useState<string | null>(null);
  // Guards against a slow re-fetch landing after a newer one and resurrecting stale rows.
  const fetchSeqRef = useRef(0);

  const refetch = useCallback(async (): Promise<'ok' | 'stale' | 'unauthenticated' | 'failed'> => {
    const result = await fetchDrafts(fetchSeqRef, () => fetch('/api/account/drafts/', { method: 'POST', cache: 'no-store', body: JSON.stringify({ userId }) }));
    switch (result.kind) {
      case 'ok':
        setBaseRows(result.rows);
        setNotice(null);
        break;
      case 'unauthenticated':
        // A session with no user or a different user than the page loaded for: unload (as a 401 would).
        leaveSession();
        break;
      case 'failed':
        setNotice("Couldn't refresh your saved trips. Reload to see the latest.");
        break;
      case 'stale':
        // A newer re-fetch superseded this one; it owns the result.
        break;
    }
    return result.kind;
  }, [userId]);

  // Coming back to the tab or window re-reads the list (a second tab or device may have changed it).
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const [optimistic, setOptimistic] = useState<OptimisticAction[]>([]);
  const applied = useMemo(() => optimistic.reduce<readonly OptimisticDraft[]>((rows, a) => applyOptimistic(rows, a), baseRows.map((r) => ({ ...r }))), [baseRows, optimistic]);
  const drafts = useMemo(() => [...applied].sort(newestFirst), [applied]);

  const [announce, setAnnounce] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Run a write in a transition with its optimistic change on screen, then re-read the real rows under RLS before clearing it (no flicker).
  const mutate = useCallback(
    (action: OptimisticAction, write: () => Promise<WriteResult>, failure: string) => {
      setNotice(null);
      startTransition(async () => {
        setOptimistic((q) => [...q, action]);
        const clear = () => setOptimistic((q) => q.filter((a) => a !== action));
        let result: WriteResult;
        try {
          result = await write();
        } catch {
          setNotice(failure);
          clear();
          return;
        }
        if (result.kind === 'rejected') {
          if (result.reason === 'UNAUTHENTICATED') leaveSession();
          else setNotice(result.reason === 'CAP' ? CAP_NOTICE : failure);
          clear();
          return;
        }
        if (result.kind === 'unchanged') {
          clear();
          void refetch();
          return;
        }
        const outcome = await refetch();
        if (outcome === 'unauthenticated') return; // the page is unloading
        if (outcome !== 'ok') {
          // The write committed but the re-read failed or was superseded: fold the known change into the snapshot so it stays visible.
          setBaseRows((rows) => commitAction(rows, action));
        }
        clear();
      });
    },
    [refetch],
  );

  function onRename(id: string, raw: string) {
    const c = checkTitle(raw);
    setRenamingId(null);
    if (!c.ok) return;
    setAnnounce(`Renamed to ${c.title}`);
    mutate({ type: 'rename', id, title: c.title }, () => renameDraft(userId, { id, title: c.title }), `Couldn't rename the trip.`);
  }

  function onDelete(d: DraftRow) {
    setConfirmingId(null);
    setAnnounce('Trip removed. Undo available.');
    mutate({ type: 'delete', id: d.id }, () => deleteDraft(userId, { id: d.id }), `Couldn't delete the trip.`);
    toast({
      message: 'Trip removed.',
      actionLabel: 'Undo',
      onAction: () => mutate({ type: 'add', draft: d }, () => createDraft(userId, { id: d.id, title: d.title }), `Couldn't restore the trip.`),
    });
  }

  const visible = expanded ? drafts : drafts.slice(0, SHOWN);
  const more = drafts.length - visible.length;

  return (
    <AccountSection id="saved-trips" title="Saved trips" count={drafts.length} className="acct-saved">
      {notice ? <Banner kind="notice">{notice}</Banner> : null}
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          glyph="list"
          as="h3"
          title="No saved trips yet."
          why="Trips you copy or build while signed in are saved here."
          action={<ButtonLink href="/trips/">Browse trips</ButtonLink>}
        />
      ) : (
        <>
          <ul className="account-list">
            {visible.map((d) => (
              <li key={d.id} className="draft-row" data-pending={d.pending || undefined}>
                {renamingId === d.id ? (
                  <RenameField initial={d.title} onSave={(v) => onRename(d.id, v)} onCancel={() => setRenamingId(null)} />
                ) : confirmingId === d.id ? (
                  <div className="draft-confirm">
                    <span className="draft-confirm-q">Delete &ldquo;{d.title}&rdquo;?</span>
                    <div className="draft-confirm-actions">
                      <Button variant="danger" size="sm" onClick={() => onDelete(d)}>
                        Delete
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="draft-main">
                      <span className="draft-title">{d.title}</span>
                      <span className="draft-meta" suppressHydrationWarning>
                        {savedLabel(d.updated_at)}
                      </span>
                    </div>
                    <Menu
                      triggerClassName="btn btn-ghost btn-icon draft-menu-trigger"
                      triggerLabel="Draft actions"
                      trigger={<span aria-hidden="true">&hellip;</span>}
                      align="end"
                      entries={[
                        { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(d.id) },
                        { label: 'Delete', destructive: true, separatorBefore: true, onSelect: () => setConfirmingId(d.id) },
                      ]}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
          {drafts.length > SHOWN ? (
            <Button variant="ghost" className="acct-more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show fewer' : `${more} more`}
            </Button>
          ) : null}
        </>
      )}
    </AccountSection>
  );
}

function RenameField({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const c = checkTitle(v);
  const tooLong = !c.ok && c.reason === 'too_long';
  return (
    <form
      className="draft-rename"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooLong) onSave(v);
      }}
    >
      <Field label="Rename draft" required error={tooLong ? `Keep the title under ${TITLE_MAX} characters.` : undefined} className="draft-rename-field">
        {(a) => (
          <Input
            autoFocus
            value={v}
            error={tooLong}
            maxLength={400}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
            {...a}
          />
        )}
      </Field>
      <div className="draft-confirm-actions">
        <Button type="submit" size="sm" variant="primary" disabled={!c.ok}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
