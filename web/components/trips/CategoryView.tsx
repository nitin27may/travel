'use client';

import { Chip } from '@/components/ui/Chip';
import { DaySign } from '@/components/ui/DaySign';
import { KindGlyph } from '@/components/ui/KindGlyph';
import type { ReactNode } from 'react';
import type { CategoryRowModel, CategorySectionModel } from './model';
import { whenLabel } from './model';

function Row({ row, action }: { row: CategoryRowModel; action?: ReactNode | null }) {
  const { first, rest } = whenLabel(row.days);
  const where = [row.area, row.detail].filter(Boolean).join(' · ');
  return (
    <li className="cat-row" data-edit={action !== undefined ? '' : undefined}>
      <KindGlyph kind={row.kind} size="sm" />
      <div className="cat-main">
        <p className="cat-name">{row.placeSlug ? <a href={`/places/${row.placeSlug}/`}>{row.name}</a> : row.name}</p>
        {where ? <p className="cat-sub">{where}</p> : null}
        {row.bookRule ? (
          <p className="cat-book">
            <Chip kind="toBook">{row.bookRule}</Chip>
            {row.bookNote ? <span className="cat-note">{row.bookNote}</span> : null}
          </p>
        ) : row.bookNote ? (
          <p className="cat-sub">{row.bookNote}</p>
        ) : null}
      </div>
      <p className="cat-when">
        <DaySign n={first} size="s" />
        <span className="num">{[rest, row.time].filter(Boolean).join(' · ')}</span>
      </p>
      {action !== undefined ? <div className="cat-trail" data-print="hide">{action}</div> : null}
    </li>
  );
}

/** By category (patterns 3.4): the same items regrouped under the six headings, in the fixed order; empty categories are omitted. */
export function CategoryView({ sections, action }: { sections: CategorySectionModel[]; action?: (row: CategoryRowModel) => ReactNode }) {
  return (
    <div className="cat-view">
      {sections
        .filter((s) => s.count > 0)
        .map((s) => (
          <section key={s.id} id={s.id} data-cat={s.id} className="cat-section" aria-labelledby={`${s.id}-h`}>
            <h3 id={`${s.id}-h`} className="cat-h">
              {s.label} <span className="num cat-count">{s.count}</span>
            </h3>
            <ul className="rows cat-rows">
              {s.rows.map((r) => (
                <Row key={r.key} row={r} action={action?.(r)} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
