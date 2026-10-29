'use client';

import Link from 'next/link';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import type { IdentityKey } from '@/components/ui/Chip';
import { MineThumb } from './MineThumb';
import { slugIdentity } from '@travel/core/schema/identity.ts';
import type { DraftRowModel } from '@/lib/mine/deviceList';
import { CHIP_NAME, CHIP_WORDS } from '@/lib/mine/chips';
import type { RowSync } from '@/lib/mine/chips';

interface Props {
  row: DraftRowModel;
  collapsing?: boolean;
  restored?: boolean;
  /** Signed in without account sync: the chip "On this device". */
  chip?: boolean;
  /** Account sync on: a draft is on this device only, so it carries "On this device" unless the card line already says so. */
  sync?: Pick<RowSync, 'state' | 'bare'>;
  onRemove: (r: DraftRowModel) => void;
}

function MoreGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/**
 * A plan the builder keeps on this device, in the same row as a copy (one Mine list, gap-analysis 2.6): same anatomy, the menu is Open,
 * Edit (a built plan with `tripEdit` on) and Remove. A draft with no build carries the chip "Draft · ready to build" and opens in the
 * builder. Calendar, Print and Change dates belong to the plan's own page, where its cover has them.
 */
export function DraftRow({ row, collapsing, restored, chip, sync, onRemove }: Props) {
  const { draft, title } = row;
  const entries: MenuEntry[] = [
    // with the builder off an unbuilt draft opens nowhere: Remove is all the menu holds (PR-010)
    ...(row.href ? [{ label: row.chip ? 'Continue' : 'Open', icon: 'arrow' as const, href: row.href }] : []),
    ...(row.editHref ? [{ label: 'Edit', icon: 'pencil' as const, href: row.editHref }] : []),
    { label: 'Remove', icon: 'close', destructive: true, separatorBefore: !!(row.href || row.editHref), onSelect: () => onRemove(row) },
  ];
  const syncWords = sync && !sync.bare ? CHIP_WORDS[sync.state] : null;
  const words = row.chip ?? (sync ? syncWords : chip ? CHIP_WORDS.device : null);
  const ring = (draft.identity ?? slugIdentity(draft.slug ?? draft.id)) as IdentityKey;
  const dated = draft.start !== null;
  const state = row.href === null ? ', draft, the planner is not open yet' : row.chip ? ', draft, ready to build' : sync ? CHIP_NAME[sync.state] : chip ? ', on this device' : '';
  const inner = (
    <>
      <MineThumb space="trip" slug={draft.slug ?? draft.id} off icon="route" area="photo" ring={ring} />
      <span className="crow-name">{title}</span>
      <span className="crow-l2">{row.when}</span>
      <span className="crow-l3">{row.who}</span>
      {row.label ? <span className="crow-from">{row.label}</span> : null}
      {words ? (
        <span className="chip crow-chip">
          {words}
        </span>
      ) : null}
    </>
  );
  return (
    <li className="crow" data-copy-id={row.id} data-draft="" data-collapsing={collapsing || undefined} data-restored={restored || undefined}>
      <div className="crow-inner">
        {row.href === null ? (
          // not a link: the row says what it is and why nothing opens (the same anatomy as a trip no longer listed)
          <div className="crow-link" data-chip={words ? true : undefined}
            data-from={row.label ? true : undefined} role="group" aria-label={`${title}, ${dated ? `from ${row.when.replace(' · ', ', ')}` : 'no date'}${row.who ? `, ${row.who.replace(' · ', ', ')}` : ''}${row.label ? `, ${row.label}` : ''}${state}`}>
            {inner}
          </div>
        ) : (
          <Link
            className="crow-link"
            data-chip={words ? true : undefined}
            data-from={row.label ? true : undefined}
            href={row.href}
          >
            {inner}
          </Link>
        )}
        <div className="crow-act">
          <Menu align="end" triggerClassName="crow-menu-btn" triggerLabel={`Actions for ${title}`} trigger={<MoreGlyph />} entries={entries} />
        </div>
      </div>
    </li>
  );
}
