'use client';

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import type { FormEvent } from 'react';
import type { SealedLiveQuery } from '@neon/realtime/client';
// @neon/realtime-react has no "use client" directive in its build: import it only from client modules.
import { useLiveQuery } from '@neon/realtime-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { RealtimeRoot } from './RealtimeRoot';
import { createDraft, renameDraft, deleteDraft, type WriteResult } from './actions';
import { checkTitle, TITLE_MAX, type DraftRow, type SignalRow } from '@/lib/drafts-shared';
import { applyOptimistic, commitAction, newestFirst, fetchDrafts, type OptimisticAction, type OptimisticDraft } from '@/lib/drafts-ui';
import { renewOrLeave, leaveSession } from '@/lib/auth/session-lost';

const SYNC_TIMEOUT_MS = 10_000;

function savedLabel(d: Date): string {
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  return `Saved ${date} \u00b7 ${ago}`;
}

export function AccountDrafts(props: { userId: string; initialRows: DraftRow[]; sealedQuery: SealedLiveQuery<SignalRow>; realtimeUrl: string }) {
  return (
    <RealtimeRoot url={props.realtimeUrl}>
      <DraftList userId={props.userId} initialRows={props.initialRows} sealedQuery={props.sealedQuery} />
    </RealtimeRoot>
  );
}

function DraftList({ userId, initialRows, sealedQuery }: { userId: string; initialRows: DraftRow[]; sealedQuery: SealedLiveQuery<SignalRow> }) {
  // Keep the first sealed query; useLiveQuery restarts on a new object, and every server re-render sends one.
  const [query] = useState(sealedQuery);
  const { toast } = useToast();

  const refreshQuery = useCallback(
    () => renewOrLeave<SealedLiveQuery<SignalRow>>(() => fetch('/api/account/live-query/', { method: 'POST', cache: 'no-store', body: JSON.stringify({ userId }) })),
    [userId],
  );

  // The live subscription watches only the content-free signal stream (user id + monotonic version).
  // Neon Realtime rejects any RLS relation, so draft content never travels over it; the rows come from
  // an authenticated re-fetch under RLS whenever the version advances.
  const { data, status, utils } = useLiveQuery(query, { refreshQuery });

  // `baseRows` is the server truth: the SSR read for the first paint, then each authenticated re-fetch.
  const [baseRows, setBaseRows] = useState<DraftRow[]>(initialRows);
  const [notice, setNotice] = useState<string | null>(null);
  // Guards against a slow re-fetch landing after a newer one and resurrecting stale rows.
  const fetchSeqRef = useRef(0);

  const refetch = useCallback(async (): Promise<'ok' | 'stale' | 'unauthenticated' | 'failed'> => {
    const result = await fetchDrafts(fetchSeqRef, () =>
      fetch('/api/account/drafts/', { method: 'POST', cache: 'no-store', body: JSON.stringify({ userId }) }),
    );
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
        setNotice("Couldn't refresh your drafts. Reload to see the latest.");
        break;
      case 'stale':
        // A newer re-fetch superseded this one; it owns the result.
        break;
    }
    return result.kind;
  }, [userId]);

  // The current signal version for this user (a bigint delivered as a string), or null before the first
  // signal exists (a user who has never written has no signal row yet).
  const version = data && data.length > 0 ? data[0].version : null;
  const lastVersionRef = useRef<string | null>(null);
  useEffect(() => {
    if (version === null || lastVersionRef.current === version) return;
    lastVersionRef.current = version;
    void refetch();
  }, [version, refetch]);

  const optimisticBase = useMemo<OptimisticDraft[]>(() => baseRows.map((r) => ({ ...r })), [baseRows]);
  const [optimistic, setOptimistic] = useState<OptimisticAction[]>([]);
  const applied = useMemo(() => optimistic.reduce<readonly OptimisticDraft[]>((rows, a) => applyOptimistic(rows, a), optimisticBase), [optimisticBase, optimistic]);
  const drafts = useMemo(() => [...applied].sort(newestFirst), [applied]);

  const [announce, setAnnounce] = useState('');
  const [title, setTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const createRef = useRef<HTMLInputElement>(null);

  const titleCheck = checkTitle(title);
  const titleTooLong = !titleCheck.ok && titleCheck.reason === 'too_long';

  // Run a write in a transition, hold the optimistic change until its txid lands on the signal stream,
  // then re-fetch the authoritative rows under RLS before clearing the optimistic layer (no flicker).
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
          else setNotice(failure);
          clear();
          return;
        }
        if (result.kind === 'unchanged') {
          clear();
          return;
        }
        // The signal row shares the write's transaction (a SECURITY DEFINER trigger bumps it), so its
        // txid lands on the stream once the write is durable; then pull the real rows under RLS.
        let outcome: 'ok' | 'stale' | 'unauthenticated' | 'failed' = 'failed';
        try {
          await utils.awaitTxId(result.txid, SYNC_TIMEOUT_MS);
          outcome = await refetch();
        } catch {
          // awaitTxId timed out. The write is durable (we hold its txid), so fall through to fold it in.
          outcome = 'failed';
        }
        if (outcome === 'unauthenticated') {
          // The page is unloading; do not touch state.
          return;
        }
        if (outcome !== 'ok') {
          // The re-fetch failed, timed out, or was superseded, but the write committed: fold the known
          // change into the server-truth snapshot so the committed item stays visible, and say so.
          setBaseRows((rows) => commitAction(rows, action));
          setNotice('Saved. The live list could not refresh — reload to see the latest.');
        }
        clear();
      });
    },
    [utils, refetch],
  );

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const c = checkTitle(title);
    if (!c.ok) return;
    const draft: DraftRow = { id: crypto.randomUUID(), title: c.title, created_at: new Date(), updated_at: new Date() };
    setTitle('');
    setAnnounce(`Draft "${c.title}" added`);
    mutate({ type: 'add', draft }, () => createDraft(userId, { id: draft.id, title: c.title }), `Couldn't save "${c.title}".`);
    createRef.current?.focus();
  }

  function onRename(id: string, raw: string) {
    const c = checkTitle(raw);
    if (!c.ok) {
      setRenamingId(null);
      return;
    }
    setRenamingId(null);
    setAnnounce(`Renamed to ${c.title}`);
    mutate({ type: 'rename', id, title: c.title }, () => renameDraft(userId, { id, title: c.title }), `Couldn't rename the draft.`);
  }

  function onDelete(d: DraftRow) {
    setConfirmingId(null);
    setAnnounce('Draft removed. Undo available.');
    mutate({ type: 'delete', id: d.id }, () => deleteDraft(userId, { id: d.id }), `Couldn't delete the draft.`);
    toast({
      message: 'Draft removed.',
      actionLabel: 'Undo',
      onAction: () => mutate({ type: 'add', draft: d }, () => createDraft(userId, { id: d.id, title: d.title }), `Couldn't restore the draft.`),
    });
  }

  const reconnecting = status === 'connecting' || status === 'stale';
  const errored = status === 'error';

  return (
    <section className="account-drafts" aria-label="Your drafts">
      <form className="draft-create" onSubmit={onCreate} noValidate>
        <Field label="Draft title" required help="A short name only." error={titleTooLong ? `Keep the title under ${TITLE_MAX} characters.` : undefined} className="draft-create-field">
          {(a) => <Input ref={createRef} name="title" value={title} onChange={(e) => setTitle(e.target.value)} error={titleTooLong} maxLength={400} {...a} />}
        </Field>
        <Button type="submit" variant="primary" disabled={!titleCheck.ok}>
          Create draft
        </Button>
      </form>

      <p className="draft-status">
        {errored ? null : reconnecting ? null : (
          <>
            <span className="live-dot" aria-hidden="true" /> Live
          </>
        )}
      </p>

      {reconnecting ? <Banner kind="notice">Reconnecting to live updates&hellip;</Banner> : null}
      {notice ? <Banner kind="notice">{notice}</Banner> : null}

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {errored ? (
        <div className="errb" role="alert">
          <Icon name="warn" size={20} />
          <div className="errb-body">
            <p className="errb-title">Live updates stopped.</p>
            <p className="errb-detail">Your drafts are still saved. Reload to reconnect.</p>
            <Button size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState glyph="list" title="No drafts yet." why="Create your first draft above." />
      ) : (
        <ul className="account-list">
          {drafts.map((d) => (
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
                    <span className="draft-meta">{savedLabel(d.updated_at)}</span>
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
      )}
    </section>
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
