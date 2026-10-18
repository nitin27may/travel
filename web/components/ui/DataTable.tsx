import type { ReactNode } from 'react';

interface Props {
  /** Saved views, Columns, Density, Export CSV (components 4.2). */
  tools: ReactNode;
  density: 'comfortable' | 'compact';
  /** The scroll container; holds the table so the page itself never scrolls sideways. */
  scrollRef?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Shell of the data table: tools row above, then a bordered, rounded container that scrolls inside itself with
 * a sticky head and sticky group rows. Rows, cells and sorting stay with the caller (TanStack Table).
 */
export function DataTableShell({ tools, density, scrollRef, children }: Props) {
  return (
    <div className="table-view" data-density={density}>
      <div className="table-tools">{tools}</div>
      <div className="table-scroll" ref={scrollRef} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
