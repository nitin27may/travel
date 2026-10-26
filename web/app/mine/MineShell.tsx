'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { markSeen } from '@/lib/mine/dot';
import { kindLabel } from '@/lib/public/taxonomy';
import type { PlaceKind } from '@/lib/public/types';
import type { MineTab, Overview } from '@/lib/mine/overview';
import { AccountCard } from './AccountCard';
import { DeviceNotice } from './DeviceNotice';
import { MineTabs } from './MineTabs';

type Loaded = { overview: Overview; blocked: boolean; tab: MineTab };
type Data = typeof import('@/lib/mine/data');
// the core readers (and Zod) load after the shell paints, so the page's start chunk stays small
const data = (): Promise<Data> => import('@/lib/mine/data');

/** A heart glyph for the empty Favourites state: the heart path lives here, in the Mine chunk, never in Icon.tsx (spec 6). */
function HeartGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}

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

// 'Sat 3 Jul 2027': the form the copy sheet shows. UTC so the calendar date never shifts with the visitor's zone.
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (iso: string): string => DAY.format(new Date(`${iso}T00:00:00Z`)).replace(/,/g, '');
const regions = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryName = (cc: string | null): string | null => (cc ? (regions?.of(cc) ?? cc) : null);

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
      const overview = m.readOverview(probe.storage);
      const asked = m.parseShow(new URLSearchParams(location.search).get('show'));
      setD(m);
      setState({ overview, blocked: probe.kind === 'memory', tab: asked ?? m.defaultTab(overview) });
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
              <TripsPanel overview={state.overview} />
            </div>
            <div role="tabpanel" id="mine-panel-favourites" aria-labelledby="mine-tab-favourites" hidden={state.tab !== 'favourites'} className={moved ? 'mine-panel is-moved' : 'mine-panel'}>
              <FavouritesPanel overview={state.overview} />
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

/** My trips. NAV-2 replaces the plain list with the rows, groups and menu of the spec (5.2). */
function TripsPanel({ overview }: { overview: Overview }) {
  const c = overview.copies;
  if (!c.ok) return <Unreadable what="trips" reason={c.reason} />;
  if (c.items.length === 0) {
    return (
      <EmptyState
        quiet
        glyph="layers"
        title="No trips copied yet"
        why="Open a trip and choose Copy to my trips. It stays here with your dates."
        action={<ButtonLink href="/trips/" variant="primary">Browse trips</ButtonLink>}
      />
    );
  }
  return (
    <ul className="mine-plain">
      {c.items.map((i) => (
        <li key={i.id}>
          <Link href={`/trips/${i.slug}/`}>{i.title}</Link>
          <span>{i.start ? dayLabel(i.start) : 'No date'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Favourites. FAV-1 replaces the plain list with the filter row and list rows of the spec (5.3) and the heart. */
function FavouritesPanel({ overview }: { overview: Overview }) {
  const f = overview.favourites;
  if (!f.ok) return <Unreadable what="favourites" reason={f.reason} />;
  if (f.items.length === 0) {
    return (
      <EmptyState
        quiet
        glyph="search"
        glyphNode={<HeartGlyph />}
        title="No favourites yet"
        why="Tap the heart on a place or a trip to keep it here."
        action={<ButtonLink href="/places/" variant="primary">Browse places</ButtonLink>}
        secondary={<ButtonLink href="/trips/" variant="ghost">Browse trips</ButtonLink>}
      />
    );
  }
  return (
    <ul className="mine-plain">
      {f.items.map((i) => (
        <li key={`${i.space}:${i.slug}`}>
          <Link href={`/${i.space === 'trip' ? 'trips' : 'places'}/${i.slug}/`}>{i.name ?? i.slug}</Link>
          <span>{i.unlistedAt ? 'No longer listed' : [i.space === 'trip' ? 'Trip' : (i.kind ? kindLabel(i.kind as PlaceKind, null) : 'Place'), countryName(i.cc)].filter(Boolean).join(' · ')}</span>
        </li>
      ))}
    </ul>
  );
}
