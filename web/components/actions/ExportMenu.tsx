'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { downloadGpx, downloadKml, downloadListCsv, downloadTripCsv, loadExport } from '@/lib/export/client';
import type { Generated } from '@/lib/export/client';
import { checkPoint } from '@/lib/export/licence';
import type { PlaceExport, TripExport } from '@/lib/export/types';
import '@/styles/print.css';

export type ExportFormat = 'pdf' | 'ics' | 'gpx' | 'kml' | 'csv';

/** Final props (lane L0). For `list`, `rows` are objects (columns = the first row's keys) or arrays whose first row is the header. */
export interface ExportMenuProps {
  target: { type: 'trip' | 'place' | 'list'; slug?: string; rows?: unknown[] };
  formats: ExportFormat[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Export menu (components 5.2). Each entry names what it holds. Everything is generated in the browser from the
 * page's own data: PDF is the print stylesheet, GPX and KML pass the licence guard, CSV is one row per stop.
 * The calendar is not offered here for a public trip, because the public trip has no dates: it lives in Copy to my trips.
 */
export function ExportMenu({ target, formats }: ExportMenuProps) {
  const { toast } = useToast();
  const [data, setData] = useState<TripExport | PlaceExport | null>(null);
  const needsData = target.type !== 'list' && !!target.slug;

  useEffect(() => {
    if (!needsData || !target.slug) return;
    let live = true;
    const p = target.type === 'trip' ? loadExport('trip', target.slug) : loadExport('place', target.slug);
    p.then((d) => live && setData(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [needsData, target.slug, target.type]);

  const run = useCallback(
    async (make: (d: TripExport | PlaceExport) => Generated) => {
      try {
        const d = data ?? (target.type === 'trip' ? await loadExport('trip', target.slug!) : await loadExport('place', target.slug!));
        const r = make(d);
        toast({ message: `Downloaded ${r.name} · ${r.summary}` });
      } catch {
        toast({ message: 'Could not build that file. Try again.' });
      }
    },
    [data, target.slug, target.type, toast],
  );

  const wptCount = data ? data.waypoints.filter((w) => checkPoint(w.point).ok).length : null;
  const entries: MenuEntry[] = [];
  const isOverview = data?.type === 'trip' && data.depth === 'overview';

  for (const f of formats) {
    if (f === 'pdf') {
      entries.push({ label: 'PDF: print this page', icon: 'download', onSelect: () => window.print() });
    } else if (f === 'ics') {
      if (target.type !== 'trip' || isOverview) continue;
      entries.push({ label: 'Calendar: pick dates first', icon: 'calendar', disabled: true, shortcut: 'Copy to my trips' });
    } else if (f === 'gpx' || f === 'kml') {
      const word = f.toUpperCase();
      if (target.type === 'list') continue;
      const none = wptCount === 0;
      entries.push({
        label: none ? `${word}: no licensed points` : wptCount === null ? word : `${word}: ${plural(wptCount, 'point')}`,
        icon: 'download',
        disabled: none,
        onSelect: () => void run(f === 'gpx' ? downloadGpx : downloadKml),
      });
    } else if (f === 'csv') {
      if (target.type === 'trip') {
        if (isOverview) continue;
        const n = data?.type === 'trip' ? data.stops.length : null;
        entries.push({ label: n === null ? 'CSV' : `CSV: ${plural(n, 'stop')}`, icon: 'download', onSelect: () => void run((d) => downloadTripCsv(d as TripExport)) });
      } else if (target.type === 'list') {
        const rows = target.rows ?? [];
        entries.push({
          label: `CSV: ${plural(Array.isArray(rows[0]) ? rows.length - 1 : rows.length, 'row')}`,
          icon: 'download',
          disabled: rows.length === 0,
          onSelect: () => {
            const r = downloadListCsv(target.slug ?? 'list', rows);
            toast({ message: `Downloaded ${r.name} · ${r.summary}` });
          },
        });
      }
    }
  }
  if (entries.length === 0) return null;
  return (
    <span data-export-menu={target.type} className="export-menu">
      <Menu
        trigger={
          <>
            <Icon name="download" size={15} /> Export
          </>
        }
        triggerClassName="btn"
        entries={entries}
      />
    </span>
  );
}
