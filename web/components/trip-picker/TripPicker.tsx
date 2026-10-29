'use client';

// The trip picker (STEP2-P1; gap-analysis 2.4, patterns 3.9): "Save to a trip" on a place or park page. A bottom sheet on a phone, the
// 460 px side sheet from 640 px. Rows are My trips from the device (Mine's stored copies, never a document: P8, P9); a row opens the trip's
// add picker on this place (`/t/<id>/?edit=1&add=<slug>`), where the days are listed best fit first and Add is one undo step. A park is
// never a stop: from a park the picker is "Add places in <park> to a trip" and the trip's add picker lists the park's members.
// It is its own chunk, loaded on the first press of Save to a trip.
import { useEffect, useMemo, useState } from 'react';
import { readCopies, COPIES_KEY } from '@travel/core/schema/copies.ts';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { HeartGlyph } from '@/lib/favourites/glyph';
import { useToast } from '@/components/ui/Toast';
import { SideSheet } from '@/components/ui/SideSheet';
import { MineThumb } from '@/components/mine/MineThumb';
import { usePhone } from '@/components/trips/edit/panel/useMatchMedia';
import { newTripHref } from '@/components/trips/edit/add/source';
import { copyIdentity } from '@travel/core/schema/identity.ts';
import { basesOfExport, readBases, saveBases, type BasePoint } from '@/lib/mine/bases';
import { localToday } from '@/lib/mine/rows';
import { mineStorage } from '@/lib/mine/storage';
import { openTripHref, tripHref } from '@/lib/trip-edit/keys';
import { saveWithoutTrip } from './heart';
import { pickRows } from './rows';
import './trip-picker.css';

export interface PickerPlace {
  slug: string;
  name: string;
  /** a protected area or range: the picker offers its members, never the area itself */
  park?: boolean;
  /** the place's point, [lon, lat]: trips are ranked by their nearest base (PR-001) */
  at?: readonly [number, number] | null;
  /** the day of the public plan that holds the place, by public trip slug */
  planDays?: Readonly<Record<string, number>>;
}

interface Props {
  place: PickerPlace;
  onClose: () => void;
}

type Problem = null | 'newer' | 'unreadable';

/** Stored copies, read once when the picker opens. A damaged or newer envelope is never written here; it says so, as Mine does. */
function readItems() {
  try {
    const s = mineStorage().storage;
    const r = readCopies(s.getItem(COPIES_KEY));
    return { s, items: r.ok ? r.envelope.items : [], problem: (r.ok ? null : r.reason === 'newer' ? 'newer' : 'unreadable') as Problem };
  } catch {
    return { s: null, items: [], problem: null as Problem };
  }
}

/** How long the list waits for the base points of trips it does not know yet, before it shows the order it has. */
const WAIT = 1800;

export function TripPicker({ place, onClose }: Props) {
  const phone = usePhone();
  const { toast } = useToast();
  const [{ s, items, problem }] = useState(readItems);
  const [bases, setBases] = useState<Record<string, readonly BasePoint[]>>(() => readBases(s));
  // trips whose bases this device has not kept yet (a copy made before they were kept): one public export each, once, then kept
  const missing = useMemo(() => (place.at ? [...new Set(items.map((i) => i.slug))].filter((slug) => !bases[slug]) : []), [items, bases, place.at]);
  const [timedOut, setTimedOut] = useState(false);
  const waiting = missing.length > 0 && !timedOut;
  useEffect(() => {
    if (!missing.length) return;
    let live = true;
    const timer = window.setTimeout(() => live && setTimedOut(true), WAIT);
    void import('@/lib/client/data').then(({ loadExport }) =>
      Promise.all(
        missing.map((slug) =>
          loadExport('trip', slug)
            .then((d) => ({ slug, pts: basesOfExport(d) }))
            .catch(() => ({ slug, pts: [] as BasePoint[] })),
        ),
      ).then((got) => {
        if (!live) return;
        const next: Record<string, readonly BasePoint[]> = {};
        for (const g of got) {
          saveBases(s, g.slug, g.pts);
          // a trip with no base points is remembered for this open only, so it is not asked for again in a loop
          next[g.slug] = g.pts;
        }
        setBases((b) => ({ ...b, ...next }));
      }),
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [missing, s]);
  const rows = useMemo(() => pickRows(items, place.slug, localToday(), s, { at: place.at ?? null, bases, planDays: place.planDays }), [items, place.slug, place.at, place.planDays, bases, s]);
  const hasNew = newTripHref(place.slug);
  const title = 'Add to a trip';
  const change = (open: boolean) => {
    if (!open) onClose();
  };
  const saveHeart = () => {
    saveWithoutTrip(place, toast);
    onClose();
  };
  const verb = place.park ? 'Add places in' : 'Add';
  const body = (
    <div className="tpk">
      <p className="tpk-place">
        {place.park ? <span className="tpk-place-k">Places in</span> : null}
        <span className="tpk-place-n">{place.name}</span>
      </p>
      {problem ? (
        <EmptyState
          glyph="warn"
          as="h3"
          title={problem === 'newer' ? 'This list was written by a newer version of the site' : 'We couldn’t read your trips'}
          why={problem === 'newer' ? 'Reload the page to see it. Nothing has been changed.' : 'The list in this browser is damaged. It has been left exactly as it is.'}
          action={problem === 'newer' ? <Button variant="primary" onClick={() => location.reload()}>Reload</Button> : <ButtonLink href="/mine/?show=trips" variant="primary">Open Mine</ButtonLink>}
        />
      ) : waiting ? (
        <p className="tpk-wait" role="status">Finding the trips nearest {place.name}</p>
      ) : rows.length ? (
        <ul className="tpk-list" aria-label="Your trips">
          {rows.map(({ row, href, on, planDay, far }) => {
            const day = on ?? planDay;
            const dayHref = day !== null ? tripHref(row.item.id, `view=day#day-${day}`) : null;
            return (
              <li key={row.item.id} className="tpk-row" data-far={far || undefined}>
                <MineThumb space="trip" slug={row.item.slug} known={row.item.photo} icon="route" ring={copyIdentity(row.item)} />
                <div className="tpk-main">
                  <p className="tpk-name">{row.title}</p>
                  <p className="tpk-when">{row.when}</p>
                  <p className="tpk-who">{row.who}</p>
                  <p className="tpk-day" data-on={!far && day !== null ? '' : undefined}>
                    {far ? `Far from ${place.name}` : place.park ? 'Choose the places next' : day !== null ? `On Day ${day} in this trip` : 'The best day is picked next'}
                  </p>
                </div>
                {/* plain links on purpose: Next would prefetch every row's trip page as it scrolls in, a request per trip for nothing */}
                {far ? (
                  <a href={openTripHref(row.item.id)} className={buttonClass({ size: 'sm', variant: 'secondary', className: 'tpk-add' })} aria-label={`Open ${row.title}: it is far from ${place.name}`}>
                    Open trip
                  </a>
                ) : !place.park && dayHref ? (
                  <a href={dayHref} className={buttonClass({ size: 'sm', variant: 'secondary', className: 'tpk-add' })} aria-label={`${place.name} is on Day ${day} of ${row.title}: open Day ${day}`}>
                    Open Day {day}
                  </a>
                ) : (
                  <a href={href} className={buttonClass({ size: 'sm', className: 'tpk-add' })} aria-label={`${verb} ${place.name} to ${row.title}`}>
                    Add
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          glyph="route"
          as="h3"
          title="No trips yet"
          why={place.park ? 'Copy a trip or plan a visit, then add places from here.' : 'Copy a trip to your trips, then add this place to a day.'}
          action={<ButtonLink href="/trips/" variant="primary">Browse trips</ButtonLink>}
          secondary={hasNew ? <ButtonLink href={hasNew} variant="ghost">{place.park ? 'Plan a visit' : `Start a new trip with ${place.name}`}</ButtonLink> : undefined}
        />
      )}
      <ul className="tpk-more">
        {rows.length && hasNew ? (
          <li>
            <a className="tpk-plain" href={hasNew}>
              <Icon name="plus" size={15} /> {place.park ? 'Plan a visit' : `Start a new trip with ${place.name}`}
            </a>
          </li>
        ) : null}
        <li>
          <Button variant="ghost" className="tpk-plain" onClick={saveHeart}>
            <HeartGlyph size={15} /> Save without a trip
          </Button>
        </li>
      </ul>
    </div>
  );
  // three or more trips (or a park) open full, so the rows and Save without a trip are in view (PR-007); the grabber drags it down
  const snap = rows.length >= 3 || place.park ? 'full' : 'half';
  return phone ? (
    <BottomSheet open onOpenChange={change} title={title} snaps={['half', 'full']} initial={snap} sizeButtons={false} className="tpk-sheet">
      {body}
    </BottomSheet>
  ) : (
    // modal: a scrim under the sheet and focus kept inside it, Tab wrapping at the ends (PR-017, PR-021)
    <SideSheet open onOpenChange={change} title={title} modal className="tpk-sheet">
      {body}
    </SideSheet>
  );
}
