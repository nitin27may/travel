'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { tripLegs } from '@/lib/client/data';
import { PRINT_KEY } from '@/lib/mine/keys';
import { readSession, removeSession } from '@/lib/storage/safe';
import type { TripLegs } from '@travel/core/schema/api/index.ts';
import { downloadGpx, downloadKml, downloadTripCsv, loadExport } from '@/lib/export/client';
import type { Generated } from '@/lib/export/client';
import { checkPoint } from '@/lib/export/licence';
import { forPage } from '@/lib/export/plan';
import { getTimeline, subscribeTimeline } from '@/lib/export/timelineState';
import { routeLines } from '@/lib/export/routes';
import { getOwn, subscribeOwn } from '@/lib/export/ownState';
import { downloadOwnIcs, NoCalendarError, ownModel, ownTimelines } from '@/lib/export/own';
import { icsEventCount } from '@travel/core/export/ics.ts';
import type { ExportLine, PlaceExport, TripExport } from '@/lib/export/types';
import '@/styles/print.css';
import { TripPrintView } from './TripPrintView';
import { readParkLines } from '@/lib/export/printParks';

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

/** The trip as the page shows it: the person's own trip is rebuilt from their timelines (lib/export/own.ts), a published one is filtered to the plan on the page. */
const asShown = (m: TripExport, session: ReturnType<typeof getTimeline>): TripExport => {
  const own = getOwn(m.slug);
  return own && session ? ownModel(m, session, own) : forPage(m, session);
};

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
  // the person's own trip (STEP2-E6): published by the shell; null on a published trip's page
  const own = useSyncExternalStore(subscribeOwn, () => (target.type === 'trip' && target.slug ? getOwn(target.slug) : null), () => null);
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

  // Print from Mine (spec 5.2, review NAV-R2 I1): Mine leaves the trip's slug in sessionStorage and opens this page. Read once, removed at
  // once (a shared or bookmarked link never prints), then print through the same path as Export > PDF when the data and the timeline are in.
  // No timer. A browser that wants a tap for print() (WebKit after a navigation) gets a notice with a Print button instead.
  const armed = useRef<boolean | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (target.type !== 'trip' || !target.slug) return;
    if (armed.current === null) {
      armed.current = readSession(PRINT_KEY) === target.slug;
      if (armed.current) removeSession(PRINT_KEY);
    }
    if (!armed.current || !data || data.type !== 'trip') return;
    // a trip without days (an overview) has no timeline to wait for
    if (!session && data.days.length > 0 && data.depth !== 'overview') return;
    armed.current = false;
    const model = asShown(data, session);
    const needsTap = typeof navigator !== 'undefined' && !!navigator.userActivation && !navigator.userActivation.isActive && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
    // state is set from a microtask, not synchronously in the effect
    queueMicrotask(() => (needsTap ? setReady(true) : setPrinting(model)));
  }, [data, session, target.slug, target.type]);
  const model = useCallback(async () => data ?? (target.type === 'trip' ? await loadExport('trip', target.slug!) : await loadExport('place', target.slug!)), [data, target.slug, target.type]);

  const run = useCallback(
    async (make: (d: TripExport | PlaceExport, routes: ExportLine[]) => Generated) => {
      try {
        const whole = await model();
        // the plan on the page, not every version; the routed legs only for a trip, and a failed read leaves the points alone
        const sess = whole.type === 'trip' ? getTimeline(whole.slug) : null;
        const d = whole.type === 'trip' ? asShown(whole, sess) : whole;
        const routes = d.type === 'trip' && whole.type === 'trip' ? routeLines(await tripLegs(d.slug).catch(() => null), getOwn(d.slug) ? d : whole, sess) : [];
        const r = make(d, routes);
        toast({ message: `Downloaded ${r.name} · ${r.summary}` });
      } catch {
        toast({ message: 'Could not build that file. Try again.' });
      }
    },
    [model, toast],
  );

  // the person's calendar file: the edited timelines with their notes (never the published plan's)
  const runIcs = useCallback(async () => {
    try {
      const whole = await model();
      const sess = whole.type === 'trip' ? getTimeline(whole.slug) : null;
      const mine = whole.type === 'trip' ? getOwn(whole.slug) : null;
      if (whole.type !== 'trip' || !sess || !mine) throw new Error('not ready');
      const r = downloadOwnIcs(whole, sess, mine);
      toast({ message: `Downloaded ${r.name} · ${r.summary}` });
    } catch (e) {
      toast({ message: e instanceof NoCalendarError ? 'This trip has no day plan to put in a calendar.' : 'Could not build that file. Try again.' });
    }
  }, [model, toast]);

  const print = useCallback(async () => {
    if (target.type !== 'trip') {
      window.print();
      return;
    }
    try {
      const d = await model();
      if (d.type === 'trip') setPrinting(asShown(d, getTimeline(d.slug)));
      else window.print();
    } catch {
      toast({ message: 'Could not build that file. Try again.' });
    }
  }, [model, target.type, toast]);

  // the same print path for the copy sheet's PDF button on the trip page: one listener answers, even with two menus on the page
  useEffect(() => {
    if (target.type !== 'trip' || !target.slug) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ slug: string; handled?: boolean }>).detail;
      if (!d || d.slug !== target.slug || d.handled) return;
      d.handled = true;
      void print();
    };
    window.addEventListener('travel:print', on);
    return () => window.removeEventListener('travel:print', on);
  }, [print, target.slug, target.type]);

  const shown = data?.type === 'trip' ? asShown(data, session) : data;
  const wptCount = shown ? shown.waypoints.filter((w) => checkPoint(w.point).ok).length : null;
  const routeCount = data?.type === 'trip' && session && legs !== undefined ? routeLines(legs, own && shown?.type === 'trip' ? shown : data, session).length : null;
  const entries: MenuEntry[] = [];
  const isOverview = data?.type === 'trip' && data.depth === 'overview';

  for (const f of formats) {
    if (f === 'pdf') {
      entries.push({ label: target.type === 'trip' ? 'Print or save as PDF' : 'PDF: print this page', icon: 'print', onSelect: () => void print() });
    } else if (f === 'ics') {
      if (target.type !== 'trip' || isOverview) continue;
      if (own && session) {
        if (!own.start) {
          entries.push({ label: 'Calendar: add dates first', icon: 'calendar', disabled: true, shortcut: 'Settings' });
        } else if (shown?.type === 'trip') {
          const c = icsEventCount(shown, { timelines: ownTimelines(session, own), sunPoints: session.sunPoints, full: false });
          entries.push({ label: `Calendar file (ICS): ${plural(c.allDay, 'day')}${c.timed ? `, ${c.timed} timed` : ''}`, icon: 'calendar', onSelect: () => void runIcs() });
        }
        continue;
      }
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
      {ready && data?.type === 'trip'
        ? createPortal(
            <div className="print-ready" data-print="hide">
              <Banner kind="notice" action={<Button size="sm" onClick={() => { setReady(false); setPrinting(asShown(data, session)); }}>Print</Button>}>
                Ready to print {data.title} with your dates.
              </Banner>
            </div>,
            document.body,
          )
        : null}
      {printing ? createPortal(<TripPrintView data={printing} session={getTimeline(printing.slug)} parkLines={readParkLines(printing.slug)} own={getOwn(printing.slug)} />, document.body) : null}
    </span>
  );
}
