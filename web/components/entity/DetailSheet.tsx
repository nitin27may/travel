'use client';

import { useState } from 'react';
import type { RefObject } from 'react';
import { BadgeRow } from '@/components/ui/Badge';
import { EntityImage } from '@/components/ui/EntityImage';
import { SideSheet } from '@/components/ui/SideSheet';
import type { EntityDescriptor } from '@/lib/entities/types';

export interface DetailSheetProps<Row> {
  d: EntityDescriptor<Row>;
  row: Row | null;
  onClose: () => void;
  /** The element that opened the sheet; focus returns to it on close. */
  trigger: RefObject<HTMLElement | null>;
}

/** One detail card for every view; deep-linked with ?focus=<id>. Side sheet on desktop, full-width on phones. Non-modal: the page behind stays scrollable. */
export function DetailSheet<Row>({ d, row, onClose, trigger }: DetailSheetProps<Row>) {
  // keep the last row mounted while the closing transition runs
  const [kept, setKept] = useState<Row | null>(row);
  if (row && row !== kept) setKept(row);
  const shown = row ?? kept;

  return (
    <SideSheet
      open={Boolean(row)}
      onOpenChange={(open) => !open && onClose()}
      title={shown ? d.title(shown) : ''}
      kicker={shown ? d.fallbackLabel?.(shown) : undefined}
      media={shown ? <EntityImage src={d.image?.(shown) ?? null} width={900} fallbackIcon={d.iconFor(shown)} fallbackLabel={d.fallbackLabel?.(shown)} /> : undefined}
      modal="trap-focus"
      finalFocus={trigger}
    >
      {shown ? (
        <>
          {d.subtitle ? <p className="card-sub card-sub-wrap">{d.subtitle(shown)}</p> : null}
          {d.badges ? <BadgeRow badges={d.badges(shown)} /> : null}
          {d.actions ? <div className="sheet-actions">{d.actions(shown)}</div> : null}
          {d.detail.map((s) => (
            <section key={s.title} className="sheet-section">
              <h3>{s.title}</h3>
              {s.render(shown)}
            </section>
          ))}
        </>
      ) : null}
    </SideSheet>
  );
}
