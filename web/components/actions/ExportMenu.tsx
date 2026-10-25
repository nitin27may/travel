'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { tripLegs } from '@/lib/client/data';
import type { TripLegs } from '@travel/core/schema/api/index.ts';
import { downloadGpx, downloadKml, downloadTripCsv, loadExport } from '@/lib/export/client';
import type { Generated } from '@/lib/export/client';
import { checkPoint } from '@/lib/export/licence';
import { forPage } from '@/lib/export/plan';
import { getTimeline, subscribeTimeline } from '@/lib/export/timelineState';
import { routeLines } from '@/lib/export/routes';
import type { ExportLine, PlaceExport, TripExport } from '@/lib/export/types';
import '@/styles/print.css';
import { TripPrintView } from './TripPrintView';

export type ExportFormat = 'pdf' | 'ics' | 'gpx' | 'kml' | 'csv';

/** One trip or one place. There is no whole-list export: the table's CSV is gone from the public site (principle P8). */
export interface ExportMenuProps {
  target: { type: 'trip' | 'place'; slug?: string };
  formats: ExportFormat[];
  /** The button's words: "Export trip" at the top of a trip page, "Export" in its plan bar. */
  label?: string;
  /** `sm` is the 36 px secondary button of the plan bar. */
  size?: 'sm' | 'md';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Export menu (components 5.2). Each entry names what it holds, in plain words. Everything is generated in the browser from the page's own
 * data: a trip prints from its `json` export model, GPX and KML pass the licence guard and carry the trip's routed legs as lines when it has
 * them, CSV is one row per stop. The calendar is not offered here for a public trip, because the public trip has no dates: it lives in Copy
 * to my trips. The routed legs are read once, when a route file is asked for (they are the map's request too, so it is the same answer).
 */
export function ExportMenu({ target, formats, label = 'Export', size = 'md' }: ExportMenuProps) {
  const { toast } = useToast();
  const [data, setData] = useState<TripExport | PlaceExport | null>(null);
  const [printing, setPrinting] = useState<TripExport | null>(null);
  const needsData = !!target.slug;
  // the plan on the page (profile and version): the files and their counts follow it
  const session = useSyncExternalStore(subscribeTimeline, () => (target.type === 'trip' && target.slug ? getTimeline(target.slug) : null), () => null);
  // `undefined` until the legs settle; the map asks for the same file, so the browser has it once
  const [legs, setLegs] = useState<TripLegs | null | undefined>(undefined);
  useEffect(() => {
    if (target.type !== 'trip' || !target.slug || !session) return;
    let live = true;
    tripLegs(target.slug).catch(() => null).then((l) => live && setLegs(l));
    return () => { live = false; };
  }, [target.type, target.slug, !!session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!needsData || !target.slug) return;
    let live = true;
    const p = target.type === 'trip' ? loadExport('trip', target.slug) : loadExport('place', target.slug);
    p.then((d) => live && setData(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [needsData, target.slug, target.type]);

  // Printing: the trip's own print view is mounted, the page is hidden for the print, and both go away when the dialog closes.
  useEffect(() => {
    if (!printing) return;
    const root = document.documentElement;
    root.setAttribute('data-print-model', '');
    const done = () => {
      root.removeAttribute('data-print-model');
      setPrinting(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      root.removeAttribute('data-print-model');
    };
  }, [printing]);

  const model = useCallback(async () => data ?? (target.type === 'trip' ? await loadExport('trip', target.slug!) : await loadExport('place', target.slug!)), [data, target.slug, target.type]);

  const run = useCallback(
    async (make: (d: TripExport | PlaceExport, routes: ExportLine[]) => Generated) => {
      try {
        const whole = await model();
        // the plan on the page, not every version; the routed legs only for a trip, and a failed read leaves the points alone
        const sess = whole.type === 'trip' ? getTimeline(whole.slug) : null;
        const d = whole.type === 'trip' ? forPage(whole, sess) : whole;
        const routes = d.type === 'trip' && whole.type === 'trip' ? routeLines(await tripLegs(d.slug).catch(() => null), whole, sess) : [];
        const r = make(d, routes);
        toast({ message: `Downloaded ${r.name} · ${r.summary}` });
      } catch {
        toast({ message: 'Could not build that file. Try again.' });
      }
    },
    [model, toast],
  );

  const print = useCallback(async () => {
    if (target.type !== 'trip') {
      window.print();
      return;
    }
    try {
      const d = await model();
      if (d.type === 'trip') setPrinting(d);
      else window.print();
    } catch {
      toast({ message: 'Could not build that file. Try again.' });
    }
  }, [model, target.type, toast]);

  const shown = data?.type === 'trip' ? forPage(data, session) : data;
  const wptCount = shown ? shown.waypoints.filter((w) => checkPoint(w.point).ok).length : null;
  const routeCount = data?.type === 'trip' && session && legs !== undefined ? routeLines(legs, data, session).length : null;
  const entries: MenuEntry[] = [];
  const isOverview = data?.type === 'trip' && data.depth === 'overview';

  for (const f of formats) {
    if (f === 'pdf') {
      entries.push({ label: target.type === 'trip' ? 'Print or save as PDF' : 'PDF: print this page', icon: 'print', onSelect: () => void print() });
    } else if (f === 'ics') {
      if (target.type !== 'trip' || isOverview) continue;
      entries.push({ label: 'Calendar: pick dates first', icon: 'calendar', disabled: true, shortcut: 'Copy to my trips' });
    } else if (f === 'gpx' || f === 'kml') {
      const word = f.toUpperCase();
      const none = wptCount === 0;
      // a trip's row leads with what the file is for, then its own counts for the plan on the page; a place keeps the short form
      const head = target.type === 'trip' ? `${f === 'gpx' ? 'For a GPS or hiking app' : 'For Google Earth or My Maps'} (${word})` : word;
      const counts =
        wptCount === null ? '' : `: ${plural(wptCount, 'point')}${target.type !== 'trip' || routeCount === null ? '' : routeCount === 0 ? ', no route lines for this plan' : `, ${plural(routeCount, 'route')}`}`;
      entries.push({
        label: none ? `${head}: no licensed points` : `${head}${counts}`,
        icon: 'download',
        disabled: none,
        onSelect: () => void run(f === 'gpx' ? downloadGpx : downloadKml),
      });
    } else if (f === 'csv') {
      if (target.type === 'trip') {
        if (isOverview) continue;
        const n = shown?.type === 'trip' ? shown.stops.length : null;
        entries.push({ label: n === null ? 'For a spreadsheet (CSV)' : `For a spreadsheet (CSV): ${plural(n, 'stop')}`, icon: 'download', onSelect: () => void run((d) => downloadTripCsv(d as TripExport)) });
      }
    }
  }
  if (entries.length === 0) return null;
  return (
    <span data-export-menu={target.type} className="export-menu">
      <Menu
        trigger={
          <>
            <Icon name="download" size={15} /> {label}
          </>
        }
        triggerClassName={size === 'sm' ? 'btn btn-sm' : 'btn'}
        triggerLabel={size === 'sm' && target.type === 'trip' ? 'Export trip' : undefined}
        align={size === 'sm' ? 'end' : 'start'}
        entries={entries}
      />
      {printing ? createPortal(<TripPrintView data={printing} session={getTimeline(printing.slug)} />, document.body) : null}
    </span>
  );
}
