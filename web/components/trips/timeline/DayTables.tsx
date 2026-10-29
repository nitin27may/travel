'use client';

// The Days tab's Table view (UXB-5; spec trip-and-places-ux-fixes 7, components 4.6): one real <table> per day, in time order, from the timelines the
// List shows. A lazy chunk: the trip page's start JS carries only the List | Table switch. Read-only; in edit mode a line says where editing works (H10).
import { useEffect, useMemo } from 'react';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance, formatElevation } from '@/lib/format/units';
import { lastStart } from './DayTimeline';
import { flightEntries, localEntries } from './marks';
import type { TimelineDayModel } from './model';
import { Prose } from './Prose';
import { rowsOf, type RowContext, type TableRow, type TableRowsMode } from './tableRows';
import { warnText } from './warnText';

interface Props {
  days: readonly TimelineDayModel[];
  /** The timelines on screen (the profile's, with the version and additions the visitor chose). */
  timelines: readonly DayTimeline[];
  /** The place's area by place slug: the trip's own Stops rows carry it. */
  areas: Readonly<Record<string, string>>;
  mode: TableRowsMode;
  /** Your own trip in edit mode: the table stays read-only and says where editing works. */
  editing?: boolean;
  onList: () => void;
  /** The tables are on screen: the page puts the day that was in view back in view. */
  onShown?: () => void;
}

const HEADS: { label: string; wide?: boolean; cls: string }[] = [
  { label: 'Time', cls: 'dt-c-time' }, { label: 'What', cls: 'dt-c-what' }, { label: 'Kind', wide: true, cls: 'dt-c-kind' },
  { label: 'Where', wide: true, cls: 'dt-c-where' }, { label: 'Takes', cls: 'dt-c-takes' }, { label: 'Notes, book', wide: true, cls: 'dt-c-notes' },
];

/** "Show Everything | Stops only" and "Print this table", above the tables. Own export so the bar can place it beside the List | Table switch. */
export function TableTools({ mode, onMode }: { mode: TableRowsMode; onMode: (m: TableRowsMode) => void }) {
  return (
    <div className="dt-tools" data-print="hide">
      <span className="dt-tools-label" id="dt-show">Show</span>
      <Segmented
        label="Rows shown"
        size="s"
        value={mode}
        onChange={onMode}
        segments={[
          { value: 'all', label: 'Everything' },
          { value: 'stops', label: 'Stops only', title: 'The stops and walks, as the exported file lists them' },
        ]}
      />
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        <Icon name="print" size={14} /> Print this table
      </Button>
    </div>
  );
}

function Row({ r }: { r: TableRow }) {
  const kindWhere = [r.kind, r.where].filter(Boolean).join(' · ');
  return (
    <tr className="dt-row" data-leg={r.leg || undefined} data-inside={r.inside || undefined} data-quiet={r.quiet || undefined}>
      <th scope="row" className="dt-time num">
        {r.time ? r.time : <><span aria-hidden="true">-</span><span className="sr-only">no time</span></>}
      </th>
      <td className="dt-what">
        <span className="dt-name">{r.href ? <a href={r.href}>{r.name}</a> : r.name}</span>
        <span className="dt-fold num">{kindWhere}</span>
        {r.notes.length || r.warns.length ? (
          <span className="dt-fold dt-fold-notes">
            {r.notes.map((n) => <span key={n}><Prose text={n} /></span>)}
            {r.warns.map((w) => <span key={w} className="dt-warn"><Icon name="warn" size={12} /> <Prose text={warnText(w)} /></span>)}
          </span>
        ) : null}
      </td>
      <td className="dt-x dt-kind num">{r.kind}</td>
      <td className="dt-x dt-where">{r.where}</td>
      <td className="dt-takes num">{r.takes.split(' · ').map((t, i) => <span key={t} className={i === 0 ? 'dt-t' : 'dt-d'}>{t}</span>)}</td>
      <td className="dt-x dt-notes">
        {r.notes.map((n) => <span key={n}><Prose text={n} /></span>)}
        {r.warns.map((w) => <span key={w} className="dt-warn"><Icon name="warn" size={12} /> <Prose text={warnText(w)} /></span>)}
      </td>
    </tr>
  );
}

/** One table per day, in day order, so a screen reader's table list is the day list. */
export function DayTables({ days, timelines, areas, mode, editing, onList, onShown }: Props) {
  const [prefs] = usePrefs();
  useEffect(() => onShown?.(), []); // eslint-disable-line react-hooks/exhaustive-deps -- once, when the tables first appear
  const tables = useMemo(() => {
    return days.flatMap((d) => {
      const base = timelines.find((t) => t.day === d.n);
      if (!base) return [];
      // display only, as the List does: a time-zone line and a flight change what the clock says, never the order
      const tl: DayTimeline = { ...base, entries: localEntries(flightEntries(base.entries, d.flight), d.zone) };
      const items = new Map(d.input.variants.flatMap((v) => v.items).map((i) => [i.id, i]));
      const cx: RowContext = {
        areaOf: (slug) => areas[slug] ?? null,
        base: d.base,
        distance: (km) => formatDistance(km, prefs.distance),
        elevation: (m) => formatElevation(m, prefs.elevation),
        lastStart,
        items,
      };
      const sel = d.variants.find((v) => v.key === tl.variant.key);
      return [{ d, tl, title: sel?.title ?? d.title, rows: rowsOf(tl, mode, cx), warns: tl.warnings.filter((w) => !w.entryId || !tl.entries.some((e) => e.id === w.entryId)) }];
    });
  }, [days, timelines, areas, mode, prefs.distance, prefs.elevation]);

  return (
    <>
      {editing ? (
        <p className="dt-edit" role="note" data-testid="table-edit-line" data-print="hide">
          <span>Editing works in List.</span>
          <Button size="sm" variant="secondary" onClick={onList}>Switch to List</Button>
        </p>
      ) : null}
      <ol className="tl-days dt-days" data-view="table" aria-label="Days as tables">
        {tables.map(({ d, tl, title, rows, warns }) => {
          const span = tl.span.minutes > 0 && !tl.blocks ? `${tl.span.start} to ${tl.span.end}` : null;
          const drive = tl.totals.driveMin > 0 ? `${fmtHM(tl.totals.driveMin)} driving` : null;
          return (
            <li key={d.n} id={`day-${d.n}`} className="tl-day dt-day" data-testid={`day-table-${d.n}`}>
              <table className="dt">
                <caption className="dt-cap">
                  <span className="dt-cap-sign">Day {String(d.n).padStart(2, '0')}</span>
                  {' · '}
                  <span className="dt-cap-title">{title}</span>
                  {[span, drive].filter(Boolean).map((t) => <span key={t} className="dt-cap-meta num">{' · '}{t}</span>)}
                </caption>
                <thead>
                  <tr>
                    {HEADS.map((h) => <th key={h.label} scope="col" className={h.wide ? `dt-x ${h.cls}` : h.cls}>{h.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => <Row key={r.id} r={r} />)}
                  {rows.length === 0 ? (
                    <tr><td colSpan={HEADS.length} className="dt-empty">No stops are planned for this day yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
              {warns.length ? (
                <ul className="dt-day-warns">
                  {warns.map((w) => <li key={`${w.code}:${w.message}`} className="dt-warn"><Icon name="warn" size={13} /> <Prose text={warnText(w.message)} /></li>)}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default DayTables;
