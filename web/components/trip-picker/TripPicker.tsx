'use client';

// The trip picker (STEP2-P1; gap-analysis 2.4, patterns 3.9): "Save to a trip" on a place or park page. A bottom sheet on a phone, the
// 460 px side sheet from 640 px. Rows are My trips from the device (Mine's stored copies, never a document: P8, P9); a row opens the trip's
// add picker on this place (`/t/<id>/?edit=1&add=<slug>`), where the days are listed best fit first and Add is one undo step. A park is
// never a stop: from a park the picker is "Add places in <park> to a trip" and the trip's add picker lists the park's members.
// It is its own chunk, loaded on the first press of Save to a trip.
import { useState } from 'react';
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
import { localToday } from '@/lib/mine/rows';
import { mineStorage } from '@/lib/mine/storage';
import { saveWithoutTrip } from './heart';
import { pickRows } from './rows';
import './trip-picker.css';

export interface PickerPlace {
  slug: string;
  name: string;
  /** a protected area or range: the picker offers its members, never the area itself */
  park?: boolean;
}

interface Props {
  place: PickerPlace;
  onClose: () => void;
}

/** Stored copies, read once when the picker opens. A damaged or newer envelope reads as no trips (it is never written here). */
function readItems() {
  try {
    const s = mineStorage().storage;
    const r = readCopies(s.getItem(COPIES_KEY));
    return { s, items: r.ok ? r.envelope.items : [] };
  } catch {
    return { s: null, items: [] };
  }
}

export function TripPicker({ place, onClose }: Props) {
  const phone = usePhone();
  const { toast } = useToast();
  const [{ rows, hasNew }] = useState(() => {
    const { s, items } = readItems();
    return { rows: pickRows(items, place.slug, localToday(), s), hasNew: newTripHref(place.slug) };
  });
  const title = place.park ? `Add places in ${place.name} to a trip` : `Add ${place.name} to a trip`;
  const change = (open: boolean) => {
    if (!open) onClose();
  };
  const saveHeart = () => {
    saveWithoutTrip(place, toast);
    onClose();
  };
  const body = (
    <div className="tpk">
      {place.park ? <p className="tpk-lead">A park is the area of a trip, not a stop. Pick a trip, then choose the places in {place.name} to add.</p> : null}
      {rows.length ? (
        <ul className="tpk-list" aria-label="Your trips">
          {rows.map(({ row, href, on }) => (
            <li key={row.item.id} className="tpk-row">
              <MineThumb space="trip" slug={row.item.slug} known={row.item.photo} icon="route" ring={copyIdentity(row.item)} />
              <div className="tpk-main">
                <p className="tpk-name">{row.title}</p>
                <p className="tpk-when">{row.when}</p>
                <p className="tpk-who">{row.who}</p>
                <p className="tpk-day" data-on={on !== null ? '' : undefined}>
                  {place.park ? 'Choose the places next' : on !== null ? `Already on Day ${on}` : 'The best day is picked next'}
                </p>
              </div>
              {/* a plain link on purpose: Next would prefetch every row's trip page as it scrolls in, a request per trip for nothing */}
              <a href={href} className={buttonClass({ size: 'sm', className: 'tpk-add' })} aria-label={`${place.park ? 'Add places in' : 'Add'} ${place.name} to ${row.title}`}>
                Add
              </a>
            </li>
          ))}
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
  return phone ? (
    <BottomSheet open onOpenChange={change} title={title} snaps={['half', 'full']} initial="half" className="tpk-sheet">
      {body}
    </BottomSheet>
  ) : (
    <SideSheet open onOpenChange={change} title={title} modal="trap-focus" className="tpk-sheet">
      {body}
    </SideSheet>
  );
}
