'use client';

import { useId, useState } from 'react';
import type { EntityDescriptor } from '@/lib/entities/types';
import type { UncheckedGroup } from '@/lib/entities/gaps';
import '@/styles/search.css';

/** Rows shown per constraint before "and N more". The list above is the place to browse; this group only shows which rows are missing. */
export const UNCHECKED_PREVIEW = 5;

export interface UncheckedRowsProps<Row> {
  d: EntityDescriptor<Row>;
  groups: UncheckedGroup<Row>[];
}

/** The line a constraint's gap reads under: "have no answer", in the facet's own words when it has them. */
const noun = (note: string) => (note === 'not checked yet' ? 'with no answer' : note);

/**
 * "Not checked yet" (honesty rule H1): rows that fail a constraint only because we have no answer for it. They are not matches and are
 * never counted as such; they sit apart, collapsed, counted per constraint, so a visitor can see what is missing without being told a
 * guess. Opens and closes with the foundation's smooth fold.
 */
export function UncheckedRows<Row>({ d, groups }: UncheckedRowsProps<Row>) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const total = groups.reduce((a, g) => a + g.rows.length, 0);
  if (!total) return null;
  return (
    <section className="unchecked" data-open={open || undefined} aria-label="Not checked yet">
      <button type="button" className="unchecked-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
        <span className="unchecked-caret" aria-hidden="true">&#9656;</span>
        <span>
          <span className="unchecked-ttl">Not checked yet ({total})</span>
          <span className="unchecked-sub">We have no answer for these, so they are not counted as a match. Open to see which.</span>
        </span>
      </button>
      <div className="unchecked-body" id={bodyId} inert={!open}>
        <div>
          <div className="unchecked-grp">
            {groups.map((g) => (
              <div key={g.param}>
                <h3>
                  {g.label}: {g.rows.length} {noun(g.note)}
                </h3>
                <ul>
                  {g.rows.slice(0, UNCHECKED_PREVIEW).map((row) => {
                    const href = d.href(row);
                    const title = d.title(row);
                    return (
                      <li key={d.id(row)} className="unchecked-row">
                        {href ? <a href={href}>{title}</a> : <b>{title}</b>}
                        <span>{d.subtitle?.(row)}</span>
                      </li>
                    );
                  })}
                </ul>
                {g.rows.length > UNCHECKED_PREVIEW ? <p className="unchecked-more">and {g.rows.length - UNCHECKED_PREVIEW} more</p> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export default UncheckedRows;
