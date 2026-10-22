// The pure part of the list types: URL state, facet definitions and the descriptor fields the filter engine reads. The React parts of a
// descriptor (cells, icons, render functions) stay in web/lib/entities/types.ts, which extends EntityDescriptorBase.

export type EntityType = 'place' | 'trip' | 'trail' | 'activity' | 'stay' | 'eatery' | 'offer' | 'booking';
export type ViewName = 'cards' | 'list' | 'table' | 'map';
export const VIEW_NAMES: readonly ViewName[] = ['cards', 'list', 'table', 'map'];

/**
 * URL parameters that carry a facet selection (plan 4.2). `k` is the type scope of the Kind pill (`?k=nature.trail`); `kind` stays
 * for old links (`kind=trail`). The contract's own facets travel as `f.<facet>` and are not listed here (see `isScopedParam`).
 */
export const FACET_PARAMS = [
  'country', 'region', 'area', 'kind', 'k', 'style', 'grade', 'kid', 'season', 'tag', 'trip', 'due', 'effort', 'stroller',
  'length', 'around', 'perday', 'shape', 'drive',
] as const;
export type ScopedParam = `f.${string}`;
export type FacetParam = (typeof FACET_PARAMS)[number] | ScopedParam;

/** True for `f.<facet>`: a facet read from the capture contract for the Kind the list is narrowed to (contract 7.1). */
export const isScopedParam = (p: string): p is ScopedParam => p.length > 2 && p.startsWith('f.');

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
  /** A slot for a filter whose data has not landed: never shown, never filters. */
  hidden?: boolean;
  /**
   * A facet that belongs to a Kind scope (capture contract 7.1): it appears only while the list is narrowed to a Kind whose scope
   * names it and enough of the results answer it. Selections are dropped when the Kind is cleared.
   */
  scoped?: boolean;
  /**
   * The 60% rule for a facet that is not tied to a Kind: it shows only while enough of the rows `among` answer it, otherwise the
   * count line says why when `what` is set ("... hidden: <what>"); without it the facet is hidden silently.
   */
  guard?: { among: (row: Row) => boolean; what?: string };
  /** Hide the facet when no row has a value for it (the data has not landed). */
  hideIfEmpty?: boolean;
  /** An old URL parameter that still filters and shows as a chip, but has no pill of its own (`kind=trail`, now `k=nature.trail`). */
  legacy?: boolean;
  /**
   * The value that means "not checked yet". A row with it never passes a selection that leaves it out, so the count line says
   * how many such rows were left out ("12 not checked yet"). suitability-display.md section 5.
   */
  gap?: {
    value: string;
    note: string;
    /** A row is a gap when this says so (default: its options include `value`). The selection is passed, so one facet can mean two things. */
    isGap?: (row: Row, selected: string[]) => boolean;
  };
  /** A sentence for the count line while this facet has a selection, from the rows that match every filter ("4 more are a stretch, shown faded"). */
  note?: (matched: readonly Row[], selected: string[]) => string | null;
  /** An input other than the option list. `age` is the Kids stepper with quick chips (suitability-display 5); `where` is the cascading Where menu (country, region, area), which owns the facets marked `inWhere`. */
  control?: 'age' | 'where';
  /** The facet is a level of the Where menu: it has no pill, no More-filters group and no sheet group of its own. */
  inWhere?: boolean;
  /** One muted line at the foot of the control's menu ("Trips above this age fade; none are hidden yet"). */
  controlNote?: string;
}

export interface ScopeConfig<Row> {
  /** The row's type id (`nature.trail.hike`), or null when it has none. */
  typeOf: (row: Row) => string | null;
  /** The scope tokens (type ids or `intent:do`) an old `kind=` value stands for. */
  legacyKind: (value: string) => string[];
  /** The scoped facet ids this descriptor can show, in the order the contract lists them. */
  scoped: FacetParam[];
}

export interface GroupDef<Row> {
  id: string;
  label: string;
  key: (row: Row) => string;
  /** Orders the groups when set (Length: day trips first). Without it groups keep the order their first row appears in. */
  order?: (row: Row) => number;
  title: (row: Row) => string;
  subtitle?: (row: Row) => string;
}

export interface EntityDescriptorBase<Row> {
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
  fallbackLabel?: (row: Row) => string;
  /** 'sheet' opens the detail sheet; 'link' follows href straight away. */
  primary: 'sheet' | 'link';
  geo: (row: Row) => { lat: number; lon: number } | null;
  facets: FacetDef<Row>[];
  /** Type-aware facets (contract 7): how a row maps to a Kind and which scoped facets the Kind brings. Absent on lists with no Kind. */
  scope?: ScopeConfig<Row>;
  defaultColumns: string[];
  groupBy: GroupDef<Row>[];
  defaultGroup: string;
  /** Sort values per sortable id (also the column ids that sort). */
  sorts: Record<string, { label: string; value: (row: Row) => string | number | null }>;
  /** The sorts the "Sort by" menu offers (at most six, REVIEW4); the others stay sortable from their table column header. A sort chosen from a column still shows. */
  sortMenu?: readonly string[];
  /** Comparator used when `sort` is empty. */
  defaultSort: (a: Row, b: Row) => number;
  defaultSortLabel: string;
  /**
   * A quality tie-break for the default order (backlog 3.56), for lists whose cards are better with a photo. `tier` names the group a row
   * belongs to (a country); `lead` says the row has what the lead cards need (a photo). Inside a tier the rows that lead come first, and
   * tiers that have a leading row come before tiers that have none. Nothing is hidden or moved out of its tier, and an explicit sort ignores it.
   */
  defaultTier?: { tier: (row: Row) => string; lead: (row: Row) => boolean };
  search: (row: Row) => string;
  /** The ages for which a row is a stretch (space separated, e.g. "0 1 2 3"); cards, list rows and table rows carry it as `data-fade` and filters.css fades them while the Kids filter holds one of those ages. */
  fade?: (row: Row) => string | undefined;
  /** The age the advice starts at for a faded row; carried as `data-from` so the chip can say "advice says 8+". */
  fadeFrom?: (row: Row) => number | undefined;
  /** What the age rests on, in the chip that says why a card fades: `advice` ("advice says 8+") or `plan` ("plan suits 8+"). Default advice. */
  fadeBy?: 'advice' | 'plan';
  /** Rows hidden unless a facet selection names them (dropped places). */
  hiddenByDefault?: (row: Row, state: ListState, ignore?: FacetParam | 'q') => boolean;
  /** Where the row lives as a page, or null. */
  href: (row: Row) => string | null;
  ops: { create?: string; edit?: string; remove?: string };
  /** Words for the empty state. */
  emptyHint: string;
}
