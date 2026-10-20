'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnSizingState, Row as TRow, SortingState, VisibilityState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { KeyboardEvent } from 'react';
import { DataTableShell, useScrollCue } from '@/components/ui/DataTable';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Popover } from '@/components/ui/Popover';
import { Segmented } from '@/components/ui/Segmented';
import { parseSort, serialiseSort } from '@/lib/entities/sort';
import { usePrefs } from '@/lib/format/prefs';
import { SavedViewsMenu } from './SavedViewsMenu';
import type { ViewProps } from './viewTypes';

export const VIRTUALISE_OVER = 300;
const ROW_HEIGHT = { comfortable: 44, compact: 32 } as const;
const GROUP_HEIGHT = 40;

interface ColMeta {
  label: string;
  align?: 'right';
  text: (row: never) => string | number;
  csvLabel?: string;
}

type DisplayItem<Row> = { kind: 'group'; key: string; title: string; subtitle: string; count: number; open: boolean } | { kind: 'row'; row: TRow<Row> };

export function TableView<Row>({ d, groups, state, onState, onOpen }: ViewProps<Row>) {
  const [prefs, setPrefs] = usePrefs();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sizing, setSizing] = useState<ColumnSizingState>({});
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cue = useScrollCue(scrollRef);

  const visibleIds = state.cols ?? d.defaultColumns;
  const visibility: VisibilityState = useMemo(() => Object.fromEntries(d.columns.map((c) => [c.id as string, visibleIds.includes(c.id as string)])), [d.columns, visibleIds]);
  const sorting: SortingState = useMemo(() => parseSort(state.sort).map((k) => ({ id: k.id, desc: k.desc })), [state.sort]);
  const data = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's documented hook
  const table = useReactTable<Row>({
    data,
    columns: d.columns as never,
    getRowId: (r) => d.id(r),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // sorting happens once in lib/entities/sort so every view agrees
    state: { sorting, columnVisibility: visibility, columnSizing: sizing },
    onColumnSizingChange: setSizing,
    columnResizeMode: 'onChange',
    enableSortingRemoval: true,
  });

  const byId = new Map(table.getRowModel().rows.map((r) => [r.id, r]));
  const items: DisplayItem<Row>[] = [];
  for (const g of groups) {
    const open = !collapsed.has(g.key);
    if (g.key) items.push({ kind: 'group', key: g.key, title: g.title, subtitle: g.subtitle, count: g.rows.length, open });
    if (open || !g.key) {
      for (const r of g.rows) {
        const tr = byId.get(d.id(r));
        if (tr) items.push({ kind: 'row', row: tr });
      }
    }
  }
  const firstRowId = items.find((i) => i.kind === 'row')?.kind === 'row' ? d.id((items.find((i) => i.kind === 'row') as { row: TRow<Row> }).row.original) : null;

  const virtual = items.length > VIRTUALISE_OVER;
  const rowH = ROW_HEIGHT[prefs.density];
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i]?.kind === 'group' ? GROUP_HEIGHT : rowH),
    overscan: 12,
    enabled: virtual,
  });

  const setSort = useCallback(
    (id: string) => {
      const cur = parseSort(state.sort)[0];
      let next: string[];
      if (!cur || cur.id !== id) next = [id];
      else if (!cur.desc) next = serialiseSort([{ id, desc: true }]);
      else next = [];
      onState({ ...state, sort: next }, 'push');
    },
    [state, onState],
  );

  const open = (item: DisplayItem<Row> & { kind: 'row' }, el: HTMLElement) => {
    const id = d.id(item.row.original);
    if (d.primary === 'link') {
      const href = d.href(item.row.original);
      if (href) window.location.assign(href);
    } else onOpen(id, el);
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, item: DisplayItem<Row> & { kind: 'row' }) => {
    const rows = Array.from(scrollRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row]') ?? []);
    const i = rows.indexOf(e.currentTarget);
    const go = (n: number) => {
      const target = rows[Math.max(0, Math.min(rows.length - 1, n))];
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(rows.length - 1);
    else if (e.key === 'PageDown') go(i + 10);
    else if (e.key === 'PageUp') go(i - 10);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(item, e.currentTarget);
    }
  };

  const leafCols = table.getVisibleLeafColumns();
  const totalWidth = leafCols.reduce((n, c) => n + c.getSize(), 0);
  const chooserCols = d.columns.filter((c) => (c.meta as ColMeta | undefined)?.label);

  const renderRow = (item: DisplayItem<Row>, style?: CSSProperties, measure?: (el: HTMLTableRowElement | null) => void, index?: number) => {
    if (item.kind === 'group') {
      return (
        <tr key={`g:${item.key}`} className="grp-row" style={style} ref={measure} data-index={index}>
          <th colSpan={leafCols.length} scope="rowgroup">
            <button
              type="button"
              className="grp-toggle"
              aria-expanded={item.open}
              onClick={() =>
                setCollapsed((s) => {
                  const n = new Set(s);
                  if (n.has(item.key)) n.delete(item.key);
                  else n.add(item.key);
                  return n;
                })
              }
            >
              <Icon name="chevronRight" size={14} className="grp-caret" />
              <span className="gh-title">{item.title}</span>
              {item.subtitle ? <span className="gh-sub">{item.subtitle}</span> : null}
              <span className="gh-count num">{item.count}</span>
            </button>
          </th>
        </tr>
      );
    }
    const id = d.id(item.row.original);
    return (
      <tr
        key={item.row.id}
        data-row
        data-entity-id={id}
        data-focused={state.focus === id || undefined}
        data-fade={d.fade?.(item.row.original)}
        data-from={d.fadeFrom?.(item.row.original)}
        data-fade-by={d.fadeFrom?.(item.row.original) !== undefined ? d.fadeBy : undefined}
        tabIndex={(activeRow ?? firstRowId) === id ? 0 : -1}
        style={style}
        ref={measure}
        data-index={index}
        onKeyDown={(e) => onRowKey(e, item)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a,button')) return;
          open(item, e.currentTarget);
        }}
        onFocus={(e) => {
          // roving tabindex: the last focused row is the single tab stop
          if (e.target === e.currentTarget) setActiveRow(id);
        }}
      >
        {item.row.getVisibleCells().map((cell) => {
          const m = cell.column.columnDef.meta as ColMeta | undefined;
          const first = cell.column.id === leafCols[0]?.id;
          return (
            <td key={cell.id} data-align={m?.align} style={{ width: cell.column.getSize() }}>
              {first && d.primary === 'sheet' ? (
                <a
                  className="cell-link"
                  tabIndex={-1}
                  href={`?${new URLSearchParams({ focus: id }).toString()}`}
                  data-open-id={id}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpen(id, e.currentTarget);
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </a>
              ) : first && d.href(item.row.original) ? (
                <a className="cell-link" href={d.href(item.row.original) ?? undefined} tabIndex={-1}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </a>
              ) : (
                flexRender(cell.column.columnDef.cell, cell.getContext())
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  const vItems = virtual ? virtualizer.getVirtualItems() : [];
  const padTop = virtual && vItems.length ? vItems[0].start : 0;
  const padBottom = virtual && vItems.length ? virtualizer.getTotalSize() - vItems[vItems.length - 1].end : 0;

  const tools = (
    <>
      <SavedViewsMenu state={state} onState={onState} />
      <Popover
        trigger={
          <>
            <Icon name="columns" size={15} /> Columns
          </>
        }
        triggerClassName="btn btn-sm"
        label="Choose columns"
        align="end"
      >
        <fieldset className="facet-options">
          <legend className="popover-title">Columns</legend>
          <ul>
            {chooserCols.map((c) => {
              const id = c.id as string;
              const on = visibleIds.includes(id);
              return (
                <li key={id}>
                  <Checkbox
                    checked={on}
                    disabled={on && visibleIds.length === 1}
                    onChange={() => {
                      const ordered = d.columns.map((x) => x.id as string).filter((x) => (x === id ? !on : visibleIds.includes(x)));
                      const isDefault = ordered.join() === d.defaultColumns.join();
                      onState({ ...state, cols: isDefault ? null : ordered }, 'replace');
                    }}
                  >
                    {(c.meta as ColMeta).label}
                  </Checkbox>
                </li>
              );
            })}
          </ul>
          <button type="button" className="link-btn" onClick={() => onState({ ...state, cols: null }, 'replace')}>
            Reset to default
          </button>
        </fieldset>
      </Popover>
      <Segmented
        label="Row density"
        size="s"
        value={prefs.density}
        onChange={(density) => setPrefs({ density })}
        segments={[
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
        ]}
      />
    </>
  );

  return (
    <DataTableShell tools={tools} density={prefs.density} scrollRef={scrollRef} cue={cue}>
        <table className="data-table" style={{ width: Math.max(totalWidth, 0), minWidth: '100%' }} aria-rowcount={data.length}>
          <caption className="sr-only">
            {d.noun.many}, {data.length} rows. Use the arrow keys to move between rows and Enter to open one.
          </caption>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const m = h.column.columnDef.meta as ColMeta | undefined;
                  const sorted = h.column.getIsSorted();
                  const canSort = Boolean(d.sorts[h.column.id]); // sorting is ours (lib/entities/sort); columns have no accessors
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      data-align={m?.align}
                      style={{ width: h.getSize() }}
                      aria-sort={canSort ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined}
                    >
                      {canSort ? (
                        <button type="button" className="th-btn" onClick={() => setSort(h.column.id)}>
                          <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                          <Icon name="chevronDown" size={12} className={`th-caret ${sorted ? 'on' : ''} ${sorted === 'asc' ? 'flip' : ''}`} />
                        </button>
                      ) : (
                        <span className="th-plain">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                      )}
                      <div
                        className="resizer"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${m?.label ?? h.column.id} column`}
                        aria-valuenow={Math.round(h.getSize())}
                        tabIndex={0}
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                            e.preventDefault();
                            const delta = e.key === 'ArrowRight' ? 16 : -16;
                            setSizing((s) => ({ ...s, [h.column.id]: Math.max(70, h.getSize() + delta) }));
                          }
                        }}
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtual ? (
              <>
                {padTop > 0 ? <tr aria-hidden="true" style={{ height: padTop }} /> : null}
                {vItems.map((v) => renderRow(items[v.index], { height: items[v.index].kind === 'group' ? GROUP_HEIGHT : rowH }, virtualizer.measureElement, v.index))}
                {padBottom > 0 ? <tr aria-hidden="true" style={{ height: padBottom }} /> : null}
              </>
            ) : (
              items.map((item) => renderRow(item))
            )}
          </tbody>
        </table>
    </DataTableShell>
  );
}
