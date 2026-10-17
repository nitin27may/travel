'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import type { RefObject } from 'react';
import { BadgeRow } from '@/components/ui/Badge';
import { EntityImage } from '@/components/ui/EntityImage';
import { Icon } from '@/components/ui/Icon';
import type { EntityDescriptor } from '@/lib/entities/types';

interface Props<Row> {
  d: EntityDescriptor<Row>;
  row: Row | null;
  onClose: () => void;
  /** The element that opened the sheet; focus returns to it on close. */
  trigger: RefObject<HTMLElement | null>;
}

/** One detail card for every view; deep-linked with ?focus=<id>. Side sheet on desktop, bottom sheet on phones. */
export function DetailSheet<Row>({ d, row, onClose, trigger }: Props<Row>) {
  // keep the last row mounted while the closing transition runs
  const [kept, setKept] = useState<Row | null>(row);
  if (row && row !== kept) setKept(row);
  const shown = row ?? kept;

  return (
    <Dialog.Root open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="scrim" />
        <Dialog.Popup className="sheet sheet-side" finalFocus={trigger} aria-describedby={undefined}>
          {shown ? (
            <>
              <div className="sheet-media">
                <EntityImage src={d.image?.(shown) ?? null} width={900} fallbackIcon={d.iconFor(shown)} fallbackLabel={d.fallbackLabel?.(shown)} />
                <Dialog.Close className="icon-btn sheet-close" aria-label="Close details">
                  <Icon name="close" size={18} />
                </Dialog.Close>
              </div>
              <div className="sheet-body">
                <Dialog.Title className="sheet-heading">{d.title(shown)}</Dialog.Title>
                {d.subtitle ? <p className="card-sub">{d.subtitle(shown)}</p> : null}
                {d.badges ? <BadgeRow badges={d.badges(shown)} /> : null}
                {d.actions ? <div className="sheet-actions">{d.actions(shown)}</div> : null}
                {d.detail.map((s) => (
                  <section key={s.title} className="sheet-section">
                    <h3>{s.title}</h3>
                    {s.render(shown)}
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
