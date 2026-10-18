import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { IconName } from '@/components/ui/Icon';

export type EntityType = 'place' | 'trip' | 'trail' | 'activity' | 'stay' | 'eatery' | 'offer' | 'booking';
export type ViewName = 'cards' | 'list' | 'table' | 'map';
export const VIEW_NAMES: readonly ViewName[] = ['cards', 'list', 'table', 'map'];

/** URL parameters that carry a facet selection (plan 4.2). */
export const FACET_PARAMS = ['country', 'region', 'area', 'kind', 'style', 'grade', 'kid', 'season', 'tag', 'trip', 'due', 'effort', 'stroller'] as const;
export type FacetParam = (typeof FACET_PARAMS)[number];

/** All list state; everything here is in the URL. */
export interface ListState {
  q: string;
  facets: Partial<Record<FacetParam, string[]>>;
  /** west,south,east,north */
  bbox: string | null;
  view: ViewName;
  /** Sort keys; a leading '-' means descending. Empty = the descriptor default. */
  sort: string[];
  /** Group id, 'none' for ungrouped, null = the descriptor default. */
  group: string | null;
  /** Visible table column ids, null = the descriptor default. */
  cols: string[] | null;
  /** Advanced filter conditions (opaque here; P3b owns the grammar). */
  f: string | null;
  /** Name of a saved view. */
  sv: string | null;
  focus: string | null;
  ids: string[];
  label: string | null;
  /** 1-based page of the list (components 8.5: 48 cards or 100 rows a page); 1 is the default and is not written. */
  page: number;
}

export interface Badge {
  /** Visible text; always present so colour is never the only signal. */
  text: string;
  /** The underlying value (a status key), used to colour the glyph. */
  value?: string;
  tone: 'neutral' | 'kind' | 'status' | 'season' | 'kid' | 'warn' | 'muted';
  /** Icon key for the leading glyph (shape carries meaning in addition to colour). */
  icon?: string;
  title?: string;
}

export interface FacetOption {
  value: string;
  label: string;
  /** Heading the option sits under (tag kind); options with a group are listed group by group. */
  group?: string;
  /** One line under the label in the menu: what the option means, visible without a tooltip. */
  hint?: string;
}

export interface FacetDef<Row> {
  param: FacetParam;
  label: string;
  /** 'single' facets hold at most one value. */
  type: 'single' | 'multi';
  /** The facet values a row has, with display labels. */
  options: (row: Row) => FacetOption[];
  /** Show only while this other facet has a value (region needs country). */
  dependsOn?: FacetParam;
  /** Override matching, e.g. a region given as a code, a name or an ISO code. */
  match?: (row: Row, selected: string[]) => boolean;
  /** Order of the groups, for facets whose options carry a group. */
  groupOrder?: string[];
  /** Fixed display order of values; unknown values follow by count. */
  order?: string[];
  /** Values that always sort after the rest ("Not in a trip yet"). */
  last?: string[];
  /** Normalise a value read from the URL. */
  normalise?: (value: string) => string;
  /**
   * Where the facet shows (principle P4): 'primary' is a pill in the bar, 'more' sits under "More filters". Default 'primary'.
   * Four primary filters a list; the rest are one tap further.
   */
  tier?: 'primary' | 'more';
  /** A slot for a filter whose data has not landed (effort and stroller wait for S1): never shown, never filters. */
  hidden?: boolean;
  /**
   * The value that means "not checked yet". A row with it never passes a selection that leaves it out, so the count line says
   * how many such rows were left out ("12 not checked yet"). suitability-display.md section 5.
   */
  gap?: { value: string; note: string };
}

export interface GroupDef<Row> {
  id: string;
  label: string;
  key: (row: Row) => string;
  title: (row: Row) => string;
  subtitle?: (row: Row) => string;
}

export interface DetailSection<Row> {
  title: string;
  render: (row: Row) => ReactNode;
}

export interface EntityDescriptor<Row> {
  type: EntityType;
  schemaId: string;
  noun: { one: string; many: string };
  /** Short headline for the page. */
  heading: string;
  id: (row: Row) => string;
  title: (row: Row) => string;
  subtitle?: (row: Row) => string;
  image?: (row: Row) => string | null;
  badges?: (row: Row) => Badge[];
  /** One line under the title in cards and lists. */
  summary?: (row: Row) => string;
  /** Right-aligned key facts in the list view. */
  listAside?: (row: Row) => ReactNode;
  /** Footer of a card: source indicator and onward links. */
  cardFooter?: (row: Row) => ReactNode;
  iconFor: (row: Row) => IconName;
  fallbackLabel?: (row: Row) => string;
  /** 'sheet' opens the detail sheet; 'link' follows href straight away. */
  primary: 'sheet' | 'link';
  geo: (row: Row) => { lat: number; lon: number } | null;
  facets: FacetDef<Row>[];
  columns: ColumnDef<Row, unknown>[];
  defaultColumns: string[];
  groupBy: GroupDef<Row>[];
  defaultGroup: string;
  /** Sort values per sortable id (also the column ids that sort). */
  sorts: Record<string, { label: string; value: (row: Row) => string | number | null }>;
  /** Comparator used when `sort` is empty. */
  defaultSort: (a: Row, b: Row) => number;
  defaultSortLabel: string;
  search: (row: Row) => string;
  /** Rows hidden unless a facet selection names them (dropped places). */
  hiddenByDefault?: (row: Row, state: ListState, ignore?: FacetParam | 'q') => boolean;
  /** Where the row lives as a page, or null. */
  href: (row: Row) => string | null;
  detail: DetailSection<Row>[];
  /** Buttons and links shown under the detail sheet's title. */
  actions?: (row: Row) => ReactNode;
  ops: { create?: string; edit?: string; remove?: string };
  /** Words for the empty state. */
  emptyHint: string;
  /**
   * Map view. When set, the Map segment is enabled and this renders it from the filtered rows (lanes L3 and L4 supply it
   * from their own descriptor files, so they never edit components/entity/).
   */
  renderMap?: (rows: Row[], state: ListState) => ReactNode;
}
