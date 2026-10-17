'use client';

import { BadgeRow } from '@/components/ui/Badge';
import { EntityImage } from '@/components/ui/EntityImage';
import { GroupHeading } from './GroupHeading';
import { OpenLink } from './OpenLink';
import type { ViewProps } from './viewTypes';

export function ListView<Row>({ d, groups, state, onOpen }: ViewProps<Row>) {
  return (
    <div className="list-view">
      {groups.map((g, gi) => (
        <section key={g.key || gi} aria-labelledby={g.key ? `grp-${gi}` : undefined}>
          <GroupHeading group={g} id={`grp-${gi}`} />
          <ul className="rows">
            {g.rows.map((row) => {
              const id = d.id(row);
              const summary = d.summary?.(row);
              return (
                <li key={id} className="row" data-entity-id={id} data-focused={state.focus === id || undefined}>
                  <div className="row-thumb">
                    <EntityImage src={d.image?.(row) ?? null} width={160} fallbackIcon={d.iconFor(row)} />
                  </div>
                  <div className="row-main">
                    <h3 className="row-title">
                      <OpenLink id={id} state={state} href={d.href(row)} primary={d.primary} onOpen={onOpen} className="row-open">
                        {d.title(row)}
                      </OpenLink>
                    </h3>
                    {d.subtitle ? <p className="row-sub">{d.subtitle(row)}</p> : null}
                    {summary ? <p className="row-note">{summary}</p> : null}
                  </div>
                  {d.badges ? <BadgeRow badges={d.badges(row)} className="row-badges" /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
