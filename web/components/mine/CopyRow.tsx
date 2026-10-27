'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { MineThumb } from './MineThumb';
import type { RowModel } from '@/lib/mine/rows';
import { CHIP_NAME, CHIP_WORDS } from '@/lib/mine/chips';
import type { RowSync } from '@/lib/mine/chips';

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
  /** The `accountTrips` flag on and signed in (edit-my-trip 4.7): the chip follows the sync state. Replaces `chip`. */
  sync?: RowSync;
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
export function CopyRow({ row, unlisted, collapsing, restored, chip, sync, onCalendar, onPrint, onChangeDates, onRemove }: Props) {
  const { item, title } = row;
  const entries: MenuEntry[] = [
    { label: 'Open', icon: 'arrow', href: row.href },
    { label: 'Add to calendar', icon: 'calendar', onSelect: () => onCalendar(row) },
    { label: 'Print', icon: 'print', onSelect: () => onPrint(row) },
    { label: 'Change dates', icon: 'pencil', onSelect: () => onChangeDates(row) },
    { label: 'Remove', icon: 'close', destructive: true, separatorBefore: true, onSelect: () => onRemove(row) },
  ];
  // the copy's own snapshot photo first; a copy made before photos were kept asks the trip's small card file as the row nears the screen
  const syncWords = sync ? CHIP_WORDS[sync.state] : null;
  // a Retry chip is a button, so it sits beside the link, not inside it
  const inLink = sync ? (syncWords !== null && sync.state !== 'retry') : !!chip;
  const retry = sync?.state === 'retry';
  const photo = <MineThumb space="trip" slug={item.slug} known={item.photo} off={unlisted} icon={unlisted ? 'warn' : 'route'} area="photo" />;
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
            data-chip={inLink || undefined}
            data-retry={retry || undefined}
            href={row.href}
            aria-label={`${title}, from ${row.when.replace(' · ', ', ')}${row.who ? `, ${row.who.replace(' · ', ', ')}` : ''}${sync ? CHIP_NAME[sync.state] : chip ? ', on this device' : ''}`}
          >
            {photo}
            <span className="crow-name">{title}</span>
            <span className="crow-l2">{row.when}</span>
            <span className="crow-l3">{row.who}</span>
            {sync ? (
              syncWords !== null && sync.state !== 'retry' ? (
                <span className="chip crow-chip" data-sync={sync.state} aria-hidden="true">
                  {sync.state === 'syncing' ? <span className="btn-spin crow-spin" /> : sync.state === 'offline' ? <Icon name="clock" size={12} /> : null}
                  {syncWords}
                </span>
              ) : null
            ) : chip ? (
              <span className="chip crow-chip" aria-hidden="true">On this device</span>
            ) : null}
          </Link>
        )}
        {retry && !unlisted ? (
          <button type="button" className="crow-retry" aria-label={`Not synced. Retry sending changes to ${title}`} onClick={sync?.onRetry} data-sync="retry">
            <span className="chip chip-caution">
              <Icon name="warn" size={12} />
              {CHIP_WORDS.retry}
            </span>
          </button>
        ) : null}
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
