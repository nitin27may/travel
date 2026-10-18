'use client';

import { Segmented } from '@/components/ui/Segmented';
import type { Segment } from '@/components/ui/Segmented';
import type { ViewName } from '@/lib/entities/types';

export const MAP_DISABLED_NOTE = 'Map view arrives in the next release';

const BASE: Segment<ViewName>[] = [
  { value: 'cards', label: 'Cards', icon: 'cards', dataView: 'cards' },
  { value: 'list', label: 'List', icon: 'list', dataView: 'list' },
  { value: 'table', label: 'Table', icon: 'table', title: 'Table (grid)', dataView: 'table' },
  { value: 'map', label: 'Map', icon: 'map', dataView: 'map' },
];

/** Cards / List / Table / Map as a radio group; icon-only on phone (four segments). Map is enabled when the entity supplies `renderMap`. */
export function ViewSwitcher({ view, onChange, mapEnabled = false }: { view: ViewName; onChange: (v: ViewName) => void; mapEnabled?: boolean }) {
  const segments = BASE.map((s) => (s.value === 'map' && !mapEnabled ? { ...s, disabled: true, title: MAP_DISABLED_NOTE } : s));
  return <Segmented label="View" segments={segments} value={view} onChange={onChange} iconsOnPhone />;
}
