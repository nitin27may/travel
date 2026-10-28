'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { ExportFormat } from '@/components/actions/ExportMenu';
import { ShareButton } from '@/components/actions/ShareButton';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

// the export menu is its own chunk, as in TripActions
const ExportMenu = dynamic(() => import('@/components/actions/ExportMenu').then((m) => m.ExportMenu), {
  ssr: false,
  loading: () => (
    <Button disabled>
      <Icon name="download" size={15} /> Export trip
    </Button>
  ),
});
const FORMATS: ExportFormat[] = ['pdf', 'ics', 'gpx', 'kml', 'csv'];

interface Props {
  /**
   * The public trip's slug: the files and the print are made from the page's plan. null for a built trip (no template): it has no public
   * export or address until STEP2-B1 defines them, so Export and Share are not offered and its private id never goes into a request path
   * or a shared link (review STEP2-ES ES-008).
   */
  slug: string | null;
  /** The public trip's title, for Share: the person's own title stays on the device (review STEP2-ES ES-007). */
  shareTitle: string;
  /** The public trip's address, for Share (never the person's settings, edit-mode-spec 14). null with no public trip. */
  url: string | null;
  onEdit: () => void;
  onPrefetch?: () => void;
  /** null: the trip has no dates yet, so the second button is Add dates. */
  onCalendar: (() => void) | null;
  onAddDates: () => void;
  /** Edit mode is on: Edit trip becomes a secondary Done (ruling C1) and the cover gains its `⋯`. */
  editing?: boolean;
  /** The edit chunk is loading after a press: a 14 px spinner, the page unchanged (patterns 3.13 item 14). */
  loading?: boolean;
  onDone?: () => void;
  tripMenu?: ReactNode;
}

/**
 * The cover's actions on the person's own trip (step2 README 5.2): Edit trip is the one filled button, Add to calendar (dated) or Add dates
 * (undated) the first secondary, then Export and Share as on the published plan. `TripActions` is the published plan's and is not touched:
 * it sits in the public page's start chunk, which has under 1 KB of headroom.
 */
export function OwnActions({ slug, shareTitle, url, onEdit, onPrefetch, onCalendar, onAddDates, editing, loading, onDone, tripMenu }: Props) {
  return (
    <div className="trip-actions" data-print="hide">
      {editing ? (
        <Button onClick={onDone}>Done</Button>
      ) : (
        <Button variant="primary" loading={loading} onClick={onEdit} onPointerEnter={onPrefetch} onFocus={onPrefetch}>
          <Icon name="pencil" size={15} /> Edit trip
        </Button>
      )}
      {onCalendar ? (
        <Button onClick={onCalendar}>
          <Icon name="calendar" size={15} /> Add to calendar
        </Button>
      ) : (
        <Button onClick={onAddDates}>
          <Icon name="calendar" size={15} /> Add dates
        </Button>
      )}
      {slug ? <ExportMenu target={{ type: 'trip', slug }} formats={FORMATS} label="Export trip" /> : null}
      {slug && url ? <ShareButton url={url} title={shareTitle} /> : null}
      {tripMenu}
    </div>
  );
}
