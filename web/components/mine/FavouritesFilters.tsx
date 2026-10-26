'use client';

import { useId, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FacetPill } from '@/components/entity/FacetPill';
import { PillOptions } from '@/components/ui/PillOptions';
import { Segmented } from '@/components/ui/Segmented';
import { activeCount, countryOptions, kindOptions, NO_FILTERS } from '@/lib/favourites/panel';
import type { Filters, Sort } from '@/lib/favourites/panel';
import type { FavItem } from '@travel/core/schema/favourites.ts';

interface Props {
  items: readonly FavItem[];
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Phone: Kind, Country and Sort sit behind "Filters (n)" in a bottom sheet. */
  phone: boolean;
  /** Rows the filters leave, for the sheet's "Show N". */
  shown: number;
}

const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
];

/** Kind, Country and Sort of the Favourites tab (spec 5.3). Loaded after the tab paints: the pills carry the popover library. */
export default function FavouritesFilters({ items, filters, onChange, phone, shown }: Props) {
  const [open, setOpen] = useState(false);
  const sortName = useId();
  const kinds = kindOptions(items, filters.scope);
  const countries = countryOptions(items, filters.scope);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  if (!phone) {
    return (
      <>
        {kinds.length > 1 ? <FacetPill label="Kind" options={kinds} selected={filters.kinds} onChange={(kinds) => set({ kinds })} /> : null}
        {countries.length > 1 ? <FacetPill label="Country" options={countries} selected={filters.countries} onChange={(countries) => set({ countries })} /> : null}
        <Segmented size="s" label="Sort" segments={SORTS} value={filters.sort} onChange={(sort) => set({ sort })} className="favs-sort" />
      </>
    );
  }

  const n = activeCount(filters);
  return (
    <>
      <Button className="favs-filter-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Filters{n ? ` (${n})` : ''}
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Filters"
        snaps={['full']}
        initial="full"
        footer={
          <>
            <Button disabled={n === 0} onClick={() => onChange({ ...NO_FILTERS, scope: filters.scope })}>
              Clear all
            </Button>
            <Button variant="primary" className="sheet-apply" onClick={() => setOpen(false)}>
              Show {shown} {shown === 1 ? 'favourite' : 'favourites'}
            </Button>
          </>
        }
      >
        <div className="favs-sheet">
          {kinds.length > 1 ? (
            <section>
              <h3 className="favs-sheet-h">Kind</h3>
              <PillOptions label="Kind" options={kinds} selected={filters.kinds} onChange={(kinds) => set({ kinds })} />
            </section>
          ) : null}
          {countries.length > 1 ? (
            <section>
              <h3 className="favs-sheet-h">Country</h3>
              <PillOptions label="Country" options={countries} selected={filters.countries} onChange={(countries) => set({ countries })} />
            </section>
          ) : null}
          <section>
            <h3 className="favs-sheet-h">Sort</h3>
            <fieldset className="facet-options">
              <legend className="sr-only">Sort</legend>
              <ul>
                {SORTS.map((s) => (
                  <li key={s.value}>
                    <label className="opt">
                      <input type="radio" name={sortName} checked={filters.sort === s.value} onChange={() => set({ sort: s.value })} />
                      <span className="opt-label">{s.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </section>
        </div>
      </BottomSheet>
    </>
  );
}
