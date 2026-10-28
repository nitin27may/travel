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
  // SW-005: a rail longer than the screen fades at the edge that has more days, so 6 visible days do not read as the whole trip
  const [more, setMore] = useState(false);
  useEffect(() => {
    const box = rail.current;
    if (!box) return;
    const sync = () => setMore(box.scrollWidth - box.clientWidth - box.scrollLeft > 2);
    sync();
    box.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      box.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [model.days.length]);
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>('[data-active]');
    if (!el || !rail.current) return;
    const box = rail.current;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active]);
  return (
    <nav className="tl-planbar" aria-label="Days" data-print="hide">
      {lead}
      <p className="tl-planbar-line num">
        <span className="tl-planbar-who">
          {kept ? (
            <>
              <span className="tl-planbar-party" title={kept.shared ? undefined : partyText(kept)}>{kept.shared ? (kept.own ? 'Your copy' : 'Shared plan') : partyText(kept)}</span> · <span className="tl-planbar-pace">{PACE_WORD[kept.pace]}</span>
            </>
          ) : (
            label
          )}
        </span>{' '}
        <button type="button" className="tl-railedit" onClick={() => {
            railOpen.from = true;
            onEdit();
          }}>
          <Icon name="pencil" size={13} /> Edit
        </button>
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
