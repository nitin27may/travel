'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { markSeen } from '@/lib/mine/dot';
import { FAVOURITES_ON } from '@/lib/favourites/flag';
import { HeartGlyph } from '@/lib/favourites/glyph';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import type { MineTab, Overview } from '@/lib/mine/overview';
import { AccountCard } from './AccountCard';
import { DeviceNotice } from './DeviceNotice';
import { MineTabs } from './MineTabs';

// the rows, the menu and the copy readers load after the shell paints (Zod stays out of the page's start chunk)
const MyTrips = dynamic(() => import('@/components/mine/MyTrips').then((m) => m.MyTrips), { ssr: false });
const FavouritesPanel = dynamic(() => import('@/components/mine/FavouritesPanel').then((m) => m.FavouritesPanel), { ssr: false });

type Loaded = { overview: Overview; blocked: boolean; tab: MineTab; didNotFit: number };
type Data = typeof import('@/lib/mine/data');
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
  const [snoozed, setSnoozed] = useState(false);
  const [moved, setMoved] = useState(false);
  const [d, setD] = useState<Data | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void data().then((m) => {
      if (!live) return;
      const probe = m.mineStorage();
      // the old key's drafts move into the envelope once per device, before the first read (NAV-2C); `kept` is what did not fit
      const mv = m.moveLegacyOnce(probe.storage);
      const overview = m.readOverview(probe.storage);
      const asked = m.parseShow(new URLSearchParams(location.search).get('show'));
      setD(m);
      setState({ overview, blocked: probe.kind === 'memory', tab: asked ?? m.defaultTab(overview), didNotFit: mv.status === 'moved' ? mv.kept : 0 });
      markSeen();
    });
    return () => {
      live = false;
    };
  }, []);

  // another tab changed a list: read again (the dot does the same)
  useEffect(() => {
    if (!d) return;
    const on = () => setState((s) => (s ? { ...s, overview: d.readOverview(d.mineStorage().storage) } : s));
    addEventListener('storage', on);
    return () => removeEventListener('storage', on);
  }, [d]);

  useEffect(() => {
    if (!signIn) return;
    let live = true;
    void import('@/lib/auth/client')
      .then(({ getAuthClient }) => getAuthClient().getSession())
      .then((r) => {
        const u = (r as { data?: { user?: { email?: string } } } | null)?.data?.user;
        if (live && u?.email) setEmail(u.email);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signIn]);

  const counts = useMemo(
    () => ({
      trips: state?.overview.copies.ok ? state.overview.copies.items.length : null,
      favourites: state?.overview.favourites.ok ? state.overview.favourites.items.length : null,
    }),
    [state],
  );

  // a write in this tab (Remove, Undo, Change dates): read both lists again
  const reread = () => setState((s) => (s && d ? { ...s, overview: d.readOverview(d.mineStorage().storage) } : s));

  const choose = (tab: MineTab) => {
    setMoved(true);
    setState((s) => (s ? { ...s, tab } : s));
    const url = new URL(location.href);
    url.searchParams.set('show', tab);
    history.replaceState(history.state, '', url);
  };

  const showNotice = !!state && !!d && !email && !snoozed && d.noticeDue(state.overview, new Date());

  return (
    <div className="mine">
      <AccountCard signIn={signIn} email={email} />
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
              <TripsPanel overview={state.overview} storage={d!.mineStorage().storage} signedIn={!!email} didNotFit={state.didNotFit} onChanged={reread} />
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

/** My trips: the rows, groups and menu of the spec (5.2) are `MyTrips`; this decides between the error state and the list. */
function TripsPanel({ overview, storage, signedIn, didNotFit, onChanged }: { overview: Overview; storage: StorageLike; signedIn: boolean; didNotFit: number; onChanged: () => void }) {
  const c = overview.copies;
  if (!c.ok) return <Unreadable what="trips" reason={c.reason} />;
  return <MyTrips items={c.items} storage={storage} signedIn={signedIn} didNotFit={didNotFit} onChanged={onChanged} />;
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
