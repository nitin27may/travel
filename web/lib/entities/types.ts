import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { IconName } from '@/components/ui/Icon';
import type { EntityDescriptorBase, ListState } from '@travel/core/query/types.ts';

// The pure types (URL state, facet definitions, the descriptor fields the engine reads) live in core/src/query/types.ts.
export * from '@travel/core/query/types.ts';

export interface DetailSection<Row> {
  title: string;
  render: (row: Row) => ReactNode;
}

/** The pure descriptor plus what only a page needs: cells, icons and render functions. */
export interface EntityDescriptor<Row> extends EntityDescriptorBase<Row> {
  /** Right-aligned key facts in the list view. */
  listAside?: (row: Row) => ReactNode;
  /** Footer of a card: source indicator and onward links. */
  cardFooter?: (row: Row) => ReactNode;
  iconFor: (row: Row) => IconName;
  columns: ColumnDef<Row, unknown>[];
  detail: DetailSection<Row>[];
  /** Buttons and links shown under the detail sheet's title. */
  actions?: (row: Row) => ReactNode;
  /**
   * Map view. When set, the Map segment is enabled and this renders it from the filtered rows (lanes L3 and L4 supply it
   * from their own descriptor files, so they never edit components/entity/).
   */
  renderMap?: (rows: Row[], state: ListState) => ReactNode;
}
