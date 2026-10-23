'use client';

import { useState } from 'react';
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

/** Copy to my trips, Export and Share. The three parts are L5's components; this only places them. */
/** First and last day of the season as "MM-DD" (no year: public trips are dateless). A run may wrap the new year. */
export function seasonWindow(months: number[] | undefined): { from: string; to: string } | undefined {
  if (!months?.length) return undefined;
  const set = new Set(months);
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? months[0];
  let end = start;
  while (set.has(end === 12 ? 1 : end + 1) && end !== (start === 1 ? 12 : start - 1)) end = end === 12 ? 1 : end + 1;
  const last = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][end - 1];
  const mm = (m: number) => String(m).padStart(2, '0');
  return { from: `${mm(start)}-01`, to: `${mm(end)}-${last}` };
}

export function TripActions({ slug, title, nights, days, url, hasDays, seasonMonths, done, className }: Props) {
  const [copying, setCopying] = useState(false);
  const [sheetEver, setSheetEver] = useState(false);
  return (
    <div className={className ?? 'trip-actions'} data-print="hide">
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
      {hasDays && sheetEver ? <CopySheet trip={{ slug, title, nights, days, window: seasonWindow(seasonMonths) }} open={copying} onClose={() => setCopying(false)} /> : null}
    </div>
  );
}
