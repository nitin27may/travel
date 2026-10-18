'use client';

import type { ComponentProps } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PillOptions, pillSummary } from '@/components/ui/PillOptions';
import type { PillOption } from '@/components/ui/PillOptions';
import { TAG_KIND_LABELS } from '@/lib/entities/labels';
import type { FacetCount } from '@/lib/entities/filter';
import type { FacetDef } from '@/lib/entities/types';
import { lazyComponent } from './lazyComponent';

interface OptionsProps<Row> {
  facet: FacetDef<Row>;
  options: FacetCount[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Show an in-list filter once there are more options than this. */
  searchAbove?: number;
}

const toOptions = (options: FacetCount[]): PillOption[] => options.map((o) => ({ value: o.value, label: o.label, count: o.count, group: o.group }));
const groupLabel = (g: string) => TAG_KIND_LABELS[g] ?? g;

/** Checkbox list (multi) or radio list (single) with live counts. Used in the pill menu and the phone sheet. */
export function FacetOptions<Row>({ facet, options, selected, onChange, searchAbove = 8 }: OptionsProps<Row>) {
  return <PillOptions label={facet.label} options={toOptions(options)} selected={selected} onChange={onChange} mode={facet.type} searchAbove={searchAbove} groupLabel={groupLabel} />;
}

type PillProps = ComponentProps<typeof import('@/components/ui/FilterPill').FilterPill>;

/** What shows until the popover code has loaded: the pill as it will look, without the menu. Same size, so nothing moves. */
function PillPlaceholder({ label, options, selected }: PillProps) {
  const active = selected.length > 0;
  return (
    <span className="pill" data-active={active || undefined}>
      <button type="button" className="pill-trigger" aria-disabled="true" tabIndex={-1}>
        <span className="pill-text">{pillSummary(label, options, selected)}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {active ? <span className="pill-x" aria-hidden="true" /> : null}
    </span>
  );
}

// The popover library (@base-ui) is about 20 KB gzipped. The pills show at once and become menus a moment after hydration, so
// the list pages stay inside the JS budget without a fallback that looks different.
const LazyPill = lazyComponent<PillProps>(() => import('@/components/ui/FilterPill').then((m) => m.FilterPill), PillPlaceholder);

/** A facet as a filter pill that opens its options. */
export function FacetPopover<Row>({ facet, options, selected, onChange }: OptionsProps<Row>) {
  return <LazyPill label={facet.label} options={toOptions(options)} selected={selected} onChange={onChange} mode={facet.type} groupLabel={groupLabel} />;
}
