'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAnnouncer } from '@/components/auth/live';
import { PLAN_DOC_LIMITS } from '@travel/core/config/plans.ts';
import { markSeen } from '@/lib/mine/dot';
import { ACCOUNT_TRIPS_ON } from '@/lib/mine/flag';
import { CHANGED_EVENT } from '@/lib/mine/keys';
import { useAccountTrips } from '@/lib/mine/useSync';
import { deviceCount } from '@/lib/mine/deviceList';
import type { DraftFacts } from '@/lib/mine/deviceList';
import { PLANS_KEY } from '@/lib/plan/keys';
import type { AccountSync, SyncSnapshot } from '@/lib/mine/sync';
import { FAVOURITES_ON } from '@/lib/favourites/flag';
import { HeartGlyph } from '@/lib/favourites/glyph';
import type { CopyItem, StorageLike } from '@travel/core/schema/copies.ts';
import type { MineTab, Overview } from '@/lib/mine/overview';
import { AccountCard } from './AccountCard';
import { DeviceNotice } from './DeviceNotice';
import { MineTabs } from './MineTabs';

// the rows, the menu and the copy readers load after the shell paints (Zod stays out of the page's start chunk)
const MyTrips = dynamic(() => import('@/components/mine/MyTrips').then((m) => m.MyTrips), { ssr: false });
const FavouritesPanel = dynamic(() => import('@/components/mine/FavouritesPanel').then((m) => m.FavouritesPanel), { ssr: false });

type Loaded = { overview: Overview; blocked: boolean; tab: MineTab; didNotFit: number };
type Data = typeof import('@/lib/mine/data');

/**
 * The plans the builder keeps on this device (STEP2-P2): read only when the key holds something, so the plan document's schema never
 * loads for a visitor with none. An unreadable list is left as it is and adds no rows (the copies list carries the error state).
 */
async function readDrafts(storage: StorageLike): Promise<DraftFacts[]> {
  try {
    if (storage.getItem(PLANS_KEY) === null) return [];
    const m = await import('@/lib/plan/device');
    const r = m.readDeviceDrafts(storage);
    return r.ok ? r.items : [];
  } catch {
    return [];
  }
}
// the core readers (and Zod) load after the shell paints, so the page's start chunk stays small
const data = (): Promise<Data> => import('@/lib/mine/data');

/** A list the browser holds but this version cannot read: a newer one (reload) or a damaged one (left as it is). Never written to. */
function Unreadable({ what, reason }: { what: string; reason: 'corrupt' | 'newer' | 'invalid' }) {
  if (reason === 'newer') {
    return (
      <EmptyState
        quiet
        glyph="warn"
        title="This list was written by a newer version of the site"
        why="Reload the page to see it. Nothing has been changed."
        action={
          <Button variant="primary" onClick={() => location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }
  return <EmptyState quiet glyph="warn" title={`We couldn't read your ${what}`} why="The list in this browser is damaged. It has been left exactly as it is." />;
}

/**
 * The Mine shell (NAV-1): account card, tabs with counts, the two panels and the device notice. It reads both lists through the core
 * readers and shows counts and the empty states. NAV-2 puts the My trips rows into `TripsPanel` and FAV-1 the Favourites rows into
 * `FavouritesPanel`; until then a kept item is a plain link so nothing the visitor holds is hidden.
 */
export function MineShell({ signIn }: { signIn: boolean }) {
  const [state, setState] = useState<Loaded | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionKnown, setSessionKnown] = useState(false);
  const [signedOutUnsent, setSignedOutUnsent] = useState(0);
  const [snoozed, setSnoozed] = useState(false);
  const [moved, setMoved] = useState(false);
  const [d, setD] = useState<Data | null>(null);
  const [drafts, setDrafts] = useState<DraftFacts[]>([]);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void data().then((m) => {
      if (!live) return;
      const probe = m.mineStorage();
      // the old key's drafts move into the envelope once per device, before the first read (NAV-2C); `kept` is what did not fit
      const mv = m.moveLegacyOnce(probe.storage);
      const overview = m.readOverview(probe.storage);
      m.pruneOrphanEdits(probe.storage, overview);
      const asked = m.parseShow(new URLSearchParams(location.search).get('show'));
      setD(m);
      setState({ overview, blocked: probe.kind === 'memory', tab: asked ?? m.defaultTab(overview), didNotFit: mv.status === 'moved' ? mv.kept : 0 });
      markSeen();
      void readDrafts(probe.storage).then((x) => live && setDrafts(x));
    });
    return () => {
      live = false;
    };
  }, []);

  // another tab changed a list: read again (the dot does the same)
  useEffect(() => {
    if (!d) return;
    const on = () => {
      setState((s) => (s ? { ...s, overview: d.readOverview(d.mineStorage().storage) } : s));
      void readDrafts(d.mineStorage().storage).then(setDrafts);
    };
    addEventListener('storage', on);
    return () => removeEventListener('storage', on);
  }, [d]);

  useEffect(() => {
    if (!signIn) return;
    let live = true;
    void import('@/lib/auth/client')
      .then(({ getAuthClient }) => getAuthClient().getSession())
      .then((r) => {
        const u = (r as { data?: { user?: { id?: string; email?: string } } } | null)?.data?.user;
        if (live && u?.email) setEmail(u.email);
        if (live && u?.id) setUserId(u.id);
        // signed in: seed this browser's party from the account (ACCT-P2, spec 5.2); a lazy chunk that Mine alone loads
        if (live && u?.id) void import('@/lib/account/seed-party').then((mod) => mod.seedFromAccount(u.id as string));
      })
      .catch(() => {})
      .finally(() => live && setSessionKnown(true));
    return () => {
      live = false;
    };
  }, [signIn]);

  // the account's trips (edit-my-trip, flag `accountTrips`): synced while Mine is open
  const acct = useAccountTrips(userId, ACCOUNT_TRIPS_ON && signIn);
  const { region, announce } = useAnnouncer();
  const counts = useMemo(
    () => ({
      trips: acct.snap ? deviceCount(mergedTrips(state?.overview.copies, acct.snap).items, drafts) : state?.overview.copies.ok ? deviceCount(state.overview.copies.items, drafts) : null,
      favourites: state?.overview.favourites.ok ? state.overview.favourites.items.length : null,
    }),
    [state, acct.snap, drafts],
  );

  // a write in this tab (Remove, Undo, Change dates): read both lists again
  const reread = () => {
    setState((s) => (s && d ? { ...s, overview: d.readOverview(d.mineStorage().storage) } : s));
    if (d) void readDrafts(d.mineStorage().storage).then(setDrafts);
  };

  // the merge of device copies writes the copies envelope in this tab, so the list is read again when it says so
  useEffect(() => {
    if (!d || !ACCOUNT_TRIPS_ON) return;
    addEventListener(CHANGED_EVENT, reread);
    return () => removeEventListener(CHANGED_EVENT, reread);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reread` only reads through `d`
  }, [d]);
  const spoken = useRef('');
  const saying = acct.snap?.announce ?? '';
  useEffect(() => {
    if (saying === spoken.current) return;
    announce(saying || 'All changes are in your account.');
    spoken.current = saying;
  }, [saying, announce]);
  // signed out with changes still waiting (the session ended): the card says so, and they send on sign-in (edit-my-trip 4.6)
  useEffect(() => {
    if (!ACCOUNT_TRIPS_ON || !signIn || !sessionKnown || email) return;
    let live = true;
    void import('@/lib/mine/signout').then((m) => live && setSignedOutUnsent(m.unsentSummary(m.mineStorage().storage).count));
    return () => {
      live = false;
    };
  }, [signIn, sessionKnown, email]);

  const choose = (tab: MineTab) => {
    setMoved(true);
    setState((s) => (s ? { ...s, tab } : s));
    const url = new URL(location.href);
    url.searchParams.set('show', tab);
    history.replaceState(history.state, '', url);
  };

  const showNotice = !!state && !!d && !email && !snoozed && d.noticeDue(state.overview, new Date());
  const note = accountNote(acct.snap, state ? mergedTrips(state.overview.copies, acct.snap).deviceIds.size : 0, signedOutUnsent, !!email);

  return (
    <div className="mine">
      {region}
      <AccountCard signIn={signIn} email={email} note={note} />
      <noscript>
        <p className="mine-card-note">Mine reads what this browser keeps, so it needs JavaScript.</p>
      </noscript>
      <div className="mine-body" aria-busy={state ? undefined : true}>
        {state ? (
          <>
            {state.blocked ? (
              <Banner
                kind="notice"
                className="mine-notice"
                action={signIn ? <ButtonLink href="/sign-in/?next=%2Fmine%2F" size="sm">Sign in</ButtonLink> : undefined}
              >
                <strong>This browser is not keeping data.</strong> Copies and favourites last until you close this tab. Sign in to keep them.
              </Banner>
            ) : null}
            <div ref={tabsRef}>
              <MineTabs
                value={state.tab}
                onChange={choose}
                tabs={[
                  { value: 'trips', label: 'My trips', count: counts.trips },
                  { value: 'favourites', label: 'Favourites', count: counts.favourites },
                ]}
              />
            </div>
            <div role="tabpanel" id="mine-panel-trips" aria-labelledby="mine-tab-trips" hidden={state.tab !== 'trips'} className={moved ? 'mine-panel is-moved' : 'mine-panel'}>
              <TripsPanel overview={state.overview} storage={d!.mineStorage().storage} signedIn={!!email} didNotFit={state.didNotFit} onChanged={reread} acct={acct} drafts={drafts} />
            </div>
            <div role="tabpanel" id="mine-panel-favourites" aria-labelledby="mine-tab-favourites" hidden={state.tab !== 'favourites'} className={moved ? 'mine-panel is-moved' : 'mine-panel'}>
              <FavouritesTab overview={state.overview} storage={d!.mineStorage().storage} onChanged={reread} />
            </div>
            {showNotice ? (
              <DeviceNotice
                signIn={signIn}
                onGotIt={() => {
                  d?.snoozeNoticeNow(d.mineStorage().storage, state.overview, new Date());
                  setSnoozed(true);
                  tabsRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

type Acct = { engine: AccountSync | null; snap: SyncSnapshot | null };

/** The account's trips and the device copies the merge did not take (over the cap, refused, or not merged yet), each trip once. */
function mergedTrips(c: Overview['copies'] | undefined, snap: SyncSnapshot | null): { items: CopyItem[]; deviceIds: Set<string> } {
  const device = c && c.ok ? c.items : [];
  if (!snap) return { items: [...device], deviceIds: new Set() };
  const have = new Set(snap.items.map((i) => i.id));
  const left = device.filter((i) => !have.has(i.id));
  return { items: [...snap.items, ...left], deviceIds: new Set(left.map((i) => i.id)) };
}

/**
 * The account card's sentence under the buttons (edit-my-trip 4.7). `undefined`: the flag is off, the card says what it always said.
 * Signed in, the account answered: "Your trips are kept in your account." (or how many stay on this device). Signed out with changes
 * still waiting: the session ended, and they send on sign-in (4.6).
 */
function accountNote(snap: SyncSnapshot | null, onDevice: number, waiting: number, signedIn: boolean): { text: string; warn?: boolean } | null | undefined {
  if (!ACCOUNT_TRIPS_ON) return undefined;
  if (!signedIn) return waiting > 0 ? { text: `Sign in again to finish saving ${waiting} ${waiting === 1 ? 'change' : 'changes'}.`, warn: true } : undefined;
  if (!snap || snap.reachable === null) return null;
  if (snap.expired) return { text: `Sign in again to finish saving ${snap.unsent || 'your'} ${snap.unsent === 1 ? 'change' : 'changes'}.`, warn: true };
  if (snap.reachable === false) return { text: 'We can\u2019t reach your account right now. Changes stay on this device and are sent when we can.' };
  if (onDevice > 0) {
    const n = `${onDevice} ${onDevice === 1 ? 'trip is' : 'trips are'} on this device only`;
    return { text: snap.merge && snap.merge.overCap > 0 ? `${n}: your account holds ${PLAN_DOC_LIMITS.accountPlans}.` : `${n}.` };
  }
  return { text: 'Your trips are kept in your account.' };
}

/** My trips: the rows, groups and menu of the spec (5.2) are `MyTrips`; this decides between the error state and the list. */
function TripsPanel({ overview, storage, signedIn, didNotFit, onChanged, acct, drafts }: { overview: Overview; storage: StorageLike; signedIn: boolean; didNotFit: number; onChanged: () => void; acct: Acct; drafts: readonly DraftFacts[] }) {
  const removeDraft = (id: string) => import('@/lib/plan/device').then((m) => m.removeDeviceDraft(storage, id));
  const c = overview.copies;
  if (acct.engine && acct.snap) {
    // the account answers for itself: a damaged device list is reported only when there is nothing else to show
    const { items, deviceIds } = mergedTrips(c, acct.snap);
    if (!c.ok && items.length === 0) return <Unreadable what="trips" reason={c.reason} />;
    return <MyTrips items={items} storage={storage} signedIn={signedIn} didNotFit={didNotFit} onChanged={onChanged} drafts={drafts} removeDraft={removeDraft} acct={{ engine: acct.engine, snap: acct.snap, deviceIds }} />;
  }
  if (!c.ok) return <Unreadable what="trips" reason={c.reason} />;
  return <MyTrips items={c.items} drafts={drafts} removeDraft={removeDraft} storage={storage} signedIn={signedIn} didNotFit={didNotFit} onChanged={onChanged} />;
}

/** Favourites: the filter row, rows and pager of the spec (5.3) are `FavouritesPanel`; this decides between the notice, the error state and the list. */
function FavouritesTab({ overview, storage, onChanged }: { overview: Overview; storage: StorageLike; onChanged: () => void }) {
  if (!FAVOURITES_ON) {
    return <EmptyState quiet glyph="search" glyphNode={<HeartGlyph size={32} />} title="Favourites are switched off" why="This build of the site does not keep favourites." />;
  }
  const f = overview.favourites;
  if (!f.ok) return <Unreadable what="favourites" reason={f.reason} />;
  return <FavouritesPanel items={f.items} storage={storage} onChanged={onChanged} />;
}
