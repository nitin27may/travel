'use client';

import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { ViewName } from '@/lib/entities/types';

const VIEWS: { name: ViewName; label: string; icon: IconName }[] = [
  { name: 'cards', label: 'Cards', icon: 'cards' },
  { name: 'list', label: 'List', icon: 'list' },
  { name: 'table', label: 'Table', icon: 'table' },
  { name: 'map', label: 'Map', icon: 'map' },
];

export const MAP_DISABLED_NOTE = 'Map view arrives in the next release';

export function ViewSwitcher({ view, onChange, mapEnabled = false }: { view: ViewName; onChange: (v: ViewName) => void; mapEnabled?: boolean }) {
  return (
    <div className="seg" role="group" aria-label="View">
      {VIEWS.map((v) => {
        const disabled = v.name === 'map' && !mapEnabled;
        return (
          <button
            key={v.name}
            type="button"
            className="seg-btn"
            aria-pressed={view === v.name}
            aria-disabled={disabled || undefined}
            title={disabled ? MAP_DISABLED_NOTE : v.name === 'table' ? 'Table (grid)' : undefined}
            onClick={() => {
              if (!disabled) onChange(v.name);
            }}
            data-view={v.name}
          >
            <Icon name={v.icon} size={16} />
            <span className="seg-label">{v.label}</span>
            {disabled ? <span className="sr-only">. {MAP_DISABLED_NOTE}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
