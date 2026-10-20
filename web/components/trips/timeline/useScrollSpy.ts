'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { focusLine, isAtBottom, pickCurrent, type Spot } from './currentDay';

const SETTLE_MS = 140;
const SETTLE_NO_SCROLL_MS = 300;
const SETTLE_CAP_MS = 3000;
const PIN_SLACK_PX = 4;
/** How long a pick may wait for its `goTo` before a settling scroll is allowed to write the URL again. */
const HOLD_MS = 1000;
/** After a jump lands, layout can still move above the target (the scheduler loads, images size); for this long it is re-aligned. */
const REALIGN_MS = 2500;

interface Options<K> {
  enabled: boolean;
  /** Selector for the elements being tracked, in page order. */
  itemSelector: string;
  keyOf: (el: HTMLElement) => K | null;
  /** The sticky bar under the site header; only counts while it is `position: sticky`. */
  barSelector: string;
  /** Called once a scroll the visitor made has settled, with the current key (null above the first item). Not called for programmatic scrolls. */
  onSettle?: (key: K | null) => void;
}

export interface Spy<K> {
  /** What the bars should show: the reached item, or the first one while the page is above it. */
  current: K | null;
  /** The item at the reference line; null above the first. */
  reached: K | null;
  /** Scroll to an element and make `key` current at once; the spy ignores the scroll until it settles. `key` null for an anchor that is not an item. */
  goTo: (el: HTMLElement, key: K | null, instant?: boolean) => void;
  /**
   * Call the moment a pick is made, before its scroll starts (the URL change reaches `goTo` a frame later). A scroll the visitor made
   * just before the pick may still be waiting to settle; without this it settles after the click and writes its own section into
   * the URL over the pick, so the page stays where it was.
   */
  hold: () => void;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll position decides the current item (design 3.4): the last whose top is at or above a line just under the sticky site
 * header and bar. One passive scroll listener, throttled to a frame, one batch of reads per frame. A jump (`goTo`) pins its
 * target and mutes the spy until the scroll settles, so the highlight never flickers through the days on the way; the pin
 * holds until the visitor scrolls by hand, which is also how a last day that cannot reach the line stays the clicked one.
 */
export function useScrollSpy<K extends string | number>(opts: Options<K>): Spy<K> {
  const { enabled } = opts;
  const [reached, setReached] = useState<K | null>(null);
  const [first, setFirst] = useState<K | null>(null);
  const o = useRef(opts);
  useEffect(() => {
    o.current = opts;
  });
  const s = useRef({ locked: false, holdUntil: 0, pin: null as { key: K | null; y: number; el: HTMLElement; until: number } | null, cancelSettle: null as (() => void) | null });

  /** All the reads for one pass, together: bars, then every item's rect. Also publishes the bar height for `scroll-margin-top`. */
  const read = useCallback(() => {
    const { itemSelector, keyOf, barSelector } = o.current;
    const header = document.querySelector<HTMLElement>('.site-header');
    const bar = document.querySelector<HTMLElement>(barSelector);
    const headerH = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const barH = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--spy-bar-h', `${Math.round(barH)}px`);
    const spots: Spot<K>[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(itemSelector)) {
      const key = keyOf(el);
      if (key !== null) spots.push({ key, top: el.getBoundingClientRect().top });
    }
    const root = document.documentElement;
    const key = pickCurrent(spots, focusLine(headerH + barH, window.innerHeight), isAtBottom(window.scrollY, window.innerHeight, root.scrollHeight));
    return { key, first: spots[0]?.key ?? null };
  }, []);

  const apply = useCallback(() => {
    const r = read();
    setFirst(r.first);
    const pin = s.current.pin;
    if (pin) {
      if (Math.abs(window.scrollY - pin.y) <= PIN_SLACK_PX) {
        setReached(pin.key ?? r.key);
        return r.key;
      }
      s.current.pin = null;
    }
    setReached(r.key);
    return r.key;
  }, [read]);

  useEffect(() => {
    if (!enabled) return;
    const st = s.current;
    let frame = 0;
    let settleTimer = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };
    const onScroll = () => {
      if (st.locked) return;
      schedule();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (st.locked || performance.now() < st.holdUntil) return;
        const key = apply();
        // a pinned position is the visitor's own jump or anchor, not a scroll to follow
        if (!st.pin) o.current.onSettle?.(key);
      }, SETTLE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    const bar = document.querySelector<HTMLElement>(o.current.barSelector);
    const ro = bar && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (bar) ro?.observe(bar);
    // layout moved under a fresh jump: keep the target where the jump put it (measured in the same frame, before the scroll event it causes)
    const realign = new ResizeObserver(() => {
      const pin = st.pin;
      if (!pin || st.locked || performance.now() > pin.until || !pin.el.isConnected) return;
      pin.el.scrollIntoView({ block: 'start', behavior: 'auto' });
      pin.y = window.scrollY;
    });
    realign.observe(document.body);
    // the visitor takes over: the pin ends at once, whatever the layout does next
    const release = () => {
      if (st.pin) st.pin.until = 0;
    };
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('pointerdown', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', release);
    schedule();
    // a scroll made before this page hydrated sent no event we heard: settle it as one, so the URL still follows
    if (window.scrollY > 0) onScroll();
    return () => {
      realign.disconnect();
      window.removeEventListener('wheel', release);
      window.removeEventListener('pointerdown', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', release);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      st.cancelSettle?.();
      st.locked = false;
      st.pin = null;
      document.documentElement.style.removeProperty('--spy-bar-h');
    };
  }, [enabled, apply]);

  const goTo = useCallback(
    (el: HTMLElement, key: K | null, instant = false) => {
      const st = s.current;
      st.cancelSettle?.();
      st.holdUntil = 0;
      read(); // publish the bar height before the browser computes the scroll target
      st.locked = true;
      st.pin = null;
      if (key !== null) setReached(key);
      const smooth = !instant && !reducedMotion();
      el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      let idle = window.setTimeout(done, SETTLE_NO_SCROLL_MS);
      const cap = window.setTimeout(done, SETTLE_CAP_MS);
      function bump() {
        window.clearTimeout(idle);
        idle = window.setTimeout(done, SETTLE_MS);
      }
      function cleanup() {
        window.clearTimeout(idle);
        window.clearTimeout(cap);
        window.removeEventListener('scroll', bump);
        window.removeEventListener('scrollend', done);
        st.cancelSettle = null;
      }
      function done() {
        cleanup();
        // images above the target load while a long glide runs; one instant correction lands the target exactly
        el.scrollIntoView({ block: 'start', behavior: 'auto' });
        st.locked = false;
        st.pin = { key, y: window.scrollY, el, until: performance.now() + REALIGN_MS };
        apply();
      }
      st.cancelSettle = cleanup;
      window.addEventListener('scroll', bump, { passive: true });
      window.addEventListener('scrollend', done);
    },
    [apply, read],
  );

  const hold = useCallback(() => {
    s.current.holdUntil = performance.now() + HOLD_MS;
  }, []);

  return { current: reached ?? first, reached, goTo, hold };
}
