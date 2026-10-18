'use client';

import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';

/**
 * STUB (lane L0, handed to L5). Final props; the placeholder lists the formats as disabled entries.
 * L5 wires each format to its generator and keeps `{ target, formats }`.
 */
export type ExportFormat = 'pdf' | 'ics' | 'gpx' | 'kml' | 'csv';

export interface ExportMenuProps {
  target: { type: 'trip' | 'place' | 'list'; slug?: string; rows?: unknown[] };
  formats: ExportFormat[];
}

const LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF (print)',
  ics: 'Calendar (.ics)',
  gpx: 'GPX',
  kml: 'KML',
  csv: 'CSV',
};

export function ExportMenu({ target, formats }: ExportMenuProps) {
  const entries: MenuEntry[] = formats.map((f) => ({ label: LABELS[f], icon: 'download', disabled: true }));
  return (
    <span data-stub="ExportMenu" data-target={target.type}>
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
