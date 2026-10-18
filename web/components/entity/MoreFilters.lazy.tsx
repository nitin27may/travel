'use client';

import { Icon } from '@/components/ui/Icon';
import type { MoreFiltersProps } from './MoreFilters';
import { lazyComponent } from './lazyComponent';

/** The "More filters" button as it looks before the popover code has loaded (see lazyComponent). */
function Placeholder<Row>({ facets, state }: MoreFiltersProps<Row>) {
  const active = facets.reduce((n, f) => n + (state.facets[f.param]?.length ?? 0), 0);
  return (
    <span className="pill more-filters-pill" data-active={active > 0 || undefined}>
      <button type="button" className="pill-trigger" aria-disabled="true" tabIndex={-1}>
        <span className="pill-text">{active ? `More filters · ${active}` : 'More filters'}</span>
        <Icon name="chevronDown" size={14} />
      </button>
    </span>
  );
}

export const LazyMoreFilters = lazyComponent<MoreFiltersProps<never>>(() => import('./MoreFilters').then((m) => m.MoreFilters as never), Placeholder) as <Row>(props: MoreFiltersProps<Row>) => React.ReactElement | null;
