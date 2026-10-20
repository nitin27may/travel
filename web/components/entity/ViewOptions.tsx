'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { parseSort, serialiseSort } from '@/lib/entities/sort';
import type { EntityDescriptor, ListState } from '@/lib/entities/types';

/** The button says what it filters and how many values are on; the chips below say which. */
export function FacetLabel({ label, n, value }: { label: string; n: number; value?: string }) {
  return (
    <>
      <span>{label}</span>
      {value ? <span className="facet-val">{value}</span> : null}
      {n > 0 ? (
        <span className="facet-n num">
          {n}
          <span className="sr-only"> selected</span>
        </span>
      ) : null}
    </>
  );
}

/** Group and sort pickers, shared by the bar (desktop) and the phone sheet. */
export function ViewOptions<Row>({ d, state, onState }: { d: EntityDescriptor<Row>; state: ListState; onState: (s: ListState, mode?: 'push' | 'replace') => void }) {
  const keys = parseSort(state.sort);
  const first = keys[0];
  const group = state.group ?? d.defaultGroup;
  return (
    <div className="view-options">
      <label className="select-field">
        <span>Group by</span>
        <Select compact value={d.groupBy.some((g) => g.id === group) ? group : 'none'} onChange={(e) => onState({ ...state, group: e.target.value === d.defaultGroup ? null : e.target.value })}>
          {d.groupBy.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
          <option value="none">No grouping</option>
        </Select>
      </label>
      <div className="select-field sort-field">
        <label>
          <span>Sort by</span>
          <Select compact value={first?.id ?? ''} onChange={(e) => onState({ ...state, sort: e.target.value ? serialiseSort([{ id: e.target.value, desc: first?.desc ?? false }]) : [] })}>
            <option value="">{d.defaultSortLabel}</option>
            {Object.entries(d.sorts).filter(([id]) => !d.sortMenu || d.sortMenu.includes(id) || id === first?.id).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          size="sm"
          icon
          disabled={!first}
          aria-label={first?.desc ? 'Sorted descending. Switch to ascending' : 'Sorted ascending. Switch to descending'}
          title={first?.desc ? 'Descending' : 'Ascending'}
          onClick={() => first && onState({ ...state, sort: serialiseSort([{ id: first.id, desc: !first.desc }, ...keys.slice(1)]) })}
        >
          <Icon name="sort" size={16} className={first?.desc ? 'flip' : undefined} />
        </Button>
      </div>
    </div>
  );
}
