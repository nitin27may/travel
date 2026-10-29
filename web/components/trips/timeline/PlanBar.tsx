'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ExportFormat } from '@/components/actions/ExportMenu';
import { PACE_WORD, partyText } from '@travel/core/trips/partyWords.ts';
import { Icon } from '@/components/ui/Icon';
import type { TimelineModel } from './model';
import { railOpen, useRailParty } from './railWords';
import { useTimelineExtras } from './editSlots';

const useExtras: typeof useTimelineExtras = process.env.NEXT_PUBLIC_TRIP_EDIT === '1' ? useTimelineExtras : () => null;

// Export trip at the right end of the bar from 1024 px (map note): the menu is its own chunk, so the bar's start JS does not carry it
const ExportMenu = dynamic(() => import('@/components/actions/ExportMenu').then((m) => m.ExportMenu), { ssr: false });
const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'ics', 'gpx', 'kml', 'csv'];

interface Props {
  /** The trip's slug, for its export. */
  slug: string;
  model: TimelineModel;
  /** The fallback profile line, "Family, 10 · Standard", used until the party bar has written its words. */
  label: string;
  active: number | null;
  onPick: (n: number) => void;
  /** "Edit": scroll to the selector and open it. */
  onEdit: () => void;
  /** Phone only: opens the map sheet. Lives in the strip so nothing floats over the page. */
  onMap?: () => void;
  mapOpen?: boolean;
  /** The person's own trip (STEP2-T1): its identity cell and title, first in the bar (scenario rule 1). */
  lead?: ReactNode;
}

/** The Map control of the sticky strip on a phone (44 px, icon and the word Map). Hidden from 640 px up, where the map has its own column. */
export function MapButton({ onClick, open }: { onClick: () => void; open?: boolean }) {
  return (
    <button type="button" className="tl-mapbtn" data-print="hide" aria-expanded={open ?? false} aria-controls="route" onClick={onClick}>
      <Icon name="map" size={18} /> Map
    </button>
  );
}

/** Sticky under the header while the days scroll: the profile in a few words and a rail of day numbers (design 3.4). */
export function PlanBar({ slug, model, label, active, onPick, onEdit, onMap, mapOpen, lead }: Props) {
  const rail = useRef<HTMLOListElement>(null);
  const kept = useRailParty();
  const tools = useExtras()?.tools;
  const bar = useRef<HTMLElement>(null);
  // SW-005: a rail longer than the screen says so at the edge that has more days, so 6 visible days do not read as the whole trip. The cells
  // are measured: a day cut by the strip's edge is not drawn (it would read "1" for 12) and the last whole day before it is dimmed (the 768
  // rail, ERFIX shots 12-rail-day*). The cut cell stays focusable, and focus scrolls it into view.
  const [more, setMore] = useState(false);
  useEffect(() => {
    const box = rail.current;
    if (!box) return;
    const sync = () => {
      setMore(box.scrollWidth - box.clientWidth - box.scrollLeft > 2);
      const b = box.getBoundingClientRect();
      const cells = [...box.querySelectorAll<HTMLElement>('li')];
      const seen = cells.map((li) => {
        const r = li.getBoundingClientRect();
        return r.right <= b.left + 1 || r.left >= b.right - 1 ? 'out' : r.left < b.left - 1 || r.right > b.right + 1 ? 'cut' : 'in';
      });
      const first = seen.indexOf('in');
      const last = seen.lastIndexOf('in');
      cells.forEach((li, i) => {
        const edge = seen[i] === 'cut' ? 'cut' : (i === first && i > 0) || (i === last && i < cells.length - 1) ? 'dim' : null;
        if (edge) li.dataset.edge = edge;
        else delete li.dataset.edge;
      });
    };
    sync();
    box.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    // the strip's own width changes without a scroll or a window resize (the tools move to or from its line, the party words load)
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    watch?.observe(box);
    return () => {
      box.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      watch?.disconnect();
    };
  }, [model.days.length]);
  // the active day sits in the middle of the strip. The strip's width changes after the first paint (the tools row wraps to a second line
  // at tablet widths, the window resizes), so it is centred again whenever its box changes size, not only when the day changes (ER-010)
  useEffect(() => {
    const box = rail.current;
    if (!box) return;
    const centre = (smooth: boolean) => {
      const el = box.querySelector<HTMLElement>('[data-active]');
      if (!el) return;
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // the cell's place inside the strip, by boxes: offsetLeft is measured from the bar, not the strip, once the strip does not start at the bar's edge (ER-010)
      const at = el.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
      box.scrollTo({ left: at - box.clientWidth / 2 + el.clientWidth / 2, behavior: smooth && !calm ? 'smooth' : 'auto' });
    };
    centre(true);
    if (typeof ResizeObserver === 'undefined') return;
    let width = box.clientWidth;
    const watch = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      centre(false);
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, [active]);
  // ER-022: the edit tools sit on the strip's line when everything fits there, measured (not a breakpoint): first with the party words,
  // then without them (Settings owns Who is going while editing, ER-009); otherwise they take the bar's second line. Every day stays visible.
  const [fit, setFit] = useState<'inline' | 'bare' | null>(null);
  const lineW = useRef(0);
  useEffect(() => {
    const nav = bar.current;
    const box = rail.current;
    if (!nav || !box || !tools || typeof ResizeObserver === 'undefined') {
      setFit(null);
      return;
    }
    const measure = () => {
      const kit = nav.querySelector<HTMLElement>('.tl-planbar-tools .edit-tools');
      const shown = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).offsetParent !== null;
      if (!shown(kit)) return setFit(null);
      const kids = [...kit.children] as HTMLElement[];
      const toolsW = kids.length ? kids[kids.length - 1]!.getBoundingClientRect().right - kids[0]!.getBoundingClientRect().left : 0;
      const line = nav.querySelector<HTMLElement>('.tl-planbar-line');
      if (shown(line)) lineW.current = line.getBoundingClientRect().width;
      const css = getComputedStyle(nav);
      const gap = parseFloat(css.columnGap) || 0;
      const room = nav.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      const parts = [nav.querySelector('.own-id'), nav.querySelector('.tl-planbar-export')].filter(shown).map((el) => el.getBoundingClientRect().width);
      const base = [...parts, box.scrollWidth, toolsW];
      const need = (xs: number[]) => xs.reduce((n, x) => n + x, 0) + gap * (xs.length - 1);
      setFit(need([...base, lineW.current]) <= room ? 'inline' : need(base) <= room ? 'bare' : null);
    };
    measure();
    // every part of the bar is watched, not only the bar: Export's menu loads after the first paint, and on one line a part that grows
    // does not resize the bar
    const watch = new ResizeObserver(measure);
    watch.observe(nav);
    for (const el of [...nav.children, ...nav.querySelectorAll('.edit-tools, .tl-planbar-export > *')]) watch.observe(el);
    return () => watch.disconnect();
  }, [tools, kept, model.days.length]);
  return (
    <nav className="tl-planbar" aria-label="Days" data-print="hide" ref={bar} data-tools={tools ? (fit ?? 'below') : undefined}>
      {lead}
      <p className="tl-planbar-line num">
        <span className="tl-planbar-who">
          {kept ? (
            <>
              <span className="tl-planbar-party" title={kept.shared ? undefined : partyText(kept)}>{kept.shared ? (kept.own ? (kept.built ? 'Your trip' : 'Your copy') : 'Shared plan') : partyText(kept)}</span>
              {/* the separator is the pace's own first word, so it shrinks away with the pace and never trails a truncated party ("… ·", SW-006/B2) */}
              <span className="tl-planbar-pace">{' · '}{PACE_WORD[kept.pace]}</span>
            </>
          ) : (
            label
          )}
        </span>{' '}
        {/* ER-009: while the trip itself is being edited (the tools are on the bar), "Edit" would read as "Edit trip"; Settings owns Who is going */}
        {tools ? null : (
          <button type="button" className="tl-railedit" onClick={() => {
              railOpen.from = true;
              onEdit();
            }}>
            <Icon name="pencil" size={13} /> Edit
          </button>
        )}
      </p>
      <ol className="tl-rail-days" ref={rail} data-more={more || undefined}>
        {model.days.map((d) => (
          <li key={d.n}>
            <a
              href={`#day-${d.n}`}
              className="tl-rail-cell num"
              data-active={active === d.n || undefined}
              aria-current={active === d.n ? 'true' : undefined}
              aria-label={`Day ${d.n}`}
              onClick={(ev) => {
                ev.preventDefault();
                onPick(d.n);
              }}
            >
              {d.n}
            </a>
          </li>
        ))}
      </ol>
      {onMap ? <MapButton onClick={onMap} open={mapOpen} /> : null}
      {tools ? <div className="tl-planbar-tools" data-print="hide">{tools}</div> : null}
      <div className="tl-planbar-export" data-print="hide">
        <ExportMenu target={{ type: 'trip', slug }} formats={EXPORT_FORMATS} size="sm" />
      </div>
    </nav>
  );
}
