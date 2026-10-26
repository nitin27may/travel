'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Chip } from '@/components/ui/Chip';
import type { Category } from '@/lib/public/types';
import { CategoryStrip } from '../CategoryStrip';
import { CategoryView } from '../CategoryView';
import { DEPTH_NOTICE } from '../format';
import type { CategorySectionModel } from '../model';
import { useScrollSpy } from '../timeline/useScrollSpy';
import type { TripUrl } from '../useTripUrl';

interface Props {
  sections: CategorySectionModel[];
  /** Stops is the tab on screen: the spy runs and a category fragment scrolls. */
  active: boolean;
  /** The trip is a condensed plan: the notice sits at the head of the list. */
  condensed: boolean;
  url: TripUrl;
  /** Phone only: the Map control of the strip. */
  onMap?: () => void;
  mapOpen?: boolean;
  /** Set while a followed link waits to put focus on its target heading (useTripTabs `focusPending`). */
  focusRef?: { current: boolean };
}

/**
 * The Stops tab (spec 3.2): the six category chips with their counts and the same items regrouped by category (patterns 3.4). It is its own
 * chunk, with the category scroll spy: nothing of it is in the trip page's start JS (D12). A category fragment (`#trails`) scrolls to its
 * section once this panel is on screen; an empty category goes to the strip.
 */
export function StopsPanel({ sections, active, condensed, url, onMap, mapOpen, focusRef }: Props) {
  const own = useRef<string | null>(null);
  const spy = useScrollSpy<Category>({
    enabled: active,
    itemSelector: 'section[data-cat]',
    keyOf: (el) => (el.dataset.cat as Category | undefined) ?? null,
    barSelector: '.cat-strip',
    onSettle: (key) => {
      if (key && window.location.hash !== `#${key}`) {
        own.current = key;
        url.go({ hash: key }, 'replace');
      }
    },
  });
  const booted = useRef(false);
  const { goTo, hold } = spy;
  const go = url.go;
  const hash = url.hash;
  const category = url.category;
  useEffect(() => {
    if (!active || !category || own.current === hash) return;
    const instant = !booted.current;
    booted.current = true;
    const frame = requestAnimationFrame(() => {
      const el = sections.find((s) => s.id === category)?.count ? document.getElementById(category) : document.querySelector<HTMLElement>('.cat-strip');
      if (!el) return;
      goTo(el, el.id === category ? category : null, instant);
      if (focusRef?.current) {
        focusRef.current = false;
        const h = el.querySelector<HTMLElement>('h3') ?? el;
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, hash, category, sections, goTo, focusRef]);

  // A chip scrolls itself so a pick of the section the URL already names still moves the page, and a scroll the visitor made just
  // before cannot settle afterwards and write its own section over the pick.
  const pick = useCallback(
    (id: Category) => {
      const el = sections.find((c) => c.id === id)?.count ? document.getElementById(id) : null;
      hold();
      if (el) {
        goTo(el, id);
        own.current = id;
      }
      go({ tab: { tab: 'stops', daysView: 'list' }, hash: id }, 'push');
    },
    [sections, hold, goTo, go],
  );
  return (
    <>
      {condensed ? (
        <p className="trip-depth">
          <Chip kind="honest">{DEPTH_NOTICE.summary}</Chip>
        </p>
      ) : null}
      <CategoryStrip sections={sections} active={active ? spy.current : null} sticky onPick={pick} onMap={onMap} mapOpen={mapOpen} />
      {sections.filter((s) => s.count === 0).map((s) => (
        <span key={s.id} id={s.id} className="anchor-top" />
      ))}
      <CategoryView sections={sections} />
    </>
  );
}
