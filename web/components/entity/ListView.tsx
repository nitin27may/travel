'use client';

import { BadgeRow } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
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
              return (
                <ListRow
                  key={id}
                  icon={d.iconFor(row)}
                  data-entity-id={id}
                  data-focused={state.focus === id || undefined}
                  title={
                    <OpenLink id={id} state={state} href={d.href(row)} primary={d.primary} onOpen={onOpen} className="row-open">
                      {d.title(row)}
                    </OpenLink>
                  }
                  meta={d.subtitle?.(row)}
                  summary={d.summary?.(row)}
                  chips={d.badges ? <BadgeRow badges={d.badges(row)} className="row-badges" /> : undefined}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
