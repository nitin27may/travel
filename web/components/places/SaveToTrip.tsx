'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { ExportFormat } from '@/components/actions/ExportMenu';
import { ExportMenuLazy as ExportMenu } from './ExportMenuLazy';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { UNIT_PATTERN } from '@/lib/format/convert';
import { appleMapsUrl, directionsUrl } from '@/lib/map/links';
import type { LngLat } from '@/lib/map/types';
import { InYourTripsLazy, TripPickerLazy } from '@/components/trip-picker/Lazy';
import { TRIP_EDIT_ON } from '@/lib/trip-edit/flag';

/** What the place page tells the trip picker (STEP2-P1): the park flag, and the public trips that use the place (slugs only). */
export interface EditProps {
  /** a protected area or range: the picker offers its members, never the area itself */
  park: boolean;
  trips: string[];
}

/**
 * "Save to a trip" for a visitor: the public site has no account, so the button opens a plain note that saving comes with
 * the planner, with Copy link and the GPX export as the things that work today (patterns 3.6, backlog 2.13).
 */
export function SaveToTrip({ url, slug, formats, primary = false, edit }: { url: string; slug: string; formats: ExportFormat[]; /** the cover's one primary action, when there is no Directions button */ primary?: boolean; /** with `tripEdit` on (STEP2-P1): the trip picker replaces the note; the page passes it only then, so a build with the flag off carries nothing */ edit?: EditProps }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { toast } = useToast();
  // the favourites heart: nothing on the server, an import() after hydration (FAV-1, visitor spec 7), so the HTML does not grow
  const live = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [heart, setHeart] = useState<{ Heart: typeof import('@/lib/favourites/heart').FavouriteHeart; host: HTMLElement } | null>(null);
  useEffect(() => {
    // the heart goes right after Share in the row, in the page order too (a portal into a slot beside it), not first in the row
    const share = live ? document.querySelector('.pl-actions [data-share]') : null;
    if (!share) return;
    let on = true;
    const host = document.createElement('span');
    host.className = 'pl-heart';
    share.after(host);
    void import('@/lib/favourites/heart').then((m) => on && setHeart({ Heart: m.FavouriteHeart, host }));
    return () => {
      on = false;
      host.remove();
    };
  }, [live]);
  // the "In your trips" line goes right under the action row (a portal into a slot after it), as its own chunk
  const [line, setLine] = useState<HTMLElement | null>(null);
  const picking = TRIP_EDIT_ON && !!edit;
  useEffect(() => {
    const row = picking && live ? document.querySelector('.pl-actions') : null;
    if (!row) return;
    const host = document.createElement('div');
    host.className = 'pl-in-trips';
    row.after(host);
    setLine(host);
    return () => {
      host.remove();
      setLine(null);
    };
  }, [picking, live]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: 'Link copied' });
    } catch {
      toast({ message: 'Could not copy the link' });
    }
  };
  return (
    <div className="pl-save">
      <Button variant="primary" className={primary ? 'pl-primary' : undefined} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={15} /> Save to a trip
      </Button>
      {picking && open ? <TripPickerLazy place={{ slug, name: placeName(slug), park: edit.park }} onClose={() => setOpen(false)} /> : null}
      {picking && line ? createPortal(<InYourTripsLazy slug={slug} publicTrips={edit.trips} />, line) : null}
      {!picking && open ? (
        <div id={id} className="pl-save-note" role="status">
          <p>Saving to a trip comes with the planner, which is not open yet. For now, copy the link or take the GPX.</p>
          <p className="pl-save-actions">
            <Button size="sm" onClick={copy}>
              <Icon name="copy" size={13} /> Copy link
            </Button>
            {formats.length ? <ExportMenu target={{ type: 'place', slug }} formats={formats} /> : null}
          </p>
        </div>
      ) : null}
      {heart ? createPortal(<heart.Heart space="place" slug={slug} />, heart.host) : null}
    </div>
  );
}

const noSubscribe = () => () => {};

/** The page's name, from its h1 (the heart reads it the same way: no new prop crosses the server boundary). */
const placeName = (slug: string): string => document.querySelector('h1')?.textContent?.trim() || slug.replace(/-/g, ' ');

/**
 * The cover Directions button (R4-C1): the same two choices as the Directions card in the rail, Google Maps and Apple Maps, both from our
 * stored point by the one link builder. It lives in this module so the page loads no extra chunk for it (S13); the server HTML is a plain Google Maps link. Esc and leaving it close the list.
 */
export function DirectionsChooser({ at, label }: { at: LngLat; label: string }) {
  const [open, setOpen] = useState(false);
  // the server draws a plain link, which works with no script; once the page is live the same button becomes the chooser
  const live = useSyncExternalStore(noSubscribe, () => true, () => false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  // Esc and a press outside close the list wherever focus is: Safari does not focus a button on click, so the wrapper alone would never see the key
  useEffect(() => {
    if (!open) return;
    const key = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', away);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', away);
    };
  }, [open]);
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') setOpen(false);
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };
  if (!live) {
    return (
      <div className="pl-dirmenu">
        <a className="btn btn-primary pl-dir" href={directionsUrl(at)} target="_blank" rel="noopener noreferrer">
          <Icon name="navigate" size={14} /> Directions<span className="sr-only"> to {label} (opens in a new tab)</span>
        </a>
      </div>
    );
  }
  return (
    <div className="pl-dirmenu" ref={wrap} onKeyDown={onKey} onBlur={onBlur}>
      <Button variant="primary" className="pl-dir" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="navigate" size={14} /> Directions<span className="sr-only"> to {label}: choose a map app</span>
      </Button>
      {open ? (
        <div id={id} className="menu">
          <a className="menu-item" href={directionsUrl(at)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            Google Maps directions<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a className="menu-item" href={appleMapsUrl(at, label)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            Apple Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* The trail strip's tiles live here too: one client module for the page's interactive parts, so a place page loads one chunk for all of them (S13). */
/**
 * The trail facts as tiles (backlog 10.1). A client component only so the page carries them once: a string of markup handed to
 * dangerouslySetInnerHTML is written into the HTML and again, escaped, into the RSC payload (place-size, S13), while props of a client
 * component are small JSON next to the one HTML render. It holds no state and no effect.
 */
export interface Tile {
  /** label */
  l: string;
  /** the value as plain text (a distance or height becomes the `<data>` element the unit switch rewrites, here, so no markup rides in the payload); absent for a gap */
  v?: string;
  /** the row the tile links to */
  h: string;
  /** how many other values the sources give, for the "N values" chip */
  c?: number;
}

export interface ExternalTile {
  /** label, url, the visible link text, the accessible name */
  l: string;
  u: string;
  t: string;
  a: string;
}

/** The same split as `withUnits` in components/suit/html.ts, as nodes: same elements, same attributes. */
function withUnitNodes(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(UNIT_PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <data key={at} className={`u${m[3]}`} value={`${m[1]}${m[2] ? `–${m[2]}` : ''}`}>
        {m[0]}
      </data>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The completeness line under the strip: the chip (level, label) and the checks text beside it. The long tooltip is not repeated here: "Facts and sources" carries the same sentence (S13). */
export interface Level {
  v: string;
  l: string;
  c: string;
}

export function TrailStripTiles({ tiles, ext, read, level }: { tiles: Tile[]; ext: ExternalTile; read: string | null; level: Level }) {
  return (
    <>
      <ul>
        {tiles.map((t) => (
          <li key={t.l}>
            <a href={t.h} className="ga">
              <span className="gl">{t.l}</span>
              {t.v === undefined ? (
                <span className="gc">Not checked yet</span>
              ) : (
                <strong className="gv">{withUnitNodes(t.v)}</strong>
              )}
              {t.c ? <span className="su-honest">{t.c + 1} values</span> : null}
            </a>
          </li>
        ))}
        <li>
          <a href={ext.u} className="ga ga-ext" target="_blank" rel="noopener noreferrer" aria-label={ext.a}>
            <span className="gl">{ext.l}</span> <strong className="gv">
              <span className="ga-u">{ext.t}</span>
            </strong>
          </a>
        </li>
      </ul>
      {read ? <p className="pb ps-readline">{read}</p> : null}
      <p className="ps-level">
        <span className="ps-complete" data-level={level.v}>
          {level.l}
        </span>
        <span className="pb">{level.c}</span>
      </p>
    </>
  );
}
