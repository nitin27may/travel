'use client';

import dynamic from 'next/dynamic';
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
  /** The public trip's slug: the files and the print are made from the page's plan. */
  slug: string;
  title: string;
  /** The public trip's address, for Share (never the person's settings, edit-mode-spec 14). */
  url: string;
  onEdit: () => void;
  onPrefetch?: () => void;
  /** null: the trip has no dates yet, so the second button is Add dates. */
  onCalendar: (() => void) | null;
  onAddDates: () => void;
}

/**
 * The cover's actions on the person's own trip (step2 README 5.2): Edit trip is the one filled button, Add to calendar (dated) or Add dates
 * (undated) the first secondary, then Export and Share as on the published plan. `TripActions` is the published plan's and is not touched:
 * it sits in the public page's start chunk, which has under 1 KB of headroom.
 */
export function OwnActions({ slug, title, url, onEdit, onPrefetch, onCalendar, onAddDates }: Props) {
  return (
    <div className="trip-actions" data-print="hide">
      <Button variant="primary" onClick={onEdit} onPointerEnter={onPrefetch} onFocus={onPrefetch}>
        <Icon name="pencil" size={15} /> Edit trip
      </Button>
      {onCalendar ? (
        <Button onClick={onCalendar}>
          <Icon name="calendar" size={15} /> Add to calendar
        </Button>
      ) : (
        <Button onClick={onAddDates}>
          <Icon name="calendar" size={15} /> Add dates
        </Button>
      )}
      <ExportMenu target={{ type: 'trip', slug }} formats={FORMATS} label="Export trip" />
      <ShareButton url={url} title={title} />
    </div>
  );
}
