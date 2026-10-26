'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import type { RowModel } from '@/lib/mine/rows';

export interface CopyRowActions {
  onCalendar: (r: RowModel) => void;
  onPrint: (r: RowModel) => void;
  onChangeDates: (r: RowModel) => void;
  onRemove: (r: RowModel) => void;
}

interface Props extends CopyRowActions {
  row: RowModel;
  /** The trip is no longer listed: not a link, the menu becomes a Remove button (spec 5.2). */
  unlisted?: boolean;
  /** The row is collapsing (Remove, 200 ms). */
  collapsing?: boolean;
  /** The row came back through Undo: it expands in. */
  restored?: boolean;
  /** Signed in: the chip "On this device". Signed out every copy is on this device and no chip is drawn. */
  chip?: boolean;
}

/** The three dots of the row menu (18 px, drawn here: Icon.tsx has no such glyph and is in every page's start chunk). */
function MoreGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** One My trips row (mine-and-bar-spec 5.2): photo, name, date and countdown, length and party, and the menu at the right of line 1. */
export function CopyRow({ row, unlisted, collapsing, restored, chip, onCalendar, onPrint, onChangeDates, onRemove }: Props) {
  const { item, title } = row;
  const entries: MenuEntry[] = [
    { label: 'Open', icon: 'arrow', href: row.href },
    { label: 'Add to calendar', icon: 'calendar', onSelect: () => onCalendar(row) },
    { label: 'Print', icon: 'print', onSelect: () => onPrint(row) },
    { label: 'Change dates', icon: 'pencil', onSelect: () => onChangeDates(row) },
    { label: 'Remove', icon: 'close', destructive: true, separatorBefore: true, onSelect: () => onRemove(row) },
  ];
  const photo = (
    <span className="crow-photo" data-missing={item.photo && !unlisted ? undefined : ''} aria-hidden="true">
      {item.photo && !unlisted ? (
        // eslint-disable-next-line @next/next/no-img-element -- a same-origin rendition path from the copy's snapshot
        <img src={item.photo} alt="" width={52} height={38} loading="lazy" decoding="async" />
      ) : (
        <Icon name={unlisted ? 'warn' : 'route'} size={22} />
      )}
    </span>
  );
  return (
    <li className="crow" data-copy-id={item.id} data-collapsing={collapsing || undefined} data-restored={restored || undefined}>
      <div className="crow-inner">
        {unlisted ? (
          <div className="crow-link" role="group" aria-label={`${title}, no longer listed`}>
            {photo}
            <span className="crow-name">{title}</span>
            <span className="crow-l2">
              <span className="chip chip-idea">No longer listed</span>
            </span>
            <span className="crow-l3">{row.who}</span>
          </div>
        ) : (
          <Link
            className="crow-link"
            href={row.href}
            aria-label={`${title}, from ${row.when.replace(' · ', ', ')}${row.who ? `, ${row.who.replace(' · ', ', ')}` : ''}${chip ? ', on this device' : ''}`}
          >
            {photo}
            <span className="crow-name">{title}</span>
            <span className="crow-l2">{row.when}</span>
            <span className="crow-l3">{row.who}</span>
          </Link>
        )}
        {chip && !unlisted ? <span className="chip crow-chip">On this device</span> : null}
        <div className="crow-act">
          {unlisted ? (
            <Button size="sm" aria-label={`Remove ${title}`} onClick={() => onRemove(row)}>
              Remove
            </Button>
          ) : (
            <Menu align="end" triggerClassName="crow-menu-btn" triggerLabel={`Actions for ${title}`} trigger={<MoreGlyph />} entries={entries} />
          )}
        </div>
      </div>
    </li>
  );
}
