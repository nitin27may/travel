'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ExportFormat } from '@/components/actions/ExportMenu';
import { ShareButton } from '@/components/actions/ShareButton';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface Props {
  slug: string;
  title: string;
  nights: number;
  days: number;
  /** Absolute public URL, for Share. */
  url: string;
  /** Overview trips have no days to copy or export as a route. */
  hasDays: boolean;
  /** Months (1 to 12) the plan is valid for; becomes the copy sheet's valid window. */
  seasonMonths?: number[];
  /** The trip already happened: the page is read-only and the primary action reads "Use as a template". */
  done?: boolean;
  /** The copy's snapshot (NAV-2): the country code (none on a trip page yet) and a same-origin photo path. */
  cc?: string | null;
  photo?: string | null;
  className?: string;
}

// the export menu and the sheet load after first paint; the page stays inside the JS budget
const ExportMenu = dynamic(() => import('@/components/actions/ExportMenu').then((m) => m.ExportMenu), {
  ssr: false,
  loading: () => (
    <Button disabled>
      <Icon name="download" size={15} /> Export trip
    </Button>
  ),
});
// the sheet is only needed after a click, so it stays out of the page's first-load JS
const CopySheet = dynamic(() => import('@/components/actions/CopySheet').then((m) => m.CopySheet), { ssr: false });

const FORMATS: ExportFormat[] = ['pdf', 'ics', 'gpx', 'kml', 'csv'];

/** Copy to my trips, Export and Share. The three parts are L5's components; this only places them. The sheet takes the season window from the months. */
export function TripActions({ slug, title, nights, days, url, hasDays, seasonMonths, done, cc, photo, className }: Props) {
  const [copying, setCopying] = useState(false);
  const [sheetEver, setSheetEver] = useState(false);
  // the favourites heart, after Share in the cover's row only (FAV-1, D11): an import() after hydration, so the page pays the stub alone
  const row = useRef<HTMLDivElement>(null);
  const [Heart, setHeart] = useState<typeof import('@/lib/favourites/heart').FavouriteHeart | null>(null);
  useEffect(() => {
    if (row.current?.closest('.trip-cover')) void import('@/lib/favourites/heart').then((m) => setHeart(() => m.FavouriteHeart));
  }, []);
  return (
    <div ref={row} className={className ?? 'trip-actions'} data-print="hide">
      {hasDays ? (
        <Button variant="primary" onClick={() => {
            setSheetEver(true);
            setCopying(true);
          }}>
          <Icon name="layers" size={15} /> {done ? 'Use as a template' : 'Copy to my trips'}
        </Button>
      ) : null}
      <ExportMenu target={{ type: 'trip', slug }} formats={hasDays ? FORMATS : ['pdf']} label="Export trip" />
      <ShareButton url={url} title={title} />
      {Heart ? <Heart space="trip" slug={slug} name={title} /> : null}
      {hasDays && sheetEver ? <CopySheet trip={{ slug, title, nights, days, seasonMonths, cc, photo }} open={copying} onClose={() => setCopying(false)} onPrint={() => window.dispatchEvent(new CustomEvent('travel:print', { detail: { slug } }))} /> : null}
    </div>
  );
}
