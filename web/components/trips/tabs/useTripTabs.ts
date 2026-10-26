'use client';

import type { MouseEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parseTripView, resolveTripTab, type DaysView, type TabState, type TripTab } from '@travel/core/trips/tabs.ts';
import type { TripUrl } from '../useTripUrl';

export interface TripTabsApi {
  tab: TripTab;
  daysView: DaysView;
  /** Tabs that have been on screen at least once: a lazy panel mounts on its first visit and stays mounted. */
  seen: ReadonlySet<TripTab>;
  /** A tab bar press: pushes the URL (Back returns to the previous tab). */
  select: (tab: TripTab) => void;
  /** A link into a tab (`?view=day#day-11`): the same switch, and the target heading takes focus once it is on screen. */
  follow: (href: string) => void;
  /** True after a link was followed and until the target has taken focus (read by the hash effect). */
  focusPending: { current: boolean };
}

/**
 * The trip page's tab state (spec 3.4): the URL's `view` and fragment decide (`resolveTripTab`), a tab the trip does not draw is never the
 * answer, and the tab this device remembered for the trip applies once, on landing, when the URL names none (the URL is then rewritten
 * with `replaceState`, so what is shown is what the address says). Storage is read and written through a lazy chunk: it keeps the
 * module out of the page's start JS, and a browser that blocks site data just opens on the Summary.
 */
export function useTripTabs(slug: string, url: TripUrl, available: readonly TripTab[]): TripTabsApi {
  const resolved = resolveTripTab({ view: url.view, hash: url.hash, remembered: null, available });
  const { tab, daysView } = resolved;
  const [seen, setSeen] = useState<ReadonlySet<TripTab>>(() => new Set<TripTab>(['summary']));
  if (!seen.has(tab)) setSeen(new Set(seen).add(tab));

  // landing: the remembered tab, when the URL names none
  const landed = useRef(false);
  const go = url.go;
  const hasAvailable = available.join();
  useEffect(() => {
    let live = true;
    void import('@/lib/storage/keys').then((m) => {
      if (!live) return;
      const r = resolveTripTab({ view: new URLSearchParams(window.location.search).get('view'), hash: window.location.hash, remembered: m.rememberedTab(slug)?.tab ?? null, rememberedDaysView: m.rememberedTab(slug)?.daysView, available: hasAvailable.split(',') as TripTab[] });
      landed.current = true;
      if (r.from === 'device' && r.tab !== 'summary') go({ tab: r }, 'replace');
    });
    return () => {
      live = false;
    };
  }, [slug, hasAvailable, go]);

  // the tab and the Days view are remembered as they change, once the landing has had its say
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!landed.current) return;
    void import('@/lib/storage/keys').then((m) => m.writeTripEntry(slug, { tab, daysView }));
  }, [slug, tab, daysView]);

  // a switch keeps the tab bar at its sticky line instead of jumping the page (3.4 "Motion"): the bar's place before the switch is held in a ref
  const barTop = useRef<number | null>(null);
  const focusPending = useRef(false);
  useLayoutEffect(() => {
    const before = barTop.current;
    if (before === null) return;
    barTop.current = null;
    const bar = document.querySelector<HTMLElement>('.trip-tabbar');
    const head = document.querySelector<HTMLElement>('.site-header');
    const line = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
    // the bar was stuck under the header: the new panel starts right under it; a bar still in view stays where it was
    if (bar && before <= line + 1) window.scrollTo({ top: window.scrollY + bar.getBoundingClientRect().top - line, behavior: 'instant' as ScrollBehavior });
    if (focusPending.current && !window.location.hash) {
      focusPending.current = false;
      const h = document.querySelector<HTMLElement>(`#trip-panel-${tab} h2`);
      h?.setAttribute('tabindex', '-1');
      h?.focus({ preventScroll: true });
    }
  }, [tab]);
  const remember = useCallback(() => {
    barTop.current = document.querySelector('.trip-tabbar')?.getBoundingClientRect().top ?? null;
  }, []);

  const select = useCallback(
    (next: TripTab) => {
      if (next === tab) return;
      remember();
      go({ tab: { tab: next, daysView: next === 'days' ? daysView : 'list' }, hash: undefined }, 'push');
    },
    [tab, daysView, go, remember],
  );
  const follow = useCallback(
    (href: string) => {
      const u = new URL(href, window.location.href);
      const to: TabState = parseTripView(u.searchParams.get('view')) ?? { tab: 'summary', daysView: 'list' };
      remember();
      focusPending.current = true;
      go({ tab: to, hash: u.hash.slice(1) || undefined }, 'push');
    },
    [go, remember],
  );
  return { tab, daysView, seen, select, follow, focusPending };
}

/** A click on a link into a tab (`data-tab-link`) switches the tab in place; a modified click or a new-tab link keeps the browser's own behaviour. */
export function followLink(e: MouseEvent, follow: (href: string) => void): void {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-tab-link]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
  e.preventDefault();
  follow(a.href);
}
