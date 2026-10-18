'use client';

import { FilterPill, PillOptions } from '@/components/ui/FilterPill';
import type { PillOption } from '@/components/ui/FilterPill';
import { TAG_KIND_LABELS } from '@/lib/entities/labels';
import type { FacetCount } from '@/lib/entities/filter';
import type { FacetDef } from '@/lib/entities/types';

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

/** A facet as a filter pill that opens its options. */
export function FacetPopover<Row>({ facet, options, selected, onChange }: OptionsProps<Row>) {
  return <FilterPill label={facet.label} options={toOptions(options)} selected={selected} onChange={onChange} mode={facet.type} groupLabel={groupLabel} />;
}
